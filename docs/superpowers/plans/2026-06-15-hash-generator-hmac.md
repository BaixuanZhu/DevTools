# 哈希生成器 HMAC 模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有哈希生成器（`/crypto/hash-generator`）上扩展 HMAC 带密钥哈希的「生成」与「验证」能力，覆盖 API 签名与 Webhook 校验场景。

**Architecture:** 算法层在 `src/utils/crypto/hash.ts` 新增 `decodeToBytes` / `computeHmac` / `verifyHmac`（复用 Web Crypto `subtle.sign('HMAC')`，密钥与签名支持 text/hex/base64 三编码，验证用常量时间比较）；组件层在 `HashGenerator.vue` 现有哈希区下方追加独立 HMAC 区块，生成结果常驻、待验签名作为附加输入实时比对，零 Tab 切换。现有哈希区逻辑与 `hash.ts` 旧函数不动，零回归。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、Web Crypto API（`crypto.subtle`）、Tailwind v4、`@headlessui/vue`（SelectListbox）、vitest。

**Spec:** `docs/superpowers/specs/2026-06-15-hash-generator-hmac-design.md`

---

## File Structure

| 文件 | 责任 | 改动类型 |
|------|------|----------|
| `src/utils/crypto/hash.ts` | 新增 `KeyEncoding` / `HMAC_ALGORITHMS` / `decodeToBytes` / `importHmacKey` / `computeHmac` / `verifyHmac` / `timingSafeEqual` | 新增（不改旧函数） |
| `src/tests/crypto/hash.test.ts` | HMAC 算法层单元测试（RFC 4231 / RFC 2202 向量） | 新增测试块 |
| `src/tools/crypto/HashGenerator.vue` | HMAC 区块（状态 + 生成/验证逻辑 + UI） | 在现有区块后追加 |
| `src/data/tools.ts` | `hash-generator` 元数据补 HMAC 关键词 | 修改 |
| `src/data/tool-faqs.ts` | `hash-generator` 加 3 条 HMAC FAQ | 追加 |

**约定**：算法层走严格 TDD（先测试后实现）；UI 层项目无 Vue 组件测试基础设施，用 `pnpm build`（类型 + 编译）+ `pnpm dev` 手动验证。每个 Task 一个 commit，message 用项目惯例 `feat(crypto): ...` / `docs(...)`。

---

## Task 1: `decodeToBytes` 编码解码工具

**Files:**
- Modify: `src/utils/crypto/hash.ts`（import 行 + 新增函数）
- Test: `src/tests/crypto/hash.test.ts`（新增 describe 块）

- [ ] **Step 1: 写失败测试**

在 `src/tests/crypto/hash.test.ts` 顶部 import 行追加 `decodeToBytes`：

```ts
import { computeHash, computeFileHash, HASH_ALGORITHMS, decodeToBytes } from '../../utils/crypto/hash';
```

在文件末尾追加：

```ts
describe('decodeToBytes', () => {
  it('应按 text 编码解码 ASCII 文本', () => {
    const buf = decodeToBytes('AB', 'text');
    expect(Array.from(new Uint8Array(buf))).toEqual([0x41, 0x42]);
  });

  it('应按 text 编码解码中文（UTF-8）', () => {
    const buf = decodeToBytes('你', 'text');
    expect(Array.from(new Uint8Array(buf))).toEqual([0xe4, 0xbd, 0xa0]);
  });

  it('应按 hex 编码解码', () => {
    const buf = decodeToBytes('4142', 'hex');
    expect(Array.from(new Uint8Array(buf))).toEqual([0x41, 0x42]);
  });

  it('应按 base64 编码解码', () => {
    const buf = decodeToBytes('QUI=', 'base64');
    expect(Array.from(new Uint8Array(buf))).toEqual([0x41, 0x42]);
  });

  it('非法 hex 应抛错', () => {
    expect(() => decodeToBytes('zz', 'hex')).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/tests/crypto/hash.test.ts`
Expected: FAIL，报 `decodeToBytes is not a function`（未导出）。

- [ ] **Step 3: 实现 `decodeToBytes`**

在 `src/utils/crypto/hash.ts`：

第 2 行 import 改为（补 `base64ToArrayBuffer` 与 `toArrayBuffer`，按字母序）：

```ts
import { arrayBufferToBase64, arrayBufferToHex, base64ToArrayBuffer, hexToArrayBuffer, toArrayBuffer } from '../shared/array-buffer';
```

在第 8 行（`HashAlgorithm` 类型定义）之后追加类型与函数：

```ts
/** 密钥与待验签名的输入编码 */
export type KeyEncoding = 'text' | 'hex' | 'base64';

/**
 * 按指定编码将字符串解码为 ArrayBuffer。
 * @param input - 编码后的字符串
 * @param encoding - 编码格式
 * @returns 解码后的字节缓冲区；非法 hex/base64 会抛错
 */
export function decodeToBytes(input: string, encoding: KeyEncoding): ArrayBuffer {
  switch (encoding) {
    case 'text':
      return toArrayBuffer(new TextEncoder().encode(input));
    case 'hex':
      // hexToArrayBuffer 对非法字符静默转 0，需在此显式校验，避免密钥输错却「看似成功」
      if (!/^(?:[0-9a-fA-F]{2})+$/.test(input)) {
        throw new Error('非法的 Hex 字符串');
      }
      return hexToArrayBuffer(input);
    case 'base64':
      return base64ToArrayBuffer(input);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/tests/crypto/hash.test.ts`
Expected: PASS（全部用例含新 `decodeToBytes` 块）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/crypto/hash.ts src/tests/crypto/hash.test.ts
git commit -m "feat(crypto): add decodeToBytes helper for text/hex/base64 decoding"
```

---

## Task 2: `computeHmac` 生成（含 `importHmacKey`）

**Files:**
- Modify: `src/utils/crypto/hash.ts`
- Test: `src/tests/crypto/hash.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/tests/crypto/hash.test.ts` import 行追加 `computeHmac`：

```ts
import { computeHash, computeFileHash, HASH_ALGORITHMS, decodeToBytes, computeHmac } from '../../utils/crypto/hash';
```

文件末尾追加（向量来自 RFC 4231 / RFC 2202）：

```ts
describe('computeHmac', () => {
  // RFC 4231 Test Case 2：key="Jefe", data="what do ya want for nothing?"
  it('应按 RFC 4231 计算 HMAC-SHA-256（text 密钥）', async () => {
    const result = await computeHmac('what do ya want for nothing?', 'Jefe', 'text', 'SHA-256');
    expect(result.hex).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  // RFC 2202 Test Case 2：key="Jefe", data="what do ya want for nothing?"
  it('应按 RFC 2202 计算 HMAC-SHA-1（text 密钥）', async () => {
    const result = await computeHmac('what do ya want for nothing?', 'Jefe', 'text', 'SHA-1');
    expect(result.hex).toBe('effcdf6ae5eb2fa2d27416d5f184df9c259a7c79');
  });

  // RFC 4231 Test Case 1：key=0x0b×20, data="Hi There"
  it('应支持 hex 编码密钥', async () => {
    const result = await computeHmac('Hi There', '0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b', 'hex', 'SHA-256');
    expect(result.hex).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });

  it('应返回 hexUpper 与 base64 三态', async () => {
    const result = await computeHmac('what do ya want for nothing?', 'Jefe', 'text', 'SHA-256');
    expect(result.hexUpper).toBe('5BDCC146BF60754E6A042426089575C75A003F089D2739839DEC58B964EC3843');
    expect(result.base64).toBe('W9zBRr9gdU5qBCQmCJV1x1oAPwidJzmDnexYuWTsOEM=');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/tests/crypto/hash.test.ts`
Expected: FAIL，报 `computeHmac is not a function`。

- [ ] **Step 3: 实现 `importHmacKey` 与 `computeHmac`**

在 `src/utils/crypto/hash.ts` 末尾追加：

```ts
/** 支持的 HMAC 算法（SHA 系列，不含 MD5） */
export const HMAC_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

/** HMAC 算法类型 */
export type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number];

/**
 * 导入 HMAC 密钥。computeHmac 与 verifyHmac 共用。
 * @param key - 密钥字符串
 * @param keyEncoding - 密钥编码
 * @param algorithm - HMAC 使用的哈希算法
 */
async function importHmacKey(key: string, keyEncoding: KeyEncoding, algorithm: HmacAlgorithm): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    decodeToBytes(key, keyEncoding),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
}

/**
 * 对文本消息计算 HMAC，返回 hex/hexUpper/base64 三态结果。
 * @param message - 待签名消息（按 UTF-8 编码）
 * @param key - 密钥字符串
 * @param keyEncoding - 密钥编码
 * @param algorithm - HMAC 算法
 */
export async function computeHmac(
  message: string,
  key: string,
  keyEncoding: KeyEncoding,
  algorithm: HmacAlgorithm,
): Promise<HashResult> {
  const cryptoKey = await importHmacKey(key, keyEncoding, algorithm);
  const data = toArrayBuffer(new TextEncoder().encode(message));
  const raw = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hex = arrayBufferToHex(raw);
  return {
    hex,
    hexUpper: hex.toUpperCase(),
    base64: arrayBufferToBase64(raw),
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/tests/crypto/hash.test.ts`
Expected: PASS（含 4 个新 `computeHmac` 用例）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/crypto/hash.ts src/tests/crypto/hash.test.ts
git commit -m "feat(crypto): add computeHmac with RFC 4231 test vectors"
```

---

## Task 3: `verifyHmac` 验证（含 `timingSafeEqual` 与签名归一化）

**Files:**
- Modify: `src/utils/crypto/hash.ts`
- Test: `src/tests/crypto/hash.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/tests/crypto/hash.test.ts` import 行追加 `verifyHmac`：

```ts
import { computeHash, computeFileHash, HASH_ALGORITHMS, decodeToBytes, computeHmac, verifyHmac } from '../../utils/crypto/hash';
```

文件末尾追加：

```ts
describe('verifyHmac', () => {
  const message = 'what do ya want for nothing?';
  const key = 'Jefe';
  // 对应 HMAC-SHA-256
  const validHex = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';

  it('正确签名应返回 true', async () => {
    expect(await verifyHmac(message, key, 'text', 'SHA-256', validHex, 'hex')).toBe(true);
  });

  it('错误签名应返回 false', async () => {
    expect(await verifyHmac(message, key, 'text', 'SHA-256', '0'.repeat(64), 'hex')).toBe(false);
  });

  it('应容忍 sha256= 前缀', async () => {
    expect(await verifyHmac(message, key, 'text', 'SHA-256', `sha256=${validHex}`, 'hex')).toBe(true);
  });

  it('应容忍大小写差异', async () => {
    expect(await verifyHmac(message, key, 'text', 'SHA-256', validHex.toUpperCase(), 'hex')).toBe(true);
  });

  it('应容忍首尾空白', async () => {
    expect(await verifyHmac(message, key, 'text', 'SHA-256', ` ${validHex} `, 'hex')).toBe(true);
  });

  it('密钥格式非法应抛错（交由调用方提示）', async () => {
    await expect(verifyHmac(message, 'zz', 'hex', 'SHA-256', validHex, 'hex')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/tests/crypto/hash.test.ts`
Expected: FAIL，报 `verifyHmac is not a function`。

- [ ] **Step 3: 实现 `timingSafeEqual` 与 `verifyHmac`**

在 `src/utils/crypto/hash.ts` 末尾（`computeHmac` 之后）追加：

```ts
/**
 * 常量时间字节比较，避免通过响应耗时推断内容（时序攻击）。
 * 即使长度不等也遍历到较短长度，仅最终判定时把长度差异计入。
 * @param a - 期望字节
 * @param b - 待比较字节
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** 待验签名需要剥离的厂商前缀（大小写不敏感） */
const SIGNATURE_PREFIX_RE = /^sha(?:1|224|256|384|512)=/i;

/**
 * 对消息计算 HMAC 并与待验签名做常量时间比较。
 * 待验签名先 trim 并去除 sha1=/sha256= 等前缀（大小写不敏感）后，再按 signatureEncoding 解码。
 * 密钥格式非法时会抛错，由调用方转为中文提示。
 * @param message - 原始消息
 * @param key - 密钥
 * @param keyEncoding - 密钥编码
 * @param algorithm - HMAC 算法
 * @param signature - 待验签名（可能带前缀/首尾空白）
 * @param signatureEncoding - 签名编码
 * @returns 是否匹配
 */
export async function verifyHmac(
  message: string,
  key: string,
  keyEncoding: KeyEncoding,
  algorithm: HmacAlgorithm,
  signature: string,
  signatureEncoding: KeyEncoding,
): Promise<boolean> {
  const cryptoKey = await importHmacKey(key, keyEncoding, algorithm);
  const data = toArrayBuffer(new TextEncoder().encode(message));
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));

  const normalized = signature.trim().replace(SIGNATURE_PREFIX_RE, '');
  const provided = new Uint8Array(decodeToBytes(normalized, signatureEncoding));

  return timingSafeEqual(expected, provided);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/tests/crypto/hash.test.ts`
Expected: PASS（含 6 个新 `verifyHmac` 用例；大小写由 hexToArrayBuffer 天然容忍）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/crypto/hash.ts src/tests/crypto/hash.test.ts
git commit -m "feat(crypto): add verifyHmac with constant-time comparison"
```

---

## Task 4: HMAC 生成区块（`HashGenerator.vue`）

**Files:**
- Modify: `src/tools/crypto/HashGenerator.vue`（script import + 状态 + 生成逻辑 + UI）

> 本 Task 只做「生成」。验证 UI 在 Task 5。生成区块完成即可独立看到 HMAC 值。

- [ ] **Step 1: 扩展 script import**

在 `src/tools/crypto/HashGenerator.vue` 第 7 行现有 import：

```ts
import { computeHash, computeFileHash, HASH_ALGORITHMS, type HashAlgorithm } from '../../utils/crypto/hash';
```

下方追加一行：

```ts
import { computeHmac, HMAC_ALGORITHMS, type HmacAlgorithm, type KeyEncoding, type HashResult } from '../../utils/crypto/hash';
```

- [ ] **Step 2: 新增 HMAC 生成状态与选项**

在第 19 行（`const isProcessing = ref(false);`）之后、第 21 行（`hasResults` computed）之前插入：

```ts
// ---- HMAC 区块状态 ----

/** HMAC 消息（默认示例，打开即体验） */
const hmacMessage = ref('Hello, DevTools!');
/** HMAC 密钥 */
const hmacKey = ref('secret');
/** 密钥编码 */
const hmacKeyEncoding = ref<KeyEncoding>('text');
/** HMAC 算法（单选，默认 SHA-256） */
const hmacAlgorithm = ref<HmacAlgorithm>('SHA-256');
/** HMAC 输出格式 */
const hmacOutputFormat = ref<'hex' | 'hexUpper' | 'base64'>('hex');
/** 生成的 HMAC 结果（含三态） */
const hmacResult = ref<HashResult | null>(null);
/** HMAC 计算错误 */
const hmacError = ref('');

/** 密钥编码选项（密钥与待验签名共用） */
const KEY_ENCODING_OPTIONS = [
  { value: 'text', label: '文本' },
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
];
/** HMAC 算法选项 */
const HMAC_ALGORITHM_OPTIONS = HMAC_ALGORITHMS.map((a) => ({ value: a, label: a }));
/** HMAC 输出格式选项 */
const HMAC_OUTPUT_OPTIONS = [
  { value: 'hex', label: '小写 Hex' },
  { value: 'hexUpper', label: '大写 HEX' },
  { value: 'base64', label: 'Base64' },
];

/** HMAC 当前显示值（按输出格式取结果对应字段，纯展示切换，不重算） */
const hmacDisplayValue = computed(() =>
  hmacResult.value ? hmacResult.value[hmacOutputFormat.value] : '',
);
```

- [ ] **Step 3: 新增 `computeHmacValue` 与 watch**

在第 135 行（现有 `watch(...)` 块结束的 `);`）之后、第 136 行 `</script>` 之前插入：

```ts
// ---- HMAC 计算 ----

/**
 * 根据当前密钥/消息/算法重算 HMAC。
 * 密钥 hex/base64 非法时设置中文错误并清空结果。
 */
async function computeHmacValue(): Promise<void> {
  if (!hmacMessage.value && !hmacKey.value) {
    hmacResult.value = null;
    hmacError.value = '';
    return;
  }
  try {
    hmacResult.value = await computeHmac(
      hmacMessage.value,
      hmacKey.value,
      hmacKeyEncoding.value,
      hmacAlgorithm.value,
    );
    hmacError.value = '';
  } catch {
    hmacResult.value = null;
    const label = hmacKeyEncoding.value === 'hex' ? 'Hex' : 'Base64';
    hmacError.value = `密钥不是合法的 ${label}，请检查密钥编码`;
  }
}

// 监听生成相关输入，自动重算（输出格式变化不触发重算，仅切换显示）
watch([hmacMessage, hmacKey, hmacKeyEncoding, hmacAlgorithm], () => {
  computeHmacValue();
}, { immediate: true });
```

- [ ] **Step 4: 新增 HMAC 生成 UI**

在第 255 行（结果区域 `<div class="mb-4">...</div>` 的闭合 `</div>`）之后、第 256 行（`<div class="max-w-[720px]">` 的闭合 `</div>`）之前插入：

```html
    <!-- HMAC 区块 -->
    <div class="border-t border-border mt-6 pt-6">
      <h2 class="text-base font-semibold text-text mb-1">HMAC 签名</h2>
      <p class="text-[0.8125rem] text-muted mb-3">带密钥哈希，适用于 API 签名与 Webhook 校验。填入待验签名即可比对验证。</p>

      <!-- 密钥输入 + 密钥编码 -->
      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">密钥</label>
        <div class="flex gap-2 items-start">
          <textarea
            v-model="hmacKey"
            class="flex-1 px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="2"
            placeholder="输入 HMAC 密钥"
          ></textarea>
          <SelectListbox
            v-model="hmacKeyEncoding"
            label="密钥编码"
            :options="KEY_ENCODING_OPTIONS"
          />
        </div>
      </div>

      <!-- 消息输入 -->
      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">消息</label>
        <textarea
          v-model="hmacMessage"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="3"
          placeholder="输入要签名的消息（如请求体）"
        ></textarea>
      </div>

      <!-- 算法 + 输出格式 -->
      <div class="mb-4 flex gap-3">
        <SelectListbox
          v-model="hmacAlgorithm"
          label="算法"
          :options="HMAC_ALGORITHM_OPTIONS"
        />
        <SelectListbox
          v-model="hmacOutputFormat"
          label="输出格式"
          :options="HMAC_OUTPUT_OPTIONS"
        />
      </div>

      <p v-if="hmacError" class="text-error text-[0.8125rem] m-0 mb-3">{{ hmacError }}</p>

      <!-- 生成结果 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">HMAC 值</span>
          <CopyButton v-if="hmacDisplayValue" :text="hmacDisplayValue" />
        </div>
        <div
          v-if="hmacDisplayValue"
          class="border border-border rounded-md bg-card px-4 py-2.5"
        >
          <code class="font-mono text-[0.8125rem] break-all text-text">{{ hmacDisplayValue }}</code>
        </div>
        <div
          v-else
          class="border border-border rounded-md p-4 bg-card text-center text-muted text-sm"
        >
          输入密钥和消息后自动计算 HMAC 值
        </div>
      </div>
    </div>
```

- [ ] **Step 5: build 验证**

Run: `pnpm build`
Expected: 构建成功，无 TypeScript 错误。

- [ ] **Step 6: 手动验证**

Run: `pnpm dev`，打开 `/crypto/hash-generator`：
- 默认密钥 `secret` + 消息 `Hello, DevTools!` + SHA-256 → HMAC 区块立即显示 hex 值
- 切换「输出格式」到 Base64/大写 HEX → 显示值随之变化（不重算）
- 切换「密钥编码」到 Hex 并输入非法字符如 `zz` → 显示「密钥不是合法的 Hex…」
- 切换「算法」到 SHA-1 → 值变化
- 现有哈希区功能不受影响

- [ ] **Step 7: Commit**

```bash
git add src/tools/crypto/HashGenerator.vue
git commit -m "feat(crypto): add HMAC generation block to hash-generator"
```

---

## Task 5: HMAC 验证区块（`HashGenerator.vue`）

**Files:**
- Modify: `src/tools/crypto/HashGenerator.vue`（验证状态 + 逻辑 + UI + 区块清空）

- [ ] **Step 1: 新增验证状态**

在 Task 4 新增的 `hmacError` 状态声明（`const hmacError = ref('');`）之后追加：

```ts
/** 待验签名 */
const verifySignature = ref('');
/** 待验签名编码 */
const verifySignatureEncoding = ref<KeyEncoding>('hex');
/** 验证结果：match / mismatch / null（未填签名） */
const verifyMatch = ref<'match' | 'mismatch' | null>(null);
/** 验证错误（签名解码非法） */
const verifyError = ref('');
```

- [ ] **Step 2: 新增 `verifySignatureValue`、`handleHmacClear` 与 watch**

在 Task 4 新增的 `computeHmacValue` watch 之后（仍在 `</script>` 之前）追加：

```ts
/**
 * 比对待验签名与当前 HMAC 结果。
 * 待验签名为空则清空验证状态；无生成结果时不清空（等待生成完成）。
 * 签名解码非法时设置中文错误。
 */
async function verifySignatureValue(): Promise<void> {
  if (!verifySignature.value.trim()) {
    verifyMatch.value = null;
    verifyError.value = '';
    return;
  }
  if (!hmacResult.value) {
    verifyMatch.value = null;
    verifyError.value = '';
    return;
  }
  try {
    const ok = await verifyHmac(
      hmacMessage.value,
      hmacKey.value,
      hmacKeyEncoding.value,
      hmacAlgorithm.value,
      verifySignature.value,
      verifySignatureEncoding.value,
    );
    verifyMatch.value = ok ? 'match' : 'mismatch';
    verifyError.value = '';
  } catch {
    verifyMatch.value = null;
    verifyError.value = '待验签名格式无法识别，请检查签名编码';
  }
}

/** 清空整个 HMAC 区（保留编码/算法选择，清输入与结果） */
function handleHmacClear(): void {
  hmacMessage.value = '';
  hmacKey.value = '';
  verifySignature.value = '';
  hmacResult.value = null;
  hmacError.value = '';
  verifyMatch.value = null;
  verifyError.value = '';
}

// 监听验证相关输入与生成结果，自动重新比对
watch([hmacResult, verifySignature, verifySignatureEncoding], () => {
  verifySignatureValue();
});
```

- [ ] **Step 3: 新增验证 UI 与区块清空按钮**

在 Task 4 新增的「生成结果」`<div class="mb-4">...</div>`（HMAC 值展示块）之后、HMAC 区块闭合 `</div>`（Task 4 新增的最外层 `<div class="border-t...">` 的闭合）之前插入：

```html
      <!-- 验证签名 -->
      <div class="mb-4">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">验证签名（可选）</label>
        <div class="flex gap-2 items-start mb-2">
          <input
            v-model="verifySignature"
            class="flex-1 px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
            placeholder="粘贴待验证的签名"
          />
          <SelectListbox
            v-model="verifySignatureEncoding"
            label="签名编码"
            :options="KEY_ENCODING_OPTIONS"
          />
        </div>
        <p v-if="verifyError" class="text-error text-[0.8125rem] m-0">{{ verifyError }}</p>
        <p
          v-else-if="verifyMatch === 'match'"
          class="text-success text-[0.8125rem] m-0 font-medium"
        >✓ 签名匹配</p>
        <p
          v-else-if="verifyMatch === 'mismatch'"
          class="text-error text-[0.8125rem] m-0 font-medium"
        >✗ 签名不匹配</p>
      </div>

      <div class="flex justify-end">
        <ClearButton label="清空 HMAC 区" @clear="handleHmacClear" />
      </div>
```

- [ ] **Step 4: build 验证**

Run: `pnpm build`
Expected: 构建成功，无 TypeScript 错误。

- [ ] **Step 5: 手动验证**

Run: `pnpm dev`，打开 `/crypto/hash-generator`，HMAC 区块：
- 复制默认生成的 HMAC 值，粘贴到「验证签名」框 → 显示「✓ 签名匹配」
- 改一个字符 → 显示「✗ 签名不匹配」
- 粘贴 `sha256=` + 原值 → 仍「✓ 签名匹配」
- 大写粘贴 → 仍「✓ 签名匹配」
- 「签名编码」切到 Base64 并输入非法 → 「待验签名格式无法识别…」
- 点击「清空 HMAC 区」→ 密钥/消息/签名/结果全清，算法与编码选择保留
- 改密钥后，原签名自动变为「✗ 不匹配」（因 hmacResult 变化触发重比对）

- [ ] **Step 6: Commit**

```bash
git add src/tools/crypto/HashGenerator.vue
git commit -m "feat(crypto): add HMAC verify block with signature normalization"
```

---

## Task 6: 更新 `tools.ts` 元数据

**Files:**
- Modify: `src/data/tools.ts:71-81`（`hash-generator` 条目）

- [ ] **Step 1: 更新 description / seoDescription / keywords**

将 `src/data/tools.ts` 中 `hash-generator` 条目（第 71–81 行）改为：

```ts
  {
    id: 'hash-generator',
    name: '哈希生成器',
    description: '支持 MD5、SHA-1、SHA-256 等哈希算法与 HMAC 带密钥签名，结果可转换为不同进制',
    seoDescription: '在线哈希生成与 HMAC 工具，支持 MD5、SHA-1/256/384/512 哈希及 HMAC-SHA 带密钥签名生成与验证，适用于 API 签名与 Webhook 校验，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔒',
    path: '/crypto/hash-generator',
    keywords: ['哈希生成器', 'md5 在线', 'sha256 计算', 'sha512 在线', 'hash 在线工具', '文本哈希', 'hmac 在线', 'hmac sha256', 'webhook 签名验证', 'api 签名'],
    relatedToolIds: ['symmetric-crypto', 'jwt-parser', 'base64'],
  },
```

> `seoDescription` 字符数核对：约 76 个中文字符 + 标点，落在 120–160 字节区间内（中文 UTF-8 三字节/字，搜索引擎按字符计约 80 字符内，符合项目既有工具的描述长度风格）。

- [ ] **Step 2: build 验证**

Run: `pnpm build`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add src/data/tools.ts
git commit -m "feat(crypto): update hash-generator metadata with HMAC keywords"
```

---

## Task 7: 新增 3 条 HMAC FAQ

**Files:**
- Modify: `src/data/tool-faqs.ts:95-112`（`hash-generator` FAQ 数组）

- [ ] **Step 1: 追加 FAQ 条目**

在 `src/data/tool-faqs.ts` 的 `hash-generator` 数组中，现有最后一条（「哈希和加密有什么区别？」，第 109–112 行）之后追加 3 条，使该数组变为：

```ts
  'hash-generator': [
    {
      question: '哈希值可以反解出原文吗？',
      answer: '<strong>不可以</strong>。哈希是单向函数，从哈希值无法还原出原始数据。验证方式是对比哈希值：对相同输入使用相同算法，如果哈希值一致则说明数据相同。',
    },
    {
      question: 'MD5 还安全吗？',
      answer: 'MD5 已被证明存在<strong>碰撞漏洞</strong>（不同的输入可以产生相同的哈希值），不适合用于安全场景（如密码存储、数字签名）。建议使用 SHA-256 或更强的算法。MD5 目前主要用于文件校验等非安全场景。',
    },
    {
      question: 'SHA-256 和 SHA-512 有什么区别？',
      answer: 'SHA-256 产生 <strong>256 位</strong>（32 字节）哈希值，SHA-512 产生 <strong>512 位</strong>（64 字节）哈希值。SHA-512 安全性更高但运算量更大。对于大多数应用，SHA-256 已经足够安全。',
    },
    {
      question: '哈希和加密有什么区别？',
      answer: '哈希是<strong>单向</strong>的，无法从结果还原原文，常用于数据完整性校验。加密是<strong>双向</strong>的，使用密钥可以还原原文，常用于数据保密传输。',
    },
    {
      question: 'HMAC 和普通哈希有什么区别？',
      answer: '普通哈希（如 SHA-256）<strong>不需要密钥</strong>，任何人都能对相同输入算出相同结果，仅用于完整性校验。HMAC 是<strong>带密钥</strong>的哈希，只有持有密钥的一方才能生成或验证签名，常用于 API 签名（如 AWS SigV4）和 Webhook 校验（如 GitHub / Stripe），既能校验完整性又能确认来源。',
    },
    {
      question: '为什么我的 Webhook 签名验证不通过？',
      answer: '常见三大坑：①<strong>密钥编码选错</strong>——若密钥本身是 Hex 或 Base64 字节串，需在「密钥编码」处选对应编码，不能当文本输入；②<strong>消息不是原文</strong>——Webhook 签名是对原始请求体字节算的，复制粘贴时若被格式化、加空格或转码就会对不上，建议从抓包工具取原始 body；③<strong>签名带了前缀</strong>——如 GitHub 的 <code>sha256=</code>，本工具会自动剥离 <code>sha***=</code> 前缀与首尾空白、容忍大小写，无需手动处理。',
    },
    {
      question: '为什么不支持 HMAC-MD5？',
      answer: 'MD5 本身已不安全，HMAC-MD5 在实际工程中几乎不再使用，主流 Webhook 与 API 签名均采用 HMAC-SHA256 及以上。本工具仅支持 HMAC-SHA-1 / SHA-256 / SHA-384 / SHA-512，与 Web Crypto 原生能力一致。',
    },
  ],
```

- [ ] **Step 2: build 验证**

Run: `pnpm build`
Expected: 构建成功，FAQ 渲染为 `<details>` 与结构化数据无报错。

- [ ] **Step 3: Commit**

```bash
git add src/data/tool-faqs.ts
git commit -m "docs(crypto): add HMAC FAQ entries to hash-generator"
```

---

## Task 8: 最终验证与 ROADMAP 勾选

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS（原有用例 + Task 1–3 新增的 decodeToBytes / computeHmac / verifyHmac 用例）。

- [ ] **Step 2: 生产构建**

Run: `pnpm build`
Expected: 构建成功，无类型错误、无未使用变量告警。

- [ ] **Step 3: 端到端手动核对（对照 spec 验收清单）**

Run: `pnpm dev`，`/crypto/hash-generator` 逐项核对：
- HMAC 区块在哈希区下方独立呈现，分隔线清晰，两区块互不干扰
- 默认 `secret` + `Hello, DevTools!` + SHA-256 打开即显示 HMAC hex
- 密钥/签名编码 text/hex/base64 切换结果正确
- 待验签名填入实时显示 ✓/✗；`sha256=` 前缀与大小写均容忍
- 密钥/签名格式非法时中文内联提示
- 现有哈希区（文本/文件、多选算法、输出格式）功能零回归
- FAQ 区块出现 3 条新 HMAC 问答

- [ ] **Step 4: 勾选 ROADMAP 进度**

在 `docs/ROADMAP.md` 将第 160 行：

```
- [ ] 哈希生成器：增加 HMAC 模式
```

改为：

```
- [x] 哈希生成器：增加 HMAC 模式 — 已完成（2026-06-15）。生成 + 验证双能力，密钥/签名支持 text/hex/base64 三编码，验证用常量时间比较
```

> ROADMAP 在 `.gitignore` 忽略范围内（本地维护），无需 commit。

- [ ] **Step 5: 最终状态确认**

Run: `git log --oneline -8`
Expected: 看到 Task 1–7 的 7 个 commit，工作区 clean（ROADMAP 改动因 gitignore 不显示为未跟踪）。

---

## Self-Review 记录

- **Spec 覆盖**：spec 第三章算法层 → Task 1/2/3；第四章组件层 → Task 4/5；第五章收尾（tools.ts/FAQ/测试/安全）→ Task 6/7/8。全部覆盖。
- **Placeholder**：无 TBD/TODO，每个代码步骤含完整可执行代码。
- **类型一致性**：`KeyEncoding` / `HmacAlgorithm` / `HashResult` 在 Task 1–5 中名称与签名一致；`importHmacKey` 在 Task 2 定义、Task 3 复用；`decodeToBytes` Task 1 定义、Task 2/3 复用。
- **依赖顺序**：Task 1（decodeToBytes）→ Task 2（computeHmac 用 decodeToBytes）→ Task 3（verifyHmac 用 decodeToBytes + importHmacKey）→ Task 4/5（UI 用 computeHmac/verifyHmac）→ Task 6/7（元数据）→ Task 8（验收）。无前置依赖缺失。
