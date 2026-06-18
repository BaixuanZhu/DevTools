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
