import { describe, it, expect } from 'vitest';
import { parseEnv, MAX_INPUT_LENGTH, envTextToJson, jsonToEnvText } from '../env-converter';

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

describe('parseEnv - 引号与转义', () => {
  it('双引号内转义 \\n \\t \\\\ \\" \\$', () => {
    const r = parseEnv('A="1\\n2\\t3\\\\4\\"5\\$6"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('1\n2\t3\\4"5$6');
  });

  it('非法转义保留原样（含反斜杠）', () => {
    const r = parseEnv('A="x\\qy"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('x\\qy');
  });

  it('单引号内全字面量（不转义不插值）', () => {
    const r = parseEnv("A='${B}\\n$C'");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('${B}\\n$C');
  });

  it('双引号未闭合报错带行号', () => {
    const r = parseEnv('A="unterminated');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('第 1 行：双引号未闭合');
  });

  it('单引号未闭合报错带行号', () => {
    const r = parseEnv("A='unterminated");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('第 1 行：单引号未闭合');
  });

  it('无引号值不转义反斜杠（Windows 路径）', () => {
    const r = parseEnv('PATH=C:\\Windows\\System32');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('C:\\Windows\\System32');
  });
});

describe('parseEnv - 变量插值', () => {
  it('双引号内 ${VAR} 引用上方变量', () => {
    const r = parseEnv('USER=admin\nURL="u:${USER}"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[1].value).toBe('u:admin');
  });

  it('双引号内 $VAR 引用上方变量', () => {
    const r = parseEnv('PORT=3000\nD=":$PORT"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[1].value).toBe(':3000');
  });

  it('未定义变量保留原样', () => {
    const r = parseEnv('A="x:${MISSING}y"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('x:${MISSING}y');
  });

  it('仅引用上方：后方定义不回改', () => {
    const r = parseEnv('A="${B}"\nB=later');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result[0].value).toBe('${B}');
      expect(r.result[1].value).toBe('later');
    }
  });

  it('无引号值也支持插值', () => {
    const r = parseEnv('HOST=localhost\nURL=$HOST:8080');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[1].value).toBe('localhost:8080');
  });

  it('双引号内 \\$ 为字面美元（不插值）', () => {
    const r = parseEnv('A="price: \\$5"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('price: $5');
  });

  it('裸 $ 后非变量名字符视为字面 $', () => {
    const r = parseEnv('A="cost $$ total"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result[0].value).toBe('cost $$ total');
  });
});

describe('envTextToJson', () => {
  it('美化输出（2 空格缩进）并保留顺序', () => {
    const r = envTextToJson('B=2\nA=1', 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('{\n  "B": "2",\n  "A": "1"\n}');
  });

  it('紧凑输出（indent=0）', () => {
    const r = envTextToJson('A=1\nB=2', 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('{"A":"1","B":"2"}');
  });

  it('默认 indent 为美化', () => {
    const r = envTextToJson('A=1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('{\n  "A": "1"\n}');
  });

  it('附带诊断（注释与重复键）', () => {
    const r = envTextToJson('# c\nA=1\nA=2', 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.diagnostics).toEqual({ droppedComments: 1, overwrittenKeys: 1 });
  });

  it('透传解析错误', () => {
    const r = envTextToJson('3FOO=bad');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('变量名');
  });

  it('插值结果进入 JSON', () => {
    const r = envTextToJson('U=admin\nURL="${U}:80"', 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('"URL": "admin:80"');
  });
});

describe('jsonToEnvText', () => {
  it('简单值不加引号', () => {
    const r = jsonToEnvText('{"A":"1","B":"hello"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('A=1\nB=hello');
  });

  it('含空格加双引号', () => {
    const r = jsonToEnvText('{"A":"hello world"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('A="hello world"');
  });

  it('空字符串加双引号', () => {
    const r = jsonToEnvText('{"E":""}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('E=""');
  });

  it('含 # $ " 加双引号并转义', () => {
    const r = jsonToEnvText('{"A":"a#b$c\\"d"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('A="a#b\\$c\\"d"');
  });

  it('非字符串值 String() 化', () => {
    const r = jsonToEnvText('{"PORT":3000,"DEBUG":true,"FLAG":null}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('PORT=3000\nDEBUG=true\nFLAG=null');
  });

  it('保留 JSON key 顺序', () => {
    const r = jsonToEnvText('{"Z":1,"A":2,"M":3}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('Z=1\nA=2\nM=3');
  });

  it('嵌套对象报错', () => {
    const r = jsonToEnvText('{"db":{"host":"h"}}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('键「db」的值为对象，.env 仅支持扁平键值对');
  });

  it('数组值报错', () => {
    const r = jsonToEnvText('{"list":[1,2]}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('键「list」的值为数组，.env 仅支持扁平键值对');
  });

  it('JSON 语法错误透传', () => {
    const r = jsonToEnvText('{invalid}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('JSON 语法错误');
  });

  it('顶层非对象报错', () => {
    const r = jsonToEnvText('[1,2,3]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('顶层须为对象');
  });

  it('含单引号加双引号', () => {
    const r = jsonToEnvText('{"A":"it\'s"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('A="it\'s"');
  });

  it('含真实换行转义为 \\n（闭合往返）', () => {
    const r = jsonToEnvText('{"A":"a\\nb"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('A="a\\nb"');
  });
});
