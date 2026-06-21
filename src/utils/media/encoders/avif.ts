/**
 * AVIF 编码封装。
 *
 * 浏览器 Canvas 不支持输出 AVIF，故用 @jsquash/avif（Squoosh 的 WASM 编码器）。
 * 该库的 EncodeOptions 暴露 `quality`（0-100，越大质量越好，default 50），
 * 与 UI 质量值（10-100）语义一致，故直接透传、无需映射。
 */

/**
 * 将 ImageData 编码为 AVIF Blob（懒加载 @jsquash/avif WASM 编码器）。
 *
 * 首次调用时加载 WASM，后续调用复用。大图编码较慢，调用方需展示 loading。
 * @param imageData RGBA 像素数据
 * @param quality 质量 0-100（越大越好），透传给 @jsquash/avif 的 quality 字段
 * @returns AVIF Blob
 * @throws WASM 加载或编码失败时抛出
 */
export async function encodeAvif(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const { encode } = await import('@jsquash/avif');
  const buffer = await encode(imageData, { quality });
  return new Blob([buffer], { type: 'image/avif' });
}
