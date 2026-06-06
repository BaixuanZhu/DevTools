/**
 * Base64 转图片工具函数
 * 将 Base64 字符串解码为图片 Blob，提供预览、信息提取和下载能力
 */
import {
  formatFileSize,
  detectMimeType,
  base64ToArrayBuffer,
  base64ToArrayBufferAsync,
  cleanBase64,
} from './base64';

/** 图片解码结果 */
export interface ImageDecodeResult {
  /** 用于 img src 的 Object URL */
  objectUrl: string;
  /** 解码后的 Blob 对象 */
  blob: Blob;
  /** MIME 类型（如 image/png） */
  mimeType: string;
  /** 图片宽度（像素） */
  width: number;
  /** 图片高度（像素） */
  height: number;
  /** 文件大小（字节数） */
  size: number;
  /** 格式化后的文件大小（如 "3.2 KB"） */
  sizeFormatted: string;
}

/** 支持预览的图片 MIME 类型 */
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/avif',
  'image/heic',
  'image/heif',
];

/**
 * 从 data URI 中提取纯 Base64 数据和 MIME 类型
 * @param input data URI 或纯 Base64 字符串
 * @returns { pureBase64: string; mimeType: string | null }
 */
function parseDataUri(input: string): { pureBase64: string; mimeType: string | null } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { pureBase64: match[2], mimeType: match[1] };
  }
  return { pureBase64: input, mimeType: null };
}

/**
 * 检测给定 MIME 类型是否为图片
 * @param mimeType MIME 类型字符串
 */
export function isImageMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return IMAGE_MIME_TYPES.includes(mimeType);
}

/**
 * 将 Base64 字符串解码为图片 Blob（同步版本，适合小文件）
 *
 * 自动清理输入中的空白字符和 URL-safe 字符，
 * 通过魔数检测 MIME 类型。
 *
 * @param base64Input data URI 或纯 Base64 字符串
 * @returns ImageDecodeResult（不含 width/height，需通过 loadImageDimensions 补充）
 */
export function decodeBase64ToImageBlob(
  base64Input: string,
): Omit<ImageDecodeResult, 'width' | 'height'> {
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

  const buffer = base64ToArrayBuffer(cleaned);
  const detectedMime = uriMime ?? detectMimeType(cleaned);

  if (!detectedMime || !isImageMimeType(detectedMime)) {
    throw new Error('无法识别为图片格式，请检查输入是否为图片的 Base64 编码');
  }

  const size = buffer.byteLength;
  const blob = new Blob([buffer], { type: detectedMime });
  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    blob,
    mimeType: detectedMime,
    size,
    sizeFormatted: formatFileSize(size),
  };
}

/**
 * 将 Base64 字符串异步解码为图片 Blob（大文件不阻塞主线程）
 *
 * 与同步版本功能相同，但对大文件使用分块异步处理，
 * 避免阻塞主线程导致页面无响应。
 *
 * @param base64Input data URI 或纯 Base64 字符串
 * @param onProgress 可选进度回调，参数为 0-1 之间的比例
 */
export async function decodeBase64ToImageBlobAsync(
  base64Input: string,
  onProgress?: (ratio: number) => void,
): Promise<Omit<ImageDecodeResult, 'width' | 'height'>> {
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

  const buffer = await base64ToArrayBufferAsync(cleaned, onProgress);
  const detectedMime = uriMime ?? detectMimeType(cleaned);

  if (!detectedMime || !isImageMimeType(detectedMime)) {
    throw new Error('无法识别为图片格式，请检查输入是否为图片的 Base64 编码');
  }

  const size = buffer.byteLength;
  const blob = new Blob([buffer], { type: detectedMime });
  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    blob,
    mimeType: detectedMime,
    size,
    sizeFormatted: formatFileSize(size),
  };
}

/**
 * 加载图片并获取尺寸信息
 * @param objectUrl 由 decodeBase64ToImageBlob 生成的 Object URL
 * @returns Promise<{ width: number; height: number }>
 */
export function loadImageDimensions(
  objectUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('图片加载失败，请检查输入数据'));
    };
    img.src = objectUrl;
  });
}

/**
 * 触发图片下载
 * @param blob 图片 Blob
 * @param mimeType MIME 类型，用于推断文件扩展名
 */
export function downloadImageBlob(blob: Blob, mimeType: string): void {
  const ext = mimeToImageExt(mimeType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `image${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * MIME 类型 → 图片文件扩展名
 * @param mimeType MIME 类型字符串
 */
export function mimeToImageExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'image/avif': '.avif',
    'image/heic': '.heic',
    'image/heif': '.heif',
  };
  return map[mimeType] ?? '.png';
}
