import { describe, it, expect } from 'vitest';
import {
  parseNumber,
  convertNumber,
  getBitWidth,
  getPreviewBitWidth,
  toBinaryString,
  formatBinaryPreview,
  isValidDigit,
  BASE_OPTIONS,
} from '../number-base-converter';

describe('parseNumber', () => {
  it('parses positive decimal', () => {
    const result = parseNumber('255', 10);
    expect(result).toEqual({ value: 255n, negative: false });
  });

  it('parses negative decimal', () => {
    const result = parseNumber('-255', 10);
    expect(result).toEqual({ value: -255n, negative: true });
  });

  it('parses hex without prefix', () => {
    const result = parseNumber('1A3F', 16);
    expect(result).toEqual({ value: 6719n, negative: false });
  });

  it('returns null for invalid digit', () => {
    expect(parseNumber('1G', 16)).toBeNull();
    expect(parseNumber('9', 8)).toBeNull();
    expect(parseNumber('2', 2)).toBeNull();
  });

  it('handles empty and whitespace', () => {
    expect(parseNumber('', 10)).toBeNull();
    expect(parseNumber('  ', 10)).toBeNull();
  });

  it('handles large integers beyond safe integer', () => {
    const result = parseNumber('12345678901234567890', 10);
    expect(result).toEqual({ value: 12345678901234567890n, negative: false });
  });
});

describe('convertNumber', () => {
  it('converts to binary', () => {
    expect(convertNumber(255n, 2)).toBe('11111111');
  });

  it('converts to octal', () => {
    expect(convertNumber(255n, 8)).toBe('377');
  });

  it('converts to decimal', () => {
    expect(convertNumber(0x1A3Fn, 10)).toBe('6719');
  });

  it('converts to hex', () => {
    expect(convertNumber(6719n, 16)).toBe('1a3f');
  });

  it('preserves sign in non-binary bases', () => {
    expect(convertNumber(-255n, 10)).toBe('-255');
    expect(convertNumber(-255n, 16)).toBe('-ff');
  });
});

describe('isValidDigit', () => {
  it('accepts valid digits for each base', () => {
    expect(isValidDigit('0', 2)).toBe(true);
    expect(isValidDigit('1', 2)).toBe(true);
    expect(isValidDigit('7', 8)).toBe(true);
    expect(isValidDigit('9', 10)).toBe(true);
    expect(isValidDigit('a', 16)).toBe(true);
    expect(isValidDigit('F', 16)).toBe(true);
  });

  it('rejects invalid digits for each base', () => {
    expect(isValidDigit('2', 2)).toBe(false);
    expect(isValidDigit('8', 8)).toBe(false);
    expect(isValidDigit('a', 10)).toBe(false);
    expect(isValidDigit('g', 16)).toBe(false);
  });
});

describe('getBitWidth', () => {
  it('returns 1 for zero', () => {
    expect(getBitWidth(0n, false)).toBe(1);
  });

  it('returns 8 for zero with negative flag', () => {
    expect(getBitWidth(0n, true)).toBe(8);
  });

  it('returns minimum bits for positives', () => {
    expect(getBitWidth(1n, false)).toBe(1);
    expect(getBitWidth(255n, false)).toBe(8);
    expect(getBitWidth(256n, false)).toBe(9);
  });

  it('returns 8-multiple for negatives', () => {
    expect(getBitWidth(-1n, true)).toBe(8);
    expect(getBitWidth(-128n, true)).toBe(8);
    expect(getBitWidth(-129n, true)).toBe(16);
    expect(getBitWidth(-32768n, true)).toBe(16);
    expect(getBitWidth(-32769n, true)).toBe(24);
  });
});

describe('getPreviewBitWidth', () => {
  it('rounds positives up to nibble boundary', () => {
    expect(getPreviewBitWidth(5n, false)).toBe(4);
    expect(getPreviewBitWidth(0x1A3Fn, false)).toBe(16);
    expect(getPreviewBitWidth(0x100n, false)).toBe(12);
  });

  it('keeps negatives at 8-multiple', () => {
    expect(getPreviewBitWidth(-1n, true)).toBe(8);
    expect(getPreviewBitWidth(-255n, true)).toBe(16);
  });
});

describe('toBinaryString', () => {
  it('formats positive numbers', () => {
    expect(toBinaryString(255n, 8)).toBe('11111111');
    expect(toBinaryString(5n, 3)).toBe('101');
  });

  it('formats negative numbers as two\'s complement', () => {
    expect(toBinaryString(-1n, 8)).toBe('11111111');
    expect(toBinaryString(-255n, 16)).toBe('1111111100000001');
  });
});

describe('formatBinaryPreview', () => {
  it('groups by bytes with internal nibble spaces', () => {
    expect(formatBinaryPreview(0x1A3Fn, 16)).toBe('[0001 1010][0011 1111]');
  });

  it('pads positives to nibble boundary', () => {
    expect(formatBinaryPreview(5n, 3)).toBe('[0101]');
  });

  it('handles negative two\'s complement', () => {
    expect(formatBinaryPreview(-1n, 8)).toBe('[1111 1111]');
  });
});

describe('BASE_OPTIONS', () => {
  it('has four bases', () => {
    expect(BASE_OPTIONS.map((o) => o.value)).toEqual([2, 8, 10, 16]);
  });
});
