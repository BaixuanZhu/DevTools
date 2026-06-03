/** 字符集预设名称 */
export type CharsetPreset = 'alphanumeric' | 'digits' | 'special' | `custom:${string}`;

/** 预设字符集 */
export const PRESET_CHARSETS: Record<string, string> = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  digits: '0123456789',
  special: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/',
};

/** 解析字符集预设为实际字符 */
function resolveCharset(preset: CharsetPreset): string {
  if (preset.startsWith('custom:')) {
    return preset.slice(7);
  }
  return PRESET_CHARSETS[preset] ?? PRESET_CHARSETS.alphanumeric;
}

/** 生成密码学安全的随机字符串 */
export function generateRandomString(length: number, charset: CharsetPreset): string {
  if (length <= 0) return '';

  const chars = resolveCharset(charset);
  if (!chars.length) return '';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}

/** 字母大小写模式 */
export type LetterCase = 'none' | 'upper' | 'lower';

/** 对字符串应用大小写转换 */
export function applyLetterCase(str: string, mode: LetterCase): string {
  if (mode === 'upper') return str.toUpperCase();
  if (mode === 'lower') return str.toLowerCase();
  return str;
}

/** 判断字符集预设是否包含字母 */
export function hasLetters(preset: CharsetPreset | string): boolean {
  if (preset === 'digits') return false;
  if (preset.startsWith('custom:')) {
    const chars = preset.slice(7);
    return /[a-zA-Z]/.test(chars);
  }
  return true;
}
