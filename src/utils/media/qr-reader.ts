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
