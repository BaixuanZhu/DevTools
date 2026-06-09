/**
 * JSON Diff 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import { measureMaxDepth, parseJsonSafe, countNodes, checkInputSize, semanticDiff, strictDiff, formatUnifiedDiff, type LineDiff } from '../json-diff';

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

describe('parseJsonSafe', () => {
  it('合法 JSON 返回 ok', () => {
    const result = parseJsonSafe('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ a: 1 });
    }
  });

  it('非法 JSON 返回错误及行列号', () => {
    const result = parseJsonSafe('{bad}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
      expect(result.line).toBeDefined();
    }
  });

  it('深度超过 256 拒绝解析', () => {
    let json = '';
    for (let i = 0; i < 257; i++) json += '{"a":';
    json += '1';
    for (let i = 0; i < 257; i++) json += '}';
    const result = parseJsonSafe(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('嵌套层级过深');
    }
  });
});

describe('countNodes', () => {
  it('基本类型计为 1', () => {
    expect(countNodes(42)).toBe(1);
    expect(countNodes(null)).toBe(1);
    expect(countNodes('hello')).toBe(1);
  });

  it('扁平对象按键计数', () => {
    expect(countNodes({ a: 1, b: 2, c: 3 })).toBe(3);
  });

  it('嵌套对象递归计数', () => {
    expect(countNodes({ a: { b: 1 }, c: 2 })).toBe(2);
  });

  it('数组递归计数', () => {
    expect(countNodes([1, 2, { a: 3 }])).toBe(3);
  });

  it('空对象为 0', () => {
    expect(countNodes({})).toBe(0);
  });

  it('空数组为 0', () => {
    expect(countNodes([])).toBe(0);
  });
});

describe('checkInputSize', () => {
  it('小文本返回 ok', () => {
    expect(checkInputSize('{"a":1}')).toBe('ok');
  });

  it('超大文本返回 error', () => {
    const big = 'x'.repeat(11 * 1024 * 1024);
    expect(checkInputSize(big)).toBe('error');
  });
});

describe('semanticDiff', () => {
  it('完全相同的对象无差异', () => {
    const result = semanticDiff({ a: 1 }, { a: 1 });
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(result.summary.modified).toBe(0);
  });

  it('检测新增键', () => {
    const result = semanticDiff({ a: 1 }, { a: 1, b: 2 });
    expect(result.summary.added).toBe(1);
    expect(result.items.find(i => i.type === 'added')?.path).toBe('$.b');
  });

  it('检测删除键', () => {
    const result = semanticDiff({ a: 1, b: 2 }, { a: 1 });
    expect(result.summary.removed).toBe(1);
    expect(result.items.find(i => i.type === 'removed')?.path).toBe('$.b');
  });

  it('检测修改值', () => {
    const result = semanticDiff({ a: 1 }, { a: 2 });
    expect(result.summary.modified).toBe(1);
    const item = result.items.find(i => i.type === 'modified');
    expect(item?.oldValue).toBe(1);
    expect(item?.newValue).toBe(2);
  });

  it('类型不同视为修改', () => {
    const result = semanticDiff({ a: 1 }, { a: '1' });
    expect(result.summary.modified).toBe(1);
  });

  it('null 与其他值视为不同', () => {
    const result = semanticDiff({ a: null }, { a: 1 });
    expect(result.summary.modified).toBe(1);
  });

  it('嵌套对象递归对比', () => {
    const result = semanticDiff(
      { user: { name: 'Alice', age: 30 } },
      { user: { name: 'Bob', age: 30 } },
    );
    expect(result.summary.modified).toBe(1);
    expect(result.items.find(i => i.type === 'modified')?.path).toBe('$.user.name');
  });

  it('数组默认按顺序对比', () => {
    const result = semanticDiff([1, 2, 3], [1, 3, 3]);
    expect(result.summary.modified).toBe(1);
    expect(result.items[0].path).toBe('$[1]');
  });

  it('忽略数组顺序时 [1,2] 和 [2,1] 无差异', () => {
    const result = semanticDiff([1, 2], [2, 1], { ignoreArrayOrder: true });
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(result.summary.modified).toBe(0);
  });

  it('忽略数组顺序时检测多出的元素', () => {
    const result = semanticDiff([1, 2], [1, 2, 3], { ignoreArrayOrder: true });
    expect(result.summary.added).toBe(1);
  });

  it('忽略数组顺序时检测重复元素差异', () => {
    const result = semanticDiff([1, 1, 2], [1, 2, 2], { ignoreArrayOrder: true });
    expect(result.summary.added).toBe(1);
    expect(result.summary.removed).toBe(1);
  });

  it('空对象与空对象无差异', () => {
    const result = semanticDiff({}, {});
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
  });

  it('基本类型相同无差异', () => {
    const result = semanticDiff(42, 42);
    expect(result.summary.modified).toBe(0);
  });

  it('基本类型不同为修改', () => {
    const result = semanticDiff('hello', 'world');
    expect(result.summary.modified).toBe(1);
  });
});

describe('strictDiff', () => {
  it('完全相同的文本无差异', () => {
    const result = strictDiff('{"a":1}', '{"a":1}');
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
  });

  it('检测修改行', () => {
    const left = '{"name": "Alice"}';
    const right = '{"name": "Bob"}';
    const result = strictDiff(left, right);
    expect(result.summary.removed).toBeGreaterThanOrEqual(1);
    expect(result.summary.added).toBeGreaterThanOrEqual(1);
  });

  it('检测新增行', () => {
    const left = '{"a": 1}';
    const right = '{"a": 1,\n"b": 2}';
    const result = strictDiff(left, right);
    expect(result.summary.added).toBeGreaterThanOrEqual(1);
  });

  it('检测删除行', () => {
    const left = '{"a": 1,\n"b": 2}';
    const right = '{"a": 1}';
    const result = strictDiff(left, right);
    expect(result.summary.removed).toBeGreaterThanOrEqual(1);
  });

  it('行号正确分配', () => {
    const left = '{\n  "a": 1\n}';
    const right = '{\n  "a": 2\n}';
    const result = strictDiff(left, right);
    const removed = result.lines.filter(l => l.type === 'removed');
    const added = result.lines.filter(l => l.type === 'added');
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
    expect(removed[0].leftLineNo).toBeDefined();
    expect(added[0].rightLineNo).toBeDefined();
  });

  it('空内容无差异', () => {
    const result = strictDiff('', '');
    expect(result.lines.length).toBe(0);
  });
});

describe('formatUnifiedDiff', () => {
  it('生成标准 unified diff 头部', () => {
    const lines: LineDiff[] = [
      { type: 'unchanged', leftLineNo: 1, rightLineNo: 1, content: '{' },
      { type: 'removed', leftLineNo: 2, content: '  "name": "Alice"' },
      { type: 'added', rightLineNo: 2, content: '  "name": "Bob"' },
      { type: 'unchanged', leftLineNo: 3, rightLineNo: 3, content: '}' },
    ];
    const result = formatUnifiedDiff(lines);
    expect(result).toContain('--- left.json');
    expect(result).toContain('+++ right.json');
    expect(result).toContain('-  "name": "Alice"');
    expect(result).toContain('+  "name": "Bob"');
  });

  it('空差异返回空字符串', () => {
    const result = formatUnifiedDiff([]);
    expect(result).toBe('');
  });
});
