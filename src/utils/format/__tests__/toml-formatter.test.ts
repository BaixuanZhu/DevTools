/**
 * toml-formatter.ts 单元测试。
 */
import { describe, it, expect } from 'vitest';
import { formatToml, validateToml, checkInputSize, WORKER_THRESHOLD } from '../toml-formatter';

describe('formatToml', () => {
  it('美化 TOML（重新序列化）', () => {
    const r = formatToml('name="Alice"\nage=30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('语法错误返回行列号', () => {
    const r = formatToml('name = ');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('TOML');
      expect(typeof r.line).toBe('number');
    }
  });
});

describe('validateToml', () => {
  it('有效 TOML', () => {
    const r = validateToml('a = 1');
    expect(r.ok).toBe(true);
    expect(r.message).toContain('有效');
  });

  it('无效 TOML 带行列号', () => {
    const r = validateToml('a = ');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('TOML');
    expect(typeof r.line).toBe('number');
  });
});

describe('checkInputSize', () => {
  it('小输入返回 ok', () => {
    expect(checkInputSize('a = 1')).toBe('ok');
  });

  it('超大输入返回 error', () => {
    const big = 'x = "' + 'a'.repeat(11 * 1024 * 1024) + '"';
    expect(checkInputSize(big)).toBe('error');
  });
});

describe('常量', () => {
  it('WORKER_THRESHOLD 为 1MB', () => {
    expect(WORKER_THRESHOLD).toBe(1024 * 1024);
  });
});
