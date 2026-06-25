/**
 * toml-json.ts 互转单元测试。
 */
import { describe, it, expect } from 'vitest';
import { tomlToJson, jsonToToml } from '../toml-json';

describe('tomlToJson', () => {
  it('基础 TOML 转 JSON', () => {
    const r = tomlToJson('name = "Alice"\nage = 30', true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const obj = JSON.parse(r.result);
      expect(obj).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('嵌套表转 JSON', () => {
    const r = tomlToJson('[server]\nport = 3000', true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.result)).toEqual({ server: { port: 3000 } });
    }
  });

  it('pretty=false 输出紧凑', () => {
    const r = tomlToJson('a = 1', false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('{"a":1}');
  });

  it('TOML 语法错误透传', () => {
    const r = tomlToJson('name = ', true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('TOML');
  });
});

describe('jsonToToml', () => {
  it('基础 JSON 转 TOML', () => {
    const r = jsonToToml('{"name":"Alice","age":30}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('嵌套 JSON 转 TOML', () => {
    const r = jsonToToml('{"server":{"port":3000}}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('[server]');
  });

  it('JSON 语法错误透传', () => {
    const r = jsonToToml('{bad}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('语法错误');
  });

  it('JSON 含 null 报错', () => {
    const r = jsonToToml('{"a":null}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('null');
  });

  it('JSON 顶层数组报错', () => {
    const r = jsonToToml('[1,2,3]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('顶层必须是表');
  });
});
