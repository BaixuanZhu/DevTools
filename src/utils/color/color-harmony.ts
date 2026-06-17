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
