/**
 * 时间差 / 倒计时相关纯函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  parseFlexibleTimeInput,
  computeDuration,
  formatDurationParts,
} from '../datetime';

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

  it('解析无秒日期 yyyy/MM/dd HH:mm', () => {
    const expected = dayjs('2026/06/16 12:00', 'YYYY/MM/DD HH:mm').valueOf();
    expect(parseFlexibleTimeInput('2026/06/16 12:00')).toBe(expected);
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

describe('computeDuration', () => {
  it('相同时间 sign 为 0', () => {
    const d = computeDuration(1000, 1000);
    expect(d.sign).toBe(0);
    expect(d.totalSeconds).toBe(0);
  });

  it('a 晚于 b 时 sign 为 1', () => {
    expect(computeDuration(2000, 1000).sign).toBe(1);
  });

  it('a 早于 b 时 sign 为 -1', () => {
    expect(computeDuration(1000, 2000).sign).toBe(-1);
  });

  it('正确拆解天/时/分/秒', () => {
    // 1天2时3分4秒 = 86400 + 7200 + 180 + 4 = 93784 秒
    const d = computeDuration(93784000, 0);
    expect(d).toMatchObject({ days: 1, hours: 2, minutes: 3, seconds: 4 });
    expect(d.totalSeconds).toBe(93784);
  });

  it('忽略毫秒部分（向下取整）', () => {
    const d = computeDuration(1500, 0);
    expect(d.seconds).toBe(1);
    expect(d.totalSeconds).toBe(1);
  });

  it('sign 取决于方向，拆解值始终为绝对值', () => {
    const d = computeDuration(0, 93784000);
    expect(d.sign).toBe(-1);
    expect(d.days).toBe(1);
    expect(d.hours).toBe(2);
  });

  it('跨年大跨度正确拆解', () => {
    // 2025/01/01 → 2027/01/01，跨两个非闰年整年 = 730 天
    const a = dayjs('2027/01/01 00:00:00', 'YYYY/MM/DD HH:mm:ss').valueOf();
    const b = dayjs('2025/01/01 00:00:00', 'YYYY/MM/DD HH:mm:ss').valueOf();
    const d = computeDuration(a, b);
    expect(d.sign).toBe(1);
    expect(d).toMatchObject({ days: 730, hours: 0, minutes: 0, seconds: 0 });
    expect(d.totalSeconds).toBe(730 * 86400);
  });
});

describe('formatDurationParts', () => {
  it('全 0 返回 0秒', () => {
    expect(formatDurationParts(computeDuration(0, 0))).toBe('0秒');
  });

  it('仅秒', () => {
    expect(formatDurationParts(computeDuration(5000, 0))).toBe('5秒');
  });

  it('天时分秒组合', () => {
    expect(formatDurationParts(computeDuration(93784000, 0))).toBe('1天 2时 3分 4秒');
  });
});
