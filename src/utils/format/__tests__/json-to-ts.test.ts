/**
 * JSON 转 TypeScript 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  jsonToTs,
  validateTypeName,
  INPUT_SIZE_LIMIT,
  WORKER_THRESHOLD,
} from '../json-to-ts';

describe('jsonToTs', () => {
  it('基本类型对象', () => {
    const result = jsonToTs('{"name":"Alice","age":30,"active":true}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('interface RootObject {');
      expect(result.result).toContain('name: string;');
      expect(result.result).toContain('age: number;');
      expect(result.result).toContain('active: boolean;');
    }
  });

  it('null 值推断为 null 类型', () => {
    const result = jsonToTs('{"value":null}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('value: null;');
    }
  });

  it('嵌套对象与类型名派生', () => {
    const result = jsonToTs('{"meta":{"version":"1.0"}}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('meta: RootObjectMeta;');
      expect(result.result).toContain('interface RootObjectMeta {');
      expect(result.result).toContain('version: string;');
    }
  });

  it('对象数组合并字段并标注可选字段', () => {
    const result = jsonToTs(
      '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob","active":true}]}',
      'RootObject',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('users: RootObjectUsersItem[];');
      expect(result.result).toContain('interface RootObjectUsersItem {');
      expect(result.result).toContain('id: number;');
      expect(result.result).toContain('name: string;');
      expect(result.result).toContain('active?: boolean;');
    }
  });

  it('同字段多类型生成并集（基本类型按 string/number/boolean/null 排序）', () => {
    const result = jsonToTs('{"v":[{"a":1},{"a":"x"}]}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('a: string | number;');
    }
  });

  it('非对象数组合并字段并生成并集', () => {
    const result = jsonToTs('{"tags":["a",1,true]}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('tags: (string | number | boolean)[];');
    }
  });

  it('空数组推断为 unknown[]', () => {
    const result = jsonToTs('{"empty":[]}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('empty: unknown[];');
    }
  });

  it('非法键名加引号', () => {
    const result = jsonToTs('{"a-b":1,"123":2,"valid":3}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('"a-b": number;');
      expect(result.result).toContain('"123": number;');
      expect(result.result).toContain('valid: number;');
    }
  });

  it('顶层为对象数组', () => {
    const result = jsonToTs('[{"a":1},{"a":2,"b":3}]', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('type RootObject = RootObjectItem[];');
      expect(result.result).toContain('interface RootObjectItem {');
      expect(result.result).toContain('a: number;');
      expect(result.result).toContain('b?: number;');
    }
  });

  it('顶层为基本类型', () => {
    const result = jsonToTs('"hello"', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toBe('type RootObject = string;');
    }
  });

  it('类型名派生冲突追加数字后缀', () => {
    const result = jsonToTs('{"a":{"x":1},"A":{"y":2}}', 'RootObject');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('interface RootObjectA {');
      expect(result.result).toContain('interface RootObjectA2 {');
    }
  });

  it('无效 JSON 报错', () => {
    const result = jsonToTs('{bad}', 'RootObject');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('嵌套过深报错（复用 parseJsonSafe 256 层限制）', () => {
    let json = '';
    for (let i = 0; i < 300; i++) json += '{"a":';
    json += '1';
    for (let i = 0; i < 300; i++) json += '}';
    const result = jsonToTs(json, 'RootObject');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('嵌套');
    }
  });
});

describe('validateTypeName', () => {
  it('合法类型名通过', () => {
    expect(validateTypeName('RootObject').ok).toBe(true);
    expect(validateTypeName('_Type').ok).toBe(true);
    expect(validateTypeName('$Type').ok).toBe(true);
    expect(validateTypeName('Type123').ok).toBe(true);
  });

  it('空类型名报错', () => {
    const result = validateTypeName('   ');
    expect(result.ok).toBe(false);
  });

  it('非法类型名报错', () => {
    expect(validateTypeName('a-b').ok).toBe(false);
    expect(validateTypeName('123').ok).toBe(false);
    expect(validateTypeName('a b').ok).toBe(false);
  });
});

describe('常量', () => {
  it('INPUT_SIZE_LIMIT 为 10MB', () => {
    expect(INPUT_SIZE_LIMIT).toBe(10 * 1024 * 1024);
  });

  it('WORKER_THRESHOLD 为 500KB', () => {
    expect(WORKER_THRESHOLD).toBe(500 * 1024);
  });
});
