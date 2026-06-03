import { arrayBufferToBase64, base64ToArrayBuffer } from '../shared/array-buffer';

/** AES 加密算法类型 */
export type AESAlgorithm = 'AES-GCM' | 'AES-CBC' | 'AES-CTR';

/** 支持的密钥长度 */
export type AESKeyLength = 128 | 192 | 256;

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH_GCM = 12;
const IV_LENGTH_CBC = 16;
const IV_LENGTH_CTR = 16;

/** 获取 IV 长度 */
function getIvLength(algorithm: AESAlgorithm): number {
  if (algorithm === 'AES-GCM') return IV_LENGTH_GCM;
  return IV_LENGTH_CBC;
}

/** 从密码派生密钥 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: algorithm, length: keyLength },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 获取加密算法参数 */
function getAlgorithmParams(algorithm: AESAlgorithm, iv: Uint8Array): AesGcmParams | AesCbcParams | AesCtrParams {
  if (algorithm === 'AES-CTR') {
    return { name: 'AES-CTR', counter: iv, length: 64 };
  }
  return { name: algorithm, iv };
}

/** AES 加密 */
export async function encryptAES(
  plaintext: string,
  password: string,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(getIvLength(algorithm)));
  const key = await deriveKey(password, salt, algorithm, keyLength);
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    getAlgorithmParams(algorithm, iv),
    key,
    encoder.encode(plaintext),
  );

  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return arrayBufferToBase64(combined.buffer as ArrayBuffer);
}

/** AES 解密 */
export async function decryptAES(
  encodedData: string,
  password: string,
  algorithm: AESAlgorithm,
  keyLength: AESKeyLength,
): Promise<string> {
  const combined = new Uint8Array(base64ToArrayBuffer(encodedData));
  const ivLen = getIvLength(algorithm);

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + ivLen);
  const ciphertext = combined.slice(SALT_LENGTH + ivLen);

  const key = await deriveKey(password, salt, algorithm, keyLength);
  const decrypted = await crypto.subtle.decrypt(
    getAlgorithmParams(algorithm, iv),
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
