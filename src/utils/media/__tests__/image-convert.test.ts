import { describe, it, expect } from 'vitest';
import { formatBytes, computeScaledSize } from '../image-convert';

describe('formatBytes', () => {
  it('小于 1KB 显示 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('1KB 及以上显示 KB（一位小数）', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('1MB 及以上显示 MB（两位小数）', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });

  it('负数返回 0 B', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });
});

describe('computeScaledSize', () => {
  it('100% 保持原尺寸', () => {
    expect(computeScaledSize(1920, 1080, 100)).toEqual({ width: 1920, height: 1080 });
  });

  it('50% 缩小一半，锁定宽高比', () => {
    expect(computeScaledSize(1920, 1080, 50)).toEqual({ width: 960, height: 540 });
  });

  it('按百分比等比缩放', () => {
    expect(computeScaledSize(1000, 800, 25)).toEqual({ width: 250, height: 200 });
  });

  it('最小为 1px（极小百分比不产生 0）', () => {
    expect(computeScaledSize(10, 10, 1)).toEqual({ width: 1, height: 1 });
  });
});
