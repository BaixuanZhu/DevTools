/**
 * URL 编解码工具函数
 * 提供 encodeURIComponent/encodeURI 编码和对应的解码功能
 */

/**
 * URL 编码结果
 */
export interface UrlEncodeResult {
  /** encodeURIComponent 编码结果（编码所有特殊字符） */
  component: { value: string };
  /** encodeURI 编码结果（保留 URL 结构字符如 :/?&=） */
  full: { value: string };
}

/**
 * URL 解码结果
 */
export interface UrlDecodeResult {
  /** decodeURIComponent 解码结果 */
  component: { value: string; error?: string };
  /** decodeURI 解码结果 */
  full: { value: string; error?: string };
}

/**
 * URL 编码
 * @param text - 原始文本
 * @returns 编码结果，包含 component（全编码）和 full（保留结构）两种方式
 */
export function encodeUrl(text: string): UrlEncodeResult {
  return {
    component: { value: encodeURIComponent(text) },
    full: { value: encodeURI(text) },
  };
}

/**
 * URL 解码
 * @param encoded - 编码后的字符串
 * @returns 解码结果，每种方式独立报告成功或失败
 */
export function decodeUrl(encoded: string): UrlDecodeResult {
  let componentValue = '';
  let componentError: string | undefined;
  let fullValue = '';
  let fullError: string | undefined;

  try {
    componentValue = decodeURIComponent(encoded);
  } catch {
    componentError = 'URIComponent 解码失败：输入包含非法的 percent-encoded 序列';
  }

  try {
    fullValue = decodeURI(encoded);
  } catch {
    fullError = 'URI 解码失败：输入包含非法的 percent-encoded 序列';
  }

  return {
    component: { value: componentValue, error: componentError },
    full: { value: fullValue, error: fullError },
  };
}
