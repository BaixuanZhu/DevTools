/**
 * URL 编解码工具函数
 * 提供 encodeURIComponent/encodeURI 编码和对应的解码功能
 */

/**
 * URL 编码结果
 */
export interface UrlEncodeResult {
  /** encodeURIComponent 编码结果（编码所有特殊字符） */
  component: string;
  /** encodeURI 编码结果（保留 URL 结构字符如 :/?&=） */
  full: string;
}

/**
 * URL 解码结果
 */
export interface UrlDecodeResult {
  /** decodeURIComponent 解码结果 */
  component: string;
  /** decodeURI 解码结果 */
  full: string;
  /** 解码错误信息（如果解码失败） */
  error?: string;
}

/**
 * URL 编码
 * @param text - 原始文本
 * @returns 编码结果，包含 component（全编码）和 full（保留结构）两种方式
 */
export function encodeUrl(text: string): UrlEncodeResult {
  return {
    component: encodeURIComponent(text),
    full: encodeURI(text),
  };
}

/**
 * URL 解码
 * @param encoded - 编码后的字符串
 * @returns 解码结果，包含两种解码方式和可能的错误信息
 */
export function decodeUrl(encoded: string): UrlDecodeResult {
  let component = '';
  let full = '';
  let error: string | undefined;

  try {
    component = decodeURIComponent(encoded);
  } catch {
    error = 'URIComponent 解码失败：输入包含非法的 percent-encoded 序列';
  }

  try {
    full = decodeURI(encoded);
  } catch {
    error = error
      ? error + '；URI 解码也失败'
      : 'URI 解码失败：输入包含非法的 percent-encoded 序列';
  }

  return { component, full, error };
}
