# 环境变量转换器（env-converter）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/devops/env-converter` 工具，实现 `.env` 文本与 JSON 的双向转换（含引号、转义、同文件变量插值、注释剥离），纯浏览器端运算、零第三方依赖。

**Architecture:** 自研逐行状态机解析器（`src/utils/devops/env-converter.ts`，纯函数 + Result 模式），UI 复用 `DockerConverter.vue` 的左右双向双框范式（`watch` 双向触发 + `convertingFrom` 防 watch 循环 + 交换按钮 + 状态栏）。不引入 dotenv 等库。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">` + Tailwind v4 + vitest。相对路径 import（无别名）。测试命令 `pnpm test`（即 `vitest run`）。

## Global Constraints

- **路径无别名**：所有 import 用相对路径（如 `../../utils/devops/env-converter`）
- **id === path 末段**：`id: 'env-converter'`、`path: '/devops/env-converter'`（否则 FAQ/相关工具/SEO 结构化数据静默失效）
- **安全规则**：禁用 `eval()` / `Function()`；正则用 `new RegExp` 或字面量并包裹 try-catch
- **注释规则**：公共类/接口/函数必须写 JSDoc/TSDoc；中文错误提示带行号
- **零新依赖**：不引入 dotenv / dotenv-parser 等库，纯自研解析
- **输入软上限**：500KB（`MAX_INPUT_LENGTH = 500_000`）
- **单工具 JS（gzip）< 50KB**

参考既有范式：`src/tools/devops/DockerConverter.vue`（双向双框 + 交换）、`src/utils/docker/`（纯函数 + `__tests__/`）、`src/composables/useCopy.ts`（`{ copy }`）、`src/components/ui/CodePanel.vue`（`label`/`show-clear`/`show-copy`/`copy-text`/`@clear`）、`src/components/layout/ResponsiveWorkspace.vue`（`mode="horizontal"` + `#actions`/`#input`/`#output` slot）。

---

## Task 1: `parseEnv` 框架 + 无引号值 + 结构规则

**Files:**
- Create: `src/utils/devops/env-converter.ts`
- Test: `src/utils/devops/__tests__/env-converter.test.ts`

**Interfaces:**
- Produces: `EnvEntry`、`EnvDiagnostics`、`EnvParseResult`、`MAX_INPUT_LENGTH`、`parseEnv(text: string): EnvParseResult`。本任务 `parseValue` 仅处理无引号（原样 `trim`），Task 2 替换其内部实现为完整版（引号 + 转义 + 插值）；`parseEnv` 主体在本任务定稿后不再变动。

- [ ] **Step 1: 写失败测试**

创建 `src/utils/devops/__tests__/env-converter.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: FAIL —— 模块 `../env-converter` 不存在。

- [ ] **Step 3: 写最小实现**

创建 `src/utils/devops/env-converter.ts`：

```ts
/**
 * 环境变量转换器核心模块。
 *
 * 提供 .env 文本与 JSON 之间的解析与序列化，全部为纯函数。
 * 解析采用逐行扫描 + 引号感知状态机，不依赖第三方库。
 */

/** 输入文本软上限（字节），超过则短路返回错误 */
export const MAX_INPUT_LENGTH = 500_000;

/** 单个键值对（保留 .env 中的定义顺序） */
export interface EnvEntry {
  key: string;
  value: string;
}

/** 解析诊断（用于状态栏提示） */
export interface EnvDiagnostics {
  /** 丢弃的注释行数 */
  droppedComments: number;
  /** 被覆盖的重复 key 数量 */
  overwrittenKeys: number;
}

/** 解析成功 */
export interface EnvParseSuccess {
  ok: true;
  result: EnvEntry[];
  diagnostics: EnvDiagnostics;
}

/** 解析失败（中文错误，含行号） */
export interface EnvParseFailure {
  ok: false;
  error: string;
}

/** parseEnv 返回类型 */
export type EnvParseResult = EnvParseSuccess | EnvParseFailure;

/** 合法变量名：字母或下划线开头，后接字母/数字/下划线 */
const KEY_PATTERN = /^[A-Za-z_]\w*$/;

/** 整行注释：行首或仅前导空白后跟 # */
const COMMENT_PATTERN = /^\s*#/;

/**
 * 解析单行的值部分。
 *
 * 本版本仅处理无引号值（原样 trim），引号 / 转义 / 插值在后续扩展。
 * @param raw - 等号右侧的原始文本
 * @param _vars - 已解析变量表（本版本未使用，预留插值扩展）
 * @param _lineNum - 当前行号（本版本未使用，预留错误定位）
 * @returns 解析后的值，或错误
 */
function parseValue(
  raw: string,
  _vars: Map<string, string>,
  _lineNum: number,
): { value: string } | { error: string } {
  void _vars;
  void _lineNum;
  return { value: raw.trim() };
}

/**
 * 将 .env 文本解析为有序键值对列表。
 *
 * 处理空行、注释剥离、export 前缀、key 校验、重复 key 覆盖。
 * @param text - .env 文本
 * @returns 解析结果（含诊断）或中文错误（带行号）
 */
export function parseEnv(text: string): EnvParseResult {
  if (text.length > MAX_INPUT_LENGTH) {
    return { ok: false, error: '输入过长，已停止解析' };
  }

  const lines = text.split(/\r\n|\r|\n/);
  const entries: EnvEntry[] = [];
  const index = new Map<string, number>(); // key -> entries 数组下标
  const vars = new Map<string, string>(); // 已解析变量（供插值使用）
  const diagnostics: EnvDiagnostics = { droppedComments: 0, overwrittenKeys: 0 };

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    if (line.trim() === '') continue;

    if (COMMENT_PATTERN.test(line)) {
      diagnostics.droppedComments++;
      continue;
    }

    // 剥离可选的 export 前缀与前导空白
    let content = line.replace(/^\s+/, '').replace(/^export\s+/, '');

    const eq = content.indexOf('=');
    if (eq === -1) {
      return { ok: false, error: `第 ${lineNum} 行：缺少等号「=」，应为 KEY=value` };
    }

    const key = content.slice(0, eq).trim();
    const valueRaw = content.slice(eq + 1);

    if (!KEY_PATTERN.test(key)) {
      return {
        ok: false,
        error: `第 ${lineNum} 行：变量名「${key}」不合法，须以字母或下划线开头，仅含字母、数字、下划线`,
      };
    }

    const parsed = parseValue(valueRaw, vars, lineNum);
    if ('error' in parsed) {
      return { ok: false, error: parsed.error };
    }

    vars.set(key, parsed.value);
    const existing = index.get(key);
    if (existing !== undefined) {
      entries[existing].value = parsed.value;
      diagnostics.overwrittenKeys++;
    } else {
      index.set(key, entries.length);
      entries.push({ key, value: parsed.value });
    }
  }

  return { ok: true, result: entries, diagnostics };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: PASS（11 个用例全过）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/devops/env-converter.ts src/utils/devops/__tests__/env-converter.test.ts
git commit -m "feat(env-converter): 新增 parseEnv 框架与结构规则解析"
```

---

## Task 2: `parseValue` 引号 / 转义 / 插值完整版

**Files:**
- Modify: `src/utils/devops/env-converter.ts`（替换 `parseValue` 实现 + 新增 `parseDoubleQuoted` / `readInterpolation` / `interpolate` 辅助函数）
- Test: `src/utils/devops/__tests__/env-converter.test.ts`（新增 describe 块）

**Interfaces:**
- Consumes: Task 1 的 `parseEnv`（主体不变，仅 `parseValue` 内部替换）
- Produces: `parseEnv` 现正确处理双引号转义、单引号字面、`${VAR}`/`$VAR` 插值、引号未闭合错误

- [ ] **Step 1: 追加失败测试**

在 `env-converter.test.ts` 末尾追加：

```ts
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
```

- [ ] **Step 2: 跑测试确认新增用例失败**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: FAIL —— 新增的引号/插值用例不通过（当前 `parseValue` 原样返回，未去引号未插值）。

- [ ] **Step 3: 替换 `parseValue` 实现并新增辅助函数**

将 `env-converter.ts` 中的 `parseValue` 函数**整体替换**为下方版本，并在其上方插入三个辅助函数：

```ts
/** 合法变量名片段（用于 $VAR 匹配） */
const VAR_NAME_PATTERN = /^[A-Za-z_]\w*/;

/**
 * 从指定位置（指向 `$`）读取一次插值并替换。
 *
 * 规则：
 * - `${NAME}`：命中已解析值则替换，否则原样保留 `${NAME}`
 * - `$NAME`（NAME 为合法变量名）：同上
 * - 裸 `$`（后非变量名字符）：字面 `$`
 *
 * 仅查询已解析表，未命中不报错（保留原样）。
 * @param text - 原始文本
 * @param pos - `$` 所在下标
 * @param vars - 已解析变量表
 * @returns 替换后的字符串与消耗的字符数
 */
function readInterpolation(
  text: string,
  pos: number,
  vars: Map<string, string>,
): { value: string; consumed: number } {
  // ${VAR}
  if (text[pos + 1] === '{') {
    const end = text.indexOf('}', pos + 2);
    if (end === -1) return { value: '$', consumed: 1 }; // 未闭合，按字面 $
    const name = text.slice(pos + 2, end);
    if (!KEY_PATTERN.test(name)) return { value: '$', consumed: 1 }; // 非法名，按字面 $
    const found = vars.get(name);
    return {
      value: found !== undefined ? found : text.slice(pos, end + 1),
      consumed: end + 1 - pos,
    };
  }
  // $VAR
  const match = VAR_NAME_PATTERN.exec(text.slice(pos + 1));
  if (match) {
    const name = match[0];
    const found = vars.get(name);
    return {
      value: found !== undefined ? found : `$${name}`,
      consumed: 1 + name.length,
    };
  }
  // 裸 $
  return { value: '$', consumed: 1 };
}

/**
 * 对无引号文本做插值（不转义反斜杠）。
 * @param text - 已 trim 的无引号值
 * @param vars - 已解析变量表
 * @returns 插值后的值
 */
function interpolate(text: string, vars: Map<string, string>): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$') {
      const r = readInterpolation(text, i, vars);
      out += r.value;
      i += r.consumed;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

/**
 * 解析双引号包裹的值（含转义与插值）。
 *
 * 起始字符 `text[0]` 必须为 `"`。返回到闭合 `"` 为止的值。
 * @param text - 以 `"` 开头的原始片段
 * @param vars - 已解析变量表
 * @param lineNum - 当前行号
 * @returns 解析后的值，或未闭合错误
 */
function parseDoubleQuoted(
  text: string,
  vars: Map<string, string>,
  lineNum: number,
): { value: string } | { error: string } {
  let out = '';
  let i = 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const next = text[i + 1];
      if (next === 'n') { out += '\n'; i += 2; }
      else if (next === 't') { out += '\t'; i += 2; }
      else if (next === 'r') { out += '\r'; i += 2; }
      else if (next === '\\') { out += '\\'; i += 2; }
      else if (next === '"') { out += '"'; i += 2; }
      else if (next === '$') { out += '$'; i += 2; }
      else { out += '\\'; i += 1; } // 非法转义：保留反斜杠
    } else if (ch === '"') {
      return { value: out };
    } else if (ch === '$') {
      const r = readInterpolation(text, i, vars);
      out += r.value;
      i += r.consumed;
    } else {
      out += ch;
      i += 1;
    }
  }
  return { error: `第 ${lineNum} 行：双引号未闭合` };
}

/**
 * 解析单行的值部分（支持双引号 / 单引号 / 无引号）。
 *
 * - 双引号：转义 `\n \t \r \\ \" \$` + 插值
 * - 单引号：全字面量（不转义、不插值）
 * - 无引号：trim 尾部空白 + 插值，不转义反斜杠
 * @param raw - 等号右侧的原始文本
 * @param vars - 已解析变量表
 * @param lineNum - 当前行号
 * @returns 解析后的值，或错误（带行号）
 */
function parseValue(
  raw: string,
  vars: Map<string, string>,
  lineNum: number,
): { value: string } | { error: string } {
  const trimmed = raw.replace(/^\s+/, '');

  if (trimmed[0] === "'") {
    const end = trimmed.indexOf("'", 1);
    if (end === -1) return { error: `第 ${lineNum} 行：单引号未闭合` };
    return { value: trimmed.slice(1, end) };
  }

  if (trimmed[0] === '"') {
    return parseDoubleQuoted(trimmed, vars, lineNum);
  }

  return { value: interpolate(raw.trim(), vars) };
}
```

- [ ] **Step 4: 跑测试确认全部通过**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: PASS（Task 1 + Task 2 全部用例）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/devops/env-converter.ts src/utils/devops/__tests__/env-converter.test.ts
git commit -m "feat(env-converter): parseValue 支持引号/转义/同文件插值"
```

---

## Task 3: `envTextToJson`（.env → JSON 序列化）

**Files:**
- Modify: `src/utils/devops/env-converter.ts`（新增 `EnvToJsonResult` 类型 + `envTextToJson` 函数）
- Test: `src/utils/devops/__tests__/env-converter.test.ts`（新增 describe 块）

**Interfaces:**
- Consumes: Task 1/2 的 `parseEnv`
- Produces: `envTextToJson(text: string, indent?: number): EnvToJsonResult`，`indent=2` 美化（默认）、`0` 紧凑；附带 `diagnostics`

- [ ] **Step 1: 追加失败测试**

在 `env-converter.test.ts` 末尾追加：

```ts
import { envTextToJson } from '../env-converter';

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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: FAIL —— `envTextToJson` 未导出。

- [ ] **Step 3: 实现 `envTextToJson`**

在 `env-converter.ts` 的 `parseEnv` 之后追加：

```ts
/** envTextToJson 成功 */
export interface EnvToJsonSuccess {
  ok: true;
  result: string;
  diagnostics: EnvDiagnostics;
}

/** envTextToJson 返回类型（失败复用 EnvParseFailure） */
export type EnvToJsonResult = EnvToJsonSuccess | EnvParseFailure;

/**
 * 将 .env 文本转换为 JSON 字符串。
 *
 * 注释丢弃、key 顺序保留、值已完成插值。
 * @param text - .env 文本
 * @param indent - 缩进空格数；2 为美化（默认），0 为紧凑
 * @returns JSON 字符串（含诊断）或中文错误
 */
export function envTextToJson(text: string, indent: number = 2): EnvToJsonResult {
  const parsed = parseEnv(text);
  if (!parsed.ok) return parsed;

  const obj: Record<string, string> = {};
  for (const entry of parsed.result) {
    obj[entry.key] = entry.value;
  }

  return {
    ok: true,
    result: JSON.stringify(obj, null, indent === 0 ? 0 : 2),
    diagnostics: parsed.diagnostics,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/devops/env-converter.ts src/utils/devops/__tests__/env-converter.test.ts
git commit -m "feat(env-converter): 新增 envTextToJson 序列化与美化/紧凑输出"
```

---

## Task 4: `jsonToEnvText`（JSON → .env 序列化）

**Files:**
- Modify: `src/utils/devops/env-converter.ts`（新增 `JsonToEnvResult` 类型 + `quoteValue` + `jsonToEnvText` 函数）
- Test: `src/utils/devops/__tests__/env-converter.test.ts`（新增 describe 块）

**Interfaces:**
- Produces: `jsonToEnvText(jsonText: string): JsonToEnvResult`；含引号策略、转义、嵌套/数组报错、非字符串值 `String()` 化、key 顺序保留

- [ ] **Step 1: 追加失败测试**

在 `env-converter.test.ts` 末尾追加：

```ts
import { jsonToEnvText } from '../env-converter';

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
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: FAIL —— `jsonToEnvText` 未导出。

- [ ] **Step 3: 实现 `jsonToEnvText` 与 `quoteValue`**

在 `env-converter.ts` 的 `envTextToJson` 之后追加：

```ts
/** 需要加双引号的特征：空白、#、"、'、$ */
const NEED_QUOTE_PATTERN = /[\s#"'\$]/;

/** jsonToEnvText 成功 */
export interface JsonToEnvSuccess {
  ok: true;
  result: string;
}

/** jsonToEnvText 返回类型（失败复用 EnvParseFailure） */
export type JsonToEnvResult = JsonToEnvSuccess | EnvParseFailure;

/**
 * 按 .env 引号策略包装值。
 *
 * 含空白 / # / " / ' / $ 或为空时加双引号，并转义内部的 \\ " $。
 * @param value - 已字符串化的值
 * @returns .env 行右侧文本
 */
function quoteValue(value: string): string {
  if (value === '' || NEED_QUOTE_PATTERN.test(value)) {
    const escaped = value.replace(/[\\"]|\$/g, (m) => `\\${m}`);
    return `"${escaped}"`;
  }
  return value;
}

/**
 * 将 JSON 文本转换为 .env 文本。
 *
 * 仅支持扁平键值对；对象 / 数组值、非对象顶层报错。
 * key 顺序按 JSON 解析后的对象顺序保留。
 * @param jsonText - JSON 文本
 * @returns .env 文本或中文错误
 */
export function jsonToEnvText(jsonText: string): JsonToEnvResult {
  if (jsonText.length > MAX_INPUT_LENGTH) {
    return { ok: false, error: '输入过长，已停止解析' };
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `JSON 语法错误：${msg}` };
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'JSON 顶层须为对象（键值对集合），.env 仅支持扁平键值对' };
  }

  const obj = data as Record<string, unknown>;
  const lines: string[] = [];
  for (const key of Object.keys(obj)) {
    const rawVal = obj[key];
    if (rawVal !== null && typeof rawVal === 'object') {
      const kind = Array.isArray(rawVal) ? '数组' : '对象';
      return { ok: false, error: `键「${key}」的值为${kind}，.env 仅支持扁平键值对` };
    }
    lines.push(`${key}=${quoteValue(String(rawVal))}`);
  }

  return { ok: true, result: lines.join('\n') };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/utils/devops/__tests__/env-converter.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 跑全量测试确认无回归**

Run: `pnpm test`
Expected: PASS（全站测试通过，含本工具所有用例）。

- [ ] **Step 6: 提交**

```bash
git add src/utils/devops/env-converter.ts src/utils/devops/__tests__/env-converter.test.ts
git commit -m "feat(env-converter): 新增 jsonToEnvText 反向序列化与引号策略"
```

---

## Task 5: `EnvConverter.vue` 双向双框组件

**Files:**
- Create: `src/tools/devops/EnvConverter.vue`

**Interfaces:**
- Consumes: Task 1–4 的 `envTextToJson` / `jsonToEnvText` / `EnvDiagnostics`；`useCopy`；`ToolHeader` / `ResponsiveWorkspace` / `CodePanel`
- Produces: 默认导出的 Vue 组件，左右双向可编辑、实时互转、交换、清空、复制、JSON 美化/紧凑切换、状态栏提示

> 本任务为 UI 组件，以构建通过 + 手动验证为准（无单元测试）。先确保 `pnpm build` 的类型检查通过。

- [ ] **Step 1: 创建组件**

创建 `src/tools/devops/EnvConverter.vue`：

```vue
<script setup lang="ts">
/**
 * 环境变量转换主组件。
 *
 * 提供左右双输入区：左侧编辑 .env 文本，右侧实时输出 JSON；
 * 右侧编辑 JSON，左侧实时输出 .env 文本。
 * 通过交换按钮可快速互换两侧内容。
 */
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { useCopy } from '../../composables/useCopy';
import {
  envTextToJson,
  jsonToEnvText,
  type EnvDiagnostics,
} from '../../utils/devops/env-converter';

/** .env 默认示例 */
const DEFAULT_ENV_INPUT = `# 应用配置
APP_NAME=MyApp
DB_USER=admin
DATABASE_URL="postgres://user:${DB_USER}@host"
export PORT=3000
GREETING="Hello\\nWorld"
EMPTY=""`;

/** 左侧：.env 文本 */
const leftValue = ref(DEFAULT_ENV_INPUT);
/** 右侧：JSON 文本 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** .env → JSON 的诊断信息 */
const diagnostics = ref<EnvDiagnostics | null>(null);
/** JSON 输出缩进：2 美化 / 0 紧凑 */
const jsonIndent = ref<2 | 0>(2);
/** 当前正在执行转换的方向，用于防止 watch 循环触发 */
const convertingFrom = ref<'left' | 'right' | null>(null);
/** 交换操作标志，用于跳过 watch 触发 */
const isSwapping = ref(false);

const { copy } = useCopy();

/**
 * 将左侧 .env 转换为右侧 JSON。
 */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    diagnostics.value = null;
    return;
  }

  const result = envTextToJson(leftValue.value, jsonIndent.value);
  if (result.ok) {
    rightValue.value = result.result;
    diagnostics.value = result.diagnostics;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/**
 * 将右侧 JSON 转换为左侧 .env。
 */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    diagnostics.value = null;
    return;
  }

  const result = jsonToEnvText(rightValue.value);
  if (result.ok) {
    leftValue.value = result.result;
    diagnostics.value = null;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** 监听左侧变化 */
watch(leftValue, () => {
  if (isSwapping.value || convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  convertingFrom.value = null;
});

/** 监听右侧变化 */
watch(rightValue, () => {
  if (isSwapping.value || convertingFrom.value === 'left') return;
  convertingFrom.value = 'right';
  convertRightToLeft();
  convertingFrom.value = null;
});

/** 监听 JSON 缩进变化，重新生成右侧 */
watch(jsonIndent, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  convertingFrom.value = null;
});

/**
 * 交换两侧内容。
 * 交换时不触发自动转换，由用户后续编辑触发。
 */
function handleSwap(): void {
  isSwapping.value = true;
  const temp = leftValue.value;
  leftValue.value = rightValue.value;
  rightValue.value = temp;
  nextTick(() => {
    isSwapping.value = false;
  });
}

/**
 * 清空两侧输入和错误状态。
 */
function handleClear(): void {
  leftValue.value = '';
  rightValue.value = '';
  errorMsg.value = '';
  diagnostics.value = null;
}

/** 组件挂载时执行初始转换 */
onMounted(() => {
  convertLeftToRight();
});

/** 诊断提示文案 */
const diagnosticsHint = computed(() => {
  if (!diagnostics.value) return '';
  const parts: string[] = [];
  if (diagnostics.value.droppedComments > 0) {
    parts.push(`已丢弃 ${diagnostics.value.droppedComments} 条注释`);
  }
  if (diagnostics.value.overwrittenKeys > 0) {
    parts.push(`覆盖 ${diagnostics.value.overwrittenKeys} 个重复键`);
  }
  return parts.join(' · ');
});
</script>

<template>
  <div>
    <ToolHeader
      title="环境变量转换"
      description=".env 配置与 JSON 双向互转，支持引号、转义与同文件变量插值"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1.5 text-[0.8125rem] text-muted cursor-pointer">
            <span>JSON 格式</span>
            <select
              v-model.number="jsonIndent"
              class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] outline-none focus:border-accent cursor-pointer"
              aria-label="JSON 输出格式"
            >
              <option :value="2">美化</option>
              <option :value="0">紧凑</option>
            </select>
          </label>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm bg-card text-muted text-[0.8125rem] cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
            @click="handleSwap"
          >
            <span>⇄</span>
            <span>交换</span>
          </button>
        </div>
      </template>

      <template #input>
        <CodePanel
          label=".env"
          show-clear
          show-copy
          :copy-text="leftValue"
          @clear="handleClear"
        >
          <textarea
            v-model="leftValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="14"
            placeholder="输入 .env 文本..."
            spellcheck="false"
          ></textarea>
        </CodePanel>
      </template>

      <template #output>
        <CodePanel
          label="JSON"
          show-clear
          show-copy
          :copy-text="rightValue"
          @clear="handleClear"
        >
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="14"
            placeholder="输入 JSON 文本..."
            spellcheck="false"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
      <p v-if="diagnosticsHint" class="text-[0.75rem] text-muted m-0 mt-1">{{ diagnosticsHint }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 构建确认类型检查通过**

Run: `pnpm build`
Expected: 构建成功，无 TypeScript 错误。若提示找不到 `./EnvConverter.vue`（页面尚未创建），先执行 Task 6 Step 1 创建页面再构建。

- [ ] **Step 3: 提交**

```bash
git add src/tools/devops/EnvConverter.vue
git commit -m "feat(env-converter): 新增双向双框转换 Vue 组件"
```

---

## Task 6: 页面 + 注册 + FAQ + ROADMAP 收尾

**Files:**
- Create: `src/pages/devops/env-converter.astro`
- Modify: `src/data/tools.ts`（在 `docker-converter` 条目后插入 `env-converter`）
- Modify: `src/data/tool-faqs.ts`（新增 `'env-converter'` 条目）
- Modify: `docs/ROADMAP.md`（勾选 P3 条目 + 头部日期）

**Interfaces:**
- Consumes: Task 5 的 `EnvConverter.vue`；现有 `ToolLayout`
- Produces: 可访问的 `/devops/env-converter` 页面 + 完整 SEO 注册 + 4 条 FAQ + ROADMAP 标记完成

- [ ] **Step 1: 创建页面**

创建 `src/pages/devops/env-converter.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import EnvConverter from '../../tools/devops/EnvConverter.vue';
---

<ToolLayout toolId="devops/env-converter">
  <EnvConverter client:idle />
</ToolLayout>
```

- [ ] **Step 2: 在 `src/data/tools.ts` 注册**

在 `docker-converter` 条目（`relatedToolIds: ['json-to-yaml'],` 之后、下一个 `{` 之前）插入：

```ts
  {
    id: 'env-converter',
    name: '环境变量转换器',
    description: '.env 配置与 JSON 双向互转，支持引号、转义与同文件变量插值',
    seoDescription: '在线 .env 与 JSON 互转工具，支持单双引号、转义字符与同文件变量插值，注释自动剥离并提示数量，纯浏览器端解析数据不上传，前后端环境变量配置转换必备。',
    category: 'DevOps 工具',
    icon: '⚙️',
    path: '/devops/env-converter',
    keywords: ['env 转 json', 'json 转 env', '环境变量转换', 'dotenv 解析', 'env 在线转换', '.env 配置转换', '环境变量 json 互转', 'env to json'],
    relatedToolIds: ['docker-converter', 'json-formatter'],
  },
```

- [ ] **Step 3: 在 `src/data/tool-faqs.ts` 新增 4 条 FAQ**

在 `'docker-converter'` 数组之后插入新条目（与 docker 同级缩进）：

```ts
  'env-converter': [
    {
      question: '`.env` 里的注释会保留到 JSON 吗？',
      answer: '不会。标准 JSON 不支持注释，转换时 <code>#</code> 注释会被丢弃，状态栏会显示「已丢弃 N 条注释」提示数量，避免静默丢失。',
    },
    {
      question: '支持变量插值吗？',
      answer: '支持 <code>${VAR}</code> / <code>$VAR</code> 引用<strong>同一文件中上方</strong>已定义的变量；未定义的保留原样不报错。不支持 <code>${VAR:-default}</code> 等 shell 进阶语法。',
    },
    {
      question: 'JSON 里有嵌套对象怎么办？',
      answer: '<code>.env</code> 格式仅支持扁平键值对，遇到对象或数组值会报错提示。如 <code>DATABASE__HOST</code> 这类双下划线写法会被当作普通 key 原样保留，不自动展开为嵌套结构。',
    },
    {
      question: '生成的 `.env` 值什么时候会加引号？',
      answer: '当值包含空格、<code>#</code>、<code>"</code>、<code>\'</code>、<code>$</code> 或为空字符串时自动加双引号，并转义内部的 <code>"</code> <code>\\</code> <code>$</code>；其余情况输出不加引号的简洁形式。',
    },
  ],
```

- [ ] **Step 4: 更新 `docs/ROADMAP.md`**

4a. 头部「最后更新」行改为：

```
> - **最后更新**：2026-06-20
```

4b. §三 P3 表格中 DevOps 行（约 117 行）末尾加 ✅：

```
| DevOps 工具 | 环境变量转换器 | `.env` 文本 ⇄ JSON 互转，说明引号/转义/注释保留规则 | 1.5d ✅ |
```

4c. §六进度追踪 P3 中（约 184 行）：

```
- [x] DevOps 工具：环境变量转换器 — 已完成（2026-06-20）。新建 `/devops/env-converter`，自研逐行状态机解析（`utils/devops/env-converter.ts`，零依赖），.env ⇄ JSON 双向转换，支持双/单/无引号、双引号内 `\n \t \r \\ \" \$` 转义、同文件 `${VAR}`/`$VAR` 插值（仅引用上方、未定义保留原样）、注释剥离计数、重复 key 覆盖计数；标准 JSON 注释丢弃并状态栏提示；JSON→.env 智能引号 + 嵌套/数组报错；配套 4 条 FAQ。P3 仅剩 API（HTTP 请求测试器）
```

- [ ] **Step 5: 全量构建 + 测试确认**

Run: `pnpm test && pnpm build`
Expected: 全部测试通过、构建成功、无类型错误。

- [ ] **Step 6: 手动验证（开发服务器）**

Run: `pnpm dev`，浏览器打开 `http://localhost:4321/devops/env-converter`

逐项核对：
- [ ] 默认示例加载后右侧自动生成美化 JSON，`${DB_USER}` 替换为 `admin`
- [ ] 状态栏显示「已丢弃 1 条注释」
- [ ] 左侧编辑实时同步右侧；右侧编辑 JSON 实时同步左侧
- [ ] 切换「紧凑」后右侧变为单行 JSON
- [ ] 点「交换」两侧内容互换且不触发转换抖动
- [ ] 点「清空」两侧清空
- [ ] 复制按钮工作（.env 侧 / JSON 侧）
- [ ] 左侧输入非法 key（如 `3FOO=x`）显示带行号错误
- [ ] 右侧输入嵌套对象 JSON 显示「键…的值为对象」错误

- [ ] **Step 7: 提交**

```bash
git add src/pages/devops/env-converter.astro src/data/tools.ts src/data/tool-faqs.ts docs/ROADMAP.md
git commit -m "feat(env-converter): 注册工具页面、SEO 与 FAQ，更新 ROADMAP"
```

---

## 验收总清单（对照 spec §8）

- [ ] `env-converter.ts` 纯函数 + 单测通过（Tasks 1–4，`pnpm test`）
- [ ] 页面 `/devops/env-converter` 可访问，`client:idle` 水合（Task 6）
- [ ] 左右双向双框可编辑，实时互转，无 watch 循环（Task 5）
- [ ] 交换 / 清空 / 复制 + Toast 反馈（Task 5）
- [ ] JSON 美化 / 紧凑切换生效（Task 5）
- [ ] 引号 / 转义 / 同文件插值 / 注释剥离 / export 前缀 / 重复 key 覆盖（Tasks 1–2）
- [ ] 错误场景（非法 key / 缺 `=` / 引号未闭合 / JSON 嵌套 / JSON 语法错误）内联中文 + 行号（Tasks 1–4）
- [ ] 状态栏提示注释丢弃数与重复键覆盖数（Task 5）
- [ ] `tools.ts` 注册完整（id === path 末段）+ 4 条 FAQ（Task 6）
- [ ] `ROADMAP.md` P3 勾选 + 头部日期更新（Task 6）
- [ ] 单工具 JS（gzip）< 50KB（纯自研解析零依赖）
