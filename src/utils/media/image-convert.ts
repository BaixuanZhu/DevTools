/**
 * 图片转换与压缩工具的核心模块。
 *
 * 包含可单测的纯函数（字节格式化、尺寸缩放、格式映射、尺寸校验）
 * 以及依赖浏览器 Canvas API 的解码/编码函数。
 * ICO 不在此列：输出由「ICO 图标制作」工具（encoders/ico）承担，
 * ICO 输入仍支持，映射为 PNG。
 */

// ==================== 类型 ====================

/** 支持的输出格式（bmp 自研编码 / gif 走 gifenc，均懒加载；ICO 仅作输入） */
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff' | 'bmp' | 'gif';

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
  /**
   * 质量 10-100，仅对有损格式生效。语义随格式而异：
   * jpeg/webp/avif 为编码质量，gif 映射为调色板颜色数。
   */
  quality: number;
  /** 尺寸缩放百分比 1-100（100 = 原尺寸） */
  scale: number;
  /** 是否填充白底（jpeg 不支持透明） */
  fillBackground: boolean;
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

/** 无损格式（不支持质量调节）。BMP 未压缩属无损；GIF 量化有损，不在此列 */
export const LOSSLESS_FORMATS: OutputFormat[] = ['png', 'tiff', 'bmp'];

/** 格式所属分组（有损可调质量 / 无损） */
export type FormatGroup = 'lossy' | 'lossless';

/** 输出格式选项（供 OptionRadioGroup 使用，按有损/无损分组） */
export const OUTPUT_FORMATS: { value: OutputFormat; label: string; group: FormatGroup }[] = [
  { value: 'jpeg', label: 'JPEG', group: 'lossy' },
  { value: 'webp', label: 'WebP', group: 'lossy' },
  { value: 'avif', label: 'AVIF', group: 'lossy' },
  { value: 'gif', label: 'GIF', group: 'lossy' },
  { value: 'png', label: 'PNG', group: 'lossless' },
  { value: 'tiff', label: 'TIFF', group: 'lossless' },
  { value: 'bmp', label: 'BMP', group: 'lossless' },
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
    case 'bmp':
      return 'image/bmp';
    case 'gif':
      return 'image/gif';
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
    case 'bmp':
      return '.bmp';
    case 'gif':
      return '.gif';
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
 * - BMP / ICO / SVG 输入默认 PNG（图形与无损场景）；
 * - HEIC/HEIF（iPhone 实拍）默认 WebP（照片场景小体积）；
 * - GIF / 未知格式默认 WebP（GIF 仅取首帧）。
 *
 * Windows 下拖入的 .svg/.heic/.heif 文件 MIME 可能为空，故用扩展名兜底。
 * @param mime 输入图片 MIME 类型
 * @param fileName 可选的文件名（MIME 为空时按扩展名兜底判定）
 */
export function defaultFormatForInput(mime: string, fileName?: string): OutputFormat {
  if (!mime) {
    if (fileName && /\.svg$/i.test(fileName)) return 'png';
    if (fileName && /\.(heic|heif)$/i.test(fileName)) return 'webp';
  }
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
    case 'image/svg+xml':
      return 'png';
    case 'image/heic':
    case 'image/heif':
    case 'image/heic-sequence':
    case 'image/heif-sequence':
      return 'webp';
    default:
      return 'webp';
  }
}

/** 编码路径种类：canvas 原生 / 各懒加载编码器 */
export type EncoderKind = 'canvas' | 'avif' | 'tiff' | 'bmp' | 'gif';

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
    case 'bmp':
      return 'bmp';
    case 'gif':
      return 'gif';
  }
}

/**
 * 判断文件是否为 SVG（MIME 或 .svg 扩展名，部分系统 MIME 为空）。
 * @param file 用户上传的图片文件
 */
export function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

/**
 * 判断文件是否为 HEIC/HEIF（MIME 含 -sequence 变体，或 .heic/.heif 扩展名——
 * Windows 资源管理器常报空 MIME）。
 * @param file 用户上传的图片文件
 */
export function isHeicFile(file: File): boolean {
  return (
    /^image\/hei[cf](-sequence)?$/.test(file.type) || /\.(heic|heif)$/i.test(file.name)
  );
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
 * 解码分派：SVG 走浏览器原生光栅化、HEIC/HEIF 走 libheif-js、TIFF 走 utif2
 * （三者均为懒加载解码器），其余格式走 createImageBitmap。
 * 所有解码异常统一归一化为中文错误，避免底层库原始异常冒泡。
 *
 * @param file 用户上传的图片文件
 * @throws 当浏览器无法解码该文件时抛出，由调用方捕获并提示
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  const isHeic = isHeicFile(file);
  try {
    if (isSvgFile(file)) {
      const { decodeSvg } = await import('./decoders/svg');
      return await decodeSvg(file);
    }
    if (isHeic) {
      const { decodeHeic } = await import('./decoders/heic');
      return await decodeHeic(file);
    }
    if (file.type === 'image/tiff') {
      const { decodeTiff } = await import('./decoders/tiff');
      return await decodeTiff(file);
    }
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // HEIC 单独提示：其失败与浏览器兼容无关（libheif 为 WASM），多为文件损坏或不支持的编码变体
    throw new Error(
      isHeic
        ? 'HEIC/HEIF 图片解码失败：文件可能已损坏，或包含本工具暂不支持的编码变体'
        : '图片解码失败：可能文件损坏，或浏览器不支持该格式（如 AVIF 需 Chrome / 新版 Safari）',
    );
  }
}

/**
 * 转换图片：按百分比缩放尺寸，再以指定格式/质量编码。
 *
 * - 无损格式（png/tiff/bmp）忽略 quality；
 * - fillBackground 为 true 时先在 canvas 填充白底（jpeg 透明→白）；
 *   BMP/GIF 保留透明，不做填充；
 * - avif/tiff/bmp/gif 编码器懒加载，仅在命中对应格式时才取 ImageData。
 *
 * @param opts 转换选项
 * @returns 转换结果（含 object URL，调用方负责释放）
 * @throws 当无法创建 2D 上下文或编码失败时抛出
 */
export async function convertImage(opts: ConvertOptions): Promise<ConvertResult> {
  const { bitmap, format, quality, scale, fillBackground } = opts;

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

  // 懒加载编码器（avif/tiff/bmp/gif）：统一在此处取 ImageData，canvas 路径不付这笔开销
  const imageData = ctx.getImageData(0, 0, width, height);

  if (format === 'avif') {
    const { encodeAvif } = await import('./encoders/avif');
    const blob = await encodeAvif(imageData, quality);
    return { blob, url: URL.createObjectURL(blob), width, height, size: blob.size };
  }

  if (format === 'gif') {
    const { encodeGif } = await import('./encoders/gif');
    const blob = await encodeGif(imageData, quality);
    return { blob, url: URL.createObjectURL(blob), width, height, size: blob.size };
  }

  if (format === 'bmp') {
    const { encodeBmp } = await import('./encoders/bmp');
    const blob = await encodeBmp(imageData);
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
