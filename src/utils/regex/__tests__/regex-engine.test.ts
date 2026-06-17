/**
 * 正则表达式引擎单元测试。
 *
 * 覆盖标志位组合、捕获组（含命名捕获组）、零宽匹配、无匹配、
 * 非法正则的错误归集、以及边界场景（空正则 / 空文本 / 特殊字符）。
 */
import { describe, it, expect } from 'vitest';
import {
  compileRegex,
  runMatch,
  buildSegments,
  formatRegexLiteral,
  WORKER_THRESHOLD,
  type RegexMatch,
  type RegexSegment,
} from '../regex-engine';

/**
 * 测试辅助：从编译结果中取出 RegExp 实例。
 *
 * 通过 `if (!r.ok) throw` 收窄判别式联合后安全取出 RegExp 实例，
 * 让测试用例保持简洁。仅用于「已知合法」的测试场景，非法场景请直接读 .error。
 *
 * @param pattern - 正则 pattern
 * @param flags - 标志位
 * @returns 编译后的 RegExp
 */
function reOf(pattern: string, flags: string): RegExp {
  const r = compileRegex(pattern, flags);
  if (!r.ok) throw new Error(`预期编译成功，但失败：${r.error}`);
  return r.re;
}

describe('compileRegex', () => {
  it('合法正则编译成功', () => {
    const result = compileRegex('\\d+', 'g');
    expect(result.ok).toBe(true);
  });

  it('空正则编译成功（匹配空字符串）', () => {
    const result = compileRegex('', 'g');
    expect(result.ok).toBe(true);
  });

  it('未闭合分组报中文错误', () => {
    const result = compileRegex('foo(bar', '');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 引擎抛 unterminated / unexpected end，人类化文案为「未正确闭合」
      expect(result.error).toContain('闭合');
    }
  });

  it('未配对中括号报中文错误', () => {
    const result = compileRegex('[a-z', '');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 任一可读错误描述均可，关键是中文 + 内联可读
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('非法标志位报中文错误', () => {
    const result = compileRegex('foo', 'z');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('标志');
    }
  });

  it('重复标志位报中文错误', () => {
    const result = compileRegex('foo', 'gg');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('重复');
    }
  });

  it('u 标志下非法 Unicode 转义报错', () => {
    const result = compileRegex('\\u{', 'u');
    expect(result.ok).toBe(false);
  });
});

describe('runMatch - 标志位组合', () => {
  it('无 g 标志只返回第一个匹配', () => {
    const re = reOf('a', '');
    const matches = runMatch(re, 'banana');
    expect(matches.length).toBe(1);
    expect(matches[0].match).toBe('a');
    expect(matches[0].index).toBe(1);
  });

  it('g 标志返回所有匹配', () => {
    const re = reOf('a', 'g');
    const matches = runMatch(re, 'banana');
    expect(matches.length).toBe(3);
    expect(matches.map((m) => m.index)).toEqual([1, 3, 5]);
  });

  it('i 标志忽略大小写', () => {
    const re = reOf('the', 'gi');
    const matches = runMatch(re, 'The cat and THE dog');
    expect(matches.length).toBe(2);
  });

  it('m 标志多行模式下 ^ $ 匹配每行边界', () => {
    const re = reOf('^\\w+', 'gm');
    const matches = runMatch(re, 'foo\nbar\nbaz');
    expect(matches.length).toBe(3);
    expect(matches.map((m) => m.match)).toEqual(['foo', 'bar', 'baz']);
  });

  it('s 标志 dotAll 让 . 匹配换行', () => {
    const reWithoutS = reOf('a.b', 'g');
    expect(runMatch(reWithoutS, 'a\nb').length).toBe(0);

    const reWithS = reOf('a.b', 'gs');
    const matches = runMatch(reWithS, 'a\nb');
    expect(matches.length).toBe(1);
    expect(matches[0].match).toBe('a\nb');
  });

  it('y 标志 sticky 从 lastIndex 精确匹配', () => {
    const re = reOf('\\d', 'y');
    re.lastIndex = 0;
    // y 标志下必须从 lastIndex 处精确开头匹配
    const m1 = re.exec('a1b2');
    expect(m1).toBeNull(); // 位置 0 是 'a'，不匹配
    re.lastIndex = 1;
    const m2 = re.exec('a1b2');
    expect(m2).not.toBeNull();
    expect(m2![0]).toBe('1');
  });

  it('u 标志正确处理 Unicode 码点', () => {
    // 不带 u 标志，\\u{1F600} 会被拆成单字节理解；带 u 才能识别为单个 emoji
    const re = reOf('\\u{1F600}', 'gu');
    const matches = runMatch(re, 'hello 😀 world');
    expect(matches.length).toBe(1);
    expect(matches[0].match).toBe('😀');
  });
});

describe('runMatch - 捕获组', () => {
  it('编号捕获组正确提取', () => {
    const re = reOf('(\\d+)-(\\d+)', 'g');
    const matches = runMatch(re, '日期 2026-06-17 与 2025-01-02');
    expect(matches.length).toBe(2);
    const m = matches[0];
    expect(m.match).toBe('2026-06');
    expect(m.groups).toEqual(['2026', '06']);
  });

  it('命名捕获组同时出现在 groups 与 namedGroups', () => {
    const re = reOf('(?<year>\\d{4})-(?<month>\\d{2})', 'g');
    const matches = runMatch(re, '2026-06');
    expect(matches.length).toBe(1);
    const m = matches[0];
    expect(m.namedGroups).toEqual({ year: '2026', month: '06' });
    // groups 也应包含命名组的值（与 RegExpExecArray.groups 的行为对齐）
    expect(m.groups).toEqual(['2026', '06']);
  });

  it('未参与的捕获组在 groups 中为 undefined', () => {
    const re = reOf('(a)|(b)', 'g');
    const matches = runMatch(re, 'ab');
    expect(matches.length).toBe(2);
    expect(matches[0].groups).toEqual(['a', undefined]);
    expect(matches[1].groups).toEqual([undefined, 'b']);
  });
});

describe('runMatch - 零宽 / 边界 / 无匹配', () => {
  it('零宽匹配（如 ^）按位置返回', () => {
    const re = reOf('^', 'gm');
    const matches = runMatch(re, 'a\nb');
    // gm 下 ^ 在每行开头匹配
    expect(matches.length).toBe(2);
    expect(matches[0].match).toBe('');
    expect(matches[0].index).toBe(0);
  });

  it('空正则匹配每个位置（零宽）', () => {
    const re = reOf('', 'g');
    const matches = runMatch(re, 'ab');
    // 空正则在 'ab' 的 0、1、2 三个位置匹配
    expect(matches.length).toBe(3);
    expect(matches.every((m) => m.match === '')).toBe(true);
  });

  it('无匹配返回空数组', () => {
    const re = reOf('xyz', 'g');
    const matches = runMatch(re, 'abcdefg');
    expect(matches.length).toBe(0);
  });

  it('空测试文本与 g 标志下空正则的兼容', () => {
    const re = reOf('', 'g');
    const matches = runMatch(re, '');
    expect(matches.length).toBe(1);
    expect(matches[0].index).toBe(0);
  });

  it('特殊字符：换行 / 引号 / 反斜杠', () => {
    const text = 'line1\n"quoted"\t\\backslash';
    const re = reOf('[\\s"\\\\\\w]+', 'g');
    const matches = runMatch(re, text);
    expect(matches.length).toBeGreaterThan(0);
    // 整段都被吃掉
    expect(matches[0].match).toBe(text);
  });

  it('ReDoS 保护：主线程匹配数硬上限', () => {
    // 构造可能爆炸的灾难性正则与长文本，确认主线程的 runMatch 不会无限循环
    // 这里只验证「能正常返回」，Worker 阈值/超时由集成层负责
    const re = reOf('(a+)+$', 'g');
    const matches = runMatch(re, 'a'.repeat(100));
    expect(matches.length).toBe(1);
  });
});

describe('buildSegments', () => {
  it('无匹配时返回单个未匹配段', () => {
    const segments = buildSegments('hello', []);
    expect(segments.length).toBe(1);
    expect(segments[0].matched).toBe(false);
    expect((segments[0] as RegexSegment).text).toBe('hello');
  });

  it('单匹配拆分为三段（前 / 命中 / 后）', () => {
    const matches: RegexMatch[] = [
      { match: 'ell', index: 1, end: 4, groups: [], namedGroups: {} },
    ];
    const segments = buildSegments('hello', matches);
    expect(segments.map((s) => s.text)).toEqual(['h', 'ell', 'o']);
    expect(segments.map((s) => s.matched)).toEqual([false, true, false]);
  });

  it('连续相邻匹配段不插入空未匹配段', () => {
    const matches: RegexMatch[] = [
      { match: 'a', index: 0, end: 1, groups: [], namedGroups: {} },
      { match: 'b', index: 1, end: 2, groups: [], namedGroups: {} },
    ];
    const segments = buildSegments('ab', matches);
    expect(segments.map((s) => s.text)).toEqual(['a', 'b']);
    expect(segments.every((s) => s.matched)).toBe(true);
  });

  it('空文本 + 零宽匹配', () => {
    const matches: RegexMatch[] = [
      { match: '', index: 0, end: 0, groups: [], namedGroups: {} },
    ];
    const segments = buildSegments('', matches);
    // 空文本只剩一个零宽匹配段
    expect(segments.length).toBe(1);
    expect(segments[0].matched).toBe(true);
  });

  it('排序错乱的匹配区间仍能正确分段（容错）', () => {
    const matches: RegexMatch[] = [
      { match: 'b', index: 1, end: 2, groups: [], namedGroups: {} },
      { match: 'a', index: 0, end: 1, groups: [], namedGroups: {} },
    ];
    const segments = buildSegments('ab', matches);
    expect(segments.map((s) => s.text)).toEqual(['a', 'b']);
  });
});

describe('formatRegexLiteral', () => {
  it('生成可粘贴的正则字面量', () => {
    expect(formatRegexLiteral('\\d+', 'gi')).toBe('/\\d+/gi');
  });

  it('自动转义正则字面量分隔符 /', () => {
    // 正则字面量中的 / 必须转义为 \/
    expect(formatRegexLiteral('a/b', 'g')).toBe('/a\\/b/g');
  });

  it('空标志位不输出尾部斜杠后多余字符', () => {
    expect(formatRegexLiteral('foo', '')).toBe('/foo/');
  });
});

describe('常量', () => {
  it('WORKER_THRESHOLD 为 50KB', () => {
    expect(WORKER_THRESHOLD).toBe(50 * 1024);
  });
});
