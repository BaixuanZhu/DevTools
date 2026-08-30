/**
 * BMP 编码器（自研，无第三方依赖）。
 *
 * 输出 32 位未压缩 BMP：BITMAPFILEHEADER(14B) + BITMAPV4HEADER(108B) + 像素区。
 * 选 V4 头而非 40B 头 + 3 通道掩码的原因：后者 GDI 会忽略 alpha，透明通道丢失；
 * V4 头在文件内显式声明四通道掩码，GIMP / Photoshop / 浏览器均可正确读取透明。
 *
 * 字节布局（全部小端）：
 * - 偏移 0   'BM' magic
 * - 偏移 2   bfSize u32 = 文件总长
 * - 偏移 10  bfOffBits u32 = 122（头总长）
 * - 偏移 14  bV4Size u32 = 108
 * - 偏移 18  bV4Width i32 / 偏移 22  bV4Height i32（正值 = 自底向上行序）
 * - 偏移 26  planes u16 = 1 / 偏移 28  bitCount u16 = 32
 * - 偏移 30  compression u32 = 3（BI_BITFIELDS）
 * - 偏移 34  imageSize u32 = w*h*4
 * - 偏移 54~69 R/G/B/A 四通道掩码
 * - 偏移 70  CSType u32 = 0x73524742（'sRGB'）
 * - 偏移 122 像素区：RGBA → BGRA，自底向上（首行像素在缓冲末尾）
 */

/** 文件头总长：BITMAPFILEHEADER 14B + BITMAPV4HEADER 108B */
const BMP_HEADER_SIZE = 122;

/** BMP 编码输入的像素描述（与 ImageData 的关键子集同构，便于 node 单测） */
export interface BmpPixels {
  /** 像素宽 */
  width: number;
  /** 像素高 */
  height: number;
  /** RGBA 像素字节（长度 ≥ width * height * 4），通道顺序 R,G,B,A */
  data: ArrayLike<number>;
}

/**
 * 将 RGBA 像素编码为 32 位 BMP 字节（纯函数，node 可单测）。
 *
 * 32bpp 行天然 4 字节对齐，无需行尾补零；透明通道按 V4 头掩码原样保留。
 * @param pixels 宽高与 RGBA 像素数据
 * @returns 完整 BMP 文件字节（本函数新建缓冲，确保底层为可入 Blob 的 ArrayBuffer）
 * @throws 宽高非法或像素数据长度与尺寸不符时抛出
 */
export function encodeBmpBytes(pixels: BmpPixels): Uint8Array<ArrayBuffer> {
  const { width, height, data } = pixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('BMP 编码失败：宽高必须为正整数');
  }
  const pixelBytes = width * height * 4;
  if (data.length < pixelBytes) {
    throw new Error('BMP 编码失败：像素数据长度与尺寸不符');
  }

  const bytes = new Uint8Array(BMP_HEADER_SIZE + pixelBytes);
  const view = new DataView(bytes.buffer);

  // ---- BITMAPFILEHEADER ----
  bytes[0] = 0x42; // 'B'
  bytes[1] = 0x4d; // 'M'
  view.setUint32(2, bytes.length, true); // bfSize
  view.setUint32(10, BMP_HEADER_SIZE, true); // bfOffBits

  // ---- BITMAPV4HEADER ----
  view.setUint32(14, 108, true); // bV4Size
  view.setInt32(18, width, true); // bV4Width
  view.setInt32(22, height, true); // bV4Height（正值 = 自底向上）
  view.setUint16(26, 1, true); // bV4Planes
  view.setUint16(28, 32, true); // bV4BitCount
  view.setUint32(30, 3, true); // bV4V4Compression = BI_BITFIELDS
  view.setUint32(34, pixelBytes, true); // bV4SizeImage
  // 偏移 38~53：分辨率 / 色数字段保持 0
  view.setUint32(54, 0x00ff0000, true); // bV4RedMask
  view.setUint32(58, 0x0000ff00, true); // bV4GreenMask
  view.setUint32(62, 0x000000ff, true); // bV4BlueMask
  view.setUint32(66, 0xff000000, true); // bV4AlphaMask
  view.setUint32(70, 0x73524742, true); // bV4CSType = 'sRGB'（小端读作 "BGRs"）
  // 偏移 74~121：XYZ 端点与 Gamma 保持 0

  // ---- 像素区：RGBA → BGRA，行序反转 ----
  for (let y = 0; y < height; y++) {
    const srcRow = y * width * 4;
    const dstRow = BMP_HEADER_SIZE + (height - 1 - y) * width * 4;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 4;
      bytes[d] = data[s + 2]; // B
      bytes[d + 1] = data[s + 1]; // G
      bytes[d + 2] = data[s]; // R
      bytes[d + 3] = data[s + 3]; // A
    }
  }
  return bytes;
}

/**
 * 将 ImageData 编码为 BMP Blob（image/bmp）。
 * @param imageData RGBA 像素数据
 * @returns BMP Blob
 */
export async function encodeBmp(imageData: ImageData): Promise<Blob> {
  const bytes = encodeBmpBytes({
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  });
  return new Blob([bytes], { type: 'image/bmp' });
}
