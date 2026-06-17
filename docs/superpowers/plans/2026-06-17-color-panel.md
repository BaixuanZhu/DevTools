# 颜色面板（Color Panel）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「颜色面板」工具（`/color/panel`），提供 HEX/RGB/HSL/HSV 实时互转、WCAG 对比度检查与和谐配色板。

**Architecture:** 纯函数颜色转换层（`src/utils/color/`，以 RGB 为枢纽）+ Vue 3 组件（`ColorPanel.vue`，单列竖向布局，单一数据源 `currentColor: RGB`）+ Astro 页面（`panel.astro`，`ToolLayout` 自动渲染 SEO/FAQ/相关工具）。无第三方库、无 Web Worker。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">` + Tailwind CSS v4 + vitest（`pnpm test`）。

**Spec:** `docs/superpowers/specs/2026-06-17-color-panel-design.md`

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/utils/color/color-space.ts` | RGB/HSL/HSV 类型 + hex↔rgb↔hsl↔hsv 纯函数 | Create |
| `src/utils/color/__tests__/color-space.test.ts` | 颜色空间转换单测 | Create |
| `src/utils/color/wcag.ts` | 相对亮度 + 对比度 + AA/AAA 判定 | Create |
| `src/utils/color/__tests__/wcag.test.ts` | WCAG 单测 | Create |
| `src/utils/color/color-harmony.ts` | 和谐配色板生成 | Create |
| `src/utils/color/__tests__/color-harmony.test.ts` | 配色板单测 | Create |
| `src/tools/color/ColorPanel.vue` | 工具交互组件 | Create |
| `src/pages/color/panel.astro` | 工具页面（ToolLayout 包裹） | Create |
| `src/data/tools.ts` | 注册 `id='panel'` 工具元数据 | Modify |
| `src/data/tool-faqs.ts` | 注册 `panel` 的 4 条 FAQ | Modify |
| `docs/ROADMAP.md` | 勾选 P1 颜色工具完成 | Modify |

---

## Task 1: color-space.ts — 类型与 HEX↔RGB（TDD）

**Files:**
- Create: `src/utils/color/color-space.ts`
- Test: `src/utils/color/__tests__/color-space.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/utils/color/__tests__/color-space.test.ts`：

```ts
/**
 * 颜色空间转换单元测试。
 */
import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex } from '../color-space';

describe('hexToRgb', () => {
  it('解析 6 位 HEX（带 #）', () => {
    expect(hexToRgb('#3B82F6')).toEqual({ r: 59, g: 130, b: 246 });
  });

  it('解析 6 位 HEX（不带 #、小写）', () => {
    expect(hexToRgb('3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
  });

  it('3 位简写展开为 6 位（#3B8 → #33BB88）', () => {
    expect(hexToRgb('#3B8')).toEqual({ r: 51, g: 187, b: 136 });
  });

  it('前后空白被 trim', () => {
    expect(hexToRgb('  #ff0000  ')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('非法输入返回 null', () => {
    expect(hexToRgb('invalid')).toBeNull();
    expect(hexToRgb('#12345')).toBeNull(); // 5 位
    expect(hexToRgb('#GGGGGG')).toBeNull(); // 非十六进制
    expect(hexToRgb('')).toBeNull();
  });
});

describe('rgbToHex', () => {
  it('输出 6 位小写带 #', () => {
    expect(rgbToHex({ r: 59, g: 130, b: 246 })).toBe('#3b82f6');
  });

  it('纯黑 / 纯白', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  it('越界值钳制到 0–255', () => {
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/utils/color/__tests__/color-space.test.ts`
Expected: FAIL — `Failed to resolve import '../color-space'`（模块尚不存在）

- [ ] **Step 3: 写最小实现**

创建 `src/utils/color/color-space.ts`：

```ts
/**
 * 颜色空间转换纯函数模块。
 *
 * 以 RGB 为枢纽：HEX ⇄ RGB ⇄ HSL/HSV，所有空间互转经 RGB 中转，
 * 避免维护 N×N 转换矩阵。所有函数为纯函数，可独立单测。
 */

/** RGB 颜色，三通道 0–255 整数 */
export interface RGB {
  /** 红色通道 0–255 */
  r: number;
  /** 绿色通道 0–255 */
  g: number;
  /** 蓝色通道 0–255 */
  b: number;
}

/** HSL 颜色，h: 0–360，s/l: 0–100 */
export interface HSL {
  /** 色相 0–360 */
  h: number;
  /** 饱和度 0–100 */
  s: number;
  /** 亮度 0–100 */
  l: number;
}

/** HSV（HSB）颜色，h: 0–360，s/v: 0–100 */
export interface HSV {
  /** 色相 0–360 */
  h: number;
  /** 饱和度 0–100 */
  s: number;
  /** 明度 0–100 */
  v: number;
}

/** HEX 解析正则：3 位或 6 位十六进制，可选 # 前缀，大小写不敏感 */
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * 将单个 RGB 通道值钳制并四舍五入到 0–255 整数。
 * @param n - 原始通道值
 * @returns 0–255 整数
 */
function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * 将 HEX 字符串解析为 RGB。
 *
 * 支持 `#RGB` / `#RRGGBB`（带或不带 `#`、大小写均可）；3 位简写自动展开为 6 位。
 * @param hex - HEX 颜色字符串
 * @returns RGB 对象；非法输入返回 null
 */
export function hexToRgb(hex: string): RGB | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;

  let digits = match[1];
  if (digits.length === 3) {
    // 3 位简写：每字符重复一次展开为 6 位
    digits = digits
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  const num = parseInt(digits, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

/**
 * 将 RGB 转换为 6 位 HEX 字符串（小写，带 #）。
 *
 * 通道值越界时自动钳制到 0–255。
 * @param rgb - RGB 对象
 * @returns 形如 `#rrggbb` 的字符串
 */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/utils/color/__tests__/color-space.test.ts`
Expected: PASS（所有 hexToRgb / rgbToHex 用例通过）

- [ ] **Step 5: 提交**

```bash
git add src/utils/color/color-space.ts src/utils/color/__tests__/color-space.test.ts
git commit -m "feat(color): 新增颜色空间转换 HEX↔RGB"
```

---

## Task 2: color-space.ts — RGB↔HSL（TDD）

**Files:**
- Modify: `src/utils/color/color-space.ts`（追加函数）
- Test: `src/utils/color/__tests__/color-space.test.ts`（追加用例）

- [ ] **Step 1: 追加失败测试**

在 `color-space.test.ts` 顶部 import 中加入 `rgbToHsl, hslToRgb`：

```ts
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../color-space';
```

在文件末尾追加：

```ts
describe('rgbToHsl', () => {
  it('纯红 / 绿 / 蓝', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
  });

  it('纯黑 / 纯白（饱和度为 0）', () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
  });

  it('#3B82F6 → HSL(217, 91, 60)', () => {
    expect(rgbToHsl({ r: 59, g: 130, b: 246 })).toEqual({ h: 217, s: 91, l: 60 });
  });
});

describe('hslToRgb 往返一致性', () => {
  it('hslToRgb(rgbToHsl(x)) 通道差 ≤ 1', () => {
    const samples: Array<{ r: number; g: number; b: number }> = [
      { r: 59, g: 130, b: 246 },
      { r: 128, g: 200, b: 50 },
      { r: 10, g: 10, b: 10 },
    ];
    for (const rgb of samples) {
      const back = hslToRgb(rgbToHsl(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it('纯色还原', () => {
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/utils/color/__tests__/color-space.test.ts`
Expected: FAIL — `rgbToHsl is not a function`（未导出）

- [ ] **Step 3: 追加实现**

在 `color-space.ts` 末尾追加（`clamp255` 已存在，复用；新增 `clampUnit`）：

```ts
/** 将 0–1 范围外的浮点钳制到 [0,1] */
function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * RGB → HSL。
 * @param rgb - RGB 对象
 * @returns HSL 对象（h:0–360, s/l:0–100）
 */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = (((gn - bn) / delta) % 6) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * HSL → RGB。输入越界（h/s/l 超范围）自动钳制。
 * @param hsl - HSL 对象（h:0–360, s/l:0–100）
 * @returns RGB 对象
 */
export function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = (((h % 360) + 360) % 360); // 归一化到 0–360
  const sn = clampUnit(s / 100);
  const ln = clampUnit(l / 100);

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hn < 60) {
    r1 = c; g1 = x;
  } else if (hn < 120) {
    r1 = x; g1 = c;
  } else if (hn < 180) {
    g1 = c; b1 = x;
  } else if (hn < 240) {
    g1 = x; b1 = c;
  } else if (hn < 300) {
    r1 = x; b1 = c;
  } else {
    r1 = c; b1 = x;
  }

  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/utils/color/__tests__/color-space.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/color/color-space.ts src/utils/color/__tests__/color-space.test.ts
git commit -m "feat(color): 新增 RGB↔HSL 转换"
```

---

## Task 3: color-space.ts — RGB↔HSV（TDD）

**Files:**
- Modify: `src/utils/color/color-space.ts`
- Test: `src/utils/color/__tests__/color-space.test.ts`

- [ ] **Step 1: 追加失败测试**

import 改为：

```ts
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb } from '../color-space';
```

末尾追加：

```ts
describe('rgbToHsv', () => {
  it('纯红 / 蓝', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 });
    expect(rgbToHsv({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, v: 100 });
  });

  it('纯黑（饱和度与明度均为 0）', () => {
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
  });

  it('#3B82F6 → HSV(217, 76, 96)', () => {
    expect(rgbToHsv({ r: 59, g: 130, b: 246 })).toEqual({ h: 217, s: 76, v: 96 });
  });
});

describe('hsvToRgb 往返一致性', () => {
  it('hsvToRgb(rgbToHsv(x)) 通道差 ≤ 1', () => {
    const samples: Array<{ r: number; g: number; b: number }> = [
      { r: 59, g: 130, b: 246 },
      { r: 200, g: 50, b: 150 },
    ];
    for (const rgb of samples) {
      const back = hsvToRgb(rgbToHsv(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/utils/color/__tests__/color-space.test.ts`
Expected: FAIL — `rgbToHsv is not a function`

- [ ] **Step 3: 追加实现**

在 `color-space.ts` 末尾追加（`clampUnit`、`clamp255` 已存在）：

```ts
/**
 * RGB → HSV（HSB）。
 * @param rgb - RGB 对象
 * @returns HSV 对象（h:0–360, s/v:0–100）
 */
export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  if (delta !== 0) {
    if (max === rn) {
      h = (((gn - bn) / delta) % 6) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * HSV → RGB。输入越界自动钳制。
 * @param hsv - HSV 对象（h:0–360, s/v:0–100）
 * @returns RGB 对象
 */
export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hn = (((h % 360) + 360) % 360);
  const sn = clampUnit(s / 100);
  const vn = clampUnit(v / 100);

  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hn < 60) {
    r1 = c; g1 = x;
  } else if (hn < 120) {
    r1 = x; g1 = c;
  } else if (hn < 180) {
    g1 = c; b1 = x;
  } else if (hn < 240) {
    g1 = x; b1 = c;
  } else if (hn < 300) {
    r1 = x; b1 = c;
  } else {
    r1 = c; b1 = x;
  }

  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/utils/color/__tests__/color-space.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/color/color-space.ts src/utils/color/__tests__/color-space.test.ts
git commit -m "feat(color): 新增 RGB↔HSV 转换"
```

---

## Task 4: wcag.ts — 相对亮度与对比度（TDD）

**Files:**
- Create: `src/utils/color/wcag.ts`
- Test: `src/utils/color/__tests__/wcag.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/utils/color/__tests__/wcag.test.ts`：

```ts
/**
 * WCAG 对比度计算单元测试。
 */
import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, evaluateWcag } from '../wcag';

describe('relativeLuminance', () => {
  it('纯黑为 0，纯白为 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
  });
});

describe('contrastRatio', () => {
  it('黑白为 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });

  it('同色为 1:1', () => {
    expect(contrastRatio({ r: 59, g: 130, b: 246 }, { r: 59, g: 130, b: 246 })).toBe(1);
  });

  it('#3B82F6 on 白 ≈ 3.68', () => {
    expect(contrastRatio({ r: 59, g: 130, b: 246 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(3.68, 1);
  });
});

describe('evaluateWcag', () => {
  it('3.68：AA 普通不通过、AA 大字通过', () => {
    const r = evaluateWcag(3.68);
    expect(r.aaNormal).toBe(false);
    expect(r.aaLarge).toBe(true);
    expect(r.aaaNormal).toBe(false);
    expect(r.aaaLarge).toBe(false);
  });

  it('4.5 边界：AA 普通 / AA 大字 / AAA 大字均通过', () => {
    const r = evaluateWcag(4.5);
    expect(r.aaNormal).toBe(true);
    expect(r.aaLarge).toBe(true);
    expect(r.aaaNormal).toBe(false);
    expect(r.aaaLarge).toBe(true);
  });

  it('7 边界：AAA 普通通过', () => {
    expect(evaluateWcag(7).aaaNormal).toBe(true);
    expect(evaluateWcag(6.99).aaaNormal).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/utils/color/__tests__/wcag.test.ts`
Expected: FAIL — 无法 resolve `../wcag`

- [ ] **Step 3: 写实现**

创建 `src/utils/color/wcag.ts`：

```ts
/**
 * WCAG 2.x 无障碍对比度计算模块。
 *
 * 实现相对亮度（relative luminance）与对比度比值算法，
 * 并提供 AA / AAA（普通字 / 大字）达标判定。
 */
import type { RGB } from './color-space';

/**
 * 将单个 sRGB 通道（0–255）线性化。
 *
 * 阈值 0.03928 与指数 2.4 遵循 WCAG 2.x 规范。
 * @param c - 通道值 0–255
 * @returns 线性亮度分量 0–1
 */
function linearizeChannel(c: number): number {
  const cn = c / 255;
  return cn <= 0.03928 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

/**
 * 计算单色的相对亮度（WCAG 2.x）。
 * @param rgb - RGB 对象
 * @returns 相对亮度 0–1
 */
export function relativeLuminance({ r, g, b }: RGB): number {
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/**
 * 计算两色的对比度比值（WCAG 2.x）。
 *
 * @param a - 颜色 A
 * @param b - 颜色 B
 * @returns 对比度比值，范围 1.0–21.0
 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 达标判定结果 */
export interface WcagLevels {
  /** AA 普通文字（≥ 4.5） */
  aaNormal: boolean;
  /** AA 大字（≥ 3.0） */
  aaLarge: boolean;
  /** AAA 普通文字（≥ 7.0） */
  aaaNormal: boolean;
  /** AAA 大字（≥ 4.5） */
  aaaLarge: boolean;
}

/**
 * 依 WCAG 阈值判定对比度达标情况。
 * @param ratio - 对比度比值
 * @returns 各等级达标布尔值
 */
export function evaluateWcag(ratio: number): WcagLevels {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/utils/color/__tests__/wcag.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/color/wcag.ts src/utils/color/__tests__/wcag.test.ts
git commit -m "feat(color): 新增 WCAG 对比度计算与达标判定"
```

---

## Task 5: color-harmony.ts — 和谐配色板（TDD）

**Files:**
- Create: `src/utils/color/color-harmony.ts`
- Test: `src/utils/color/__tests__/color-harmony.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/utils/color/__tests__/color-harmony.test.ts`：

```ts
/**
 * 和谐配色板生成单元测试。
 */
import { describe, it, expect } from 'vitest';
import { generateHarmony, HARMONY_LABELS } from '../color-harmony';
import { rgbToHsl } from '../color-space';
import type { RGB } from '../color-space';

const red: RGB = { r: 255, g: 0, b: 0 };

describe('generateHarmony', () => {
  it('互补色：2 色，基色在前，另一色为 +180°', () => {
    const result = generateHarmony(red, 'complementary');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(red);
    expect(rgbToHsl(result[1]).h).toBe(180);
  });

  it('类似色：3 色，基色在前', () => {
    const result = generateHarmony(red, 'analogous');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(red);
  });

  it('三角配色：3 色，色相为 0/120/240', () => {
    const result = generateHarmony(red, 'triadic');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(red);
    expect(rgbToHsl(result[1]).h).toBe(120);
    expect(rgbToHsl(result[2]).h).toBe(240);
  });

  it('分裂互补：3 色', () => {
    const result = generateHarmony(red, 'splitComplementary');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(red);
  });

  it('保持基色的饱和度与亮度', () => {
    const base: RGB = { r: 59, g: 130, b: 246 };
    const baseHsl = rgbToHsl(base);
    for (const color of generateHarmony(base, 'triadic')) {
      const hsl = rgbToHsl(color);
      expect(hsl.s).toBe(baseHsl.s);
      expect(hsl.l).toBe(baseHsl.l);
    }
  });
});

describe('HARMONY_LABELS', () => {
  it('四种方案均有中文标签', () => {
    expect(HARMONY_LABELS.complementary).toBe('互补');
    expect(HARMONY_LABELS.analogous).toBe('类似');
    expect(HARMONY_LABELS.triadic).toBe('三角');
    expect(HARMONY_LABELS.splitComplementary).toBe('分裂互补');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/utils/color/__tests__/color-harmony.test.ts`
Expected: FAIL — 无法 resolve `../color-harmony`

- [ ] **Step 3: 写实现**

创建 `src/utils/color/color-harmony.ts`：

```ts
/**
 * 和谐配色板生成模块。
 *
 * 基于 HSL 色相轮旋转：保持基色的饱和度与亮度，仅按方案偏移色相。
 */
import type { RGB } from './color-space';
import { rgbToHsl, hslToRgb } from './color-space';

/** 和谐配色方案类型 */
export type HarmonyScheme =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'splitComplementary';

/** 各方案相对基色的色相偏移（度），index 0 恒为基色自身 */
const HARMONY_OFFSETS: Record<HarmonyScheme, number[]> = {
  complementary: [0, 180],
  analogous: [0, -30, 30],
  triadic: [0, 120, 240],
  splitComplementary: [0, 150, 210],
};

/** 各方案的中文标签（供 UI 展示） */
export const HARMONY_LABELS: Record<HarmonyScheme, string> = {
  complementary: '互补',
  analogous: '类似',
  triadic: '三角',
  splitComplementary: '分裂互补',
};

/**
 * 基于基色生成和谐配色方案。
 *
 * 保持基色的饱和度与亮度，仅按方案偏移色相。结果数组首项恒为基色本身。
 * @param base - 基色 RGB
 * @param scheme - 配色方案
 * @returns 配色 RGB 数组（含基色）
 */
export function generateHarmony(base: RGB, scheme: HarmonyScheme): RGB[] {
  const { h, s, l } = rgbToHsl(base);
  return HARMONY_OFFSETS[scheme].map((offset) => {
    const newH = (((h + offset) % 360) + 360) % 360;
    return hslToRgb({ h: newH, s, l });
  });
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/utils/color/__tests__/color-harmony.test.ts`
Expected: PASS

- [ ] **Step 5: 全量回归并提交**

Run: `pnpm test src/utils/color/`
Expected: 全部 PASS（color-space / wcag / color-harmony）

```bash
git add src/utils/color/color-harmony.ts src/utils/color/__tests__/color-harmony.test.ts
git commit -m "feat(color): 新增和谐配色板生成"
```

---

## Task 6: 注册工具元数据与 FAQ

**Files:**
- Modify: `src/data/tools.ts`（在 `tools` 数组末尾、`tester` 条目之后追加 `panel`）
- Modify: `src/data/tool-faqs.ts`（在 `toolFaqs` 对象中追加 `panel` 键）

- [ ] **Step 1: 在 tools.ts 注册工具**

在 `src/data/tools.ts` 的 `tools` 数组中，**最后一个工具 `tester` 条目的 `},` 之后、数组闭合 `];` 之前**，插入：

```ts
  {
    id: 'panel',
    name: '颜色面板',
    description: 'HEX/RGB/HSL/HSV 实时互转、WCAG 对比度检查、互补/类似/三角配色板',
    seoDescription: '在线颜色面板工具，支持 HEX/RGB/HSL/HSV 多色彩空间实时互转、WCAG 无障碍对比度检查（AA/AAA 达标判定）与互补/类似/三角配色方案生成，纯浏览器端运算数据不上传。',
    category: '颜色工具',
    icon: '🎨',
    path: '/color/panel',
    keywords: ['颜色转换', 'hex rgb 转换', 'hsl hsv', '颜色对照表', 'wcag 对比度', '无障碍颜色检查', '配色方案', '互补色', '调色板', '颜色搭配', 'color picker'],
    relatedToolIds: ['qr-code-generator'],
  },
```

- [ ] **Step 2: 在 tool-faqs.ts 注册 4 条 FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中，**`tester` 键的数组之后**追加 `panel` 键：

```ts
  panel: [
    {
      question: 'HEX 的 3 位和 6 位写法有什么区别？',
      answer: '3 位 <code>#RGB</code> 是简写，每个字符重复一次展开为 6 位 <code>#RRGGBB</code>（如 <code>#3B8</code> = <code>#33BB88</code>）；6 位为标准写法，每两位表示一个通道。本工具两种写法都支持，大小写不敏感。',
    },
    {
      question: 'HSL 和 HSV 有什么区别？',
      answer: '两者都是基于色相（H）的直观色彩模型，区别在第三维：<strong>HSL</strong> 的 L 是「亮度」，100% 为纯白；<strong>HSV</strong> 的 V 是「明度」，100% 为纯色（饱和度足时最鲜艳）。设计师软件（PS、Figma）多用 HSV，CSS 的 <code>hsl()</code> 函数用的是 HSL。',
    },
    {
      question: 'WCAG 对比度是怎么算的？AA 和 AAA 有什么区别？',
      answer: '先把颜色经 gamma 校正线性化得到「相对亮度」，对比度 = (较亮色 + 0.05) / (较暗色 + 0.05)，范围 1–21（黑白为 21:1）。达标阈值：<strong>AA</strong> 普通文字 ≥ 4.5、大字 ≥ 3.0；<strong>AAA</strong> 更严，普通 ≥ 7.0、大字 ≥ 4.5。「大字」指 ≥ 18pt 或 ≥ 14pt 加粗。',
    },
    {
      question: '配色板的几种和谐配色是什么原理？',
      answer: '都基于色相轮旋转：<strong>互补色</strong> = 对角 180°（最强对比）；<strong>类似色</strong> = ±30°（柔和协调）；<strong>三角配色</strong> = 120° 三等分（活泼均衡）；<strong>分裂互补</strong> = 互补色两侧 ±150°/210°（对比中带协调）。点击任一色块可将其设为当前色继续调整。',
    },
  ],
```

- [ ] **Step 3: 类型检查 + 构建验证**

Run: `pnpm build`
Expected: 构建成功，无类型错误（确认 `category: '颜色工具'`、`id`、`path` 等字段合法）

- [ ] **Step 4: 提交**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(color): 注册颜色面板工具与 FAQ"
```

---

## Task 7: ColorPanel.vue 组件与 panel.astro 页面

**Files:**
- Create: `src/tools/color/ColorPanel.vue`
- Create: `src/pages/color/panel.astro`

- [ ] **Step 1: 创建 Vue 组件**

创建 `src/tools/color/ColorPanel.vue`：

```vue
<script setup lang="ts">
/**
 * 颜色面板工具组件。
 *
 * 单列竖向布局，以「当前色」为单一数据源：顶部色板 + HEX 输入 + 原生选色器；
 * 中部 HEX/RGB/HSL/HSV 四行可编辑分量、实时联动；下方 WCAG 对比度检查与配色板。
 */
import { ref, reactive, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  type RGB,
} from '../../utils/color/color-space';
import { contrastRatio, evaluateWcag } from '../../utils/color/wcag';
import {
  generateHarmony,
  HARMONY_LABELS,
  type HarmonyScheme,
} from '../../utils/color/color-harmony';

/** 默认当前色（Tailwind blue-500） */
const DEFAULT_RGB: RGB = { r: 59, g: 130, b: 246 };

/** 当前色：单一数据源，所有输入框提交后都更新它，再由 watch 同步回各输入框 */
const currentColor = ref<RGB>({ ...DEFAULT_RGB });

/** HEX 输入字符串（本地态，提交时解析） */
const hexInput = ref(rgbToHex(currentColor.value));
const hexError = ref('');

/** RGB 分量输入 */
const rgbInput = reactive({ r: 59, g: 130, b: 246 });
/** HSL 分量输入 */
const hslInput = reactive({ h: 0, s: 0, l: 0 });
/** HSV 分量输入 */
const hsvInput = reactive({ h: 0, s: 0, v: 0 });

/** 对比度背景色 HEX */
const bgHexInput = ref('#FFFFFF');
const bgError = ref('');

/** 配色板当前方案 */
const scheme = ref<HarmonyScheme>('complementary');

/** 配色方案列表（key → 中文标签） */
const schemes = Object.entries(HARMONY_LABELS) as [HarmonyScheme, string][];

/** WCAG 等级展示配置 */
const WCAG_LEVELS = [
  { key: 'aaNormal', label: 'AA 普通' },
  { key: 'aaLarge', label: 'AA 大字' },
  { key: 'aaaNormal', label: 'AAA 普通' },
  { key: 'aaaLarge', label: 'AAA 大字' },
] as const;

// ---- 钳制工具 ----

/** 钳制到 0–255 整数 */
function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n) || 0));
}

/** 钳制到 0–100 整数 */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n) || 0));
}

/** 角度归一化到 0–360 */
function clampAngle(n: number): number {
  return ((((Math.round(n) || 0) % 360) + 360) % 360);
}

// ---- 派生展示值 ----

/** 当前色 HEX（规范化，用于展示与复制） */
const currentHex = computed(() => rgbToHex(currentColor.value));

/** 当前色 CSS（色板背景） */
const currentCss = computed(
  () => `rgb(${currentColor.value.r}, ${currentColor.value.g}, ${currentColor.value.b})`,
);

/** RGB / HSL / HSV 的 CSS 字符串（用于复制） */
const rgbString = computed(
  () => `rgb(${currentColor.value.r}, ${currentColor.value.g}, ${currentColor.value.b})`,
);
const hslString = computed(() => {
  const h = rgbToHsl(currentColor.value);
  return `hsl(${h.h}, ${h.s}%, ${h.l}%)`;
});
const hsvString = computed(() => {
  const h = rgbToHsv(currentColor.value);
  return `hsv(${h.h}, ${h.s}%, ${h.v}%)`;
});

/** 背景色 RGB（解析失败为 null） */
const bgRgb = computed(() => hexToRgb(bgHexInput.value));

/** 背景色 CSS */
const bgCss = computed(() =>
  bgRgb.value ? `rgb(${bgRgb.value.r}, ${bgRgb.value.g}, ${bgRgb.value.b})` : 'transparent',
);

/** 背景色规范化 HEX（供原生选色器 value） */
const bgColorValue = computed(() => (bgRgb.value ? rgbToHex(bgRgb.value) : '#ffffff'));

/** 对比度比值（背景非法时为 null） */
const ratio = computed(() =>
  bgRgb.value ? contrastRatio(currentColor.value, bgRgb.value) : null,
);

/** WCAG 达标判定 */
const wcag = computed(() => (ratio.value === null ? null : evaluateWcag(ratio.value)));

/** 配色板色块 */
const harmonyColors = computed(() => generateHarmony(currentColor.value, scheme.value));

// ---- 同步：currentColor 变化 → 刷新所有输入框 ----

watch(
  currentColor,
  (c) => {
    hexInput.value = rgbToHex(c);
    hexError.value = '';
    rgbInput.r = c.r;
    rgbInput.g = c.g;
    rgbInput.b = c.b;
    const hsl = rgbToHsl(c);
    hslInput.h = hsl.h;
    hslInput.s = hsl.s;
    hslInput.l = hsl.l;
    const hsv = rgbToHsv(c);
    hsvInput.h = hsv.h;
    hsvInput.s = hsv.s;
    hsvInput.v = hsv.v;
  },
  { immediate: true },
);

// ---- 提交：各输入框 → currentColor ----

/** 提交 HEX 输入 */
function commitHex(): void {
  const rgb = hexToRgb(hexInput.value);
  if (!rgb) {
    hexError.value = '请输入合法的 HEX 颜色，如 #3B82F6 或 #3B8';
    return;
  }
  currentColor.value = rgb;
}

/** 提交 RGB 分量 */
function commitRgb(): void {
  currentColor.value = {
    r: clamp255(rgbInput.r),
    g: clamp255(rgbInput.g),
    b: clamp255(rgbInput.b),
  };
}

/** 提交 HSL 分量 */
function commitHsl(): void {
  currentColor.value = hslToRgb({
    h: clampAngle(hslInput.h),
    s: clamp100(hslInput.s),
    l: clamp100(hslInput.l),
  });
}

/** 提交 HSV 分量 */
function commitHsv(): void {
  currentColor.value = hsvToRgb({
    h: clampAngle(hsvInput.h),
    s: clamp100(hsvInput.s),
    v: clamp100(hsvInput.v),
  });
}

/** 原生选色器变更（前景） */
function onPick(event: Event): void {
  const rgb = hexToRgb((event.target as HTMLInputElement).value);
  if (rgb) currentColor.value = rgb;
}

/** 原生选色器变更（背景） */
function onPickBg(event: Event): void {
  bgHexInput.value = (event.target as HTMLInputElement).value;
  bgError.value = '';
}

/** 提交背景色输入 */
function commitBg(): void {
  bgError.value = hexToRgb(bgHexInput.value) ? '' : '请输入合法的 HEX 背景色';
}

/** 配色板色块点击 → 设为当前色 */
function selectHarmony(rgb: RGB): void {
  currentColor.value = { ...rgb };
}

/** 重置为默认色 */
function reset(): void {
  currentColor.value = { ...DEFAULT_RGB };
}
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="颜色面板"
      description="HEX/RGB/HSL/HSV 实时互转、WCAG 对比度检查、互补/类似/三角配色板"
      :show-example="false"
    />

    <!-- ① 顶部色板区 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden mb-4">
      <div
        class="h-24"
        :style="{ backgroundColor: currentCss }"
        role="img"
        aria-label="当前颜色预览"
      ></div>
      <div class="flex items-center gap-2 p-3 flex-wrap">
        <label class="text-sm text-muted shrink-0" for="hex-input">HEX</label>
        <input
          id="hex-input"
          v-model="hexInput"
          type="text"
          class="flex-1 min-w-[140px] px-2 py-1.5 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus:border-accent"
          placeholder="#3B82F6"
          spellcheck="false"
          aria-label="HEX 颜色输入"
          @change="commitHex"
          @keyup.enter="commitHex"
        />
        <input
          type="color"
          :value="currentHex"
          class="w-9 h-9 p-0 border border-border rounded-sm cursor-pointer bg-card"
          aria-label="打开选色器"
          @input="onPick"
        />
        <CopyButton :text="currentHex" />
        <button
          type="button"
          class="px-3 py-1.5 rounded-sm border border-border bg-card text-text text-sm hover:bg-hover transition-[background-color] duration-150 cursor-pointer focus:outline-none"
          @click="reset"
        >
          重置
        </button>
      </div>
      <div v-if="hexError" class="px-3 pb-2 text-[0.75rem] text-error" role="alert">
        {{ hexError }}
      </div>
    </div>

    <!-- ② 空间表示区 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden mb-4">
      <!-- HEX 只读行 -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span class="w-12 text-sm text-muted shrink-0">HEX</span>
        <span class="flex-1 font-mono text-sm text-text">{{ currentHex }}</span>
        <CopyButton :text="currentHex" size="sm" />
      </div>
      <!-- RGB -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span class="w-12 text-sm text-muted shrink-0">RGB</span>
        <div class="flex-1 flex items-center gap-1">
          <input
            v-model.number="rgbInput.r"
            type="number"
            min="0"
            max="255"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="R 通道"
            @change="commitRgb"
          />
          <input
            v-model.number="rgbInput.g"
            type="number"
            min="0"
            max="255"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="G 通道"
            @change="commitRgb"
          />
          <input
            v-model.number="rgbInput.b"
            type="number"
            min="0"
            max="255"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="B 通道"
            @change="commitRgb"
          />
        </div>
        <CopyButton :text="rgbString" size="sm" />
      </div>
      <!-- HSL -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <span class="w-12 text-sm text-muted shrink-0">HSL</span>
        <div class="flex-1 flex items-center gap-1">
          <input
            v-model.number="hslInput.h"
            type="number"
            min="0"
            max="360"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="H 色相"
            @change="commitHsl"
          />
          <input
            v-model.number="hslInput.s"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="S 饱和度"
            @change="commitHsl"
          />
          <input
            v-model.number="hslInput.l"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="L 亮度"
            @change="commitHsl"
          />
        </div>
        <CopyButton :text="hslString" size="sm" />
      </div>
      <!-- HSV -->
      <div class="flex items-center gap-2 px-3 py-2">
        <span class="w-12 text-sm text-muted shrink-0">HSV</span>
        <div class="flex-1 flex items-center gap-1">
          <input
            v-model.number="hsvInput.h"
            type="number"
            min="0"
            max="360"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="H 色相"
            @change="commitHsv"
          />
          <input
            v-model.number="hsvInput.s"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="S 饱和度"
            @change="commitHsv"
          />
          <input
            v-model.number="hsvInput.v"
            type="number"
            min="0"
            max="100"
            class="w-16 px-2 py-1 border border-border rounded-sm bg-card text-text text-sm font-mono focus:outline-none focus:border-accent"
            aria-label="V 明度"
            @change="commitHsv"
          />
        </div>
        <CopyButton :text="hsvString" size="sm" />
      </div>
    </div>

    <!-- ③ WCAG 对比度检查 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden mb-4">
      <div class="px-3 py-1.5 border-b border-border text-[0.8125rem] text-muted">
        WCAG 对比度检查
      </div>
      <div class="p-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">前景</span>
          <span
            class="w-7 h-7 rounded-sm border border-border"
            :style="{ backgroundColor: currentCss }"
          ></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">背景</span>
          <span
            class="w-7 h-7 rounded-sm border border-border"
            :style="{ backgroundColor: bgCss }"
          ></span>
          <input
            v-model="bgHexInput"
            type="text"
            class="w-24 px-2 py-1 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus:border-accent"
            aria-label="背景色 HEX"
            @change="commitBg"
          />
          <input
            type="color"
            :value="bgColorValue"
            class="w-8 h-8 p-0 border border-border rounded-sm cursor-pointer bg-card"
            aria-label="背景选色器"
            @input="onPickBg"
          />
        </div>
      </div>
      <div v-if="bgError" class="px-3 pb-2 text-[0.75rem] text-error" role="alert">
        {{ bgError }}
      </div>
      <div v-else-if="ratio !== null && wcag" class="px-3 pb-3">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-2xl font-semibold text-text">{{ ratio.toFixed(2) }}</span>
          <span class="text-sm text-muted">: 1</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div
            v-for="lvl in WCAG_LEVELS"
            :key="lvl.key"
            :class="[
              'px-2 py-1.5 rounded-sm text-center text-[0.75rem] border',
              wcag[lvl.key]
                ? 'border-success text-success'
                : 'border-border text-muted',
            ]"
          >
            {{ wcag[lvl.key] ? '✅' : '❌' }} {{ lvl.label }}
          </div>
        </div>
        <!-- 示例文字预览（前景=当前色，背景=背景色） -->
        <div class="rounded-sm p-3" :style="{ backgroundColor: bgCss }">
          <p class="text-base m-0 mb-1" :style="{ color: currentCss }">
            The quick brown fox 你好世界 123
          </p>
          <p class="text-lg font-bold m-0" :style="{ color: currentCss }">AaBb 大字示例</p>
        </div>
      </div>
    </div>

    <!-- ④ 配色板 -->
    <div class="border border-border rounded-sm bg-card overflow-hidden">
      <div class="px-3 py-1.5 border-b border-border text-[0.8125rem] text-muted">配色板</div>
      <div class="p-3">
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            v-for="[key, label] in schemes"
            :key="key"
            type="button"
            :class="[
              'px-3 py-1.5 rounded-sm border text-sm cursor-pointer transition-[background-color,border-color] duration-150 focus:outline-none',
              scheme === key
                ? 'bg-accent text-white border-accent'
                : 'bg-card text-muted border-border hover:bg-hover hover:text-text',
            ]"
            @click="scheme = key"
          >
            {{ label }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(c, i) in harmonyColors"
            :key="i"
            type="button"
            class="relative h-14 flex-1 min-w-[80px] rounded-sm border border-border overflow-hidden cursor-pointer focus:outline-none"
            :style="{ backgroundColor: `rgb(${c.r}, ${c.g}, ${c.b})` }"
            :title="rgbToHex(c)"
            :aria-label="`选择颜色 ${rgbToHex(c)}`"
            @click="selectHarmony(c)"
          >
            <span
              class="absolute bottom-1 left-1 right-1 text-[0.625rem] font-mono text-white bg-black/40 px-1 py-0.5 rounded-sm"
              >{{ rgbToHex(c) }}</span
            >
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

> 复制全部走 `CopyButton`（内置 `useCopy`，成功有 ✅ 确认态、失败自动 toast），组件无需再调用剪贴板 API。

- [ ] **Step 2: 创建页面**

创建 `src/pages/color/panel.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import ColorPanel from '../../tools/color/ColorPanel.vue';
---

<ToolLayout toolId="color/panel">
  <ColorPanel client:idle />
</ToolLayout>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build`
Expected: 构建成功，输出中包含 `/color/panel` 页面，无类型 / 模板错误

- [ ] **Step 4: 手动验证（dev 服务器）**

Run: `pnpm dev`，浏览器打开 `http://localhost:4321/color/panel`，确认：
- 默认显示 `#3B82F6` 色板，RGB/HSL/HSV 行数值正确（HSL 217/91/60、HSV 217/76/96）
- 改 RGB 任一通道 → HSL/HSV/HEX 联动更新
- 改 HSL → 其余联动
- HEX 输入非法（如 `xyz`）→ 出现红色错误提示
- 对比度区显示 3.68，徽标为 ❌AA 普通 ✅AA 大字 ❌AAA 普通 ❌AAA 大字
- 配色板切换四种方案、点击色块设为当前色
- 各复制按钮工作正常（成功有 ✅ 反馈）
- 面包屑：首页 › 颜色工具 › 颜色面板；FAQ 4 条；相关工具显示二维码生成器

- [ ] **Step 5: 提交**

```bash
git add src/tools/color/ColorPanel.vue src/pages/color/panel.astro
git commit -m "feat(color): 实现颜色面板页面与交互"
```

---

## Task 8: 全量验证与 ROADMAP 进度更新

**Files:**
- Modify: `docs/ROADMAP.md`（勾选 P1 颜色工具）

- [ ] **Step 1: 全量测试 + 构建**

Run: `pnpm test`
Expected: 全部测试 PASS（含 color 分类 3 个测试文件）

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 2: 更新 ROADMAP 进度**

在 `docs/ROADMAP.md` 的「六、进度追踪 → P1 · 核心空分类补全」中，将：

```markdown
- [ ] 颜色工具：颜色转换器
```

改为：

```markdown
- [x] 颜色工具：颜色面板 — 已完成（2026-06-17）。新建 `/color/panel`，自研颜色转换层（`utils/color/`：color-space 以 RGB 为枢纽的 hex↔rgb↔hsl↔hsv、wcag 相对亮度与 AA/AAA 判定、color-harmony 色相旋转配色板，**未引入第三方库**），单列竖向布局含可编辑四空间联动 + WCAG 对比度检查（3.68 等真实值）+ 互补/类似/三角/分裂互补配色板；配套 4 条 FAQ。P1 收尾，空分类减至 2 个
```

- [ ] **Step 3: 提交**

```bash
git add docs/ROADMAP.md
git commit -m "feat(color): 颜色面板上线，更新 ROADMAP 进度"
```

---

## Self-Review 结论

- **Spec 覆盖**：设计文档各节均有对应 Task —— 转换（Task 1–3）、WCAG（Task 4）、配色板（Task 5）、注册/FAQ（Task 6）、UI 四区块（Task 7）、验收清单（Task 7 Step 4 + Task 8）。
- **占位符**：无 TBD/TODO，所有代码 step 含完整代码。
- **类型一致**：`RGB`/`HSL`/`HSV` 定义于 Task 1，被 Task 2–5 与组件一致引用；`HarmonyScheme`、`WcagLevels`、`HARMONY_LABELS` 命名前后一致。
- **测试期望值**：已手算验证关键值（`#3B82F6`→HSL(217,91,60)/HSV(217,76,96)、对比度 3.68、互补/三角色相），与设计文档（已修正）一致。
