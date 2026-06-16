/**
 * 时间差 / 倒计时相关纯函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { parseFlexibleTimeInput } from '../datetime';

describe('parseFlexibleTimeInput', () => {
  it('解析 10 位秒级时间戳', () => {
    expect(parseFlexibleTimeInput('1700000000')).toBe(1700000000000);
  });

  it('解析 13 位毫秒级时间戳', () => {
    expect(parseFlexibleTimeInput('1700000000000')).toBe(1700000000000);
  });

  it('解析标准日期 yyyy/MM/dd HH:mm:ss', () => {
    const expected = dayjs('2026/06/16 12:00:00', 'YYYY/MM/DD HH:mm:ss').valueOf();
    expect(parseFlexibleTimeInput('2026/06/16 12:00:00')).toBe(expected);
  });

  it('容忍首尾空白', () => {
    expect(parseFlexibleTimeInput('  1700000000  ')).toBe(1700000000000);
  });

  it('空字符串返回 null', () => {
    expect(parseFlexibleTimeInput('')).toBeNull();
    expect(parseFlexibleTimeInput('   ')).toBeNull();
  });

  it('非法输入返回 null', () => {
    expect(parseFlexibleTimeInput('hello')).toBeNull();
    expect(parseFlexibleTimeInput('2026-06-16')).toBeNull();
  });
});
