/** 将文本编码为 Base64（支持 Unicode） */
export function encodeBase64(text: string): string {
  if (!text) return '';
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** 从 Base64 字符串中提取纯 Base64 数据（去除 Data URL 前缀） */
function stripDataUrl(base64: string): string {
  const match = base64.match(/^data:[^;]+;base64,(.+)$/s);
  return match ? match[1] : base64;
}

/** 将 Base64 解码为文本（支持 Unicode） */
export function decodeBase64(base64: string): string {
  if (!base64.trim()) return '';
  const pure = stripDataUrl(base64.trim());
  try {
    const binary = atob(pure);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    throw new Error('无效的 Base64 输入，请检查格式是否正确');
  }
}

/** 将 ArrayBuffer 转为纯 Base64 字符串（不含 Data URL 前缀） */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** 将纯 Base64 字符串转回 ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** 基于文件头魔数判断 MIME 类型 */
export function detectMimeType(base64: string): string | null {
  const pure = stripDataUrl(base64.trim());
  const buffer = base64ToArrayBuffer(pure);
  const bytes = new Uint8Array(buffer);

  const hex = (offset: number, length: number) =>
    Array.from(bytes.slice(offset, offset + length))
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');

  if (bytes.length >= 8 && hex(0, 4) === '89504E47') return 'image/png';
  if (bytes.length >= 3 && hex(0, 3) === 'FFD8FF') return 'image/jpeg';
  if (bytes.length >= 4 && hex(0, 4) === '47494638') return 'image/gif';
  if (bytes.length >= 12 && hex(0, 4) === '52494646' && hex(8, 4) === '57454250') return 'image/webp';
  if (bytes.length >= 3 && hex(0, 3) === '3C7376') return 'image/svg+xml';
  if (bytes.length >= 4 && hex(0, 4) === '25504446') return 'application/pdf';
  if (bytes.length >= 4 && hex(0, 4) === '504B0304') return 'application/zip';
  if (bytes.length >= 2 && hex(0, 2) === '424D') return 'image/bmp';

  return null;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
