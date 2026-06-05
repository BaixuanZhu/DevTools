/**
 * IPv4 范围展开模块
 * 将起始-结束 IPv4 地址范围转换为最少 CIDR 块列表。
 */

import { parseIPv4, formatIPv4 } from './ipv4';

/** 单个 CIDR 块信息 */
export interface CIDRBlock {
  /** CIDR 表示法，如 "192.168.1.0/25" */
  cidr: string;
  /** 网络地址 */
  network: string;
  /** 前缀长度 */
  prefix: number;
  /** 主机数量 */
  hostCount: number;
}

/** 范围展开结果 */
export interface RangeResult {
  /** CIDR 块列表 */
  cidrs: CIDRBlock[];
  /** IP 总数 */
  totalIPs: number;
  /** 起始 IP（格式化后） */
  startIP: string;
  /** 结束 IP（格式化后） */
  endIP: string;
}

/**
 * 计算无符号 32 位整数的末尾零位数
 * @param n - 无符号 32 位整数
 * @returns 末尾零的位数，n=0 时返回 32
 */
function countTrailingZeros(n: number): number {
  if (n === 0) return 32;
  let count = 0;
  while ((n & 1) === 0) {
    count++;
    n = n >>> 1;
  }
  return count;
}

/**
 * 将 IPv4 地址范围转换为覆盖该范围的最少 CIDR 块列表
 * @param startIP - 起始 IPv4 地址字符串
 * @param endIP - 结束 IPv4 地址字符串
 * @returns CIDR 块列表及统计信息
 * @throws 输入无效或起始地址大于结束地址时抛出中文错误
 */
export function ipRangeToCIDRs(startIP: string, endIP: string): RangeResult {
  const start = parseIPv4(startIP);
  const end = parseIPv4(endIP);

  if (start > end) {
    throw new Error('起始 IP 地址不能大于结束 IP 地址');
  }

  const cidrs: CIDRBlock[] = [];
  let current = start;
  let totalIPs = 0;

  while (current <= end) {
    // 当前地址的对齐限制：末尾零位数决定最大可能的块大小
    const maxBitFromAlignment = countTrailingZeros(current);

    // 剩余需要覆盖的 IP 数量
    const remaining = (end - current + 1) >>> 0;
    // 满足剩余范围的最大 2 的幂
    const maxBitFromRange = Math.floor(Math.log2(remaining));

    // 取两者中较小的值作为实际块大小指数
    const bit = Math.min(maxBitFromAlignment, maxBitFromRange);
    const blockSize = 1 << bit;
    const prefix = 32 - bit;

    cidrs.push({
      cidr: `${formatIPv4(current)}/${prefix}`,
      network: formatIPv4(current),
      prefix,
      hostCount: blockSize,
    });

    totalIPs += blockSize;
    current = (current + blockSize) >>> 0;
  }

  return {
    cidrs,
    totalIPs,
    startIP: formatIPv4(start),
    endIP: formatIPv4(end),
  };
}
