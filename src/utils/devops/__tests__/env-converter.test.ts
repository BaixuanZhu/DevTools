import { describe, it, expect } from 'vitest';
import { parseEnv, MAX_INPUT_LENGTH } from '../env-converter';

describe('parseEnv - 结构规则', () => {
  it('解析单个无引号键值对', () => {
    const r = parseEnv('APP_NAME=MyApp');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toEqual([{ key: 'APP_NAME', value: 'MyApp' }]);
      expect(r.diagnostics).toEqual({ droppedComments: 0, overwrittenKeys: 0 });
    }
  });

  it('无引号值 trim 尾部空白', () => {
    const r = parseEnv('KEY=value   ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('value');
  });

  it('值中含 = 仍按首个 = 切分', () => {
    const r = parseEnv('URL=a=b=c');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('a=b=c');
  });

  it('跳过空行', () => {
    const r = parseEnv('A=1\n\nB=2\n   \n');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.map((e) => e.key)).toEqual(['A', 'B']);
  });

  it('丢弃行首注释并计数', () => {
    const r = parseEnv('# 注释1\n   # 前导空白注释\nA=1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toEqual([{ key: 'A', value: '1' }]);
      expect(r.diagnostics.droppedComments).toBe(2);
    }
  });

  it('剥离 export 前缀', () => {
    const r = parseEnv('export PORT=3000');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0]).toEqual({ key: 'PORT', value: '3000' });
  });

  it('重复 key 后者覆盖并计数', () => {
    const r = parseEnv('A=1\nA=2\nA=3');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toEqual([{ key: 'A', value: '3' }]);
      expect(r.diagnostics.overwrittenKeys).toBe(2);
    }
  });

  it('缺少 = 报错并带行号', () => {
    const r = parseEnv('A=1\nINVALID\nB=2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('第 2 行：缺少等号「=」，应为 KEY=value');
  });

  it('非法 key 报错并带行号', () => {
    const r = parseEnv('3FOO=bar');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('第 1 行：变量名「3FOO」不合法，须以字母或下划线开头，仅含字母、数字、下划线');
  });

  it('空文本返回空结果', () => {
    const r = parseEnv('');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toEqual([]);
  });

  it('超长输入返回错误', () => {
    const r = parseEnv('A='.repeat(MAX_INPUT_LENGTH));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('输入过长，已停止解析');
  });
});
