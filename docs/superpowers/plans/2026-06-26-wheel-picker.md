# 转盘抽奖（Wheel Picker）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个浏览器端转盘抽奖工具：自定义带权重选项、Canvas 彩色转盘 + easeOutCubic 缓动旋转、不重复抽取、选项配置经 URL Base64 分享。

**Architecture:** 纯逻辑（加权随机、扇区角度、目标旋转角、批量解析、分享编解码、调色板）全部抽到 `src/utils/text/wheel.ts`，与 DOM 无关、用 Vitest 覆盖。`src/tools/text/WheelPicker.vue` 仅负责 Canvas 渲染、`requestAnimationFrame` 动画与交互编排，复用站内 `ResponsiveWorkspace`/`ToolHeader`/`ToggleSwitch`/`ClearButton`/`useCopy`。

**Tech Stack:** Astro 6 + Vue 3（`<script setup lang="ts">`）、Tailwind CSS v4、Canvas 2D、`crypto.getRandomValues`、Vitest（node 环境）。

## Global Constraints

- 路由二级结构：`src/tools` 逻辑在 `src/tools/text/`，页面壳层在 `src/pages/text/wheel-picker.astro`，URL = `/text/wheel-picker`。
- `tools.ts` 中 `id` 必须**严格等于** path 末段 `wheel-picker`，否则 FAQ/相关工具/SEO 静默失效。
- 无路径别名，全部相对路径导入（如 `../../utils/text/wheel`）。
- 禁止 `eval`/`Function`/`setTimeout(string)`；分享解码全程 `try-catch`，坏参数绝不白屏。
- 样式优先标准 Tailwind 类名，禁止可被标准类名表达的任意值语法（如用 `w-30` 而非 `w-[120px]`）；设计令牌字号等允许任意值。
- 新增公共类/接口/方法必须写 TSDoc 文档注释。
- 单测放被测模块同目录 `__tests__/`；运行：`pnpm test src/utils/text/__tests__/wheel.test.ts`。
- Vue 组件无单测设施（vitest 为 node 环境），验证靠 `pnpm astro check` + `pnpm build` + `pnpm dev` 浏览器实测。
- Node >= 22.12.0，pnpm。

---

### Task 1: wheel.ts 脚手架 + 类型 + 权重归一 + 加权随机选择

**Files:**
- Create: `src/utils/text/wheel.ts`
- Test: `src/utils/text/__tests__/wheel.test.ts`

**Interfaces:**
- Consumes: 无（首个任务）。
- Produces:
  - `interface WheelItem { text: string; weight: number }`
  - `const MAX_ITEMS = 50`
  - `function normalizeWeight(w: number): number` — 非正/非有限 → 1，否则原值
  - `function pickWeightedIndex(weights: number[], rng: () => number): number`
  - `function createCryptoRng(): () => number`

- [ ] **Step 1: 写失败测试**

创建 `src/utils/text/__tests__/wheel.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { normalizeWeight, pickWeightedIndex } from '../wheel';

describe('normalizeWeight', () => {
  it('保留正有限值', () => {
    expect(normalizeWeight(3)).toBe(3);
    expect(normalizeWeight(0.5)).toBe(0.5);
  });
  it('非正或非有限回退为 1', () => {
    expect(normalizeWeight(0)).toBe(1);
    expect(normalizeWeight(-2)).toBe(1);
    expect(normalizeWeight(NaN)).toBe(1);
    expect(normalizeWeight(Infinity)).toBe(1);
  });
});

describe('pickWeightedIndex', () => {
  it('按前缀和命中对应下标', () => {
    // weights [1,1,2] 总和 4；落点用固定 rng 序列
    const seq = [0.0, 0.24, 0.49, 0.99];
    let i = 0;
    const rng = () => seq[i++];
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(0); // 0.0*4=0  -> idx0 [0,1)
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(0); // 0.24*4=0.96 -> idx0
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(1); // 0.49*4=1.96 -> idx1 [1,2)
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(2); // 0.99*4=3.96 -> idx2 [2,4)
  });
  it('权重不等时高权重命中更频繁', () => {
    const weights = [1, 9];
    let hits1 = 0;
    let n = 0;
    const rng = () => (n++ % 10) / 10; // 0,0.1,...,0.9
    let high = 0;
    for (let k = 0; k < 10; k++) {
      if (pickWeightedIndex(weights, rng) === 1) high++;
    }
    expect(high).toBe(9); // 总和10，仅落点0.0命中idx0，其余命中idx1
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: FAIL — 无法从 `../wheel` 导入（模块不存在）。

- [ ] **Step 3: 写最小实现**

创建 `src/utils/text/wheel.ts`：

```ts
/**
 * 转盘抽奖纯逻辑：加权随机、扇区角度、目标旋转角、批量解析、分享编解码、调色板。
 * 本模块不依赖 DOM，全部为可单测纯函数（createCryptoRng 除外，依赖 Web Crypto）。
 */

/** 单个转盘选项 */
export interface WheelItem {
  /** 选项名称（去首尾空白，非空） */
  text: string;
  /** 权重，正有限数；面积与中奖概率正比于权重 */
  weight: number;
}

/** 选项数量上限，保证扇区可读 */
export const MAX_ITEMS = 50;

/**
 * 归一化权重：非正数或非有限值回退为 1，否则保留原值。
 * @param w 原始权重
 * @returns 合法权重
 */
export function normalizeWeight(w: number): number {
  return Number.isFinite(w) && w > 0 ? w : 1;
}

/**
 * 按权重随机选中一个下标（前缀和落点法）。
 * @param weights 各选项权重，应为正数
 * @param rng 返回 [0,1) 均匀随机数的函数，便于测试注入
 * @returns 命中下标；weights 为空时返回 -1
 */
export function pickWeightedIndex(weights: number[], rng: () => number): number {
  if (weights.length === 0) return -1;
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return Math.floor(rng() * weights.length);
  let target = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i];
    if (target < 0) return i;
  }
  return weights.length - 1;
}

/**
 * 创建基于 Web Crypto 的均匀随机数生成器。
 * @returns 每次调用返回 [0,1) 的均匀随机数
 */
export function createCryptoRng(): () => number {
  return () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: PASS（normalizeWeight、pickWeightedIndex 全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/wheel.ts src/utils/text/__tests__/wheel.test.ts
git commit -m "feat(wheel): 加权随机选择与权重归一纯函数"
```

---

### Task 2: 扇区角度 computeSectors

**Files:**
- Modify: `src/utils/text/wheel.ts`
- Test: `src/utils/text/__tests__/wheel.test.ts`

**Interfaces:**
- Consumes: `WheelItem`（Task 1）。
- Produces:
  - `interface SectorAngle { startDeg: number; endDeg: number; midDeg: number }`
  - `function computeSectors(items: WheelItem[]): SectorAngle[]`（角度以度计，从 0 起顺时针，总和 360）

- [ ] **Step 1: 写失败测试**

在 `wheel.test.ts` 追加：

```ts
import { computeSectors } from '../wheel';

describe('computeSectors', () => {
  it('等权时均分 360 度', () => {
    const s = computeSectors([
      { text: 'a', weight: 1 },
      { text: 'b', weight: 1 },
      { text: 'c', weight: 1 },
      { text: 'd', weight: 1 },
    ]);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ startDeg: 0, endDeg: 90, midDeg: 45 });
    expect(s[3].endDeg).toBeCloseTo(360);
  });
  it('面积正比于权重', () => {
    const s = computeSectors([
      { text: 'a', weight: 1 },
      { text: 'b', weight: 3 },
    ]);
    expect(s[0].endDeg).toBeCloseTo(90);
    expect(s[1].startDeg).toBeCloseTo(90);
    expect(s[1].endDeg).toBeCloseTo(360);
  });
  it('空数组返回空', () => {
    expect(computeSectors([])).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: FAIL — `computeSectors` 未定义。

- [ ] **Step 3: 写最小实现**

在 `wheel.ts` 追加：

```ts
/** 扇区角度（度），从 0 起顺时针 */
export interface SectorAngle {
  /** 起始角度 */
  startDeg: number;
  /** 结束角度 */
  endDeg: number;
  /** 中线角度，用于动画落点与文字绘制 */
  midDeg: number;
}

/**
 * 计算每个选项的扇区起止角度，面积正比于权重，总和为 360 度。
 * @param items 选项列表
 * @returns 与 items 等长的扇区角度数组；空输入返回空数组
 */
export function computeSectors(items: WheelItem[]): SectorAngle[] {
  if (items.length === 0) return [];
  const total = items.reduce((s, it) => s + it.weight, 0);
  const sectors: SectorAngle[] = [];
  let acc = 0;
  for (const it of items) {
    const startDeg = (acc / total) * 360;
    acc += it.weight;
    const endDeg = (acc / total) * 360;
    sectors.push({ startDeg, endDeg, midDeg: (startDeg + endDeg) / 2 });
  }
  return sectors;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/wheel.ts src/utils/text/__tests__/wheel.test.ts
git commit -m "feat(wheel): 按权重计算扇区角度"
```

---

### Task 3: 目标旋转角 computeTargetRotation

**Files:**
- Modify: `src/utils/text/wheel.ts`
- Test: `src/utils/text/__tests__/wheel.test.ts`

**Interfaces:**
- Consumes: 无新增类型。
- Produces:
  - `const POINTER_DEG = 270`（指针固定在正上方 12 点 = 270°）
  - `function computeTargetRotation(current: number, winnerMidDeg: number, extraTurns: number): number`
  - 约定：Canvas 中某扇区点的屏幕角度 = `扇区角度 + rotation`（度）。

- [ ] **Step 1: 写失败测试**

在 `wheel.test.ts` 追加：

```ts
import { computeTargetRotation, POINTER_DEG } from '../wheel';

describe('computeTargetRotation', () => {
  it('最终角使中奖中线落在指针处', () => {
    const final = computeTargetRotation(0, 90, 2);
    // 中线90 + 最终rotation ≡ POINTER_DEG (mod 360)
    expect(((90 + final) % 360 + 360) % 360).toBeCloseTo(POINTER_DEG);
  });
  it('叠加额外整圈且大于当前角', () => {
    const final = computeTargetRotation(0, 90, 2);
    expect(final).toBeGreaterThanOrEqual(2 * 360);
  });
  it('从非零当前角也单调向前', () => {
    const final = computeTargetRotation(400, 0, 3);
    expect(final).toBeGreaterThan(400);
    expect(((0 + final) % 360 + 360) % 360).toBeCloseTo(POINTER_DEG);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: FAIL — `computeTargetRotation`/`POINTER_DEG` 未定义。

- [ ] **Step 3: 写最小实现**

在 `wheel.ts` 追加：

```ts
/** 指针固定角度：正上方（12 点方向）对应 270 度 */
export const POINTER_DEG = 270;

/**
 * 计算让中奖扇区中线停在指针处所需的最终旋转角（度）。
 * 约定屏幕角度 = 扇区角度 + rotation；结果在当前角基础上单调向前并叠加整圈。
 * @param current 当前旋转角（度）
 * @param winnerMidDeg 中奖扇区中线角度（度）
 * @param extraTurns 额外整圈数，增强视觉效果
 * @returns 最终旋转角（度），> current
 */
export function computeTargetRotation(
  current: number,
  winnerMidDeg: number,
  extraTurns: number,
): number {
  const desiredMod = (((POINTER_DEG - winnerMidDeg) % 360) + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  const delta = (((desiredMod - currentMod) % 360) + 360) % 360;
  return current + delta + extraTurns * 360;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/wheel.ts src/utils/text/__tests__/wheel.test.ts
git commit -m "feat(wheel): 计算中奖目标旋转角"
```

---

### Task 4: 分享编解码 encodeShare / decodeShare

**Files:**
- Modify: `src/utils/text/wheel.ts`
- Test: `src/utils/text/__tests__/wheel.test.ts`

**Interfaces:**
- Consumes: `WheelItem`、`normalizeWeight`、`MAX_ITEMS`。
- Produces:
  - `function encodeShare(items: WheelItem[]): string` — URL-safe Base64
  - `function decodeShare(data: string): WheelItem[]` — 非法输入抛 `Error`

- [ ] **Step 1: 写失败测试**

在 `wheel.test.ts` 追加：

```ts
import { encodeShare, decodeShare } from '../wheel';

describe('encodeShare / decodeShare', () => {
  it('全为权重1时往返一致（含中文）', () => {
    const items = [
      { text: '一等奖', weight: 1 },
      { text: '谢谢参与', weight: 1 },
    ];
    expect(decodeShare(encodeShare(items))).toEqual(items);
  });
  it('含非1权重时往返一致', () => {
    const items = [
      { text: 'A', weight: 3 },
      { text: 'B', weight: 1 },
    ];
    expect(decodeShare(encodeShare(items))).toEqual(items);
  });
  it('编码串为 URL-safe（无 +/= 字符）', () => {
    const s = encodeShare([{ text: '????', weight: 1 }]);
    expect(s).not.toMatch(/[+/=]/);
  });
  it('坏输入抛错', () => {
    expect(() => decodeShare('!!!not-base64!!!')).toThrow();
    expect(() => decodeShare('')).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: FAIL — `encodeShare`/`decodeShare` 未定义。

- [ ] **Step 3: 写最小实现**

在 `wheel.ts` 追加：

```ts
/** UTF-8 安全的 Base64 编码（含 URL-safe 替换、去 padding） */
function toUrlSafeBase64(json: string): string {
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** URL-safe Base64 还原为 UTF-8 字符串 */
function fromUrlSafeBase64(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * 将选项编码为 URL-safe Base64 分享串。
 * 所有权重为 1 时退化为纯名称数组以缩短链接；否则编码 [text, weight] 对数组。
 * @param items 选项列表
 * @returns URL-safe Base64 字符串
 */
export function encodeShare(items: WheelItem[]): string {
  const allOne = items.every((it) => it.weight === 1);
  const payload = allOne
    ? items.map((it) => it.text)
    : items.map((it) => [it.text, it.weight] as [string, number]);
  return toUrlSafeBase64(JSON.stringify(payload));
}

/**
 * 解码分享串为选项数组，对结构与类型严格校验。
 * @param data URL-safe Base64 分享串
 * @returns 选项列表
 * @throws 当数据损坏、结构非法或为空时抛出 Error
 */
export function decodeShare(data: string): WheelItem[] {
  if (!data) throw new Error('分享数据为空');
  const parsed: unknown = JSON.parse(fromUrlSafeBase64(data));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('分享数据结构非法');
  }
  const items: WheelItem[] = parsed.slice(0, MAX_ITEMS).map((entry) => {
    if (typeof entry === 'string') {
      return { text: entry, weight: 1 };
    }
    if (Array.isArray(entry) && typeof entry[0] === 'string') {
      return { text: entry[0], weight: normalizeWeight(Number(entry[1])) };
    }
    throw new Error('分享数据项非法');
  });
  const valid = items.filter((it) => it.text.trim().length > 0);
  if (valid.length === 0) throw new Error('分享数据无有效选项');
  return valid;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: PASS。

> 说明：`btoa`/`atob` 在 Node 18+ 与浏览器均为全局函数，vitest node 环境可用。

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/wheel.ts src/utils/text/__tests__/wheel.test.ts
git commit -m "feat(wheel): 选项配置 URL-safe Base64 分享编解码"
```

---

### Task 5: 批量解析 parseBatch + 调色板 sliceColor + 默认示例

**Files:**
- Modify: `src/utils/text/wheel.ts`
- Test: `src/utils/text/__tests__/wheel.test.ts`

**Interfaces:**
- Consumes: `WheelItem`、`MAX_ITEMS`。
- Produces:
  - `function parseBatch(text: string): WheelItem[]` — 按行解析，空行忽略，权重默认 1，去重保留首次
  - `function sliceColor(index: number, total: number): string` — HSL 自动配色
  - `const DEFAULT_ITEMS: WheelItem[]` — 默认 6 个等权选项

- [ ] **Step 1: 写失败测试**

在 `wheel.test.ts` 追加：

```ts
import { parseBatch, sliceColor, DEFAULT_ITEMS } from '../wheel';

describe('parseBatch', () => {
  it('按行解析并忽略空行/首尾空白', () => {
    expect(parseBatch(' 苹果 \n\n香蕉\n  \n橙子')).toEqual([
      { text: '苹果', weight: 1 },
      { text: '香蕉', weight: 1 },
      { text: '橙子', weight: 1 },
    ]);
  });
  it('去重保留首次出现', () => {
    expect(parseBatch('A\nB\nA')).toEqual([
      { text: 'A', weight: 1 },
      { text: 'B', weight: 1 },
    ]);
  });
  it('超过上限截断', () => {
    const many = Array.from({ length: 60 }, (_, i) => `x${i}`).join('\n');
    expect(parseBatch(many)).toHaveLength(50);
  });
});

describe('sliceColor', () => {
  it('返回合法 hsl 字符串且随下标变化', () => {
    expect(sliceColor(0, 4)).toMatch(/^hsl\(/);
    expect(sliceColor(0, 4)).not.toBe(sliceColor(1, 4));
  });
});

describe('DEFAULT_ITEMS', () => {
  it('提供至少 2 个默认选项', () => {
    expect(DEFAULT_ITEMS.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: FAIL — `parseBatch`/`sliceColor`/`DEFAULT_ITEMS` 未定义。

- [ ] **Step 3: 写最小实现**

在 `wheel.ts` 追加：

```ts
/**
 * 解析批量导入文本为选项列表：按行拆分，去首尾空白，忽略空行，按名称去重（保留首次），
 * 权重统一为 1，数量上限 MAX_ITEMS。
 * @param text 多行文本，每行一个选项名称
 * @returns 选项列表
 */
export function parseBatch(text: string): WheelItem[] {
  const seen = new Set<string>();
  const items: WheelItem[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    items.push({ text: t, weight: 1 });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

/**
 * 按下标在色相环上等间隔取色，保证相邻扇区色相区分度。
 * @param index 扇区下标
 * @param total 扇区总数
 * @returns HSL 颜色字符串
 */
export function sliceColor(index: number, total: number): string {
  const hue = total > 0 ? Math.round((index * 360) / total) % 360 : 0;
  return `hsl(${hue}, 70%, 60%)`;
}

/** 默认示例选项：打开即可体验 */
export const DEFAULT_ITEMS: WheelItem[] = [
  { text: '一等奖', weight: 1 },
  { text: '二等奖', weight: 1 },
  { text: '三等奖', weight: 1 },
  { text: '谢谢参与', weight: 1 },
  { text: '再来一次', weight: 1 },
  { text: '神秘大奖', weight: 1 },
];
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: PASS（全文件用例全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/wheel.ts src/utils/text/__tests__/wheel.test.ts
git commit -m "feat(wheel): 批量解析、自动调色板与默认示例"
```

---

### Task 6: 工具注册 + FAQ + Astro 页面壳层

**Files:**
- Modify: `src/data/tools.ts`（在 `tools` 数组末尾追加，文本处理分类）
- Modify: `src/data/tool-faqs.ts`（在 `toolFaqs` 对象追加 `'wheel-picker'` 键）
- Create: `src/pages/text/wheel-picker.astro`
- Create: `src/tools/text/WheelPicker.vue`（本任务仅占位，渲染 ToolHeader + 占位文本）

**Interfaces:**
- Consumes: `ToolLayout`、`ToolHeader`。
- Produces: 可访问的 `/text/wheel-picker` 页面壳层；`WheelPicker.vue` 默认导出占位组件，供后续任务填充。

- [ ] **Step 1: 注册工具元数据**

在 `src/data/tools.ts` 的 `tools` 数组**末尾**（最后一个 `}` 与 `]` 之间）追加：

```ts
  {
    id: 'wheel-picker',
    name: '转盘抽奖',
    description: '自定义选项的在线转盘抽奖与随机抽签工具，支持批量导入、权重、不重复抽取与配置分享',
    seoDescription: '免费在线转盘抽奖与随机抽签工具，自定义选项并批量粘贴导入，Canvas 彩色转盘配合缓动动画旋转指向结果，支持为选项设置权重调整中奖概率、不重复抽取（中奖自动移出可恢复），并可将转盘配置编码到链接一键分享，他人打开即用同款转盘，纯浏览器端运算数据不上传。',
    category: '文本处理',
    icon: '🎡',
    path: '/text/wheel-picker',
    keywords: ['转盘抽奖', '在线抽签', '随机抽签', '随机选择器', '幸运转盘', '决策转盘', '随机点名', '抽奖转盘', 'wheel picker', 'random picker'],
    relatedToolIds: ['random-string', 'uuid-generator', 'fake-data-generator'],
  },
```

- [ ] **Step 2: 注册 FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象内追加一个键（置于其他工具条目之间，逗号分隔正确）：

```ts
  'wheel-picker': [
    {
      question: '转盘抽奖的结果是随机的吗？',
      answer: '是。抽取基于浏览器原生 <code>crypto</code> 随机数（密码学级、不可预测），每个选项的中奖概率与其权重成正比，公平且无法被预测或操控。',
    },
    {
      question: '「不重复抽取」是什么意思？',
      answer: '开启后，中奖的选项会<strong>自动从转盘移除</strong>并进入「已中奖」列表，适合抽取不重复名单（如抽人、排顺序）。可随时点击「恢复」把某项放回，或「全部重置」重新开始。',
    },
    {
      question: '可以让某些选项中奖概率更高吗？',
      answer: '可以。为每个选项设置<strong>权重</strong>即可，权重越大扇区面积越大、中奖概率越高。权重默认为 1（等概率）。',
    },
    {
      question: '分享链接会上传我的数据吗？',
      answer: '不会。工具纯浏览器端运行，选项配置仅以 Base64 编码在链接的 <code>?data=</code> 参数中，不经过任何服务器。他人打开链接即可载入同款转盘。',
    },
  ],
```

- [ ] **Step 3: 创建占位 Vue 组件**

创建 `src/tools/text/WheelPicker.vue`：

```vue
<script setup lang="ts">
/**
 * 转盘抽奖工具组件（占位骨架，后续任务填充交互）。
 */
import ToolHeader from '../../components/layout/ToolHeader.vue';
</script>

<template>
  <div>
    <ToolHeader
      title="转盘抽奖"
      description="自定义选项，旋转转盘随机抽取，支持权重、不重复抽取与配置分享"
      :show-example="false"
    />
    <p class="text-sm text-muted">转盘建设中…</p>
  </div>
</template>
```

- [ ] **Step 4: 创建 Astro 页面壳层**

创建 `src/pages/text/wheel-picker.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import WheelPicker from '../../tools/text/WheelPicker.vue';
---

<ToolLayout toolId="text/wheel-picker">
  <WheelPicker client:idle />
</ToolLayout>
```

- [ ] **Step 5: 类型检查 + 构建 + 浏览器验证**

Run: `pnpm astro check`
Expected: 0 errors（与 wheel-picker 相关）。

Run: `pnpm build`
Expected: 构建成功，输出含 `/text/wheel-picker` 页面。

手动验证：`pnpm dev` → 打开 `http://localhost:4321/text/wheel-picker`，确认页面正常渲染标题与占位文本、无控制台报错；侧边栏「文本处理」分类出现「转盘抽奖」。

- [ ] **Step 6: 提交**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts src/pages/text/wheel-picker.astro src/tools/text/WheelPicker.vue
git commit -m "feat(wheel): 注册转盘抽奖工具与页面壳层"
```

---

### Task 7: 选项列表编辑 + 批量导入 UI

**Files:**
- Modify: `src/tools/text/WheelPicker.vue`

**Interfaces:**
- Consumes: `WheelItem`、`MAX_ITEMS`、`normalizeWeight`、`parseBatch`、`DEFAULT_ITEMS`（来自 `wheel.ts`）；`ResponsiveWorkspace`、`ToolHeader`、`ClearButton`。
- Produces: 左侧控制区——结构化选项列表（名称+权重+删除+添加）、批量导入文本框、清空按钮；状态 `items`、`batchText`。右侧 output 槽暂留占位，供 Task 8 填充 Canvas。

- [ ] **Step 1: 实现选项列表与批量导入**

将 `src/tools/text/WheelPicker.vue` 整体替换为：

```vue
<script setup lang="ts">
/**
 * 转盘抽奖工具组件。
 *
 * - 左侧：结构化选项列表（名称+权重）、批量粘贴导入、操作按钮
 * - 右侧：Canvas 转盘与旋转动画（后续任务填充）
 */
import { ref } from 'vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  type WheelItem,
  MAX_ITEMS,
  normalizeWeight,
  parseBatch,
  DEFAULT_ITEMS,
} from '../../utils/text/wheel';

/** 活跃选项（可被抽中），唯一真相源 */
const items = ref<WheelItem[]>(DEFAULT_ITEMS.map((it) => ({ ...it })));
/** 批量导入文本框内容 */
const batchText = ref('');

/** 触发全局 toast 通知 */
function showToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 新增一个空选项 */
function addItem(): void {
  if (items.value.length >= MAX_ITEMS) {
    showToast(`选项数量已达上限 ${MAX_ITEMS} 个`);
    return;
  }
  items.value.push({ text: '', weight: 1 });
}

/** 删除指定下标选项 */
function removeItem(index: number): void {
  items.value.splice(index, 1);
}

/** 失焦时归一化权重输入 */
function normalizeItemWeight(index: number): void {
  items.value[index].weight = normalizeWeight(Number(items.value[index].weight));
}

/** 将批量文本解析后追加到现有列表（按名称去重，受上限约束） */
function importBatch(): void {
  const parsed = parseBatch(batchText.value);
  if (parsed.length === 0) {
    showToast('没有可导入的选项');
    return;
  }
  const existing = new Set(items.value.map((it) => it.text));
  let added = 0;
  for (const it of parsed) {
    if (items.value.length >= MAX_ITEMS) break;
    if (existing.has(it.text)) continue;
    existing.add(it.text);
    items.value.push(it);
    added++;
  }
  batchText.value = '';
  showToast(added > 0 ? `已导入 ${added} 个选项` : '选项已存在，未新增');
}

/** 清空：恢复默认示例 */
function clearAll(): void {
  items.value = DEFAULT_ITEMS.map((it) => ({ ...it }));
  batchText.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="转盘抽奖"
      description="自定义选项，旋转转盘随机抽取，支持权重、不重复抽取与配置分享"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="flex flex-col gap-4">
          <!-- 选项列表 -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[0.8125rem] text-muted">选项（{{ items.length }}/{{ MAX_ITEMS }}）</span>
              <button
                class="text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0"
                @click="addItem"
              >
                + 添加选项
              </button>
            </div>
            <div
              v-for="(item, index) in items"
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="item.text"
                type="text"
                placeholder="选项名称"
                class="flex-1 min-w-0 px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
              />
              <input
                v-model.number="item.weight"
                type="number"
                min="1"
                step="1"
                title="权重"
                class="w-16 px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
                @blur="normalizeItemWeight(index)"
              />
              <button
                class="shrink-0 px-2 py-1.5 text-muted hover:text-text cursor-pointer bg-transparent border-0"
                title="删除"
                @click="removeItem(index)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- 批量导入 -->
          <div class="flex flex-col gap-2">
            <span class="text-[0.8125rem] text-muted">批量导入（每行一个选项）</span>
            <textarea
              v-model="batchText"
              rows="4"
              placeholder="粘贴多行文本，每行一个选项&#10;张三&#10;李四&#10;王五"
              class="w-full px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-mono resize-y focus:outline-none focus:border-accent"
            ></textarea>
            <button
              class="self-start px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
              @click="importBatch"
            >
              导入
            </button>
          </div>
        </div>
      </template>

      <template #actions>
        <ClearButton @clear="clearAll" />
      </template>

      <template #output>
        <div class="text-sm text-muted">转盘建设中…</div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 0 errors（与 wheel-picker 相关）。

- [ ] **Step 3: 浏览器验证**

`pnpm dev` → `/text/wheel-picker`：
- 默认展示 6 个选项行（名称+权重+删除）。
- 「+ 添加选项」追加空行；删除按钮可移除行；权重输入失焦后非正值回退为 1。
- 批量框粘贴多行点「导入」→ 追加且去重，toast 提示数量。
- 「清空」恢复默认 6 项。
- 无控制台报错。

- [ ] **Step 4: 提交**

```bash
git add src/tools/text/WheelPicker.vue
git commit -m "feat(wheel): 选项列表编辑与批量导入界面"
```

---

### Task 8: Canvas 转盘渲染 + easeOutCubic 旋转动画

**Files:**
- Modify: `src/tools/text/WheelPicker.vue`

**Interfaces:**
- Consumes: `computeSectors`、`sliceColor`、`pickWeightedIndex`、`createCryptoRng`、`computeTargetRotation`、`SectorAngle`。
- Produces: 右侧 Canvas 转盘绘制、指针、「开始」按钮、`result` 展示；状态 `rotation`、`spinning`、`result`；函数 `draw()`、`spin()`。

- [ ] **Step 1: 扩展 script —— 渲染与动画逻辑**

在 `<script setup>` 内（`clearAll` 之后）追加导入与逻辑。先在现有 import 中补充：

```ts
import { onMounted, watch, nextTick } from 'vue';
import {
  computeSectors,
  sliceColor,
  pickWeightedIndex,
  createCryptoRng,
  computeTargetRotation,
} from '../../utils/text/wheel';
```

并追加状态与函数：

```ts
/** Canvas 引用 */
const canvasRef = ref<HTMLCanvasElement | null>(null);
/** 当前旋转角（度） */
const rotation = ref(0);
/** 是否旋转中（锁定交互） */
const spinning = ref(false);
/** 最近一次中奖项文本 */
const result = ref<string>('');

/** 有效选项（名称非空），用于绘制与抽取 */
function validItems(): WheelItem[] {
  return items.value.filter((it) => it.text.trim().length > 0);
}

const rng = createCryptoRng();
const CANVAS_SIZE = 320; // CSS 像素

/** 将转盘绘制到 Canvas（按当前 rotation 与有效选项） */
function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const list = validItems();
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const radius = CANVAS_SIZE / 2 - 4;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  if (list.length === 0) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('请添加至少 2 个选项', cx, cy);
    return;
  }

  const sectors = computeSectors(list);
  sectors.forEach((s, i) => {
    const start = toRad(s.startDeg + rotation.value);
    const end = toRad(s.endDeg + rotation.value);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = sliceColor(i, sectors.length);
    ctx.fill();
    // 文字
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(toRad(s.midDeg + rotation.value));
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1f2937';
    ctx.font = '13px sans-serif';
    const label = list[i].text.length > 8 ? list[i].text.slice(0, 7) + '…' : list[i].text;
    ctx.fillText(label, radius - 10, 4);
    ctx.restore();
  });
}

/** easeOutCubic 缓动 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 旋转抽取：先按权重选出中奖项，再以 easeOutCubic 缓动旋转到目标角。
 * 动画结束设置 result，并交由 watch（Task 9）处理不重复移除。
 */
function spin(): void {
  const list = validItems();
  if (spinning.value || list.length < 2) return;
  spinning.value = true;
  result.value = '';

  const winnerIndex = pickWeightedIndex(list.map((it) => it.weight), rng);
  const sectors = computeSectors(list);
  const winnerMid = sectors[winnerIndex].midDeg;
  const start = rotation.value;
  const target = computeTargetRotation(start, winnerMid, 5);
  const duration = 4000;
  const startTime = performance.now();

  function frame(now: number): void {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    rotation.value = start + (target - start) * easeOutCubic(t);
    draw();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation.value = target;
      draw();
      spinning.value = false;
      onSpinEnd(list[winnerIndex]);
    }
  }
  requestAnimationFrame(frame);
}

/** 旋转结束回调（Task 9 填充不重复逻辑，本任务仅记录结果） */
function onSpinEnd(winner: WheelItem): void {
  result.value = winner.text;
}

// 选项变化时重绘（非旋转中）
watch(items, () => {
  if (!spinning.value) {
    void nextTick(() => draw());
  }
}, { deep: true });

onMounted(() => {
  void nextTick(() => draw());
});
```

- [ ] **Step 2: 替换 output 槽模板**

将 `#output` 模板替换为：

```vue
      <template #output>
        <div class="flex flex-col items-center gap-4">
          <div class="relative" :style="{ width: '320px', height: '320px' }">
            <!-- 指针：固定在顶部，指向圆心 -->
            <div
              class="absolute left-1/2 -top-1 -translate-x-1/2 z-10"
              style="width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 18px solid var(--color-accent, #ef4444);"
            ></div>
            <canvas
              ref="canvasRef"
              class="rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
              :style="{ width: '320px', height: '320px' }"
            ></canvas>
          </div>
          <button
            class="px-8 py-2.5 rounded-sm bg-accent text-white text-sm font-medium cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="spinning || validItems().length < 2"
            @click="spin"
          >
            {{ spinning ? '旋转中…' : '开始' }}
          </button>
          <p v-if="result" class="text-base">
            🎉 中奖：<strong class="text-accent">{{ result }}</strong>
          </p>
        </div>
      </template>
```

> 注：`320px` 等固定像素用内联 `:style` 而非 Tailwind 任意值，避免 lint 警告；指针三角用内联 style 表达不可被标准类名表示的几何。

- [ ] **Step 3: 类型检查**

Run: `pnpm astro check`
Expected: 0 errors（与 wheel-picker 相关）。

- [ ] **Step 4: 浏览器验证**

`pnpm dev` → `/text/wheel-picker`：
- 转盘按默认 6 项绘制彩色扇区与文字，顶部指针可见。
- 点「开始」→ 转盘缓动旋转约 4s 后减速停止，指针指向的扇区与「🎉 中奖」文本一致（多试几次核对落点正确）。
- 旋转中「开始」禁用；编辑选项后转盘实时重绘。
- 选项 < 2 时「开始」禁用、转盘提示「请添加至少 2 个选项」。
- 无控制台报错。

- [ ] **Step 5: 提交**

```bash
git add src/tools/text/WheelPicker.vue
git commit -m "feat(wheel): Canvas 转盘渲染与 easeOutCubic 旋转动画"
```

---

### Task 9: 不重复抽取 + 已中奖列表

**Files:**
- Modify: `src/tools/text/WheelPicker.vue`

**Interfaces:**
- Consumes: 已有 `items`、`result`、`onSpinEnd`、`ToggleSwitch`。
- Produces: 状态 `noRepeat`、`wonItems`；函数 `restoreWon`、`resetWon`；`onSpinEnd` 接入移除逻辑。

- [ ] **Step 1: 扩展 script —— 不重复逻辑**

在现有 import 补充 ToggleSwitch：

```ts
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
```

追加状态与函数，并替换 `onSpinEnd`：

```ts
/** 不重复抽取开关，默认开启 */
const noRepeat = ref(true);
/** 已中奖项列表（不重复模式下从 items 移出） */
const wonItems = ref<WheelItem[]>([]);

/** 旋转结束：记录结果；不重复模式下将中奖项移入已中奖列表 */
function onSpinEnd(winner: WheelItem): void {
  result.value = winner.text;
  if (noRepeat.value) {
    const idx = items.value.findIndex(
      (it) => it.text === winner.text && it.weight === winner.weight,
    );
    if (idx !== -1) {
      const [removed] = items.value.splice(idx, 1);
      wonItems.value.push(removed);
      void nextTick(() => draw());
    }
  }
}

/** 将某已中奖项恢复回转盘 */
function restoreWon(index: number): void {
  const [restored] = wonItems.value.splice(index, 1);
  if (restored) {
    items.value.push(restored);
    void nextTick(() => draw());
  }
}

/** 重置：清空已中奖列表（不恢复到 items，避免与现有项重复；由用户决定） */
function resetWon(): void {
  for (const it of wonItems.value) items.value.push(it);
  wonItems.value = [];
  void nextTick(() => draw());
}
```

> 注意：删除原 Task 8 中的 `onSpinEnd` 定义，避免重复声明（本任务的 `onSpinEnd` 取代它）。`clearAll` 也需重置已中奖列表——见 Step 2。

- [ ] **Step 2: 更新 clearAll 重置已中奖**

将 `clearAll` 函数体替换为：

```ts
function clearAll(): void {
  items.value = DEFAULT_ITEMS.map((it) => ({ ...it }));
  wonItems.value = [];
  batchText.value = '';
  result.value = '';
  void nextTick(() => draw());
}
```

- [ ] **Step 3: 模板——开关与已中奖列表**

在 `#input` 模板内、批量导入块**之后**追加：

```vue
          <!-- 不重复抽取开关 -->
          <ToggleSwitch v-model="noRepeat" label="不重复抽取" description="中奖后从转盘移除" />

          <!-- 已中奖列表 -->
          <div v-if="noRepeat && wonItems.length > 0" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[0.8125rem] text-muted">已中奖（{{ wonItems.length }}）</span>
              <button
                class="text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0"
                @click="resetWon"
              >
                全部重置
              </button>
            </div>
            <div
              v-for="(won, index) in wonItems"
              :key="index"
              class="flex items-center justify-between px-2 py-1.5 border border-border rounded-sm bg-card text-sm"
            >
              <span class="truncate">{{ won.text }}</span>
              <button
                class="shrink-0 text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0 ml-2"
                @click="restoreWon(index)"
              >
                恢复
              </button>
            </div>
          </div>
```

- [ ] **Step 4: 类型检查**

Run: `pnpm astro check`
Expected: 0 errors（与 wheel-picker 相关，且无「onSpinEnd 重复声明」错误）。

- [ ] **Step 5: 浏览器验证**

`pnpm dev` → `/text/wheel-picker`：
- 默认开关为「已开启」。抽中后该项从转盘消失、出现在「已中奖」列表，转盘剩余项重新分布。
- 点某项「恢复」→ 回到转盘并重绘。「全部重置」→ 已中奖全部回到转盘。
- 抽到只剩 1 项时「开始」禁用（< 2）。
- 关闭开关后可重复抽中同一项，不再移除。
- 「清空」同时清空已中奖列表与结果。
- 无控制台报错。

- [ ] **Step 6: 提交**

```bash
git add src/tools/text/WheelPicker.vue
git commit -m "feat(wheel): 不重复抽取与已中奖列表恢复"
```

---

### Task 10: 分享链接复制 + ?data= 直接加载

**Files:**
- Modify: `src/tools/text/WheelPicker.vue`

**Interfaces:**
- Consumes: `encodeShare`、`decodeShare`、`useCopy`。
- Produces: 函数 `copyShareLink`、`loadFromUrl`；onMounted 解析 `?data=`；分享按钮。

- [ ] **Step 1: 扩展 script —— 分享逻辑**

在 import 补充：

```ts
import { useCopy } from '../../composables/useCopy';
import { encodeShare, decodeShare } from '../../utils/text/wheel';
```

追加：

```ts
const { copied: linkCopied, copy: copyLink } = useCopy();

/** 分享链接长度护栏阈值 */
const SHARE_URL_MAX = 2000;

/** 生成并复制分享链接（编码当前有效选项及权重） */
async function copyShareLink(): Promise<void> {
  const list = validItems();
  if (list.length < 2) {
    showToast('请先添加至少 2 个选项');
    return;
  }
  const data = encodeShare(list);
  const url = `${window.location.origin}${window.location.pathname}?data=${data}`;
  if (url.length > SHARE_URL_MAX) {
    showToast('选项过多，链接可能在部分平台被截断');
  }
  await copyLink(url);
  if (linkCopied.value) showToast('分享链接已复制');
}

/** 从 URL ?data= 直接解码加载（失败则静默回退默认示例） */
function loadFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');
  if (!data) return;
  try {
    const loaded = decodeShare(data);
    items.value = loaded;
    wonItems.value = [];
    result.value = '';
  } catch {
    showToast('分享链接无效，已载入默认示例');
  }
}
```

并在 `onMounted` 中、`draw()` 之前调用 `loadFromUrl()`：

```ts
onMounted(() => {
  loadFromUrl();
  void nextTick(() => draw());
});
```

> 注意：替换原 Task 8 的 `onMounted`，避免重复。

- [ ] **Step 2: 模板——分享按钮**

在 `#actions` 模板内、`ClearButton` 旁追加：

```vue
        <button
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
          @click="copyShareLink"
        >
          {{ linkCopied ? '已复制' : '复制分享链接' }}
        </button>
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `pnpm astro check`
Expected: 0 errors。

Run: `pnpm build`
Expected: 构建成功。

- [ ] **Step 4: 浏览器验证**

`pnpm dev`：
- 编辑选项（含设置非 1 权重）→ 点「复制分享链接」→ toast「分享链接已复制」。
- 新标签粘贴该链接打开 → 转盘**直接**载入同款选项与权重，无确认弹框。
- 手动把 `?data=` 改成乱码再打开 → 不白屏，toast「分享链接无效」，转盘为默认示例。
- 权重全为 1 时链接较短；含权重时仍能正确还原。
- 无控制台报错。

- [ ] **Step 5: 全量测试 + 提交**

Run: `pnpm test src/utils/text/__tests__/wheel.test.ts`
Expected: 全部 PASS。

```bash
git add src/tools/text/WheelPicker.vue
git commit -m "feat(wheel): 配置分享链接复制与 URL 直接加载"
```

---

## Self-Review

**1. Spec coverage（逐节核对设计文档）：**
- §2 注册/文件结构 → Task 1–6 ✅
- §3 数据模型（WheelItem/items/wonItems/noRepeat/rotation/spinning/result/batchText）→ Task 1、7、8、9 ✅
- §4 布局（列表+批量导入+开关+已中奖+操作栏；右侧转盘+开始+结果）→ Task 7、8、9 ✅
- §5.1 加权随机 → Task 1 ✅；§5.2 扇区 → Task 2 ✅；§5.3 目标旋转 → Task 3 ✅；§5.4 分享编解码 → Task 4 ✅
- §6 easeOutCubic 动画 → Task 8 ✅
- §7 不重复联动 → Task 9 ✅
- §8 分享与 URL 直接渲染、失败回退、长度护栏 → Task 10 ✅
- §9 默认值/校验/上限/必备按钮 → Task 5、7、8 ✅
- §10 自动调色板/高 DPI → Task 5、8 ✅
- §11 测试 → Task 1–5 ✅
- §13 SEO/FAQ → Task 6 ✅

**2. Placeholder scan：** 无 TBD/「适当处理」类占位；所有代码步骤含完整代码。✅

**3. Type consistency：** `WheelItem{text,weight}`、`SectorAngle{startDeg,endDeg,midDeg}`、`pickWeightedIndex`、`computeSectors`、`computeTargetRotation(current,winnerMidDeg,extraTurns)`、`encodeShare/decodeShare`、`parseBatch`、`sliceColor`、`normalizeWeight`、`createCryptoRng`、`DEFAULT_ITEMS`、`MAX_ITEMS` 在定义与消费处签名一致。Task 9 显式提示用新 `onSpinEnd` 取代 Task 8 版本、Task 10 取代 onMounted，避免重复声明。✅
