// src/utils/media/__tests__/image-scramble.test.ts
import { describe, it, expect } from 'vitest';
import { validateParams } from '../image-scramble';

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
