# 首批工具功能补齐 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 8 个开发者工具页面（哈希、随机字符串、Base64、日期时间、URL 编解码、JWT、设备信息、对称加解密），每个工具包含完整交互逻辑。

**Architecture:** 每个工具将核心逻辑提取到 `src/utils/` 下的工具函数中（便于单元测试），Vue 3 SFC 组件（`src/tools/`）作为 UI 层调用这些函数，Astro 页面（`src/pages/`）通过 `ToolLayout` 挂载组件。所有工具复用已有的共享组件：`ToolHeader`、`CopyButton`、`ClearButton`。

**Tech Stack:** Vue 3 + TypeScript, Vitest, js-md5, dayjs, jwt-decode, bowser, Web Crypto API

---

## 文件结构

```
# 新增文件
src/utils/hash.ts                    # 哈希计算（Web Crypto API + js-md5）
src/utils/random-string.ts           # 随机字符串生成
src/utils/base64.ts                  # Base64 编解码
src/utils/datetime.ts                # 日期时间转换
src/utils/url-codec.ts               # URL 编解码
src/utils/jwt.ts                     # JWT 解析
src/utils/crypto.ts                  # 对称加解密（Web Crypto API）
src/tools/HashGenerator.vue          # 哈希生成器组件
src/tools/RandomStringGenerator.vue  # 随机字符串组件
src/tools/Base64Codec.vue            # Base64 编解码组件
src/tools/DateTimeConverter.vue      # 日期时间转换器组件
src/tools/UrlEncodeCodec.vue         # URL 编解码组件
src/tools/JwtParser.vue              # JWT 解析器组件
src/tools/DeviceInfo.vue             # 设备信息组件
src/tools/SymmetricCrypto.vue        # 对称加解密组件
tests/utils/hash.test.ts             # 哈希测试
tests/utils/random-string.test.ts    # 随机字符串测试
tests/utils/base64.test.ts           # Base64 测试
tests/utils/datetime.test.ts         # 日期时间测试
tests/utils/url-codec.test.ts        # URL 编解码测试
tests/utils/jwt.test.ts              # JWT 测试
tests/utils/crypto.test.ts           # 对称加解密测试
vitest.config.ts                     # Vitest 配置

# 修改文件
src/pages/hash-generator.astro       # 替换占位内容为组件
src/pages/random-string.astro        # 替换占位内容为组件
src/pages/base64.astro               # 替换占位内容为组件
src/pages/datetime-converter.astro   # 替换占位内容为组件
src/pages/url-encode.astro           # 替换占位内容为组件
src/pages/jwt-parser.astro           # 替换占位内容为组件
src/pages/device-info.astro          # 替换占位内容为组件
src/pages/symmetric-crypto.astro     # 替换占位内容为组件
package.json                         # 添加依赖和 test 脚本
```

## 共享组件 API 参考

实现所有 Vue 组件时，复用以下共享组件：

**ToolHeader** — 标题 + 描述 + 填入示例按钮
```vue
<ToolHeader
  title="工具名称"
  description="一句话描述"
  @example="handleExample"
/>
// showExample={false} 可隐藏示例按钮（如 DeviceInfo）
```

**CopyButton** — 复制到剪贴板
```vue
<CopyButton :text="要复制的文本" label="复制全部" />
// label 可选，默认 "复制"
```

**ClearButton** — 清空按钮
```vue
<ClearButton @clear="handleClear" />
// label 可选，默认 "清空"
```

**CSS 类名模式**（来自 UuidGenerator）：
- `field-label` — 表单标签
- `field-input` / `field-select` — 输入框/下拉框
- `btn-primary` — 主按钮（橙色背景）
- `output-header` / `output-label` / `output-actions` — 输出区头部
- `results-area` — 结果容器（边框 + 圆角 + 背景）
- `results-placeholder` — 空状态提示

---

## Task 0: 项目基础设施搭建

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 安装依赖**

```bash
pnpm add js-md5 dayjs jwt-decode bowser
pnpm add -D vitest @vitejs/plugin-vue
```

- [ ] **Step 2: 添加 test 脚本到 package.json**

在 `package.json` 的 `scripts` 中添加：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 创建 Vitest 配置**

创建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
  },
});
```

注意：使用 `@vitejs/plugin-vue`（非 Astro 的 Vue 插件）以便 Vitest 能独立解析 Vue SFC。Node.js >= 22 内置 `crypto.subtle`、`btoa`、`atob`、`TextEncoder`、`TextDecoder`，不需要额外 polyfill。

- [ ] **Step 4: 验证 Vitest 可运行**

```bash
pnpm test
```

Expected: Vitest 启动后报告 "No test files found" 或类似信息（无报错即可）。

- [ ] **Step 5: 提交**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add dependencies, vitest and @vitejs/plugin-vue for tool implementations"
```

---

## Task 1: 哈希生成器

**Files:**
- Create: `src/utils/hash.ts`
- Create: `tests/utils/hash.test.ts`
- Create: `src/tools/HashGenerator.vue`
- Modify: `src/pages/hash-generator.astro`

- [ ] **Step 1: 写哈希工具函数的测试**

创建 `tests/utils/hash.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { computeHash, computeFileHash, HASH_ALGORITHMS, arrayBufferToHex, arrayBufferToBase64 } from '../../src/utils/hash';

describe('computeHash', () => {
  it('应正确计算 MD5 哈希', async () => {
    const result = await computeHash('hello', 'MD5');
    expect(result.hex).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('应正确计算 SHA-1 哈希', async () => {
    const result = await computeHash('hello', 'SHA-1');
    expect(result.hex).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('应正确计算 SHA-256 哈希', async () => {
    const result = await computeHash('hello', 'SHA-256');
    expect(result.hex).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('应正确计算 SHA-384 哈希', async () => {
    const result = await computeHash('hello', 'SHA-384');
    expect(result.hex).toBe(
      '59e174877744a7ff3e6957c040083ad90fe01af18c7a8b53f24e683de7ceab3e0d9d1bac3f46f6c1d0e44e0c5e20b9d6',
    );
  });

  it('应正确计算 SHA-512 哈希', async () => {
    const result = await computeHash('hello', 'SHA-512');
    expect(result.hex).toBe(
      '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043',
    );
  });

  it('应支持大写 hex 输出', async () => {
    const result = await computeHash('hello', 'MD5');
    expect(result.hexUpper).toBe('5D41402ABC4B2A76B9719D911017C592');
  });

  it('应支持 Base64 输出', async () => {
    const result = await computeHash('hello', 'MD5');
    expect(result.base64).toBe('XUFAKrxLKQ9D9cj7bPQ5/Q==');
  });

  it('空字符串也应计算哈希', async () => {
    const result = await computeHash('', 'SHA-256');
    expect(result.hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('应支持中文输入', async () => {
    const result = await computeHash('你好', 'SHA-256');
    expect(result.hex).toBe(
      '670d9743542cae3ea7ebe36af56bd53648b1b1dc8964a71c8694bf3e6e7a6013',
    );
  });
});

describe('computeFileHash', () => {
  it('应正确计算 ArrayBuffer 的哈希', async () => {
    const data = new TextEncoder().encode('hello');
    const result = await computeFileHash(data.buffer as ArrayBuffer, 'SHA-256');
    expect(result.hex).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});

describe('HASH_ALGORITHMS', () => {
  it('应包含 5 种算法', () => {
    expect(HASH_ALGORITHMS).toEqual(['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/hash.test.ts
```

Expected: FAIL — 模块 `../../src/utils/hash` 不存在。

- [ ] **Step 3: 实现哈希工具函数**

创建 `src/utils/hash.ts`：

```typescript
import md5 from 'js-md5';

/** 支持的哈希算法 */
export const HASH_ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

/** 哈希算法类型 */
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** 哈希计算结果 */
export interface HashResult {
  /** 小写十六进制 */
  hex: string;
  /** 大写十六进制 */
  hexUpper: string;
  /** Base64 编码 */
  base64: string;
}

/** 将 ArrayBuffer 转为小写十六进制字符串 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 将 ArrayBuffer 转为 Base64 字符串 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/** 对文本计算哈希 */
export async function computeHash(text: string, algorithm: HashAlgorithm): Promise<HashResult> {
  const data = new TextEncoder().encode(text);
  return computeFileHash(data.buffer as ArrayBuffer, algorithm);
}

/** 对 ArrayBuffer 数据计算哈希 */
export async function computeFileHash(
  data: ArrayBuffer,
  algorithm: HashAlgorithm,
): Promise<HashResult> {
  let raw: ArrayBuffer;

  if (algorithm === 'MD5') {
    const hash = md5(data);
    raw = hexToArrayBuffer(hash);
  } else {
    raw = await crypto.subtle.digest(algorithm, data);
  }

  const hex = arrayBufferToHex(raw);
  return {
    hex,
    hexUpper: hex.toUpperCase(),
    base64: arrayBufferToBase64(raw),
  };
}

/** 将十六进制字符串转为 ArrayBuffer */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/hash.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: 创建哈希生成器 Vue 组件**

创建 `src/tools/HashGenerator.vue`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { computeHash, computeFileHash, HASH_ALGORITHMS, type HashAlgorithm } from '../utils/hash';

const inputText = ref('');
const selectedAlgorithms = ref<HashAlgorithm[]>(['MD5', 'SHA-256']);
const outputFormat = ref<'hex' | 'hexUpper' | 'base64'>('hex');
const results = ref<Record<string, string>>({});
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const isProcessing = ref(false);

/** 切换算法选中状态 */
function toggleAlgorithm(algo: HashAlgorithm) {
  const idx = selectedAlgorithms.value.indexOf(algo);
  if (idx >= 0) {
    selectedAlgorithms.value.splice(idx, 1);
  } else {
    selectedAlgorithms.value.push(algo);
  }
}

/** 执行哈希计算 */
async function compute() {
  errorMsg.value = '';
  if (!inputText.value && !fileName.value) {
    errorMsg.value = '请输入文本或上传文件';
    return;
  }
  if (selectedAlgorithms.value.length === 0) {
    errorMsg.value = '请至少选择一种哈希算法';
    return;
  }

  isProcessing.value = true;
  try {
    const newResults: Record<string, string> = {};
    for (const algo of selectedAlgorithms.value) {
      if (fileName.value && fileInputRef.value?.files?.[0]) {
        const buffer = await fileInputRef.value.files[0].arrayBuffer();
        const result = await computeFileHash(buffer, algo);
        newResults[algo] = result[outputFormat.value];
      } else {
        const result = await computeHash(inputText.value, algo);
        newResults[algo] = result[outputFormat.value];
      }
    }
    results.value = newResults;
  } catch {
    errorMsg.value = '计算哈希时出错，请检查输入';
  } finally {
    isProcessing.value = false;
  }
}

/** 处理文件选择 */
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    fileName.value = file.name;
    inputText.value = '';
  }
}

/** 清空文件输入 */
function clearFile() {
  fileName.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function handleExample() {
  inputText.value = 'Hello, DevTools!';
  fileName.value = '';
  clearFile();
  selectedAlgorithms.value = ['MD5', 'SHA-256'];
  outputFormat.value = 'hex';
  compute();
}

function handleClear() {
  inputText.value = '';
  results.value = {};
  errorMsg.value = '';
  clearFile();
}

const allResultsText = computed(() =>
  Object.entries(results.value)
    .map(([algo, hash]) => `${algo}: ${hash}`)
    .join('\n'),
);
</script>

<template>
  <div class="hash-tool">
    <ToolHeader
      title="哈希生成器"
      description="支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制"
      @example="handleExample"
    />

    <div class="hash-input-section">
      <div class="input-group">
        <label class="field-label">输入文本</label>
        <textarea
          v-model="inputText"
          class="field-textarea"
          rows="4"
          placeholder="输入要计算哈希的文本"
          @input="clearFile()"
        ></textarea>
      </div>
      <div class="file-upload-group">
        <label class="field-label">或上传文件</label>
        <div class="file-upload-row">
          <input
            ref="fileInputRef"
            type="file"
            class="file-input"
            @change="handleFileChange"
          />
          <span v-if="fileName" class="file-name">{{ fileName }}</span>
        </div>
      </div>
    </div>

    <div class="hash-controls">
      <div class="algorithm-group">
        <label class="field-label">哈希算法</label>
        <div class="checkbox-row">
          <label v-for="algo in HASH_ALGORITHMS" :key="algo" class="checkbox-label">
            <input
              type="checkbox"
              :checked="selectedAlgorithms.includes(algo)"
              @change="toggleAlgorithm(algo)"
            />
            {{ algo }}
          </label>
        </div>
      </div>
      <div class="format-group">
        <label class="field-label">输出格式</label>
        <select v-model="outputFormat" class="field-select">
          <option value="hex">小写 Hex</option>
          <option value="hexUpper">大写 HEX</option>
          <option value="base64">Base64</option>
        </select>
      </div>
    </div>

    <div class="hash-actions">
      <button class="btn-primary" :disabled="isProcessing" @click="compute">
        {{ isProcessing ? '计算中...' : '计算哈希' }}
      </button>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="Object.keys(results).length" class="hash-output">
      <div class="output-header">
        <span class="output-label">计算结果</span>
        <div class="output-actions">
          <CopyButton :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="results-area">
        <div v-for="(hash, algo) in results" :key="algo" class="result-row">
          <span class="result-algo">{{ algo }}</span>
          <code class="result-value">{{ hash }}</code>
          <CopyButton :text="hash" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hash-tool {
  max-width: 720px;
}

.hash-input-section {
  margin-bottom: var(--space-md);
}

.input-group {
  margin-bottom: var(--space-sm);
}

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.file-upload-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.file-upload-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.file-input {
  font-size: 0.8125rem;
}

.file-name {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.hash-controls {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.algorithm-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.checkbox-row {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8125rem;
  cursor: pointer;
}

.format-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.hash-actions {
  margin-bottom: var(--space-md);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.output-actions {
  display: flex;
  gap: var(--space-sm);
}

.results-area {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.result-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-algo {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  min-width: 60px;
}

.result-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}
</style>
```

- [ ] **Step 6: 更新哈希生成器 Astro 页面**

修改 `src/pages/hash-generator.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import HashGenerator from '../tools/HashGenerator.vue';
---

<ToolLayout title="哈希生成器 - DevTools" toolId="hash-generator">
  <HashGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证**

```bash
pnpm test -- tests/utils/hash.test.ts
```

Expected: 所有测试通过。

```bash
pnpm dev
```

打开浏览器访问 `/hash-generator`，验证：
- 点击"填入示例"能自动计算 MD5 和 SHA-256
- 手动输入文本，选择不同算法和格式能正常计算
- 复制和清空功能正常

- [ ] **Step 8: 提交**

```bash
git add src/utils/hash.ts tests/utils/hash.test.ts src/tools/HashGenerator.vue src/pages/hash-generator.astro
git commit -m "feat: implement hash generator tool (MD5, SHA-1/256/384/512)"
```

---

## Task 2: 随机字符串生成

**Files:**
- Create: `src/utils/random-string.ts`
- Create: `tests/utils/random-string.test.ts`
- Create: `src/tools/RandomStringGenerator.vue`
- Modify: `src/pages/random-string.astro`

- [ ] **Step 1: 写随机字符串工具函数的测试**

创建 `tests/utils/random-string.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { generateRandomString, PRESET_CHARSETS, type CharsetPreset } from '../../src/utils/random-string';

describe('generateRandomString', () => {
  it('应生成指定长度的字符串', () => {
    const result = generateRandomString(16, 'alphanumeric');
    expect(result.length).toBe(16);
  });

  it('应只包含所选字符集中的字符', () => {
    const result = generateRandomString(100, 'digits');
    for (const ch of result) {
      expect(ch).toMatch(/[0-9]/);
    }
  });

  it('alphanumeric 字符集应包含大小写字母和数字', () => {
    const result = generateRandomString(1000, 'alphanumeric');
    expect(result).toMatch(/[a-z]/);
    expect(result).toMatch(/[A-Z]/);
    expect(result).toMatch(/[0-9]/);
  });

  it('应支持自定义字符集', () => {
    const result = generateRandomString(50, 'custom:abc');
    for (const ch of result) {
      expect('abc').toContain(ch);
    }
  });

  it('长度为 0 应返回空字符串', () => {
    const result = generateRandomString(0, 'alphanumeric');
    expect(result).toBe('');
  });

  it('应生成不同的字符串（随机性检查）', () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(generateRandomString(32, 'alphanumeric'));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('PRESET_CHARSETS', () => {
  it('应包含 alphanumeric 预设', () => {
    expect(PRESET_CHARSETS.alphanumeric).toBeDefined();
  });

  it('应包含 digits 预设', () => {
    expect(PRESET_CHARSETS.digits).toBeDefined();
    for (const ch of PRESET_CHARSETS.digits) {
      expect(ch).toMatch(/[0-9]/);
    }
  });

  it('应包含 special 预设', () => {
    expect(PRESET_CHARSETS.special).toBeDefined();
    expect(PRESET_CHARSETS.special.length).toBeGreaterThan(
      PRESET_CHARSETS.alphanumeric.length,
    );
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/random-string.test.ts
```

Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现随机字符串工具函数**

创建 `src/utils/random-string.ts`：

```typescript
/** 字符集预设名称 */
export type CharsetPreset = 'alphanumeric' | 'digits' | 'special' | `custom:${string}`;

/** 预设字符集 */
export const PRESET_CHARSETS: Record<string, string> = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  digits: '0123456789',
  special: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/',
};

/** 解析字符集预设为实际字符 */
function resolveCharset(preset: CharsetPreset): string {
  if (preset.startsWith('custom:')) {
    return preset.slice(7);
  }
  return PRESET_CHARSETS[preset] ?? PRESET_CHARSETS.alphanumeric;
}

/** 生成密码学安全的随机字符串 */
export function generateRandomString(length: number, charset: CharsetPreset): string {
  if (length <= 0) return '';

  const chars = resolveCharset(charset);
  if (!chars.length) return '';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/random-string.test.ts
```

Expected: 所有测试 PASS。

- [ ] **Step 5: 创建随机字符串生成器 Vue 组件**

创建 `src/tools/RandomStringGenerator.vue`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import { generateRandomString, PRESET_CHARSETS, type CharsetPreset } from '../utils/random-string';

const length = ref(32);
const charsetPreset = ref<string>('alphanumeric');
const customChars = ref('');
const amount = ref(1);
const results = ref<string[]>([]);
const errorMsg = ref('');
const copiedRow = ref(-1);

const presets = [
  { value: 'alphanumeric', label: '字母 + 数字' },
  { value: 'digits', label: '仅数字' },
  { value: 'special', label: '字母 + 数字 + 特殊字符' },
  { value: 'custom', label: '自定义' },
];

/** 获取实际的字符集参数 */
function getCharset(): CharsetPreset {
  if (charsetPreset.value === 'custom') {
    return `custom:${customChars.value}`;
  }
  return charsetPreset.value as CharsetPreset;
}

function generate() {
  errorMsg.value = '';
  if (charsetPreset.value === 'custom' && !customChars.value.trim()) {
    errorMsg.value = '请输入自定义字符集';
    return;
  }
  if (length.value < 1 || length.value > 10000) {
    errorMsg.value = '长度应在 1-10000 之间';
    return;
  }
  const count = Math.min(Math.max(amount.value || 1, 1), 100);
  const charset = getCharset();
  results.value = Array.from({ length: count }, () => generateRandomString(length.value, charset));
}

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => { copiedRow.value = -1; }, 1000);
  }
}

function handleExample() {
  length.value = 32;
  charsetPreset.value = 'alphanumeric';
  amount.value = 5;
  generate();
}

function handleClear() {
  results.value = [];
  errorMsg.value = '';
}

const allResultsText = computed(() => results.value.join('\n'));
</script>

<template>
  <div class="random-tool">
    <ToolHeader
      title="随机字符串生成"
      description="自定义长度和字符集的随机字符串生成器"
      @example="handleExample"
    />

    <div class="random-controls">
      <div class="control-group">
        <label class="field-label">长度</label>
        <input v-model.number="length" type="number" :min="1" :max="10000" class="field-input" style="width:100px" />
      </div>
      <div class="control-group">
        <label class="field-label">字符集</label>
        <select v-model="charsetPreset" class="field-select">
          <option v-for="p in presets" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div v-if="charsetPreset === 'custom'" class="control-group">
        <label class="field-label">自定义字符</label>
        <input v-model="customChars" class="field-input" placeholder="输入允许的字符" />
      </div>
      <div class="control-group">
        <label class="field-label">数量</label>
        <input v-model.number="amount" type="number" :min="1" :max="100" class="field-input" style="width:80px" />
      </div>
    </div>

    <div class="random-actions">
      <button class="btn-primary" @click="generate">生成</button>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="results.length" class="random-output">
      <div class="output-header">
        <span class="output-label">生成结果</span>
        <div class="output-actions">
          <CopyButton :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="results-area">
        <div v-for="(str, index) in results" :key="index" class="result-row">
          <code class="result-value">{{ str }}</code>
          <button class="result-copy" @click="copyRow(index)">
            {{ copiedRow === index ? '✓' : '复制' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.random-tool { max-width: 720px; }

.random-controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.random-actions { margin-bottom: var(--space-md); }

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label { font-size: 0.875rem; font-weight: 500; }

.output-actions { display: flex; gap: var(--space-sm); }

.results-area {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-height: 120px;
  background-color: var(--color-card);
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.result-row + .result-row { border-top: 1px solid var(--color-border); }

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}

.result-copy {
  flex-shrink: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
}

.result-copy:hover { color: var(--color-accent); }
</style>
```

- [ ] **Step 6: 更新随机字符串 Astro 页面**

修改 `src/pages/random-string.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import RandomStringGenerator from '../tools/RandomStringGenerator.vue';
---

<ToolLayout title="随机字符串生成 - DevTools" toolId="random-string">
  <RandomStringGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证**

```bash
pnpm test -- tests/utils/random-string.test.ts
pnpm dev
```

验证 `/random-string` 页面功能正常。

- [ ] **Step 8: 提交**

```bash
git add src/utils/random-string.ts tests/utils/random-string.test.ts src/tools/RandomStringGenerator.vue src/pages/random-string.astro
git commit -m "feat: implement random string generator tool"
```

---

## Task 3: Base64 编解码

**Files:**
- Create: `src/utils/base64.ts`
- Create: `tests/utils/base64.test.ts`
- Create: `src/tools/Base64Codec.vue`
- Modify: `src/pages/base64.astro`

- [ ] **Step 1: 写 Base64 工具函数的测试**

创建 `tests/utils/base64.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { encodeBase64, decodeBase64 } from '../../src/utils/base64';

describe('encodeBase64', () => {
  it('应正确编码 ASCII 文本', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=');
  });

  it('应正确编码 Unicode 文本', () => {
    expect(encodeBase64('你好')).toBe('5L2g5aW9');
  });

  it('应正确编码空字符串', () => {
    expect(encodeBase64('')).toBe('');
  });

  it('应正确编码包含各种特殊字符的文本', () => {
    const input = 'Hello, 世界! 🌍';
    const encoded = encodeBase64(input);
    expect(decodeBase64(encoded)).toBe(input);
  });
});

describe('decodeBase64', () => {
  it('应正确解码 ASCII Base64', () => {
    expect(decodeBase64('aGVsbG8=')).toBe('hello');
  });

  it('应正确解码 Unicode Base64', () => {
    expect(decodeBase64('5L2g5aW9')).toBe('你好');
  });

  it('应正确解码 Data URL 前缀的 Base64', () => {
    const dataUrl = 'data:text/plain;base64,aGVsbG8=';
    expect(decodeBase64(dataUrl)).toBe('hello');
  });

  it('应抛出错误当输入非法 Base64', () => {
    expect(() => decodeBase64('!!!invalid!!!')).toThrow();
  });

  it('应正确处理往返编码', () => {
    const original = '测试 Test 123 !@#';
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/base64.test.ts
```

- [ ] **Step 3: 实现 Base64 工具函数**

创建 `src/utils/base64.ts`：

```typescript
/** 将文本编码为 Base64（支持 Unicode） */
export function encodeBase64(text: string): string {
  if (!text) return '';
  return btoa(unescape(encodeURIComponent(text)));
}

/** 从 Base64 字符串中提取纯 Base64 数据（去除 Data URL 前缀） */
function stripDataUrl(base64: string): string {
  const match = base64.match(/^data:[^;]+;base64,(.+)$/s);
  return match ? match[1] : base64;
}

/** 将 Base64 解码为文本（支持 Unicode） */
export function decodeBase64(base64: string): string {
  if (!base64.trim()) return '';
  const pure = stripDataUrl(base64.trim());
  try {
    return decodeURIComponent(escape(atob(pure)));
  } catch {
    throw new Error('无效的 Base64 输入，请检查格式是否正确');
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/base64.test.ts
```

- [ ] **Step 5: 创建 Base64 编解码 Vue 组件**

创建 `src/tools/Base64Codec.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { encodeBase64, decodeBase64 } from '../utils/base64';

type Mode = 'encode' | 'decode';

const mode = ref<Mode>('encode');
const input = ref('');
const output = ref('');
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');

function execute() {
  errorMsg.value = '';
  output.value = '';

  if (!input.value.trim() && !fileName.value) {
    errorMsg.value = mode.value === 'encode' ? '请输入要编码的文本' : '请输入要解码的 Base64 字符串';
    return;
  }

  try {
    if (mode.value === 'encode') {
      output.value = encodeBase64(input.value);
    } else {
      output.value = decodeBase64(input.value);
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '处理时出错';
  }
}

/** 处理文件编码 */
async function handleFile() {
  const file = fileInputRef.value?.files?.[0];
  if (!file) return;

  errorMsg.value = '';
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    output.value = reader.result as string;
  };
  reader.onerror = () => {
    errorMsg.value = '读取文件时出错';
  };
  reader.readAsDataURL(file);
}

function switchMode(newMode: Mode) {
  mode.value = newMode;
  input.value = output.value;
  output.value = '';
  errorMsg.value = '';
  fileName.value = '';
}

function handleExample() {
  mode.value = 'encode';
  input.value = 'Hello, DevTools! 你好，开发者工具！';
  fileName.value = '';
  execute();
}

function handleClear() {
  input.value = '';
  output.value = '';
  errorMsg.value = '';
  fileName.value = '';
}
</script>

<template>
  <div class="base64-tool">
    <ToolHeader
      title="Base64 编解码"
      description="Base64 编码与解码，支持文本和文件"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: mode === 'encode' }]" @click="switchMode('encode')">编码</button>
      <button :class="['tab-btn', { active: mode === 'decode' }]" @click="switchMode('decode')">解码</button>
    </div>

    <div class="io-section">
      <div class="io-block">
        <label class="field-label">{{ mode === 'encode' ? '输入文本' : '输入 Base64' }}</label>
        <textarea v-model="input" class="field-textarea" rows="6" :placeholder="mode === 'encode' ? '输入要编码的文本' : '输入要解码的 Base64 字符串'"></textarea>
      </div>

      <div v-if="mode === 'encode'" class="file-section">
        <label class="field-label">或上传文件编码为 Data URL</label>
        <div class="file-row">
          <input ref="fileInputRef" type="file" class="file-input" @change="handleFile" />
          <span v-if="fileName" class="file-name">{{ fileName }}</span>
        </div>
      </div>

      <div class="io-block">
        <label class="field-label">输出结果</label>
        <textarea v-model="output" class="field-textarea output-textarea" rows="6" readonly></textarea>
      </div>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div class="action-bar">
      <button class="btn-primary" @click="execute">{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <CopyButton v-if="output" :text="output" label="复制结果" />
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>

<style scoped>
.base64-tool { max-width: 720px; }

.mode-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn.active {
  background-color: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.io-section { margin-bottom: var(--space-md); }

.io-block { margin-bottom: var(--space-sm); }

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.output-textarea {
  background-color: var(--color-hover);
}

.file-section { margin-bottom: var(--space-sm); }

.file-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.file-input { font-size: 0.8125rem; }

.file-name {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}
</style>
```

- [ ] **Step 6: 更新 Base64 Astro 页面**

修改 `src/pages/base64.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import Base64Codec from '../tools/Base64Codec.vue';
---

<ToolLayout title="Base64 编解码 - DevTools" toolId="base64">
  <Base64Codec client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证并提交**

```bash
pnpm test -- tests/utils/base64.test.ts
pnpm dev
```

验证 `/base64` 页面的编码/解码、文件上传功能。

```bash
git add src/utils/base64.ts tests/utils/base64.test.ts src/tools/Base64Codec.vue src/pages/base64.astro
git commit -m "feat: implement Base64 encode/decode tool"
```

---

## Task 4: 日期时间转换器

**Files:**
- Create: `src/utils/datetime.ts`
- Create: `tests/utils/datetime.test.ts`
- Create: `src/tools/DateTimeConverter.vue`
- Modify: `src/pages/datetime-converter.astro`

- [ ] **Step 1: 写日期时间工具函数的测试**

创建 `tests/utils/datetime.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  type DateInfo,
} from '../../src/utils/datetime';

describe('detectTimestampUnit', () => {
  it('应将 13 位数字识别为毫秒', () => {
    expect(detectTimestampUnit('1700000000000')).toBe('ms');
  });

  it('应将 10 位数字识别为秒', () => {
    expect(detectTimestampUnit('1700000000')).toBe('s');
  });

  it('应将空字符串返回 null', () => {
    expect(detectTimestampUnit('')).toBeNull();
  });

  it('应将非数字返回 null', () => {
    expect(detectTimestampUnit('abc')).toBeNull();
  });
});

describe('timestampToDateInfo', () => {
  it('应正确解析毫秒时间戳', () => {
    const info = timestampToDateInfo(1700000000000);
    expect(info.iso).toContain('2023');
    expect(info.unixSeconds).toBe(1700000000);
    expect(info.unixMillis).toBe(1700000000000);
  });

  it('应正确解析秒时间戳', () => {
    const info = timestampToDateInfo(1700000000);
    expect(info.iso).toContain('2023');
    expect(info.unixSeconds).toBe(1700000000);
  });

  it('应包含所有必要字段', () => {
    const info = timestampToDateInfo(Date.now());
    expect(info).toHaveProperty('iso');
    expect(info).toHaveProperty('local');
    expect(info).toHaveProperty('utc');
    expect(info).toHaveProperty('relative');
    expect(info).toHaveProperty('unixSeconds');
    expect(info).toHaveProperty('unixMillis');
  });
});

describe('parseDateInput', () => {
  it('应解析 ISO 日期字符串', () => {
    const info = parseDateInput('2023-11-14T12:00:00.000Z');
    expect(info).not.toBeNull();
    expect(info!.unixSeconds).toBeGreaterThan(0);
  });

  it('应返回 null 对于无效输入', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('invalid')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/datetime.test.ts
```

- [ ] **Step 3: 实现日期时间工具函数**

创建 `src/utils/datetime.ts`：

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/zh-cn';

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale('zh-cn');

/** 时间戳单位检测结果 */
export type TimestampUnit = 's' | 'ms' | null;

/** 日期信息（多格式展示） */
export interface DateInfo {
  /** ISO 8601 格式 */
  iso: string;
  /** 本地日期时间 */
  local: string;
  /** UTC 时间 */
  utc: string;
  /** 相对时间 */
  relative: string;
  /** Unix 秒级时间戳 */
  unixSeconds: number;
  /** Unix 毫秒级时间戳 */
  unixMillis: number;
}

/** 检测时间戳是秒级还是毫秒级 */
export function detectTimestampUnit(input: string): TimestampUnit {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (trimmed.length >= 13 || num > 9999999999) return 'ms';
  if (trimmed.length >= 10) return 's';
  return null;
}

/** 将时间戳转为多格式日期信息 */
export function timestampToDateInfo(timestamp: number): DateInfo {
  const d = dayjs(timestamp);
  return {
    iso: d.toISOString(),
    local: d.format('YYYY-MM-DD HH:mm:ss'),
    utc: d.utc().format('YYYY-MM-DD HH:mm:ss [UTC]'),
    relative: d.fromNow(),
    unixSeconds: Math.floor(timestamp / 1000),
    unixMillis: timestamp,
  };
}

/** 解析日期字符串为多格式信息 */
export function parseDateInput(dateStr: string): DateInfo | null {
  if (!dateStr.trim()) return null;
  const d = dayjs(dateStr);
  if (!d.isValid()) return null;
  return timestampToDateInfo(d.valueOf());
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/datetime.test.ts
```

- [ ] **Step 5: 创建日期时间转换器 Vue 组件**

创建 `src/tools/DateTimeConverter.vue`：

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  type DateInfo,
} from '../utils/datetime';

type InputMode = 'timestamp' | 'date';

const inputMode = ref<InputMode>('timestamp');
const timestampInput = ref('');
const dateInput = ref('');
const dateInfo = ref<DateInfo | null>(null);
const errorMsg = ref('');
const copiedField = ref('');

/** 解析时间戳 */
function parseTimestamp() {
  errorMsg.value = '';
  dateInfo.value = null;

  const input = timestampInput.value.trim();
  if (!input) {
    errorMsg.value = '请输入时间戳';
    return;
  }

  const unit = detectTimestampUnit(input);
  if (!unit) {
    errorMsg.value = '无法识别时间戳格式，请输入 10 位（秒）或 13 位（毫秒）数字';
    return;
  }

  const ts = Number(input);
  dateInfo.value = timestampToDateInfo(unit === 's' ? ts * 1000 : ts);
}

/** 解析日期字符串 */
function parseDate() {
  errorMsg.value = '';
  dateInfo.value = null;

  const input = dateInput.value.trim();
  if (!input) {
    errorMsg.value = '请输入日期时间';
    return;
  }

  const result = parseDateInput(input);
  if (!result) {
    errorMsg.value = '无法解析日期，请检查格式';
    return;
  }
  dateInfo.value = result;
}

function execute() {
  if (inputMode.value === 'timestamp') {
    parseTimestamp();
  } else {
    parseDate();
  }
}

function fillNow() {
  inputMode.value = 'timestamp';
  timestampInput.value = String(Date.now());
  parseTimestamp();
}

function handleExample() {
  inputMode.value = 'timestamp';
  timestampInput.value = '1700000000000';
  parseTimestamp();
}

function handleClear() {
  timestampInput.value = '';
  dateInput.value = '';
  dateInfo.value = null;
  errorMsg.value = '';
}

async function copyField(label: string, value: string) {
  const success = await copyToClipboard(value);
  if (success) {
    copiedField.value = label;
    setTimeout(() => { copiedField.value = ''; }, 1000);
  }
}

const resultFields = computed(() => {
  if (!dateInfo.value) return [];
  return [
    { label: 'ISO 8601', value: dateInfo.value.iso },
    { label: '本地时间', value: dateInfo.value.local },
    { label: 'UTC 时间', value: dateInfo.value.utc },
    { label: '相对时间', value: dateInfo.value.relative },
    { label: 'Unix 秒', value: String(dateInfo.value.unixSeconds) },
    { label: 'Unix 毫秒', value: String(dateInfo.value.unixMillis) },
  ];
});
</script>

<template>
  <div class="datetime-tool">
    <ToolHeader
      title="日期时间转换器"
      description="时间戳与日期格式互转，支持多种日期格式"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: inputMode === 'timestamp' }]" @click="inputMode = 'timestamp'">时间戳 → 日期</button>
      <button :class="['tab-btn', { active: inputMode === 'date' }]" @click="inputMode = 'date'">日期 → 时间戳</button>
    </div>

    <div class="input-section">
      <div v-if="inputMode === 'timestamp'" class="input-group">
        <label class="field-label">输入时间戳</label>
        <input v-model="timestampInput" class="field-input" style="width:100%" placeholder="例如：1700000000000（毫秒）或 1700000000（秒）" />
      </div>
      <div v-else class="input-group">
        <label class="field-label">输入日期时间</label>
        <input v-model="dateInput" class="field-input" style="width:100%" placeholder="例如：2023-11-14T12:00:00 或 2023/11/14 12:00:00" />
        <input v-model="dateInput" type="datetime-local" class="field-input" style="width:100%;margin-top:var(--space-xs)" step="1" @change="execute" />
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-primary" @click="execute">转换</button>
      <button class="btn-secondary" @click="fillNow">当前时间</button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="resultFields.length" class="result-cards">
      <div v-for="field in resultFields" :key="field.label" class="result-card">
        <span class="result-label">{{ field.label }}</span>
        <code class="result-value">{{ field.value }}</code>
        <button class="result-copy" @click="copyField(field.label, field.value)">
          {{ copiedField === field.label ? '✓' : '复制' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datetime-tool { max-width: 720px; }

.mode-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn.active {
  background-color: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.input-section { margin-bottom: var(--space-md); }

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
}

.btn-secondary {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.875rem;
  font-family: var(--font-sans);
  cursor: pointer;
}

.btn-secondary:hover { background-color: var(--color-hover); }

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.result-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.result-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
}

.result-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  min-width: 80px;
}

.result-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
}

.result-copy {
  flex-shrink: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
}

.result-copy:hover { color: var(--color-accent); }
</style>
```

- [ ] **Step 6: 更新日期时间 Astro 页面**

修改 `src/pages/datetime-converter.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import DateTimeConverter from '../tools/DateTimeConverter.vue';
---

<ToolLayout title="日期时间转换器 - DevTools" toolId="datetime-converter">
  <DateTimeConverter client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证并提交**

```bash
pnpm test -- tests/utils/datetime.test.ts
pnpm dev
```

验证 `/datetime-converter` 页面的时间戳转换、日期解析、"当前时间"按钮。

```bash
git add src/utils/datetime.ts tests/utils/datetime.test.ts src/tools/DateTimeConverter.vue src/pages/datetime-converter.astro
git commit -m "feat: implement datetime converter tool"
```

---

## Task 5: URL 编解码

**Files:**
- Create: `src/utils/url-codec.ts`
- Create: `tests/utils/url-codec.test.ts`
- Create: `src/tools/UrlEncodeCodec.vue`
- Modify: `src/pages/url-encode.astro`

- [ ] **Step 1: 写 URL 编解码工具函数的测试**

创建 `tests/utils/url-codec.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { encodeUrl, decodeUrl } from '../../src/utils/url-codec';

describe('encodeUrl', () => {
  it('应使用 encodeURIComponent 编码所有特殊字符', () => {
    const result = encodeUrl('hello world?foo=bar&baz=1');
    expect(result.component).toBe('hello%20world%3Ffoo%3Dbar%26baz%3D1');
  });

  it('应使用 encodeURI 保留 URL 结构字符', () => {
    const result = encodeUrl('https://example.com/path?name=hello world');
    expect(result.full).toContain('https://');
    expect(result.full).toContain('example.com');
    expect(result.full).toContain('%20');
  });

  it('空字符串应返回空结果', () => {
    const result = encodeUrl('');
    expect(result.component).toBe('');
    expect(result.full).toBe('');
  });
});

describe('decodeUrl', () => {
  it('应正确解码 percent-encoded 字符串', () => {
    const result = decodeUrl('hello%20world');
    expect(result.component).toBe('hello world');
  });

  it('解码失败时应包含错误信息', () => {
    const result = decodeUrl('%E0%A4%A');
    expect(result.error).toBeDefined();
  });

  it('空字符串应返回空结果', () => {
    const result = decodeUrl('');
    expect(result.component).toBe('');
    expect(result.full).toBe('');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/url-codec.test.ts
```

- [ ] **Step 3: 实现 URL 编解码工具函数**

创建 `src/utils/url-codec.ts`：

```typescript
/** URL 编码结果 */
export interface UrlEncodeResult {
  /** encodeURIComponent 结果（组件级） */
  component: string;
  /** encodeURI 结果（完整 URL） */
  full: string;
}

/** URL 解码结果 */
export interface UrlDecodeResult {
  /** decodeURIComponent 结果 */
  component: string;
  /** decodeURI 结果 */
  full: string;
  /** 解码错误信息 */
  error?: string;
}

/** 编码 URL 字符串，同时展示两种编码方式 */
export function encodeUrl(text: string): UrlEncodeResult {
  return {
    component: encodeURIComponent(text),
    full: encodeURI(text),
  };
}

/** 解码 URL 字符串 */
export function decodeUrl(encoded: string): UrlDecodeResult {
  let component = '';
  let full = '';
  let error: string | undefined;

  try {
    component = decodeURIComponent(encoded);
  } catch {
    error = 'URIComponent 解码失败：输入包含非法的 percent-encoded 序列';
  }

  try {
    full = decodeURI(encoded);
  } catch {
    error = error
      ? error + '；URI 解码也失败'
      : 'URI 解码失败：输入包含非法的 percent-encoded 序列';
  }

  return { component, full, error };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/url-codec.test.ts
```

- [ ] **Step 5: 创建 URL 编解码 Vue 组件**

创建 `src/tools/UrlEncodeCodec.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { encodeUrl, decodeUrl } from '../utils/url-codec';

type Mode = 'encode' | 'decode';

const mode = ref<Mode>('encode');
const input = ref('');
const errorMsg = ref('');

const encodeComponentResult = ref('');
const encodeFullResult = ref('');
const decodeComponentResult = ref('');
const decodeFullResult = ref('');

function execute() {
  errorMsg.value = '';
  if (!input.value.trim()) {
    errorMsg.value = mode.value === 'encode' ? '请输入要编码的文本' : '请输入要解码的文本';
    return;
  }

  if (mode.value === 'encode') {
    const result = encodeUrl(input.value);
    encodeComponentResult.value = result.component;
    encodeFullResult.value = result.full;
    decodeComponentResult.value = '';
    decodeFullResult.value = '';
  } else {
    const result = decodeUrl(input.value);
    decodeComponentResult.value = result.component;
    decodeFullResult.value = result.full;
    encodeComponentResult.value = '';
    encodeFullResult.value = '';
    if (result.error) errorMsg.value = result.error;
  }
}

function switchMode(newMode: Mode) {
  mode.value = newMode;
  errorMsg.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
}

function handleExample() {
  mode.value = 'encode';
  input.value = 'https://example.com/search?q=你好世界&lang=zh-CN';
  execute();
}

function handleClear() {
  input.value = '';
  errorMsg.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
}
</script>

<template>
  <div class="url-tool">
    <ToolHeader
      title="URL 编解码"
      description="URL 编码与解码，支持组件级和完整 URL 编码"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: mode === 'encode' }]" @click="switchMode('encode')">编码</button>
      <button :class="['tab-btn', { active: mode === 'decode' }]" @click="switchMode('decode')">解码</button>
    </div>

    <div class="input-section">
      <label class="field-label">输入</label>
      <textarea v-model="input" class="field-textarea" rows="3" :placeholder="mode === 'encode' ? '输入要编码的文本或 URL' : '输入要解码的 percent-encoded 文本'"></textarea>
    </div>

    <div class="action-bar">
      <button class="btn-primary" @click="execute">{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="encodeComponentResult || decodeComponentResult" class="results-section">
      <div class="result-block">
        <div class="result-block-header">
          <span class="result-label">{{ mode === 'encode' ? 'encodeURIComponent' : 'decodeURIComponent' }}</span>
          <span class="result-hint">组件级，编码/解码所有特殊字符</span>
        </div>
        <div class="result-value-box">
          <code class="result-value">{{ mode === 'encode' ? encodeComponentResult : decodeComponentResult }}</code>
          <CopyButton :text="mode === 'encode' ? encodeComponentResult : decodeComponentResult" label="复制" />
        </div>
      </div>
      <div class="result-block">
        <div class="result-block-header">
          <span class="result-label">{{ mode === 'encode' ? 'encodeURI' : 'decodeURI' }}</span>
          <span class="result-hint">完整 URL 级，保留 URL 结构字符（: / ? & = #）</span>
        </div>
        <div class="result-value-box">
          <code class="result-value">{{ mode === 'encode' ? encodeFullResult : decodeFullResult }}</code>
          <CopyButton :text="mode === 'encode' ? encodeFullResult : decodeFullResult" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.url-tool { max-width: 720px; }

.mode-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn.active {
  background-color: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.input-section { margin-bottom: var(--space-md); }

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.results-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.result-block {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.result-block-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.result-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-mono);
}

.result-hint {
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.result-value-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.result-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}
</style>
```

- [ ] **Step 6: 更新 URL 编解码 Astro 页面**

修改 `src/pages/url-encode.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import UrlEncodeCodec from '../tools/UrlEncodeCodec.vue';
---

<ToolLayout title="URL 编解码 - DevTools" toolId="url-encode">
  <UrlEncodeCodec client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证并提交**

```bash
pnpm test -- tests/utils/url-codec.test.ts
pnpm dev
```

验证 `/url-encode` 页面编码/解码两种模式。

```bash
git add src/utils/url-codec.ts tests/utils/url-codec.test.ts src/tools/UrlEncodeCodec.vue src/pages/url-encode.astro
git commit -m "feat: implement URL encode/decode tool"
```

---

## Task 6: JWT 解析器

**Files:**
- Create: `src/utils/jwt.ts`
- Create: `tests/utils/jwt.test.ts`
- Create: `src/tools/JwtParser.vue`
- Modify: `src/pages/jwt-parser.astro`

- [ ] **Step 1: 写 JWT 工具函数的测试**

创建 `tests/utils/jwt.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { parseJwt, type JwtSegments } from '../../src/utils/jwt';

// 一个用于测试的示例 JWT (header: {"alg":"HS256","typ":"JWT"}, payload: {"sub":"1234567890","name":"John","iat":1516239022})
const SAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('parseJwt', () => {
  it('应正确解析 JWT 的三个段', () => {
    const result = parseJwt(SAMPLE_JWT);
    expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(result.payload.sub).toBe('1234567890');
    expect(result.payload.name).toBe('John');
    expect(result.payload.iat).toBe(1516239022);
    expect(result.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('应在 JWT 格式无效时返回错误', () => {
    const result = parseJwt('not.a.valid-jwt-format-because-too-many-dots.in.it');
    expect(result.error).toBeDefined();
  });

  it('应在空输入时返回错误', () => {
    const result = parseJwt('');
    expect(result.error).toBeDefined();
  });

  it('应在段不是合法 Base64URL 时返回错误', () => {
    const result = parseJwt('!!!invalid.!!!invalid.signature');
    expect(result.error).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/jwt.test.ts
```

- [ ] **Step 3: 实现 JWT 工具函数**

创建 `src/utils/jwt.ts`：

```typescript
/** JWT 标准声明字段的中文名映射 */
export const JWT_CLAIM_LABELS: Record<string, string> = {
  iss: '签发者',
  sub: '主题',
  aud: '受众',
  exp: '过期时间',
  nbf: '生效时间',
  iat: '签发时间',
  jti: 'JWT ID',
};

/** JWT 解析结果 */
export interface JwtSegments {
  /** Header 对象 */
  header: Record<string, unknown>;
  /** Payload 对象 */
  payload: Record<string, unknown>;
  /** Signature 原始字符串 */
  signature: string;
  /** 错误信息 */
  error?: string;
}

/** Base64URL 解码为字符串 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return atob(base64);
}

/** Base64URL 解码为 JSON 对象 */
function base64UrlToJson(str: string): Record<string, unknown> | null {
  try {
    const decoded = base64UrlDecode(str);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** 解析 JWT token */
export function parseJwt(token: string): JwtSegments {
  if (!token.trim()) {
    return { header: {}, payload: {}, signature: '', error: '请输入 JWT Token' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { header: {}, payload: {}, signature: '', error: 'JWT 格式无效：应包含 3 个以点号分隔的段' };
  }

  const header = base64UrlToJson(parts[0]);
  if (!header) {
    return { header: {}, payload: {}, signature: '', error: 'Header 段不是合法的 Base64URL 编码的 JSON' };
  }

  const payload = base64UrlToJson(parts[1]);
  if (!payload) {
    return { header: {}, payload: {}, signature: '', error: 'Payload 段不是合法的 Base64URL 编码的 JSON' };
  }

  return {
    header,
    payload,
    signature: parts[2],
  };
}

/** 判断 Token 是否已过期 */
export function isTokenExpired(payload: Record<string, unknown>): boolean | null {
  if (typeof payload.exp !== 'number') return null;
  return Date.now() / 1000 > payload.exp;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/jwt.test.ts
```

- [ ] **Step 5: 创建 JWT 解析器 Vue 组件**

创建 `src/tools/JwtParser.vue`：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { parseJwt, isTokenExpired, JWT_CLAIM_LABELS } from '../utils/jwt';
import dayjs from 'dayjs';

const tokenInput = ref('');
const parsed = ref<ReturnType<typeof parseJwt> | null>(null);
const errorMsg = ref('');

function parse() {
  errorMsg.value = '';
  const result = parseJwt(tokenInput.value);
  if (result.error) {
    errorMsg.value = result.error;
    parsed.value = null;
  } else {
    parsed.value = result;
  }
}

/** 获取声明值的中文说明 */
function getClaimLabel(key: string): string | undefined {
  return JWT_CLAIM_LABELS[key];
}

/** 格式化时间戳声明值 */
function formatClaimValue(key: string, value: unknown): string {
  if (typeof value === 'number' && (key === 'iat' || key === 'exp' || key === 'nbf')) {
    return `${value} (${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')})`;
  }
  return String(value);
}

const expiredStatus = computed(() => {
  if (!parsed.value?.payload) return null;
  return isTokenExpired(parsed.value.payload);
});

function handleExample() {
  tokenInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.4DLyM2DJpI8jiV8sRz7i1MSsiWRF7LPtIMzflaU6mFs';
  parse();
}

function handleClear() {
  tokenInput.value = '';
  parsed.value = null;
  errorMsg.value = '';
}

function segmentJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}
</script>

<template>
  <div class="jwt-tool">
    <ToolHeader
      title="JWT 解析器"
      description="解析和验证 JSON Web Token，展示 Header、Payload、Signature"
      @example="handleExample"
    />

    <div class="input-section">
      <label class="field-label">输入 JWT Token</label>
      <textarea
        v-model="tokenInput"
        class="field-textarea"
        rows="4"
        placeholder="粘贴 JWT Token..."
        @input="parse()"
      ></textarea>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="expiredStatus !== null" :class="['status-badge', expiredStatus ? 'expired' : 'valid']">
      {{ expiredStatus ? 'Token 已过期' : 'Token 未过期' }}
    </div>

    <div v-if="parsed && !errorMsg" class="segments">
      <div class="segment-card segment-header">
        <div class="segment-title">
          <span class="segment-dot header-dot"></span>
          Header
        </div>
        <pre class="segment-json">{{ segmentJson(parsed.header) }}</pre>
        <CopyButton :text="segmentJson(parsed.header)" label="复制 JSON" />
      </div>

      <div class="segment-card segment-payload">
        <div class="segment-title">
          <span class="segment-dot payload-dot"></span>
          Payload
        </div>
        <div class="payload-claims">
          <div v-for="(value, key) in parsed.payload" :key="String(key)" class="claim-row">
            <span class="claim-key">
              {{ key }}
              <span v-if="getClaimLabel(String(key))" class="claim-label">{{ getClaimLabel(String(key)) }}</span>
            </span>
            <span class="claim-value">{{ formatClaimValue(String(key), value) }}</span>
          </div>
        </div>
        <CopyButton :text="segmentJson(parsed.payload)" label="复制 JSON" />
      </div>

      <div class="segment-card segment-signature">
        <div class="segment-title">
          <span class="segment-dot sig-dot"></span>
          Signature
        </div>
        <code class="sig-value">{{ parsed.signature }}</code>
        <CopyButton :text="parsed.signature" label="复制" />
      </div>
    </div>

    <div v-if="parsed && !errorMsg" class="clear-bar">
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>

<style scoped>
.jwt-tool { max-width: 720px; }

.input-section {
  margin-bottom: var(--space-md);
}

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.status-badge {
  display: inline-block;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.status-badge.valid {
  background-color: #dcfce7;
  color: var(--color-success);
}

.status-badge.expired {
  background-color: #fee2e2;
  color: var(--color-error);
}

.segments {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.segment-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.segment-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

.segment-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.header-dot { background-color: #ef4444; }
.payload-dot { background-color: #8b5cf6; }
.sig-dot { background-color: #22c55e; }

.segment-json {
  margin: 0 0 var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-hover);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.payload-claims {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.claim-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-md);
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border);
}

.claim-row:last-child { border-bottom: none; }

.claim-key {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  min-width: 120px;
  color: var(--color-text);
}

.claim-label {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--color-muted);
  margin-left: var(--space-xs);
}

.claim-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  word-break: break-all;
}

.sig-value {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.clear-bar { margin-top: var(--space-md); }
</style>
```

- [ ] **Step 6: 更新 JWT 解析器 Astro 页面**

修改 `src/pages/jwt-parser.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import JwtParser from '../tools/JwtParser.vue';
---

<ToolLayout title="JWT 解析器 - DevTools" toolId="jwt-parser">
  <JwtParser client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证并提交**

```bash
pnpm test -- tests/utils/jwt.test.ts
pnpm dev
```

验证 `/jwt-parser` 页面的解析、过期状态、声明中文说明。

```bash
git add src/utils/jwt.ts tests/utils/jwt.test.ts src/tools/JwtParser.vue src/pages/jwt-parser.astro
git commit -m "feat: implement JWT parser tool"
```

---

## Task 7: 设备信息与 UserAgent

**Files:**
- Create: `src/tools/DeviceInfo.vue`
- Modify: `src/pages/device-info.astro`

注意：DeviceInfo 主要是浏览器 API 调用和 bowser 解析，无复杂可提取的纯逻辑，跳过独立工具函数和 TDD，逻辑内联在组件中。

- [ ] **Step 1: 创建设备信息 Vue 组件**

创建 `src/tools/DeviceInfo.vue`：

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import Bowser from 'bowser';

interface InfoItem {
  label: string;
  value: string;
}

const deviceItems = ref<InfoItem[]>([]);
const customUA = ref('');
const customItems = ref<InfoItem[]>([]);

/** 收集当前设备信息 */
function collectDeviceInfo() {
  const ua = navigator.userAgent;
  const parser = Bowser.getParser(ua);
  const browser = parser.getBrowser();
  const engine = parser.getEngine();
  const os = parser.getOS();
  const platform = parser.getPlatform();

  deviceItems.value = [
    { label: '浏览器', value: `${browser.name ?? '未知'} ${browser.version ?? ''}` },
    { label: '渲染引擎', value: `${engine.name ?? '未知'} ${engine.version ?? ''}` },
    { label: '操作系统', value: `${os.name ?? '未知'} ${os.version ?? ''}` },
    { label: '设备类型', value: platform.type ?? '未知' },
    { label: '屏幕分辨率', value: `${screen.width} × ${screen.height}` },
    { label: '可用区域', value: `${screen.availWidth} × ${screen.availHeight}` },
    { label: '色深', value: `${screen.colorDepth} 位` },
    { label: '浏览器语言', value: navigator.language },
    { label: 'Cookie', value: navigator.cookieEnabled ? '已启用' : '已禁用' },
    { label: '在线状态', value: navigator.onLine ? '在线' : '离线' },
    { label: 'UserAgent', value: ua },
  ];
}

/** 解析自定义 UA */
function parseCustomUA() {
  if (!customUA.value.trim()) {
    customItems.value = [];
    return;
  }
  try {
    const parser = Bowser.getParser(customUA.value);
    const browser = parser.getBrowser();
    const engine = parser.getEngine();
    const os = parser.getOS();
    const platform = parser.getPlatform();

    customItems.value = [
      { label: '浏览器', value: `${browser.name ?? '未知'} ${browser.version ?? ''}` },
      { label: '渲染引擎', value: `${engine.name ?? '未知'} ${engine.version ?? ''}` },
      { label: '操作系统', value: `${os.name ?? '未知'} ${os.version ?? ''}` },
      { label: '设备类型', value: platform.type ?? '未知' },
    ];
  } catch {
    customItems.value = [{ label: '错误', value: '无法解析该 UserAgent 字符串' }];
  }
}

const allInfoJson = computed(() => {
  const obj: Record<string, string> = {};
  for (const item of deviceItems.value) {
    obj[item.label] = item.value;
  }
  return JSON.stringify(obj, null, 2);
});

onMounted(() => {
  collectDeviceInfo();
});
</script>

<template>
  <div class="device-tool">
    <ToolHeader
      title="设备信息与 UserAgent"
      description="查看浏览器、操作系统、屏幕等设备信息"
      :show-example="false"
    />

    <div class="info-grid">
      <div v-for="item in deviceItems" :key="item.label" class="info-card">
        <span class="info-label">{{ item.label }}</span>
        <span :class="['info-value', { mono: item.label === 'UserAgent' }]">{{ item.value }}</span>
      </div>
    </div>

    <div class="copy-bar">
      <CopyButton :text="allInfoJson" label="复制 JSON" />
    </div>

    <div class="custom-section">
      <h2 class="section-title">自定义 UA 解析</h2>
      <textarea
        v-model="customUA"
        class="field-textarea"
        rows="2"
        placeholder="粘贴 UserAgent 字符串进行解析..."
        @input="parseCustomUA"
      ></textarea>
      <div v-if="customItems.length" class="info-grid">
        <div v-for="item in customItems" :key="item.label" class="info-card">
          <span class="info-label">{{ item.label }}</span>
          <span class="info-value">{{ item.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-tool { max-width: 720px; }

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.info-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
}

.info-card:has(.mono) {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 0.875rem;
  color: var(--color-text);
  word-break: break-all;
}

.info-value.mono {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.copy-bar { margin-bottom: var(--space-xl); }

.custom-section {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-lg);
}

.section-title {
  margin: 0 0 var(--space-md);
  font-size: 1rem;
  font-weight: 600;
}

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: var(--space-md);
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

@media (max-width: 767px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 2: 更新设备信息 Astro 页面**

修改 `src/pages/device-info.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import DeviceInfo from '../tools/DeviceInfo.vue';
---

<ToolLayout title="设备信息与 UserAgent - DevTools" toolId="device-info">
  <DeviceInfo client:idle />
</ToolLayout>
```

- [ ] **Step 3: 验证并提交**

```bash
pnpm dev
```

验证 `/device-info` 页面能自动展示设备信息，自定义 UA 解析功能正常。

```bash
git add src/tools/DeviceInfo.vue src/pages/device-info.astro
git commit -m "feat: implement device info and user agent parser tool"
```

---

## Task 8: 对称加解密

**Files:**
- Create: `src/utils/crypto.ts`
- Create: `tests/utils/crypto.test.ts`
- Create: `src/tools/SymmetricCrypto.vue`
- Modify: `src/pages/symmetric-crypto.astro`

- [ ] **Step 1: 写对称加解密工具函数的测试**

创建 `tests/utils/crypto.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  encryptAES,
  decryptAES,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../../src/utils/crypto';

describe('encryptAES & decryptAES', () => {
  it('应正确加密和解密文本（AES-GCM）', async () => {
    const plaintext = 'Hello, World!';
    const password = 'my-secret-password';
    const encrypted = await encryptAES(plaintext, password, 'AES-GCM', 256);
    expect(encrypted).toBeTruthy();
    const decrypted = await decryptAES(encrypted, password, 'AES-GCM', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应正确加密和解密中文文本', async () => {
    const plaintext = '你好，世界！🔐';
    const password = '密码';
    const encrypted = await encryptAES(plaintext, password, 'AES-GCM', 256);
    const decrypted = await decryptAES(encrypted, password, 'AES-GCM', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持 AES-CBC 模式', async () => {
    const plaintext = 'AES-CBC test';
    const password = 'password';
    const encrypted = await encryptAES(plaintext, password, 'AES-CBC', 256);
    const decrypted = await decryptAES(encrypted, password, 'AES-CBC', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持 AES-CTR 模式', async () => {
    const plaintext = 'AES-CTR test';
    const password = 'password';
    const encrypted = await encryptAES(plaintext, password, 'AES-CTR', 256);
    const decrypted = await decryptAES(encrypted, password, 'AES-CTR', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持不同密钥长度', async () => {
    for (const length of [128, 192, 256] as const) {
      const encrypted = await encryptAES('test', 'pass', 'AES-GCM', length);
      const decrypted = await decryptAES(encrypted, 'pass', 'AES-GCM', length);
      expect(decrypted).toBe('test');
    }
  });

  it('密码错误时应抛出异常', async () => {
    const encrypted = await encryptAES('secret', 'correct-password', 'AES-GCM', 256);
    await expect(decryptAES(encrypted, 'wrong-password', 'AES-GCM', 256)).rejects.toThrow();
  });

  it('空明文应能加密解密', async () => {
    const encrypted = await encryptAES('', 'password', 'AES-GCM', 256);
    const decrypted = await decryptAES(encrypted, 'password', 'AES-GCM', 256);
    expect(decrypted).toBe('');
  });
});

describe('arrayBufferToBase64 & base64ToArrayBuffer', () => {
  it('应正确转换 ArrayBuffer 到 Base64 再回到 ArrayBuffer', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const base64 = arrayBufferToBase64(original.buffer as ArrayBuffer);
    const restored = base64ToArrayBuffer(base64);
    expect(new Uint8Array(restored)).toEqual(original);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test -- tests/utils/crypto.test.ts
```

- [ ] **Step 3: 实现对称加解密工具函数**

创建 `src/utils/crypto.ts`：

```typescript
/** AES 加密算法类型 */
export type AESAlgorithm = 'AES-GCM' | 'AES-CBC' | 'AES-CTR';

/** 支持的密钥长度 */
export type AESKeyLength = 128 | 192 | 256;

/** 加密结果（包含 salt 和 iv，用于后续解密） */
export interface EncryptResult {
  /** Base64 编码的密文（包含 salt + iv + ciphertext） */
  data: string;
}

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH_GCM = 12;
const IV_LENGTH_CBC = 16;
const IV_LENGTH_CTR = 16;

/** ArrayBuffer 转 Base64 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/** Base64 转 ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** 获取 IV 长度 */
function getIvLength(algorithm: AESAlgorithm): number {
  if (algorithm === 'AES-GCM') return IV_LENGTH_GCM;
  return IV_LENGTH_CBC;
}

/** 从密码派生密钥 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: algorithm, length: keyLength },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 获取加密算法参数 */
function getAlgorithmParams(algorithm: AESAlgorithm, iv: Uint8Array): AesGcmParams | AesCbcParams | AesCtrParams {
  if (algorithm === 'AES-CTR') {
    return { name: 'AES-CTR', counter: iv, length: 64 };
  }
  return { name: algorithm, iv };
}

/** AES 加密 */
export async function encryptAES(
  plaintext: string,
  password: string,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(getIvLength(algorithm)));
  const key = await deriveKey(password, salt, algorithm, keyLength);
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    getAlgorithmParams(algorithm, iv),
    key,
    encoder.encode(plaintext),
  );

  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return arrayBufferToBase64(combined.buffer as ArrayBuffer);
}

/** AES 解密 */
export async function decryptAES(
  encodedData: string,
  password: string,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<string> {
  const combined = new Uint8Array(base64ToArrayBuffer(encodedData));
  const ivLen = getIvLength(algorithm);

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + ivLen);
  const ciphertext = combined.slice(SALT_LENGTH + ivLen);

  const key = await deriveKey(password, salt, algorithm, keyLength);
  const decrypted = await crypto.subtle.decrypt(
    getAlgorithmParams(algorithm, iv),
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test -- tests/utils/crypto.test.ts
```

Expected: 所有测试 PASS（可能需要 10-30 秒，PBKDF2 迭代次数较高）。

- [ ] **Step 5: 创建对称加解密 Vue 组件**

创建 `src/tools/SymmetricCrypto.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { encryptAES, decryptAES, type AESAlgorithm, type AESKeyLength } from '../utils/crypto';

type Mode = 'encrypt' | 'decrypt';

const mode = ref<Mode>('encrypt');
const algorithm = ref<AESAlgorithm>('AES-GCM');
const keyLength = ref<AESKeyLength>(256);
const plaintext = ref('');
const ciphertext = ref('');
const password = ref('');
const output = ref('');
const errorMsg = ref('');
const isProcessing = ref(false);
const showAdvanced = ref(false);

async function execute() {
  errorMsg.value = '';
  output.value = '';

  if (mode.value === 'encrypt') {
    if (!plaintext.value) {
      errorMsg.value = '请输入要加密的明文';
      return;
    }
    if (!password.value) {
      errorMsg.value = '请输入密码';
      return;
    }
  } else {
    if (!ciphertext.value) {
      errorMsg.value = '请输入要解密的密文';
      return;
    }
    if (!password.value) {
      errorMsg.value = '请输入密码';
      return;
    }
  }

  isProcessing.value = true;
  try {
    if (mode.value === 'encrypt') {
      output.value = await encryptAES(plaintext.value, password.value, algorithm.value, keyLength.value);
    } else {
      output.value = await decryptAES(ciphertext.value, password.value, algorithm.value, keyLength.value);
    }
  } catch {
    errorMsg.value = mode.value === 'encrypt'
      ? '加密失败，请检查输入'
      : '解密失败，请检查密码或密文是否正确';
  } finally {
    isProcessing.value = false;
  }
}

function switchMode(newMode: Mode) {
  mode.value = newMode;
  output.value = '';
  errorMsg.value = '';
}

function handleExample() {
  mode.value = 'encrypt';
  algorithm.value = 'AES-GCM';
  keyLength.value = 256;
  plaintext.value = 'Hello, DevTools! 你好，开发者工具！';
  password.value = 'my-secret-password';
  execute();
}

function handleClear() {
  plaintext.value = '';
  ciphertext.value = '';
  password.value = '';
  output.value = '';
  errorMsg.value = '';
}
</script>

<template>
  <div class="crypto-tool">
    <ToolHeader
      title="对称加解密"
      description="支持 AES 等主流对称加密算法的加解密"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: mode === 'encrypt' }]" @click="switchMode('encrypt')">加密</button>
      <button :class="['tab-btn', { active: mode === 'decrypt' }]" @click="switchMode('decrypt')">解密</button>
    </div>

    <div class="controls-row">
      <div class="control-group">
        <label class="field-label">算法</label>
        <select v-model="algorithm" class="field-select">
          <option value="AES-GCM">AES-GCM</option>
          <option value="AES-CBC">AES-CBC</option>
          <option value="AES-CTR">AES-CTR</option>
        </select>
      </div>
      <div class="control-group">
        <label class="field-label">密钥长度</label>
        <select v-model.number="keyLength" class="field-select">
          <option :value="128">128 位</option>
          <option :value="192">192 位</option>
          <option :value="256">256 位</option>
        </select>
      </div>
    </div>

    <div class="io-section">
      <div class="io-block">
        <label class="field-label">{{ mode === 'encrypt' ? '明文' : '密文（Base64）' }}</label>
        <textarea
          v-if="mode === 'encrypt'"
          v-model="plaintext"
          class="field-textarea"
          rows="4"
          placeholder="输入要加密的文本"
        ></textarea>
        <textarea
          v-else
          v-model="ciphertext"
          class="field-textarea"
          rows="4"
          placeholder="输入 Base64 编码的密文"
        ></textarea>
      </div>

      <div class="io-block">
        <label class="field-label">密码</label>
        <input v-model="password" type="password" class="field-input" style="width:100%" placeholder="输入加密密码" />
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-primary" :disabled="isProcessing" @click="execute">
        {{ isProcessing ? '处理中...' : (mode === 'encrypt' ? '加密' : '解密') }}
      </button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="output" class="output-section">
      <div class="output-header">
        <span class="output-label">{{ mode === 'encrypt' ? '密文' : '明文' }}</span>
        <CopyButton :text="output" label="复制结果" />
      </div>
      <div class="output-box">
        <code class="output-value">{{ output }}</code>
      </div>
    </div>

    <details class="advanced-panel">
      <summary class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        高级选项
      </summary>
      <div class="advanced-content">
        <p class="advanced-hint">
          当前算法：<strong>{{ algorithm }}</strong>，密钥长度：<strong>{{ keyLength }} 位</strong>。
          密码通过 PBKDF2（100000 次迭代，SHA-256）派生为 AES 密钥。
          加密结果格式：Base64(salt[16B] + iv[{{ algorithm === 'AES-GCM' ? '12' : '16' }}B] + ciphertext)。
        </p>
      </div>
    </details>
  </div>
</template>

<style scoped>
.crypto-tool { max-width: 720px; }

.mode-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn.active {
  background-color: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.controls-row {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.io-section { margin-bottom: var(--space-md); }

.io-block { margin-bottom: var(--space-sm); }

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus,
.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label { font-size: 0.875rem; font-weight: 500; }

.output-box {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.output-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}

.advanced-panel {
  margin-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-md);
}

.advanced-toggle {
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.advanced-toggle:hover { color: var(--color-text); }

.advanced-content {
  padding-top: var(--space-sm);
}

.advanced-hint {
  font-size: 0.8125rem;
  color: var(--color-muted);
  margin: 0;
  line-height: 1.6;
}
</style>
```

- [ ] **Step 6: 更新对称加解密 Astro 页面**

修改 `src/pages/symmetric-crypto.astro`，替换全部内容为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import SymmetricCrypto from '../tools/SymmetricCrypto.vue';
---

<ToolLayout title="对称加解密 - DevTools" toolId="symmetric-crypto">
  <SymmetricCrypto client:idle />
</ToolLayout>
```

- [ ] **Step 7: 验证并提交**

```bash
pnpm test -- tests/utils/crypto.test.ts
pnpm dev
```

验证 `/symmetric-crypto` 页面的加密/解密功能、密码错误时的错误提示。

```bash
git add src/utils/crypto.ts tests/utils/crypto.test.ts src/tools/SymmetricCrypto.vue src/pages/symmetric-crypto.astro
git commit -m "feat: implement symmetric encryption/decryption tool"
```

---

## 完成检查

所有 8 个工具实现完毕后，运行以下检查：

```bash
pnpm test
pnpm build
```

确认所有测试通过，生产构建无报错。

```bash
git add -A
git commit -m "chore: verify all tools pass tests and build"
```
