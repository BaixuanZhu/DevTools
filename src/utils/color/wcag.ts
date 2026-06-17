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
