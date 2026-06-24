/**
 * 通用文本文件下载。
 *
 * 将文本内容封装为 Blob 并通过临时 <a download> 触发浏览器下载，
 * 下载完成后立即释放 objectURL，避免内存泄漏。
 * @param filename - 下载文件名（如 'robots.txt'）
 * @param content - 文件文本内容
 * @param mimeType - MIME 类型，默认 'text/plain;charset=utf-8'
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
