// src/utils/media/__tests__/phantom-tank.test.ts
import { describe, it, expect } from 'vitest';
import { createPhantomTank, validateSameSize } from '../phantom-tank';

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
