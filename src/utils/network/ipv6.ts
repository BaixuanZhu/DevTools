/**
 * IPv6 地址工具模块
 * 提供 128 位地址的解析、格式化、压缩展开、CIDR 解析与地址类型判定。
 * 内部统一使用 BigInt 表示 128 位地址（JS number 仅 53 位精度，无法承载）。
 */
import { parseIPv4 } from './ipv4';

/** 将 IPv6 字符串末尾的 IPv4 点分后缀转换为两组十六进制（如 192.168.1.1 → c0a8:101） */
function convertIPv4Suffix(str: string): string {
  const lastColon = str.lastIndexOf(':');
  if (lastColon === -1) {
    // 纯 IPv4 无冒号前缀，不是合法 IPv6 输入
    throw new Error('无效的 IPv6 地址格式：必须包含 8 组（或使用 :: 压缩）');
  }
  const ipv4Part = str.substring(lastColon + 1);
  const num = parseIPv4(ipv4Part); // 复用既有 IPv4 解析（抛出中文错误）
  const high = (num >>> 16) & 0xffff;
  const low = num & 0xffff;
  return `${str.substring(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
}

/**
 * 将 IPv6 字符串解析为 BigInt
 * @param str - IPv6 地址，支持压缩（::）与 IPv4 后缀（::ffff:1.2.3.4）
 * @returns 128 位地址的 BigInt 表示
 * @throws 格式无效时抛出中文错误信息
 */
export function parseIPv6(str: string): bigint {
  if (!str || typeof str !== 'string') {
    throw new Error('无效的 IPv6 地址：输入不能为空');
  }

  let normalized = str.trim();

  // 处理 IPv4 后缀
  if (normalized.includes('.')) {
    normalized = convertIPv4Suffix(normalized);
  }

  let groups: string[];

  if (normalized.includes('::')) {
    const first = normalized.indexOf('::');
    const last = normalized.lastIndexOf('::');
    if (first !== last) {
      throw new Error('无效的 IPv6 地址格式：:: 只能出现一次');
    }
    const [left, right] = normalized.split('::');
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 1) {
      throw new Error('无效的 IPv6 地址格式：:: 展开后超过 8 组');
    }
    groups = [...leftGroups, ...Array<string>(missing).fill('0'), ...rightGroups];
  } else {
    groups = normalized.split(':');
  }

  if (groups.length !== 8) {
    throw new Error('无效的 IPv6 地址格式：必须包含 8 组（或使用 :: 压缩）');
  }

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      if (group.length > 4) {
        throw new Error(`无效的 IPv6 地址格式：段 "${group}" 超过 4 位`);
      }
      throw new Error(`无效的 IPv6 地址格式："${group}" 不是合法的十六进制段`);
    }
    result = (result << 16n) | BigInt(parseInt(group, 16));
  }

  return result;
}

/**
 * 验证字符串是否为合法 IPv6 地址
 * @param str - 待验证字符串
 * @returns 是否合法
 */
export function isValidIPv6(str: string): boolean {
  try {
    parseIPv6(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将 BigInt 格式化为 IPv6 字符串
 * @param num - 128 位地址 BigInt
 * @param mode - 'expand' 输出 8 组 4 位十六进制；'compress' 压缩最长连续零段为 ::
 * @returns IPv6 字符串（小写）
 */
export function formatIPv6(num: bigint, mode: 'compress' | 'expand'): string {
  const groups: number[] = [];
  for (let k = 0; k < 8; k++) {
    const shift = BigInt(7 - k) * 16n;
    groups.push(Number((num >> shift) & 0xFFFFn));
  }

  if (mode === 'expand') {
    return groups.map((g) => g.toString(16).padStart(4, '0')).join(':');
  }

  // compress：先去前导零
  const hex = groups.map((g) => g.toString(16));

  // 找最长连续全零段（长度 >= 2 才压缩，多段等长取第一处）
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (hex[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen < 2) {
    return hex.join(':');
  }

  const before = hex.slice(0, bestStart).join(':');
  const after = hex.slice(bestStart + bestLen).join(':');

  if (bestStart === 0 && bestLen === 8) return '::';
  if (bestStart === 0) return `::${after}`;
  if (bestStart + bestLen === 8) return `${before}::`;
  return `${before}::${after}`;
}

/** 将任意 IPv6 字符串展开为 8 组 4 位十六进制 */
export function expandIPv6(str: string): string {
  return formatIPv6(parseIPv6(str), 'expand');
}

/** 将任意 IPv6 字符串规范化为压缩格式 */
export function compressIPv6(str: string): string {
  return formatIPv6(parseIPv6(str), 'compress');
}
