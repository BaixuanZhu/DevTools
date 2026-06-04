import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  transformOutput,
  stringToHex,
  stringToBinary,
  stringToOctal,
  CHAR_SETS,
  resolveCharsetFromTypes,
} from '../../utils/text/random-string';

const alphanumeric = CHAR_SETS.uppercase + CHAR_SETS.lowercase + CHAR_SETS.digits;

describe('generateRandomString', () => {
  it('应生成指定长度的字符串', () => {
    const result = generateRandomString(16, alphanumeric);
    expect(result.length).toBe(16);
  });

  it('应只包含所选字符集中的字符', () => {
    const result = generateRandomString(100, CHAR_SETS.digits);
    for (const ch of result) {
      expect(ch).toMatch(/[0-9]/);
    }
  });

  it('字母数字字符集应包含大小写字母和数字', () => {
    const result = generateRandomString(1000, alphanumeric);
    expect(result).toMatch(/[a-z]/);
    expect(result).toMatch(/[A-Z]/);
    expect(result).toMatch(/[0-9]/);
  });

  it('应支持自定义字符集', () => {
    const result = generateRandomString(50, 'abc');
    for (const ch of result) {
      expect('abc').toContain(ch);
    }
  });

  it('长度为 0 应返回空字符串', () => {
    expect(generateRandomString(0, alphanumeric)).toBe('');
  });

  it('空字符集应返回空字符串', () => {
    expect(generateRandomString(10, '')).toBe('');
  });

  it('应生成不同的字符串（随机性检查）', () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(generateRandomString(32, alphanumeric));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('CHAR_SETS', () => {
  it('uppercase 应只包含大写字母', () => {
    for (const ch of CHAR_SETS.uppercase) {
      expect(ch).toMatch(/[A-Z]/);
    }
    expect(CHAR_SETS.uppercase.length).toBe(26);
  });

  it('lowercase 应只包含小写字母', () => {
    for (const ch of CHAR_SETS.lowercase) {
      expect(ch).toMatch(/[a-z]/);
    }
    expect(CHAR_SETS.lowercase.length).toBe(26);
  });

  it('digits 应只包含数字', () => {
    for (const ch of CHAR_SETS.digits) {
      expect(ch).toMatch(/[0-9]/);
    }
    expect(CHAR_SETS.digits.length).toBe(10);
  });

  it('special 应包含特殊字符且长度大于 0', () => {
    expect(CHAR_SETS.special.length).toBeGreaterThan(0);
  });
});

describe('resolveCharsetFromTypes', () => {
  it('组合 uppercase + digits', () => {
    const chars = resolveCharsetFromTypes(['uppercase', 'digits']);
    expect(chars).toContain('A');
    expect(chars).toContain('9');
    expect(chars).not.toContain('a');
  });

  it('使用自定义特殊字符', () => {
    expect(resolveCharsetFromTypes(['special'], '@#$')).toBe('@#$');
  });

  it('不提供 customSpecial 时使用默认特殊字符集', () => {
    expect(resolveCharsetFromTypes(['special'])).toBe(CHAR_SETS.special);
  });

  it('空类型数组返回空字符串', () => {
    expect(resolveCharsetFromTypes([])).toBe('');
  });
});

describe('transformOutput', () => {
  it('none — 保持原样', () => {
    expect(transformOutput('AbC', 'none')).toBe('AbC');
  });

  it('upper — 全大写', () => {
    expect(transformOutput('AbC', 'upper')).toBe('ABC');
  });

  it('lower — 全小写', () => {
    expect(transformOutput('AbC', 'lower')).toBe('abc');
  });

  it('hex — 每字符转 ASCII 十六进制，空格分组', () => {
    expect(transformOutput('aB', 'hex')).toBe('61 42');
  });

  it('base64', () => {
    expect(transformOutput('aB3k', 'base64')).toBe('YUIzaw==');
  });

  it('binary — 每字符 8 位二进制，空格分组', () => {
    expect(transformOutput('a', 'binary')).toBe('01100001');
    expect(transformOutput('ab', 'binary')).toBe('01100001 01100010');
  });

  it('octal — 每字符 3 位八进制，空格分组', () => {
    expect(transformOutput('a', 'octal')).toBe('141');
    expect(transformOutput('ab', 'octal')).toBe('141 142');
  });

  it('空字符串所有格式返回空', () => {
    expect(transformOutput('', 'none')).toBe('');
    expect(transformOutput('', 'hex')).toBe('');
    expect(transformOutput('', 'base64')).toBe('');
    expect(transformOutput('', 'binary')).toBe('');
    expect(transformOutput('', 'octal')).toBe('');
  });
});

describe('stringToHex', () => {
  it('将 "ab" 转为 "61 62"', () => {
    expect(stringToHex('ab')).toBe('61 62');
  });

  it('空字符串返回空', () => {
    expect(stringToHex('')).toBe('');
  });
});

describe('stringToBinary', () => {
  it('将 "a" 转为 8 位二进制', () => {
    expect(stringToBinary('a')).toBe('01100001');
  });

  it('空字符串返回空', () => {
    expect(stringToBinary('')).toBe('');
  });
});

describe('stringToOctal', () => {
  it('将 "a" 转为 3 位八进制', () => {
    expect(stringToOctal('a')).toBe('141');
  });

  it('空字符串返回空', () => {
    expect(stringToOctal('')).toBe('');
  });
});
