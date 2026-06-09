/**
 * JSON Diff 工具函数模块。
 *
 * 提供语义 diff、严格文本 diff、嵌套深度检测、unified diff 格式化等纯函数，
 * 以及 Web Worker 消息类型定义。
 */

// ---- 类型定义 ----

/** 差异类型 */
export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

/** 单个差异项 */
export interface DiffItem {
  /** 差异类型 */
  type: DiffType;
  /** JSON 路径，JSONPath 格式，如 "$.users[1].name" */
  path: string;
  /** 旧值（removed / modified 时有值） */
  oldValue?: unknown;
  /** 新值（added / modified 时有值） */
  newValue?: unknown;
}

/** 语义对比结果 */
export interface DiffResult {
  /** 所有差异项 */
  items: DiffItem[];
  /** 统计摘要 */
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

/** 严格模式的行级差异 */
export interface LineDiff {
  type: 'added' | 'removed' | 'unchanged';
  /** 左侧行号（removed / unchanged 时有值） */
  leftLineNo?: number;
  /** 右侧行号（added / unchanged 时有值） */
  rightLineNo?: number;
  /** 行内容 */
  content: string;
}

/** 严格模式结果 */
export interface StrictDiffResult {
  lines: LineDiff[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

/** 对比模式 */
export type DiffMode = 'semantic' | 'strict';

/** 对比选项 */
export interface DiffOptions {
  /** 忽略数组元素顺序（语义模式） */
  ignoreArrayOrder: boolean;
  /** 格式化缩进（严格模式） */
  indentSize: 2 | 4;
}

/** JSON 解析结果 */
export interface ParseResult {
  ok: true;
  data: unknown;
  nodeCount: number;
}

/** JSON 解析错误 */
export interface ParseError {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

/** JSON 解析返回类型 */
export type ParseOutcome = ParseResult | ParseError;

/** Web Worker 请求消息 */
export interface WorkerRequest {
  leftJson: string;
  rightJson: string;
  mode: DiffMode;
  options: DiffOptions;
}

/** Web Worker 成功响应 */
export interface WorkerSuccessResponse {
  ok: true;
  result: DiffResult | StrictDiffResult;
}

/** Web Worker 错误响应 */
export interface WorkerErrorResponse {
  ok: false;
  error: string;
}

/** Web Worker 响应类型 */
export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

// ---- 常量 ----

/** 最大允许嵌套深度（解析拦截阈值） */
export const MAX_DEPTH_LIMIT = 256;

/** 最大允许对比深度（递归截断阈值） */
export const MAX_DIFF_DEPTH = 128;

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Worker 阈值（2MB），超过使用 Worker */
export const WORKER_THRESHOLD = 2 * 1024 * 1024;

/** 节点总数限制 */
export const MAX_NODE_COUNT = 500_000;

/** 虚拟滚动启用阈值（行数） */
export const VIRTUAL_SCROLL_THRESHOLD = 200;

/** 自动折叠阈值（行数） */
export const AUTO_FOLD_THRESHOLD = 1000;

/** 展开确认阈值（行数） */
export const EXPAND_CONFIRM_THRESHOLD = 5000;

/** 折叠时保留的上下文行数 */
export const DEFAULT_CONTEXT_LINES = 3;

/** LCS 切换到贪心算法的行数阈值 */
export const LCS_GREEDY_THRESHOLD = 5000;

// ---- 嵌套深度检测 ----

/**
 * 扫描 JSON 文本的最大嵌套深度。
 *
 * 逐字符遍历，遇 `{` 或 `[` 深度 +1，遇 `}` 或 `]` 深度 -1。
 * 正确处理字符串内的括号（忽略字符串和转义字符内的结构字符）。
 * 时间复杂度 O(n)。
 *
 * @param jsonText - 原始 JSON 文本
 * @returns 最大嵌套深度（0 表示无对象/数组）
 */
export function measureMaxDepth(jsonText: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  let inString = false;
  let i = 0;

  while (i < jsonText.length) {
    const ch = jsonText[i];

    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{' || ch === '[') {
        currentDepth++;
        if (currentDepth > maxDepth) {
          maxDepth = currentDepth;
        }
      } else if (ch === '}' || ch === ']') {
        currentDepth--;
      }
    }
    i++;
  }

  return maxDepth;
}

// ---- JSON 解析辅助 ----

/**
 * 安全解析 JSON 文本，带深度拦截和错误信息提取。
 *
 * 解析前先通过 measureMaxDepth 检查嵌套深度，超过 256 层直接拒绝。
 * 解析后检查节点总数，超过 500,000 也拒绝。
 */
export function parseJsonSafe(jsonText: string): ParseOutcome {
  const depth = measureMaxDepth(jsonText);
  if (depth > MAX_DEPTH_LIMIT) {
    return {
      ok: false,
      error: `JSON 嵌套层级过深（${depth} 层），最大支持 ${MAX_DEPTH_LIMIT} 层`,
    };
  }

  try {
    const data = JSON.parse(jsonText);
    const nodeCount = countNodes(data);
    if (nodeCount > MAX_NODE_COUNT) {
      return {
        ok: false,
        error: `节点数量过多（${nodeCount.toLocaleString()}），最大支持 ${MAX_NODE_COUNT.toLocaleString()}`,
      };
    }
    return { ok: true, data, nodeCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pos = parseErrorPosition(msg, jsonText);
    let error = `JSON 语法错误：${translateErrorMessage(msg)}`;
    if (pos.line !== undefined && pos.column !== undefined) {
      error += `（第 ${pos.line} 行，第 ${pos.column} 列）`;
    }
    return { ok: false, error, ...pos };
  }
}

/**
 * 递归计算 JSON 对象的节点总数。
 */
export function countNodes(obj: unknown): number {
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
 * 检查输入文本大小是否超限。
 */
export function checkInputSize(input: string): 'ok' | 'error' {
  const size = new TextEncoder().encode(input).length;
  return size > INPUT_SIZE_LIMIT ? 'error' : 'ok';
}

// ---- 内部辅助 ----

function parseErrorPosition(msg: string, input: string): { line?: number; column?: number } {
  const posMatch = msg.match(/position\s+(\d+)/i);
  if (!posMatch) return {};
  const pos = parseInt(posMatch[1], 10);
  const beforeError = input.substring(0, pos);
  const line = beforeError.split('\n').length;
  const lastNewline = beforeError.lastIndexOf('\n');
  const column = lastNewline === -1 ? pos + 1 : pos - lastNewline;
  return { line, column };
}

function translateErrorMessage(msg: string): string {
  return msg
    .replace(/Unexpected token/i, '意外的字符')
    .replace(/Unexpected end of JSON input/i, 'JSON 数据意外结束')
    .replace(/Expected property name/i, '期望属性名')
    .replace(/Expected ':'/i, '期望冒号 ":"')
    .replace(/Bad control character/i, '非法控制字符')
    .replace(/Bad string/i, '非法字符串')
    .replace(/Bad escape sequence/i, '非法转义序列');
}

// ---- 语义 Diff ----

interface DiffContext {
  ignoreArrayOrder: boolean;
  depth: number;
  truncated: boolean;
}

/**
 * 语义 diff：递归对比两份已解析的 JSON 对象。
 */
export function semanticDiff(
  left: unknown,
  right: unknown,
  options: { ignoreArrayOrder?: boolean } = {},
): DiffResult {
  const ctx: DiffContext = {
    ignoreArrayOrder: options.ignoreArrayOrder ?? false,
    depth: 0,
    truncated: false,
  };

  // 快速短路：排序后序列化相同则无差异
  if (!isPrimitive(left) && !isPrimitive(right)) {
    try {
      const leftStr = stableStringify(left);
      const rightStr = stableStringify(right);
      if (leftStr === rightStr) {
        return { items: [], summary: { added: 0, removed: 0, modified: 0, unchanged: 0 } };
      }
    } catch {
      // 序列化失败，继续正常对比
    }
  }

  const items: DiffItem[] = [];
  const summary = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  compareValues(left, right, '$', ctx, items, summary);
  return { items, summary };
}

function compareValues(
  left: unknown,
  right: unknown,
  path: string,
  ctx: DiffContext,
  items: DiffItem[],
  summary: { added: number; removed: number; modified: number; unchanged: number },
): void {
  if (ctx.depth > MAX_DIFF_DEPTH) {
    ctx.truncated = true;
    items.push({ type: 'modified', path, oldValue: left, newValue: right });
    summary.modified++;
    return;
  }

  if (left === null && right === null) return;
  if (left === null || right === null) {
    if (left === right) return;
    items.push({ type: 'modified', path, oldValue: left, newValue: right });
    summary.modified++;
    return;
  }

  if (isPrimitive(left) && isPrimitive(right)) {
    if (left === right) return;
    items.push({ type: 'modified', path, oldValue: left, newValue: right });
    summary.modified++;
    return;
  }

  const leftType = typeof left === 'object' ? (Array.isArray(left) ? 'array' : 'object') : typeof left;
  const rightType = typeof right === 'object' ? (Array.isArray(right) ? 'array' : 'object') : typeof right;

  if (leftType !== rightType) {
    items.push({ type: 'modified', path, oldValue: left, newValue: right });
    summary.modified++;
    return;
  }

  if (leftType === 'object') {
    compareObjects(
      left as Record<string, unknown>,
      right as Record<string, unknown>,
      path, ctx, items, summary,
    );
  } else if (leftType === 'array') {
    if (ctx.ignoreArrayOrder) {
      compareArraysUnordered(left as unknown[], right as unknown[], path, ctx, items, summary);
    } else {
      compareArraysOrdered(left as unknown[], right as unknown[], path, ctx, items, summary);
    }
  }
}

function compareObjects(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  path: string,
  ctx: DiffContext,
  items: DiffItem[],
  summary: { added: number; removed: number; modified: number; unchanged: number },
): void {
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of allKeys) {
    const escapedKey = key.includes('.') || key.includes('[') || key.includes(']') ? `["${key}"]` : `.${key}`;
    const childPath = path === '$' ? `$${escapedKey}` : `${path}${escapedKey}`;
    const inLeft = key in left;
    const inRight = key in right;

    if (inLeft && !inRight) {
      items.push({ type: 'removed', path: childPath, oldValue: left[key] });
      summary.removed++;
    } else if (!inLeft && inRight) {
      items.push({ type: 'added', path: childPath, newValue: right[key] });
      summary.added++;
    } else {
      ctx.depth++;
      compareValues(left[key], right[key], childPath, ctx, items, summary);
      ctx.depth--;
    }
  }
}

function compareArraysOrdered(
  left: unknown[],
  right: unknown[],
  path: string,
  ctx: DiffContext,
  items: DiffItem[],
  summary: { added: number; removed: number; modified: number; unchanged: number },
): void {
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    const childPath = `${path}[${i}]`;
    if (i < left.length && i < right.length) {
      ctx.depth++;
      compareValues(left[i], right[i], childPath, ctx, items, summary);
      ctx.depth--;
    } else if (i < left.length) {
      items.push({ type: 'removed', path: childPath, oldValue: left[i] });
      summary.removed++;
    } else {
      items.push({ type: 'added', path: childPath, newValue: right[i] });
      summary.added++;
    }
  }
}

function compareArraysUnordered(
  left: unknown[],
  right: unknown[],
  path: string,
  _ctx: DiffContext,
  items: DiffItem[],
  summary: { added: number; removed: number; modified: number; unchanged: number },
): void {
  const leftCounts = new Map<string, { value: unknown; count: number }>();
  const rightCounts = new Map<string, { value: unknown; count: number }>();

  for (const item of left) {
    const key = stableStringify(item);
    const entry = leftCounts.get(key);
    if (entry) entry.count++;
    else leftCounts.set(key, { value: item, count: 1 });
  }

  for (const item of right) {
    const key = stableStringify(item);
    const entry = rightCounts.get(key);
    if (entry) entry.count++;
    else rightCounts.set(key, { value: item, count: 1 });
  }

  const allKeys = new Set([...leftCounts.keys(), ...rightCounts.keys()]);
  for (const key of allKeys) {
    const leftEntry = leftCounts.get(key);
    const rightEntry = rightCounts.get(key);
    const leftCount = leftEntry?.count ?? 0;
    const rightCount = rightEntry?.count ?? 0;
    if (leftCount === rightCount) continue;

    const diff = Math.abs(rightCount - leftCount);
    if (rightCount > leftCount) {
      for (let i = 0; i < diff; i++) {
        items.push({ type: 'added', path: `${path}[?]`, newValue: rightEntry!.value });
        summary.added++;
      }
    } else {
      for (let i = 0; i < diff; i++) {
        items.push({ type: 'removed', path: `${path}[?]`, oldValue: leftEntry!.value });
        summary.removed++;
      }
    }
  }
}

// ---- 通用辅助 ----

function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
  const parts: string[] = [];
  for (const k of sortedKeys) {
    parts.push(JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]));
  }
  return '{' + parts.join(',') + '}';
}
