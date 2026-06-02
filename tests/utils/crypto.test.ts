import { describe, it, expect } from 'vitest';
import {
  encryptAES,
  decryptAES,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../../src/utils/crypto';

describe('encryptAES & decryptAES', () => {
  it('应正确加密和解密文本（AES-GCM）', async () => {
    const plaintext = 'Hello, World!';
    const password = 'my-secret-password';
    const encrypted = await encryptAES(plaintext, password, 'AES-GCM', 256);
    expect(encrypted).toBeTruthy();
    const decrypted = await decryptAES(encrypted, password, 'AES-GCM', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应正确加密和解密中文文本', async () => {
    const plaintext = '你好，世界！🔐';
    const password = '密码';
    const encrypted = await encryptAES(plaintext, password, 'AES-GCM', 256);
    const decrypted = await decryptAES(encrypted, password, 'AES-GCM', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持 AES-CBC 模式', async () => {
    const plaintext = 'AES-CBC test';
    const password = 'password';
    const encrypted = await encryptAES(plaintext, password, 'AES-CBC', 256);
    const decrypted = await decryptAES(encrypted, password, 'AES-CBC', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持 AES-CTR 模式', async () => {
    const plaintext = 'AES-CTR test';
    const password = 'password';
    const encrypted = await encryptAES(plaintext, password, 'AES-CTR', 256);
    const decrypted = await decryptAES(encrypted, password, 'AES-CTR', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持不同密钥长度', async () => {
    for (const length of [128, 192, 256] as const) {
      const encrypted = await encryptAES('test', 'pass', 'AES-GCM', length);
      const decrypted = await decryptAES(encrypted, 'pass', 'AES-GCM', length);
      expect(decrypted).toBe('test');
    }
  });

  it('密码错误时应抛出异常', async () => {
    const encrypted = await encryptAES('secret', 'correct-password', 'AES-GCM', 256);
    await expect(decryptAES(encrypted, 'wrong-password', 'AES-GCM', 256)).rejects.toThrow();
  });

  it('空明文应能加密解密', async () => {
    const encrypted = await encryptAES('', 'password', 'AES-GCM', 256);
    const decrypted = await decryptAES(encrypted, 'password', 'AES-GCM', 256);
    expect(decrypted).toBe('');
  });
});

describe('arrayBufferToBase64 & base64ToArrayBuffer', () => {
  it('应正确转换 ArrayBuffer 到 Base64 再回到 ArrayBuffer', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const base64 = arrayBufferToBase64(original.buffer as ArrayBuffer);
    const restored = base64ToArrayBuffer(base64);
    expect(new Uint8Array(restored)).toEqual(original);
  });
});
