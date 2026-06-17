/**
 * WCAG 对比度计算单元测试。
 */
import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio, evaluateWcag } from '../wcag';

describe('relativeLuminance', () => {
  it('纯黑为 0，纯白为 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
  });
});

describe('contrastRatio', () => {
  it('黑白为 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });

  it('同色为 1:1', () => {
    expect(contrastRatio({ r: 59, g: 130, b: 246 }, { r: 59, g: 130, b: 246 })).toBe(1);
  });

  it('#3B82F6 on 白 ≈ 3.68', () => {
    expect(contrastRatio({ r: 59, g: 130, b: 246 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(3.68, 1);
  });
});

describe('evaluateWcag', () => {
  it('3.68：AA 普通不通过、AA 大字通过', () => {
    const r = evaluateWcag(3.68);
    expect(r.aaNormal).toBe(false);
    expect(r.aaLarge).toBe(true);
    expect(r.aaaNormal).toBe(false);
    expect(r.aaaLarge).toBe(false);
  });

  it('4.5 边界：AA 普通 / AA 大字 / AAA 大字均通过', () => {
    const r = evaluateWcag(4.5);
    expect(r.aaNormal).toBe(true);
    expect(r.aaLarge).toBe(true);
    expect(r.aaaNormal).toBe(false);
    expect(r.aaaLarge).toBe(true);
  });

  it('7 边界：AAA 普通通过', () => {
    expect(evaluateWcag(7).aaaNormal).toBe(true);
    expect(evaluateWcag(6.99).aaaNormal).toBe(false);
  });
});
