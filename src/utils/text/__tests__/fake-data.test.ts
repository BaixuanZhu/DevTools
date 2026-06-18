import { describe, it, expect } from 'vitest';
import { randomInt, pick, shuffle } from '../fake-data';

describe('randomInt', () => {
  it('returns value within [min, max]', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('swaps when min > max', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(7, 3);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('returns min when min === max', () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(pick(arr));
    }
  });

  it('can return every element over many draws', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pick(arr));
    expect(seen.size).toBe(4);
  });
});

describe('shuffle', () => {
  it('preserves elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input', () => {
    const arr = [1, 2, 3];
    const snapshot = [...arr];
    shuffle(arr);
    expect(arr).toEqual(snapshot);
  });
});
