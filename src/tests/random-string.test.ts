import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  applyLetterCase,
  hasLetters,
} from '../utils/random-string';

describe('random-string utils', () => {
  describe('generateRandomString', () => {
    it('generates string of correct length', () => {
      const result = generateRandomString(16, 'alphanumeric');
      expect(result).toHaveLength(16);
    });

    it('generates digits-only string', () => {
      const result = generateRandomString(100, 'digits');
      expect(result).toMatch(/^[0-9]+$/);
    });

    it('generates custom charset string', () => {
      const result = generateRandomString(100, 'custom:abc');
      expect(result).toMatch(/^[abc]+$/);
    });

    it('returns empty string for length 0', () => {
      expect(generateRandomString(0, 'alphanumeric')).toBe('');
    });
  });

  describe('applyLetterCase', () => {
    it('returns original string for "none"', () => {
      const input = 'aBc123';
      expect(applyLetterCase(input, 'none')).toBe('aBc123');
    });

    it('converts to uppercase', () => {
      const input = 'aBc123xYz';
      expect(applyLetterCase(input, 'upper')).toBe('ABC123XYZ');
    });

    it('converts to lowercase', () => {
      const input = 'aBc123xYz';
      expect(applyLetterCase(input, 'lower')).toBe('abc123xyz');
    });
  });

  describe('hasLetters', () => {
    it('returns true for alphanumeric', () => {
      expect(hasLetters('alphanumeric')).toBe(true);
    });

    it('returns true for special', () => {
      expect(hasLetters('special')).toBe(true);
    });

    it('returns false for digits', () => {
      expect(hasLetters('digits')).toBe(false);
    });

    it('returns true for custom with letters', () => {
      expect(hasLetters('custom:aBc')).toBe(true);
    });

    it('returns false for custom without letters', () => {
      expect(hasLetters('custom:123')).toBe(false);
    });
  });
});
