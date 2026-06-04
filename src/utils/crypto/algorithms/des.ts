import * as des from 'des.js';
import type { SymmetricAlgorithm } from './types';

/**
 * DES-CBC 适配器。
 * 封装 des.js 的 DES + CBC，密钥 64 位（8 字节），IV 8 字节。
 * des.js 内部已处理 PKCS#5 填充。
 * 注意：des.js 的 update/final 返回普通 number[]，不依赖 Buffer。
 */
export const desCbc: SymmetricAlgorithm = {
  id: 'DES-CBC',
  label: 'DES-CBC',
  ivLength: 8,
  keyLengths: [64],
  defaultKeyLength: 64,
  isAead: false,

  async encrypt(plaintext, key, iv) {
    const cipher = des.CBC.instantiate(des.DES).create({
      type: 'encrypt',
      key,
      iv,
    });
    const out1: number[] = cipher.update(plaintext);
    const out2: number[] = cipher.final();
    return new Uint8Array(out1.concat(out2));
  },

  async decrypt(ciphertext, key, iv) {
    const cipher = des.CBC.instantiate(des.DES).create({
      type: 'decrypt',
      key,
      iv,
    });
    const out1: number[] = cipher.update(ciphertext);
    const out2: number[] = cipher.final();
    return new Uint8Array(out1.concat(out2));
  },
};

/**
 * 3DES-CBC（DES-EDE3-CBC）适配器。
 * 封装 des.js 的 EDE + CBC，密钥 192 位（24 字节），IV 8 字节。
 */
export const tripleDesCbc: SymmetricAlgorithm = {
  id: '3DES-CBC',
  label: '3DES-CBC',
  ivLength: 8,
  keyLengths: [192],
  defaultKeyLength: 192,
  isAead: false,

  async encrypt(plaintext, key, iv) {
    const cipher = des.CBC.instantiate(des.EDE).create({
      type: 'encrypt',
      key,
      iv,
    });
    const out1: number[] = cipher.update(plaintext);
    const out2: number[] = cipher.final();
    return new Uint8Array(out1.concat(out2));
  },

  async decrypt(ciphertext, key, iv) {
    const cipher = des.CBC.instantiate(des.EDE).create({
      type: 'decrypt',
      key,
      iv,
    });
    const out1: number[] = cipher.update(ciphertext);
    const out2: number[] = cipher.final();
    return new Uint8Array(out1.concat(out2));
  },
};
