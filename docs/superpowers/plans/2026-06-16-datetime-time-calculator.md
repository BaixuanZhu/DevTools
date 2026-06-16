# 时间差与倒计时计算器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 datetime 分类下新增独立工具 `/datetime/time-calculator`，提供两个时间点的时间差计算与对未来时刻的实时倒计时。

**Architecture:** 扩展 `src/utils/datetime/datetime.ts` 新增 3 个纯函数（解析 / 拆解 / 格式化）并以 TDD 覆盖；新增单组件 `TimeCalculator.vue`，上下分区堆叠「时间差」与「倒计时」两个 section（不用 Tab）；倒计时由 `setInterval` 每秒驱动，复用同一拆解函数；toast 走现有 `document.dispatchEvent(CustomEvent('toast'))` 通道。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、dayjs（已装，datetime.ts 已 extend utc/timezone/relativeTime/customParseFormat）、Tailwind v4、vitest（`pnpm test` = `vitest run`）。

**Spec:** `docs/superpowers/specs/2026-06-16-datetime-time-calculator-design.md`

---

## 文件结构总览

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/utils/datetime/datetime.ts` | 修改 | 新增 `parseFlexibleTimeInput` / `computeDuration` / `formatDurationParts` + `Duration` 接口 |
| `src/utils/datetime/__tests__/time-diff.test.ts` | 新建 | 上述纯函数单测 |
| `src/data/tools.ts` | 修改 | 注册 `time-calculator` 工具元数据 |
| `src/data/tool-faqs.ts` | 修改 | 添加 `time-calculator` 的 3 条 FAQ |
| `src/pages/datetime/time-calculator.astro` | 新建 | 路由页（ToolLayout + 组件 `client:idle`） |
| `src/tools/datetime/TimeCalculator.vue` | 新建 | 时间差 + 倒计时双 section 交互组件 |

复用：`detectTimestampUnit` / `parseDateInput`（datetime.ts 已有）；`ToolHeader` / `CopyButton` / `ClearButton`（现有 UI 组件）。

---

## Task 1: 纯函数 `parseFlexibleTimeInput`（TDD）

**Files:**
- Create: `src/utils/datetime/__tests__/time-diff.test.ts`
- Modify: `src/utils/datetime/datetime.ts`（在文件末尾追加导出函数）

- [ ] **Step 1: 写失败测试**

创建 `src/utils/datetime/__tests__/time-diff.test.ts`：

```ts
/**
 * 时间差 / 倒计时相关纯函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  parseFlexibleTimeInput,
  computeDuration,
  formatDurationParts,
} from '../datetime';

describe('parseFlexibleTimeInput', () => {
  it('解析 10 位秒级时间戳', () => {
    expect(parseFlexibleTimeInput('1700000000')).toBe(1700000000000);
  });

  it('解析 13 位毫秒级时间戳', () => {
    expect(parseFlexibleTimeInput('1700000000000')).toBe(1700000000000);
  });

  it('解析标准日期 yyyy/MM/dd HH:mm:ss', () => {
    const expected = dayjs('2026/06/16 12:00:00', 'YYYY/MM/DD HH:mm:ss').valueOf();
    expect(parseFlexibleTimeInput('2026/06/16 12:00:00')).toBe(expected);
  });

  it('容忍首尾空白', () => {
    expect(parseFlexibleTimeInput('  1700000000  ')).toBe(1700000000000);
  });

  it('空字符串返回 null', () => {
    expect(parseFlexibleTimeInput('')).toBeNull();
    expect(parseFlexibleTimeInput('   ')).toBeNull();
  });

  it('非法输入返回 null', () => {
    expect(parseFlexibleTimeInput('hello')).toBeNull();
    expect(parseFlexibleTimeInput('2026-06-16')).toBeNull();
  });
});

// computeDuration / formatDurationParts 的测试见 Task 2 补充
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/utils/datetime/__tests__/time-diff.test.ts`
Expected: FAIL — `parseFlexibleTimeInput is not a function`（导入的符号尚不存在）

- [ ] **Step 3: 实现 `parseFlexibleTimeInput`**

在 `src/utils/datetime/datetime.ts` 文件**末尾**（`getLiveClockInfo` 函数之后）追加：

```ts
/**
 * 灵活解析时间输入：接受 Unix 时间戳（秒/毫秒）或 `yyyy/MM/dd HH:mm:ss` 日期。
 *
 * 解析顺序：先按纯数字判定时间戳（复用 detectTimestampUnit），再尝试标准日期格式
 * （复用 parseDateInput）。两者互斥，无需额外分支。
 *
 * @param input 用户输入字符串
 * @returns 解析成功返回毫秒时间戳，空串或无法识别返回 null
 */
export function parseFlexibleTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const unit = detectTimestampUnit(trimmed);
  if (unit) {
    const num = Number(trimmed);
    return unit === 's' ? num * 1000 : num;
  }
  const info = parseDateInput(trimmed);
  return info ? info.unixMillis : null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/utils/datetime/__tests__/time-diff.test.ts`
Expected: PASS — `parseFlexibleTimeInput` 的 6 个用例全过（computeDuration/formatDurationParts 因未实现仍报错属正常，整个文件此时可能因 import 失败而全部失败——见 Step 3 说明：本 Task 先不 import 这两者，Task 2 再补；若 vitest 因 import 未定义符号报错，可临时在 Step 1 的 import 中只保留 `parseFlexibleTimeInput`，Task 2 再加回另两个）。

> 说明：为避免 import 未定义符号导致整个测试文件无法加载，本 Task 的 Step 1 测试文件 import 仅写 `parseFlexibleTimeInput`。Task 2 实现完另两个函数后再把 `computeDuration, formatDurationParts` 加回 import 并补测试。

- [ ] **Step 5: 提交**

```bash
git add src/utils/datetime/datetime.ts src/utils/datetime/__tests__/time-diff.test.ts
git commit -m "feat(datetime): add parseFlexibleTimeInput with tests" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 纯函数 `computeDuration` + `formatDurationParts`（TDD）

**Files:**
- Modify: `src/utils/datetime/__tests__/time-diff.test.ts`（补 import 与测试）
- Modify: `src/utils/datetime/datetime.ts`（追加接口与函数）

- [ ] **Step 1: 补全 import 与失败测试**

将 `time-diff.test.ts` 顶部的 import 改为包含三个函数（已是 Task 1 Step 1 的目标形态，确认 import 行为）：

```ts
import {
  parseFlexibleTimeInput,
  computeDuration,
  formatDurationParts,
} from '../datetime';
```

在文件末尾追加：

```ts
describe('computeDuration', () => {
  it('相同时间 sign 为 0', () => {
    const d = computeDuration(1000, 1000);
    expect(d.sign).toBe(0);
    expect(d.totalSeconds).toBe(0);
  });

  it('a 晚于 b 时 sign 为 1', () => {
    expect(computeDuration(2000, 1000).sign).toBe(1);
  });

  it('a 早于 b 时 sign 为 -1', () => {
    expect(computeDuration(1000, 2000).sign).toBe(-1);
  });

  it('正确拆解天/时/分/秒', () => {
    // 1天2时3分4秒 = 86400 + 7200 + 180 + 4 = 93784 秒
    const d = computeDuration(93784000, 0);
    expect(d).toMatchObject({ days: 1, hours: 2, minutes: 3, seconds: 4 });
    expect(d.totalSeconds).toBe(93784);
  });

  it('忽略毫秒部分（向下取整）', () => {
    const d = computeDuration(1500, 0);
    expect(d.seconds).toBe(1);
    expect(d.totalSeconds).toBe(1);
  });

  it('sign 取决于方向，拆解值始终为绝对值', () => {
    const d = computeDuration(0, 93784000);
    expect(d.sign).toBe(-1);
    expect(d.days).toBe(1);
    expect(d.hours).toBe(2);
  });
});

describe('formatDurationParts', () => {
  it('全 0 返回 0秒', () => {
    expect(formatDurationParts(computeDuration(0, 0))).toBe('0秒');
  });

  it('仅秒', () => {
    expect(formatDurationParts(computeDuration(5000, 0))).toBe('5秒');
  });

  it('天时分秒组合', () => {
    expect(formatDurationParts(computeDuration(93784000, 0))).toBe('1天 2时 3分 4秒');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/utils/datetime/__tests__/time-diff.test.ts`
Expected: FAIL — `computeDuration is not a function`

- [ ] **Step 3: 实现 `Duration` 接口与两个函数**

在 `src/utils/datetime/datetime.ts` 末尾（`parseFlexibleTimeInput` 之后）追加：

```ts
/** 两个时间点的差值拆解结果。 */
export interface Duration {
  /** a 相对 b 的先后：1 = a 晚于 b，-1 = a 早于 b，0 = 相同 */
  sign: 1 | -1 | 0;
  /** 整天数（按 86400 秒计，不足一天的余量计入 hours） */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 差值绝对值换算的总秒数（毫秒部分向下取整） */
  totalSeconds: number;
}

/**
 * 计算两个毫秒时间戳的差值并拆解为天/时/分/秒。
 *
 * 拆解值（days/hours/...）始终为差值绝对值，方向由 sign 单独给出，
 * 便于倒计时（取绝对剩余）与时间差（附带方向）共用同一函数。
 *
 * @param a 第一个时间点（毫秒）
 * @param b 第二个时间点（毫秒）
 * @returns 差值拆解结果
 */
export function computeDuration(a: number, b: number): Duration {
  const diffMs = a - b;
  const totalSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const sign: 1 | -1 | 0 = diffMs > 0 ? 1 : diffMs < 0 ? -1 : 0;
  return { sign, days, hours, minutes, seconds, totalSeconds };
}

/**
 * 把 Duration 格式化为中文时长字符串，如「1天 2时 3分 4秒」。
 * 省略为 0 的单位；全为 0 时返回「0秒」。
 * @param d 时长拆解结果
 * @returns 格式化后的字符串
 */
export function formatDurationParts(d: Duration): string {
  const parts: string[] = [];
  if (d.days > 0) parts.push(`${d.days}天`);
  if (d.hours > 0) parts.push(`${d.hours}时`);
  if (d.minutes > 0) parts.push(`${d.minutes}分`);
  if (d.seconds > 0 || parts.length === 0) parts.push(`${d.seconds}秒`);
  return parts.join(' ');
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/utils/datetime/__tests__/time-diff.test.ts`
Expected: PASS — 全部用例通过

- [ ] **Step 5: 提交**

```bash
git add src/utils/datetime/datetime.ts src/utils/datetime/__tests__/time-diff.test.ts
git commit -m "feat(datetime): add computeDuration and formatDurationParts with tests" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 注册工具元数据

**Files:**
- Modify: `src/data/tools.ts`（在 `cron-parser` 条目之后插入新条目）

- [ ] **Step 1: 插入 `time-calculator` 条目**

用 Edit，`old_string` 为 cron-parser 条目结尾片段（唯一）：

```
    keywords: ['cron 表达式', 'cron 解析', 'crontab 在线', '定时任务表达式', 'cron 验证', 'cron 可视化'],
    relatedToolIds: ['datetime-converter'],
  },
```

`new_string`：

```
    keywords: ['cron 表达式', 'cron 解析', 'crontab 在线', '定时任务表达式', 'cron 验证', 'cron 可视化'],
    relatedToolIds: ['datetime-converter'],
  },
  {
    id: 'time-calculator',
    name: '时间差与倒计时',
    description: '计算两个时间点的时间差，以及对未来时刻实时倒计时',
    seoDescription: '在线时间差与倒计时工具，输入时间戳或日期即可计算两个时间点的天时分秒差值，并对未来时刻实时倒计时，过期自动转正计时，纯浏览器端运算。',
    category: '日期时间',
    icon: '⏳',
    path: '/datetime/time-calculator',
    keywords: ['时间差计算', '倒计时', '时间间隔计算', '两个时间差', '实时倒计时', '日期差值'],
    relatedToolIds: ['datetime-converter', 'cron-parser'],
  },
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无新增错误（`'日期时间'` 已在 `ToolCategory` 联合类型中）

- [ ] **Step 3: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat(datetime): register time-calculator tool metadata" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 创建页面与交互组件

**Files:**
- Create: `src/pages/datetime/time-calculator.astro`
- Create: `src/tools/datetime/TimeCalculator.vue`

- [ ] **Step 1: 创建路由页**

创建 `src/pages/datetime/time-calculator.astro`（与 `datetime-converter.astro` 同构）：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import TimeCalculator from '../../tools/datetime/TimeCalculator.vue';
---

<ToolLayout toolId="datetime/time-calculator">
  <TimeCalculator client:idle />
</ToolLayout>
```

- [ ] **Step 2: 创建交互组件**

创建 `src/tools/datetime/TimeCalculator.vue`：

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import dayjs from 'dayjs';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseFlexibleTimeInput,
  computeDuration,
  formatDurationParts,
} from '../../utils/datetime/datetime';

/** 日期显示格式，与日期时间转换器保持一致。 */
const DATE_DISPLAY_FORMAT = 'YYYY/MM/DD HH:mm:ss';

// ─── 时间差 section ───
const inputA = ref('');
const inputB = ref('');
const errorA = ref('');
const errorB = ref('');

/** 将毫秒时间戳格式化为显示用日期字符串。 */
function millisToDisplay(ms: number): string {
  return dayjs(ms).format(DATE_DISPLAY_FORMAT);
}

/** 解析后的毫秒时间戳，无法识别为 null。 */
const millisA = computed(() => parseFlexibleTimeInput(inputA.value));
const millisB = computed(() => parseFlexibleTimeInput(inputB.value));

watch(inputA, (v) => {
  errorA.value = v.trim() && millisA.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm:ss'
    : '';
});
watch(inputB, (v) => {
  errorB.value = v.trim() && millisB.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm:ss'
    : '';
});

/** 时间差拆解结果，任一输入无效时为 null。 */
const diffResult = computed(() => {
  if (millisA.value === null || millisB.value === null) return null;
  return computeDuration(millisA.value, millisB.value);
});

/** 时间差展示文案（含方向）。 */
const diffDisplay = computed(() => {
  if (!diffResult.value) return '';
  const d = diffResult.value;
  if (d.sign === 0) return 'A 与 B 相同';
  return d.sign > 0 ? `A 比 B 晚 ${formatDurationParts(d)}` : `A 比 B 早 ${formatDurationParts(d)}`;
});

/** 「现在」快捷：把当前时间填入指定输入框。 */
function fillNow(target: 'a' | 'b') {
  const display = millisToDisplay(Date.now());
  if (target === 'a') inputA.value = display;
  else inputB.value = display;
}

function clearDiff() {
  inputA.value = '';
  inputB.value = '';
  errorA.value = '';
  errorB.value = '';
}

// ─── 倒计时 section ───
const targetInput = ref('');
const targetError = ref('');
/** 每秒刷新的当前时间戳，驱动倒计时实时更新。 */
const nowTick = ref(Date.now());
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const targetMillis = computed(() => parseFlexibleTimeInput(targetInput.value));

watch(targetInput, (v) => {
  targetError.value = v.trim() && targetMillis.value === null
    ? '无法识别，请输入时间戳或 yyyy/MM/dd HH:mm:ss'
    : '';
});

/** 倒计时拆解结果（target 相对 now），目标无效时为 null。 */
const countdown = computed(() => {
  if (targetMillis.value === null) return null;
  return computeDuration(targetMillis.value, nowTick.value);
});

/** 是否处于倒计时状态（目标在未来）。 */
const isCountingDown = computed(() => countdown.value !== null && countdown.value.sign > 0);

/** 倒计时展示文案：未来为大字倒数，过期转正计时。 */
const countdownDisplay = computed(() => {
  if (!countdown.value) return '';
  const c = countdown.value;
  if (c.sign > 0) {
    return `${c.days}天 ${pad2(c.hours)}:${pad2(c.minutes)}:${pad2(c.seconds)}`;
  }
  return `已过期，距今 ${formatDurationParts(c)}`;
});

/** 数字补零至两位。 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fillNowTarget() {
  targetInput.value = millisToDisplay(Date.now());
}

function clearCountdown() {
  targetInput.value = '';
  targetError.value = '';
}

/**
 * 监听倒计时跨越到点：sign 从正（未来）变为非正（已到点/过期）时触发一次 Toast。
 * 一开始就过期（从未进入未来）的不提示。
 */
watch(countdown, (cur, prev) => {
  if (!cur) return;
  if (cur.sign <= 0 && prev && prev.sign > 0) {
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '时间到了' } }));
  }
});

onMounted(() => {
  // 默认值：时间差 A=今天 00:00 / B=现在；倒计时目标=明天此刻
  inputA.value = millisToDisplay(dayjs().startOf('day').valueOf());
  inputB.value = millisToDisplay(Date.now());
  targetInput.value = millisToDisplay(dayjs().add(1, 'day').valueOf());

  countdownTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="时间差与倒计时"
      description="计算两个时间点的时间差，以及对未来时刻实时倒计时"
      :show-example="false"
    />

    <!-- ═══ 时间差计算 ═══ -->
    <section class="mb-6 p-4 border border-border rounded-md bg-card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">📏</span> 时间差计算
        </h2>
        <ClearButton @clear="clearDiff" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <!-- 时间点 A -->
        <div class="bg-surface border border-border rounded-sm overflow-hidden">
          <div class="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
            <label class="text-[0.8125rem] text-muted font-medium">时间点 A</label>
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              @click="fillNow('a')"
            >
              现在
            </button>
          </div>
          <div class="px-3 py-3">
            <input
              v-model="inputA"
              class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              placeholder="时间戳或 yyyy/MM/dd HH:mm:ss"
            />
          </div>
          <div class="px-3 py-2 border-t border-border bg-card min-h-[28px]">
            <p v-if="errorA" class="text-error text-[0.8125rem] m-0">{{ errorA }}</p>
          </div>
        </div>

        <!-- 时间点 B -->
        <div class="bg-surface border border-border rounded-sm overflow-hidden">
          <div class="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
            <label class="text-[0.8125rem] text-muted font-medium">时间点 B</label>
            <button
              type="button"
              class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
              @click="fillNow('b')"
            >
              现在
            </button>
          </div>
          <div class="px-3 py-3">
            <input
              v-model="inputB"
              class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
              placeholder="时间戳或 yyyy/MM/dd HH:mm:ss"
            />
          </div>
          <div class="px-3 py-2 border-t border-border bg-card min-h-[28px]">
            <p v-if="errorB" class="text-error text-[0.8125rem] m-0">{{ errorB }}</p>
          </div>
        </div>
      </div>

      <!-- 时间差结果 -->
      <div v-if="diffDisplay" class="flex items-center gap-3 px-4 py-3 border border-border rounded-sm bg-surface">
        <span class="text-xs font-semibold text-accent min-w-[64px] shrink-0">时间差</span>
        <code class="flex-1 font-mono text-sm text-text select-all break-all">{{ diffDisplay }}</code>
        <CopyButton :text="diffDisplay" size="sm" />
      </div>
      <div v-if="diffResult" class="flex items-center gap-3 px-4 py-2 mt-2 border border-border rounded-sm bg-surface">
        <span class="text-xs font-semibold text-accent min-w-[64px] shrink-0">总秒数</span>
        <code class="flex-1 font-mono text-sm text-text select-all">{{ diffResult.totalSeconds }}</code>
        <CopyButton :text="String(diffResult.totalSeconds)" size="sm" />
      </div>
    </section>

    <!-- ═══ 倒计时 ═══ -->
    <section class="p-4 border border-border rounded-md bg-card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">⏳</span> 倒计时
        </h2>
        <ClearButton @clear="clearCountdown" />
      </div>

      <div class="bg-surface border border-border rounded-sm overflow-hidden mb-4">
        <div class="px-3 py-2 border-b border-border bg-card flex items-center justify-between">
          <label class="text-[0.8125rem] text-muted font-medium">目标时间</label>
          <button
            type="button"
            class="text-xs text-muted bg-transparent cursor-pointer focus:outline-none focus:text-accent"
            @click="fillNowTarget"
          >
            现在
          </button>
        </div>
        <div class="px-3 py-3">
          <input
            v-model="targetInput"
            class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
            placeholder="时间戳或 yyyy/MM/dd HH:mm:ss"
          />
        </div>
        <div class="px-3 py-2 border-t border-border bg-card min-h-[28px]">
          <p v-if="targetError" class="text-error text-[0.8125rem] m-0">{{ targetError }}</p>
        </div>
      </div>

      <!-- 大字倒计时 / 正计时 -->
      <div
        v-if="countdownDisplay"
        class="flex flex-col items-center justify-center py-6 border border-border rounded-sm bg-surface"
      >
        <div
          class="font-mono font-bold tracking-wider tabular-nums text-center break-all"
          :class="isCountingDown ? 'text-4xl text-accent' : 'text-xl text-muted'"
        >
          {{ countdownDisplay }}
        </div>
        <p class="text-xs text-muted mt-2 m-0">
          {{ isCountingDown ? '距目标还有' : '目标已过期' }}
        </p>
      </div>
      <div v-else class="flex items-center justify-center py-6 border border-border rounded-sm bg-surface">
        <p class="text-muted text-[0.8125rem] m-0">输入目标时间开始倒计时</p>
      </div>
    </section>
  </div>
</template>
```

- [ ] **Step 3: 类型检查**

Run: `pnpm astro check`
Expected: 无新增错误

- [ ] **Step 4: 启动开发服务器手动验证**

Run: `pnpm dev`，浏览器访问 `http://localhost:4321/datetime/time-calculator`

Expected:
- 时间差 section：A 默认显示今天 `00:00:00`，B 默认显示当前时刻，结果区显示「A 比 B 早 X时 Y分 Z秒」+ 总秒数
- 点 A、B 的「现在」按钮可刷新当前时间；输入非法字符（如 `abc`）下方红字提示
- 倒计时 section：目标默认明天此刻，大字显示「X天 HH:MM:SS」每秒递减；把目标改成已过去的时间（如手动输入昨天），显示「已过期，距今 …」
- 清空按钮各自生效

- [ ] **Step 5: 提交**

```bash
git add src/pages/datetime/time-calculator.astro src/tools/datetime/TimeCalculator.vue
git commit -m "feat(datetime): add time-calculator page and component" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 添加 FAQ

**Files:**
- Modify: `src/data/tool-faqs.ts`（在 `ipv6-cidr` 条目之后、闭合 `};` 之前插入）

- [ ] **Step 1: 插入 `time-calculator` FAQ**

用 Edit，`old_string`（ipv6-cidr 末尾闭合，唯一）：

```
输入地址后工具会自动识别类型。',
    },
  ],
};
```

`new_string`：

```
输入地址后工具会自动识别类型。',
    },
  ],
  'time-calculator': [
    {
      question: '支持哪些时间输入格式？',
      answer: '每个输入框都支持两种格式：<strong>Unix 时间戳</strong>（10 位秒或 13 位毫秒，自动识别）与<strong>标准日期</strong>（<code>yyyy/MM/dd HH:mm:ss</code>，如 <code>2026/06/16 12:00:00</code>）。两者可混用，例如计算时间差时 A 填时间戳、B 填日期。',
    },
    {
      question: '时间差是如何计算的？',
      answer: '工具取两个时间点的差值绝对值，按 <strong>天 / 时 / 分 / 秒</strong> 逐级拆解（1 天 = 86400 秒），并额外给出总秒数，同时标注方向（A 比 B 早还是晚）。注意这里按<strong>物理时长</strong>计算，与日历「自然日」跨度不一定相同。',
    },
    {
      question: '倒计时过期后会怎样？',
      answer: '目标时间到达时页面会弹出一次「时间到了」提示。此后倒计时会<strong>自动转为正计时</strong>，显示「已过期，距今 X天 Y时…」并继续每秒刷新，方便你了解已经过去了多久。',
    },
  ],
};
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无新增错误

- [ ] **Step 3: 提交**

```bash
git add src/data/tool-faqs.ts
git commit -m "docs(datetime): add time-calculator FAQ entries" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 全量验证

**Files:** 无（仅验证）

- [ ] **Step 1: 跑全部单元测试**

Run: `pnpm test`
Expected: PASS — 包括新增 `time-diff.test.ts` 与既有测试全绿

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 0 errors

- [ ] **Step 3: 生产构建**

Run: `pnpm build`
Expected: 构建成功，`dist/datetime/time-calculator/index.html` 生成

- [ ] **Step 4: 更新 ROADMAP 进度（可选，收尾）**

将 `docs/ROADMAP.md`「六、进度追踪 → P0」中的「日期时间转换器：增加时间差 / 倒计时」勾选为 `[x]` 并补实际完成日期；提交：

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark datetime time-calculator done" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review（编写后自检结果）

- **Spec 覆盖**：spec 第三~六节的工具定位、上下分区、时间差标准档（时间戳/日期输入 + 现在 + 天时分秒 + 总秒数 + 方向）、倒计时标准档（大字倒数 + 过期正计时 + 到点 toast）→ Task 1/2/4 覆盖；第七节工具函数 → Task 1/2；第十一节 SEO（tools.ts + FAQ）→ Task 3/5；第十二节测试 → Task 1/2/6；默认值（A=今天00:00 / B=现在 / 目标=明天）→ Task 4 Step 2 的 onMounted。全部有对应 task。
- **占位符**：无 TBD/TODO；每个代码步骤均为完整可执行代码。
- **类型一致性**：`parseFlexibleTimeInput` / `computeDuration` / `formatDurationParts` / `Duration` 在 Task 1/2 定义、Task 4 组件 import 与使用的签名一致；`Duration.sign`（1/-1/0）语义在测试（Task 2）与组件方向文案、倒计时判定（Task 4）中一致。
