/**
 * TOML ↔ JSON 互转模块。
 *
 * 依赖 toml.ts 的安全封装与 json-diff.ts 的 JSON 安全解析。
 */
import { parseTomlSafe, stringifyTomlSafe, toPortableObject } from './toml';
import type { TomlStringResult } from './toml';
import { parseJsonSafe } from './json-diff';

// ---- 示例数据 ----

/** 默认 TOML 示例（Cargo.toml 风格） */
export const EXAMPLE_TOML = `[package]
name = "demo"
version = "1.0.0"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }`;

/** 默认 JSON 示例 */
export const EXAMPLE_JSON = `{
  "package": {
    "name": "demo",
    "version": "1.0.0"
  },
  "dependencies": {
    "serde": "1.0",
    "tokio": { "version": "1", "features": ["full"] }
  }
}`;

// ---- 转换函数 ----

/**
 * 将 TOML 文本转换为 JSON 文本。
 *
 * 解析 TOML → 归一化日期/数值 → JSON.stringify（按 pretty 决定缩进）。
 *
 * @param tomlText - TOML 文本
 * @param pretty - true 美化（2 空格缩进），false 紧凑
 * @returns JSON 字符串或错误
 */
export function tomlToJson(tomlText: string, pretty: boolean): TomlStringResult {
  const parsed = parseTomlSafe(tomlText);
  if (!parsed.ok) return parsed;

  const portable = toPortableObject(parsed.data);
  const result = JSON.stringify(portable, null, pretty ? 2 : 0);
  return { ok: true, result };
}

/**
 * 将 JSON 文本转换为 TOML 文本。
 *
 * 安全解析 JSON → stringifyTomlSafe（前置校验顶层为表、无 null）。
 *
 * @param jsonText - JSON 文本
 * @returns TOML 字符串或错误
 */
export function jsonToToml(jsonText: string): TomlStringResult {
  const parsed = parseJsonSafe(jsonText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return stringifyTomlSafe(parsed.data);
}
