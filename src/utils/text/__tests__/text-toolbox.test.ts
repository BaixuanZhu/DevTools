import { describe, it, expect } from 'vitest';
import { toUpperCase, toLowerCase, toTitleCase } from '../text-toolbox';

describe('toUpperCase', () => {
  it('converts lowercase to uppercase', () => {
    expect(toUpperCase('abc')).toBe('ABC');
  });

  it('leaves non-cased characters (Chinese) unchanged', () => {
    expect(toUpperCase('你好abc')).toBe('你好ABC');
  });
});

describe('toLowerCase', () => {
  it('converts uppercase to lowercase', () => {
    expect(toLowerCase('ABC')).toBe('abc');
  });
});

describe('toTitleCase', () => {
  it('capitalizes first char of each line, lowercases the rest', () => {
    expect(toTitleCase('hello world')).toBe('Hello world');
  });

  it('processes each line independently', () => {
    expect(toTitleCase('HELLO\nWORLD')).toBe('Hello\nWorld');
  });

  it('preserves empty lines', () => {
    expect(toTitleCase('a\n\nb')).toBe('A\n\nB');
  });
});

import { toHalfWidth, toFullWidth } from '../text-toolbox';

describe('toHalfWidth', () => {
  it('converts fullwidth ASCII letters and digits', () => {
    expect(toHalfWidth('ＡＢＣ１２３')).toBe('ABC123');
  });

  it('converts fullwidth space (U+3000) to regular space', () => {
    expect(toHalfWidth('Ａ　Ｂ')).toBe('A B');
  });

  it('leaves Chinese characters unchanged', () => {
    expect(toHalfWidth('你好')).toBe('你好');
  });
});

describe('toFullWidth', () => {
  it('converts ASCII letters and digits to fullwidth', () => {
    expect(toFullWidth('ABC123')).toBe('ＡＢＣ１２３');
  });

  it('converts regular space to fullwidth space', () => {
    expect(toFullWidth('a b')).toBe('ａ　ｂ');
  });
});

import { removeBlankLines, dedupeLines, trimLines, collapseWhitespace } from '../text-toolbox';

describe('removeBlankLines', () => {
  it('removes empty and whitespace-only lines', () => {
    expect(removeBlankLines('a\n\n  \nb')).toBe('a\nb');
  });
});

describe('dedupeLines', () => {
  it('removes duplicate lines keeping first occurrence order', () => {
    expect(dedupeLines('a\nb\na')).toBe('a\nb');
  });
});

describe('trimLines', () => {
  it('trims leading/trailing whitespace of each line only', () => {
    expect(trimLines('  a  b  \n  c')).toBe('a  b\nc');
  });
});

describe('collapseWhitespace', () => {
  it('collapses consecutive whitespace within a line to single space', () => {
    expect(collapseWhitespace('a   b\t\tc')).toBe('a b c');
  });

  it('does not merge across lines', () => {
    expect(collapseWhitespace('a\n  b  c')).toBe('a\nb c');
  });
});

import { sortLines } from '../text-toolbox';

describe('sortLines', () => {
  it('sorts lines ascending by code point', () => {
    expect(sortLines('c\na\nb')).toBe('a\nb\nc');
  });

  it('sorts lines descending', () => {
    expect(sortLines('c\na\nb', 'desc')).toBe('c\nb\na');
  });

  it('places uppercase before lowercase (code point order)', () => {
    expect(sortLines('b\nA\nc')).toBe('A\nb\nc');
  });

  it('moves blank/whitespace-only lines to the end', () => {
    expect(sortLines('b\n\na')).toBe('a\nb\n');
  });
});
