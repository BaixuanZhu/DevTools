/** ICO 输出的 favicon 标准尺寸（favicon 常用三尺寸）。 */
const ICO_SIZES = [16, 32, 48] as const;

/**
 * 将位图缩放到指定尺寸并编码为 PNG 字节（用于 ICO 打包）。
 *
 * @param bitmap 源位图
 * @param size 目标宽高（正方形）
 * @param fillBackground 是否先填白底
 */
async function rasterizeToPng(
  bitmap: ImageBitmap,
  size: number,
  fillBackground: boolean,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ICO 编码失败：无法创建 Canvas 2D 上下文');
  if (fillBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(bitmap, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('ICO 编码失败：无法生成 PNG');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 将位图编码为多尺寸 ICO（PNG-based，favicon 标准 16/32/48）。
 *
 * 纯手写：ICONDIR(6B) + 每尺寸 ICONDIRENTRY(16B) + 各尺寸 PNG 数据拼接。
 * 不依赖第三方库（to-ico 因依赖 image-size 动态 require 在 Vite 下不可用，spike 已确认）。
 * ICO 忽略外部 scale 参数，固定输出 favicon 三尺寸。
 *
 * @param bitmap 源位图
 * @param fillBackground 是否填白底
 * @returns ICO 结果（含 Blob、最大尺寸 48、字节数）
 * @throws 编码失败时抛出
 */
export async function encodeIco(
  bitmap: ImageBitmap,
  fillBackground: boolean,
): Promise<{ blob: Blob; width: number; height: number; size: number }> {
  const pngs = await Promise.all(
    ICO_SIZES.map((size) => rasterizeToPng(bitmap, size, fillBackground)),
  );

  const count = pngs.length;
  const headerSize = 6 + 16 * count;
  const totalBytes = pngs.reduce((sum, p) => sum + p.byteLength, 0);
  const buffer = new Uint8Array(headerSize + totalBytes);
  const view = new DataView(buffer.buffer);

  // ICONDIR：reserved(2)=0, type(2)=1(ICO), count(2)
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);

  // ICONDIRENTRY(16B) × count，数据区紧跟其后
  let offset = headerSize;
  pngs.forEach((png, i) => {
    const base = 6 + 16 * i;
    view.setUint8(base, ICO_SIZES[i]); // width（≤255 直接写）
    view.setUint8(base + 1, ICO_SIZES[i]); // height
    view.setUint8(base + 2, 0); // colorCount（0=无调色板）
    view.setUint8(base + 3, 0); // reserved
    view.setUint16(base + 4, 1, true); // planes
    view.setUint16(base + 6, 32, true); // bitCount
    view.setUint32(base + 8, png.byteLength, true); // bytesInRes
    view.setUint32(base + 12, offset, true); // imageOffset
    offset += png.byteLength;
  });

  let pos = headerSize;
  for (const png of pngs) {
    buffer.set(png, pos);
    pos += png.byteLength;
  }

  const blob = new Blob([buffer], { type: 'image/x-icon' });
  return { blob, width: 48, height: 48, size: blob.size };
}
