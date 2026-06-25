/**
 * json-formatter.ts 单元测试。
 */
import { describe, it, expect } from 'vitest';
import { analyzeJson } from '../json-formatter';

describe('analyzeJson', () => {
  it('合法 JSON 返回 ok 并附带统计信息', () => {
    const r = analyzeJson('{"a":1,"b":{"c":2}}');
    expect(r.ok).toBe(true);
    expect(r.message).toContain('有效');
    expect(r.stats).toBeDefined();
    if (r.stats) {
      expect(r.stats.lineCount).toBe(1);
      expect(r.stats.byteSize).toBeGreaterThan(0);
      expect(r.stats.nodeCount).toBeGreaterThanOrEqual(1);
      expect(r.stats.maxDepth).toBeGreaterThanOrEqual(1);
    }
  });

  it('多行 JSON 的行数统计正确', () => {
    const r = analyzeJson('{\n  "a": 1,\n  "b": 2\n}');
    expect(r.ok).toBe(true);
    if (r.stats) {
      expect(r.stats.lineCount).toBe(4);
    }
  });

  it('语法错误返回错误信息与行列号', () => {
    const r = analyzeJson('{a: 1}');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('JSON 语法错误');
    expect(typeof r.line).toBe('number');
    expect(typeof r.column).toBe('number');
  });

  it('空输入判为非法', () => {
    const r = analyzeJson('');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('JSON 语法错误');
  });

  it('截断的 JSON 报「意外结束」', () => {
    const r = analyzeJson('{"a":');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('JSON 数据意外结束');
  });
});
