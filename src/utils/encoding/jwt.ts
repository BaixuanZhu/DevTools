import { toArrayBuffer } from '../shared/array-buffer';

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
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** ArrayBuffer 编码为 Base64URL 字符串 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

/** HMAC 算法名称到 Web Crypto SHA 算法的映射 */
const HMAC_ALGO_MAP: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

/** 验证 JWT 的 HMAC 签名 */
export async function verifyHmacSignature(
  token: string,
  secret: string,
  algorithm: 'HS256' | 'HS384' | 'HS512',
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const message = `${parts[0]}.${parts[1]}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: HMAC_ALGO_MAP[algorithm] },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64UrlEncode(signature) === parts[2];
}

/** 判断 Token 是否已过期 */
export function isTokenExpired(payload: Record<string, unknown>): boolean | null {
  if (typeof payload.exp !== 'number') return null;
  return Date.now() / 1000 > payload.exp;
}

/** JWT 编码选项 */
export interface EncodeJwtOptions {
  header?: Record<string, unknown>;
  payload: Record<string, unknown>;
  secret: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
}

/** 使用 HMAC 签名生成 JWT */
export async function encodeJwt(options: EncodeJwtOptions): Promise<string> {
  const { header = {}, payload, secret, algorithm = 'HS256' } = options;

  const fullHeader = { typ: 'JWT', alg: algorithm, ...header };
  const encodedHeader = base64UrlEncode(
    toArrayBuffer(new TextEncoder().encode(JSON.stringify(fullHeader))),
  );
  const encodedPayload = base64UrlEncode(
    toArrayBuffer(new TextEncoder().encode(JSON.stringify(payload))),
  );

  const message = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: HMAC_ALGO_MAP[algorithm] },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}
