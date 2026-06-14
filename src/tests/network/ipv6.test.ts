import { describe, it, expect } from 'vitest';
import {
  parseIPv6,
  isValidIPv6,
  formatIPv6,
  expandIPv6,
  compressIPv6,
  prefixToMaskV6,
  parseCIDRv6,
  getIPv6Type,
} from '../../utils/network/ipv6';

describe('parseIPv6', () => {
  it('应正确解析标准 8 组地址', () => {
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0000')).toBe(0x20010db8000000000000000000000000n);
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(0x20010db8000000000000000000000001n);
  });

  it('应正确解析压缩格式（:: 在头/中/尾）', () => {
    expect(parseIPv6('2001:db8::')).toBe(0x20010db8000000000000000000000000n);
    expect(parseIPv6('::1')).toBe(1n);
    expect(parseIPv6('::')).toBe(0n);
    expect(parseIPv6('2001:db8::1')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIPv6('1::')).toBe(1n << 112n);
  });

  it('应正确解析 IPv4 后缀映射', () => {
    expect(parseIPv6('::ffff:192.168.1.1')).toBe(0x00000000000000000000ffffc0a80101n);
  });

  it('应大小写不敏感', () => {
    expect(parseIPv6('2001:DB8::')).toBe(parseIPv6('2001:db8::'));
  });

  it('应在组数错误（无 :: 且非 8 组）时抛出', () => {
    expect(() => parseIPv6('2001:db8:1:2:3:4:5')).toThrow('8 组');
  });

  it('应在多个 :: 时抛出', () => {
    expect(() => parseIPv6('2001::db8::1')).toThrow('只能出现一次');
  });

  it('应在 :: 展开超过 8 组时抛出', () => {
    expect(() => parseIPv6('1:2:3:4:5:6:7::8')).toThrow('8 组');
  });

  it('应在段超过 4 位时抛出', () => {
    expect(() => parseIPv6('2001:db8::12345')).toThrow('超过 4 位');
  });

  it('应在含非十六进制字符时抛出', () => {
    expect(() => parseIPv6('2001:db8::xyzz')).toThrow('不是合法的十六进制段');
  });

  it('应在输入为空时抛出', () => {
    expect(() => parseIPv6('')).toThrow('输入不能为空');
  });
});

describe('isValidIPv6', () => {
  it('合法地址返回 true', () => {
    expect(isValidIPv6('2001:db8::')).toBe(true);
    expect(isValidIPv6('::1')).toBe(true);
    expect(isValidIPv6('2001:0db8:0000:0000:0000:0000:0000:0000')).toBe(true);
  });

  it('非法地址返回 false', () => {
    expect(isValidIPv6('')).toBe(false);
    expect(isValidIPv6('2001:db8:1:2:3:4:5')).toBe(false);
    expect(isValidIPv6('2001::db8::1')).toBe(false);
    expect(isValidIPv6('2001:db8::xyzz')).toBe(false);
  });
});

describe('formatIPv6', () => {
  it('expand 应输出 8 组 4 位十六进制（小写）', () => {
    expect(formatIPv6(0x20010db8000000000000000000000000n, 'expand')).toBe(
      '2001:0db8:0000:0000:0000:0000:0000:0000',
    );
    expect(formatIPv6(1n, 'expand')).toBe(
      '0000:0000:0000:0000:0000:0000:0000:0001',
    );
  });

  it('compress 应压缩最长连续零段', () => {
    expect(formatIPv6(0x20010db8000000000000000000000000n, 'compress')).toBe('2001:db8::');
    expect(formatIPv6(1n, 'compress')).toBe('::1');
    expect(formatIPv6(0n, 'compress')).toBe('::');
  });

  it('compress 不压缩单零段', () => {
    // 2001:db8:0:1:2:3:4:5 —— 仅 1 个连续零段，不压缩
    expect(formatIPv6(0x20010db8000000010002000300040005n, 'compress')).toBe('2001:db8:0:1:2:3:4:5');
  });

  it('compress 取第一个最长零段', () => {
    // 2001:0:0:1:0:0:0:1 —— 零段 [1-2](长2) 与 [4-6](长3)，压缩更长的一处
    expect(formatIPv6(0x20010000000000010000000000000001n, 'compress')).toBe('2001:0:0:1::1');
  });
});

describe('expandIPv6 / compressIPv6', () => {
  it('应形成往返：compress 后 expand 还原展开形式', () => {
    const cases = ['2001:db8::1', '::1', '::', 'fe80::1', '2001:0db8:0000:0000:0000:0000:0000:0001'];
    for (const c of cases) {
      const expanded = expandIPv6(c);
      expect(compressIPv6(expanded)).toBe(compressIPv6(c));
    }
  });

  it('compressIPv6 应规范化输入', () => {
    expect(compressIPv6('2001:0db8:0000:0000:0000:0000:0000:0000')).toBe('2001:db8::');
    expect(compressIPv6('2001:DB8::')).toBe('2001:db8::');
  });
});

describe('prefixToMaskV6', () => {
  it('应正确生成 128 位掩码', () => {
    expect(prefixToMaskV6(0)).toBe(0n);
    expect(prefixToMaskV6(128)).toBe((1n << 128n) - 1n);
    expect(prefixToMaskV6(64)).toBe(((1n << 64n) - 1n) << 64n);
    expect(prefixToMaskV6(32)).toBe(((1n << 32n) - 1n) << 96n);
  });

  it('应在越界时抛出', () => {
    expect(() => prefixToMaskV6(-1)).toThrow('0-128 之间');
    expect(() => prefixToMaskV6(129)).toThrow('0-128 之间');
  });
});

describe('parseCIDRv6', () => {
  it('应正确解析标准 IPv6 CIDR', () => {
    const r = parseCIDRv6('2001:db8::/32');
    expect(r.ip).toBe(parseIPv6('2001:db8::'));
    expect(r.prefix).toBe(32);
  });

  it('应正确解析边界前缀', () => {
    expect(parseCIDRv6('::/0').prefix).toBe(0);
    expect(parseCIDRv6('2001:db8::1/128').prefix).toBe(128);
  });

  it('应在缺少斜杠时抛出', () => {
    expect(() => parseCIDRv6('2001:db8::')).toThrow('缺少前缀长度');
  });

  it('应在前缀越界时抛出', () => {
    expect(() => parseCIDRv6('2001:db8::/129')).toThrow('0-128 之间');
  });

  it('应在前缀非数字时抛出', () => {
    expect(() => parseCIDRv6('2001:db8::/abc')).toThrow('不是合法');
  });

  it('应在地址部分非法时抛出', () => {
    expect(() => parseCIDRv6('not-an-ipv6/64')).toThrow();
  });

  it('应在输入为空时抛出', () => {
    expect(() => parseCIDRv6('')).toThrow('输入不能为空');
  });
});

describe('getIPv6Type', () => {
  it('应识别未指定地址', () => {
    expect(getIPv6Type(parseIPv6('::')).label).toBe('未指定地址');
  });

  it('应识别环回地址', () => {
    expect(getIPv6Type(parseIPv6('::1')).label).toBe('环回地址');
  });

  it('应识别组播地址', () => {
    expect(getIPv6Type(parseIPv6('ff02::1')).label).toBe('组播地址');
  });

  it('应识别链路本地地址', () => {
    expect(getIPv6Type(parseIPv6('fe80::1')).label).toBe('链路本地地址');
  });

  it('应识别唯一本地地址（ULA）', () => {
    expect(getIPv6Type(parseIPv6('fd00::1')).label).toBe('唯一本地地址');
  });

  it('应识别文档地址（先于全球单播）', () => {
    expect(getIPv6Type(parseIPv6('2001:db8::1')).label).toBe('文档地址');
  });

  it('应识别全球单播地址', () => {
    expect(getIPv6Type(parseIPv6('2001:4860:4860::8888')).label).toBe('全球单播地址');
  });

  it('保留段应返回兜底', () => {
    expect(getIPv6Type(parseIPv6('4000::1')).label).toBe('保留 / 未分配');
  });
});
