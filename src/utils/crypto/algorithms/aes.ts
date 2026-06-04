import type { SymmetricAlgorithm } from './types';

/** AES-GCM 适配器（Web Crypto API） */
export const aesGcm: SymmetricAlgorithm = {
  id: 'AES-GCM',
  label: 'AES-GCM',
  ivLength: 12,
  keyLengths: [128, 192, 256],
  defaultKeyLength: 256,
  isAead: true,

  async encrypt(plaintext, key, iv) {
    const cryptoKey = await importAesKey(key, 'AES-GCM', false);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
    return new Uint8Array(encrypted);
  },

  async decrypt(ciphertext, key, iv) {
    const cryptoKey = await importAesKey(key, 'AES-GCM', false);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
    return new Uint8Array(decrypted);
  },
};

/** AES-CBC 适配器（Web Crypto API） */
export const aesCbc: SymmetricAlgorithm = {
  id: 'AES-CBC',
  label: 'AES-CBC',
  ivLength: 16,
  keyLengths: [128, 192, 256],
  defaultKeyLength: 256,
  isAead: false,

  async encrypt(plaintext, key, iv) {
    const cryptoKey = await importAesKey(key, 'AES-CBC', false);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, plaintext);
    return new Uint8Array(encrypted);
  },

  async decrypt(ciphertext, key, iv) {
    const cryptoKey = await importAesKey(key, 'AES-CBC', false);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertext);
    return new Uint8Array(decrypted);
  },
};

/** AES-CTR 适配器（Web Crypto API） */
export const aesCtr: SymmetricAlgorithm = {
  id: 'AES-CTR',
  label: 'AES-CTR',
  ivLength: 16,
  keyLengths: [128, 192, 256],
  defaultKeyLength: 256,
  isAead: false,

  async encrypt(plaintext, key, iv) {
    const cryptoKey = await importAesKey(key, 'AES-CTR', false);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: iv, length: 64 },
      cryptoKey,
      plaintext,
    );
    return new Uint8Array(encrypted);
  },

  async decrypt(ciphertext, key, iv) {
    const cryptoKey = await importAesKey(key, 'AES-CTR', false);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: iv, length: 64 },
      cryptoKey,
      ciphertext,
    );
    return new Uint8Array(decrypted);
  },
};

/**
 * 将原始密钥字节导入为 Web Crypto CryptoKey
 * @param rawKey - 原始密钥字节
 * @param algorithm - AES 算法名称
 */
async function importAesKey(
  rawKey: Uint8Array,
  algorithm: string,
  extractable: boolean,
): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey, { name: algorithm }, extractable, [
    'encrypt',
    'decrypt',
  ]);
}
