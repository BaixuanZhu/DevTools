/**
 * IPv6 CIDR 子网计算模块
 * 根据 IPv6 CIDR 表示法计算网络地址、地址范围、地址总数与类型。
 */
import { formatIPv6, getIPv6Type, parseCIDRv6, prefixToMaskV6, type IPv6Type } from './ipv6';

/** IPv6 子网计算结果 */
export interface SubnetInfoV6 {
  /** 网络地址（压缩格式） */
  networkAddressCompressed: string;
  /** 网络地址（展开格式） */
  networkAddressExpanded: string;
  /** CIDR 前缀长度 */
  prefix: number;
  /** 范围首地址（压缩格式，含网络地址） */
  firstAddressCompressed: string;
  /** 范围末地址（压缩格式） */
  lastAddressCompressed: string;
  /** 地址总数（幂 + 科学计数，如 "2⁹⁶ ≈ 7.9×10²⁸"） */
  totalAddresses: string;
  /** 地址类型 */
  type: IPv6Type;
}

/** 将上标数字转为 Unicode 上标字符 */
function toSuperscript(n: number): string {
  const map = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n)
    .split('')
    .map((d) => map[Number(d)])
    .join('');
}

/**
 * 将 2 的幂格式化为可读字符串
 * - exp === 0 → "1"
 * - exp <= 10 → 精确整数（如 "256"）
 * - 否则 → 幂 + 科学计数（如 "2⁹⁶ ≈ 7.9×10²⁸"）
 */
function formatPowerOfTwo(exp: number): string {
  if (exp === 0) return '1';
  if (exp <= 10) return `${1 << exp}`;
  const logVal = exp * Math.log10(2);
  const e = Math.floor(logVal);
  const mantissa = Math.pow(10, logVal - e);
  return `2${toSuperscript(exp)} ≈ ${mantissa.toFixed(1)}×10${toSuperscript(e)}`;
}

/**
 * 根据 IPv6 CIDR 计算子网信息
 * @param cidr - IPv6 CIDR 字符串，如 "2001:db8::/32"
 * @returns 子网信息
 * @throws CIDR 格式无效时抛出中文错误
 */
export function calculateSubnetV6(cidr: string): SubnetInfoV6 {
  const { ip, prefix } = parseCIDRv6(cidr);
  const mask = prefixToMaskV6(prefix);
  // 用 (1n<<128n)-1n - mask 而非 ^ mask，避免 BigInt ~ 的符号位问题；两者数值等价
  const wildcard = (1n << 128n) - 1n - mask;
  const network = ip & mask;
  const last = network | wildcard;

  return {
    networkAddressCompressed: formatIPv6(network, 'compress'),
    networkAddressExpanded: formatIPv6(network, 'expand'),
    prefix,
    // IPv6 无广播地址概念，范围含两端，不做「减 2」
    firstAddressCompressed: formatIPv6(network, 'compress'),
    lastAddressCompressed: formatIPv6(last, 'compress'),
    totalAddresses: formatPowerOfTwo(128 - prefix),
    type: getIPv6Type(network),
  };
}
