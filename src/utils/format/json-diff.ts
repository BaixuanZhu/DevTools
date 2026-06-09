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
