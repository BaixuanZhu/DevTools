/**
 * JSON 转 XML 工具函数模块。
 *
 * 提供安全解析 JSON 并转换为 XML 字符串的功能，以及根元素名校验。
 */

import { parseJsonSafe } from './json-diff';
import type { ParseOutcome } from './json-diff';

// ---- 类型定义 ----

/** JSON 转 XML 成功结果 */
export interface JsonConvertSuccess {
  /** 转换是否成功 */
  ok: true;
  /** 生成的 XML 字符串 */
  result: string;
}

/** JSON 转 XML 失败结果 */
export interface JsonConvertError {
  /** 转换是否成功 */
  ok: false;
  /** 错误描述 */
  error: string;
}

/** JSON 转 XML 返回类型 */
export type JsonToXmlResult = JsonConvertSuccess | JsonConvertError;

/** Web Worker 请求消息 */
export interface JsonToXmlWorkerRequest {
  /** JSON 文本 */
  json: string;
  /** 根元素名称 */
  rootName: string;
}

/** Web Worker 响应类型 */
export type JsonToXmlWorkerResponse = JsonConvertSuccess | JsonConvertError;

// ---- 常量 ----

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Worker 阈值（500KB），超过使用 Worker */
export const WORKER_THRESHOLD = 500 * 1024;

// ---- XML 转义辅助 ----

/**
 * 将文本中的 XML 特殊字符转义为实体引用。
 *
 * @param text - 原始文本
 * @returns 转义后的文本
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---- 数组键名单数化 ----

/**
 * 将复数形式的键名转换为单数形式。
 *
 * 以 "s" 结尾的键名去掉末尾 "s"，否则返回原键名加 "_item"。
 *
 * @param key - 原始键名
 * @returns 单数化后的键名
 */
function singularize(key: string): string {
  if (key.endsWith('s') && key.length > 1) {
    return key.slice(0, -1);
  }
  return `${key}_item`;
}

// ---- JSON 值转 XML ----

/**
 * 递归将 JSON 值转换为 XML 字符串片段。
 *
 * @param value - JSON 值
 * @param key - 当前元素名（JSON 键名）
 * @returns XML 字符串片段
 */
function valueToXml(value: unknown, key: string): string {
  if (value === null) {
    return `<${key}></${key}>`;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return `<${key}>${String(value)}</${key}>`;
  }

  if (typeof value === 'string') {
    return `<${key}>${escapeXml(value)}</${key}>`;
  }

  if (Array.isArray(value)) {
    const childTag = singularize(key);
    const children = value.map((item) => valueToXml(item, childTag)).join('');
    return `<${key}>${children}</${key}>`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => valueToXml(v, k))
      .join('');
    return `<${key}>${entries}</${key}>`;
  }

  // 处理 undefined、function 等不常见类型
  return `<${key}></${key}>`;
}

// ---- 主转换函数 ----

/**
 * 将 JSON 文本转换为 XML 字符串。
 *
 * 先使用 parseJsonSafe 安全解析 JSON，再将解析结果递归转换为 XML。
 * 输出包含 XML 声明，根元素名由 rootName 指定。
 *
 * @param jsonText - JSON 文本
 * @param rootName - 根元素名称
 * @returns 转换结果或错误信息
 */
export function convertJsonToXml(jsonText: string, rootName: string): JsonToXmlResult {
  const parseResult: ParseOutcome = parseJsonSafe(jsonText);
  if (!parseResult.ok) {
    return { ok: false, error: parseResult.error };
  }

  const xmlBody = valueToXml(parseResult.data, rootName);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;

  return { ok: true, result: xml };
}

// ---- 根元素名校验 ----

/**
 * 校验 XML 根元素名是否合法。
 *
 * 合法名称规则：不能为空或纯空格；只能包含字母、数字、下划线和连字符；不能以数字开头。
 *
 * @param name - 待校验的根元素名
 * @returns 校验结果
 */
export function validateRootName(name: string): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: '根元素名不能为空' };
  }

  // XML 名称规则：以字母或下划线开头，后续可跟字母、数字、下划线、连字符
  const validNamePattern = /^[a-zA-Z_][a-zA-Z0-9_\-]*$/;
  if (!validNamePattern.test(trimmed)) {
    return { ok: false, error: '根元素名只能包含字母、数字、下划线和连字符' };
  }

  return { ok: true };
}
