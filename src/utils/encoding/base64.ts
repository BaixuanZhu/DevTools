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

/**
 * 清理 Base64 字符串：去除空白字符、转换 URL-safe 字符、去除 data URI 前缀
 *
 * 解决从外部工具粘贴 base64 时常见的格式问题：
 * - 行末换行（76 字符折行）
 * - URL-safe 编码（`-` → `+`，`_` → `/`）
 * - 缺失 padding
 *
 * @param input 原始 Base64 字符串，可能包含空白、换行或 data URI 前缀
 * @returns 纯净的标准 Base64 字符串
 */
export function cleanBase64(input: string): string {
  let raw = input.trim();
  if (!raw) return '';
  // 去除 data URI 前缀
  const match = raw.match(/^data:[^;]+;base64,(.+)$/s);
  if (match) raw = match[1];
  // 去除所有空白字符（空格、换行、制表符等）
  raw = raw.replace(/\s/g, '');
  if (!raw) return '';
  // URL-safe base64 → 标准 base64
  raw = raw.replace(/-/g, '+').replace(/_/g, '/');
  // 补齐 padding
  while (raw.length % 4 !== 0) raw += '=';
  return raw;
}

/**
 * 将 ArrayBuffer 转为纯 Base64 字符串（不含 Data URL 前缀）
 *
 * 使用 8KB 分块避免字符串拼接的 O(n²) 复杂度，
 * 对大文件（10MB+）编码速度提升数百倍。
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';
  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, bytes.length);
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, end))));
  }
  return btoa(chunks.join(''));
}

/**
 * 将 ArrayBuffer 异步转为 Base64，大文件时不阻塞主线程
 * @param buffer ArrayBuffer 数据
 * @param onProgress 可选的进度回调，参数为 0-1 之间的比例
 */
export async function arrayBufferToBase64Async(
  buffer: ArrayBuffer,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';
  const CHUNK_SIZE = 8192;
  const YIELD_INTERVAL = 64; // 每 64 个 chunk (512KB) yield 一次
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const end = Math.min(offset + CHUNK_SIZE, bytes.length);
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, end))));
    if (chunks.length % YIELD_INTERVAL === 0) {
      onProgress?.(offset / bytes.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  onProgress?.(1);
  return btoa(chunks.join(''));
}

/** 将纯 Base64 字符串转回 ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * 将纯 Base64 字符串异步转回 ArrayBuffer，大文件时不阻塞主线程
 *
 * 自动清理空白字符和 URL-safe 字符。按 4 字符对齐切分，
 * 小文件（<1MB）直接同步处理以避免不必要的微任务开销。
 *
 * @param base64 纯 Base64 字符串（可含空白，不含 data URI 前缀）
 * @param onProgress 可选的进度回调，参数为 0-1 之间的比例
 */
export async function base64ToArrayBufferAsync(
  base64: string,
  onProgress?: (ratio: number) => void,
): Promise<ArrayBuffer> {
  const cleaned = cleanBase64(base64);
  if (!cleaned) return new ArrayBuffer(0);

  // 按 4 字符对齐切分，每段约 1MB
  const CHUNK_CHARS = 4 * 256 * 1024;
  const totalLen = cleaned.length;

  // 小文件直接同步处理
  if (totalLen <= CHUNK_CHARS) {
    onProgress?.(1);
    return base64ToArrayBuffer(cleaned);
  }

  // 大文件分块异步处理
  const parts: Uint8Array[] = [];
  for (let pos = 0; pos < totalLen; pos += CHUNK_CHARS) {
    const chunk = cleaned.slice(pos, Math.min(pos + CHUNK_CHARS, totalLen));
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    parts.push(bytes);
    onProgress?.(pos / totalLen);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // 合并所有分块
  const totalBytes = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  onProgress?.(1);
  return result.buffer;
}

/**
 * 基于文件头魔数判断 MIME 类型
 *
 * 自动清理输入中的空白字符和 URL-safe 字符。
 * SVG 检测支持裸 `<svg>`、`<?xml>` 前缀以及 UTF-8 BOM 前缀。
 */
export function detectMimeType(base64: string): string | null {
  const cleaned = cleanBase64(base64);
  if (!cleaned) return null;
  const buffer = base64ToArrayBuffer(cleaned);
  const bytes = new Uint8Array(buffer);

  const hex = (offset: number, length: number) =>
    Array.from(bytes.slice(offset, offset + length))
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');

  if (bytes.length >= 8 && hex(0, 4) === '89504E47') return 'image/png';
  if (bytes.length >= 3 && hex(0, 3) === 'FFD8FF') return 'image/jpeg';
  if (bytes.length >= 4 && hex(0, 4) === '47494638') return 'image/gif';
  if (bytes.length >= 12 && hex(0, 4) === '52494646' && hex(8, 4) === '57454250') return 'image/webp';

  // AVIF / HEIC: 基于 ISO Base Media File Format（ftyp box）
  // 字节 4-7 = "ftyp"，字节 8-11 = major brand
  if (bytes.length >= 12 && hex(4, 4) === '66747970') {
    const brand = hex(8, 4);
    if (brand === '61766966' || brand === '61766973') return 'image/avif';   // avif / avis
    if (brand === '68656963' || brand === '68656978') return 'image/heic';   // heic / heix
    if (brand === '6D696631') return 'image/heif';                            // mif1
  }

  // SVG: 解码前 256 字节为 UTF-8 文本，匹配 <svg（可能带 <?xml 前缀或 BOM）
  if (bytes.length >= 4) {
    const head = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, Math.min(256, bytes.length)));
    if (head.match(/^(?:\xEF\xBB\xBF)?(?:<\?xml[^>]*\?>)?\s*<svg/i)) {
      return 'image/svg+xml';
    }
  }

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
