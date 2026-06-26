/** ICO 输出可选尺寸（favicon 常用尺寸集合）。 */
export const ICO_SIZE_OPTIONS = [16, 32, 48, 64, 128, 256] as const;

/** ICO 默认勾选的尺寸（favicon 标准三尺寸）。 */
export const DEFAULT_ICO_SIZES: number[] = [16, 32, 48];

/** ICO 裁切适配方式：cover=裁切填满正方形，contain=等比留白完整保留。 */
export type IcoFit = 'cover' | 'contain';

/** cover 裁切的九宫格锚点，决定非正方形图保留哪一部分。 */
export type IcoAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** ICO 编码选项。 */
export interface IcoEncodeOptions {
  /** 输出尺寸列表（如 [16, 32, 48]），至少一个 */
  sizes: number[];
  /** 裁切适配方式 */
  fit: IcoFit;
  /** cover 模式的锚点（contain 模式忽略） */
  anchor: IcoAnchor;
  /** 是否填充白底（透明区域填白；contain 留白与 cover 透出区域受此影响） */
  fillBackground: boolean;
}

/**
 * 按锚点计算 cover 裁切的源矩形（纯函数，便于单测）。
 *
 * 取源图最短边为正方形边长，按锚点决定在长边方向上的偏移：
 * 左/上=0，居中=(长-短)/2，右/下=长-短。
 *
 * @param srcW 源图宽度
 * @param srcH 源图高度
 * @param anchor 九宫格锚点
 * @returns 裁切源矩形的左上角坐标与边长
 */
export function computeCoverCrop(
  srcW: number,
  srcH: number,
  anchor: IcoAnchor,
): { sx: number; sy: number; size: number } {
  const size = Math.min(srcW, srcH);
  const extraX = srcW - size;
  const extraY = srcH - size;

  let sx = extraX / 2;
  if (anchor === 'top-left' || anchor === 'middle-left' || anchor === 'bottom-left') sx = 0;
  else if (anchor === 'top-right' || anchor === 'middle-right' || anchor === 'bottom-right') sx = extraX;

  let sy = extraY / 2;
  if (anchor === 'top-left' || anchor === 'top-center' || anchor === 'top-right') sy = 0;
  else if (anchor === 'bottom-left' || anchor === 'bottom-center' || anchor === 'bottom-right') sy = extraY;

  return { sx, sy, size };
}

/**
 * 将位图缩放到指定尺寸并编码为 PNG 字节（用于 ICO 打包）。
 *
 * - cover：按锚点取源图正方形区域裁切后缩放填满，非正方形图不变形；
 * - contain：等比缩放整图放入正方形，居中，周围按 fillBackground 透明或填白。
 *
 * @param bitmap 源位图
 * @param size 目标宽高（正方形）
 * @param opts 裁切适配方式、锚点与背景填充
 */
async function rasterizeToPng(
  bitmap: ImageBitmap,
  size: number,
  opts: Pick<IcoEncodeOptions, 'fit' | 'anchor' | 'fillBackground'>,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ICO 编码失败：无法创建 Canvas 2D 上下文');
  if (opts.fillBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }

  if (opts.fit === 'cover') {
    const { sx, sy, size: srcSize } = computeCoverCrop(bitmap.width, bitmap.height, opts.anchor);
    ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
  } else {
    // contain：等比缩放整图放入正方形并居中
    const ratio = Math.min(size / bitmap.width, size / bitmap.height);
    const dw = bitmap.width * ratio;
    const dh = bitmap.height * ratio;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, (size - dw) / 2, (size - dh) / 2, dw, dh);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('ICO 编码失败：无法生成 PNG');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 将位图编码为多尺寸 ICO（PNG-based）。
 *
 * 纯手写：ICONDIR(6B) + 每尺寸 ICONDIRENTRY(16B) + 各尺寸 PNG 数据拼接。
 * 不依赖第三方库（to-ico 因依赖 image-size 动态 require 在 Vite 下不可用，spike 已确认）。
 * 输出尺寸、裁切方式由 opts 决定，忽略外部 scale 参数。
 *
 * @param bitmap 源位图
 * @param opts 输出尺寸、裁切适配方式、锚点与背景填充
 * @returns ICO 结果（含 Blob、最大尺寸、字节数）
 * @throws 编码失败或尺寸列表为空时抛出
 */
export async function encodeIco(
  bitmap: ImageBitmap,
  opts: IcoEncodeOptions,
): Promise<{ blob: Blob; width: number; height: number; size: number }> {
  const sizes = [...opts.sizes].sort((a, b) => a - b);
  if (sizes.length === 0) throw new Error('ICO 编码失败：未选择任何输出尺寸');

  const pngs = await Promise.all(
    sizes.map((size) => rasterizeToPng(bitmap, size, opts)),
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
    // width/height 字段为 uint8；256 按 ICO 规范写 0
    const dim = sizes[i] >= 256 ? 0 : sizes[i];
    view.setUint8(base, dim); // width
    view.setUint8(base + 1, dim); // height
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

  const maxSize = sizes[sizes.length - 1];
  const blob = new Blob([buffer], { type: 'image/x-icon' });
  return { blob, width: maxSize, height: maxSize, size: blob.size };
}
