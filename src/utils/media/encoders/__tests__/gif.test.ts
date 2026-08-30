import { describe, it, expect } from 'vitest';
import { qualityToMaxColors, encodeGif } from '../gif';

/**
 * 构造 ImageData 形状的字面量（encodeGif 仅消费 width/height/data，
 * node 环境无 ImageData 构造器，用结构化字面量直接满足接口）
 */
function makeImageData(width: number, height: number, data: number[]): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(data),
    colorSpace: 'srgb',
  };
}

describe('qualityToMaxColors', () => {
  it('quality=100 映射到上限 256', () => {
    expect(qualityToMaxColors(100)).toBe(256);
  });

  it('值域夹取 [16, 256]：超范围输入不越界', () => {
    expect(qualityToMaxColors(5)).toBe(16);
    expect(qualityToMaxColors(0)).toBe(16);
    expect(qualityToMaxColors(150)).toBe(256);
  });

  it('滑块区间内单调递增（10→100 全程 + 33/67 抽样）', () => {
    expect(qualityToMaxColors(33)).toBeLessThan(qualityToMaxColors(67));
    for (let q = 10; q < 100; q++) {
      expect(qualityToMaxColors(q)).toBeLessThanOrEqual(qualityToMaxColors(q + 1));
    }
    // 全程落在值域内
    for (let q = 10; q <= 100; q++) {
      const v = qualityToMaxColors(q);
      expect(v).toBeGreaterThanOrEqual(16);
      expect(v).toBeLessThanOrEqual(256);
    }
  });
});

describe('encodeGif', () => {
  /** 2×1 测试图：不透明红 + 全透明黑 */
  const pixels = makeImageData(2, 1, [255, 0, 0, 255, 0, 0, 0, 0]);

  /** 定位图形控制扩展（GCE）起始偏移：21 F9 04 三字节签名，紧跟头部与全局色表之后 */
  function findGce(bytes: Uint8Array): number {
    for (let i = 13; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) return i;
    }
    return -1;
  }

  it('输出合法 GIF89a：magic、MIME 与画布尺寸', async () => {
    const blob = await encodeGif(pixels, 80);
    expect(blob.type).toBe('image/gif');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('GIF8');
    // 逻辑屏幕描述符：宽高小端
    expect(bytes[6]).toBe(2); // 宽低字节
    expect(bytes[7]).toBe(0); // 宽高字节
    expect(bytes[8]).toBe(1); // 高低字节
    expect(bytes[9]).toBe(0); // 高高字节
  });

  it('透明像素命中全透明调色板项，GCE 透明标志置位', async () => {
    const blob = await encodeGif(pixels, 80);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // GCE 位于头部 + 全局色表之后（色表大小随调色板项数变化，动态定位）
    const gce = findGce(bytes);
    expect(gce).toBeGreaterThan(0);
    expect(bytes[gce + 3]! & 0b1).toBe(1); // 透明色标志
    expect(bytes[gce + 6]).toBeLessThan(4); // 透明色下标落在调色板表内（2 色 → 2 项表，留裕量）
  });

  it('不透明图不写透明标志', async () => {
    const opaque = makeImageData(2, 1, [255, 0, 0, 255, 0, 255, 0, 255]);
    const blob = await encodeGif(opaque, 80);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const gce = findGce(bytes);
    expect(gce).toBeGreaterThan(0);
    expect(bytes[gce + 3]! & 0b1).toBe(0);
  });

  it('同图低质量体积 ≤ 高质量（质量 → 颜色数 → 体积，量化非严格单调放宽为 ≤）', async () => {
    // 16×16 渐变图，色彩足够多以保证颜色数差异可观察
    const data: number[] = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        data.push(x * 16, y * 16, (x + y) * 8, 255);
      }
    }
    const image = makeImageData(16, 16, data);
    const low = await encodeGif(image, 10);
    const high = await encodeGif(image, 100);
    expect(low.size).toBeLessThanOrEqual(high.size);
  });
});
