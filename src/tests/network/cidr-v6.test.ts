import { describe, it, expect } from 'vitest';
import { calculateSubnetV6 } from '../../utils/network/cidr-v6';

describe('calculateSubnetV6', () => {
  it('应正确计算 /32 文档子网', () => {
    const r = calculateSubnetV6('2001:db8::/32');
    expect(r.networkAddressCompressed).toBe('2001:db8::');
    expect(r.networkAddressExpanded).toBe('2001:0db8:0000:0000:0000:0000:0000:0000');
    expect(r.prefix).toBe(32);
    expect(r.firstAddressCompressed).toBe('2001:db8::');
    expect(r.lastAddressCompressed).toBe('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe('2⁹⁶ ≈ 7.9×10²⁸');
    expect(r.type.label).toBe('文档地址');
  });

  it('应正确计算 /128 单地址（首末相同）', () => {
    const r = calculateSubnetV6('2001:db8::1/128');
    expect(r.networkAddressCompressed).toBe('2001:db8::1');
    expect(r.firstAddressCompressed).toBe('2001:db8::1');
    expect(r.lastAddressCompressed).toBe('2001:db8::1');
    expect(r.totalAddresses).toBe('1');
  });

  it('应正确计算 /64 标准子网', () => {
    const r = calculateSubnetV6('2001:db8:abcd:12::/64');
    expect(r.networkAddressCompressed).toBe('2001:db8:abcd:12::');
    expect(r.firstAddressCompressed).toBe('2001:db8:abcd:12::');
    expect(r.lastAddressCompressed).toBe('2001:db8:abcd:12:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe('2⁶⁴ ≈ 1.8×10¹⁹');
  });

  it('应正确计算 /0 全部', () => {
    const r = calculateSubnetV6('::/0');
    expect(r.networkAddressCompressed).toBe('::');
    expect(r.lastAddressCompressed).toBe('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe('2¹²⁸ ≈ 3.4×10³⁸');
    expect(r.type.label).toBe('未指定地址');
  });

  it('应在 CIDR 无效时抛出', () => {
    expect(() => calculateSubnetV6('2001:db8::')).toThrow('缺少前缀长度');
    expect(() => calculateSubnetV6('2001:db8::/129')).toThrow('0-128 之间');
  });
});
