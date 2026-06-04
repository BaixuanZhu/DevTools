# 随机字符串生成工具重设 — 实现计划

> **Goal:** 将随机字符串生成器重构为字符集 Switch 多选 + 编码模式双 Tab 架构

**Architecture:** 工具函数层大改（CharsetPreset → CharType[] + EncodingFormat），组件层新增 ModeTabGroup 切换 + ToggleSwitch 多选，结果面板共用

**Tech Stack:** Vue 3 + TypeScript + Tailwind CSS v4 + Headless UI + crypto.getRandomValues()

---

### Task 1: 扩展 ToggleSwitch 组件

**Files:**
- Modify: `src/components/ui/ToggleSwitch.vue`

**改动：** 新增可选 `description` prop，替代右侧"已开启/已关闭"默认文本
```vue
<!-- props 新增 -->
description?: string;

<!-- 模板改为 -->
<span class="text-[0.8125rem] text-muted">{{ description ?? (modelValue ? '已开启' : '已关闭') }}</span>
```

**Step 1:** 修改 `ToggleSwitch.vue` 的 props 和模板
**Step 2:** 类型检查通过

---

### Task 2: 重写工具函数 `random-string.ts`

**Files:**
- Modify: `src/utils/text/random-string.ts`

**删除：**
- `CharsetPreset` 类型
- `PRESET_CHARSETS` 常量
- `resolveCharset(preset)` 函数
- `hasLetters(preset)` 函数

**新增：**
```typescript
// === 字符类型 ===
export type CharType = 'uppercase' | 'lowercase' | 'digits' | 'special';

export const CHAR_SETS: Record<CharType, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?/',
};

/** 根据勾选的字符类型 + 可选自定义特殊字符，拼接最终字符池 */
export function resolveCharsetFromTypes(types: CharType[], customSpecial?: string): string {
  let chars = '';
  for (const t of types) {
    if (t === 'special') {
      chars += customSpecial ?? CHAR_SETS.special;
    } else {
      chars += CHAR_SETS[t];
    }
  }
  return chars;
}

// === 编码格式 ===
export type EncodingFormat = 'hex' | 'base64' | 'binary' | 'octal';

/** 生成 N 个密码学安全的随机字节 */
export function generateRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** 将字节数组编码为指定格式 */
export function encodeBytes(bytes: Uint8Array, format: EncodingFormat): string {
  switch (format) {
    case 'hex':
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    case 'binary':
      return Array.from(bytes).map((b) => b.toString(2).padStart(8, '0')).join('');
    case 'octal':
      return Array.from(bytes).map((b) => b.toString(8).padStart(3, '0')).join('');
    case 'base64': {
      const binary = String.fromCharCode(...bytes);
      return btoa(binary);
    }
  }
}

// === 格式化输出 ===
export function formatHex(str: string): string {
  return str.match(/.{2}/g)?.join(' ') ?? str;
}

export function formatBinary(str: string): string {
  return str.match(/.{8}/g)?.join(' ') ?? str;
}

export function formatOctal(str: string): string {
  return str.match(/.{3}/g)?.join(' ') ?? str;
}

/** 保留：现有函数不变签名 */
export function generateRandomString(length: number, charset: string): string { ... }
export function applyLetterCase(str: string, mode: LetterCase): string { ... }
export type LetterCase = 'none' | 'upper' | 'lower';
```

**注意：** `generateRandomString` 的 `charset` 参数从 `CharsetPreset` 改为 `string`（更通用）

**Step 1:** 写入上述全部类型、常量、函数
**Step 2:** 确认 `generateRandomString` 签名改为 `generateRandomString(length: number, charset: string)`

---

### Task 3: 更新测试文件

**Files:**
- Modify: `src/tests/text/random-string.test.ts`

**改动：**

1. 更新现有测试适配新 API：
   - `generateRandomString(16, 'alphanumeric')` → `generateRandomString(16, CHAR_SETS.uppercase + CHAR_SETS.lowercase + CHAR_SETS.digits)`
   - `PRESET_CHARSETS` → `CHAR_SETS`
   - 删除 `CharsetPreset` 类型导入

2. 新增编码测试：
```typescript
describe('encodeBytes', () => {
  it('hex 编码 - 每个字节变为 2 个十六进制字符', () => {
    const bytes = new Uint8Array([0, 255, 16, 128]);
    const result = encodeBytes(bytes, 'hex');
    expect(result).toBe('00ff1080');
  });

  it('binary 编码 - 每个字节变为 8 位二进制', () => {
    const bytes = new Uint8Array([0, 255, 128]);
    const result = encodeBytes(bytes, 'binary');
    expect(result).toBe('000000001111111110000000');
  });

  it('octal 编码 - 每个字节变为 3 位八进制', () => {
    const bytes = new Uint8Array([0, 255, 64]);
    const result = encodeBytes(bytes, 'octal');
    expect(result).toBe('000377100');
  });

  it('base64 编码', () => {
    const bytes = new Uint8Array([0, 255, 128]);
    const result = encodeBytes(bytes, 'base64');
    expect(result).toBe('AP+A'); // btoa of \x00\xff\x80
  });

  it('空字节数组返回空字符串', () => {
    expect(encodeBytes(new Uint8Array(0), 'hex')).toBe('');
    expect(encodeBytes(new Uint8Array(0), 'base64')).toBe('');
  });
});

describe('generateRandomBytes', () => {
  it('生成指定数量的字节', () => {
    const bytes = generateRandomBytes(16);
    expect(bytes.length).toBe(16);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('生成 0 字节返回空数组', () => {
    const bytes = generateRandomBytes(0);
    expect(bytes.length).toBe(0);
  });
});

describe('resolveCharsetFromTypes', () => {
  it('组合 uppercase + digits', () => {
    const chars = resolveCharsetFromTypes(['uppercase', 'digits']);
    expect(chars).toContain('A');
    expect(chars).toContain('9');
    expect(chars).not.toContain('a');
  });

  it('使用自定义特殊字符', () => {
    const chars = resolveCharsetFromTypes(['special'], '@#$');
    expect(chars).toBe('@#$');
  });

  it('空类型数组返回空字符串', () => {
    expect(resolveCharsetFromTypes([])).toBe('');
  });
});
```

3. 新增格式化测试：
```typescript
describe('formatHex', () => {
  it('每 2 个字符加空格', () => {
    expect(formatHex('a1b2c3')).toBe('a1 b2 c3');
  });
});

describe('formatBinary', () => {
  it('每 8 个字符加空格', () => {
    expect(formatBinary('0000000011111111')).toBe('00000000 11111111');
  });
});
```

---

### Task 4: 重写 RandomStringGenerator.vue

**Files:**
- Modify: `src/tools/text/RandomStringGenerator.vue`

**导入变更：**
```typescript
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import {
  CHAR_SETS,
  resolveCharsetFromTypes,
  generateRandomString,
  applyLetterCase,
  generateRandomBytes,
  encodeBytes,
  formatHex,
  formatBinary,
  formatOctal,
  type CharType,
  type LetterCase,
  type EncodingFormat,
} from '../../utils/text/random-string';
```

**状态变量：**
```typescript
// Tab 模式
const mode = ref<'charset' | 'encoding'>('charset');

// 字符集模式状态
const charTypes = ref<Record<CharType, boolean>>({
  uppercase: true,
  lowercase: true,
  digits: true,
  special: false,
});
const customSpecial = ref('!@#$%^&*()_+-=[]{}|;:,.<>?/');
const length = ref(16);
const letterCase = ref<LetterCase>('none');
const count = ref(1);

// 编码模式状态
const encodingFormat = ref<EncodingFormat>('hex');
const byteCount = ref(16);
const encodingCount = ref(1);

// 结果
const results = ref<string[]>([]);

// 计算
const showLetterCase = computed(() => charTypes.value.uppercase || charTypes.value.lowercase);
const charsetEmpty = computed(() => Object.values(charTypes.value).every(v => !v));
const specialEmpty = computed(() => charTypes.value.special && !customSpecial.value.trim());
```

**模板骨架：**
```html
<div class="max-w-[720px]">
  <ToolHeader title="随机字符串生成" description="..." @example="generate" />

  <!-- Tab 切换 -->
  <ModeTabGroup v-model="mode"
    :options="[
      { key: 'charset', label: '字符集模式' },
      { key: 'encoding', label: '编码模式' },
    ]">
    <!-- 字符集模式面板 -->
    <template #charset>
      <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
        <!-- Switch 排 -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">字符集</span>
          <div class="flex gap-3 flex-wrap">
            <ToggleSwitch v-model="charTypes.uppercase" description="26个大写字母" label="A-Z" />
            <ToggleSwitch v-model="charTypes.lowercase" description="26个小写字母" label="a-z" />
            <ToggleSwitch v-model="charTypes.digits" description="10个数字" label="0-9" />
          </div>
        </div>
        <!-- 特殊字符行 -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0"></span>
          <div class="flex items-center gap-2">
            <ToggleSwitch v-model="charTypes.special" label="特殊" />
            <input v-if="charTypes.special" v-model="customSpecial" type="text"
              class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[240px]" />
          </div>
        </div>

        <!-- 大小写 -->
        <OptionRadioGroup v-if="showLetterCase" v-model="letterCase" label="大小写"
          :options="[{ value: 'none', label: '保持' }, { value: 'upper', label: '全大写' }, { value: 'lower', label: '全小写' }]" />

        <!-- 长度 + 数量 并排 -->
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">长度</span>
            <input v-model.number="length" type="number" min="1" max="2048"
              class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[72px]" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">数量</span>
            <input v-model.number="count" type="number" min="1" max="500"
              class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[72px]" />
            <span class="text-[0.8125rem] text-muted">条</span>
          </div>
        </div>

        <!-- 按钮 -->
        <div class="flex gap-2">
          <button :disabled="charsetEmpty || specialEmpty" class="px-6 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" @click="generateCharset">生成</button>
          <button class="px-6 py-2 bg-surface border border-border text-text rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:bg-hover hover:border-accent" @click="generateCharset">重新生成</button>
        </div>
        <p v-if="charsetEmpty" class="text-xs text-error">请至少选择一种字符类型</p>
        <p v-if="specialEmpty" class="text-xs text-error">请输入特殊字符</p>
      </div>
    </template>

    <!-- 编码模式面板 -->
    <template #encoding>
      <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
        <OptionRadioGroup v-model="encodingFormat" label="编码格式"
          :options="[
            { value: 'hex', label: '十六进制(Hex)' },
            { value: 'base64', label: 'Base64' },
            { value: 'binary', label: '二进制' },
            { value: 'octal', label: '八进制' },
          ]" />

        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">随机字节数</span>
            <input v-model.number="byteCount" type="number" min="1" max="256"
              class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[72px]" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">数量</span>
            <input v-model.number="encodingCount" type="number" min="1" max="100"
              class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[72px]" />
            <span class="text-[0.8125rem] text-muted">条</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="px-6 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90" @click="generateEncoding">生成随机字节</button>
          <button class="px-6 py-2 bg-surface border border-border text-text rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:bg-hover hover:border-accent" @click="generateEncoding">重新生成</button>
        </div>
      </div>
    </template>
  </ModeTabGroup>

  <!-- 共用结果面板 -->
  <div class="border border-border rounded-md bg-card mt-4 min-h-[120px]">
    <!-- 占位 / 结果列表 / 复制全部 / 单项复制 -->
    <!-- (保持现有逻辑不变) -->
  </div>
</div>
```

**生成函数：**
```typescript
function generateCharset() {
  const types = (Object.keys(charTypes.value) as CharType[]).filter(k => charTypes.value[k]);
  if (types.length === 0) return;
  if (charTypes.value.special && !customSpecial.value.trim()) return;
  
  const charset = resolveCharsetFromTypes(types, customSpecial.value);
  const safeCount = Math.min(Math.max(count.value, 1), 500);
  const safeLength = Math.min(Math.max(length.value, 1), 2048);
  const arr: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    arr.push(applyLetterCase(generateRandomString(safeLength, charset), letterCase.value));
  }
  results.value = arr;
}

function generateEncoding() {
  const safeBytes = Math.min(Math.max(byteCount.value, 1), 256);
  const safeCount = Math.min(Math.max(encodingCount.value, 1), 100);
  const arr: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const bytes = generateRandomBytes(safeBytes);
    const encoded = encodeBytes(bytes, encodingFormat.value);
    // Apply formatting based on format type
    switch (encodingFormat.value) {
      case 'hex': arr.push(formatHex(encoded)); break;
      case 'binary': arr.push(formatBinary(encoded)); break;
      case 'octal': arr.push(formatOctal(encoded)); break;
      default: arr.push(encoded); // base64 - no extra formatting
    }
  }
  results.value = arr;
}
```

**结果面板：** 两个模式的生成结果都在同一个 `results` 数组中，复用现有结果面板的渲染逻辑（序号 + 代码块 + 复制）。

**Step 1:** 完整重写 `RandomStringGenerator.vue` 的 script 和 template
**Step 2:** 确保导入路径正确

---

### Task 5: 构建 + 测试验证

**Step 1:** `pnpm build` — 验证 10 页面零错误
**Step 2:** `pnpm test` — 验证所有测试通过
**Step 3:** 如有 TypeScript 类型错误，修复

---

### 执行顺序

Task 1 (ToggleSwitch) → Task 2 (工具函数) → Task 3 (测试) → Task 4 (Vue 组件) → Task 5 (验证)
