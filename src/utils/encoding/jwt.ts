/** JWT 标准声明字段的中文名映射 */
export const JWT_CLAIM_LABELS: Record<string, string> = {
  iss: '签发者',
  sub: '主题',
  aud: '受众',
  exp: '过期时间',
  nbf: '生效时间',
  iat: '签发时间',
  jti: 'JWT ID',
};

/** JWT 解析结果 */
export interface JwtSegments {
  /** Header 对象 */
  header: Record<string, unknown>;
  /** Payload 对象 */
  payload: Record<string, unknown>;
  /** Signature 原始字符串 */
  signature: string;
  /** 错误信息 */
  error?: string;
}

/** Base64URL 解码为字符串 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  return decodeURIComponent(escape(atob(base64)));
}

/** Base64URL 解码为 JSON 对象 */
function base64UrlToJson(str: string): Record<string, unknown> | null {
  try {
    const decoded = base64UrlDecode(str);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** 解析 JWT token */
export function parseJwt(token: string): JwtSegments {
  if (!token.trim()) {
    return { header: {}, payload: {}, signature: '', error: '请输入 JWT Token' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { header: {}, payload: {}, signature: '', error: 'JWT 格式无效：应包含 3 个以点号分隔的段' };
  }

  const header = base64UrlToJson(parts[0]);
  if (!header) {
    return { header: {}, payload: {}, signature: '', error: 'Header 段不是合法的 Base64URL 编码的 JSON' };
  }

  const payload = base64UrlToJson(parts[1]);
  if (!payload) {
    return { header: {}, payload: {}, signature: '', error: 'Payload 段不是合法的 Base64URL 编码的 JSON' };
  }

  return {
    header,
    payload,
    signature: parts[2],
  };
}

/** 判断 Token 是否已过期 */
export function isTokenExpired(payload: Record<string, unknown>): boolean | null {
  if (typeof payload.exp !== 'number') return null;
  return Date.now() / 1000 > payload.exp;
}
