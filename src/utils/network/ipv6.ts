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

/**
 * 根据前缀长度生成 128 位网络掩码（BigInt）
 * @param prefix - 前缀长度（0-128）
 * @returns 前 prefix 位为 1、其余为 0 的 128 位掩码
 * @throws 前缀越界（< 0 或 > 128）时抛出中文错误
 */
export function prefixToMaskV6(prefix: number): bigint {
  if (prefix < 0 || prefix > 128) {
    throw new Error(`CIDR 前缀长度必须在 0-128 之间，当前值：${prefix}`);
  }
  if (prefix === 0) return 0n;
  const allOnes = (1n << 128n) - 1n;
  // 前 prefix 位为 1 = 全 1 异或后 (128-prefix) 位为 1 的部分
  return allOnes ^ ((1n << BigInt(128 - prefix)) - 1n);
}

/**
 * 解析 IPv6 CIDR 字符串（如 2001:db8::/32）为地址与前缀长度
 * @param cidr - CIDR 字符串，必须含 / 分隔的地址与前缀
 * @returns 地址 BigInt 与前缀长度
 * @throws 格式无效（缺斜杠、前缀非数值或越界、地址非法）时抛出中文错误
 */
export function parseCIDRv6(cidr: string): { ip: bigint; prefix: number } {
  if (!cidr || typeof cidr !== 'string') {
    throw new Error('无效的 CIDR 格式：输入不能为空');
  }
  const slashIndex = cidr.indexOf('/');
  if (slashIndex === -1) {
    throw new Error('无效的 CIDR 格式：缺少前缀长度（如 /64）');
  }
  const ipStr = cidr.substring(0, slashIndex);
  const prefixStr = cidr.substring(slashIndex + 1);
  if (!/^\d{1,3}$/.test(prefixStr)) {
    throw new Error(`无效的 CIDR 前缀长度："${prefixStr}" 不是合法的数值`);
  }
  const prefix = parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 128) {
    throw new Error(`CIDR 前缀长度必须在 0-128 之间，当前值：${prefix}`);
  }
  const ip = parseIPv6(ipStr);
  return { ip, prefix };
}

/** 地址类型判定结果 */
export interface IPv6Type {
  /** 类型标签 */
  label: string;
  /** 说明 */
  description: string;
}

/**
 * 判定 IPv6 地址类型（按 CIDR 前缀优先级匹配，先命中先返回）
 * @param num - 128 位地址 BigInt
 * @returns 类型标签与说明
 */
export function getIPv6Type(num: bigint): IPv6Type {
  if (num === 0n) return { label: '未指定地址', description: 'Unspecified，用作 Source 占位' };
  if (num === 1n) return { label: '环回地址', description: 'Loopback，本机自测' };

  const matches = (base: string, prefix: number): boolean => {
    const mask = prefixToMaskV6(prefix);
    return (num & mask) === (parseIPv6(base) & mask);
  };

  // 顺序重要：文档地址（/32）必须先于全球单播（/3）判定
  if (matches('ff00::', 8)) return { label: '组播地址', description: 'Multicast，一对多通信' };
  if (matches('fe80::', 10)) return { label: '链路本地地址', description: 'Link-Local，仅本网段有效' };
  if (matches('fc00::', 7)) return { label: '唯一本地地址', description: 'ULA，内网通信' };
  if (matches('2001:db8::', 32)) return { label: '文档地址', description: 'RFC 3849，示例专用' };
  if (matches('2000::', 3)) return { label: '全球单播地址', description: 'Global Unicast，公网可路由' };
  return { label: '保留 / 未分配', description: '尚未分配的特殊用途地址' };
}
