// src/utils/media/__tests__/png-metadata.test.ts
import { describe, it, expect } from 'vitest';
import { crc32, isPng, readTextChunk, writeTextChunk } from '../png-metadata';

/**
 * 构造一张合法的最小 PNG 字节缓冲区：签名 + IHDR + IEND。
 *
 * IHDR 描述 1×1 8 位灰度图（仅用于让 PNG 结构合法，不参与像素断言），
 * IEND 为终止块。字节中的 CRC 在构造时按 PNG 规范实时计算，避免硬编码错误。
 *
 * @returns 1×1 最小 PNG 字节
 */
function buildMinimalPng(): ArrayBuffer {
  const buf = new ArrayBuffer(8 + 25 + 12);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // 签名
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  sig.forEach((b, i) => (u8[i] = b));

  // IHDR：length=13, type=IHDR, 13B data, CRC
  view.setUint32(8, 13, false); // length
  u8[12] = 0x49; // I
  u8[13] = 0x48; // H
  u8[14] = 0x44; // D
  u8[15] = 0x52; // R
  // IHDR data: width(4) height(4) bitDepth(1) colorType(1) compression(1) filter(1) interlace(1)
  view.setUint32(16, 1, false); // width=1
  view.setUint32(20, 1, false); // height=1
  u8[24] = 8; // bit depth
  u8[25] = 0; // color type (grayscale)
  u8[26] = 0; // compression
  u8[27] = 0; // filter
  u8[28] = 0; // interlace
  const ihdrCrc = crc32(u8.subarray(12, 12 + 4 + 13));
  view.setUint32(29, ihdrCrc, false);

  // IEND：length=0, type=IEND, CRC
  const iendStart = 33;
  view.setUint32(iendStart, 0, false); // length=0
  u8[iendStart + 4] = 0x49; // I
  u8[iendStart + 5] = 0x45; // E
  u8[iendStart + 6] = 0x4e; // N
  u8[iendStart + 7] = 0x44; // D
  const iendCrc = crc32(u8.subarray(iendStart + 4, iendStart + 8));
  view.setUint32(iendStart + 8, iendCrc, false);

  return buf;
}

describe('crc32', () => {
  it('matches the standard check value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('returns an unsigned 32-bit value', () => {
    const v = crc32(new TextEncoder().encode('anything'));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('isPng', () => {
  it('returns true for valid PNG signature', () => {
    expect(isPng(buildMinimalPng())).toBe(true);
  });

  it('returns false for non-PNG bytes', () => {
    const buf = new TextEncoder().encode('not a png').buffer;
    expect(isPng(buf)).toBe(false);
  });

  it('returns false for too-short buffer', () => {
    expect(isPng(new ArrayBuffer(4))).toBe(false);
  });
});

describe('writeTextChunk + readTextChunk round-trip', () => {
  it('writes and reads back a tEXt chunk with the given keyword', () => {
    const png = buildMinimalPng();
    const out = writeTextChunk(png, 'ScrambleParams', 'v=1;bs=8;seed=abc');
    expect(readTextChunk(out, 'ScrambleParams')).toBe('v=1;bs=8;seed=abc');
  });

  it('returns null when the keyword is absent', () => {
    const png = buildMinimalPng();
    const out = writeTextChunk(png, 'ScrambleParams', 'v=1;bs=8;seed=abc');
    expect(readTextChunk(out, 'OtherKeyword')).toBeNull();
  });

  it('inserts the new chunk before IEND (IEND remains the last chunk)', () => {
    const png = buildMinimalPng();
    const originalSize = png.byteLength;
    const out = writeTextChunk(png, 'ScrambleParams', 'v=1;bs=8;seed=abc');
    // 体积应增加恰好一个 tEXt chunk：12B 头尾 + keyword(13) + 0x00(1) + text(15)
    const keywordLen = 'ScrambleParams'.length;
    const textLen = 'v=1;bs=8;seed=abc'.length;
    const expectedDelta = 12 + keywordLen + 1 + textLen;
    expect(out.byteLength).toBe(originalSize + expectedDelta);

    // 最后 12 字节为 IEND chunk（4B length=0 + 4B type "IEND" + 4B CRC），
    // 因此 IEND 类型从倒数第 8 字节开始
    const outU8 = new Uint8Array(out);
    const len = out.byteLength;
    expect(outU8[len - 8]).toBe(0x49); // I
    expect(outU8[len - 7]).toBe(0x45); // E
    expect(outU8[len - 6]).toBe(0x4e); // N
    expect(outU8[len - 5]).toBe(0x44); // D
    // IEND 的 length 字段应为 0
    expect(new DataView(out).getUint32(len - 12, false)).toBe(0);
  });

  it('produces a buffer that still parses as PNG (signature intact)', () => {
    const png = buildMinimalPng();
    const out = writeTextChunk(png, 'ScrambleParams', 'hello');
    expect(isPng(out)).toBe(true);
  });

  it('multiple writes do not overwrite each other (multiple tEXt chunks coexist)', () => {
    // 先写入 ScrambleParams，再写入 Comment；读取 ScrambleParams 仍应命中首次写入的值
    const png = buildMinimalPng();
    const step1 = writeTextChunk(png, 'ScrambleParams', 'v=1;bs=8;seed=abc');
    const step2 = writeTextChunk(step1, 'Comment', 'hello world');
    expect(readTextChunk(step2, 'ScrambleParams')).toBe('v=1;bs=8;seed=abc');
    expect(readTextChunk(step2, 'Comment')).toBe('hello world');
  });
});

describe('error handling', () => {
  it('writeTextChunk throws on non-PNG input', () => {
    const buf = new TextEncoder().encode('not png').buffer;
    expect(() => writeTextChunk(buf, 'K', 'v')).toThrow('非 PNG');
  });

  it('readTextChunk throws on non-PNG input', () => {
    const buf = new TextEncoder().encode('not png').buffer;
    expect(() => readTextChunk(buf, 'K')).toThrow('非 PNG');
  });

  it('writeTextChunk throws when IEND is missing', () => {
    // 截断掉 IEND 的 PNG：只保留签名 + IHDR
    const full = buildMinimalPng();
    const truncated = full.slice(0, 8 + 25);
    expect(() => writeTextChunk(truncated, 'K', 'v')).toThrow('PNG 结构损坏');
  });
});
