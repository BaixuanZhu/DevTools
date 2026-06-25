/**
 * TOML 核心封装模块。
 *
 * 基于 smol-toml 提供安全的 TOML 解析与序列化，统一错误归一化（带行列号）、
 * null 值检测、TomlDate/Date 归一化，供 toml-json / toml-yaml / toml-formatter 复用。
 */
import { parse, stringify, TomlError } from 'smol-toml';

// ---- 结果类型 ----

/** TOML 操作失败结果（解析或序列化） */
export interface TomlFailure {
  /** 失败标记 */
  ok: false;
  /** 中文错误描述 */
  error: string;
  /** 错误行号（1-based，解析错误时有值） */
  line?: number;
  /** 错误列号（1-based，解析错误时有值） */
  column?: number;
}

/** TOML 解析成功结果 */
export interface TomlParseSuccess {
  ok: true;
  /** 解析得到的数据（顶层恒为表） */
  data: unknown;
}

/** TOML 解析返回类型 */
export type TomlParseResult = TomlParseSuccess | TomlFailure;

/** 字符串输出成功结果 */
export interface TomlStringSuccess {
  ok: true;
  /** 生成的字符串 */
  result: string;
}

/** 字符串输出返回类型（序列化、转换等输出字符串的操作） */
export type TomlStringResult = TomlStringSuccess | TomlFailure;

// ---- 常量 ----

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** 输入大小软限制（5MB），超过显示警告 */
export const INPUT_SIZE_WARNING = 5 * 1024 * 1024;

// ---- 内部辅助 ----

/**
 * 将 smol-toml 抛出的错误归一化为中文 TomlFailure。
 *
 * TomlError 带行列号；其他错误仅取 message。
 *
 * @param e - 捕获的错误
 * @returns 归一化后的失败结果
 */
function normalizeError(e: unknown): TomlFailure {
  if (e instanceof TomlError) {
    return {
      ok: false,
      error: `TOML 语法错误：${e.message}（第 ${e.line} 行，第 ${e.column} 列）`,
      line: e.line,
      column: e.column,
    };
  }
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, error: `TOML 处理失败：${msg}` };
}

/**
 * 判断值是否为 TOML 表（非 null 的普通对象，非数组）。
 *
 * @param value - 待判断的值
 * @returns 是否为表
 */
function isTable(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ---- null 检测 ----

/**
 * 递归查找值中的第一个 null，返回其点路径（如 `a.b[1].c`）。
 *
 * TOML 不支持 null，序列化前需用它定位 null 以给出友好错误。
 *
 * @param value - 待检测的值
 * @param basePath - 当前递归路径前缀
 * @returns 第一个 null 的路径字符串，无 null 时返回 null；顶层 null 返回 `(root)`
 */
export function findNullPath(value: unknown, basePath = ''): string | null {
  if (value === null) return basePath || '(root)';

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findNullPath(value[i], `${basePath}[${i}]`);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const childPath = basePath ? `${basePath}.${key}` : key;
      const found = findNullPath((value as Record<string, unknown>)[key], childPath);
      if (found) return found;
    }
    return null;
  }

  return null;
}

// ---- 日期/数值归一化 ----

/**
 * 将 TOML 解析结果归一化为 JSON/YAML 兼容的纯数据结构。
 *
 * - TomlDate / Date → ISO 字符串（TomlDate 继承 Date，调用 toISOString 保留原始 TOML 日期格式）
 * - bigint → number（避免 JSON.stringify 抛错）
 * - 数组、对象递归处理
 *
 * @param value - 待归一化的值
 * @returns 归一化后的值
 */
export function toPortableObject(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(toPortableObject);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = toPortableObject((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

// ---- 解析与序列化 ----

/**
 * 安全解析 TOML 字符串。
 *
 * @param text - TOML 文本
 * @returns 解析结果或归一化错误
 */
export function parseTomlSafe(text: string): TomlParseResult {
  try {
    const data = parse(text);
    return { ok: true, data };
  } catch (e) {
    return normalizeError(e);
  }
}

/**
 * 安全将值序列化为 TOML 字符串。
 *
 * 序列化前校验：顶层必须是表；数据中不得含 null（TOML 不支持）。
 *
 * @param obj - 待序列化的值
 * @returns TOML 字符串或错误
 */
export function stringifyTomlSafe(obj: unknown): TomlStringResult {
  if (!isTable(obj)) {
    const kind = Array.isArray(obj) ? '数组' : typeof obj;
    return {
      ok: false,
      error: `TOML 顶层必须是表（对象），当前为 ${kind}，请包装为对象`,
    };
  }

  const nullPath = findNullPath(obj);
  if (nullPath) {
    return {
      ok: false,
      error: `TOML 不支持 null 值（路径 ${nullPath}），请移除或替换为具体值`,
    };
  }

  try {
    const result = stringify(obj);
    return { ok: true, result };
  } catch (e) {
    return normalizeError(e);
  }
}
