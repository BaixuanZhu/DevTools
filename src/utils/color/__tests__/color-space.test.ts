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
