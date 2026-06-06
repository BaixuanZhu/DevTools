/**
 * Base64 转文件工具函数
 * 将 Base64 字符串解码为文件 Blob，提供信息提取和下载能力
 */
import {
  formatFileSize,
  base64ToArrayBuffer,
  base64ToArrayBufferAsync,
  cleanBase64,
  detectMimeType,
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
  /** 是否通过文件头魔数自动识别出 MIME 类型 */
  isDetectedByMagic: boolean;
}

/** 常用非图片 MIME 类型选项（用于无 data URI 时手动选择） */
export const COMMON_MIME_TYPES = [
  { value: 'application/octet-stream', label: 'application/octet-stream（未知二进制）' },
  { value: 'text/plain', label: 'text/plain（纯文本）' },
  { value: 'application/json', label: 'application/json（JSON）' },
  { value: 'application/pdf', label: 'application/pdf（PDF）' },
  { value: 'application/xml', label: 'application/xml（XML）' },
  { value: 'text/csv', label: 'text/csv（CSV）' },
  { value: 'application/zip', label: 'application/zip（ZIP）' },
  { value: 'application/gzip', label: 'application/gzip（GZIP）' },
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
 * 判断 MIME 类型是否为图片。
 * 用于 Base64 转文件与 Base64 转图片的格式互斥。
 */
function isImageMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
}

/**
 * 根据清理后的 Base64 和 data URI 信息推断最终 MIME 类型，
 * 并与图片格式做互斥检查。
 *
 * 优先级：魔数检测（非图片）> data URI 声明（非图片）> fallbackMimeType。
 * 若魔数或 data URI 检测到图片格式，抛出互斥提示错误。
 *
 * @returns 包含最终 MIME 类型和是否通过魔数检测的标志
 */
function resolveFileMimeType(
  cleaned: string,
  uriMime: string | null,
  fallbackMimeType: string,
): { mimeType: string; isDetectedByMagic: boolean } {
  // 1. 魔数检测：若检测到非图片格式，直接采用（最可信）
  const detected = detectMimeType(cleaned);
  if (detected) {
    if (isImageMimeType(detected)) {
      throw new Error('检测到图片格式，请使用「Base64 转图片」工具进行预览和下载');
    }
    return { mimeType: detected, isDetectedByMagic: true };
  }

  // 2. data URI 声明的 MIME：若声明为图片也做互斥提示
  if (uriMime) {
    if (isImageMimeType(uriMime)) {
      throw new Error('检测到图片格式，请使用「Base64 转图片」工具进行预览和下载');
    }
    return { mimeType: uriMime, isDetectedByMagic: false };
  }

  // 3. 回退到用户选择的 MIME 类型
  return { mimeType: fallbackMimeType, isDetectedByMagic: false };
}

/**
 * 将 Base64 字符串解码为文件（同步版本，适合小文件）
 *
 * 自动清理输入中的空白字符和 URL-safe 字符。
 * 通过文件头魔数检测实际格式；若检测到图片格式会提示用户转用「Base64 转图片」。
 *
 * @param base64Input data URI 或纯 Base64 字符串
 * @param fallbackMimeType 无 data URI 且魔数未识别时的备用 MIME 类型，默认 application/octet-stream
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

  const { mimeType, isDetectedByMagic } = resolveFileMimeType(cleaned, uriMime, fallbackMimeType);
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
    isDetectedByMagic,
  };
}

/**
 * 将 Base64 字符串异步解码为文件（大文件不阻塞主线程）
 *
 * 与同步版本功能相同，但对大文件使用分块异步处理。
 * 通过文件头魔数检测实际格式；若检测到图片格式会提示用户转用「Base64 转图片」。
 *
 * @param base64Input data URI 或纯 Base64 字符串
 * @param fallbackMimeType 无 data URI 且魔数未识别时的备用 MIME 类型
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

  const { mimeType, isDetectedByMagic } = resolveFileMimeType(cleaned, uriMime, fallbackMimeType);
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
    isDetectedByMagic,
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
