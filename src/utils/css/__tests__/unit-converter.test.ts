/**
 * CSS 单位转换单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  toPx,
  fromPx,
  convertAll,
  formatNumber,
  isValidNumberInput,
  buildCopyText,
  type UnitKey,
} from '../unit-converter';

const DEFAULT_CONTEXT = {
  rootFontSize: 16,
  designWidth: 375,
  viewportHeight: 812,
};

describe('toPx', () => {
  it('px 转 px 不变', () => {
    expect(toPx(16, 'px', DEFAULT_CONTEXT)).toBe(16);
  });

  it('rem 转 px', () => {
    expect(toPx(1, 'rem', DEFAULT_CONTEXT)).toBe(16);
  });

  it('em 按根 em 语义处理', () => {
    expect(toPx(1, 'em', DEFAULT_CONTEXT)).toBe(16);
  });

  it('vw 转 px', () => {
    expect(toPx(4.2667, 'vw', DEFAULT_CONTEXT)).toBeCloseTo(16, 3);
  });

  it('vh 转 px', () => {
    expect(toPx(1.9704, 'vh', DEFAULT_CONTEXT)).toBeCloseTo(16, 3);
  });

  it('% 转 px', () => {
    expect(toPx(100, 'pct', DEFAULT_CONTEXT)).toBe(16);
  });

  it('pt 转 px', () => {
    expect(toPx(12, 'pt', DEFAULT_CONTEXT)).toBe(16);
  });
});

describe('fromPx', () => {
  it('px 不变', () => {
    expect(fromPx(16, 'px', DEFAULT_CONTEXT)).toBe(16);
  });

  it('px 转 rem', () => {
    expect(fromPx(16, 'rem', DEFAULT_CONTEXT)).toBe(1);
  });

  it('px 转 vw', () => {
    expect(fromPx(16, 'vw', DEFAULT_CONTEXT)).toBeCloseTo(4.2667, 3);
  });

  it('px 转 pt', () => {
    expect(fromPx(16, 'pt', DEFAULT_CONTEXT)).toBe(12);
  });
});

describe('convertAll', () => {
  it('以 px 为源计算全部单位', () => {
    const result = convertAll(16, 'px', DEFAULT_CONTEXT);
    expect(result.px).toBe(16);
    expect(result.rem).toBe(1);
    expect(result.em).toBe(1);
    expect(result.vw).toBeCloseTo(4.2667, 3);
    expect(result.vh).toBeCloseTo(1.9704, 3);
    expect(result.pct).toBe(100);
    expect(result.pt).toBe(12);
  });

  it('以 rem 为源计算全部单位', () => {
    const result = convertAll(1, 'rem', DEFAULT_CONTEXT);
    expect(result.px).toBe(16);
    expect(result.rem).toBe(1);
  });

  it('以 rem 为源且值为 0 时全部单位为 0', () => {
    const result = convertAll(0, 'rem', DEFAULT_CONTEXT);
    expect(result.px).toBe(0);
    expect(result.rem).toBe(0);
    expect(result.em).toBe(0);
    expect(result.vw).toBe(0);
    expect(result.vh).toBe(0);
    expect(result.pct).toBe(0);
    expect(result.pt).toBe(0);
  });

  it('以 vw 为源计算全部单位', () => {
    const result = convertAll(4.2667, 'vw', DEFAULT_CONTEXT);
    expect(result.px).toBeCloseTo(16, 3);
    expect(result.vw).toBeCloseTo(4.2667, 3);
    expect(result.rem).toBeCloseTo(1, 3);
  });
});

describe('formatNumber', () => {
  it('保留最多 4 位小数并去 0', () => {
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(1.23456)).toBe('1.2346');
    expect(formatNumber(4.266666)).toBe('4.2667');
    expect(formatNumber(0)).toBe('0');
  });

  it('大整数不损失精度', () => {
    expect(formatNumber(12345)).toBe('12345');
  });

  it('非有限值返回 —', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
  });
});

describe('isValidNumberInput', () => {
  it('有效非负数通过', () => {
    expect(isValidNumberInput('16')).toBe(true);
    expect(isValidNumberInput('0')).toBe(true);
    expect(isValidNumberInput('4.5')).toBe(true);
  });

  it('空字符串 / 非数字 / 负数不通过', () => {
    expect(isValidNumberInput('')).toBe(false);
    expect(isValidNumberInput('  ')).toBe(false);
    expect(isValidNumberInput('abc')).toBe(false);
    expect(isValidNumberInput('-1')).toBe(false);
  });
});

describe('buildCopyText', () => {
  it('生成多行转换结果', () => {
    const values = {
      px: '16',
      rem: '1',
      em: '1',
      vw: '4.2667',
      vh: '1.9704',
      pct: '100',
      pt: '12',
    };
    const text = buildCopyText(values, 'px' as UnitKey);
    expect(text).toContain('16px = 1rem');
    expect(text).toContain('16px = 4.2667vw');
    expect(text).not.toContain('16px = 16px');
  });
});
