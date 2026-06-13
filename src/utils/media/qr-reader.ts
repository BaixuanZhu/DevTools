import jsQR from 'jsqr';

/** 二维码解码后的内容类型 */
export type ContentType = 'url' | 'email' | 'tel' | 'text';

/** 内容识别结果 */
export interface ContentResult {
  /** 内容类型 */
  type: ContentType;
  /** 原始文本（已 trim） */
  value: string;
  /** 可点击链接（url/email/tel 有值，text 为空字符串） */
  href: string;
}

/** 整体匹配 http(s) URL */
const URL_RE = /^https?:\/\/\S+$/i;
/** 整体匹配单个邮箱 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 整体匹配电话：可选 tel: 前缀、可选国家码、手机号或座机 */
const TEL_RE = /^(?:tel:)?(?:\+\d{1,3}[\s-]?)?(?:1[3-9]\d{9}|\d{3,4}[\s-]?\d{7,8})$/;

/**
 * 识别二维码文本的内容类型，按 url → email → tel → text 顺序判定。
 * 仅当内容整体严格匹配对应格式时才归类，否则降级为 text。
 * @param raw 解码出的原始文本
 * @returns 内容识别结果
 */
export function detectContentType(raw: string): ContentResult {
  const value = raw.trim();
  if (!value) return { type: 'text', value: '', href: '' };

  if (URL_RE.test(value)) return { type: 'url', value, href: value };
  if (EMAIL_RE.test(value)) return { type: 'email', value, href: `mailto:${value}` };
  if (TEL_RE.test(value)) {
    const digits = value.replace(/^tel:/i, '').replace(/[\s()-]/g, '');
    return { type: 'tel', value, href: `tel:${digits}` };
  }
  return { type: 'text', value, href: '' };
}

/** 解码前图像长边的最大像素，超过则等比缩放 */
export const QR_MAX_EDGE = 1024;

/**
 * 计算等比缩放后的图像尺寸：长边超过 maxEdge 时按比例缩小，否则保持原尺寸。
 * @param width 原始宽度
 * @param height 原始高度
 * @param maxEdge 长边上限，默认 QR_MAX_EDGE
 * @returns 缩放后尺寸；非法输入返回 {0, 0}
 */
export function computeScaledSize(
  width: number,
  height: number,
  maxEdge: number = QR_MAX_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** 解码未识别到二维码时的统一错误提示 */
export const QR_DECODE_ERROR = '未识别到二维码，请确保图片清晰、二维码完整且占图较大比例';

/** 解码成功结果 */
export interface DecodeSuccess {
  ok: true;
  result: ContentResult;
}

/** 解码失败结果 */
export interface DecodeFailure {
  ok: false;
  error: string;
}

/** 解码结果（成功或失败） */
export type DecodeOutcome = DecodeSuccess | DecodeFailure;

/**
 * 从图片源解码二维码：createImageBitmap → 等比缩放 → jsQR 识别 → 内容类型判定。
 * 运行于浏览器环境（依赖 canvas 与 createImageBitmap）。
 * @param source 图片源（File / Blob 等 ImageBitmapSource）
 * @returns 成功返回内容识别结果，失败返回中文错误提示
 */
export async function decodeQrFromImage(source: ImageBitmapSource): Promise<DecodeOutcome> {
  try {
    const bitmap = await createImageBitmap(source);
    const { width, height } = computeScaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: QR_DECODE_ERROR };
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height);
    if (!decoded?.data) return { ok: false, error: QR_DECODE_ERROR };
    return { ok: true, result: detectContentType(decoded.data) };
  } catch {
    return { ok: false, error: QR_DECODE_ERROR };
  }
}
