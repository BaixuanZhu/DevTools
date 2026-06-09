/**
 * JSON 转 YAML 工具函数模块。
 *
 * 提供安全解析 JSON 并转换为 YAML 字符串的功能，以及 Web Worker 消息类型定义。
 */

import { dump } from 'js-yaml';
import { parseJsonSafe } from './json-diff';
import type { ParseOutcome } from './json-diff';

// ---- 类型定义 ----

/** JSON 转 YAML 成功结果 */
export interface JsonConvertSuccess {
  /** 转换是否成功 */
  ok: true;
  /** 生成的 YAML 字符串 */
  result: string;
}

/** JSON 转 YAML 失败结果 */
export interface JsonConvertError {
  /** 转换是否成功 */
  ok: false;
  /** 错误描述 */
  error: string;
}

/** JSON 转 YAML 返回类型 */
export type JsonToYamlResult = JsonConvertSuccess | JsonConvertError;

/** Web Worker 请求消息 */
export interface JsonToYamlWorkerRequest {
  /** JSON 文本 */
  json: string;
}

/** Web Worker 响应类型 */
export type JsonToYamlWorkerResponse = JsonConvertSuccess | JsonConvertError;

// ---- 常量 ----

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Worker 阈值（500KB），超过使用 Worker */
export const WORKER_THRESHOLD = 500 * 1024;

// ---- 重复引用检测 ----

/**
 * 检测对象中是否包含重复引用（包括循环引用和 DAG 中的重复引用）。
 *
 * 使用 Set 追踪已访问的对象引用，递归遍历所有属性。注意：此函数不会从 Set 中
 * 删除已访问的对象，因此能够正确检测 DAG 中不同路径指向同一对象的情况。
 *
 * @param value - 待检测的值
 * @param seen - 已访问的对象引用集合（递归内部使用）
 * @returns 是否包含重复引用
 */
function hasDuplicateReferences(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return true;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasDuplicateReferences(item, seen)) {
        return true;
      }
    }
  } else {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (hasDuplicateReferences(v, seen)) {
        return true;
      }
    }
  }

  return false;
}

// ---- 主转换函数 ----

/**
 * 将 JSON 文本或对象转换为 YAML 字符串。
 *
 * 如果输入是字符串，先使用 parseJsonSafe 安全解析 JSON；
 * 如果输入是对象，则跳过 JSON 解析直接转换。
 * 然后调用 js-yaml 的 dump 函数生成 YAML，配置为 2 空格缩进、
 * 不自动折行、保持原始键顺序、遇到循环引用时抛出错误。
 *
 * @param input - JSON 文本字符串或已解析的对象
 * @returns 转换结果或错误信息
 */
export function convertJsonToYaml(input: string | unknown): JsonToYamlResult {
  let data: unknown;

  if (typeof input === 'string') {
    const parseResult: ParseOutcome = parseJsonSafe(input);
    if (!parseResult.ok) {
      return { ok: false, error: parseResult.error };
    }
    data = parseResult.data;
  } else {
    data = input;
  }

  if (hasDuplicateReferences(data)) {
    return { ok: false, error: 'JSON 数据包含重复引用，无法转换为 YAML' };
  }

  try {
    const yaml = dump(data, {
      indent: 2,
      noRefs: true,
      sortKeys: false,
      lineWidth: 0,
    });
    return { ok: true, result: yaml };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/circular/i.test(msg)) {
      return { ok: false, error: 'JSON 数据包含重复引用，无法转换为 YAML' };
    }
    return { ok: false, error: `转换失败：${msg}` };
  }
}
