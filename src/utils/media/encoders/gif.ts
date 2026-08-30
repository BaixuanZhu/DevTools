/**
 * GIF 编码封装（gifenc，懒加载）。
 *
 * 浏览器 Canvas 不支持输出 GIF，故用 gifenc 将 RGBA 像素量化编码为
 * GIF89a 静态单帧。归入「有损」分组：量化调色板本身即有损，
 * 质量滑块的语义映射为调色板颜色数（qualityToMaxColors）。
 *
 * 透明保留：quantize 用 rgba4444 格式（alpha 参与 4bit 量化，clearAlpha
 * 默认把全透明簇清为 [0,0,0,0] 调色板项），writeFrame 显式传该透明项的
 * 下标——gifenc 的 transparentIndex 默认 0，不定位真实下标会把错误的
 * 颜色写成透明色。
 */

/** 质量 → 调色板颜色数上限。线性放大后夹取到 [16, 256]（quality ∈ [10,100]） */
export function qualityToMaxColors(quality: number): number {
  return Math.min(256, Math.max(16, Math.round((quality / 100) * 256)));
}

/**
 * 将 ImageData 编码为静态单帧 GIF Blob（懒加载 gifenc）。
 * @param imageData RGBA 像素数据
 * @param quality 质量 10-100，映射为调色板颜色数上限（低质量 = 少颜色 = 小体积）
 * @returns GIF Blob（image/gif）
 * @throws gifenc 加载或编码失败时抛出
 */
export async function encodeGif(imageData: ImageData, quality: number): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const { width, height, data } = imageData;
  // ImageData.data 是 Uint8ClampedArray，gifenc 接受；显式拷贝为独立 Uint8Array
  // 与 encoders/tiff.ts 的处理一致（隔离源缓冲的潜在非零偏移）
  const rgba = new Uint8Array(data);
  const maxColors = qualityToMaxColors(quality);

  const palette = quantize(rgba, maxColors, { format: 'rgba4444' });
  const index = applyPalette(rgba, palette, 'rgba4444');
  const transparentIndex = palette.findIndex((c) => c[3] === 0);

  const gif = GIFEncoder();
  gif.writeFrame(index, width, height, {
    palette,
    transparent: transparentIndex >= 0,
    transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
  });
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
