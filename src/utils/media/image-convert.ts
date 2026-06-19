/**
 * 图片转换与压缩工具的核心模块。
 *
 * 包含可单测的纯函数（字节格式化、尺寸缩放、格式映射、尺寸校验）
 * 以及依赖浏览器 Canvas API 的解码/编码函数。
 */

// ==================== 类型 ====================

/** 支持的输出格式 */
export type OutputFormat = 'png' | 'jpeg' | 'webp';

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
}

/** 图片转换结果 */
export interface ConvertResult {
  /** 编码后的 Blob */
  blob: Blob;
  /** 预览用的 object URL（用完需 revokeObjectURL） */
  url: string;
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
export const LOSSLESS_FORMATS: OutputFormat[] = ['png'];

/** 输出格式选项（供 OptionRadioGroup 使用） */
export const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

// ==================== 纯函数 ====================

/**
 * 格式化字节数为人类可读字符串。
 *
 * <1KB 显示 B，<1MB 显示 KB（一位小数），≥1MB 显示 MB（两位小数）。
 * @param bytes 字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  return 'image/webp';
}

/**
 * 输出格式映射到文件扩展名（jpeg 用 .jpg）。
 * @param format 输出格式
 */
export function getOutputExtension(format: OutputFormat): string {
  if (format === 'png') return '.png';
  if (format === 'jpeg') return '.jpg';
  return '.webp';
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
 * PNG/JPEG/WebP 保持原格式，其余（GIF/BMP/AVIF 等）默认 WebP。
 * @param mime 输入图片 MIME 类型
 */
export function defaultFormatForInput(mime: string): OutputFormat {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/webp') return 'webp';
  return 'webp';
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
