/**
 * AVIF 编码封装。
 *
 * 浏览器 Canvas 不支持输出 AVIF，故用 @jsquash/avif（Squoosh 的 WASM 编码器）。
 * 该库的 options 不接受 1-100 的 quality，而用 cqLevel（0-63，越小质量越高），
 * 故先经 qualityToCqLevel 纯函数映射。
 */

/**
 * 将 UI 质量值（0-100）映射为 @jsquash/avif 的 cqLevel（0-63）。
 *
 * quality 100 → cqLevel 0（最佳质量），quality 0 → cqLevel 63（最大压缩）。
 * 输入钳制到 0-100 后线性反比映射。
 * @param quality 质量 0-100
 * @returns cqLevel 0-63
 */
export function qualityToCqLevel(quality: number): number {
  const clamped = Math.min(100, Math.max(0, quality));
  return Math.round((1 - clamped / 100) * 63);
}

/**
 * 将 ImageData 编码为 AVIF Blob（懒加载 @jsquash/avif WASM 编码器）。
 *
 * 首次调用时加载 WASM，后续调用复用。大图编码较慢，调用方需展示 loading。
 * @param imageData RGBA 像素数据
 * @param quality 质量 0-100
 * @returns AVIF Blob
 * @throws WASM 加载或编码失败时抛出
 */
export async function encodeAvif(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const { encode } = await import('@jsquash/avif');
  const cqLevel = qualityToCqLevel(quality);
  // @jsquash/avif 的 .d.ts 只声明了 quality 字段，但底层 Squoosh AVIF 编码器
  // 实际接受 cqLevel（0-63，越小质量越高）。Task 1 spike 已在浏览器验证。
  // 此处用类型断言绕过不完整的类型声明。
  const buffer = await encode(imageData, { cqLevel } as never);
  return new Blob([buffer], { type: 'image/avif' });
}
