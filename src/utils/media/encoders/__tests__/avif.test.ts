import { describe, it, expect } from 'vitest';
import { qualityToCqLevel } from '../avif';

describe('qualityToCqLevel', () => {
  it('quality 100 映射到 cqLevel 0（接近无损）', () => {
    expect(qualityToCqLevel(100)).toBe(0);
  });

  it('quality 越低 cqLevel 越高（质量越差）', () => {
    expect(qualityToCqLevel(50)).toBeGreaterThan(qualityToCqLevel(80));
  });

  it('quality 0 映射到 cqLevel 63（最大压缩）', () => {
    expect(qualityToCqLevel(0)).toBe(63);
  });

  it('超出范围被钳制', () => {
    expect(qualityToCqLevel(150)).toBe(0);
    expect(qualityToCqLevel(-10)).toBe(63);
  });

  it('结果在 0-63 区间内', () => {
    for (const q of [10, 25, 40, 55, 70, 85, 100]) {
      const cq = qualityToCqLevel(q);
      expect(cq).toBeGreaterThanOrEqual(0);
      expect(cq).toBeLessThanOrEqual(63);
    }
  });
});
