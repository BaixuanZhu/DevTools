import { SM4 } from 'gm-crypto';
import type { SymmetricAlgorithm } from './types';

/**
 * SM4-CBC 适配器。
 * 封装 gm-crypto 的 SM4 模块，使用 CBC 模式。
 * 密钥固定 128 位，IV 16 字节（等于分组大小）。
 * gm-crypto 内部已处理 PKCS#7 填充。
 */
export const sm4Cbc: SymmetricAlgorithm = {
  id: 'SM4-CBC',
  label: 'SM4-CBC',
  ivLength: 16,
  keyLengths: [128],
  defaultKeyLength: 128,
  isAead: false,

  async encrypt(plaintext, key, iv) {
    const keyHex = bytesToHex(key);
    const ivHex = bytesToHex(iv);
    // gm-crypto 的 input 接受 ArrayBuffer 或 string，outputEncoding 用 hex 再转回
    const encrypted = SM4.encrypt(
      plaintext.buffer.slice(plaintext.byteOffset, plaintext.byteOffset + plaintext.byteLength) as ArrayBuffer,
      keyHex,
      { mode: SM4.constants.CBC, iv: ivHex, outputEncoding: 'hex' },
    );
    return hexToBytes(encrypted as string);
  },

  async decrypt(ciphertext, key, iv) {
    const keyHex = bytesToHex(key);
    const ivHex = bytesToHex(iv);
    const cipherHex = bytesToHex(ciphertext);
    const decrypted = SM4.decrypt(cipherHex, keyHex, {
      mode: SM4.constants.CBC,
      iv: ivHex,
      inputEncoding: 'hex',
    });
    // 返回值为 ArrayBuffer
    return new Uint8Array(decrypted as ArrayBuffer);
  },
};

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
