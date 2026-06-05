import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  // 向后兼容 API 测试（已废弃但需保留测试直到移除）
  encryptAES,
  decryptAES,
} from '../../utils/crypto/crypto';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  arrayBufferToHex,
  hexToArrayBuffer,
  encodeBuffer,
  decodeToBuffer,
} from '../../utils/shared/array-buffer';
import type { AlgorithmId } from '../../utils/crypto/algorithms/types';
import type { OutputFormat } from '../../utils/shared/array-buffer';

describe('encrypt & decrypt — AES 算法', () => {
  it('应正确加密和解密文本（AES-GCM）', async () => {
    const plaintext = 'Hello, World!';
    const password = 'my-secret-password';
    const encrypted = await encrypt(plaintext, password, 'AES-GCM', 256);
    expect(encrypted).toBeTruthy();
    const decrypted = await decrypt(encrypted, password, 'AES-GCM', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应正确加密和解密中文文本', async () => {
    const plaintext = '你好，世界！🔐';
    const password = '密码';
    const encrypted = await encrypt(plaintext, password, 'AES-GCM', 256);
    const decrypted = await decrypt(encrypted, password, 'AES-GCM', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持 AES-CBC 模式', async () => {
    const plaintext = 'AES-CBC test';
    const password = 'password';
    const encrypted = await encrypt(plaintext, password, 'AES-CBC', 256);
    const decrypted = await decrypt(encrypted, password, 'AES-CBC', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持 AES-CTR 模式', async () => {
    const plaintext = 'AES-CTR test';
    const password = 'password';
    const encrypted = await encrypt(plaintext, password, 'AES-CTR', 256);
    const decrypted = await decrypt(encrypted, password, 'AES-CTR', 256);
    expect(decrypted).toBe(plaintext);
  });

  it('应支持不同密钥长度', async () => {
    for (const length of [128, 192, 256] as const) {
      const encrypted = await encrypt('test', 'pass', 'AES-GCM', length);
      const decrypted = await decrypt(encrypted, 'pass', 'AES-GCM', length);
      expect(decrypted).toBe('test');
    }
  });

  it('密码错误时应抛出异常', async () => {
    const encrypted = await encrypt('secret', 'correct-password', 'AES-GCM', 256);
    await expect(decrypt(encrypted, 'wrong-password', 'AES-GCM', 256)).rejects.toThrow();
  });

  it('空明文应能加密解密', async () => {
    const encrypted = await encrypt('', 'password', 'AES-GCM', 256);
    const decrypted = await decrypt(encrypted, 'password', 'AES-GCM', 256);
    expect(decrypted).toBe('');
  });
});

describe('encrypt & decrypt — 新算法', () => {
  const algorithms: { id: AlgorithmId; keyLen: number }[] = [
    { id: 'ChaCha20-Poly1305', keyLen: 256 },
    { id: 'SM4-CBC', keyLen: 128 },
    { id: 'DES-CBC', keyLen: 64 },
    { id: '3DES-CBC', keyLen: 192 },
  ];

  for (const { id, keyLen } of algorithms) {
    describe(id, () => {
      it('应正确加密和解密英文文本', async () => {
        const plaintext = 'Hello, DevTools!';
        const encrypted = await encrypt(plaintext, 'password', id, keyLen);
        const decrypted = await decrypt(encrypted, 'password', id, keyLen);
        expect(decrypted).toBe(plaintext);
      });

      it('应正确加密和解密中文文本', async () => {
        const plaintext = '你好，世界！🔐';
        const encrypted = await encrypt(plaintext, '密码', id, keyLen);
        const decrypted = await decrypt(encrypted, '密码', id, keyLen);
        expect(decrypted).toBe(plaintext);
      });

      it('密码错误时应抛出异常', async () => {
        const encrypted = await encrypt('secret', 'correct', id, keyLen);
        await expect(decrypt(encrypted, 'wrong', id, keyLen)).rejects.toThrow();
      });
    });
  }
});

describe('输出格式支持', () => {
  it('应支持 Base64 格式加密解密', async () => {
    const encrypted = await encrypt('test', 'pass', 'AES-GCM', 256, 'base64');
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const decrypted = await decrypt(encrypted, 'pass', 'AES-GCM', 256, 'base64');
    expect(decrypted).toBe('test');
  });

  it('应支持小写 Hex 格式加密解密', async () => {
    const encrypted = await encrypt('test', 'pass', 'AES-GCM', 256, 'hex');
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    const decrypted = await decrypt(encrypted, 'pass', 'AES-GCM', 256, 'hex');
    expect(decrypted).toBe('test');
  });

  it('应支持大写 HEX 格式加密解密', async () => {
    const encrypted = await encrypt('test', 'pass', 'AES-GCM', 256, 'hexUpper');
    expect(encrypted).toMatch(/^[0-9A-F]+$/);
    const decrypted = await decrypt(encrypted, 'pass', 'AES-GCM', 256, 'hexUpper');
    expect(decrypted).toBe('test');
  });

  it('跨格式加密结果应一致（Base64 → Hex 同一密文）', async () => {
    const encryptedB64 = await encrypt('test', 'pass', 'AES-GCM', 256, 'base64');
    const encryptedHex = await encrypt('test', 'pass', 'AES-GCM', 256, 'hex');
    // 不同格式都是可以解密的
    const decryptedB64 = await decrypt(encryptedB64, 'pass', 'AES-GCM', 256, 'base64');
    const decryptedHex = await decrypt(encryptedHex, 'pass', 'AES-GCM', 256, 'hex');
    expect(decryptedB64).toBe('test');
    expect(decryptedHex).toBe('test');
  });

  it('SM4 应支持 Hex 格式', async () => {
    const encrypted = await encrypt('hello', 'pass', 'SM4-CBC', 128, 'hex');
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    const decrypted = await decrypt(encrypted, 'pass', 'SM4-CBC', 128, 'hex');
    expect(decrypted).toBe('hello');
  });

  it('ChaCha20-Poly1305 应支持 Hex 格式', async () => {
    const encrypted = await encrypt('hello', 'pass', 'ChaCha20-Poly1305', 256, 'hex');
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    const decrypted = await decrypt(encrypted, 'pass', 'ChaCha20-Poly1305', 256, 'hex');
    expect(decrypted).toBe('hello');
  });
});

describe('向后兼容 API', () => {
  it('encryptAES/decryptAES 应正常工作', async () => {
    const encrypted = await encryptAES('test', 'pass', 'AES-GCM', 256);
    const decrypted = await decryptAES(encrypted, 'pass', 'AES-GCM', 256);
    expect(decrypted).toBe('test');
  });
});

describe('arrayBuffer 编解码工具', () => {
  it('应正确转换 ArrayBuffer 到 Base64 再回到 ArrayBuffer', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const base64 = arrayBufferToBase64(original.buffer as ArrayBuffer);
    const restored = base64ToArrayBuffer(base64);
    expect(new Uint8Array(restored)).toEqual(original);
  });

  it('应正确转换 ArrayBuffer 到 Hex 再回到 ArrayBuffer', () => {
    const original = new Uint8Array([0, 15, 255, 128]);
    const hex = arrayBufferToHex(original.buffer as ArrayBuffer);
    expect(hex).toBe('000fff80');
    const restored = hexToArrayBuffer(hex);
    expect(new Uint8Array(restored)).toEqual(original);
  });

  it('hexToArrayBuffer 应支持大写', () => {
    const restored = hexToArrayBuffer('000FFF80');
    expect(new Uint8Array(restored)).toEqual(new Uint8Array([0, 15, 255, 128]));
  });

  it('encodeBuffer/decodeToBuffer 应往返一致', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const formats: OutputFormat[] = ['base64', 'hex', 'hexUpper'];
    for (const fmt of formats) {
      const encoded = encodeBuffer(data.buffer as ArrayBuffer, fmt);
      const decoded = decodeToBuffer(encoded, fmt);
      expect(new Uint8Array(decoded)).toEqual(data);
    }
  });
});
