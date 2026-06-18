/**
 * 进制转换器核心工具模块。
 *
 * 支持二进制、八进制、十进制、十六进制之间的解析与转换，
 * 基于 BigInt 实现任意大整数，负数二进制按补码展示。
 */

/** 支持的进制 */
export type Base = 2 | 8 | 10 | 16;

/** 解析结果 */
export interface ParseResult {
  /** 解析后的有符号数值 */
  value: bigint;
  /** 原始是否为负数 */
  negative: boolean;
}

/** 进制选择项 */
export interface BaseOption {
  value: Base;
  label: string;
}

/** 页面下拉选项 */
export const BASE_OPTIONS: BaseOption[] = [
  { value: 2, label: '二进制' },
  { value: 8, label: '八进制' },
  { value: 10, label: '十进制' },
  { value: 16, label: '十六进制' },
];

/** 进制前缀提示（仅用于展示） */
export const BASE_PREFIX: Record<Base, string> = {
  2: '0b',
  8: '0o',
  10: '',
  16: '0x',
};

/** 各进制允许字符集 */
const BASE_DIGITS: Record<Base, string> = {
  2: '01',
  8: '01234567',
  10: '0123456789',
  16: '0123456789abcdefABCDEF',
};

/**
 * 校验单个字符是否属于指定进制。
 * @param char - 待校验字符
 * @param base - 进制
 * @returns 是否合法
 */
export function isValidDigit(char: string, base: Base): boolean {
  return BASE_DIGITS[base].includes(char);
}

/**
 * 将字符串按指定进制解析为 BigInt。
 *
 * 支持可选前导符号 `+` / `-`，不识别进制前缀。
 * @param input - 输入字符串
 * @param base - 进制
 * @returns 解析结果；无效输入返回 null
 */
export function parseNumber(input: string, base: Base): ParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let negative = false;
  let digits = trimmed;

  if (digits[0] === '+' || digits[0] === '-') {
    negative = digits[0] === '-';
    digits = digits.slice(1);
  }

  if (!digits) return null;

  for (const char of digits) {
    if (!isValidDigit(char, base)) {
      return null;
    }
  }

  const baseBig = BigInt(base);
  let value = 0n;
  for (const char of digits) {
    const digit = BigInt(parseInt(char, base));
    value = value * baseBig + digit;
  }

  return { value: negative ? -value : value, negative };
}

/**
 * 将 BigInt 转换为目标进制字符串。
 *
 * 负数在非二进制进制中保留负号；二进制转换请使用 `toBinaryString`。
 * @param value - 待转换数值
 * @param base - 目标进制
 * @returns 目标进制字符串，小写、无前缀
 */
export function convertNumber(value: bigint, base: Base): string {
  if (value === 0n) return '0';
  if (value < 0n) return `-${(-value).toString(base)}`;
  return value.toString(base);
}

/**
 * 计算数值在二进制预览中应使用的位宽。
 *
 * - 正数：最小位宽，0 返回 1。
 * - 负数：能容纳该补码的最小 8 位倍数。
 * @param value - 数值
 * @param negative - 是否按负数处理
 * @returns 位宽
 */
export function getBitWidth(value: bigint, negative: boolean): number {
  if (!negative) {
    if (value <= 0n) return 1;
    const bits = value.toString(2).length;
    return bits;
  }

  const absValue = -value;
  let n = 8;
  while (absValue > 2n ** BigInt(n - 1)) {
    n += 8;
  }
  return n;
}

/**
 * 生成指定宽度的二进制字符串（负数用补码）。
 * @param value - 数值
 * @param bitWidth - 位宽
 * @returns 二进制字符串
 */
export function toBinaryString(value: bigint, bitWidth: number): string {
  if (value >= 0n) {
    return value.toString(2).padStart(bitWidth, '0');
  }
  const mod = 2n ** BigInt(bitWidth);
  return ((mod + value) % mod).toString(2).padStart(bitWidth, '0');
}

/**
 * 将二进制字符串按 4 位 nibble 分组，每 8 位（2 个 nibble）用中括号包裹。
 *
 * 不足 8 位时仍使用一个中括号；nibble 之间用空格分隔。
 * @param binary - 二进制字符串（仅含 0/1，长度应为 4 的倍数）
 * @returns 可视化位图字符串
 */
export function formatBinaryString(binary: string): string {
  const nibbles: string[] = [];
  for (let i = 0; i < binary.length; i += 4) {
    nibbles.push(binary.slice(i, i + 4));
  }

  const groups: string[] = [];
  for (let i = 0; i < nibbles.length; i += 2) {
    const pair = [nibbles[i], nibbles[i + 1]].filter(Boolean);
    groups.push(`[${pair.join(' ')}]`);
  }

  return groups.join('');
}

/**
 * 计算二进制预览所需的位宽。
 *
 * 正数在最小位宽基础上向上补齐到 4 的倍数，便于按 nibble 分组；
 * 负数仍使用 8 位倍数补码位宽。
 * @param value - 数值
 * @param negative - 是否按负数处理
 * @returns 预览位宽
 */
export function getPreviewBitWidth(value: bigint, negative: boolean): number {
  const minWidth = getBitWidth(value, negative);
  if (negative) return minWidth;
  return Math.ceil(minWidth / 4) * 4;
}

/**
 * 生成二进制预览字符串。
 *
 * 正数会先补齐到 4 的倍数；负数使用给定的补码位宽。
 * @param value - 数值
 * @param bitWidth - 位宽
 * @returns 可视化位图字符串
 */
export function formatBinaryPreview(value: bigint, bitWidth: number): string {
  let binary = toBinaryString(value, bitWidth);
  if (value >= 0n) {
    const padded = Math.ceil(binary.length / 4) * 4;
    binary = binary.padStart(padded, '0');
  }
  return formatBinaryString(binary);
}
