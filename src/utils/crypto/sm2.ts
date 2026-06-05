/**
 * SM2 国密非对称加密核心逻辑。
 * 封装 gm-crypto 的 SM2 模块，提供密钥对生成、公钥加密与私钥解密功能。
 * SM2 基于 256 位 SM2 椭圆曲线，密钥为原始十六进制字符串格式。
 */

import { SM2 } from 'gm-crypto';
import { encodeBuffer, decodeToBuffer } from '../shared/array-buffer';
import type { OutputFormat } from '../shared/array-buffer';

/** SM2 密文拼接模式 */
export type SM2CipherMode = 'C1C3C2' | 'C1C2C3';

/** SM2 密钥对（纯十六进制字符串） */
export interface SM2KeyPair {
  /** 公钥：130 字符，格式 "04" + x(64字符) + y(64字符) */
  publicKey: string;
  /** 私钥：64 字符十六进制 */
  privateKey: string;
}

/** 密文拼接模式选项 */
export const SM2_CIPHER_MODES = ['C1C3C2', 'C1C2C3'] as const;

/** 输出格式选项 */
export const SM2_OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'hex', label: '小写 Hex' },
  { value: 'hexUpper', label: '大写 HEX' },
  { value: 'base64', label: 'Base64' },
];

/**
 * 生成 SM2 密钥对。
 * gm-crypto 返回 { publicKey: hex130, privateKey: hex64 }。
 * @returns SM2 密钥对
 */
export function generateSM2KeyPair(): SM2KeyPair {
  return SM2.generateKeyPair();
}

/**
 * SM2 公钥加密。
 * @param plaintext  明文文本
 * @param publicKey  130 字符十六进制公钥（以 "04" 开头）
 * @param cipherMode 密文拼接模式
 * @param format     输出编码格式
 * @returns          编码后的密文字符串
 */
export function encryptSM2(
  plaintext: string,
  publicKey: string,
  cipherMode: SM2CipherMode,
  format: OutputFormat = 'hex',
): string {
  const mode = cipherMode === 'C1C3C2' ? SM2.constants.C1C3C2 : SM2.constants.C1C2C3;

  const encrypted = SM2.encrypt(plaintext, publicKey, {
    mode,
    inputEncoding: 'utf8',
    outputEncoding: 'hex',
  });

  // gm-crypto 返回 hex 字符串，转为字节后重新编码以支持 base64/hex/hexUpper
  const bytes = hexToBytes(encrypted as string);
  return encodeBuffer(bytes.buffer as ArrayBuffer, format);
}

/**
 * SM2 私钥解密。
 * @param ciphertext 编码后的密文
 * @param privateKey 64 字符十六进制私钥
 * @param cipherMode 密文拼接模式（须与加密时一致）
 * @param format     输入编码格式
 * @returns          解密后的明文
 */
export function decryptSM2(
  ciphertext: string,
  privateKey: string,
  cipherMode: SM2CipherMode,
  format: OutputFormat = 'hex',
): string {
  const mode = cipherMode === 'C1C3C2' ? SM2.constants.C1C3C2 : SM2.constants.C1C2C3;

  // 将用户输入的编码格式转回 hex 给 gm-crypto
  const cipherBytes = new Uint8Array(decodeToBuffer(ciphertext, format));
  const cipherHex = bytesToHex(cipherBytes);

  const decrypted = SM2.decrypt(cipherHex, privateKey, {
    mode,
    inputEncoding: 'hex',
    outputEncoding: 'utf8',
  });

  return decrypted as string;
}

/**
 * 验证公钥格式是否合法（130 字符十六进制，以 "04" 开头）。
 * @param key 待验证的公钥字符串
 * @returns   是否为合法的 SM2 公钥
 */
export function isValidSM2PublicKey(key: string): boolean {
  return /^04[0-9a-fA-F]{128}$/.test(key.trim());
}

/**
 * 验证私钥格式是否合法（64 字符十六进制）。
 * @param key 待验证的私钥字符串
 * @returns   是否为合法的 SM2 私钥
 */
export function isValidSM2PrivateKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key.trim());
}

/** 将 Uint8Array 转为小写十六进制字符串 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 将十六进制字符串转为 Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
