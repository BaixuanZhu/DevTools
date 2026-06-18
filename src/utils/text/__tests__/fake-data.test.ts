import { describe, it, expect } from 'vitest';
import {
  randomInt, pick, shuffle,
  genUuid, genUsername, genPhone, genIp, genBoolean,
  genInteger, genDecimal, genAutoId,
  genName, genEmail, genPassword, genLoremWord, genLoremSentence,
  genLoremParagraph, genUrl,
  genDate, genTimestamp, generateRecords,
} from '../fake-data';
import type { FieldConfig } from '../fake-data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomInt', () => {
  it('returns value within [min, max]', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('swaps when min > max', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(7, 3);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('returns min when min === max', () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(pick(arr));
    }
  });

  it('can return every element over many draws', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pick(arr));
    expect(seen.size).toBe(4);
  });
});

describe('shuffle', () => {
  it('preserves elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input', () => {
    const arr = [1, 2, 3];
    const snapshot = [...arr];
    shuffle(arr);
    expect(arr).toEqual(snapshot);
  });
});

describe('genUuid', () => {
  it('matches v4 format', () => {
    for (let i = 0; i < 50; i++) expect(UUID_RE.test(genUuid())).toBe(true);
  });
});

describe('genUsername', () => {
  it('is lowercase alphanumeric within length range', () => {
    for (let i = 0; i < 100; i++) {
      const u = genUsername();
      expect(u).toMatch(/^[a-z]+[0-9]*$/);
      expect(u.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('genPhone', () => {
  it('is 11 digits starting with 1 and valid second digit', () => {
    const validSecond = ['3', '4', '5', '7', '8', '9'];
    for (let i = 0; i < 100; i++) {
      const p = genPhone();
      expect(p).toMatch(/^1\d{10}$/);
      expect(validSecond).toContain(p[1]);
    }
  });
});

describe('genIp', () => {
  it('has four octets in 0-255', () => {
    for (let i = 0; i < 100; i++) {
      const parts = genIp().split('.').map(Number);
      expect(parts).toHaveLength(4);
      parts.forEach((n) => expect(n).toBeGreaterThanOrEqual(0) && expect(n).toBeLessThanOrEqual(255));
    }
  });
});

describe('genBoolean', () => {
  it('returns true or false', () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) set.add(genBoolean());
    expect(set).toEqual(new Set(['true', 'false']));
  });
});

describe('genInteger', () => {
  it('stays within range', () => {
    for (let i = 0; i < 200; i++) {
      const n = Number(genInteger({ min: -5, max: 5 }));
      expect(n).toBeGreaterThanOrEqual(-5);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('swaps when min > max', () => {
    const n = Number(genInteger({ min: 10, max: 1 }));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(10);
  });
});

describe('genDecimal', () => {
  it('respects precision and range', () => {
    for (let i = 0; i < 200; i++) {
      const s = genDecimal({ min: 0, max: 10, precision: 2 });
      const n = Number(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(10);
      expect(s.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    }
  });
});

describe('genAutoId', () => {
  it('increments by rowIndex from start', () => {
    expect(genAutoId({ start: 1 }, 0)).toBe('1');
    expect(genAutoId({ start: 1 }, 4)).toBe('5');
    expect(genAutoId({ start: 100 }, 0)).toBe('100');
  });
});

describe('genName', () => {
  it('chinese name contains a surname and given chars', () => {
    const CN_SURNAMES_PLACEHOLDER = '王李张'; // 仅断言含中文
    for (let i = 0; i < 100; i++) {
      const n = genName({ locale: 'zh' });
      expect(/[一-龥]{2,4}/.test(n)).toBe(true);
      expect(n.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('english name has two parts separated by space', () => {
    for (let i = 0; i < 100; i++) {
      const n = genName({ locale: 'en' });
      expect(n.split(' ')).toHaveLength(2);
      expect(/^[A-Z][a-z]+$/.test(n.split(' ')[0])).toBe(true);
    }
  });
});

describe('genEmail', () => {
  it('contains @ and given domain', () => {
    const e = genEmail({ domain: '@test.com' });
    expect(e.endsWith('@test.com')).toBe(true);
    expect(e.indexOf('@')).toBeGreaterThan(0);
  });
});

describe('genPassword', () => {
  it('has requested length and covers upper/lower/digit', () => {
    for (let i = 0; i < 100; i++) {
      const p = genPassword({ length: 12 });
      expect(p).toHaveLength(12);
      expect(/[A-Z]/.test(p)).toBe(true);
      expect(/[a-z]/.test(p)).toBe(true);
      expect(/[0-9]/.test(p)).toBe(true);
    }
  });

  it('clamps length to minimum 4', () => {
    const p = genPassword({ length: 2 });
    expect(p).toHaveLength(4);
  });
});

describe('genLoremWord', () => {
  it('returns the requested number of words', () => {
    const s = genLoremWord({ count: 5 });
    expect(s.split(' ')).toHaveLength(5);
  });
});

describe('genLoremSentence', () => {
  it('ends with a period and starts uppercase', () => {
    const s = genLoremSentence({ count: 1 });
    expect(s.endsWith('.')).toBe(true);
    expect(/^[A-Z]/.test(s)).toBe(true);
  });

  it('joins multiple sentences', () => {
    const s = genLoremSentence({ count: 3 });
    expect(s.split('.').filter(Boolean)).toHaveLength(3);
  });
});

describe('genLoremParagraph', () => {
  it('returns the requested number of paragraphs', () => {
    const s = genLoremParagraph({ count: 2 });
    expect(s.split('\n')).toHaveLength(2);
  });
});

describe('genUrl', () => {
  it('starts with https://', () => {
    for (let i = 0; i < 50; i++) {
      expect(genUrl().startsWith('https://')).toBe(true);
    }
  });
});

describe('genDate', () => {
  const NOW = Date.UTC(2026, 0, 1); // 2026-01-01 固定基准
  it('matches YYYY-MM-DD format', () => {
    for (let i = 0; i < 100; i++) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(genDate({ years: 10 }, NOW))).toBe(true);
    }
  });

  it('falls within the past N years', () => {
    for (let i = 0; i < 100; i++) {
      const t = Date.parse(genDate({ years: 5 }, NOW));
      expect(t).toBeLessThanOrEqual(NOW);
      expect(t).toBeGreaterThan(NOW - 5 * 366 * 86400000);
    }
  });
});

describe('genTimestamp', () => {
  const NOW = Date.UTC(2026, 0, 1);
  it('is a positive integer in seconds', () => {
    for (let i = 0; i < 100; i++) {
      const s = Number(genTimestamp({ years: 1 }, NOW));
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(Math.floor(NOW / 1000));
    }
  });
});

describe('generateRecords', () => {
  const NOW = Date.UTC(2026, 0, 1);
  const fields: FieldConfig[] = [
    { rowId: 'r1', name: 'id', type: 'auto-id', params: { start: 1 } },
    { rowId: 'r2', name: 'name', type: 'name', params: { locale: 'zh' } },
  ];

  it('produces the requested number of records', () => {
    expect(generateRecords(fields, 5, NOW)).toHaveLength(5);
  });

  it('uses field names as keys in order', () => {
    const recs = generateRecords(fields, 1, NOW);
    expect(Object.keys(recs[0])).toEqual(['id', 'name']);
  });

  it('increments auto-id across rows', () => {
    const recs = generateRecords(fields, 3, NOW);
    expect(recs.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('returns empty array for count 0', () => {
    expect(generateRecords(fields, 0, NOW)).toEqual([]);
  });
});
