import { describe, it, expect } from 'vitest';
import {
  randomInt, pick, shuffle,
  genUuid, genUsername, genPhone, genIp, genBoolean,
  genInteger, genDecimal, genAutoId,
} from '../fake-data';

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
