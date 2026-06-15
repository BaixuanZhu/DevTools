import { md5 } from 'js-md5';
import { arrayBufferToBase64, arrayBufferToHex, base64ToArrayBuffer, hexToArrayBuffer, toArrayBuffer } from '../shared/array-buffer';

/** 支持的哈希算法 */
export const HASH_ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

/** 哈希算法类型 */
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** 密钥与待验签名的输入编码 */
export type KeyEncoding = 'text' | 'hex' | 'base64';

/**
 * 按指定编码将字符串解码为 ArrayBuffer。
 * @param input - 编码后的字符串
 * @param encoding - 编码格式
 * @returns 解码后的字节缓冲区；非法 hex/base64 会抛错
 */
export function decodeToBytes(input: string, encoding: KeyEncoding): ArrayBuffer {
  switch (encoding) {
    case 'text':
      return toArrayBuffer(new TextEncoder().encode(input));
    case 'hex':
      // hexToArrayBuffer 对非法字符静默转 0，需在此显式校验，避免密钥输错却「看似成功」
      if (!/^(?:[0-9a-fA-F]{2})+$/.test(input)) {
        throw new Error('非法的 Hex 字符串');
      }
      return hexToArrayBuffer(input);
    case 'base64':
      return base64ToArrayBuffer(input);
  }
}

/** 哈希计算结果 */
export interface HashResult {
  /** 小写十六进制 */
  hex: string;
  /** 大写十六进制 */
  hexUpper: string;
  /** Base64 编码 */
  base64: string;
}

/** 对文本计算哈希 */
export async function computeHash(text: string, algorithm: HashAlgorithm): Promise<HashResult> {
  const data = new TextEncoder().encode(text);
  return computeFileHash(data.buffer as ArrayBuffer, algorithm);
}

/** 对 ArrayBuffer 数据计算哈希 */
export async function computeFileHash(
  data: ArrayBuffer,
  algorithm: HashAlgorithm,
): Promise<HashResult> {
  let raw: ArrayBuffer;

  if (algorithm === 'MD5') {
    const hash = md5(data);
    raw = hexToArrayBuffer(hash);
  } else {
    raw = await crypto.subtle.digest(algorithm, data);
  }

  const hex = arrayBufferToHex(raw);
  return {
    hex,
    hexUpper: hex.toUpperCase(),
    base64: arrayBufferToBase64(raw),
  };
}

/** 支持的 HMAC 算法（SHA 系列，不含 MD5） */
export const HMAC_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

/** HMAC 算法类型 */
export type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number];

/**
 * 导入 HMAC 密钥。computeHmac 与 verifyHmac 共用，避免重复 importKey 逻辑。
 * @param key - 密钥字符串
 * @param keyEncoding - 密钥编码
 * @param algorithm - HMAC 使用的哈希算法
 */
async function importHmacKey(
  key: string,
  keyEncoding: KeyEncoding,
  algorithm: HmacAlgorithm,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    decodeToBytes(key, keyEncoding),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
}

/**
 * 对文本消息计算 HMAC，返回 hex/hexUpper/base64 三态结果。
 * @param message - 待签名消息（按 UTF-8 编码）
 * @param key - 密钥字符串
 * @param keyEncoding - 密钥编码
 * @param algorithm - HMAC 算法
 */
export async function computeHmac(
  message: string,
  key: string,
  keyEncoding: KeyEncoding,
  algorithm: HmacAlgorithm,
): Promise<HashResult> {
  const cryptoKey = await importHmacKey(key, keyEncoding, algorithm);
  const data = toArrayBuffer(new TextEncoder().encode(message));
  const raw = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hex = arrayBufferToHex(raw);
  return {
    hex,
    hexUpper: hex.toUpperCase(),
    base64: arrayBufferToBase64(raw),
  };
}

/**
 * 常量时间字节比较，避免通过响应耗时推断内容（时序攻击）。
 * 即使长度不等也遍历到较短长度，仅最终判定时把长度差异计入。
 * @param a - 期望字节
 * @param b - 待比较字节
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** 待验签名需要剥离的厂商前缀（大小写不敏感），如 GitHub 的 sha256= */
const SIGNATURE_PREFIX_RE = /^sha(?:1|224|256|384|512)=/i;

/**
 * 对消息计算 HMAC 并与待验签名做常量时间比较。
 * 待验签名先 trim 并去除 sha1=/sha256= 等前缀（大小写不敏感）后，再按 signatureEncoding 解码。
 * 密钥或签名格式非法时会抛错，由调用方转为中文提示。
 * @param message - 原始消息
 * @param key - 密钥
 * @param keyEncoding - 密钥编码
 * @param algorithm - HMAC 算法
 * @param signature - 待验签名（可能带前缀/首尾空白）
 * @param signatureEncoding - 签名编码
 * @returns 是否匹配
 */
export async function verifyHmac(
  message: string,
  key: string,
  keyEncoding: KeyEncoding,
  algorithm: HmacAlgorithm,
  signature: string,
  signatureEncoding: KeyEncoding,
): Promise<boolean> {
  const cryptoKey = await importHmacKey(key, keyEncoding, algorithm);
  const data = toArrayBuffer(new TextEncoder().encode(message));
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));

  const normalized = signature.trim().replace(SIGNATURE_PREFIX_RE, '');
  const provided = new Uint8Array(decodeToBytes(normalized, signatureEncoding));

  return timingSafeEqual(expected, provided);
}
