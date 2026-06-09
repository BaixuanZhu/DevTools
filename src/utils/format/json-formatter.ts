/**
 * JSON 格式化器工具函数模块。
 *
 * 提供 JSON 美化、压缩、验证、JSON Path 查询、统计计算等纯函数，
 * 以及 Web Worker 消息类型定义。
 */

/** JSON 统计信息 */
export interface JsonStats {
  /** 节点总数（key-value 对，含嵌套） */
  nodeCount: number;
  /** 最大嵌套层级 */
  maxDepth: number;
  /** 原始输入字节数 */
  byteSize: number;
  /** 行数 */
  lineCount: number;
}

/** 操作成功结果 */
export interface SuccessResult {
  ok: true;
  result: string;
  stats?: JsonStats;
}

/** 操作失败结果 */
export interface ErrorResult {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

/** 操作返回类型 */
export type OperationResult = SuccessResult | ErrorResult;

/** 验证结果 */
export interface ValidationResult {
  ok: boolean;
  message: string;
  line?: number;
  column?: number;
}

/** JSON Path 查询成功结果 */
export interface PathQuerySuccess {
  ok: true;
  results: unknown[];
}

/** JSON Path 查询失败结果 */
export interface PathQueryError {
  ok: false;
  error: string;
}

/** JSON Path 查询返回类型 */
export type PathQueryResult = PathQuerySuccess | PathQueryError;

/** Web Worker 请求消息 */
export interface WorkerRequest {
  json: string;
}

/** Web Worker 成功响应 */
export interface WorkerSuccessResponse {
  ok: true;
  parsed: unknown;
  stats: JsonStats;
}

/** Web Worker 错误响应 */
export interface WorkerErrorResponse {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

/** Web Worker 响应类型 */
export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

/** 缩进选项值类型 */
export type IndentValue = 2 | 4 | 8 | 'tab';

/** 输入大小软限制（5MB），超过显示警告 */
export const INPUT_SIZE_WARNING = 5 * 1024 * 1024;
/** 输入大小硬限制（10MB），超过拒绝处理 */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;
/** Worker 阈值（1MB），超过使用 Worker 解析 */
export const WORKER_THRESHOLD = 1 * 1024 * 1024;

/** 示例 JSON 数据 */
export const EXAMPLE_JSON = `{
  "name": "DevTools",
  "version": "1.0.0",
  "features": ["格式化", "压缩", "验证"],
  "config": {
    "indent": 2,
    "theme": "light"
  },
  "active": true,
  "lastUpdate": null
}`;

/** 缩进选项列表（供 SelectListbox 使用） */
export const INDENT_OPTIONS: { value: IndentValue; label: string }[] = [
  { value: 2, label: '2 空格' },
  { value: 4, label: '4 空格' },
  { value: 8, label: '8 空格' },
  { value: 'tab', label: 'Tab' },
];

/**
 * 将字节数格式化为可读单位。
 *
 * @param bytes - 字节数
 * @returns 格式化后的字符串，如 "1.2 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 计算输入数据的统计信息。
 *
 * @param input - 原始 JSON 字符串
 * @param parsed - 已解析的 JSON 对象
 * @returns 统计信息
 */
export function computeStats(input: string, parsed: unknown): JsonStats {
  return {
    nodeCount: countNodes(parsed),
    maxDepth: measureDepth(parsed),
    byteSize: new TextEncoder().encode(input).length,
    lineCount: input.split('\n').length,
  };
}

/**
 * 美化格式化 JSON。
 *
 * @param input - 原始 JSON 字符串
 * @param indent - 缩进值（数字或 'tab'）
 * @returns 操作结果
 */
export function formatJson(input: string, indent: IndentValue = 2): OperationResult {
  try {
    const parsed = JSON.parse(input);
    const indentStr = indent === 'tab' ? '\t' : indent;
    const result = JSON.stringify(parsed, null, indentStr);
    const stats = computeStats(input, parsed);
    return { ok: true, result, stats };
  } catch (e) {
    return handleError(e, input);
  }
}

/**
 * 压缩 JSON 为最小体积。
 *
 * @param input - 原始 JSON 字符串
 * @returns 操作结果
 */
export function minifyJson(input: string): OperationResult {
  try {
    const parsed = JSON.parse(input);
    const result = JSON.stringify(parsed);
    const stats = computeStats(input, parsed);
    return { ok: true, result, stats };
  } catch (e) {
    return handleError(e, input);
  }
}

/**
 * 验证 JSON 格式，不做修改。
 *
 * @param input - 原始 JSON 字符串
 * @returns 验证结果
 */
export function validateJson(input: string): ValidationResult {
  try {
    JSON.parse(input);
    return { ok: true, message: '✓ JSON 格式有效' };
  } catch (e) {
    const pos = parseErrorPosition(e, input);
    return {
      ok: false,
      message: `JSON 语法错误：${extractErrorMessage(e)}`,
      ...pos,
    };
  }
}

/**
 * 执行 JSON Path 查询。
 *
 * @param input - 原始 JSON 字符串
 * @param path - JSON Path 表达式
 * @returns 查询结果
 */
export async function queryJsonPath(input: string, path: string): Promise<PathQueryResult> {
  try {
    const parsed = JSON.parse(input);
    const { JSONPath } = await import('jsonpath-plus');
    const results = JSONPath({ path, json: parsed, resultType: 'value' });
    if (!Array.isArray(results) || results.length === 0) {
      return { ok: true, results: [] };
    }
    return { ok: true, results };
  } catch (e) {
    if (e instanceof SyntaxError && String(e.message).includes('JSON')) {
      return { ok: false, error: `JSON 语法错误：${e.message}` };
    }
    return { ok: false, error: `JSON Path 表达式错误：${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * 检查输入大小是否超限。
 *
 * @param input - 原始输入字符串
 * @returns 状态：'ok'、'warning' 或 'error'
 */
export function checkInputSize(input: string): 'ok' | 'warning' | 'error' {
  const size = new TextEncoder().encode(input).length;
  if (size > INPUT_SIZE_LIMIT) return 'error';
  if (size > INPUT_SIZE_WARNING) return 'warning';
  return 'ok';
}

// ---- 内部辅助函数 ----

/**
 * 递归计算 JSON 对象的节点数。
 */
function countNodes(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 1;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countNodes(item), 0);
  }
  return Object.values(obj as Record<string, unknown>).reduce<number>(
    (sum, val) => sum + countNodes(val),
    0,
  );
}

/**
 * 递归计算 JSON 对象的最大嵌套深度。
 */
function measureDepth(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 0;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 1;
    return 1 + Math.max(...obj.map(measureDepth));
  }
  const values = Object.values(obj as Record<string, unknown>);
  if (values.length === 0) return 1;
  return 1 + Math.max(...values.map(measureDepth));
}

/**
 * 从 JSON.parse 错误中提取行列号。
 */
function parseErrorPosition(e: unknown, input: string): { line?: number; column?: number } {
  const msg = e instanceof Error ? e.message : String(e);
  const posMatch = msg.match(/position\s+(\d+)/i);
  if (!posMatch) return {};
  const pos = parseInt(posMatch[1], 10);
  const beforeError = input.substring(0, pos);
  const line = beforeError.split('\n').length;
  const lastNewline = beforeError.lastIndexOf('\n');
  const column = lastNewline === -1 ? pos + 1 : pos - lastNewline;
  return { line, column };
}

/**
 * 从错误对象中提取消息。
 */
function extractErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const msg = e.message;
  // 将英文常见错误关键词翻译为中文
  return msg
    .replace(/Unexpected token/i, '意外的字符')
    .replace(/Unexpected end of JSON input/i, 'JSON 数据意外结束')
    .replace(/Expected property name/i, '期望属性名')
    .replace(/Expected ':'/i, '期望冒号 ":"')
    .replace(/Bad control character/i, '非法控制字符')
    .replace(/Bad string/i, '非法字符串')
    .replace(/Bad escape sequence/i, '非法转义序列');
}

/**
 * 统一处理 JSON.parse 错误，返回 ErrorResult。
 */
function handleError(e: unknown, input: string): ErrorResult {
  const pos = parseErrorPosition(e, input);
  const message = extractErrorMessage(e);
  let error = `JSON 语法错误：${message}`;
  if (pos.line !== undefined && pos.column !== undefined) {
    error += `（第 ${pos.line} 行，第 ${pos.column} 列）`;
  }
  return { ok: false, error, ...pos };
}
