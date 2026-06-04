// === 字符类型 & 字符集 ===

export type CharType = 'uppercase' | 'lowercase' | 'digits' | 'special';

export const CHAR_SETS: Record<CharType, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?/',
};

/** 根据勾选的字符类型 + 可选自定义特殊字符，拼接最终字符池 */
export function resolveCharsetFromTypes(types: CharType[], customSpecial?: string): string {
  let chars = '';
  for (const t of types) {
    if (t === 'special') {
      chars += customSpecial ?? CHAR_SETS.special;
    } else {
      chars += CHAR_SETS[t];
    }
  }
  return chars;
}

/** 生成密码学安全的随机字符串 */
export function generateRandomString(length: number, charset: string): string {
  if (length <= 0) return '';
  if (!charset.length) return '';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => charset[x % charset.length]).join('');
}

// === 输出格式 ===

export type OutputFormat = 'none' | 'upper' | 'lower' | 'hex' | 'base64' | 'binary' | 'octal';

/** 将字符串的每个字符转为十六进制（每 2 位空格分组） */
export function stringToHex(str: string): string {
  if (!str) return '';
  const hex = Array.from(str)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  return hex.match(/.{2}/g)?.join(' ') ?? hex;
}

/** 将字符串的每个字符转为二进制（每 8 位空格分组） */
export function stringToBinary(str: string): string {
  if (!str) return '';
  const binary = Array.from(str)
    .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
  return binary.match(/.{8}/g)?.join(' ') ?? binary;
}

/** 将字符串的每个字符转为八进制（每 3 位空格分组） */
export function stringToOctal(str: string): string {
  if (!str) return '';
  const octal = Array.from(str)
    .map((ch) => ch.charCodeAt(0).toString(8).padStart(3, '0'))
    .join('');
  return octal.match(/.{3}/g)?.join(' ') ?? octal;
}

/** 对生成的字符串执行输出格式转换（大小写、编码） */
export function transformOutput(str: string, format: OutputFormat): string {
  switch (format) {
    case 'none':
      return str;
    case 'upper':
      return str.toUpperCase();
    case 'lower':
      return str.toLowerCase();
    case 'hex':
      return stringToHex(str);
    case 'base64':
      return btoa(str);
    case 'binary':
      return stringToBinary(str);
    case 'octal':
      return stringToOctal(str);
  }
}
