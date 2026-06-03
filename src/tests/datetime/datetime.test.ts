import { describe, it, expect } from 'vitest';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  type DateInfo,
} from '../../utils/datetime/datetime';

describe('detectTimestampUnit', () => {
  it('应将 13 位数字识别为毫秒', () => {
    expect(detectTimestampUnit('1700000000000')).toBe('ms');
  });

  it('应将 10 位数字识别为秒', () => {
    expect(detectTimestampUnit('1700000000')).toBe('s');
  });

  it('应将空字符串返回 null', () => {
    expect(detectTimestampUnit('')).toBeNull();
  });

  it('应将非数字返回 null', () => {
    expect(detectTimestampUnit('abc')).toBeNull();
  });
});

describe('timestampToDateInfo', () => {
  it('应正确解析毫秒时间戳', () => {
    const info = timestampToDateInfo(1700000000000);
    expect(info.iso).toContain('2023');
    expect(info.unixSeconds).toBe(1700000000);
    expect(info.unixMillis).toBe(1700000000000);
  });

  it('应正确解析秒级时间戳转为毫秒后', () => {
    const info = timestampToDateInfo(1700000000 * 1000);
    expect(info.iso).toContain('2023');
    expect(info.unixSeconds).toBe(1700000000);
  });

  it('应包含所有必要字段', () => {
    const info = timestampToDateInfo(Date.now());
    expect(info).toHaveProperty('iso');
    expect(info).toHaveProperty('local');
    expect(info).toHaveProperty('utc');
    expect(info).toHaveProperty('relative');
    expect(info).toHaveProperty('unixSeconds');
    expect(info).toHaveProperty('unixMillis');
  });
});

describe('parseDateInput', () => {
  it('应解析 ISO 日期字符串', () => {
    const info = parseDateInput('2023-11-14T12:00:00.000Z');
    expect(info).not.toBeNull();
    expect(info!.unixSeconds).toBeGreaterThan(0);
  });

  it('应返回 null 对于无效输入', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('invalid')).toBeNull();
  });
});
