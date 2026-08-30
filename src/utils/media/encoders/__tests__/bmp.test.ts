import { describe, it, expect } from 'vitest';
import { encodeBmpBytes } from '../bmp';

/** 2×2 测试图：上排 红/绿，下排 蓝/透明白（RGBA 顺序） */
const PIXELS_2X2 = new Uint8ClampedArray([
  255, 0, 0, 255, // (0,0) 红
  0, 255, 0, 255, // (1,0) 绿
  0, 0, 255, 255, // (0,1) 蓝
  255, 255, 255, 0, // (1,1) 透明白
]);

/** 小端读取 u32 */
function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! +
    bytes[offset + 1]! * 2 ** 8 +
    bytes[offset + 2]! * 2 ** 16 +
    bytes[offset + 3]! * 2 ** 24
  );
}

/** 小端读取 i32（补码） */
function readI32(bytes: Uint8Array, offset: number): number {
  return readU32(bytes, offset) | 0;
}

describe('encodeBmpBytes - 文件头', () => {
  it('以 BM magic 开头', () => {
    const bytes = encodeBmpBytes({ width: 2, height: 2, data: PIXELS_2X2 });
    expect(bytes[0]).toBe(0x42); // 'B'
    expect(bytes[1]).toBe(0x4d); // 'M'
  });

  it('bfOffBits = 122（14B FILEHEADER + 108B V4HEADER）', () => {
    const bytes = encodeBmpBytes({ width: 2, height: 2, data: PIXELS_2X2 });
    expect(readU32(bytes, 10)).toBe(122);
  });

  it('bfSize = 文件总长 = 头 + 像素区', () => {
    const bytes = encodeBmpBytes({ width: 2, height: 2, data: PIXELS_2X2 });
    expect(readU32(bytes, 2)).toBe(bytes.length);
    expect(bytes.length).toBe(122 + 2 * 2 * 4);
  });

  it('V4 头关键段：biSize=108、32bpp、BI_BITFIELDS、sRGB', () => {
    const bytes = encodeBmpBytes({ width: 2, height: 2, data: PIXELS_2X2 });
    expect(readU32(bytes, 14)).toBe(108); // bV4Size
    expect(bytes[28]).toBe(32); // bV4BitCount
    expect(readU32(bytes, 30)).toBe(3); // BI_BITFIELDS
    expect(readU32(bytes, 70)).toBe(0x73524742); // 'sRGB'
  });

  it('四通道掩码：R=0x00FF0000 G=0x0000FF00 B=0x000000FF A=0xFF000000', () => {
    const bytes = encodeBmpBytes({ width: 2, height: 2, data: PIXELS_2X2 });
    expect(readU32(bytes, 54)).toBe(0x00ff0000);
    expect(readU32(bytes, 58)).toBe(0x0000ff00);
    expect(readU32(bytes, 62)).toBe(0x000000ff);
    expect(readU32(bytes, 66)).toBe(0xff000000);
  });

  it('宽高回读：宽为正、高为正（自底向上）', () => {
    const bytes = encodeBmpBytes({ width: 3, height: 5, data: new Uint8ClampedArray(3 * 5 * 4) });
    expect(readI32(bytes, 18)).toBe(3);
    expect(readI32(bytes, 22)).toBe(5);
    expect(readU32(bytes, 34)).toBe(3 * 5 * 4); // bV4SizeImage
  });
});

describe('encodeBmpBytes - 像素区', () => {
  it('RGBA → BGRA 通道序，且自底向上行序（首行像素在缓冲末尾）', () => {
    const bytes = encodeBmpBytes({ width: 2, height: 2, data: PIXELS_2X2 });
    const px = (row: number, col: number) => 122 + (row * 2 + col) * 4;

    // 存储首行 = 源图最后一行（下排）：蓝、透明白
    expect([bytes[px(0, 0)], bytes[px(0, 0) + 1], bytes[px(0, 0) + 2], bytes[px(0, 0) + 3]]).toEqual([
      255, 0, 0, 255, // 蓝: B=255,G=0,R=0,A=255
    ]);
    expect([bytes[px(0, 1)], bytes[px(0, 1) + 1], bytes[px(0, 1) + 2], bytes[px(0, 1) + 3]]).toEqual([
      255, 255, 255, 0, // 透明白: BGRA 不变，A=0
    ]);

    // 存储末行 = 源图首行（上排）：红、绿
    expect([bytes[px(1, 0)], bytes[px(1, 0) + 1], bytes[px(1, 0) + 2], bytes[px(1, 0) + 3]]).toEqual([
      0, 0, 255, 255, // 红: B=0,G=0,R=255,A=255
    ]);
    expect([bytes[px(1, 1)], bytes[px(1, 1) + 1], bytes[px(1, 1) + 2], bytes[px(1, 1) + 3]]).toEqual([
      0, 255, 0, 255, // 绿: B=0,G=255,R=0,A=255
    ]);
  });

  it('透明通道原样保留（不做强制填白）', () => {
    const bytes = encodeBmpBytes({ width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 0]) });
    expect(bytes[122 + 3]).toBe(0);
  });

  it('非法输入抛中文错误', () => {
    expect(() => encodeBmpBytes({ width: 0, height: 2, data: PIXELS_2X2 })).toThrow('宽高');
    expect(() =>
      encodeBmpBytes({ width: 2, height: 2, data: new Uint8ClampedArray(4) }),
    ).toThrow('像素数据长度');
  });
});
