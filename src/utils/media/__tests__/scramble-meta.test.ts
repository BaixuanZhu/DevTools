// src/utils/media/__tests__/scramble-meta.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateSeed,
  encodeParams,
  decodeParams,
  encodeFilename,
  decodeFilename,
  PARAMS_KEY,
  readScrambleMetaFromPng,
} from '../scramble-meta';
import { readTextChunk, writeTextChunk, crc32 } from '../png-metadata';

/** 一个固定的合法 UUID，用于往返断言。 */
const UUID = '11111111-2222-3333-4444-555555555555';

describe('generateSeed', () => {
  it('returns a value matching the standard UUID v4 shape', () => {
    const seed = generateSeed();
    expect(seed).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('produces different values across calls (randomness sanity check)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(generateSeed());
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('encodeParams / decodeParams round-trip', () => {
  it.each([2, 4, 8, 16, 32, 64, 128] as const)(
    'round-trips for blockSize=%s',
    (bs) => {
      const text = encodeParams(UUID, bs);
      const decoded = decodeParams(text);
      expect(decoded).toEqual({ seed: UUID, blockSize: bs });
    },
  );

  it('produces the documented v=1;bs=N;seed=<uuid> format', () => {
    expect(encodeParams(UUID, 8)).toBe(`v=1;bs=8;seed=${UUID}`);
  });
});

describe('decodeParams rejection', () => {
  it('rejects unsupported version (v=2)', () => {
    expect(decodeParams(`v=2;bs=8;seed=${UUID}`)).toBeNull();
  });

  it('rejects invalid blockSize', () => {
    expect(decodeParams(`v=1;bs=3;seed=${UUID}`)).toBeNull();
    expect(decodeParams(`v=1;bs=999;seed=${UUID}`)).toBeNull();
    expect(decodeParams(`v=1;bs=abc;seed=${UUID}`)).toBeNull();
  });

  it('rejects missing fields', () => {
    expect(decodeParams('v=1;bs=8')).toBeNull();
    expect(decodeParams('v=1;seed=abc')).toBeNull();
    expect(decodeParams(`bs=8;seed=${UUID}`)).toBeNull();
    expect(decodeParams('')).toBeNull();
  });

  it('rejects malformed seed (non-uuid)', () => {
    expect(decodeParams('v=1;bs=8;seed=not-a-uuid')).toBeNull();
    // 截断 uuid 同样应被拒绝
    expect(decodeParams('v=1;bs=8;seed=11111111-2222-3333')).toBeNull();
  });

  it('rejects extra segments', () => {
    expect(decodeParams(`v=1;bs=8;seed=${UUID};extra=1`)).toBeNull();
  });
});

describe('encodeFilename / decodeFilename round-trip', () => {
  it.each([2, 8, 128] as const)('round-trips for blockSize=%s', (bs) => {
    const name = encodeFilename('photo', UUID, bs);
    expect(decodeFilename(name)).toEqual({ seed: UUID, blockSize: bs });
  });

  it('strips a trailing extension before matching', () => {
    const name = encodeFilename('photo', UUID, 8) + '.png';
    expect(decodeFilename(name)).toEqual({ seed: UUID, blockSize: 8 });
  });

  it('produces the documented format', () => {
    expect(encodeFilename('photo', UUID, 8)).toBe(`photo-scrambled-bs8-${UUID}`);
  });
});

describe('decodeFilename rejection', () => {
  it('does not match unrelated filenames', () => {
    expect(decodeFilename('photo.png')).toBeNull();
    expect(decodeFilename('photo-scrambled.png')).toBeNull();
    expect(decodeFilename('photo-bs8.png')).toBeNull();
    expect(decodeFilename('random text')).toBeNull();
    expect(decodeFilename('')).toBeNull();
  });

  it('does not false-match text that merely contains -bs8- mid-name', () => {
    // -bs8- 必须位于末尾（uuid 段之前），中段出现的干扰文本不应匹配
    expect(decodeFilename('report-bs8-data.png')).toBeNull();
    expect(decodeFilename(`notes-bs8-${UUID}-extra`)).toBeNull();
  });

  it('rejects invalid blockSize even with valid uuid', () => {
    expect(decodeFilename(`photo-scrambled-bs3-${UUID}.png`)).toBeNull();
  });

  it('REGRESSION: truncated uuid does not match (prevents silent restore failure)', () => {
    // 截短 uuid 是计划中明确标注的坑：文件名兜底还原时种子必须与置乱时完全一致，
    // 截断会让种子对不上。必须确保 decodeFilename 拒绝任何截断形态。
    const truncated = `photo-scrambled-bs8-11111111-2222-3333.png`;
    expect(decodeFilename(truncated)).toBeNull();
    // 仅前 8 段也不行
    expect(decodeFilename('photo-scrambled-bs8-11111111')).toBeNull();
    // 缺一段
    expect(decodeFilename('photo-scrambled-bs8-11111111-2222-3333-4444')).toBeNull();
  });
});

describe('readScrambleMetaFromPng via PNG tEXt', () => {
  /**
   * 构造一张结构合法的最小 PNG（签名 + IHDR + IEND），用于 tEXt 读写断言。
   * IHDR/IDAT 的内容正确性不影响本模块的 chunk 遍历逻辑（只看 type 与 length），
   * 因此 IHDR 的 CRC 用 crc32 正确计算以保持结构完整。
   */
  function buildMinimalPng(): ArrayBuffer {
    const buf = new ArrayBuffer(8 + 25 + 12);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((b, i) => (u8[i] = b));

    // IHDR
    view.setUint32(8, 13, false);
    u8[12] = 0x49; u8[13] = 0x48; u8[14] = 0x44; u8[15] = 0x52; // IHDR
    view.setUint32(16, 1, false); // width
    view.setUint32(20, 1, false); // height
    u8[24] = 8; // bit depth
    u8[25] = 0; // color type
    u8[26] = 0; // compression
    u8[27] = 0; // filter
    u8[28] = 0; // interlace
    view.setUint32(29, crc32(u8.subarray(12, 12 + 4 + 13)), false); // IHDR CRC

    // IEND
    const iendStart = 33;
    view.setUint32(iendStart, 0, false);
    u8[iendStart + 4] = 0x49; u8[iendStart + 5] = 0x45;
    u8[iendStart + 6] = 0x4e; u8[iendStart + 7] = 0x44; // IEND
    view.setUint32(iendStart + 8, crc32(u8.subarray(iendStart + 4, iendStart + 8)), false);
    return buf;
  }

  it('reads back params written via writeTextChunk with PARAMS_KEY', () => {
    const png = buildMinimalPng();
    const encoded = writeTextChunk(png, PARAMS_KEY, encodeParams(UUID, 8));
    // 底层确认：tEXt 内容原样读回
    expect(readTextChunk(encoded, PARAMS_KEY)).toBe(encodeParams(UUID, 8));
    // 领域层封装
    expect(readScrambleMetaFromPng(encoded)).toEqual({ seed: UUID, blockSize: 8 });
  });

  it('returns null when tEXt is absent', () => {
    const png = buildMinimalPng();
    expect(readScrambleMetaFromPng(png)).toBeNull();
  });

  it('returns null (not throw) on corrupted PNG bytes', () => {
    const notPng = new TextEncoder().encode('not a png').buffer;
    expect(readScrambleMetaFromPng(notPng)).toBeNull();
  });

  it('returns null when tEXt exists but payload is invalid', () => {
    const png = buildMinimalPng();
    // 写入一条损坏的 tEXt（缺 seed、版本号错误）
    const encoded = writeTextChunk(png, PARAMS_KEY, 'v=2;bs=8');
    expect(readScrambleMetaFromPng(encoded)).toBeNull();
  });
});
