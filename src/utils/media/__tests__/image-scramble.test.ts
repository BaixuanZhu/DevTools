// src/utils/media/__tests__/image-scramble.test.ts
import { describe, it, expect } from 'vitest';
import { validateParams, arnoldScramble, arnoldRestore, logisticScramble, logisticRestore, confusionScramble, confusionRestore, makeSquareImageData, scrambleImageData } from '../image-scramble';

function createTestImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i * 7 + 13) % 256;
  }
  return new ImageData(data, width, height);
}

describe('validateParams', () => {
  it('accepts valid params', () => {
    expect(() =>
      validateParams({
        algorithm: 'arnold',
        iterations: 10,
        r: 3.99,
        x0: 0.5,
        seed: 'abc',
        padding: 'expand',
      }),
    ).not.toThrow();
  });

  it('throws on out-of-range iterations', () => {
    expect(() =>
      validateParams({
        algorithm: 'arnold',
        iterations: 0,
        r: 3.99,
        x0: 0.5,
        seed: 'abc',
        padding: 'expand',
      }),
    ).toThrow('迭代次数需在 1 到 50 之间');
  });

  it('rejects NaN r', () => {
    expect(() =>
      validateParams({ algorithm: 'logistic', iterations: 5, r: Number.NaN, x0: 0.5, seed: 'a', padding: 'expand' }),
    ).toThrow('Logistic 控制参数需在 3.57 到 4.0 之间');
  });

  it('rejects NaN x0', () => {
    expect(() =>
      validateParams({ algorithm: 'logistic', iterations: 5, r: 3.99, x0: Number.NaN, seed: 'a', padding: 'expand' }),
    ).toThrow('初始值需在 0 到 1 之间');
  });
});

describe('arnoldScramble', () => {
  it('is reversible', () => {
    const original = createTestImageData(64, 64);
    const originalCopy = new Uint8ClampedArray(original.data);
    const scrambled = arnoldScramble(original, 10);
    const restored = arnoldRestore(scrambled, 10);
    expect(restored.data).toEqual(originalCopy);
  });
});

describe('logisticScramble', () => {
  it('is reversible', () => {
    const original = createTestImageData(32, 32);
    const originalCopy = new Uint8ClampedArray(original.data);
    const scrambled = logisticScramble(original, 3.99, 0.5, 5);
    const restored = logisticRestore(scrambled, 3.99, 0.5, 5);
    expect(restored.data).toEqual(originalCopy);
  });

  it('produces different output with different seeds', () => {
    const original = createTestImageData(32, 32);
    const a = logisticScramble(original, 3.99, 0.5, 5);
    const b = logisticScramble(original, 3.99, 0.5001, 5);
    expect(a.data).not.toEqual(b.data);
  });
});

describe('confusionScramble', () => {
  it('is reversible', () => {
    const original = createTestImageData(32, 32);
    const originalCopy = new Uint8ClampedArray(original.data);
    const scrambled = confusionScramble(original, 'seed-123', 3);
    const restored = confusionRestore(scrambled, 'seed-123', 3);
    expect(restored.data).toEqual(originalCopy);
  });

  it('produces different output with different seeds', () => {
    const original = createTestImageData(32, 32);
    const a = confusionScramble(original, 'seed-a', 3);
    const b = confusionScramble(original, 'seed-b', 3);
    expect(a.data).not.toEqual(b.data);
  });
});

describe('makeSquareImageData', () => {
  it('expands non-square image to square by edge expansion', () => {
    const original = createTestImageData(30, 20);
    const { imageData, originalWidth, originalHeight } = makeSquareImageData(original, 'expand');
    expect(imageData.width).toBe(30);
    expect(imageData.height).toBe(30);
    expect(originalWidth).toBe(30);
    expect(originalHeight).toBe(20);
  });

  it('crops non-square image to square from center', () => {
    const original = createTestImageData(30, 20);
    const { imageData, originalWidth, originalHeight } = makeSquareImageData(original, 'crop');
    expect(imageData.width).toBe(20);
    expect(imageData.height).toBe(20);
    expect(originalWidth).toBe(30);
    expect(originalHeight).toBe(20);
  });
});

describe('scrambleImageData', () => {
  it('scrambles and restores with Arnold + expand (square output)', () => {
    const original = createTestImageData(30, 20);
    const scrambled = scrambleImageData({
      imageData: original,
      mode: 'scramble',
      params: {
        algorithm: 'arnold',
        iterations: 5,
        r: 3.99,
        x0: 0.5,
        seed: 'abc',
        padding: 'expand',
      },
    });
    // expand 不裁切：输出为外扩后的 30×30 正方形
    expect(scrambled.width).toBe(30);
    expect(scrambled.height).toBe(30);

    const restored = scrambleImageData({
      imageData: scrambled.imageData,
      mode: 'restore',
      params: {
        algorithm: 'arnold',
        iterations: 5,
        r: 3.99,
        x0: 0.5,
        seed: 'abc',
        padding: 'expand',
      },
    });
    expect(restored.width).toBe(30);
    expect(restored.height).toBe(30);

    // 内部原始内容区域（offsetY = floor((30-20)/2) = 5，目标行 5..24）应完整还原
    const offsetY = 5;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 30; x++) {
        const origIdx = (y * 30 + x) * 4;
        const restIdx = ((offsetY + y) * 30 + x) * 4;
        expect(restored.imageData.data[restIdx]).toBe(original.data[origIdx]);
        expect(restored.imageData.data[restIdx + 1]).toBe(original.data[origIdx + 1]);
        expect(restored.imageData.data[restIdx + 2]).toBe(original.data[origIdx + 2]);
        expect(restored.imageData.data[restIdx + 3]).toBe(original.data[origIdx + 3]);
      }
    }
  });

  it('rejects zero-dimension image', () => {
    const empty = new ImageData(new Uint8ClampedArray(0), 0, 0);
    expect(() =>
      scrambleImageData({
        imageData: empty,
        mode: 'scramble',
        params: { algorithm: 'arnold', iterations: 1, r: 3.99, x0: 0.5, seed: 'a', padding: 'expand' },
      }),
    ).toThrow('图片尺寸无效');
  });
});
