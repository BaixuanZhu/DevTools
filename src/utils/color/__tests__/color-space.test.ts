/**
 * 颜色空间转换单元测试。
 */
import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../color-space';

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
