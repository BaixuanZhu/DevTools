// src/utils/media/__tests__/image-scramble.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateParams,
  confusionScramble,
  confusionRestore,
  scrambleImageData,
} from '../image-scramble';

/** 构造一张确定性测试图：每个像素按公式填充不同值，便于比对可逆性与打散效果。 */
function createTestImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i * 7 + 13) % 256;
  }
  return new ImageData(data, width, height);
}

/** 构造一张左侧红色块、右侧绿色块的图，用于验证置乱打散效果。 */
function createTwoColorImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x < width / 2) {
        data[idx] = 220;
        data[idx + 1] = 20;
        data[idx + 2] = 20;
      } else {
        data[idx] = 20;
        data[idx + 1] = 220;
        data[idx + 2] = 20;
      }
      data[idx + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

describe('validateParams', () => {
  it('accepts valid params', () => {
    expect(() => validateParams({ seed: 'abc', blockSize: 8 })).not.toThrow();
    for (const size of [2, 4, 8, 16] as const) {
      expect(() => validateParams({ seed: 'abc', blockSize: size })).not.toThrow();
    }
  });

  it('rejects empty seed', () => {
    expect(() => validateParams({ seed: '', blockSize: 8 })).toThrow('请输入混淆种子');
  });

  it('rejects invalid block size', () => {
    expect(() => validateParams({ seed: 'abc', blockSize: 3 as never })).toThrow('块大小');
    expect(() => validateParams({ seed: 'abc', blockSize: 32 as never })).toThrow('块大小');
  });
});

describe('confusionScramble reversibility', () => {
  it.each([
    { size: '30×20, B=2', w: 30, h: 20, b: 2 },
    { size: '30×20, B=4', w: 30, h: 20, b: 4 },
    { size: '30×20, B=8', w: 30, h: 20, b: 8 },
    { size: '64×64, B=8', w: 64, h: 64, b: 8 },
    { size: '33×17, B=16', w: 33, h: 17, b: 16 },
  ])('restores original after scramble→restore ($size)', ({ w, h, b }) => {
    const original = createTestImageData(w, h);
    const originalCopy = new Uint8ClampedArray(original.data);
    const scrambled = confusionScramble(original, 'seed-123', b);
    const restored = confusionRestore(scrambled, 'seed-123', b);
    expect(restored.data).toEqual(originalCopy);
    // 尺寸恒定
    expect(scrambled.width).toBe(w);
    expect(scrambled.height).toBe(h);
    expect(restored.width).toBe(w);
    expect(restored.height).toBe(h);
  });

  it('keeps edge strips (non-multiple dimensions) byte-identical in scrambled output', () => {
    // 30×20, B=8 → 内部块区 24×16（cols=3, rows=2），右边缘 x∈[24,30)、下边缘 y∈[16,20)
    const w = 30;
    const h = 20;
    const b = 8;
    const original = createTestImageData(w, h);
    const scrambled = confusionScramble(original, 'seed-123', b);

    // 右边缘条带（所有行、x∈[24,30)）应原样不动
    for (let y = 0; y < h; y++) {
      for (let x = 24; x < w; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          expect(scrambled.data[idx + c]).toBe(original.data[idx + c]);
        }
      }
    }
    // 下边缘条带（y∈[16,20)、x∈[0,24)）应原样不动
    for (let y = 16; y < h; y++) {
      for (let x = 0; x < 24; x++) {
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          expect(scrambled.data[idx + c]).toBe(original.data[idx + c]);
        }
      }
    }
  });

  it('is a no-op (and still reversible) when image is smaller than block size', () => {
    const original = createTestImageData(3, 3);
    const originalCopy = new Uint8ClampedArray(original.data);
    const scrambled = confusionScramble(original, 'seed', 8);
    expect(scrambled.data).toEqual(originalCopy); // 无完整块 → 空操作
    const restored = confusionRestore(scrambled, 'seed', 8);
    expect(restored.data).toEqual(originalCopy);
  });
});

describe('confusionScramble sensitivity', () => {
  it('produces different output with different seeds', () => {
    const original = createTestImageData(32, 32);
    const a = confusionScramble(original, 'seed-a', 8);
    const b = confusionScramble(original, 'seed-b', 8);
    expect(a.data).not.toEqual(b.data);
  });

  it('produces different output with different block sizes', () => {
    const original = createTestImageData(32, 32);
    const a = confusionScramble(original, 'same-seed', 4);
    const b = confusionScramble(original, 'same-seed', 8);
    expect(a.data).not.toEqual(b.data);
  });

  it('actually disperses a two-color image within the block region', () => {
    // 32×32 两色图，B=4：内置乱块区 32×32 内红绿应被打散，
    // 即块区内同时存在大量「红主导」与「绿主导」的块（不再是左红右绿）。
    const original = createTwoColorImageData(32, 32);
    const scrambled = confusionScramble(original, 'seed-xyz', 4);

    const blockCount = 8 * 8; // 32/4 = 8 列 × 8 行
    let redDominant = 0;
    let greenDominant = 0;
    for (let bi = 0; bi < blockCount; bi++) {
      const bx = (bi % 8) * 4;
      const by = Math.floor(bi / 8) * 4;
      let redPixels = 0;
      let greenPixels = 0;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const idx = ((by + y) * 32 + (bx + x)) * 4;
          if (scrambled.data[idx] > scrambled.data[idx + 1]) redPixels++;
          else greenPixels++;
        }
      }
      if (redPixels > greenPixels) redDominant++;
      else greenDominant++;
    }
    // 原图左半全红、右半全绿 → 各 32 块。置乱后两侧都应有明显占比（不再 32/32 极端分布）
    expect(redDominant).toBeGreaterThan(8);
    expect(greenDominant).toBeGreaterThan(8);
  });
});

describe('scrambleImageData', () => {
  it('round-trips via the unified entry', () => {
    const original = createTestImageData(40, 24);
    const originalCopy = new Uint8ClampedArray(original.data);
    const scrambled = scrambleImageData({
      imageData: original,
      mode: 'scramble',
      params: { seed: 'entry-seed', blockSize: 8 },
    });
    const restored = scrambleImageData({
      imageData: scrambled.imageData,
      mode: 'restore',
      params: { seed: 'entry-seed', blockSize: 8 },
    });
    expect(restored.imageData.data).toEqual(originalCopy);
  });

  it('rejects zero-dimension image', () => {
    const empty = new ImageData(new Uint8ClampedArray(0), 0, 0);
    expect(() =>
      scrambleImageData({
        imageData: empty,
        mode: 'scramble',
        params: { seed: 'a', blockSize: 8 },
      }),
    ).toThrow('图片尺寸无效');
  });
});
