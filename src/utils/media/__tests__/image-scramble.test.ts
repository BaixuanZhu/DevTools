// src/utils/media/__tests__/image-scramble.test.ts
import { describe, it, expect } from 'vitest';
import { validateParams, arnoldScramble, arnoldRestore } from '../image-scramble';

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
