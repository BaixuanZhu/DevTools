/**
 * TOML 校验与格式化模块。
 *
 * 美化即「解析后重新序列化」以统一格式；校验仅解析不输出。
 * 大文件（>1MB）美化通过 Web Worker 异步执行。
 */
import { parseTomlSafe, stringifyTomlSafe } from './toml';
import type { TomlStringResult } from './toml';
import { INPUT_SIZE_WARNING, INPUT_SIZE_LIMIT } from './toml';

// ---- 类型 ----

/** 校验结果 */
export interface ValidationResult {
  /** 是否有效 */
  ok: boolean;
  /** 提示信息 */
  message: string;
  /** 错误行号（无效时有值） */
  line?: number;
  /** 错误列号（无效时有值） */
  column?: number;
}

// ---- 常量 ----

/** Worker 阈值（1MB），超过使用 Worker */
export const WORKER_THRESHOLD = 1024 * 1024;

/** 默认示例（pyproject.toml 风格） */
export const EXAMPLE_TOML_FORMATTER = `[project]
name = "demo"
version = "1.0.0"
description = "一个示例项目"

[tool.ruff]
line-length = 100

[dependencies]
requests = "2.31"`;

// ---- 输入大小检查 ----

/**
 * 检查输入文本大小是否超限。
 *
 * @param text - 输入文本
 * @returns 'ok' 正常、'warning' 超过软限制（5MB）、'error' 超过硬限制（10MB）
 */
export function checkInputSize(text: string): 'ok' | 'warning' | 'error' {
  const size = new TextEncoder().encode(text).length;
  if (size > INPUT_SIZE_LIMIT) return 'error';
  if (size > INPUT_SIZE_WARNING) return 'warning';
  return 'ok';
}

// ---- 美化 ----

/**
 * 格式化（美化）TOML：解析后重新序列化以统一格式。
 *
 * @param text - TOML 文本
 * @returns 美化后的 TOML 字符串或错误
 */
export function formatToml(text: string): TomlStringResult {
  const parsed = parseTomlSafe(text);
  if (!parsed.ok) return parsed;
  return stringifyTomlSafe(parsed.data);
}

// ---- 校验 ----

/**
 * 校验 TOML 语法（不输出内容）。
 *
 * @param text - TOML 文本
 * @returns 校验结果（有效返回成功提示，无效返回错误 + 行列号）
 */
export function validateToml(text: string): ValidationResult {
  const parsed = parseTomlSafe(text);
  if (parsed.ok) {
    return { ok: true, message: '✓ TOML 格式有效' };
  }
  return {
    ok: false,
    message: parsed.error,
    line: parsed.line,
    column: parsed.column,
  };
}
