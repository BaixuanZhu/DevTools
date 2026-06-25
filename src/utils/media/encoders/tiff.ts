/**
 * TIFF 编码封装。
 *
 * 浏览器 Canvas 不支持输出 TIFF，故用 utif2 的 encodeImage 将 RGBA 像素
 * 编码为未压缩 TIFF。与 decoders/tiff.ts 对称，统一懒加载 utif2 命名空间。
 */

/**
 * 将 ImageData 编码为 TIFF Blob（懒加载 utif2）。
 *
 * @param imageData RGBA 像素数据
 * @returns TIFF Blob
 * @throws 编码失败时抛出
 */
export async function encodeTiff(imageData: ImageData): Promise<Blob> {
  // utif2 为 CommonJS（module.exports = UTIF）。Vite dev 的 CJS interop 下方法仅挂在
  // default 上（命名导出为 undefined），生产构建则命名空间与 default 兼有。取 default
  // 兜底以保证两种形态都拿到完整的 UTIF 对象。
  const mod = await import('utif2');
  const UTIF = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const { width, height, data } = imageData;
  // ImageData.data 是 Uint8ClampedArray，UTIF.encodeImage 需要 Uint8Array
  const rgba = new Uint8Array(data);
  const buffer = UTIF.encodeImage(rgba, width, height);
  return new Blob([buffer], { type: 'image/tiff' });
}
