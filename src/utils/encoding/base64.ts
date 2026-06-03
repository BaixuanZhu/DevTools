/** 将文本编码为 Base64（支持 Unicode） */
export function encodeBase64(text: string): string {
  if (!text) return '';
  return btoa(unescape(encodeURIComponent(text)));
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
    return decodeURIComponent(escape(atob(pure)));
  } catch {
    throw new Error('无效的 Base64 输入，请检查格式是否正确');
  }
}
