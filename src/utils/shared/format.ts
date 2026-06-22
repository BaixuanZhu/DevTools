/**
 * 通用格式化工具。
 */

/**
 * 格式化字节数为人类可读字符串。
 *
 * <1KB 显示 B，<1MB 显示 KB（一位小数），≥1MB 显示 MB（两位小数）。
 * @param bytes 字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
