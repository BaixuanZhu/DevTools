import { describe, it, expect } from 'vitest';
import {
  parseIPv6,
  isValidIPv6,
  formatIPv6,
  expandIPv6,
  compressIPv6,
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
