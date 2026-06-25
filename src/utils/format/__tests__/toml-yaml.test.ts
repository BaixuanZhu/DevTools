/**
 * toml-yaml.ts 互转单元测试。
 */
import { describe, it, expect } from 'vitest';
import { tomlToYaml, yamlToToml } from '../toml-yaml';

describe('tomlToYaml', () => {
  it('基础 TOML 转 YAML', () => {
    const r = tomlToYaml('name = "Alice"\nage = 30', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name: Alice');
      expect(r.result).toContain('age: 30');
    }
  });

  it('嵌套表转 YAML', () => {
    const r = tomlToYaml('[server]\nport = 3000', 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('port: 3000');
  });

  it('TOML 语法错误透传', () => {
    const r = tomlToYaml('name = ', 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('TOML');
  });
});

describe('yamlToToml', () => {
  it('基础 YAML 转 TOML', () => {
    const r = yamlToToml('name: Alice\nage: 30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('嵌套 YAML 转 TOML', () => {
    const r = yamlToToml('server:\n  port: 3000');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('[server]');
  });

  it('YAML 语法错误', () => {
    const r = yamlToToml('a: b: c');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('YAML');
  });

  it('YAML 含 null 报错', () => {
    const r = yamlToToml('a: null');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('null');
  });

  it('YAML 顶层数组报错', () => {
    const r = yamlToToml('- 1\n- 2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('顶层必须是表');
  });
});
