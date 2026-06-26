import { describe, it, expect } from 'vitest';
import { normalizeWeight, pickWeightedIndex } from '../wheel';

describe('normalizeWeight', () => {
  it('保留正有限值', () => {
    expect(normalizeWeight(3)).toBe(3);
    expect(normalizeWeight(0.5)).toBe(0.5);
  });
  it('非正或非有限回退为 1', () => {
    expect(normalizeWeight(0)).toBe(1);
    expect(normalizeWeight(-2)).toBe(1);
    expect(normalizeWeight(NaN)).toBe(1);
    expect(normalizeWeight(Infinity)).toBe(1);
  });
});

describe('pickWeightedIndex', () => {
  it('按前缀和命中对应下标', () => {
    // weights [1,1,2] 总和 4；落点用固定 rng 序列
    const seq = [0.0, 0.24, 0.49, 0.99];
    let i = 0;
    const rng = () => seq[i++];
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(0); // 0.0*4=0  -> idx0 [0,1)
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(0); // 0.24*4=0.96 -> idx0
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(1); // 0.49*4=1.96 -> idx1 [1,2)
    expect(pickWeightedIndex([1, 1, 2], rng)).toBe(2); // 0.99*4=3.96 -> idx2 [2,4)
  });
  it('权重不等时高权重命中更频繁', () => {
    const weights = [1, 9];
    let hits1 = 0;
    let n = 0;
    const rng = () => (n++ % 10) / 10; // 0,0.1,...,0.9
    let high = 0;
    for (let k = 0; k < 10; k++) {
      if (pickWeightedIndex(weights, rng) === 1) high++;
    }
    expect(high).toBe(9); // 总和10，仅落点0.0命中idx0，其余命中idx1
  });
});
