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
