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
