import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import type { SymmetricAlgorithm } from './types';

/**
 * ChaCha20-Poly1305 AEAD 适配器。
 * 封装 @noble/ciphers，密钥 256 位，nonce 12 字节，tag 16 字节。
 */
export const chacha20Poly1305Algo: SymmetricAlgorithm = {
  id: 'ChaCha20-Poly1305',
  label: 'ChaCha20-Poly1305',
  ivLength: 12,
  keyLengths: [256],
  defaultKeyLength: 256,
  isAead: true,

  async encrypt(plaintext, key, iv) {
    const cipher = chacha20poly1305(key, iv);
    return cipher.encrypt(plaintext);
  },

  async decrypt(ciphertext, key, iv) {
    const cipher = chacha20poly1305(key, iv);
    return cipher.decrypt(ciphertext);
  },
};
