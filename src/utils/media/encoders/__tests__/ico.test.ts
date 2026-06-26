import { describe, it, expect } from 'vitest';
import { computeCoverCrop, type IcoAnchor } from '../ico';

describe('computeCoverCrop', () => {
  it('正方形图任意锚点都取整图（无偏移）', () => {
    const anchors: IcoAnchor[] = ['top-left', 'center', 'bottom-right'];
    for (const a of anchors) {
      expect(computeCoverCrop(100, 100, a)).toEqual({ sx: 0, sy: 0, size: 100 });
    }
  });

  it('横图（宽>高）按水平锚点决定 sx，sy 恒为 0', () => {
    // 200×100：size=100，水平多余 100
    expect(computeCoverCrop(200, 100, 'middle-left')).toEqual({ sx: 0, sy: 0, size: 100 });
    expect(computeCoverCrop(200, 100, 'center')).toEqual({ sx: 50, sy: 0, size: 100 });
    expect(computeCoverCrop(200, 100, 'middle-right')).toEqual({ sx: 100, sy: 0, size: 100 });
  });

  it('竖图（高>宽）按垂直锚点决定 sy，sx 恒为 0', () => {
    // 100×200：size=100，垂直多余 100
    expect(computeCoverCrop(100, 200, 'top-center')).toEqual({ sx: 0, sy: 0, size: 100 });
    expect(computeCoverCrop(100, 200, 'center')).toEqual({ sx: 0, sy: 50, size: 100 });
    expect(computeCoverCrop(100, 200, 'bottom-center')).toEqual({ sx: 0, sy: 100, size: 100 });
  });

  it('四角锚点同时定位水平与垂直偏移', () => {
    // 200×120：size=120，水平多余 80、垂直多余 0
    expect(computeCoverCrop(200, 120, 'top-left')).toEqual({ sx: 0, sy: 0, size: 120 });
    expect(computeCoverCrop(200, 120, 'top-right')).toEqual({ sx: 80, sy: 0, size: 120 });
    // 120×200：size=120，水平多余 0、垂直多余 80
    expect(computeCoverCrop(120, 200, 'bottom-left')).toEqual({ sx: 0, sy: 80, size: 120 });
    expect(computeCoverCrop(120, 200, 'bottom-right')).toEqual({ sx: 0, sy: 80, size: 120 });
  });
});
