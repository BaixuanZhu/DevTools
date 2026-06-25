/**
 * toml.ts 核心封装单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  parseTomlSafe,
  stringifyTomlSafe,
  toPortableObject,
  findNullPath,
  INPUT_SIZE_LIMIT,
} from '../toml';

describe('parseTomlSafe', () => {
  it('解析基础 TOML', () => {
    const r = parseTomlSafe('name = "Alice"\nage = 30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('解析嵌套表', () => {
    const r = parseTomlSafe('[server]\nport = 3000');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ server: { port: 3000 } });
    }
  });

  it('语法错误返回行列号', () => {
    const r = parseTomlSafe('name = ');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('TOML');
      expect(typeof r.line).toBe('number');
    }
  });
});

describe('stringifyTomlSafe', () => {
  it('序列化对象', () => {
    const r = stringifyTomlSafe({ name: 'Alice', age: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('顶层非对象报错', () => {
    const r = stringifyTomlSafe([1, 2, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('顶层必须是表');
    }
  });

  it('null 值报错并给出路径', () => {
    const r = stringifyTomlSafe({ a: { b: null } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('null');
      expect(r.error).toContain('a.b');
    }
  });

  it('数组中的 null 报错', () => {
    const r = stringifyTomlSafe({ list: [1, null] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('list[1]');
    }
  });
});

describe('toPortableObject', () => {
  it('原样返回普通值', () => {
    expect(toPortableObject(42)).toBe(42);
    expect(toPortableObject('hi')).toBe('hi');
    expect(toPortableObject(true)).toBe(true);
  });

  it('对象递归处理', () => {
    expect(toPortableObject({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' });
  });

  it('数组递归处理', () => {
    expect(toPortableObject([1, 'x', { a: 2 }])).toEqual([1, 'x', { a: 2 }]);
  });
});

describe('findNullPath', () => {
  it('无 null 返回 null', () => {
    expect(findNullPath({ a: 1 })).toBeNull();
  });

  it('顶层 null 返回 root 标记', () => {
    expect(findNullPath(null)).toBe('(root)');
  });

  it('定位嵌套 null 路径', () => {
    expect(findNullPath({ a: { b: null } })).toBe('a.b');
  });

  it('定位数组内 null 路径', () => {
    expect(findNullPath({ list: [1, null] })).toBe('list[1]');
  });
});

describe('常量', () => {
  it('INPUT_SIZE_LIMIT 为 10MB', () => {
    expect(INPUT_SIZE_LIMIT).toBe(10 * 1024 * 1024);
  });
});
