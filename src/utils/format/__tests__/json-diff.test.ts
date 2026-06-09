/**
 * JSON Diff 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import { measureMaxDepth } from '../json-diff';

describe('measureMaxDepth', () => {
  it('空对象深度为 1', () => {
    expect(measureMaxDepth('{}')).toBe(1);
  });

  it('空数组深度为 1', () => {
    expect(measureMaxDepth('[]')).toBe(1);
  });

  it('扁平对象深度为 1', () => {
    expect(measureMaxDepth('{"a":1,"b":2}')).toBe(1);
  });

  it('一层嵌套深度为 2', () => {
    expect(measureMaxDepth('{"a":{"b":1}}')).toBe(2);
  });

  it('数组嵌套对象深度为 2', () => {
    expect(measureMaxDepth('[{"a":1}]')).toBe(2);
  });

  it('多层嵌套正确计数', () => {
    const json = '{"a":{"b":{"c":{"d":1}}}}';
    expect(measureMaxDepth(json)).toBe(4);
  });

  it('忽略字符串内的花括号', () => {
    const json = '{"text": "hello {world} {{nested}}"}';
    expect(measureMaxDepth(json)).toBe(1);
  });

  it('忽略字符串内的方括号', () => {
    const json = '{"arr": "[1,2,3]"}';
    expect(measureMaxDepth(json)).toBe(1);
  });

  it('处理转义的引号', () => {
    const json = '{"text": "say \\"hello {\\"}"}';
    expect(measureMaxDepth(json)).toBe(1);
  });

  it('纯值类型深度为 0', () => {
    expect(measureMaxDepth('42')).toBe(0);
    expect(measureMaxDepth('"hello"')).toBe(0);
    expect(measureMaxDepth('null')).toBe(0);
    expect(measureMaxDepth('true')).toBe(0);
  });
});
