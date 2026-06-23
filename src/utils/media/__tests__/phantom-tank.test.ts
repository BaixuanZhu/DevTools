// src/utils/media/__tests__/phantom-tank.test.ts
import { describe, it, expect } from 'vitest';
import { createPhantomTank, validateSameSize, generateSurfaceFromHidden } from '../phantom-tank';

/**
 * 构造一张纯色灰度图（R=G=B=gray，A=255），便于精确断言灰度与 alpha 关系。
 * @param width 宽
 * @param height 高
 * @param gray 灰度值 0-255
 */
function solidGray(width: number, height: number, gray: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    data[i + 3] = 255;
  }
  return new ImageData(data, width, height);
}

describe('validateSameSize', () => {
  it('尺寸一致时不抛错', () => {
    const a = solidGray(10, 10, 128);
    const b = solidGray(10, 10, 0);
    expect(() => validateSameSize(a, b)).not.toThrow();
  });

  it('尺寸不一致时抛中文错', () => {
    const a = solidGray(10, 10, 128);
    const b = solidGray(20, 10, 0);
    expect(() => validateSameSize(a, b)).toThrow('尺寸不一致');
  });
});

describe('createPhantomTank', () => {
  it('输出尺寸与输入一致', () => {
    const a = solidGray(5, 3, 128);
    const b = solidGray(5, 3, 64);
    const out = createPhantomTank({ imageDataA: a, imageDataB: b });
    expect(out.width).toBe(5);
    expect(out.height).toBe(3);
    expect(out.data.length).toBe(5 * 3 * 4);
  });

  it('尺寸不一致时抛错', () => {
    const a = solidGray(5, 5, 128);
    const b = solidGray(4, 5, 64);
    expect(() => createPhantomTank({ imageDataA: a, imageDataB: b })).toThrow('尺寸不一致');
  });

  it('全白表图 + 全黑里图 → 完全透明（白底显白、黑底显黑）', () => {
    const a = solidGray(2, 2, 255); // 白
    const b = solidGray(2, 2, 0); // 黑
    const out = createPhantomTank({ imageDataA: a, imageDataB: b });
    // alpha = 0 - 255 + 255 = 0 → 完全透明
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(0);
      expect(out.data[i + 1]).toBe(0);
      expect(out.data[i + 2]).toBe(0);
      expect(out.data[i + 3]).toBe(0);
    }
  });

  it('相同灰度 → alpha=255 且 RGB 还原为图B', () => {
    const a = solidGray(2, 2, 128);
    const b = solidGray(2, 2, 128);
    const out = createPhantomTank({ imageDataA: a, imageDataB: b });
    // alpha = 128 - 128 + 255 = 255；R_new = 128·255/255 = 128
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(128);
      expect(out.data[i + 3]).toBe(255);
    }
  });

  it('亮表图(200) + 暗里图(100) → 双显数学关系成立', () => {
    const a = solidGray(1, 1, 200);
    const b = solidGray(1, 1, 100);
    const out = createPhantomTank({ imageDataA: a, imageDataB: b });
    // alpha = 100 - 200 + 255 = 155
    const alpha = out.data[3];
    expect(alpha).toBe(155);
    const rNew = out.data[0];
    // 黑底合成（R_new·α/255）应≈图B(100)
    const blackBlend = Math.round((rNew * alpha) / 255);
    expect(blackBlend).toBe(100);
    // 白底合成（R_new·α/255 + 255·(1−α/255)）应≈图A(200)
    const whiteBlend = Math.round((rNew * alpha) / 255 + (255 * (255 - alpha)) / 255);
    expect(whiteBlend).toBe(200);
  });
});

/**
 * 构造一张 1×1 彩色像素图，用于验证色相保持与通道独立运算。
 * @param r 红色 0-255
 * @param g 绿色 0-255
 * @param b 蓝色 0-255
 */
function pixel(r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray([r, g, b, 255]);
  return new ImageData(data, 1, 1);
}

describe('generateSurfaceFromHidden', () => {
  it('输出尺寸与输入一致', () => {
    const img = solidGray(5, 3, 100);
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: img, darken: 0 });
    expect(surface.width).toBe(5);
    expect(surface.height).toBe(3);
    expect(hidden.width).toBe(5);
    expect(hidden.data.length).toBe(img.data.length);
  });

  it('d=0 纯黑像素 → surface 全白、hidden 不变', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: pixel(0, 0, 0), darken: 0 });
    expect(surface.data[0]).toBe(255);
    expect(surface.data[1]).toBe(255);
    expect(surface.data[2]).toBe(255);
    expect(hidden.data[0]).toBe(0);
  });

  it('d=0 中灰(100) → 真反相 La=155', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: solidGray(1, 1, 100), darken: 0 });
    expect(surface.data[0]).toBe(155);
    expect(hidden.data[0]).toBe(100);
  });

  it('d=0 亮灰(200) → 自适应防穿帮 La=max(55,200)=200', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: solidGray(1, 1, 200), darken: 0 });
    expect(surface.data[0]).toBe(200);
    expect(hidden.data[0]).toBe(200);
  });

  it('d=0.5 彩色(200,200,100) → hidden 等比压暗、surface 按压暗后灰度反相、三通道相等', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: pixel(200, 200, 100), darken: 0.5 });
    // hidden 各通道 ×0.5
    expect(hidden.data[0]).toBe(100);
    expect(hidden.data[1]).toBe(100);
    expect(hidden.data[2]).toBe(50);
    // L=0.299·100+0.587·100+0.114·50=94.3 → La=max(160.7,94.3)=160.7 → 取整 161
    expect(surface.data[0]).toBe(161);
    expect(surface.data[1]).toBe(161);
    expect(surface.data[2]).toBe(161);
  });

  it('不变式：任意灰度下 gray(surface) ≥ gray(hidden)（防穿帮契约）', () => {
    for (const gray of [0, 50, 100, 127, 128, 180, 200, 255]) {
      const { surface, hidden } = generateSurfaceFromHidden({ imageData: solidGray(2, 2, gray), darken: 0.3 });
      for (let i = 0; i < surface.data.length; i += 4) {
        const gs = 0.299 * surface.data[i] + 0.587 * surface.data[i + 1] + 0.114 * surface.data[i + 2];
        const gh = 0.299 * hidden.data[i] + 0.587 * hidden.data[i + 1] + 0.114 * hidden.data[i + 2];
        expect(gs).toBeGreaterThanOrEqual(gh - 0.5);
      }
    }
  });

  it('hidden 保持原色相（等比压暗，R:G:B 比值不变）', () => {
    const { hidden } = generateSurfaceFromHidden({ imageData: pixel(200, 200, 100), darken: 0.5 });
    // 原 200:200:100 = 2:2:1；压暗后 100:100:50 = 2:2:1
    expect(hidden.data[0] / hidden.data[2]).toBeCloseTo(2, 1);
    expect(hidden.data[1] / hidden.data[2]).toBeCloseTo(2, 1);
  });

  it('d=0.8 上限：纯白(255) → hidden 压到 51', () => {
    const { hidden } = generateSurfaceFromHidden({ imageData: solidGray(1, 1, 255), darken: 0.8 });
    expect(hidden.data[0]).toBe(51); // 255×0.2=51
  });
});
