import type { AlgorithmId } from './algorithms/types';
import type { OutputFormat } from '../shared/array-buffer';
import { encodeBuffer, decodeToBuffer, toArrayBuffer } from '../shared/array-buffer';
import { getAlgorithm } from './algorithms/registry';

/** 兼容旧 API 的类型（保留向后兼容） */
export type AESAlgorithm = 'AES-GCM' | 'AES-CBC' | 'AES-CTR';
export type AESKeyLength = 128 | 192 | 256;

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

/**
 * 通过 PBKDF2 从密码派生原始密钥字节
 * @param password - 用户密码
 * @param salt - 盐值
 * @param keyLengthBits - 目标密钥长度（位）
 */
async function deriveKeyBytes(
  password: string,
  salt: Uint8Array,
  keyLengthBits: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    keyLengthBits,
  );
  return new Uint8Array(bits);
}

/**
 * 加密文本。
 * 二进制格式：salt[16B] + iv[algo.ivLength] + ciphertext[+tag]
 * @param plaintext - 明文
 * @param password - 加密密码
 * @param algorithmId - 算法 ID
 * @param keyLength - 密钥长度（位）
 * @param format - 输出编码格式
 */
export async function encrypt(
  plaintext: string,
  password: string,
  algorithmId: AlgorithmId,
  keyLength: number,
  format: OutputFormat = 'base64',
): Promise<string> {
  const algo = getAlgorithm(algorithmId);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(algo.ivLength));
  const key = await deriveKeyBytes(password, salt, keyLength);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertext = await algo.encrypt(plaintextBytes, key, iv);

  const combined = new Uint8Array(SALT_LENGTH + iv.length + ciphertext.length);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(ciphertext, SALT_LENGTH + iv.length);

  return encodeBuffer(combined.buffer as ArrayBuffer, format);
}

/**
 * 解密密文。
 * @param encodedData - 编码后的密文字符串
 * @param password - 解密密码
 * @param algorithmId - 算法 ID
 * @param keyLength - 密钥长度（位）
 * @param format - 输入编码格式
 */
export async function decrypt(
  encodedData: string,
  password: string,
  algorithmId: AlgorithmId,
  keyLength: number,
  format: OutputFormat = 'base64',
): Promise<string> {
  const algo = getAlgorithm(algorithmId);
  const combined = new Uint8Array(decodeToBuffer(encodedData, format));
  const ivLen = algo.ivLength;

  if (combined.length < SALT_LENGTH + ivLen) {
    throw new Error('密文数据长度不足');
  }

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + ivLen);
  const ciphertext = combined.slice(SALT_LENGTH + ivLen);

  const key = await deriveKeyBytes(password, salt, keyLength);
  const decrypted = await algo.decrypt(ciphertext, key, iv);

  return new TextDecoder().decode(decrypted);
}

// ==================== 向后兼容的旧 API ====================

/**
 * AES 加密（向后兼容，内部委托给新 API）
 * @deprecated 使用 `encrypt` 代替
 */
export async function encryptAES(
  plaintext: string,
  password: string,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<string> {
  return encrypt(plaintext, password, algorithm, keyLength, 'base64');
}

/**
 * AES 解密（向后兼容，内部委托给新 API）
 * @deprecated 使用 `decrypt` 代替
 */
export async function decryptAES(
  encodedData: string,
  password: string,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<string> {
  return decrypt(encodedData, password, algorithm, keyLength, 'base64');
}
