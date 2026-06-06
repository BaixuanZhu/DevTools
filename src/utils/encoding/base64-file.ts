/**
 * Base64 转文件工具函数
 * 将 Base64 字符串解码为文件 Blob，提供信息提取和下载能力
 */
import {
  formatFileSize,
  base64ToArrayBuffer,
  base64ToArrayBufferAsync,
  cleanBase64,
} from './base64';

/** 文件解码结果 */
export interface FileDecodeResult {
  /** 解码后的 Blob 对象 */
  blob: Blob;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小（字节数） */
  size: number;
  /** 格式化后的文件大小 */
  sizeFormatted: string;
  /** 推断的文件扩展名（如 .txt） */
  extension: string;
  /** 推断的文件名（如 decoded-file.txt） */
  fileName: string;
}

/** 常用 MIME 类型选项（用于无 data URI 时手动选择） */
export const COMMON_MIME_TYPES = [
  { value: 'application/octet-stream', label: 'application/octet-stream（未知）' },
  { value: 'text/plain', label: 'text/plain（纯文本）' },
  { value: 'application/json', label: 'application/json（JSON）' },
  { value: 'application/pdf', label: 'application/pdf（PDF）' },
  { value: 'application/xml', label: 'application/xml（XML）' },
  { value: 'text/csv', label: 'text/csv（CSV）' },
  { value: 'application/zip', label: 'application/zip（ZIP）' },
  { value: 'application/gzip', label: 'application/gzip（GZIP）' },
  { value: 'image/png', label: 'image/png（PNG）' },
  { value: 'image/jpeg', label: 'image/jpeg（JPEG）' },
];

/**
 * 从 data URI 中提取纯 Base64 数据和 MIME 类型
 * @param input data URI 或纯 Base64 字符串
 */
function parseDataUri(input: string): { pureBase64: string; mimeType: string | null } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { pureBase64: match[2], mimeType: match[1] };
  }
  return { pureBase64: input, mimeType: null };
}

/**
 * MIME 类型 → 文件扩展名映射
 * @param mimeType MIME 类型字符串
 */
export function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html',
    'text/xml': '.xml',
    'application/json': '.json',
    'application/pdf': '.pdf',
    'application/xml': '.xml',
    'application/zip': '.zip',
    'application/gzip': '.gz',
    'application/x-tar': '.tar',
    'application/x-7z-compressed': '.7z',
    'application/x-rar-compressed': '.rar',
    'application/octet-stream': '.bin',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/x-icon': '.ico',
    'image/avif': '.avif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[mimeType] ?? '.bin';
}

/**
 * 将 Base64 字符串解码为文件（同步版本，适合小文件）
 *
 * 自动清理输入中的空白字符和 URL-safe 字符。
 *
 * @param base64Input data URI 或纯 Base64 字符串
 * @param fallbackMimeType 无 data URI 时的备用 MIME 类型，默认 application/octet-stream
 */
export function decodeBase64ToFile(
  base64Input: string,
  fallbackMimeType: string = 'application/octet-stream',
): FileDecodeResult {
  const trimmed = base64Input.trim();
  if (!trimmed) {
    throw new Error('请输入 Base64 字符串');
  }

  const { pureBase64, mimeType: uriMime } = parseDataUri(trimmed);
  const cleaned = cleanBase64(pureBase64);

  if (!cleaned) {
    throw new Error('请输入 Base64 字符串');
  }

  // 校验 Base64 有效性
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('输入不是有效的 Base64 编码');
  }

  const mimeType = uriMime ?? fallbackMimeType;
  const buffer = base64ToArrayBuffer(cleaned);
  const size = buffer.byteLength;
  const blob = new Blob([buffer], { type: mimeType });
  const extension = mimeToExtension(mimeType);

  return {
    blob,
    mimeType,
    size,
    sizeFormatted: formatFileSize(size),
    extension,
    fileName: `decoded-file${extension}`,
  };
}

/**
 * 将 Base64 字符串异步解码为文件（大文件不阻塞主线程）
 *
 * 与同步版本功能相同，但对大文件使用分块异步处理。
 *
 * @param base64Input data URI 或纯 Base64 字符串
 * @param fallbackMimeType 无 data URI 时的备用 MIME 类型
 * @param onProgress 可选进度回调，参数为 0-1 之间的比例
 */
export async function decodeBase64ToFileAsync(
  base64Input: string,
  fallbackMimeType: string = 'application/octet-stream',
  onProgress?: (ratio: number) => void,
): Promise<FileDecodeResult> {
  const trimmed = base64Input.trim();
  if (!trimmed) {
    throw new Error('请输入 Base64 字符串');
  }

  const { pureBase64, mimeType: uriMime } = parseDataUri(trimmed);
  const cleaned = cleanBase64(pureBase64);

  if (!cleaned) {
    throw new Error('请输入 Base64 字符串');
  }

  // 校验 Base64 有效性
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('输入不是有效的 Base64 编码');
  }

  const mimeType = uriMime ?? fallbackMimeType;
  const buffer = await base64ToArrayBufferAsync(cleaned, onProgress);
  const size = buffer.byteLength;
  const blob = new Blob([buffer], { type: mimeType });
  const extension = mimeToExtension(mimeType);

  return {
    blob,
    mimeType,
    size,
    sizeFormatted: formatFileSize(size),
    extension,
    fileName: `decoded-file${extension}`,
  };
}

/**
 * 触发文件下载
 * @param result 文件解码结果
 */
export function downloadFile(result: FileDecodeResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 检测输入是否包含 data URI 前缀
 * @param input 用户输入字符串
 */
export function hasDataUriPrefix(input: string): boolean {
  return /^data:[^;]+;base64,/.test(input.trim());
}
