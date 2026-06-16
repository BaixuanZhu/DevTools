/**
 * JSON 转 TypeScript 工具函数模块。
 *
 * 提供安全解析 JSON 并推断为 TypeScript interface 定义的功能，
 * 支持数组元素字段合并、可选字段标注与类型并集。
 * 复用 parseJsonSafe 获得语法解析、行列定位与深度/节点数保护。
 */
import { parseJsonSafe } from './json-diff';
import type { ParseOutcome } from './json-diff';

// ---- 类型定义 ----

/** JSON 转 TypeScript 成功结果 */
export interface JsonToTsSuccess {
  /** 转换是否成功 */
  ok: true;
  /** 生成的 TypeScript 类型定义文本 */
  result: string;
}

/** JSON 转 TypeScript 失败结果 */
export interface JsonToTsError {
  /** 转换是否成功 */
  ok: false;
  /** 错误描述 */
  error: string;
}

/** JSON 转 TypeScript 返回类型 */
export type JsonToTsResult = JsonToTsSuccess | JsonToTsError;

/** Web Worker 请求消息 */
export interface JsonToTsWorkerRequest {
  /** JSON 文本 */
  json: string;
  /** 顶层类型名 */
  rootName: string;
}

/** Web Worker 响应类型 */
export type JsonToTsWorkerResponse = JsonToTsSuccess | JsonToTsError;

// ---- 常量 ----

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Worker 阈值（500KB），超过使用 Worker */
export const WORKER_THRESHOLD = 500 * 1024;

// ---- 根类型名校验 ----

/** 合法 TypeScript 标识符正则 */
const TYPE_NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * 校验顶层类型名是否为合法 TypeScript 标识符。
 *
 * @param name - 待校验的类型名
 * @returns 校验结果
 */
export function validateTypeName(
  name: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: '根类型名不能为空' };
  }
  if (!TYPE_NAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: '根类型名须以字母、下划线或 $ 开头，仅含字母、数字、下划线、$',
    };
  }
  return { ok: true };
}

// ---- 推断内部辅助 ----

/** 合法对象键标识符正则（判断键名是否需要加引号） */
const IDENT_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** 基本类型固定排序（保证并集输出稳定：string → number → boolean → null） */
const PRIMITIVE_ORDER = ['string', 'number', 'boolean', 'null'];

/** 推断上下文：累积 interface 定义并管理命名唯一性 */
interface InferContext {
  /** 嵌套 interface 定义文本（后序生成，渲染时反转为父类在前） */
  interfaces: string[];
  /** 顶层声明（type 别名，仅当顶层非对象时存在） */
  topLevelDecl: string | null;
  /** 已使用的类型名集合（去冲突） */
  usedNames: Set<string>;
}

/** 判断值是否为普通对象（非 null、非数组） */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 首字母大写 */
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** 类型名排序：基本类型按 PRIMITIVE_ORDER 在前，命名引用按字母序在后 */
function sortTypes(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ia = PRIMITIVE_ORDER.indexOf(a);
    const ib = PRIMITIVE_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** 字符串数组去重 */
function dedupe(types: string[]): string[] {
  return [...new Set(types)];
}

/** 在上下文中取得唯一类型名，冲突时追加数字后缀 */
function uniqueName(proposed: string, ctx: InferContext): string {
  if (!ctx.usedNames.has(proposed)) {
    ctx.usedNames.add(proposed);
    return proposed;
  }
  let i = 2;
  while (ctx.usedNames.has(`${proposed}${i}`)) i++;
  const name = `${proposed}${i}`;
  ctx.usedNames.add(name);
  return name;
}

/** 格式化对象键：合法标识符原样输出，否则加引号 */
function formatKey(key: string): string {
  return IDENT_KEY_RE.test(key) ? key : JSON.stringify(key);
}

/** 为数组元素类型套上 []；含并集 | 时加括号 */
function wrapArray(elementType: string): string {
  return elementType.includes('|') ? `(${elementType})[]` : `${elementType}[]`;
}

// ---- 核心推断 ----

/** 推断单个值的类型字符串（对象/数组会向 ctx 注册定义） */
function inferType(value: unknown, proposedName: string, ctx: InferContext): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
  }
  if (Array.isArray(value)) {
    return inferArray(value, proposedName, ctx);
  }
  if (isPlainObject(value)) {
    return mergeObjects([value], proposedName, ctx);
  }
  // undefined / function 等（合法 JSON 不会出现）
  return 'unknown';
}

/** 推断数组类型：合并所有元素，返回带 [] 的类型字符串 */
function inferArray(items: unknown[], proposedName: string, ctx: InferContext): string {
  if (items.length === 0) return 'unknown[]';
  const elementType = inferValuesType(items, `${proposedName}Item`, ctx);
  return wrapArray(elementType);
}

/** 推断多个值的并集类型（数组元素合并 / 对象字段多值合并共用） */
function inferValuesType(values: unknown[], proposedName: string, ctx: InferContext): string {
  const objects: Record<string, unknown>[] = [];
  const others: unknown[] = [];
  for (const v of values) {
    if (isPlainObject(v)) objects.push(v);
    else others.push(v);
  }

  const types: string[] = [];
  if (objects.length > 0) {
    // mergeObjects 内部通过 uniqueName 取得最终唯一名并注册到 ctx，
    // 直接使用其返回值保证「字段引用类型名」与「interface 定义名」一致。
    const name = mergeObjects(objects, proposedName, ctx);
    types.push(name);
  }
  for (const v of others) {
    types.push(inferType(v, proposedName, ctx));
  }

  const sorted = sortTypes(dedupe(types));
  return sorted.length === 1 ? sorted[0] : sorted.join(' | ');
}

/** 合并多个对象为一个 interface 定义，注册到 ctx，返回 interface 名 */
function mergeObjects(
  objects: Record<string, unknown>[],
  proposedName: string,
  ctx: InferContext,
): string {
  const realName = uniqueName(proposedName, ctx);

  // 收集字段并集（保持首次出现顺序）与各字段的所有取值
  const fieldOrder: string[] = [];
  const fieldSeen = new Set<string>();
  const fieldValues = new Map<string, unknown[]>();

  for (const obj of objects) {
    for (const [k, v] of Object.entries(obj)) {
      if (!fieldSeen.has(k)) {
        fieldSeen.add(k);
        fieldOrder.push(k);
        fieldValues.set(k, []);
      }
      fieldValues.get(k)!.push(v);
    }
  }

  // 渲染每个字段（递归推断子类型）
  const fieldLines: string[] = [];
  for (const field of fieldOrder) {
    const values = fieldValues.get(field)!;
    const isOptional = values.length < objects.length;
    const fieldType = inferValuesType(values, `${realName}${capitalize(field)}`, ctx);
    const key = formatKey(field);
    fieldLines.push(`  ${key}${isOptional ? '?' : ''}: ${fieldType};`);
  }

  const body = fieldLines.length > 0 ? `\n${fieldLines.join('\n')}\n` : '';
  ctx.interfaces.push(`interface ${realName} {${body}}`);
  return realName;
}

/** 构建顶层声明并填充 ctx */
function buildTopLevel(value: unknown, rootName: string, ctx: InferContext): void {
  if (isPlainObject(value)) {
    // 顶层对象 → interface rootName（mergeObjects 会注册）
    mergeObjects([value], rootName, ctx);
  } else {
    // 顶层非对象 → type rootName = ...
    const typeStr = inferType(value, rootName, ctx);
    ctx.topLevelDecl = `type ${rootName} = ${typeStr};`;
  }
}

/** 渲染：顶层声明在前，interface 按依赖顺序（父在子前）输出 */
function render(ctx: InferContext): string {
  const parts: string[] = [];
  if (ctx.topLevelDecl) {
    parts.push(ctx.topLevelDecl);
  }
  // 后序生成 → 反转使父 interface 排在子 interface 之前
  parts.push(...[...ctx.interfaces].reverse());
  return parts.join('\n\n');
}

// ---- 主转换函数 ----

/**
 * 将 JSON 文本推断为 TypeScript interface 定义文本。
 *
 * 内部依次完成：parseJsonSafe 解析（含 256 层 / 50 万节点保护）→ 根类型名校验 → 递归类型推断。
 *
 * @param jsonText - 原始 JSON 文本
 * @param rootName - 顶层类型名
 * @returns 转换结果；ok=false 时 error 为中文错误描述
 */
export function jsonToTs(jsonText: string, rootName: string): JsonToTsResult {
  const parseResult: ParseOutcome = parseJsonSafe(jsonText);
  if (!parseResult.ok) {
    return { ok: false, error: parseResult.error };
  }

  const nameCheck = validateTypeName(rootName);
  if (!nameCheck.ok) {
    return { ok: false, error: nameCheck.error };
  }

  try {
    const ctx: InferContext = {
      interfaces: [],
      topLevelDecl: null,
      usedNames: new Set(),
    };
    buildTopLevel(parseResult.data, rootName.trim(), ctx);
    return { ok: true, result: render(ctx) };
  } catch (e) {
    if (e instanceof RangeError) {
      return { ok: false, error: 'JSON 嵌套过深，类型推断时栈溢出，请减少嵌套层级' };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `转换失败：${msg}` };
  }
}
