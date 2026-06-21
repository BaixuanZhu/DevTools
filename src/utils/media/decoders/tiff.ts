import type { LoadedImage } from '../image-convert';

/**
 * 解码 TIFF 文件为 LoadedImage。
 *
 * 浏览器原生 createImageBitmap 不支持 TIFF，故用 utif2 解码为 RGBA，
 * 再经 createImageBitmap(imageData) 统一回 ImageBitmap 接口，
 * 使下游 convertImage 无需感知格式差异。
 *
 * @param file TIFF 图片文件
 * @returns 加载后的位图与原始尺寸
 * @throws 文件损坏或为不支持的 TIFF 子格式时抛出
 */
export async function decodeTiff(file: File): Promise<LoadedImage> {
  const UTIF = await import('utif2');
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (ifds.length === 0) {
    throw new Error('TIFF 文件解析失败：未找到图像数据');
  }
  const first = ifds[0];
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);
  const { width, height } = first;
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  const bitmap = await createImageBitmap(imageData);
  return { bitmap, width, height };
}
