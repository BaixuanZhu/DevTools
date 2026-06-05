import { describe, it, expect } from 'vitest';
import { ipRangeToCIDRs } from '../../utils/network/ip-range';

describe('ipRangeToCIDRs', () => {
  it('应将精确对齐的 /24 范围转换为单个 CIDR', () => {
    const result = ipRangeToCIDRs('192.168.1.0', '192.168.1.255');
    expect(result.cidrs).toHaveLength(1);
    expect(result.cidrs[0].cidr).toBe('192.168.1.0/24');
    expect(result.totalIPs).toBe(256);
  });

  it('应将单个 IP 转换为 /32', () => {
    const result = ipRangeToCIDRs('10.0.0.1', '10.0.0.1');
    expect(result.cidrs).toHaveLength(1);
    expect(result.cidrs[0].cidr).toBe('10.0.0.1/32');
    expect(result.totalIPs).toBe(1);
  });

  it('应将大范围转换为单个 CIDR', () => {
    const result = ipRangeToCIDRs('10.0.0.0', '10.255.255.255');
    expect(result.cidrs).toHaveLength(1);
    expect(result.cidrs[0].cidr).toBe('10.0.0.0/8');
    expect(result.totalIPs).toBe(16777216);
  });

  it('应将跨越两个子网的范围拆分为多个 CIDR', () => {
    // 192.168.0.0 - 192.168.1.255 跨越两个 /24 = 一个 /23
    const result = ipRangeToCIDRs('192.168.0.0', '192.168.1.255');
    expect(result.cidrs).toHaveLength(1);
    expect(result.cidrs[0].cidr).toBe('192.168.0.0/23');
    expect(result.totalIPs).toBe(512);
  });

  it('应将非对齐范围拆分为多个 CIDR 块', () => {
    // 10.0.0.5 - 10.0.0.10 需要多个小块
    const result = ipRangeToCIDRs('10.0.0.5', '10.0.0.10');
    expect(result.totalIPs).toBe(6);
    // 验证所有 CIDR 块覆盖的范围精确
    const firstNetwork = result.cidrs[0];
    expect(firstNetwork.network).toBe('10.0.0.5');
    // 验证总 IP 数等于范围大小
    let sumHosts = 0;
    for (const block of result.cidrs) {
      sumHosts += block.hostCount;
    }
    expect(sumHosts).toBe(6);
  });

  it('应在起始 IP 大于结束 IP 时抛出错误', () => {
    expect(() => ipRangeToCIDRs('10.0.0.2', '10.0.0.1')).toThrow(
      '起始 IP 地址不能大于结束 IP 地址',
    );
  });

  it('应在 IP 无效时抛出错误', () => {
    expect(() => ipRangeToCIDRs('invalid', '10.0.0.1')).toThrow();
    expect(() => ipRangeToCIDRs('10.0.0.1', 'invalid')).toThrow();
  });

  it('应正确处理两个相邻 /24 的情况', () => {
    // 192.168.1.128 - 192.168.2.127
    const result = ipRangeToCIDRs('192.168.1.128', '192.168.2.127');
    expect(result.totalIPs).toBe(256);
    // 应包含多个 CIDR 块
    expect(result.cidrs.length).toBeGreaterThanOrEqual(2);
  });

  it('应正确返回格式化的起止 IP', () => {
    const result = ipRangeToCIDRs('10.0.0.1', '10.0.0.10');
    expect(result.startIP).toBe('10.0.0.1');
    expect(result.endIP).toBe('10.0.0.10');
  });
});
