import { describe, it, expect } from 'vitest';
import { computeHash, computeFileHash, HASH_ALGORITHMS, decodeToBytes } from '../../utils/crypto/hash';

describe('computeHash', () => {
  it('应正确计算 MD5 哈希', async () => {
    const result = await computeHash('hello', 'MD5');
    expect(result.hex).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('应正确计算 SHA-1 哈希', async () => {
    const result = await computeHash('hello', 'SHA-1');
    expect(result.hex).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('应正确计算 SHA-256 哈希', async () => {
    const result = await computeHash('hello', 'SHA-256');
    expect(result.hex).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('应正确计算 SHA-384 哈希', async () => {
    const result = await computeHash('hello', 'SHA-384');
    expect(result.hex).toBe(
      '59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f',
    );
  });

  it('应正确计算 SHA-512 哈希', async () => {
    const result = await computeHash('hello', 'SHA-512');
    expect(result.hex).toBe(
      '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043',
    );
  });

  it('应支持大写 hex 输出', async () => {
    const result = await computeHash('hello', 'MD5');
    expect(result.hexUpper).toBe('5D41402ABC4B2A76B9719D911017C592');
  });

  it('应支持 Base64 输出', async () => {
    const result = await computeHash('hello', 'MD5');
    expect(result.base64).toBe('XUFAKrxLKna5cZ2REBfFkg==');
  });

  it('空字符串也应计算哈希', async () => {
    const result = await computeHash('', 'SHA-256');
    expect(result.hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('应支持中文输入', async () => {
    const result = await computeHash('你好', 'SHA-256');
    expect(result.hex).toBe(
      '670d9743542cae3ea7ebe36af56bd53648b0a1126162e78d81a32934a711302e',
    );
  });
});

describe('computeFileHash', () => {
  it('应正确计算 ArrayBuffer 的哈希', async () => {
    const data = new TextEncoder().encode('hello');
    const result = await computeFileHash(data.buffer as ArrayBuffer, 'SHA-256');
    expect(result.hex).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});

describe('HASH_ALGORITHMS', () => {
  it('应包含 5 种算法', () => {
    expect(HASH_ALGORITHMS).toEqual(['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']);
  });
});

describe('decodeToBytes', () => {
  it('应按 text 编码解码 ASCII 文本', () => {
    const buf = decodeToBytes('AB', 'text');
    expect(Array.from(new Uint8Array(buf))).toEqual([0x41, 0x42]);
  });

  it('应按 text 编码解码中文（UTF-8）', () => {
    const buf = decodeToBytes('你', 'text');
    expect(Array.from(new Uint8Array(buf))).toEqual([0xe4, 0xbd, 0xa0]);
  });

  it('应按 hex 编码解码', () => {
    const buf = decodeToBytes('4142', 'hex');
    expect(Array.from(new Uint8Array(buf))).toEqual([0x41, 0x42]);
  });

  it('应按 base64 编码解码', () => {
    const buf = decodeToBytes('QUI=', 'base64');
    expect(Array.from(new Uint8Array(buf))).toEqual([0x41, 0x42]);
  });

  it('非法 hex 应抛错', () => {
    expect(() => decodeToBytes('zz', 'hex')).toThrow();
  });
});
