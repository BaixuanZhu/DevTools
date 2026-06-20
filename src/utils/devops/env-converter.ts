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
