import { describe, it, expect } from 'vitest';
import {
  encodeBase64,
  decodeBase64,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToArrayBufferAsync,
  detectMimeType,
  formatFileSize,
  cleanBase64,
  sanitizeBase64,
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

describe('decodeBase64 with options', () => {
  it('应使用 GBK 字符集解码', () => {
    // "中文" 的 GBK 字节 D6 D0 CE C4 → Base64: 1tDOxA==
    expect(decodeBase64('1tDOxA==', { charset: 'gbk' })).toBe('中文');
  });

  it('应使用 Big5 字符集解码', () => {
    // "中文" 的 Big5 字节 A4 A4 A4 E5 → Base64: pKSk5Q==
    expect(decodeBase64('pKSk5Q==', { charset: 'big5' })).toBe('中文');
  });

  it('应使用 Shift_JIS 字符集解码', () => {
    // "あいう" 的 Shift_JIS 字节 → Base64: gqCCooKk
    expect(decodeBase64('gqCCooKk', { charset: 'shift_jis' })).toBe('あいう');
  });

  it('应使用 EUC-KR 字符集解码', () => {
    // "아름" 的 EUC-KR 字节 → Base64: vsa4pw==
    expect(decodeBase64('vsa4pw==', { charset: 'euc-kr' })).toBe('아름');
  });

  it('同一 Base64 用不同字符集解码结果应不同', () => {
    // GBK 编码的 "中文" 用默认 UTF-8 解码为乱码，用 GBK 解码为原文
    expect(decodeBase64('1tDOxA==')).not.toBe('中文');
    expect(decodeBase64('1tDOxA==', { charset: 'gbk' })).toBe('中文');
  });

  it('filterInvalid 为 true 时应过滤非法字符后解码', () => {
    // 'Hello' = SGVsbG8=，插入 !@# 非法字符
    expect(decodeBase64('SGVs!@#bG8=', { filterInvalid: true })).toBe('Hello');
  });

  it('默认（不传 filterInvalid）含非法字符应抛错', () => {
    expect(() => decodeBase64('SGVs!@#bG8=')).toThrow();
  });

  it('不支持的字符集应抛出含「字符集」的友好错误', () => {
    expect(() => decodeBase64('SGVsbG8=', { charset: 'nonexistent-charset' })).toThrow(/字符集/);
  });
});

describe('sanitizeBase64', () => {
  it('应移除所有非 Base64 字符', () => {
    expect(sanitizeBase64('SGVs!@#bG8=')).toBe('SGVsbG8=');
  });

  it('应保留合法 Base64 字符不变', () => {
    expect(sanitizeBase64('SGVsbG8=')).toBe('SGVsbG8=');
  });

  it('应剥离 data URI 前缀并过滤杂质', () => {
    expect(sanitizeBase64('data:text/plain;base64,SGVs bG8=')).toBe('SGVsbG8=');
  });

  it('应处理空输入', () => {
    expect(sanitizeBase64('')).toBe('');
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

describe('cleanBase64', () => {
  it('应去除空白字符', () => {
    expect(cleanBase64('SGVs\n bG8=  ')).toBe('SGVsbG8=');
  });

  it('应转换 URL-safe 字符', () => {
    // "Hello" in standard base64: SGVsbG8=
    // URL-safe variant: SGVsbG8 (no padding, already standard chars)
    // Use a case with - and _: "any?" -> YW55Pw== → URL-safe: YW55Pw
    expect(cleanBase64('YW55Pw')).toBe('YW55Pw==');
  });

  it('应去除 data URI 前缀', () => {
    expect(cleanBase64('data:text/plain;base64,SGVsbG8=')).toBe('SGVsbG8=');
  });

  it('应补齐 padding', () => {
    // "Hello" = SGVsbG8= (already padded); "Hell" = SGVsbA==
    expect(cleanBase64('SGVsbA')).toBe('SGVsbA==');
  });

  it('应处理空输入', () => {
    expect(cleanBase64('')).toBe('');
    expect(cleanBase64('   ')).toBe('');
  });

  it('应保留已正确格式化的 base64', () => {
    expect(cleanBase64('SGVsbG8=')).toBe('SGVsbG8=');
  });
});

describe('base64ToArrayBufferAsync', () => {
  it('应与同步版本结果一致', async () => {
    const original = 'SGVsbG8=';
    const syncBuffer = base64ToArrayBuffer(original);
    const asyncBuffer = await base64ToArrayBufferAsync(original);
    expect(new Uint8Array(asyncBuffer)).toEqual(new Uint8Array(syncBuffer));
  });

  it('应处理带空白的输入', async () => {
    const withWhitespace = 'SGVs\nbG8=';
    const asyncBuffer = await base64ToArrayBufferAsync(withWhitespace);
    const syncBuffer = base64ToArrayBuffer('SGVsbG8=');
    expect(new Uint8Array(asyncBuffer)).toEqual(new Uint8Array(syncBuffer));
  });

  it('应处理空输入', async () => {
    const buffer = await base64ToArrayBufferAsync('');
    expect(buffer.byteLength).toBe(0);
  });
});

describe('detectMimeType (improved)', () => {
  it('应检测带 XML 声明的 SVG', () => {
    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const encoded = arrayBufferToBase64(new TextEncoder().encode(svg).buffer);
    expect(detectMimeType(encoded)).toBe('image/svg+xml');
  });

  it('应检测裸 SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const encoded = arrayBufferToBase64(new TextEncoder().encode(svg).buffer);
    expect(detectMimeType(encoded)).toBe('image/svg+xml');
  });

  it('应检测含空白字符的 base64 输入', () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const base64 = arrayBufferToBase64(pngHeader.buffer);
    const withWhitespace = base64.slice(0, 4) + '\n' + base64.slice(4);
    expect(detectMimeType(withWhitespace)).toBe('image/png');
  });

  it('应检测带 data URI 前缀的输入', () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const base64 = arrayBufferToBase64(pngHeader.buffer);
    const dataUri = `data:image/png;base64,${base64}`;
    expect(detectMimeType(dataUri)).toBe('image/png');
  });

  it('应检测 AVIF 格式', () => {
    // AVIF: ISO BMFF ftyp box with "avif" brand at offset 8
    // [size(4)] + "ftyp" + "avif" + ...
    const avifHeader = new Uint8Array([
      0x00, 0x00, 0x00, 0x20,  // box size (32)
      0x66, 0x74, 0x79, 0x70,  // "ftyp"
      0x61, 0x76, 0x69, 0x66,  // "avif"
      0x00, 0x00, 0x00, 0x00,  // padding
    ]);
    const base64 = arrayBufferToBase64(avifHeader.buffer);
    expect(detectMimeType(base64)).toBe('image/avif');
  });

  it('应检测 HEIC 格式', () => {
    // HEIC: ISO BMFF ftyp box with "heic" brand at offset 8
    const heicHeader = new Uint8Array([
      0x00, 0x00, 0x00, 0x20,  // box size
      0x66, 0x74, 0x79, 0x70,  // "ftyp"
      0x68, 0x65, 0x69, 0x63,  // "heic"
      0x00, 0x00, 0x00, 0x00,
    ]);
    const base64 = arrayBufferToBase64(heicHeader.buffer);
    expect(detectMimeType(base64)).toBe('image/heic');
  });
});
