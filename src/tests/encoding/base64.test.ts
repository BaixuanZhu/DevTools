import { describe, it, expect } from 'vitest';
import {
  encodeBase64,
  decodeBase64,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  detectMimeType,
  formatFileSize,
} from '../../utils/encoding/base64';

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

describe('arrayBufferToBase64', () => {
  it('应正确编码 ArrayBuffer 为 Base64', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(arrayBufferToBase64(bytes.buffer)).toBe('SGVsbG8=');
  });

  it('应正确编码空 ArrayBuffer', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('');
  });
});

describe('base64ToArrayBuffer', () => {
  it('应正确解码 Base64 为 ArrayBuffer', () => {
    const buffer = base64ToArrayBuffer('SGVsbG8=');
    const bytes = new Uint8Array(buffer);
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });
});

describe('arrayBufferToBase64 + base64ToArrayBuffer roundtrip', () => {
  it('编码再解码应还原原始数据', () => {
    const original = new Uint8Array([0, 127, 255, 1, 42, 100]);
    const encoded = arrayBufferToBase64(original.buffer);
    const decoded = new Uint8Array(base64ToArrayBuffer(encoded));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});

describe('detectMimeType', () => {
  it('应检测 PNG 文件', () => {
    // PNG header: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const base64 = arrayBufferToBase64(pngHeader.buffer);
    expect(detectMimeType(base64)).toBe('image/png');
  });

  it('应检测 JPEG 文件', () => {
    // JPEG header: FF D8 FF
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const base64 = arrayBufferToBase64(jpegHeader.buffer);
    expect(detectMimeType(base64)).toBe('image/jpeg');
  });

  it('未知数据应返回 null', () => {
    const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const base64 = arrayBufferToBase64(unknown.buffer);
    expect(detectMimeType(base64)).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('500 字节应显示为 "500 B"', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('1536 字节应显示为 "1.5 KB"', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('2MB 应显示为 "2.0 MB"', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('1.5GB 应显示为 "1.5 GB"', () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });
});
