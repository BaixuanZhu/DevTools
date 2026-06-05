/** 编码输出格式 */
export type OutputFormat = 'base64' | 'hex' | 'hexUpper';

/**
 * 将 Uint8Array 底层 buffer 转为 ArrayBuffer。
 * TypeScript 6.0 中 Uint8Array.buffer 类型为 ArrayBufferLike（含 SharedArrayBuffer），
 * 而 Web Crypto API 要求 ArrayBuffer。本函数提供安全的类型桥接。
 * @param data - Uint8Array 数据
 * @returns 底层 ArrayBuffer
 */
export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer as ArrayBuffer;
}

/** 将 ArrayBuffer 转为 Base64 字符串（支持大型数据） */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** 将 Base64 字符串转为 ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** 将 ArrayBuffer 转为小写十六进制字符串 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 将十六进制字符串（大小写不敏感）转为 ArrayBuffer */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * 按指定格式编码 ArrayBuffer 为字符串
 * @param buffer - 要编码的二进制数据
 * @param format - 目标编码格式
 */
export function encodeBuffer(buffer: ArrayBuffer, format: OutputFormat): string {
  switch (format) {
    case 'base64':
      return arrayBufferToBase64(buffer);
    case 'hex':
      return arrayBufferToHex(buffer);
    case 'hexUpper':
      return arrayBufferToHex(buffer).toUpperCase();
  }
}

/**
 * 按指定格式将字符串解码为 ArrayBuffer
 * @param encoded - 编码后的字符串
 * @param format - 输入编码格式
 */
export function decodeToBuffer(encoded: string, format: OutputFormat): ArrayBuffer {
  switch (format) {
    case 'base64':
      return base64ToArrayBuffer(encoded);
    case 'hex':
    case 'hexUpper':
      return hexToArrayBuffer(encoded);
  }
}
