/**
 * URL 解析、重建与编解码工具函数
 * 基于浏览器原生 URL API，无第三方依赖
 */

/**
 * URL 结构化解析结果
 */
export interface UrlParsedParts {
  /** 协议，如 `https:` */
  protocol: string;
  /** 主机名 + 端口，如 `example.com:8080` */
  host: string;
  /** 仅主机名，如 `example.com` */
  hostname: string;
  /** 端口字符串，未指定为空字符串 */
  port: string;
  /** 路径，如 `/search` */
  pathname: string;
  /** 查询字符串，含前导 `?` */
  search: string;
  /** 哈希片段，含前导 `#` */
  hash: string;
  /** query 参数列表 */
  params: Array<{ key: string; value: string }>;
}

/**
 * URL 编码结果
 */
export interface UrlEncodeResult {
  /** encodeURIComponent 编码结果（编码所有特殊字符） */
  component: { value: string };
  /** encodeURI 编码结果（保留 URL 结构字符） */
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
 * 解析 URL 字符串
 * @param url - 待解析的 URL
 * @returns 解析成功返回结构化对象，失败返回 `null`
 */
export function parseUrl(url: string): UrlParsedParts | null {
  try {
    const parsed = new URL(url);
    const params: Array<{ key: string; value: string }> = [];
    parsed.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      params,
    };
  } catch {
    return null;
  }
}

/**
 * URL 编码
 * @param text - 原始文本
 * @returns 包含 component 与 full 两种编码方式的结果
 */
export function encodeUrl(text: string): UrlEncodeResult {
  return {
    component: { value: encodeURIComponent(text) },
    full: { value: encodeURI(text) },
  };
}

/**
 * URL 解码
 * @param text - 编码后的字符串
 * @returns 包含 component 与 full 两种解码方式的结果，分别报告错误
 */
export function decodeUrl(text: string): UrlDecodeResult {
  let componentValue = '';
  let componentError: string | undefined;
  let fullValue = '';
  let fullError: string | undefined;

  try {
    componentValue = decodeURIComponent(text);
  } catch {
    componentError = 'URIComponent 解码失败：输入包含非法的 percent-encoded 序列';
  }

  try {
    fullValue = decodeURI(text);
  } catch {
    fullError = 'URI 解码失败：输入包含非法的 percent-encoded 序列';
  }

  return {
    component: { value: componentValue, error: componentError },
    full: { value: fullValue, error: fullError },
  };
}

/**
 * 使用新的 query 参数重建 URL
 * @param baseUrl - 原始 URL（用于取协议、主机、路径、hash）
 * @param params - 新的 query 参数列表，空 key 会被忽略
 * @returns 重建后的完整 URL；若 baseUrl 非法则原样返回
 */
export function buildUrlFromParams(
  baseUrl: string,
  params: Array<{ key: string; value: string }>,
): string {
  try {
    const url = new URL(baseUrl.trim());
    url.search = '';
    params.forEach(({ key, value }) => {
      if (key.trim() !== '') {
        url.searchParams.append(key, value);
      }
    });
    return url.toString();
  } catch {
    return baseUrl;
  }
}
