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

/** 合法变量名片段（用于 $VAR 匹配） */
const VAR_NAME_PATTERN = /^[A-Za-z_]\w*/;

/** 整行注释：行首或仅前导空白后跟 # */
const COMMENT_PATTERN = /^\s*#/;

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
