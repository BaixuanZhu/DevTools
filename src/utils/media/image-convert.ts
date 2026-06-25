/**
 * 图片转换与压缩工具的核心模块。
 *
 * 包含可单测的纯函数（字节格式化、尺寸缩放、格式映射、尺寸校验）
 * 以及依赖浏览器 Canvas API 的解码/编码函数。
 */

import { drawWatermark, type WatermarkOptions } from './watermark';

// ==================== 类型 ====================

/** 支持的输出格式（GIF / BMP 仅作输入，不在此列） */
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff' | 'ico';

/** 加载后的位图及其原始尺寸 */
export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** 图片转换选项 */
export interface ConvertOptions {
  /** 源位图 */
  bitmap: ImageBitmap;
  /** 目标格式 */
  format: OutputFormat;
  /** 质量 10-100，仅对有损格式（jpeg/webp）生效 */
  quality: number;
  /** 尺寸缩放百分比 1-100（100 = 原尺寸） */
  scale: number;
  /** 是否填充白底（jpeg 不支持透明） */
  fillBackground: boolean;
  /** 可选文字水印；不传或文本为空则不绘制，ICO 输出忽略 */
  watermark?: WatermarkOptions;
}

/** 图片转换结果 */
export interface ConvertResult {
  /** 编码后的 Blob */
  blob: Blob;
  /** 下载用的 object URL，指向真实编码结果（用完需 revokeObjectURL） */
  url: string;
  /**
   * 预览专用的 object URL。仅当输出格式浏览器 `<img>` 无法直接渲染（如 TIFF）时存在，
   * 此时应优先用它做预览，`url` 仅用于下载。为空表示 `url` 本身即可预览。
   * 存在时同样需 revokeObjectURL。
   */
  previewUrl?: string;
  /** 结果宽度 */
  width: number;
  /** 结果高度 */
  height: number;
  /** 结果字节数 */
  size: number;
}

// ==================== 常量 ====================

/** 浏览器 canvas 单边最大像素（保守阈值，超此值预检拒绝） */
export const CANVAS_MAX_DIMENSION = 16384;

/** 默认质量（有损格式） */
export const DEFAULT_QUALITY = 80;

/** 无损格式（不支持质量调节） */
export const LOSSLESS_FORMATS: OutputFormat[] = ['png', 'tiff', 'ico'];

/** 格式所属分组（有损可调质量 / 无损） */
export type FormatGroup = 'lossy' | 'lossless';

/** 输出格式选项（供 OptionRadioGroup 使用，按有损/无损分组） */
export const OUTPUT_FORMATS: { value: OutputFormat; label: string; group: FormatGroup }[] = [
  { value: 'jpeg', label: 'JPEG', group: 'lossy' },
  { value: 'webp', label: 'WebP', group: 'lossy' },
  { value: 'avif', label: 'AVIF', group: 'lossy' },
  { value: 'png', label: 'PNG', group: 'lossless' },
  { value: 'tiff', label: 'TIFF', group: 'lossless' },
  { value: 'ico', label: 'ICO', group: 'lossless' },
];

// ==================== 纯函数 ====================

export { formatBytes } from '../shared/format';

/**
 * 按百分比计算目标尺寸，锁定宽高比，最小为 1px。
 * @param width 原始宽度
 * @param height 原始高度
 * @param scalePercent 缩放百分比 1-100
 */
export function computeScaledSize(
  width: number,
  height: number,
  scalePercent: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((width * scalePercent) / 100)),
    height: Math.max(1, Math.round((height * scalePercent) / 100)),
  };
}

// ==================== 格式映射 ====================

/**
 * 输出格式映射到 MIME 类型。
 * @param format 输出格式
 */
export function getOutputMime(format: OutputFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'tiff':
      return 'image/tiff';
    case 'ico':
      return 'image/x-icon';
  }
}

/**
 * 输出格式映射到文件扩展名（jpeg 用 .jpg）。
 * @param format 输出格式
 */
export function getOutputExtension(format: OutputFormat): string {
  switch (format) {
    case 'png':
      return '.png';
    case 'jpeg':
      return '.jpg';
    case 'webp':
      return '.webp';
    case 'avif':
      return '.avif';
    case 'tiff':
      return '.tiff';
    case 'ico':
      return '.ico';
  }
}

/**
 * 判断格式是否为无损（不支持质量调节）。
 * @param format 输出格式
 */
export function isLossless(format: OutputFormat): boolean {
  return LOSSLESS_FORMATS.includes(format);
}

/**
 * 判断该格式是否需要填充白底（jpeg 不支持透明通道）。
 * @param format 输出格式
 */
export function needsFillBackground(format: OutputFormat): boolean {
  return format === 'jpeg';
}

/**
 * 根据输入图片的 MIME 推荐默认输出格式。
 *
 * - PNG/JPEG/WebP/AVIF/TIFF 保持原格式；
 * - BMP / ICO 输入默认 PNG（保留无损）；
 * - GIF / 未知格式默认 WebP（GIF 仅取首帧）。
 * @param mime 输入图片 MIME 类型
 */
export function defaultFormatForInput(mime: string): OutputFormat {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/tiff':
      return 'tiff';
    case 'image/bmp':
      return 'png';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'png';
    default:
      return 'webp';
  }
}

/** 编码路径种类：canvas 原生 / 各懒加载编码器 */
export type EncoderKind = 'canvas' | 'avif' | 'tiff' | 'ico';

/**
 * 根据输出格式选择编码路径（纯函数，供 convertImage 分派与单测使用）。
 * @param format 输出格式
 */
export function pickEncoderKind(format: OutputFormat): EncoderKind {
  switch (format) {
    case 'png':
    case 'jpeg':
    case 'webp':
      return 'canvas';
    case 'avif':
      return 'avif';
    case 'tiff':
      return 'tiff';
    case 'ico':
      return 'ico';
  }
}

// ==================== 尺寸校验 ====================

/**
 * 校验目标尺寸是否超过浏览器 canvas 单边处理上限。
 *
 * 注：原设计含总面积上限，因「两边 ≤ 16384 ⇒ 面积 ≤ 16384²」被单边上限蕴含，
 * 属冗余检查，按 YAGNI 省略。
 * @param width 目标宽度
 * @param height 目标高度
 * @returns 校验通过返回 { ok: true }，否则返回含中文错误信息的 { ok: false, error }
 */
export function checkCanvasLimits(
  width: number,
  height: number,
): { ok: boolean; error?: string } {
  if (width > CANVAS_MAX_DIMENSION || height > CANVAS_MAX_DIMENSION) {
    return {
      ok: false,
      error: `图片尺寸过大（${width}×${height}），单边超过 ${CANVAS_MAX_DIMENSION}px 浏览器处理上限，请缩小后重试`,
    };
  }
  return { ok: true };
}

// ==================== 浏览器 API（组件层验证，不做单测） ====================

/**
 * 加载图片文件为位图，自动纠正手机拍照的 EXIF 方向。
 *
 * TIFF 走 utif2 解码（浏览器原生不支持），其余格式走 createImageBitmap。
 * 所有解码异常统一归一化为中文错误，避免底层库原始异常冒泡。
 *
 * @param file 用户上传的图片文件
 * @throws 当浏览器无法解码该文件时抛出，由调用方捕获并提示
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  try {
    if (file.type === 'image/tiff') {
      const { decodeTiff } = await import('./decoders/tiff');
      return await decodeTiff(file);
    }
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    throw new Error(
      '图片解码失败：可能文件损坏，或浏览器不支持该格式（如 AVIF 需 Chrome / 新版 Safari）',
    );
  }
}

/**
 * 转换图片：按百分比缩放尺寸，再以指定格式/质量编码。
 *
 * - 无损格式（png/tiff/ico）忽略 quality；
 * - fillBackground 为 true 时先在 canvas 填充白底（jpeg 透明→白）；
 * - ICO 固定输出 16/32/48 三尺寸，忽略 scale；
 * - avif/tiff/ico 编码器懒加载。
 *
 * @param opts 转换选项
 * @returns 转换结果（含 object URL，调用方负责释放）
 * @throws 当无法创建 2D 上下文或编码失败时抛出
 */
export async function convertImage(opts: ConvertOptions): Promise<ConvertResult> {
  const { bitmap, format, quality, scale, fillBackground } = opts;

  // ICO：多尺寸封装，忽略 scale
  if (format === 'ico') {
    const { encodeIco } = await import('./encoders/ico');
    const r = await encodeIco(bitmap, fillBackground);
    return {
      blob: r.blob,
      url: URL.createObjectURL(r.blob),
      width: r.width,
      height: r.height,
      size: r.size,
    };
  }

  const { width, height } = computeScaledSize(bitmap.width, bitmap.height, scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');

  if (fillBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  // 文字水印：在编码前绘制，canvas 原生与 avif/tiff（getImageData）路径共用同一 ctx
  if (opts.watermark) {
    drawWatermark(ctx, width, height, opts.watermark);
  }

  // 原生 canvas 编码（png/jpeg/webp）
  if (pickEncoderKind(format) === 'canvas') {
    const mime = getOutputMime(format);
    const qualityArg = isLossless(format) ? undefined : quality / 100;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, qualityArg),
    );
    if (!blob) throw new Error('图片编码失败，请尝试其他格式或尺寸');
    return { blob, url: URL.createObjectURL(blob), width, height, size: blob.size };
  }

  // 懒加载编码器（avif/tiff）
  const imageData = ctx.getImageData(0, 0, width, height);
  if (format === 'avif') {
    const { encodeAvif } = await import('./encoders/avif');
    const blob = await encodeAvif(imageData, quality);
    return { blob, url: URL.createObjectURL(blob), width, height, size: blob.size };
  }

  // TIFF：浏览器 <img> 无法渲染，复用同一 canvas 额外生成 PNG 预览，
  // 下载仍用真实 TIFF blob（url），预览用 previewUrl。
  const { encodeTiff } = await import('./encoders/tiff');
  const blob = await encodeTiff(imageData);
  const previewBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  return {
    blob,
    url: URL.createObjectURL(blob),
    previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined,
    width,
    height,
    size: blob.size,
  };
}
