/**
 * IPv4 CIDR 子网计算模块
 * 根据输入的 CIDR 表示法计算完整的子网信息。
 */

import { parseCIDR, formatIPv4, toBinaryDotted, prefixToMask } from './ipv4';

/** 子网详细信息 */
export interface SubnetInfo {
  /** 网络地址 */
  networkAddress: string;
  /** 广播地址 */
  broadcastAddress: string;
  /** 子网掩码 */
  subnetMask: string;
  /** 通配符掩码 */
  wildcardMask: string;
  /** 第一个可用主机地址 */
  firstHost: string;
  /** 最后一个可用主机地址 */
  lastHost: string;
  /** 可用主机数量 */
  usableHosts: number;
  /** CIDR 前缀长度 */
  prefix: number;
  /** IP 地址范围（含起止） */
  ipRange: string;
  /** 网络地址的二进制表示 */
  networkBinary: string;
  /** 子网掩码的二进制表示 */
  maskBinary: string;
  /** 通配符掩码的二进制表示 */
  wildcardBinary: string;
  /** 广播地址的二进制表示 */
  broadcastBinary: string;
}

/**
 * 根据 CIDR 表示法计算完整的子网信息
 * @param cidr - CIDR 表示法字符串，如 "192.168.1.0/24"
 * @returns 子网详细信息
 * @throws CIDR 格式无效时抛出中文错误信息
 */
export function calculateSubnet(cidr: string): SubnetInfo {
  const { ip, prefix } = parseCIDR(cidr);
  const mask = prefixToMask(prefix);
  const wildcard = (~mask) >>> 0;

  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;

  const maskBin = toBinaryDotted(mask);
  const wildcardBin = toBinaryDotted(wildcard);
  const networkBin = toBinaryDotted(network);
  const broadcastBin = toBinaryDotted(broadcast);

  const subnetMask = formatIPv4(mask);
  const wildcardMask = formatIPv4(wildcard);
  const networkAddress = formatIPv4(network);
  const broadcastAddress = formatIPv4(broadcast);

  let firstHost: string;
  let lastHost: string;
  let usableHosts: number;
  let ipRange: string;

  if (prefix === 32) {
    // 单主机：网络地址即为主机地址
    firstHost = networkAddress;
    lastHost = networkAddress;
    usableHosts = 1;
    ipRange = networkAddress;
  } else if (prefix === 31) {
    // 点对点链路（RFC 3021）：两个地址都可用，无广播地址
    firstHost = networkAddress;
    lastHost = broadcastAddress;
    usableHosts = 2;
    ipRange = `${firstHost} - ${lastHost}`;
  } else {
    // 标准子网：排除网络地址和广播地址
    const first = (network + 1) >>> 0;
    const last = (broadcast - 1) >>> 0;
    firstHost = formatIPv4(first);
    lastHost = formatIPv4(last);
    // 可用主机数 = 2^(32-prefix) - 2
    const totalHosts = Math.pow(2, 32 - prefix);
    usableHosts = totalHosts - 2;
    ipRange = `${firstHost} - ${lastHost}`;
  }

  return {
    networkAddress,
    broadcastAddress,
    subnetMask,
    wildcardMask,
    firstHost,
    lastHost,
    usableHosts,
    prefix,
    ipRange,
    networkBinary: networkBin,
    maskBinary: maskBin,
    wildcardBinary: wildcardBin,
    broadcastBinary: broadcastBin,
  };
}
