/**
 * TOML ↔ YAML 互转模块。
 *
 * 依赖 toml.ts 的安全封装与 js-yaml 的 load/dump。
 */
import { load, dump } from 'js-yaml';
import { parseTomlSafe, stringifyTomlSafe, toPortableObject } from './toml';
import type { TomlStringResult, TomlFailure } from './toml';

// ---- 示例数据 ----

/** 默认 YAML 示例 */
export const EXAMPLE_YAML = `package:
  name: demo
  version: 1.0.0
dependencies:
  serde: "1.0"
  tokio:
    version: "1"
    features:
      - full`;

// ---- 转换函数 ----

/**
 * 将 TOML 文本转换为 YAML 文本。
 *
 * 解析 TOML → 归一化日期/数值 → js-yaml dump（指定缩进、不折行、不使用引用锚点）。
 *
 * @param tomlText - TOML 文本
 * @param indent - 缩进空格数（2 或 4）
 * @returns YAML 字符串或错误
 */
export function tomlToYaml(tomlText: string, indent: 2 | 4): TomlStringResult {
  const parsed = parseTomlSafe(tomlText);
  if (!parsed.ok) return parsed;

  const portable = toPortableObject(parsed.data);
  try {
    const result = dump(portable, {
      indent,
      lineWidth: 0,
      noRefs: true,
      sortKeys: false,
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `YAML 生成失败：${msg}` };
  }
}

/**
 * 将 YAML 文本转换为 TOML 文本。
 *
 * 安全解析 YAML（顶层须为表）→ stringifyTomlSafe（前置校验无 null）。
 *
 * @param yamlText - YAML 文本
 * @returns TOML 字符串或错误
 */
export function yamlToToml(yamlText: string): TomlStringResult {
  let parsed: unknown;
  try {
    parsed = load(yamlText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const failure: TomlFailure = { ok: false, error: `YAML 解析失败：${msg}` };
    return failure;
  }

  // load 对空串返回 undefined
  if (parsed === undefined) {
    return { ok: false, error: 'YAML 内容为空' };
  }

  return stringifyTomlSafe(parsed);
}
