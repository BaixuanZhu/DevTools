# CSS 单位转换器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `/css/unit-converter` 页面，支持 px / rem / em / vw / vh / % / pt 七种 CSS 长度单位实时互转，并注册到 `/css` 新分类。

**Architecture:** 纯函数工具库 `src/utils/css/unit-converter.ts` 负责以 px 为中间单位的所有转换；Vue 组件维护主从联动状态；Astro 页面仅作为壳；`src/data/tools.ts` 新建 `CSS 工具` 分类并注册本工具。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript + Tailwind CSS v4 + Vitest

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/css/unit-converter.ts` | 单位转换纯函数：任意单位 → px → 其他单位；格式化输出 |
| `src/utils/css/__tests__/unit-converter.test.ts` | 转换逻辑单元测试 |
| `src/tools/css/CssUnitConverter.vue` | 单位转换器交互组件 |
| `src/pages/css/unit-converter.astro` | `/css/unit-converter` 路由页面壳 |
| `src/data/tools.ts` | 新建 `CSS 工具` 分类，注册 `css/unit-converter` |
| `src/data/tool-faqs.ts` | 添加 2 条 FAQ |

---

## Task 1: Create unit conversion utility

**Files:**
- Create: `src/utils/css/unit-converter.ts`

- [ ] **Step 1: Write the utility module**

```ts
/**
 * CSS 长度单位转换工具模块。
 *
 * 以 px 为中间单位，实现 px / rem / em / vw / vh / % / pt 的实时互转。
 * 所有函数均为纯函数，可独立单元测试。
 */

/** 支持的单位键 */
export type UnitKey = 'px' | 'rem' | 'em' | 'vw' | 'vh' | 'pct' | 'pt';

/** 单位显示标签 */
export const UNIT_LABELS: Record<UnitKey, string> = {
  px: 'px',
  rem: 'rem',
  em: 'em',
  vw: 'vw',
  vh: 'vh',
  pct: '%',
  pt: 'pt',
};

/** 单位顺序（页面展示用） */
export const UNIT_ORDER: UnitKey[] = ['px', 'rem', 'em', 'vw', 'vh', 'pct', 'pt'];

/** 将任意单位的值转换为 px */
export function toPx(
  value: number,
  unit: UnitKey,
  context: {
    rootFontSize: number;
    designWidth: number;
    viewportHeight: number;
  }
): number {
  switch (unit) {
    case 'px':
      return value;
    case 'rem':
    case 'em':
      return value * context.rootFontSize;
    case 'vw':
      return (value * context.designWidth) / 100;
    case 'vh':
      return (value * context.viewportHeight) / 100;
    case 'pct':
      return (value * context.rootFontSize) / 100;
    case 'pt':
      return value / 0.75;
    default:
      return value;
  }
}

/** 将 px 转换为目标单位 */
export function fromPx(
  px: number,
  unit: UnitKey,
  context: {
    rootFontSize: number;
    designWidth: number;
    viewportHeight: number;
  }
): number {
  switch (unit) {
    case 'px':
      return px;
    case 'rem':
    case 'em':
      return px / context.rootFontSize;
    case 'vw':
      return (px / context.designWidth) * 100;
    case 'vh':
      return (px / context.viewportHeight) * 100;
    case 'pct':
      return (px / context.rootFontSize) * 100;
    case 'pt':
      return px * 0.75;
    default:
      return px;
  }
}

/** 根据最后编辑的单位，计算所有单位的值 */
export function convertAll(
  sourceValue: number,
  sourceUnit: UnitKey,
  context: {
    rootFontSize: number;
    designWidth: number;
    viewportHeight: number;
  }
): Record<UnitKey, number> {
  const px = toPx(sourceValue, sourceUnit, context);
  const result = {} as Record<UnitKey, number>;
  for (const unit of UNIT_ORDER) {
    result[unit] = fromPx(px, unit, context);
  }
  return result;
}

/** 将数值格式化为最多 4 位有效数字，去掉末尾 0 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toPrecision(4);
  // 去掉末尾多余的 0 和小数点
  return s.replace(/\.?0+$/, '');
}

/** 校验输入字符串是否为有效正数 */
export function isValidNumberInput(input: string): boolean {
  if (!input || input.trim() === '') return false;
  const num = Number(input);
  return Number.isFinite(num) && num >= 0;
}

/** 生成「复制全部结果」的文本 */
export function buildCopyText(
  values: Record<UnitKey, string>,
  sourceUnit: UnitKey
): string {
  const sourceValue = values[sourceUnit];
  const lines: string[] = [];
  for (const unit of UNIT_ORDER) {
    if (unit === sourceUnit) continue;
    const value = values[unit];
    if (value === '' || value === '—') continue;
    lines.push(`${sourceValue}${UNIT_LABELS[sourceUnit]} = ${value}${UNIT_LABELS[unit]}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 2: Commit the utility**

```bash
git add src/utils/css/unit-converter.ts
git commit -m "feat(css): 添加 CSS 单位转换核心函数

支持 px/rem/em/vw/vh/%/pt 以 px 为中间单位互转"
```

---

## Task 2: Write unit tests

**Files:**
- Create: `src/utils/css/__tests__/unit-converter.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
/**
 * CSS 单位转换单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  toPx,
  fromPx,
  convertAll,
  formatNumber,
  isValidNumberInput,
  buildCopyText,
  type UnitKey,
} from '../unit-converter';

const DEFAULT_CONTEXT = {
  rootFontSize: 16,
  designWidth: 375,
  viewportHeight: 812,
};

describe('toPx', () => {
  it('px 转 px 不变', () => {
    expect(toPx(16, 'px', DEFAULT_CONTEXT)).toBe(16);
  });

  it('rem 转 px', () => {
    expect(toPx(1, 'rem', DEFAULT_CONTEXT)).toBe(16);
  });

  it('em 按根 em 语义处理', () => {
    expect(toPx(1, 'em', DEFAULT_CONTEXT)).toBe(16);
  });

  it('vw 转 px', () => {
    expect(toPx(4.2667, 'vw', DEFAULT_CONTEXT)).toBeCloseTo(16, 3);
  });

  it('vh 转 px', () => {
    expect(toPx(1.9704, 'vh', DEFAULT_CONTEXT)).toBeCloseTo(16, 3);
  });

  it('% 转 px', () => {
    expect(toPx(100, 'pct', DEFAULT_CONTEXT)).toBe(16);
  });

  it('pt 转 px', () => {
    expect(toPx(12, 'pt', DEFAULT_CONTEXT)).toBe(16);
  });
});

describe('fromPx', () => {
  it('px 不变', () => {
    expect(fromPx(16, 'px', DEFAULT_CONTEXT)).toBe(16);
  });

  it('px 转 rem', () => {
    expect(fromPx(16, 'rem', DEFAULT_CONTEXT)).toBe(1);
  });

  it('px 转 vw', () => {
    expect(fromPx(16, 'vw', DEFAULT_CONTEXT)).toBeCloseTo(4.2667, 3);
  });

  it('px 转 pt', () => {
    expect(fromPx(16, 'pt', DEFAULT_CONTEXT)).toBe(12);
  });
});

describe('convertAll', () => {
  it('以 px 为源计算全部单位', () => {
    const result = convertAll(16, 'px', DEFAULT_CONTEXT);
    expect(result.px).toBe(16);
    expect(result.rem).toBe(1);
    expect(result.em).toBe(1);
    expect(result.vw).toBeCloseTo(4.2667, 3);
    expect(result.vh).toBeCloseTo(1.9704, 3);
    expect(result.pct).toBe(100);
    expect(result.pt).toBe(12);
  });

  it('以 rem 为源计算全部单位', () => {
    const result = convertAll(1, 'rem', DEFAULT_CONTEXT);
    expect(result.px).toBe(16);
    expect(result.rem).toBe(1);
  });
});

describe('formatNumber', () => {
  it('保留最多 4 位有效数字并去 0', () => {
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(1.23456)).toBe('1.235');
    expect(formatNumber(4.266666)).toBe('4.267');
    expect(formatNumber(0)).toBe('0');
  });

  it('非有限值返回 —', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
  });
});

describe('isValidNumberInput', () => {
  it('有效非负数通过', () => {
    expect(isValidNumberInput('16')).toBe(true);
    expect(isValidNumberInput('0')).toBe(true);
    expect(isValidNumberInput('4.5')).toBe(true);
  });

  it('空字符串 / 非数字 / 负数不通过', () => {
    expect(isValidNumberInput('')).toBe(false);
    expect(isValidNumberInput('  ')).toBe(false);
    expect(isValidNumberInput('abc')).toBe(false);
    expect(isValidNumberInput('-1')).toBe(false);
  });
});

describe('buildCopyText', () => {
  it('生成多行转换结果', () => {
    const values = {
      px: '16',
      rem: '1',
      em: '1',
      vw: '4.2667',
      vh: '1.9704',
      pct: '100',
      pt: '12',
    };
    const text = buildCopyText(values, 'px' as UnitKey);
    expect(text).toContain('16px = 1rem');
    expect(text).toContain('16px = 4.2667vw');
    expect(text).not.toContain('16px = 16px');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
pnpm test src/utils/css/__tests__/unit-converter.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit tests**

```bash
git add src/utils/css/__tests__/unit-converter.test.ts
git commit -m "test(css): 添加 CSS 单位转换单元测试"
```

---

## Task 3: Create the Vue component

**Files:**
- Create: `src/tools/css/CssUnitConverter.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
/**
 * CSS 单位转换器交互组件。
 *
 * 支持 px / rem / em / vw / vh / % / pt 七种单位实时互转。
 * 修改任意输入框时，该单位成为计算源，其余单位实时联动更新。
 */
import { ref, reactive, computed, watch, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import { useCopy } from '../../composables/useCopy';
import {
  UNIT_ORDER,
  UNIT_LABELS,
  convertAll,
  formatNumber,
  isValidNumberInput,
  buildCopyText,
  type UnitKey,
} from '../../utils/css/unit-converter';

// ---- 常量 ----

/** 默认值：16px */
const DEFAULT_SOURCE_UNIT: UnitKey = 'px';
const DEFAULT_SOURCE_VALUE = '16';

// ---- 状态 ----

const rootFontSize = ref(16);
const designWidth = ref(375);
const viewportHeight = ref(812);
const lastEditedUnit = ref<UnitKey>(DEFAULT_SOURCE_UNIT);
const values = reactive<Record<UnitKey, string>>({
  px: '16',
  rem: '1',
  em: '1',
  vw: '4.2667',
  vh: '1.9704',
  pct: '100',
  pt: '12',
});
const errors = reactive<Partial<Record<UnitKey, string>>>({});
const baseErrors = reactive({
  rootFontSize: '',
  designWidth: '',
  viewportHeight: '',
});

const { copy } = useCopy();

// ---- 派生 ----

const context = computed(() => ({
  rootFontSize: rootFontSize.value,
  designWidth: designWidth.value,
  viewportHeight: viewportHeight.value,
}));

const copyText = computed(() => buildCopyText(values, lastEditedUnit.value));

// ---- 核心逻辑 ----

function recalculateAll(): void {
  const sourceValueStr = values[lastEditedUnit.value];
  if (!isValidNumberInput(sourceValueStr)) {
    errors[lastEditedUnit.value] = '请输入有效数字';
    for (const unit of UNIT_ORDER) {
      if (unit !== lastEditedUnit.value) {
        values[unit] = '—';
      }
    }
    return;
  }

  errors[lastEditedUnit.value] = '';
  const sourceValue = Number(sourceValueStr);
  const result = convertAll(sourceValue, lastEditedUnit.value, context.value);
  for (const unit of UNIT_ORDER) {
    if (unit === lastEditedUnit.value) continue;
    values[unit] = formatNumber(result[unit]);
  }
}

function handleInput(unit: UnitKey, event: Event): void {
  const target = event.target as HTMLInputElement;
  values[unit] = target.value;
  lastEditedUnit.value = unit;
  recalculateAll();
}

function validateBase(): boolean {
  let ok = true;
  baseErrors.rootFontSize =
    rootFontSize.value > 0 ? '' : '根字号必须大于 0';
  baseErrors.designWidth =
    designWidth.value > 0 ? '' : '设计稿宽度必须大于 0';
  baseErrors.viewportHeight =
    viewportHeight.value > 0 ? '' : '视口高度必须大于 0';
  ok = !baseErrors.rootFontSize && !baseErrors.designWidth && !baseErrors.viewportHeight;
  return ok;
}

function handleBaseInput(): void {
  if (!validateBase()) {
    for (const unit of UNIT_ORDER) {
      values[unit] = '—';
    }
    return;
  }
  recalculateAll();
}

function handleClear(): void {
  lastEditedUnit.value = DEFAULT_SOURCE_UNIT;
  values.px = '';
  values.rem = '';
  values.em = '';
  values.vw = '';
  values.vh = '';
  values.pct = '';
  values.pt = '';
  for (const unit of UNIT_ORDER) {
    errors[unit] = '';
  }
}

async function handleCopyAll(): Promise<void> {
  await copy(copyText.value);
}

// ---- 初始化 ----

watch(context, handleBaseInput, { deep: true });

onMounted(() => {
  recalculateAll();
});
</script>

<template>
  <div>
    <ToolHeader
      title="CSS 单位转换器"
      description="px / rem / em / vw / vh / % / pt 实时互转，支持自定义根字号、设计稿宽度与视口高度。"
      :show-example="false"
    />

    <!-- 基准设置 -->
    <section class="mb-6 p-4 border border-border rounded-sm bg-card">
      <h2 class="text-sm font-semibold text-text mb-4">基准设置</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs text-muted mb-1.5">根字号（px）</label>
          <input
            v-model.number="rootFontSize"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            @input="handleBaseInput"
          />
          <p v-if="baseErrors.rootFontSize" class="mt-1.5 text-xs text-error">{{ baseErrors.rootFontSize }}</p>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1.5">设计稿宽度（px）</label>
          <input
            v-model.number="designWidth"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            @input="handleBaseInput"
          />
          <p v-if="baseErrors.designWidth" class="mt-1.5 text-xs text-error">{{ baseErrors.designWidth }}</p>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1.5">视口高度（px）</label>
          <input
            v-model.number="viewportHeight"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            @input="handleBaseInput"
          />
          <p v-if="baseErrors.viewportHeight" class="mt-1.5 text-xs text-error">{{ baseErrors.viewportHeight }}</p>
        </div>
      </div>
    </section>

    <!-- 转换输入 -->
    <section class="mb-6">
      <h2 class="text-sm font-semibold text-text mb-4">转换输入（修改任意一项，其余自动联动）</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="unit in UNIT_ORDER"
          :key="unit"
          class="p-3 border rounded-sm transition-colors duration-150"
          :class="lastEditedUnit === unit ? 'border-accent bg-accent/5' : 'border-border bg-card'"
        >
          <label class="block text-xs text-muted mb-1.5">{{ UNIT_LABELS[unit] }}</label>
          <input
            :value="values[unit]"
            type="text"
            inputmode="decimal"
            class="w-full px-3 py-2 border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            :class="errors[unit] ? 'border-error' : 'border-border'"
            @input="handleInput(unit, $event)"
          />
          <p v-if="errors[unit]" class="mt-1.5 text-xs text-error">{{ errors[unit] }}</p>
        </div>
      </div>
    </section>

    <!-- 操作栏 -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
        @click="handleClear"
      >
        清空
      </button>
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
        :disabled="!copyText"
        @click="handleCopyAll"
      >
        复制全部结果
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit the component**

```bash
git add src/tools/css/CssUnitConverter.vue
git commit -m "feat(css): 添加 CSS 单位转换器 Vue 组件"
```

---

## Task 4: Create the Astro page

**Files:**
- Create: `src/pages/css/unit-converter.astro`
- Create directory: `src/pages/css/`

- [ ] **Step 1: Create the page**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import CssUnitConverter from '../../tools/css/CssUnitConverter.vue';
---

<ToolLayout toolId="css/unit-converter">
  <CssUnitConverter client:idle />
</ToolLayout>
```

- [ ] **Step 2: Commit the page**

```bash
mkdir -p src/pages/css
git add src/pages/css/unit-converter.astro
git commit -m "feat(css): 添加 CSS 单位转换器页面路由"
```

---

## Task 5: Register category and tool

**Files:**
- Modify: `src/data/tools.ts`

- [ ] **Step 1: Confirm category exists in type and slug map**

`src/data/tools.ts` 中应已包含：

```ts
export type ToolCategory =
  | '编码转换'
  | '加密哈希'
  | '格式化'
  | '文本处理'
  | '正则工具'
  | '网络工具'
  | '颜色工具'
  | '日期时间'
  | 'CSS 工具'
  | 'API 工具'
  | '媒体工具'
  | '编辑器'
  | 'DevOps 工具';
```

以及：

```ts
export const categorySlugMap: Record<ToolCategory, string> = {
  // ...
  'CSS 工具': 'css',
  // ...
};
```

如果 `CSS 工具` 已存在则跳过；如果不存在，添加到 `ToolCategory` union 和 `categorySlugMap` 中。

- [ ] **Step 2: Add tool registration**

在 `tools` 数组中新增一项（位置放在 `颜色工具` 之后或其他合适位置）：

```ts
{
  id: 'unit-converter',
  name: 'CSS 单位转换器',
  description: 'px / rem / em / vw / vh / % / pt 等 CSS 长度单位实时互转',
  seoDescription: '在线 CSS 单位转换工具，支持 px、rem、em、vw、vh、百分比、pt 实时互转，可自定义根字号与设计稿宽度，前端开发常用换算助手。',
  category: 'CSS 工具',
  icon: '📐',
  path: '/css/unit-converter',
  keywords: ['px转rem', 'rem转px', 'vw换算', 'vh换算', 'css单位转换', 'em换算', 'pt换算', '前端单位转换'],
  relatedToolIds: ['gradient'],
},
```

- [ ] **Step 3: Commit registration**

```bash
git add src/data/tools.ts
git commit -m "feat(css): 注册 CSS 单位转换器工具并启用 CSS 工具分类"
```

---

## Task 6: Add FAQs

**Files:**
- Modify: `src/data/tool-faqs.ts`

- [ ] **Step 1: Add FAQ entries**

在 `toolFaqs` 对象中新增：

```ts
'unit-converter': [
  {
    question: 'em 和 rem 有什么区别？',
    answer: '本工具按根 em 语义处理（<code>em === rem</code>）。实际项目中 <code>em</code> 可能相对于父元素字体大小，而 <code>rem</code> 始终相对于根元素（html）字体大小。',
  },
  {
    question: 'vw 和 vh 基于什么尺寸计算？',
    answer: '基于页面顶部填写的「设计稿宽度」和「视口高度」，默认分别为 375px 和 812px。例如 16px 在 375px 宽度下约为 4.267vw。',
  },
],
```

- [ ] **Step 2: Commit FAQs**

```bash
git add src/data/tool-faqs.ts
git commit -m "docs(css): 添加 CSS 单位转换器 FAQ"
```

---

## Task 7: Verify and run

- [ ] **Step 1: Run unit tests**

```bash
pnpm test src/utils/css/__tests__/unit-converter.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Type check**

```bash
pnpm astro check
```

Expected: no TypeScript errors.

- [ ] **Step 3: Start dev server and smoke test**

```bash
pnpm dev
```

Open `http://localhost:4321/css/unit-converter` and verify:
- Default shows 16px → 1rem / 1em / 4.2667vw / etc.
- Editing any unit updates the others.
- Invalid input shows Chinese error message.
- "清空" resets all fields.
- "复制全部结果" copies multi-line text.

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Expected: build succeeds with no errors.

---

## Self-Review Checklist

- [x] Spec coverage: 单位转换、七种单位、主从联动、复制全部、FAQ、注册表均已覆盖。
- [x] Placeholder scan: 无 TBD/TODO/"后续实现" 等占位符。
- [x] Type consistency: `UnitKey` 在工具函数和组件中一致；`convertAll` 返回 `Record<UnitKey, number>`。
