/**
 * JSON 转 YAML 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  convertJsonToYaml,
  INPUT_SIZE_LIMIT,
  WORKER_THRESHOLD,
  type JsonToYamlResult,
} from '../json-to-yaml';

describe('convertJsonToYaml', () => {
  it('基础对象转换', () => {
    const result = convertJsonToYaml('{"name":"Alice","age":30}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('name: Alice');
      expect(result.result).toContain('age: 30');
    }
  });

  it('数组转换', () => {
    const result = convertJsonToYaml('[1, 2, 3]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('- 1');
      expect(result.result).toContain('- 2');
      expect(result.result).toContain('- 3');
    }
  });

  it('嵌套缩进为 2 空格', () => {
    const result = convertJsonToYaml('{"a":{"b":1}}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('  b: 1');
    }
  });

  it('无效 JSON 报错', () => {
    const result = convertJsonToYaml('{bad}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('循环引用报错', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = convertJsonToYaml(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('重复引用');
    }
  });

  it('DAG 重复引用报错（非循环）', () => {
    const shared = { x: 1 };
    const root = { a: shared, b: shared };
    const result = convertJsonToYaml(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('重复引用');
    }
  });

  it('null 处理', () => {
    const result = convertJsonToYaml('{"value":null}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('value: null');
    }
  });

  it('boolean 处理', () => {
    const result = convertJsonToYaml('{"flag":true,"other":false}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('flag: true');
      expect(result.result).toContain('other: false');
    }
  });

  it('不自动折行（lineWidth: 0）', () => {
    const longText = 'a'.repeat(200);
    const result = convertJsonToYaml(`{"text":"${longText}"}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain(longText);
    }
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
