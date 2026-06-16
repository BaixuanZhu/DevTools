/**
 * datetime-local 选择器取值与显示格式之间的转换函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import { displayToIso, isoToDisplay } from '../datetime';

describe('displayToIso', () => {
  it('合法显示格式转为 datetime-local 取值', () => {
    expect(displayToIso('2026/06/16 12:00:00')).toBe('2026-06-16T12:00:00');
  });

  it('容忍首尾空白', () => {
    expect(displayToIso('  2026/06/16 12:00:00  ')).toBe('2026-06-16T12:00:00');
  });

  it('非法格式返回空串', () => {
    expect(displayToIso('hello')).toBe('');
    expect(displayToIso('2026-06-16')).toBe('');
    expect(displayToIso('')).toBe('');
  });
});

describe('isoToDisplay', () => {
  it('datetime-local 取值转为显示格式', () => {
    expect(isoToDisplay('2026-06-16T12:00:00')).toBe('2026/06/16 12:00:00');
  });

  it('空串返回空串', () => {
    expect(isoToDisplay('')).toBe('');
  });
});

describe('displayToIso 与 isoToDisplay 双向一致', () => {
  it('显示串经 ISO 中转后回到原值', () => {
    const display = '2026/06/16 12:00:00';
    expect(isoToDisplay(displayToIso(display))).toBe(display);
  });
});
