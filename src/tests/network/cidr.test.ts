import { describe, it, expect } from 'vitest';
import { calculateSubnet } from '../../utils/network/cidr';

describe('calculateSubnet', () => {
  it('应正确计算 /24 标准子网', () => {
    const result = calculateSubnet('192.168.1.0/24');
    expect(result.networkAddress).toBe('192.168.1.0');
    expect(result.broadcastAddress).toBe('192.168.1.255');
    expect(result.subnetMask).toBe('255.255.255.0');
    expect(result.wildcardMask).toBe('0.0.0.255');
    expect(result.firstHost).toBe('192.168.1.1');
    expect(result.lastHost).toBe('192.168.1.254');
    expect(result.usableHosts).toBe(254);
    expect(result.prefix).toBe(24);
    expect(result.ipRange).toBe('192.168.1.1 - 192.168.1.254');
  });

  it('应正确计算 /32 单主机', () => {
    const result = calculateSubnet('10.0.0.1/32');
    expect(result.networkAddress).toBe('10.0.0.1');
    expect(result.broadcastAddress).toBe('10.0.0.1');
    expect(result.firstHost).toBe('10.0.0.1');
    expect(result.lastHost).toBe('10.0.0.1');
    expect(result.usableHosts).toBe(1);
    expect(result.ipRange).toBe('10.0.0.1');
  });

  it('应正确计算 /31 点对点链路（RFC 3021）', () => {
    const result = calculateSubnet('10.0.0.0/31');
    expect(result.networkAddress).toBe('10.0.0.0');
    expect(result.broadcastAddress).toBe('10.0.0.1');
    expect(result.firstHost).toBe('10.0.0.0');
    expect(result.lastHost).toBe('10.0.0.1');
    expect(result.usableHosts).toBe(2);
    expect(result.ipRange).toBe('10.0.0.0 - 10.0.0.1');
  });

  it('应正确计算 /16 类 B 子网', () => {
    const result = calculateSubnet('172.16.0.0/16');
    expect(result.networkAddress).toBe('172.16.0.0');
    expect(result.broadcastAddress).toBe('172.16.255.255');
    expect(result.subnetMask).toBe('255.255.0.0');
    expect(result.usableHosts).toBe(65534);
  });

  it('应正确计算 /0 全网段', () => {
    const result = calculateSubnet('0.0.0.0/0');
    expect(result.networkAddress).toBe('0.0.0.0');
    expect(result.broadcastAddress).toBe('255.255.255.255');
    expect(result.subnetMask).toBe('0.0.0.0');
    expect(result.wildcardMask).toBe('255.255.255.255');
    expect(result.firstHost).toBe('0.0.0.1');
    expect(result.lastHost).toBe('255.255.255.254');
    expect(result.usableHosts).toBe(4294967294);
  });

  it('应正确计算 /25 子网', () => {
    const result = calculateSubnet('192.168.1.128/25');
    expect(result.networkAddress).toBe('192.168.1.128');
    expect(result.broadcastAddress).toBe('192.168.1.255');
    expect(result.subnetMask).toBe('255.255.255.128');
    expect(result.usableHosts).toBe(126);
    expect(result.firstHost).toBe('192.168.1.129');
    expect(result.lastHost).toBe('192.168.1.254');
  });

  it('应正确生成二进制表示', () => {
    const result = calculateSubnet('192.168.1.0/24');
    expect(result.networkBinary).toBe('11000000.10101000.00000001.00000000');
    expect(result.maskBinary).toBe('11111111.11111111.11111111.00000000');
    expect(result.wildcardBinary).toBe('00000000.00000000.00000000.11111111');
    expect(result.broadcastBinary).toBe('11000000.10101000.00000001.11111111');
  });

  it('应在 CIDR 格式无效时抛出错误', () => {
    expect(() => calculateSubnet('invalid')).toThrow();
    expect(() => calculateSubnet('192.168.1.0')).toThrow('缺少前缀长度');
    expect(() => calculateSubnet('192.168.1.0/33')).toThrow('0-32 之间');
  });
});
