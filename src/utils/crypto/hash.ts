import { md5 } from 'js-md5';
import { arrayBufferToBase64, arrayBufferToHex, hexToArrayBuffer } from '../shared/array-buffer';

/** 支持的哈希算法 */
export const HASH_ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

/** 哈希算法类型 */
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

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
