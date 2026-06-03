import { describe, it, expect } from 'vitest';
import { encodeBase64, decodeBase64 } from '../../utils/encoding/base64';

describe('encodeBase64', () => {
  it('应正确编码 ASCII 文本', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=');
  });

  it('应正确编码 Unicode 文本', () => {
    expect(encodeBase64('你好')).toBe('5L2g5aW9');
  });

  it('应正确编码空字符串', () => {
    expect(encodeBase64('')).toBe('');
  });

  it('应正确编码包含各种特殊字符的文本', () => {
    const input = 'Hello, 世界! 🌍';
    const encoded = encodeBase64(input);
    expect(decodeBase64(encoded)).toBe(input);
  });
});

describe('decodeBase64', () => {
  it('应正确解码 ASCII Base64', () => {
    expect(decodeBase64('aGVsbG8=')).toBe('hello');
  });

  it('应正确解码 Unicode Base64', () => {
    expect(decodeBase64('5L2g5aW9')).toBe('你好');
  });

  it('应正确解码 Data URL 前缀的 Base64', () => {
    const dataUrl = 'data:text/plain;base64,aGVsbG8=';
    expect(decodeBase64(dataUrl)).toBe('hello');
  });

  it('应抛出错误当输入非法 Base64', () => {
    expect(() => decodeBase64('!!!invalid!!!')).toThrow();
  });

  it('应正确处理往返编码', () => {
    const original = '测试 Test 123 !@#';
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });
});
