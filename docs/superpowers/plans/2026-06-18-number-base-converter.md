# 进制转换器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 dev-tools 站新增 `/text/number-base-converter` 页面，实现二/八/十/十六进制批量互转，支持大整数、负数补码与逐位二进制预览。

**Architecture:** 纯浏览器端计算，核心转换逻辑抽到 `src/utils/text/number-base-converter.ts` 并以 TDD 方式开发；交互层使用 Vue 3 组合式 API；页面通过 Astro `ToolLayout` 渲染；SEO 与 FAQ 分别注册到 `src/data/tools.ts` 和 `src/data/tool-faqs.ts`。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript strict + Tailwind CSS v4 + @headlessui/vue（SelectListbox）+ 原生 BigInt。

## Global Constraints

- 禁止使用 `eval()` / `Function()` / `setTimeout(string)` 处理用户输入。
- 所有公共函数/类必须写 JSDoc/TSDoc 文档注释。
- 无路径别名，全部使用相对路径导入。
- 输入错误以内联 `text-error` 中文提示，复制成功/失败通过 `useCopy` + Toast。
- 单工具页 JS 体积（gzip）< 50KB，不引入重型依赖。
- 单元测试放在被测模块所在目录的 `__tests__/` 子目录中。
- 每个工具页必须有「清空」和「复制结果」按钮。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/utils/text/number-base-converter.ts` | 纯函数：解析、进制转换、补码位宽、二进制位图格式化 |
| `src/utils/text/__tests__/number-base-converter.test.ts` | 单元测试 |
| `src/tools/text/NumberBaseConverter.vue` | 交互组件：输入、结果表格、二进制预览、清空/复制 |
| `src/pages/text/number-base-converter.astro` | Astro 页面壳，挂载 Vue 组件 |
| `src/data/tools.ts` | 注册工具元数据 |
| `src/data/tool-faqs.ts` | 注册 3–4 条 FAQ |

---

### Task 1: 核心转换工具函数（TDD）

**Files:**
- Create: `src/utils/text/number-base-converter.ts`
- Create: `src/utils/text/__tests__/number-base-converter.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `parseNumber(input, base)`, `convertNumber(value, base)`, `getBitWidth(value, negative)`, `toBinaryString(value, bitWidth)`, `formatBinaryPreview(value, bitWidth)`, `BASE_OPTIONS`, `BaseLabel`

- [ ] **Step 1: 创建测试文件并编写失败测试**

在 `src/utils/text/__tests__/number-base-converter.test.ts` 写入：

```ts
import { describe, it, expect } from 'vitest';
import {
  parseNumber,
  convertNumber,
  getBitWidth,
  toBinaryString,
  formatBinaryPreview,
  BASE_OPTIONS,
} from '../number-base-converter';

describe('parseNumber', () => {
  it('parses positive decimal', () => {
    const result = parseNumber('255', 10);
    expect(result).toEqual({ value: 255n, negative: false });
  });

  it('parses negative decimal', () => {
    const result = parseNumber('-255', 10);
    expect(result).toEqual({ value: -255n, negative: true });
  });

  it('parses hex without prefix', () => {
    const result = parseNumber('1A3F', 16);
    expect(result).toEqual({ value: 6719n, negative: false });
  });

  it('returns null for invalid digit', () => {
    expect(parseNumber('1G', 16)).toBeNull();
    expect(parseNumber('9', 8)).toBeNull();
    expect(parseNumber('2', 2)).toBeNull();
  });

  it('handles empty and whitespace', () => {
    expect(parseNumber('', 10)).toBeNull();
    expect(parseNumber('  ', 10)).toBeNull();
  });

  it('handles large integers beyond safe integer', () => {
    const result = parseNumber('12345678901234567890', 10);
    expect(result).toEqual({ value: 12345678901234567890n, negative: false });
  });
});

describe('convertNumber', () => {
  it('converts to binary', () => {
    expect(convertNumber(255n, 2)).toBe('11111111');
  });

  it('converts to octal', () => {
    expect(convertNumber(255n, 8)).toBe('377');
  });

  it('converts to decimal', () => {
    expect(convertNumber(0x1A3Fn, 10)).toBe('6719');
  });

  it('converts to hex', () => {
    expect(convertNumber(6719n, 16)).toBe('1a3f');
  });

  it('preserves sign in non-binary bases', () => {
    expect(convertNumber(-255n, 10)).toBe('-255');
    expect(convertNumber(-255n, 16)).toBe('-ff');
  });
});

describe('getBitWidth', () => {
  it('returns 1 for zero', () => {
    expect(getBitWidth(0n, false)).toBe(1);
  });

  it('returns minimum bits for positives', () => {
    expect(getBitWidth(1n, false)).toBe(1);
    expect(getBitWidth(255n, false)).toBe(8);
    expect(getBitWidth(256n, false)).toBe(9);
  });

  it('returns 8-multiple for negatives', () => {
    expect(getBitWidth(-1n, true)).toBe(8);
    expect(getBitWidth(-128n, true)).toBe(8);
    expect(getBitWidth(-129n, true)).toBe(16);
    expect(getBitWidth(-32768n, true)).toBe(16);
    expect(getBitWidth(-32769n, true)).toBe(24);
  });
});

describe('getPreviewBitWidth', () => {
  it('rounds positives up to nibble boundary', () => {
    expect(getPreviewBitWidth(5n, false)).toBe(4);
    expect(getPreviewBitWidth(0x1A3Fn, false)).toBe(16);
    expect(getPreviewBitWidth(0x100n, false)).toBe(12);
  });

  it('keeps negatives at 8-multiple', () => {
    expect(getPreviewBitWidth(-1n, true)).toBe(8);
    expect(getPreviewBitWidth(-255n, true)).toBe(16);
  });
});

describe('toBinaryString', () => {
  it('formats positive numbers', () => {
    expect(toBinaryString(255n, 8)).toBe('11111111');
    expect(toBinaryString(5n, 3)).toBe('101');
  });

  it('formats negative numbers as two\'s complement', () => {
    expect(toBinaryString(-1n, 8)).toBe('11111111');
    expect(toBinaryString(-255n, 16)).toBe('1111111100000001');
  });
});

describe('formatBinaryPreview', () => {
  it('groups by bytes with internal nibble spaces', () => {
    expect(formatBinaryPreview(0x1A3Fn, 16)).toBe('[0001 1010][0011 1111]');
  });

  it('pads positives to nibble boundary', () => {
    expect(formatBinaryPreview(5n, 3)).toBe('[0101]');
  });

  it('handles negative two\'s complement', () => {
    expect(formatBinaryPreview(-1n, 8)).toBe('[1111 1111]');
  });
});

describe('BASE_OPTIONS', () => {
  it('has four bases', () => {
    expect(BASE_OPTIONS.map((o) => o.value)).toEqual([2, 8, 10, 16]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test src/utils/text/__tests__/number-base-converter.test.ts
```

Expected: 测试失败，提示模块或函数未定义。

- [ ] **Step 3: 实现核心转换模块**

创建 `src/utils/text/number-base-converter.ts`：

```ts
/**
 * 进制转换器核心工具模块。
 *
 * 支持二进制、八进制、十进制、十六进制之间的解析与转换，
 * 基于 BigInt 实现任意大整数，负数二进制按补码展示。
 */

/** 支持的进制 */
export type Base = 2 | 8 | 10 | 16;

/** 解析结果 */
export interface ParseResult {
  /** 解析后的有符号数值 */
  value: bigint;
  /** 原始是否为负数 */
  negative: boolean;
}

/** 进制选择项 */
export interface BaseOption {
  value: Base;
  label: string;
}

/** 页面下拉选项 */
export const BASE_OPTIONS: BaseOption[] = [
  { value: 2, label: '二进制' },
  { value: 8, label: '八进制' },
  { value: 10, label: '十进制' },
  { value: 16, label: '十六进制' },
];

/** 进制前缀提示（仅用于展示） */
export const BASE_PREFIX: Record<Base, string> = {
  2: '0b',
  8: '0o',
  10: '',
  16: '0x',
};

/** 各进制允许字符集 */
const BASE_DIGITS: Record<Base, string> = {
  2: '01',
  8: '01234567',
  10: '0123456789',
  16: '0123456789abcdefABCDEF',
};

/**
 * 校验单个字符是否属于指定进制。
 * @param char - 待校验字符
 * @param base - 进制
 * @returns 是否合法
 */
export function isValidDigit(char: string, base: Base): boolean {
  return BASE_DIGITS[base].includes(char);
}

/**
 * 将字符串按指定进制解析为 BigInt。
 *
 * 支持可选前导符号 `+` / `-`，不识别进制前缀。
 * @param input - 输入字符串
 * @param base - 进制
 * @returns 解析结果；无效输入返回 null
 */
export function parseNumber(input: string, base: Base): ParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let negative = false;
  let digits = trimmed;

  if (digits[0] === '+' || digits[0] === '-') {
    negative = digits[0] === '-';
    digits = digits.slice(1);
  }

  if (!digits) return null;

  for (const char of digits) {
    if (!isValidDigit(char, base)) {
      return null;
    }
  }

  const baseBig = BigInt(base);
  let value = 0n;
  for (const char of digits) {
    const digit = BigInt(parseInt(char, base));
    value = value * baseBig + digit;
  }

  return { value: negative ? -value : value, negative };
}

/**
 * 将 BigInt 转换为目标进制字符串。
 *
 * 负数在非二进制进制中保留负号；二进制转换请使用 `toBinaryString`。
 * @param value - 待转换数值
 * @param base - 目标进制
 * @returns 目标进制字符串，小写、无前缀
 */
export function convertNumber(value: bigint, base: Base): string {
  if (value === 0n) return '0';
  if (value < 0n) return `-${(-value).toString(base)}`;
  return value.toString(base);
}

/**
 * 计算数值在二进制预览中应使用的位宽。
 *
 * - 正数：最小位宽，0 返回 1。
 * - 负数：能容纳该补码的最小 8 位倍数。
 * @param value - 数值
 * @param negative - 是否按负数处理
 * @returns 位宽
 */
export function getBitWidth(value: bigint, negative: boolean): number {
  if (!negative) {
    if (value <= 0n) return 1;
    const bits = value.toString(2).length;
    return bits;
  }

  const absValue = -value;
  let n = 8;
  while (absValue > 2n ** BigInt(n - 1)) {
    n += 8;
  }
  return n;
}

/**
 * 生成指定宽度的二进制字符串（负数用补码）。
 * @param value - 数值
 * @param bitWidth - 位宽
 * @returns 二进制字符串
 */
export function toBinaryString(value: bigint, bitWidth: number): string {
  if (value >= 0n) {
    return value.toString(2).padStart(bitWidth, '0');
  }
  const mod = 2n ** BigInt(bitWidth);
  return ((mod + value) % mod).toString(2).padStart(bitWidth, '0');
}

/**
 * 将二进制字符串按 4 位 nibble 分组，每 8 位（2 个 nibble）用中括号包裹。
 *
 * 不足 8 位时仍使用一个中括号；nibble 之间用空格分隔。
 * @param binary - 二进制字符串（仅含 0/1，长度应为 4 的倍数）
 * @returns 可视化位图字符串
 */
export function formatBinaryString(binary: string): string {
  const nibbles: string[] = [];
  for (let i = 0; i < binary.length; i += 4) {
    nibbles.push(binary.slice(i, i + 4));
  }

  const groups: string[] = [];
  for (let i = 0; i < nibbles.length; i += 2) {
    const pair = [nibbles[i], nibbles[i + 1]].filter(Boolean);
    groups.push(`[${pair.join(' ')}]`);
  }

  return groups.join('');
}

/**
 * 计算二进制预览所需的位宽。
 *
 * 正数在最小位宽基础上向上补齐到 4 的倍数，便于按 nibble 分组；
 * 负数仍使用 8 位倍数补码位宽。
 * @param value - 数值
 * @param negative - 是否按负数处理
 * @returns 预览位宽
 */
export function getPreviewBitWidth(value: bigint, negative: boolean): number {
  const minWidth = getBitWidth(value, negative);
  if (negative) return minWidth;
  return Math.ceil(minWidth / 4) * 4;
}

/**
 * 生成二进制预览字符串。
 *
 * 正数会先补齐到 4 的倍数；负数使用给定的补码位宽。
 * @param value - 数值
 * @param bitWidth - 位宽
 * @returns 可视化位图字符串
 */
export function formatBinaryPreview(value: bigint, bitWidth: number): string {
  let binary = toBinaryString(value, bitWidth);
  if (value >= 0n) {
    const padded = Math.ceil(binary.length / 4) * 4;
    binary = binary.padStart(padded, '0');
  }
  return formatBinaryString(binary);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test src/utils/text/__tests__/number-base-converter.test.ts
```

Expected: 所有测试通过。

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/number-base-converter.ts src/utils/text/__tests__/number-base-converter.test.ts
git commit -m "feat(text): 添加进制转换器核心转换函数与单元测试

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Vue 交互组件

**Files:**
- Create: `src/tools/text/NumberBaseConverter.vue`

**Interfaces:**
- Consumes: `parseNumber`, `convertNumber`, `getBitWidth`, `getPreviewBitWidth`, `toBinaryString`, `formatBinaryPreview`, `BASE_OPTIONS`, `Base`, `ParseResult` from `src/utils/text/number-base-converter.ts`
- Produces: `NumberBaseConverter` Vue 组件

- [ ] **Step 1: 实现 Vue 组件**

创建 `src/tools/text/NumberBaseConverter.vue`：

```vue
<script setup lang="ts">
/**
 * 进制转换器交互组件。
 *
 * 支持二/八/十/十六进制批量互转，展示结果表格与逐位二进制预览。
 */
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import { useCopy } from '../../composables/useCopy';
import {
  type Base,
  type ParseResult,
  BASE_OPTIONS,
  parseNumber,
  convertNumber,
  getBitWidth,
  getPreviewBitWidth,
  toBinaryString,
  formatBinaryPreview,
} from '../../utils/text/number-base-converter';

/** 单行解析结果（含错误） */
interface LineResult {
  lineNumber: number;
  raw: string;
  parsed: ParseResult | null;
  error: string;
}

// ---- 状态 ----
const sourceBase = ref<Base>(16);
const inputText = ref('1A3F\n-255\n11001010');
const selectedLine = ref<number | null>(null);

const { copy } = useCopy();

// ---- 解析结果 ----
const lineResults = computed<LineResult[]>(() => {
  const lines = inputText.value.split('\n');
  const results: LineResult[] = [];

  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const parsed = parseNumber(trimmed, sourceBase.value);
    const error = parsed === null ? '包含无效字符，请检查当前进制' : '';

    results.push({
      lineNumber: index + 1,
      raw: trimmed,
      parsed,
      error,
    });
  });

  return results;
});

const validResults = computed(() => lineResults.value.filter((r) => r.parsed !== null));
const hasErrors = computed(() => lineResults.value.some((r) => r.error));

const selectedResult = computed(() => {
  if (selectedLine.value === null) return null;
  return validResults.value.find((r) => r.lineNumber === selectedLine.value) ?? null;
});

// ---- 操作 ----
function handleBaseChange(): void {
  selectedLine.value = null;
}

function handleClear(): void {
  inputText.value = '';
  selectedLine.value = null;
}

function selectLine(lineNumber: number): void {
  selectedLine.value = selectedLine.value === lineNumber ? null : lineNumber;
}

function buildCopyText(): string {
  return validResults.value
    .map((r) => {
      const v = r.parsed!.value;
      return `${r.raw} = 二进制 ${convertNumber(v, 2)} / 八进制 ${convertNumber(v, 8)} / 十进制 ${convertNumber(v, 10)} / 十六进制 ${convertNumber(v, 16)}`;
    })
    .join('\n');
}

async function handleCopyAll(): Promise<void> {
  const text = buildCopyText();
  if (!text) return;
  await copy(text);
}

// ---- 二进制显示 ----
function binaryColumnValue(value: bigint, negative: boolean): string {
  return toBinaryString(value, getBitWidth(value, negative));
}

function binaryPreviewValue(value: bigint, negative: boolean): string {
  return formatBinaryPreview(value, getPreviewBitWidth(value, negative));
}

// ---- 监听 ----
watch(inputText, () => {
  selectedLine.value = null;
});
watch(sourceBase, handleBaseChange);
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="进制转换器"
      description="二进制、八进制、十进制、十六进制批量互转，支持大整数与负数补码二进制预览。"
      :show-example="false"
    />

    <!-- 输入区 -->
    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <SelectListbox
        v-model="sourceBase"
        label="输入进制"
        :options="BASE_OPTIONS"
      />

      <div>
        <label class="block text-[0.8125rem] text-muted mb-1.5">输入数字（每行一个）</label>
        <textarea
          v-model="inputText"
          rows="6"
          class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent resize-y"
          placeholder="在此逐行输入数字..."
        />
        <p v-if="hasErrors" class="mt-1.5 text-xs text-error">部分行包含无效字符，请检查当前进制。</p>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
          @click="handleClear"
        >
          清空
        </button>
        <button
          type="button"
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="validResults.length === 0"
          @click="handleCopyAll"
        >
          复制全部结果
        </button>
      </div>
    </div>

    <!-- 结果表格 -->
    <div class="border border-border rounded-md bg-card mt-6 overflow-hidden">
      <div
        v-if="lineResults.length === 0"
        class="min-h-[120px] flex items-center justify-center text-muted text-sm"
      >
        输入数字后将自动显示转换结果
      </div>

      <table v-else class="w-full text-left text-sm">
        <thead class="bg-surface border-b border-border sticky top-0">
          <tr>
            <th class="px-4 py-2 text-xs text-muted font-medium w-14">行号</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">二进制</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">八进制</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">十进制</th>
            <th class="px-4 py-2 text-xs text-muted font-medium">十六进制</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="result in lineResults"
            :key="result.lineNumber"
            class="border-b border-border last:border-b-0 cursor-pointer hover:bg-hover transition-colors duration-150"
            :class="selectedLine === result.lineNumber ? 'bg-hover' : ''"
            @click="selectLine(result.lineNumber)"
          >
            <td class="px-4 py-2 text-xs text-muted">{{ result.lineNumber }}</td>
            <td
              v-if="result.parsed"
              class="px-4 py-2 font-mono text-text break-all"
            >
              {{ binaryColumnValue(result.parsed.value, result.parsed.negative) }}
            </td>
            <td v-else colspan="4" class="px-4 py-2 text-error text-xs">
              {{ result.error }}
            </td>
            <template v-if="result.parsed">
              <td class="px-4 py-2 font-mono text-text break-all">{{ convertNumber(result.parsed.value, 8) }}</td>
              <td class="px-4 py-2 font-mono text-text break-all">{{ convertNumber(result.parsed.value, 10) }}</td>
              <td class="px-4 py-2 font-mono text-text break-all">{{ convertNumber(result.parsed.value, 16) }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 二进制位图预览 -->
    <div
      v-if="selectedResult"
      class="border border-border rounded-md p-6 bg-card mt-4"
    >
      <h2 class="text-sm font-semibold text-text mb-3">
        第 {{ selectedResult.lineNumber }} 行二进制位图
      </h2>
      <div class="font-mono text-sm text-text break-all leading-relaxed">
        {{ binaryPreviewValue(selectedResult.parsed.value, selectedResult.parsed.negative) }}
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 提交**

```bash
git add src/tools/text/NumberBaseConverter.vue
git commit -m "feat(text): 添加进制转换器 Vue 交互组件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Astro 页面壳

**Files:**
- Create: `src/pages/text/number-base-converter.astro`

**Interfaces:**
- Consumes: `NumberBaseConverter` Vue component
- Produces: `/text/number-base-converter` 页面

- [ ] **Step 1: 创建页面**

创建 `src/pages/text/number-base-converter.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import NumberBaseConverter from '../../tools/text/NumberBaseConverter.vue';
---

<ToolLayout toolId="text/number-base-converter">
  <NumberBaseConverter client:idle />
</ToolLayout>
```

- [ ] **Step 2: 提交**

```bash
git add src/pages/text/number-base-converter.astro
git commit -m "feat(text): 添加进制转换器 Astro 页面

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 注册工具元数据

**Files:**
- Modify: `src/data/tools.ts`

**Interfaces:**
- Consumes: 无
- Produces: `number-base-converter` 工具注册项

- [ ] **Step 1: 在 tools.ts 中添加注册项**

在 `src/data/tools.ts` 的 `text` 分类区域（random-string / uuid-generator 附近）插入：

```ts
  {
    id: 'number-base-converter',
    name: '进制转换器',
    description: '二进制、八进制、十进制、十六进制批量互转，支持大整数与补码二进制预览',
    seoDescription: '免费在线进制转换工具，支持二进制、八进制、十进制、十六进制批量互转，基于 BigInt 处理任意大整数与负数补码，并提供逐位二进制位图预览，前端开发与协议调试必备，纯浏览器端运算数据绝不上传。',
    category: '文本处理',
    icon: '🔢',
    path: '/text/number-base-converter',
    keywords: ['进制转换', '二进制转十六进制', '八进制转十进制', '十进制转二进制', 'BigInt', '补码', 'hex转binary', '进制互转'],
    relatedToolIds: ['random-string', 'uuid-generator'],
  },
```

- [ ] **Step 2: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat(text): 注册进制转换器工具元数据

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 添加 FAQ

**Files:**
- Modify: `src/data/tool-faqs.ts`

**Interfaces:**
- Consumes: 无
- Produces: `number-base-converter` FAQ 条目

- [ ] **Step 1: 在 tool-faqs.ts 中添加 FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中添加 `number-base-converter` 键：

```ts
  'number-base-converter': [
    {
      question: '为什么能支持非常大的数字？',
      answer: '本工具使用 JavaScript 原生的 <code>BigInt</code> 类型进行计算，不受 <code>Number.MAX_SAFE_INTEGER</code>（约 9 × 10<sup>15</sup>）限制，可处理上百位的大整数转换。',
    },
    {
      question: '负数的二进制是怎么显示的？',
      answer: '负数的二进制按<strong>补码</strong>展示。自动位宽规则为：找到能容纳该负数的最小 8 位倍数位宽。例如 <code>-1</code> 显示为 8 位 <code>11111111</code>，<code>-255</code> 需要 16 位 <code>1111111100000001</code>。',
    },
    {
      question: '输入十六进制时需要写 0x 前缀吗？',
      answer: '不需要。本工具在输入框上方已通过下拉菜单指定了进制，直接输入数字即可，例如 <code>1A3F</code>。输出也默认不带 <code>0x</code> 前缀，方便直接复制使用。',
    },
    {
      question: '二进制位图中的中括号是什么意思？',
      answer: '中括号表示一个字节（8 位），内部按 4 位（一个 nibble）用空格分隔。这样便于把二进制与十六进制逐字节对照，例如 <code>[0001 1010][0011 1111]</code> 对应 <code>0x1A3F</code>。',
    },
  ],
```

- [ ] **Step 2: 提交**

```bash
git add src/data/tool-faqs.ts
git commit -m "feat(text): 添加进制转换器 FAQ

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 最终验证

**Files:**
- 无新增文件

**Interfaces:**
- Consumes: 全部已创建文件
- Produces: 通过测试与构建验证

- [ ] **Step 1: 运行单元测试**

```bash
pnpm test src/utils/text/__tests__/number-base-converter.test.ts
```

Expected: 所有测试通过。

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
pnpm astro check
```

Expected: 无类型错误。

- [ ] **Step 3: 运行生产构建**

```bash
pnpm build
```

Expected: 构建成功，无报错。

- [ ] **Step 4: 更新 ROADMAP.md（如需要）**

如果本工具完成后需要同步路线图，在 `docs/ROADMAP.md` 的 P2 进度追踪中将「文本处理：进制转换器」勾选，并注明完成日期 2026-06-18。

```markdown
- [x] 文本处理：进制转换器 — 已完成（2026-06-18）。新建 `/text/number-base-converter`，支持 2/8/10/16 进制批量互转、BigInt 大整数、负数补码与逐位二进制预览；配套 4 条 FAQ
```

- [ ] **Step 5: 提交路线图更新（如执行了 Step 4）**

```bash
git add docs/ROADMAP.md
git commit -m "docs: 更新进制转换器完成状态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 自评检查

| 设计文档要求 | 对应任务 |
|--------------|----------|
| 2/8/10/16 进制互转 | Task 1 |
| 批量多行输入 | Task 2 |
| 逐位二进制预览 | Task 1 + Task 2 |
| BigInt 大整数 | Task 1 |
| 负数补码 | Task 1 |
| 自动位宽 | Task 1 |
| 清空/复制结果按钮 | Task 2 |
| 注册 tools.ts + SEO | Task 4 |
| FAQ | Task 5 |
| 单元测试 | Task 1 |

未发现占位符或类型不一致问题。
