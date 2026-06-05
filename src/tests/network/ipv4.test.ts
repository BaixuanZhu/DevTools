import { describe, it, expect } from 'vitest';
import {
  parseIPv4,
  formatIPv4,
  toBinaryDotted,
  prefixToMask,
  maskToPrefix,
  isValidIPv4,
  parseCIDR,
} from '../../utils/network/ipv4';

describe('parseIPv4', () => {
  it('应正确解析标准 IPv4 地址', () => {
    expect(parseIPv4('192.168.1.0')).toBe(3232235776);
    expect(parseIPv4('0.0.0.0')).toBe(0);
    expect(parseIPv4('255.255.255.255')).toBe(4294967295);
    expect(parseIPv4('10.0.0.1')).toBe(167772161);
    expect(parseIPv4('172.16.0.0')).toBe(2886729728);
  });

  it('应正确解析边界值八位组', () => {
    expect(parseIPv4('0.0.0.0')).toBe(0);
    expect(parseIPv4('255.255.255.255')).toBe(0xffffffff >>> 0);
    expect(parseIPv4('1.2.3.4')).toBe(
      ((1 << 24) | (2 << 16) | (3 << 8) | 4) >>> 0,
    );
  });

  it('应在八位组不足 4 个时抛出错误', () => {
    expect(() => parseIPv4('192.168.1')).toThrow('必须包含 4 个八位组');
  });

  it('应在八位组超过 4 个时抛出错误', () => {
    expect(() => parseIPv4('192.168.1.0.1')).toThrow('必须包含 4 个八位组');
  });

  it('应在八位组超出范围时抛出错误', () => {
    expect(() => parseIPv4('192.168.1.256')).toThrow('超出范围');
    expect(() => parseIPv4('192.168.1.-1')).toThrow('不是合法的数值');
  });

  it('应在输入为空时抛出错误', () => {
    expect(() => parseIPv4('')).toThrow('输入不能为空');
  });

  it('应在包含非数字字符时抛出错误', () => {
    expect(() => parseIPv4('192.168.1.abc')).toThrow('不是合法的数值');
    expect(() => parseIPv4('192.168.1.1a')).toThrow('不是合法的数值');
  });
});

describe('formatIPv4', () => {
  it('应正确格式化为点分十进制', () => {
    expect(formatIPv4(3232235776)).toBe('192.168.1.0');
    expect(formatIPv4(0)).toBe('0.0.0.0');
    expect(formatIPv4(4294967295)).toBe('255.255.255.255');
    expect(formatIPv4(167772161)).toBe('10.0.0.1');
  });

  it('应与 parseIPv4 形成往返', () => {
    const addresses = ['0.0.0.0', '127.0.0.1', '192.168.1.1', '10.0.0.255', '255.255.255.255'];
    for (const addr of addresses) {
      expect(formatIPv4(parseIPv4(addr))).toBe(addr);
    }
  });
});

describe('toBinaryDotted', () => {
  it('应正确转换为点分二进制', () => {
    expect(toBinaryDotted(parseIPv4('192.168.1.0'))).toBe(
      '11000000.10101000.00000001.00000000',
    );
    expect(toBinaryDotted(parseIPv4('255.255.255.0'))).toBe(
      '11111111.11111111.11111111.00000000',
    );
    expect(toBinaryDotted(parseIPv4('0.0.0.0'))).toBe(
      '00000000.00000000.00000000.00000000',
    );
    expect(toBinaryDotted(parseIPv4('255.255.255.255'))).toBe(
      '11111111.11111111.11111111.11111111',
    );
  });
});

describe('prefixToMask', () => {
  it('应正确转换标准前缀长度', () => {
    expect(prefixToMask(0)).toBe(0);
    expect(prefixToMask(24)).toBe(0xffffff00 >>> 0);
    expect(prefixToMask(16)).toBe(0xffff0000 >>> 0);
    expect(prefixToMask(8)).toBe(0xff000000 >>> 0);
    expect(prefixToMask(32)).toBe(0xffffffff >>> 0);
  });

  it('应正确格式化为点分十进制', () => {
    expect(formatIPv4(prefixToMask(24))).toBe('255.255.255.0');
    expect(formatIPv4(prefixToMask(25))).toBe('255.255.255.128');
    expect(formatIPv4(prefixToMask(16))).toBe('255.255.0.0');
    expect(formatIPv4(prefixToMask(32))).toBe('255.255.255.255');
    expect(formatIPv4(prefixToMask(0))).toBe('0.0.0.0');
  });

  it('应在前缀长度越界时抛出错误', () => {
    expect(() => prefixToMask(-1)).toThrow('0-32 之间');
    expect(() => prefixToMask(33)).toThrow('0-32 之间');
  });
});

describe('maskToPrefix', () => {
  it('应正确转换标准子网掩码', () => {
    expect(maskToPrefix(0xffffff00 >>> 0)).toBe(24);
    expect(maskToPrefix(0xffff0000 >>> 0)).toBe(16);
    expect(maskToPrefix(0xff000000 >>> 0)).toBe(8);
    expect(maskToPrefix(0xffffffff >>> 0)).toBe(32);
    expect(maskToPrefix(0)).toBe(0);
  });

  it('应在掩码不合法时返回 -1', () => {
    // 非连续掩码：10101010...
    expect(maskToPrefix(0x0a0a0a0a >>> 0)).toBe(-1);
  });
});

describe('isValidIPv4', () => {
  it('应返回 true 对于合法地址', () => {
    expect(isValidIPv4('0.0.0.0')).toBe(true);
    expect(isValidIPv4('192.168.1.1')).toBe(true);
    expect(isValidIPv4('255.255.255.255')).toBe(true);
  });

  it('应返回 false 对于非法地址', () => {
    expect(isValidIPv4('')).toBe(false);
    expect(isValidIPv4('192.168.1')).toBe(false);
    expect(isValidIPv4('192.168.1.256')).toBe(false);
    expect(isValidIPv4('abc')).toBe(false);
  });
});

describe('parseCIDR', () => {
  it('应正确解析标准 CIDR 表示法', () => {
    const result = parseCIDR('192.168.1.0/24');
    expect(result.ip).toBe(parseIPv4('192.168.1.0'));
    expect(result.prefix).toBe(24);
  });

  it('应正确解析边界前缀', () => {
    expect(parseCIDR('0.0.0.0/0').prefix).toBe(0);
    expect(parseCIDR('10.0.0.1/32').prefix).toBe(32);
  });

  it('应在缺少斜杠时抛出错误', () => {
    expect(() => parseCIDR('192.168.1.0')).toThrow('缺少前缀长度');
  });

  it('应在前缀长度越界时抛出错误', () => {
    expect(() => parseCIDR('192.168.1.0/33')).toThrow('0-32 之间');
  });

  it('应在 IP 部分非法时抛出错误', () => {
    expect(() => parseCIDR('not.an.ip/24')).toThrow();
  });

  it('应在输入为空时抛出错误', () => {
    expect(() => parseCIDR('')).toThrow('输入不能为空');
  });
});
