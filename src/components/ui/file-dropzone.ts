import { formatBytes } from '../../utils/media/image-convert';

/**
 * 校验文件是否满足 accept 与 maxSize 约束。
 *
 * @param file 待校验文件
 * @param accept 接受的 MIME 类型或扩展名，如 "image/*"、".json"
 * @param maxSize 文件大小上限（字节）
 * @returns 空字符串表示通过，否则为中文错误描述
 */
export function validateFile(file: File, accept?: string, maxSize?: number): string {
  if (accept && accept.trim()) {
    const tokens = accept
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const accepted = tokens.some((token) => {
      const lowerToken = token.toLowerCase();
      if (lowerToken.startsWith('.')) {
        return file.name.toLowerCase().endsWith(lowerToken);
      }
      if (lowerToken.endsWith('/*')) {
        return file.type.startsWith(lowerToken.slice(0, -1));
      }
      return file.type === token;
    });
    if (!accepted) return `文件类型不符，请上传 ${accept} 格式`;
  }

  if (maxSize && maxSize > 0 && file.size > maxSize) {
    return `文件过大（${formatBytes(file.size)}），超过 ${formatBytes(maxSize)} 上限`;
  }

  return '';
}
