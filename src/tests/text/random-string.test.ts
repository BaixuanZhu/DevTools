import { describe, it, expect } from 'vitest';
import { generateRandomString, PRESET_CHARSETS, type CharsetPreset } from '../../utils/text/random-string';

describe('generateRandomString', () => {
  it('应生成指定长度的字符串', () => {
    const result = generateRandomString(16, 'alphanumeric');
    expect(result.length).toBe(16);
  });

  it('应只包含所选字符集中的字符', () => {
    const result = generateRandomString(100, 'digits');
    for (const ch of result) {
      expect(ch).toMatch(/[0-9]/);
    }
  });

  it('alphanumeric 字符集应包含大小写字母和数字', () => {
    const result = generateRandomString(1000, 'alphanumeric');
    expect(result).toMatch(/[a-z]/);
    expect(result).toMatch(/[A-Z]/);
    expect(result).toMatch(/[0-9]/);
  });

  it('应支持自定义字符集', () => {
    const result = generateRandomString(50, 'custom:abc');
    for (const ch of result) {
      expect('abc').toContain(ch);
    }
  });

  it('长度为 0 应返回空字符串', () => {
    const result = generateRandomString(0, 'alphanumeric');
    expect(result).toBe('');
  });

  it('应生成不同的字符串（随机性检查）', () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(generateRandomString(32, 'alphanumeric'));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('PRESET_CHARSETS', () => {
  it('应包含 alphanumeric 预设', () => {
    expect(PRESET_CHARSETS.alphanumeric).toBeDefined();
  });

  it('应包含 digits 预设', () => {
    expect(PRESET_CHARSETS.digits).toBeDefined();
    for (const ch of PRESET_CHARSETS.digits) {
      expect(ch).toMatch(/[0-9]/);
    }
  });

  it('应包含 special 预设', () => {
    expect(PRESET_CHARSETS.special).toBeDefined();
    expect(PRESET_CHARSETS.special.length).toBeGreaterThan(
      PRESET_CHARSETS.alphanumeric.length,
    );
  });
});
