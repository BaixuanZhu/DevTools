// src/utils/media/__tests__/watermark.test.ts
import { describe, it, expect } from 'vitest';
import { computeWatermarkPositions } from '../watermark';

describe('computeWatermarkPositions', () => {
  const w = 1000;
  const h = 600;
  const pad = 40;
  const gap = 200;
  const base = { padding: pad, tileGap: gap };

  it('top-left 锚点为左上角加边距，左对齐顶基线', () => {
    const [a] = computeWatermarkPositions(w, h, { ...base, slot: 'top-left' });
    expect(a).toEqual({ x: pad, y: pad, align: 'left', baseline: 'top' });
  });

  it('center 锚点为图中点，居中对齐中基线', () => {
    const [a] = computeWatermarkPositions(w, h, { ...base, slot: 'center' });
    expect(a).toEqual({ x: 500, y: 300, align: 'center', baseline: 'middle' });
  });

  it('bottom-right 锚点为右下角减边距，右对齐底基线', () => {
    const [a] = computeWatermarkPositions(w, h, { ...base, slot: 'bottom-right' });
    expect(a).toEqual({ x: w - pad, y: h - pad, align: 'right', baseline: 'bottom' });
  });

  it('top-center 与 middle-left 等其余位置正确', () => {
    const [tc] = computeWatermarkPositions(w, h, { ...base, slot: 'top-center' });
    expect(tc).toEqual({ x: 500, y: pad, align: 'center', baseline: 'top' });
    const [ml] = computeWatermarkPositions(w, h, { ...base, slot: 'middle-left' });
    expect(ml).toEqual({ x: pad, y: 300, align: 'left', baseline: 'middle' });
  });

  it('tile 平铺返回覆盖整图的网格点，全部居中对齐', () => {
    const anchors = computeWatermarkPositions(w, h, { ...base, slot: 'tile' });
    // cols = ceil(1000/200)+1 = 6，rows = ceil(600/200)+1 = 4 → 24 点
    expect(anchors.length).toBe(24);
    expect(anchors.every((a) => a.align === 'center' && a.baseline === 'middle')).toBe(true);
    expect(anchors[0].x).toBe(0);
    expect(anchors[0].y).toBe(0);
  });

  it('tile 平铺同行相邻点间距等于 tileGap', () => {
    const anchors = computeWatermarkPositions(w, h, { ...base, slot: 'tile' });
    expect(anchors[1].x - anchors[0].x).toBe(gap);
  });
});
