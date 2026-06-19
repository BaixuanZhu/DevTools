import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  computeScaledSize,
  getOutputMime,
  getOutputExtension,
  isLossless,
  needsFillBackground,
  defaultFormatForInput,
  checkCanvasLimits,
} from '../image-convert';

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

describe('getOutputMime', () => {
  it('格式映射到 MIME', () => {
    expect(getOutputMime('png')).toBe('image/png');
    expect(getOutputMime('jpeg')).toBe('image/jpeg');
    expect(getOutputMime('webp')).toBe('image/webp');
  });
});

describe('getOutputExtension', () => {
  it('jpeg 扩展名用 .jpg', () => {
    expect(getOutputExtension('png')).toBe('.png');
    expect(getOutputExtension('jpeg')).toBe('.jpg');
    expect(getOutputExtension('webp')).toBe('.webp');
  });
});

describe('isLossless', () => {
  it('仅 png 为无损', () => {
    expect(isLossless('png')).toBe(true);
    expect(isLossless('jpeg')).toBe(false);
    expect(isLossless('webp')).toBe(false);
  });
});

describe('needsFillBackground', () => {
  it('仅 jpeg 需要填白底', () => {
    expect(needsFillBackground('jpeg')).toBe(true);
    expect(needsFillBackground('png')).toBe(false);
    expect(needsFillBackground('webp')).toBe(false);
  });
});

describe('defaultFormatForInput', () => {
  it('PNG/JPEG/WebP 保持原格式', () => {
    expect(defaultFormatForInput('image/png')).toBe('png');
    expect(defaultFormatForInput('image/jpeg')).toBe('jpeg');
    expect(defaultFormatForInput('image/webp')).toBe('webp');
  });

  it('其他格式（GIF/BMP/空）默认 WebP', () => {
    expect(defaultFormatForInput('image/gif')).toBe('webp');
    expect(defaultFormatForInput('image/bmp')).toBe('webp');
    expect(defaultFormatForInput('')).toBe('webp');
  });
});

describe('checkCanvasLimits', () => {
  it('正常尺寸通过', () => {
    expect(checkCanvasLimits(1920, 1080)).toEqual({ ok: true });
  });

  it('宽度超限拒绝并带尺寸信息', () => {
    const r = checkCanvasLimits(20000, 1000);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('20000×1000');
  });

  it('高度超限拒绝', () => {
    expect(checkCanvasLimits(1000, 20000).ok).toBe(false);
  });
});
