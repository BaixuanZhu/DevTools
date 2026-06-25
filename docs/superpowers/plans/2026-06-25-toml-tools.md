# TOML 工具集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「格式化」分类下新增 3 个 TOML 工具：TOML↔JSON 双向互转、TOML↔YAML 双向互转、TOML 校验/格式化器。

**Architecture:** 以 `src/utils/format/toml.ts` 为基础封装层（基于 `smol-toml`，统一解析/序列化/错误归一化/null 检测/日期归一化），上面是三个薄转换模块（`toml-json.ts`、`toml-yaml.ts`、`toml-formatter.ts`），再上是 Vue 组件与 Astro 页面。互转组件采用 `EnvConverter.vue` 的左右双栏双向实时同步模式；格式化器采用 `JsonFormatter.vue` 的输入即校验+美化模式（简化版）。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、Tailwind v4、`smol-toml@1.7.0`（已安装）、`js-yaml`（已有）、Vitest。

## Global Constraints

- **依赖**：`smol-toml@1.7.0` 已通过 `pnpm add smol-toml` 安装；YAML 复用已有的 `js-yaml`（`load` 解析、`dump` 序列化）；JSON 复用 `src/utils/format/json-diff.ts` 的 `parseJsonSafe`。
- **命名**：无路径别名，所有导入用相对路径；工具 id 必须等于 path 末段 slug（`toml-json-converter` / `toml-yaml-converter` / `toml-formatter`）。
- **样式**：Tailwind v4，禁用可表示为标准类名的任意值语法（如 `w-30` 而非 `w-[120px]`）；设计令牌值（`text-[0.8125rem]` 等）允许任意值。
- **注释**：所有新增公共函数/类型/常量必须有 TSDoc；公共类/接口/枚举必须有职责说明。
- **错误处理**：中文内联提示，禁用 `eval`/`Function()`；TOML 解析错误带行号。
- **测试**：Vitest，`globals: true`、`environment: 'node'`；测试文件放被测模块同目录的 `__tests__/`。
- **性能上限**：输入硬上限 10MB（`INPUT_SIZE_LIMIT`）；互转工具主线程同步（仿 `EnvConverter`，不引入 Worker——双向同步+异步回调+watch 防循环叠加风险高，且 TOML 配置文件通常很小）；`toml-formatter` 单向转换仿 `JsonFormatter` 用 Worker（阈值 1MB）。
- **安全**：所有 `parse`/`stringify`/`load`/`dump` 必须 try-catch 包裹。

> **注（偏离 spec §6/§7，需在交付时与用户确认是否回写 spec）**：互转工具不创建 `toml-json.worker.ts` / `toml-yaml.worker.ts`，改为主线程同步。理由见上一条。spec §6 文件结构中的这两个 worker 文件不创建。

---

## File Structure

```
src/utils/format/
  toml.ts                        # smol-toml 封装：类型、parseTomlSafe、stringifyTomlSafe、toPortableObject、findNullPath、常量
  toml-json.ts                   # TOML↔JSON 互转：tomlToJson、jsonToToml
  toml-yaml.ts                   # TOML↔YAML 互转：tomlToYaml、yamlToToml
  toml-formatter.ts              # 校验+美化：formatToml、validateToml
  toml-formatter.worker.ts       # 大文件美化 Worker
  __tests__/
    toml.test.ts
    toml-json.test.ts
    toml-yaml.test.ts
    toml-formatter.test.ts

src/tools/format/
  TomlJson.vue                   # TOML↔JSON 双向同步组件
  TomlYaml.vue                   # TOML↔YAML 双向同步组件
  TomlFormatter.vue              # TOML 校验+美化组件

src/pages/format/
  toml-json-converter.astro
  toml-yaml-converter.astro
  toml-formatter.astro

src/data/
  tools.ts                       # 新增 3 项工具元数据（Modify）
  tool-faqs.ts                   # 新增 3 项 FAQ（Modify）
```

---

### Task 1: toml.ts 核心封装

**Files:**
- Create: `src/utils/format/toml.ts`
- Test: `src/utils/format/__tests__/toml.test.ts`

**Interfaces:**
- Consumes: `smol-toml`（`parse`、`stringify`、`TomlError`；`TomlDate` 经 `instanceof Date` 识别）
- Produces（后续任务依赖，签名不可改）:
  - `TomlFailure = { ok: false; error: string; line?: number; column?: number }`
  - `TomlParseResult = { ok: true; data: unknown } | TomlFailure`
  - `TomlStringResult = { ok: true; result: string } | TomlFailure`
  - `parseTomlSafe(text: string): TomlParseResult`
  - `stringifyTomlSafe(obj: unknown): TomlStringResult`
  - `toPortableObject(value: unknown): unknown`（TomlDate/Date→ISO 字符串，bigint→number）
  - `findNullPath(value: unknown, basePath?: string): string | null`
  - 常量 `INPUT_SIZE_LIMIT`、`INPUT_SIZE_WARNING`

- [ ] **Step 1: Write the failing test**

Create `src/utils/format/__tests__/toml.test.ts`:

```ts
/**
 * toml.ts 核心封装单元测试。
 */
import { describe, it, expect } from 'vitest';
import {
  parseTomlSafe,
  stringifyTomlSafe,
  toPortableObject,
  findNullPath,
  INPUT_SIZE_LIMIT,
} from '../toml';

describe('parseTomlSafe', () => {
  it('解析基础 TOML', () => {
    const r = parseTomlSafe('name = "Alice"\nage = 30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('解析嵌套表', () => {
    const r = parseTomlSafe('[server]\nport = 3000');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ server: { port: 3000 } });
    }
  });

  it('语法错误返回行列号', () => {
    const r = parseTomlSafe('name = ');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('TOML');
      expect(typeof r.line).toBe('number');
    }
  });
});

describe('stringifyTomlSafe', () => {
  it('序列化对象', () => {
    const r = stringifyTomlSafe({ name: 'Alice', age: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('顶层非对象报错', () => {
    const r = stringifyTomlSafe([1, 2, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('顶层必须是表');
    }
  });

  it('null 值报错并给出路径', () => {
    const r = stringifyTomlSafe({ a: { b: null } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('null');
      expect(r.error).toContain('a.b');
    }
  });

  it('数组中的 null 报错', () => {
    const r = stringifyTomlSafe({ list: [1, null] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('list[1]');
    }
  });
});

describe('toPortableObject', () => {
  it('原样返回普通值', () => {
    expect(toPortableObject(42)).toBe(42);
    expect(toPortableObject('hi')).toBe('hi');
    expect(toPortableObject(true)).toBe(true);
  });

  it('对象递归处理', () => {
    expect(toPortableObject({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' });
  });

  it('数组递归处理', () => {
    expect(toPortableObject([1, 'x', { a: 2 }])).toEqual([1, 'x', { a: 2 }]);
  });
});

describe('findNullPath', () => {
  it('无 null 返回 null', () => {
    expect(findNullPath({ a: 1 })).toBeNull();
  });

  it('顶层 null 返回 root 标记', () => {
    expect(findNullPath(null)).toBe('(root)');
  });

  it('定位嵌套 null 路径', () => {
    expect(findNullPath({ a: { b: null } })).toBe('a.b');
  });

  it('定位数组内 null 路径', () => {
    expect(findNullPath({ list: [1, null] })).toBe('list[1]');
  });
});

describe('常量', () => {
  it('INPUT_SIZE_LIMIT 为 10MB', () => {
    expect(INPUT_SIZE_LIMIT).toBe(10 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/format/__tests__/toml.test.ts`
Expected: FAIL — `Cannot find module '../toml'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/format/toml.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/format/__tests__/toml.test.ts`
Expected: PASS（全部用例通过）

- [ ] **Step 5: Commit**

```bash
git add src/utils/format/toml.ts src/utils/format/__tests__/toml.test.ts
git commit -m "feat(format): 新增 toml.ts 核心封装（smol-toml 解析/序列化/错误归一化/null 检测）"
```

---

### Task 2: toml-json.ts 互转逻辑

**Files:**
- Create: `src/utils/format/toml-json.ts`
- Test: `src/utils/format/__tests__/toml-json.test.ts`

**Interfaces:**
- Consumes: from `./toml` — `parseTomlSafe`, `stringifyTomlSafe`, `toPortableObject`, `TomlStringResult`, `TomlFailure`; from `./json-diff` — `parseJsonSafe`（返回 `{ok:true,data,nodeCount} | {ok:false,error,line?,column?}`）
- Produces:
  - `tomlToJson(tomlText: string, pretty: boolean): TomlStringResult`（输出 JSON 字符串）
  - `jsonToToml(jsonText: string): TomlStringResult`（输出 TOML 字符串）
  - 常量 `EXAMPLE_TOML`、`EXAMPLE_JSON`（供组件默认填入）

- [ ] **Step 1: Write the failing test**

Create `src/utils/format/__tests__/toml-json.test.ts`:

```ts
/**
 * toml-json.ts 互转单元测试。
 */
import { describe, it, expect } from 'vitest';
import { tomlToJson, jsonToToml } from '../toml-json';

describe('tomlToJson', () => {
  it('基础 TOML 转 JSON', () => {
    const r = tomlToJson('name = "Alice"\nage = 30', true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const obj = JSON.parse(r.result);
      expect(obj).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('嵌套表转 JSON', () => {
    const r = tomlToJson('[server]\nport = 3000', true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.result)).toEqual({ server: { port: 3000 } });
    }
  });

  it('pretty=false 输出紧凑', () => {
    const r = tomlToJson('a = 1', false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toBe('{"a":1}');
  });

  it('TOML 语法错误透传', () => {
    const r = tomlToJson('name = ', true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('TOML');
  });
});

describe('jsonToToml', () => {
  it('基础 JSON 转 TOML', () => {
    const r = jsonToToml('{"name":"Alice","age":30}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('嵌套 JSON 转 TOML', () => {
    const r = jsonToToml('{"server":{"port":3000}}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('[server]');
  });

  it('JSON 语法错误透传', () => {
    const r = jsonToToml('{bad}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('语法错误');
  });

  it('JSON 含 null 报错', () => {
    const r = jsonToToml('{"a":null}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('null');
  });

  it('JSON 顶层数组报错', () => {
    const r = jsonToToml('[1,2,3]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('顶层必须是表');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/format/__tests__/toml-json.test.ts`
Expected: FAIL — `Cannot find module '../toml-json'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/format/toml-json.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/format/__tests__/toml-json.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/format/toml-json.ts src/utils/format/__tests__/toml-json.test.ts
git commit -m "feat(format): 新增 TOML↔JSON 互转逻辑"
```

---

### Task 3: toml-yaml.ts 互转逻辑

**Files:**
- Create: `src/utils/format/toml-yaml.ts`
- Test: `src/utils/format/__tests__/toml-yaml.test.ts`

**Interfaces:**
- Consumes: from `./toml` — `parseTomlSafe`, `stringifyTomlSafe`, `toPortableObject`, `TomlStringResult`; from `js-yaml` — `load`（解析，可能抛错）、`dump`（序列化）
- Produces:
  - `tomlToYaml(tomlText: string, indent: 2 | 4): TomlStringResult`
  - `yamlToToml(yamlText: string): TomlStringResult`
  - 常量 `EXAMPLE_YAML`

- [ ] **Step 1: Write the failing test**

Create `src/utils/format/__tests__/toml-yaml.test.ts`:

```ts
/**
 * toml-yaml.ts 互转单元测试。
 */
import { describe, it, expect } from 'vitest';
import { tomlToYaml, yamlToToml } from '../toml-yaml';

describe('tomlToYaml', () => {
  it('基础 TOML 转 YAML', () => {
    const r = tomlToYaml('name = "Alice"\nage = 30', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name: Alice');
      expect(r.result).toContain('age: 30');
    }
  });

  it('嵌套表转 YAML', () => {
    const r = tomlToYaml('[server]\nport = 3000', 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('port: 3000');
  });

  it('TOML 语法错误透传', () => {
    const r = tomlToYaml('name = ', 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('TOML');
  });
});

describe('yamlToToml', () => {
  it('基础 YAML 转 TOML', () => {
    const r = yamlToToml('name: Alice\nage: 30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('嵌套 YAML 转 TOML', () => {
    const r = yamlToToml('server:\n  port: 3000');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toContain('[server]');
  });

  it('YAML 语法错误', () => {
    const r = yamlToToml('a: b: c');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('YAML');
  });

  it('YAML 含 null 报错', () => {
    const r = yamlToToml('a: null');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('null');
  });

  it('YAML 顶层数组报错', () => {
    const r = yamlToToml('- 1\n- 2');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('顶层必须是表');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/format/__tests__/toml-yaml.test.ts`
Expected: FAIL — `Cannot find module '../toml-yaml'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/format/toml-yaml.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/format/__tests__/toml-yaml.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/format/toml-yaml.ts src/utils/format/__tests__/toml-yaml.test.ts
git commit -m "feat(format): 新增 TOML↔YAML 互转逻辑"
```

---

### Task 4: toml-formatter.ts 校验+美化 + Worker

**Files:**
- Create: `src/utils/format/toml-formatter.ts`
- Create: `src/utils/format/toml-formatter.worker.ts`
- Test: `src/utils/format/__tests__/toml-formatter.test.ts`

**Interfaces:**
- Consumes: from `./toml` — `parseTomlSafe`, `stringifyTomlSafe`, `TomlStringResult`, `TomlFailure`, `INPUT_SIZE_WARNING`, `INPUT_SIZE_LIMIT`
- Produces:
  - `formatToml(text: string): TomlStringResult`（解析后重新序列化，统一格式）
  - `ValidationResult = { ok: boolean; message: string; line?: number; column?: number }`
  - `validateToml(text: string): ValidationResult`
  - `checkInputSize(text: string): 'ok' | 'warning' | 'error'`
  - 常量 `WORKER_THRESHOLD`、`EXAMPLE_TOML_FORMATTER`

- [ ] **Step 1: Write the failing test**

Create `src/utils/format/__tests__/toml-formatter.test.ts`:

```ts
/**
 * toml-formatter.ts 单元测试。
 */
import { describe, it, expect } from 'vitest';
import { formatToml, validateToml, checkInputSize, WORKER_THRESHOLD } from '../toml-formatter';

describe('formatToml', () => {
  it('美化 TOML（重新序列化）', () => {
    const r = formatToml('name="Alice"\nage=30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result).toContain('name = "Alice"');
      expect(r.result).toContain('age = 30');
    }
  });

  it('语法错误返回行列号', () => {
    const r = formatToml('name = ');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('TOML');
      expect(typeof r.line).toBe('number');
    }
  });
});

describe('validateToml', () => {
  it('有效 TOML', () => {
    const r = validateToml('a = 1');
    expect(r.ok).toBe(true);
    expect(r.message).toContain('有效');
  });

  it('无效 TOML 带行列号', () => {
    const r = validateToml('a = ');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('TOML');
    expect(typeof r.line).toBe('number');
  });
});

describe('checkInputSize', () => {
  it('小输入返回 ok', () => {
    expect(checkInputSize('a = 1')).toBe('ok');
  });

  it('超大输入返回 error', () => {
    const big = 'x = "' + 'a'.repeat(11 * 1024 * 1024) + '"';
    expect(checkInputSize(big)).toBe('error');
  });
});

describe('常量', () => {
  it('WORKER_THRESHOLD 为 1MB', () => {
    expect(WORKER_THRESHOLD).toBe(1024 * 1024);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/utils/format/__tests__/toml-formatter.test.ts`
Expected: FAIL — `Cannot find module '../toml-formatter'`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/format/toml-formatter.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/utils/format/__tests__/toml-formatter.test.ts`
Expected: PASS

- [ ] **Step 5: Create Worker**

Create `src/utils/format/toml-formatter.worker.ts`:

```ts
/**
 * TOML 格式化 Web Worker。
 *
 * 用于大文件（>1MB）的异步美化，避免阻塞主线程。
 */
import { formatToml, type TomlStringResult } from './toml-formatter';

/** Worker 请求消息 */
export interface TomlFormatterWorkerRequest {
  /** TOML 文本 */
  text: string;
}

self.onmessage = (e: MessageEvent<TomlFormatterWorkerRequest>) => {
  const { text } = e.data;
  try {
    const result: TomlStringResult = formatToml(text);
    self.postMessage(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure: TomlStringResult = { ok: false, error: `Worker 执行出错：${msg}` };
    self.postMessage(failure);
  }
};
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/format/toml-formatter.ts src/utils/format/toml-formatter.worker.ts src/utils/format/__tests__/toml-formatter.test.ts
git commit -m "feat(format): 新增 TOML 校验与美化逻辑及 Worker"
```

---

### Task 5: TomlJson.vue + toml-json-converter.astro

**Files:**
- Create: `src/tools/format/TomlJson.vue`
- Create: `src/pages/format/toml-json-converter.astro`

**Interfaces:**
- Consumes: from `../../utils/format/toml-json` — `tomlToJson`, `jsonToToml`, `EXAMPLE_TOML`；from `../../utils/format/toml` — `checkInputSize`（不存在则用内联 TextEncoder 计算）；UI 组件 `ToolHeader`、`ResponsiveWorkspace`、`CodePanel`
- Produces: 一个可水合的 Vue 组件，挂载到 `/format/toml-json-converter`

> 交互模式（仿 `EnvConverter.vue`）：左右双栏，左侧 TOML、右侧 JSON，两侧均可编辑、双向实时同步；顶部 `#actions` 放「JSON 格式：美化/紧凑」切换；`convertingFrom` 标志 + `nextTick` 防 watch 循环。主线程同步，不使用 Worker。

- [ ] **Step 1: Create the Vue component**

Create `src/tools/format/TomlJson.vue`:

```vue
<script setup lang="ts">
/**
 * TOML ↔ JSON 互转主组件。
 *
 * 左右双栏双向实时同步：左侧编辑 TOML → 右侧实时输出 JSON；
 * 右侧编辑 JSON → 左侧实时输出 TOML。主线程同步，仿 EnvConverter。
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import {
  tomlToJson,
  jsonToToml,
  EXAMPLE_TOML,
} from '../../utils/format/toml-json';

/** JSON 输出格式选项 */
const jsonFormatOptions: { value: boolean; label: string }[] = [
  { value: true, label: '美化' },
  { value: false, label: '紧凑' },
];

/** 左侧：TOML 文本 */
const leftValue = ref(EXAMPLE_TOML);
/** 右侧：JSON 文本 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** JSON 输出美化开关 */
const jsonPretty = ref(true);
/** 当前转换方向，防止 watch 循环 */
const convertingFrom = ref<'left' | 'right' | null>(null);

/** TOML（左）→ JSON（右） */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = tomlToJson(leftValue.value, jsonPretty.value);
  if (result.ok) {
    rightValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** JSON（右）→ TOML（左） */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = jsonToToml(rightValue.value);
  if (result.ok) {
    leftValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** 监听左侧（TOML）变化 */
watch(leftValue, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

/** 监听右侧（JSON）变化 */
watch(rightValue, () => {
  if (convertingFrom.value === 'left') return;
  convertingFrom.value = 'right';
  convertRightToLeft();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

/** JSON 格式变化时重新生成右侧 */
watch(jsonPretty, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

/** 清空两侧 */
function handleClear(): void {
  leftValue.value = '';
  rightValue.value = '';
  errorMsg.value = '';
}

/** 挂载时执行初始转换（设标志避免初始 rightValue 变化触发反向回写） */
onMounted(() => {
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});
</script>

<template>
  <div>
    <ToolHeader
      title="TOML 与 JSON 互转"
      description="TOML 与 JSON 双向实时互转，支持美化与紧凑输出"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <div class="flex items-center gap-2 mr-auto">
          <span class="text-[0.8125rem] text-muted">JSON 格式</span>
          <div class="inline-flex rounded-sm border border-border overflow-hidden">
            <button
              v-for="opt in jsonFormatOptions"
              :key="opt.label"
              type="button"
              :class="[
                'px-3 py-1.5 text-[0.8125rem] transition-[background-color,color] duration-150 cursor-pointer',
                jsonPretty === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-card text-muted hover:bg-hover hover:text-text',
              ]"
              @click="jsonPretty = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </template>

      <template #input>
        <CodePanel label="TOML" show-clear show-copy :copy-text="leftValue" @clear="handleClear">
          <textarea
            v-model="leftValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 TOML 文本..."
            spellcheck="false"
            aria-label="TOML 输入"
          ></textarea>
        </CodePanel>
      </template>

      <template #output>
        <CodePanel label="JSON" show-clear show-copy :copy-text="rightValue" @clear="handleClear">
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 JSON 文本..."
            spellcheck="false"
            aria-label="JSON 输入"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create the Astro page**

Create `src/pages/format/toml-json-converter.astro`:

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import TomlJson from '../../tools/format/TomlJson.vue';
---

<ToolLayout toolId="format/toml-json-converter">
  <TomlJson client:idle />
</ToolLayout>
```

- [ ] **Step 3: Run type check**

Run: `pnpm astro check`
Expected: 无与 TOML 相关的类型错误（新文件可能因索引延迟出现假阳性，以实际编译为准）

- [ ] **Step 4: Verify in browser**

Run: `pnpm dev`，打开 `http://localhost:4321/format/toml-json-converter`
验证：
- 默认 TOML 示例自动转为 JSON 显示在右侧
- 编辑左侧 TOML，右侧 JSON 实时更新
- 编辑右侧 JSON，左侧 TOML 实时更新
- 切换「美化/紧凑」，右侧 JSON 格式变化
- 输入非法 JSON（如 `{bad}`），下方显示中文错误
- 复制按钮可用，清空按钮清空两侧

- [ ] **Step 5: Commit**

```bash
git add src/tools/format/TomlJson.vue src/pages/format/toml-json-converter.astro
git commit -m "feat(format): 新增 TOML↔JSON 互转页面"
```

---

### Task 6: TomlYaml.vue + toml-yaml-converter.astro

**Files:**
- Create: `src/tools/format/TomlYaml.vue`
- Create: `src/pages/format/toml-yaml-converter.astro`

**Interfaces:**
- Consumes: from `../../utils/format/toml-yaml` — `tomlToYaml`, `yamlToToml`, `EXAMPLE_TOML`（toml-yaml 也导出 EXAMPLE_YAML，但默认填 TOML 侧）
- Produces: 挂载到 `/format/toml-yaml-converter`

> 模式与 Task 5 完全一致，仅替换：标题/描述、转换函数（`tomlToYaml`/`yamlToToml`）、右侧标签 YAML、格式选项改为「YAML 缩进：2/4」。

- [ ] **Step 1: Create the Vue component**

Create `src/tools/format/TomlYaml.vue`:

```vue
<script setup lang="ts">
/**
 * TOML ↔ YAML 互转主组件。
 *
 * 左右双栏双向实时同步：左侧 TOML、右侧 YAML。主线程同步，仿 EnvConverter。
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import {
  tomlToYaml,
  yamlToToml,
  EXAMPLE_TOML,
} from '../../utils/format/toml-yaml';

/** YAML 缩进选项 */
const yamlIndentOptions: { value: 2 | 4; label: string }[] = [
  { value: 2, label: '2 空格' },
  { value: 4, label: '4 空格' },
];

/** 左侧：TOML 文本 */
const leftValue = ref(EXAMPLE_TOML);
/** 右侧：YAML 文本 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** YAML 缩进 */
const yamlIndent = ref<2 | 4>(2);
/** 当前转换方向，防止 watch 循环 */
const convertingFrom = ref<'left' | 'right' | null>(null);

/** TOML（左）→ YAML（右） */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = tomlToYaml(leftValue.value, yamlIndent.value);
  if (result.ok) {
    rightValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** YAML（右）→ TOML（左） */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = yamlToToml(rightValue.value);
  if (result.ok) {
    leftValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

watch(leftValue, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

watch(rightValue, () => {
  if (convertingFrom.value === 'left') return;
  convertingFrom.value = 'right';
  convertRightToLeft();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

watch(yamlIndent, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

function handleClear(): void {
  leftValue.value = '';
  rightValue.value = '';
  errorMsg.value = '';
}

onMounted(() => {
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});
</script>

<template>
  <div>
    <ToolHeader
      title="TOML 与 YAML 互转"
      description="TOML 与 YAML 双向实时互转，支持 2/4 空格缩进"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <div class="flex items-center gap-2 mr-auto">
          <span class="text-[0.8125rem] text-muted">YAML 缩进</span>
          <div class="inline-flex rounded-sm border border-border overflow-hidden">
            <button
              v-for="opt in yamlIndentOptions"
              :key="opt.value"
              type="button"
              :class="[
                'px-3 py-1.5 text-[0.8125rem] transition-[background-color,color] duration-150 cursor-pointer',
                yamlIndent === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-card text-muted hover:bg-hover hover:text-text',
              ]"
              @click="yamlIndent = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </template>

      <template #input>
        <CodePanel label="TOML" show-clear show-copy :copy-text="leftValue" @clear="handleClear">
          <textarea
            v-model="leftValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 TOML 文本..."
            spellcheck="false"
            aria-label="TOML 输入"
          ></textarea>
        </CodePanel>
      </template>

      <template #output>
        <CodePanel label="YAML" show-clear show-copy :copy-text="rightValue" @clear="handleClear">
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 YAML 文本..."
            spellcheck="false"
            aria-label="YAML 输入"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create the Astro page**

Create `src/pages/format/toml-yaml-converter.astro`:

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import TomlYaml from '../../tools/format/TomlYaml.vue';
---

<ToolLayout toolId="format/toml-yaml-converter">
  <TomlYaml client:idle />
</ToolLayout>
```

- [ ] **Step 3: Verify in browser**

Run: `pnpm dev`，打开 `http://localhost:4321/format/toml-yaml-converter`
验证：默认 TOML→YAML、双向实时同步、缩进 2/4 切换、错误提示、复制/清空。

- [ ] **Step 4: Commit**

```bash
git add src/tools/format/TomlYaml.vue src/pages/format/toml-yaml-converter.astro
git commit -m "feat(format): 新增 TOML↔YAML 互转页面"
```

---

### Task 7: TomlFormatter.vue + toml-formatter.astro

**Files:**
- Create: `src/tools/format/TomlFormatter.vue`
- Create: `src/pages/format/toml-formatter.astro`

**Interfaces:**
- Consumes: from `../../utils/format/toml-formatter` — `formatToml`, `validateToml`, `checkInputSize`, `WORKER_THRESHOLD`, `EXAMPLE_TOML_FORMATTER`, `TomlStringResult`；UI 组件 `ToolHeader`、`ResponsiveWorkspace`、`CodePanel`、`CopyButton`、`ClearButton`
- Produces: 挂载到 `/format/toml-formatter`

> 模式仿 `JsonFormatter.vue`（简化）：上方输入 TOML，操作栏「美化/校验」按钮 + 复制/清空，下方输出。大文件（>1MB）美化走 Worker。

- [ ] **Step 1: Create the Vue component**

Create `src/tools/format/TomlFormatter.vue`:

```vue
<script setup lang="ts">
/**
 * TOML 格式化器主组件。
 *
 * 提供 TOML 美化（重新序列化统一格式）与语法校验；大文件美化走 Web Worker。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  formatToml,
  validateToml,
  checkInputSize,
  WORKER_THRESHOLD,
  EXAMPLE_TOML_FORMATTER,
  type ValidationResult,
  type TomlStringResult,
} from '../../utils/format/toml-formatter';

/** 输入文本（默认填入示例） */
const inputText = ref(EXAMPLE_TOML_FORMATTER);
/** 输出文本 */
const outputText = ref('');
/** 错误信息 */
const errorMessage = ref('');
/** 是否错误状态 */
const isError = ref(false);
/** 大小警告状态 */
const sizeWarning = ref<'ok' | 'warning' | 'error'>('ok');
/** Worker 加载中 */
const isLoading = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;

/** 可复制文本 */
const copyableText = computed(() => outputText.value);

/** 重置输出 */
function resetOutput(): void {
  outputText.value = '';
  errorMessage.value = '';
  isError.value = false;
}

/** 设置错误 */
function setError(msg: string): void {
  errorMessage.value = msg;
  isError.value = true;
  outputText.value = '';
}

/** 设置成功输出 */
function setOutput(text: string): void {
  outputText.value = text;
  errorMessage.value = '';
  isError.value = false;
}

/** 检查大小 */
function checkSize(): boolean {
  const status = checkInputSize(inputText.value);
  sizeWarning.value = status;
  if (status === 'error') {
    setError('数据量超过 10MB 限制，无法处理。请减小输入数据。');
    return false;
  }
  return true;
}

/** 美化 */
function handleFormat(): void {
  resetOutput();
  if (!inputText.value.trim()) {
    setError('请输入 TOML 数据');
    return;
  }
  if (!checkSize()) return;

  const size = new TextEncoder().encode(inputText.value).length;
  if (size > WORKER_THRESHOLD) {
    formatWithWorker();
    return;
  }
  const result = formatToml(inputText.value);
  if (result.ok) {
    setOutput(result.result);
  } else {
    setError(result.error);
  }
}

/** 校验 */
function handleValidate(): void {
  resetOutput();
  if (!inputText.value.trim()) {
    setError('请输入 TOML 数据');
    return;
  }
  const result: ValidationResult = validateToml(inputText.value);
  if (result.ok) {
    setOutput(result.message);
  } else {
    let msg = result.message;
    if (result.line !== undefined && result.column !== undefined) {
      msg += `（第 ${result.line} 行，第 ${result.column} 列）`;
    }
    setError(msg);
  }
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/toml-formatter.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.onmessage = (e: MessageEvent<TomlStringResult>) => {
    isLoading.value = false;
    const response = e.data;
    if (response.ok) {
      setOutput(response.result);
    } else {
      setError(response.error);
    }
  };
  worker.onerror = () => {
    isLoading.value = false;
    setError('Worker 执行出错，请重试');
  };
}

/** 大文件美化 */
function formatWithWorker(): void {
  if (!worker) initWorker();
  isLoading.value = true;
  worker!.postMessage({ text: inputText.value });
}

/** 清空 */
function handleClear(): void {
  inputText.value = '';
  resetOutput();
  sizeWarning.value = 'ok';
}

onMounted(() => {
  sizeWarning.value = checkInputSize(inputText.value);
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="TOML 格式化器"
      description="在线 TOML 语法校验与格式美化工具"
      :show-example="false"
    />

    <div
      v-if="sizeWarning === 'warning'"
      class="mb-4 px-4 py-2 border border-accent/30 rounded-sm bg-accent/5 text-sm text-accent"
    >
      ⚠ 数据量超过 5MB，可能导致浏览器卡顿
    </div>

    <!-- 操作栏 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <button
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
        @click="handleFormat"
      >
        美化
      </button>
      <button
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
        @click="handleValidate"
      >
        校验
      </button>
      <div class="ml-auto flex gap-2">
        <CopyButton :text="copyableText" />
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <textarea
          v-model="inputText"
          class="w-full h-[calc(100vh-320px)] min-h-80 p-4 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus:border-accent"
          placeholder="粘贴或输入 TOML 数据..."
          spellcheck="false"
          aria-label="TOML 输入"
        ></textarea>
      </template>

      <template #output>
        <div
          v-if="isLoading"
          class="w-full h-[calc(100vh-320px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
        >
          正在格式化...
        </div>
        <div
          v-else-if="isError"
          class="w-full h-[calc(100vh-320px)] min-h-80 p-4 border border-border rounded-sm bg-card overflow-auto"
        >
          <pre class="m-0 text-sm text-error whitespace-pre-wrap font-mono">{{ errorMessage }}</pre>
        </div>
        <div
          v-else-if="outputText"
          class="w-full h-[calc(100vh-320px)] min-h-80 p-4 border border-border rounded-sm bg-card overflow-auto"
        >
          <pre class="m-0 text-sm font-mono whitespace-pre-wrap leading-relaxed text-text">{{ outputText }}</pre>
        </div>
        <div
          v-else
          class="w-full h-[calc(100vh-320px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
        >
          点击「美化」或「校验」查看结果
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 2: Create the Astro page**

Create `src/pages/format/toml-formatter.astro`:

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import TomlFormatter from '../../tools/format/TomlFormatter.vue';
---

<ToolLayout toolId="format/toml-formatter">
  <TomlFormatter client:idle />
</ToolLayout>
```

- [ ] **Step 3: Verify in browser**

Run: `pnpm dev`，打开 `http://localhost:4321/format/toml-formatter`
验证：「美化」重新序列化（如 `name="x"` → `name = "x"`）、「校验」有效/无效提示（无效带行列号）、复制/清空、大小警告。

- [ ] **Step 4: Commit**

```bash
git add src/tools/format/TomlFormatter.vue src/pages/format/toml-formatter.astro
git commit -m "feat(format): 新增 TOML 格式化器页面"
```

---

### Task 8: 注册 tools.ts + tool-faqs.ts + 最终验证

**Files:**
- Modify: `src/data/tools.ts`（在 `tools` 数组末尾、`json-to-ts` 附近或数组末尾追加 3 项）
- Modify: `src/data/tool-faqs.ts`（追加 3 个 key）

**Interfaces:**
- Consumes: `ToolMeta` 结构（见 `tools.ts` 顶部）；`FaqItem` 结构（见 `tool-faqs.ts` 顶部）
- Produces: 3 个工具在导航/搜索/SEO/相关工具中可用

- [ ] **Step 1: 在 tools.ts 追加 3 项工具元数据**

在 `src/data/tools.ts` 的 `tools` 数组末尾（最后一个工具对象之后、`]` 之前）追加：

```ts
  {
    id: 'toml-json-converter',
    name: 'TOML 与 JSON 互转',
    description: 'TOML 与 JSON 双向实时互转，支持美化与紧凑输出，纯浏览器端运算',
    seoDescription: '在线 TOML 与 JSON 双向互转工具，输入 TOML 实时生成 JSON、输入 JSON 实时生成 TOML，支持美化与紧凑输出，Rust Cargo.toml 与 pyproject.toml 配置转换必备，纯浏览器端运算数据不上传。',
    category: '格式化',
    icon: '🧩',
    path: '/format/toml-json-converter',
    keywords: ['toml 转 json', 'json 转 toml', 'toml json 互转', 'toml to json', 'cargo.toml 转 json', 'pyproject.toml 转 json', '在线 toml 转换'],
    relatedToolIds: ['toml-yaml-converter', 'toml-formatter', 'json-formatter', 'json-to-yaml'],
  },
  {
    id: 'toml-yaml-converter',
    name: 'TOML 与 YAML 互转',
    description: 'TOML 与 YAML 双向实时互转，支持 2/4 空格缩进，纯浏览器端运算',
    seoDescription: '在线 TOML 与 YAML 双向互转工具，输入 TOML 实时生成 YAML、输入 YAML 实时生成 TOML，支持 2/4 空格缩进，配置格式迁移与对照必备，纯浏览器端运算数据不上传。',
    category: '格式化',
    icon: '🧬',
    path: '/format/toml-yaml-converter',
    keywords: ['toml 转 yaml', 'yaml 转 toml', 'toml yaml 互转', 'toml to yaml', 'cargo.toml 转 yaml', '配置格式转换', '在线 toml yaml'],
    relatedToolIds: ['toml-json-converter', 'toml-formatter', 'json-to-yaml'],
  },
  {
    id: 'toml-formatter',
    name: 'TOML 格式化器',
    description: '在线 TOML 语法校验与格式美化工具，统一缩进与键值格式',
    seoDescription: '在线 TOML 格式化与校验工具，一键美化 TOML 配置（统一空格、键值格式），并做语法校验定位错误行列号，Rust 与 Python 项目配置编写必备，纯浏览器端运算数据不上传。',
    category: '格式化',
    icon: '🧹',
    path: '/format/toml-formatter',
    keywords: ['toml 格式化', 'toml 美化', 'toml 校验', 'toml 格式', 'toml formatter', 'cargo.toml 格式化', 'pyproject.toml 校验'],
    relatedToolIds: ['toml-json-converter', 'toml-yaml-converter', 'json-formatter'],
  },
```

- [ ] **Step 2: 在 tool-faqs.ts 追加 3 项 FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中追加 3 个 key（在任意已有 key 之后）：

```ts
  'toml-json-converter': [
    {
      question: 'TOML 和 JSON 有什么区别？',
      answer: '<strong>TOML</strong> 是专为配置文件设计的格式，语义清晰、支持注释、日期、多行字符串等；<strong>JSON</strong> 通用性更强、机器友好，但不支持注释。配置类场景常用 TOML，数据传输常用 JSON。',
    },
    {
      question: '为什么我的 JSON 转 TOML 报错？',
      answer: 'TOML <strong>顶层必须是对象（表）</strong>，且<strong>不支持 null</strong>。如果 JSON 顶层是数组或标量，或包含 null 值，转换会失败并提示具体路径。请将顶层包装为对象、移除或替换 null。',
    },
    {
      question: '转换会丢失信息吗？',
      answer: '存在少量有损情况：TOML 的浮点 <code>1.0</code> 会按整数 <code>1</code> 处理；TOML 的日期时间转为 JSON 后是字符串，再转回 TOML 无法还原为日期类型。常规配置数据可无损往返。',
    },
  ],
  'toml-yaml-converter': [
    {
      question: 'TOML 和 YAML 该用哪个？',
      answer: '两者都适合配置。TOML 类型明确、不易出错；YAML 更简洁、支持复杂嵌套与引用，但<code>缩进敏感</code>易出格式错误。需要与 Rust/Python 生态对接选 TOML，需要极致简洁或大量嵌套可选 YAML。',
    },
    {
      question: 'YAML 转 TOML 时 null 怎么办？',
      answer: 'TOML <strong>不支持 null</strong>。若 YAML 中含 <code>null</code>、<code>~</code> 或空值，转换会报错并给出路径，请替换为具体值或移除该键。',
    },
    {
      question: '支持 YAML 的哪些特性？',
      answer: '基于 <code>js-yaml</code>，支持锚点、引用、多行字符串、流式语法等。但转 TOML 时，YAML 的引用会被展开为重复数据（TOML 无引用概念）。',
    },
  ],
  'toml-formatter': [
    {
      question: '格式化会修改我的 TOML 内容吗？',
      answer: '会重新序列化以统一格式（键值间距、表头顺序），但<strong>不改变数据语义</strong>。注释会丢失（解析-序列化往返不含注释），如需保留注释请手动调整。',
    },
    {
      question: '校验提示的行列号准吗？',
      answer: '准确。工具基于 smol-toml 解析，错误信息会标注具体的<strong>行号与列号</strong>，便于定位语法问题（如缺失值、非法字符）。',
    },
    {
      question: '支持多大的 TOML 文件？',
      answer: '输入硬上限 <strong>10MB</strong>。超过 5MB 会提示可能卡顿，超过 1MB 的美化会自动走 Web Worker 异步处理避免阻塞界面。',
    },
  ],
```

- [ ] **Step 3: 运行全部测试**

Run: `pnpm test`
Expected: 全部通过（含新增 4 个测试文件）

- [ ] **Step 4: 类型检查**

Run: `pnpm astro check`
Expected: 无错误

- [ ] **Step 5: 生产构建**

Run: `pnpm build`
Expected: 构建成功，3 个新页面生成

- [ ] **Step 6: 浏览器全量验证**

Run: `pnpm dev`，逐一访问：
- `/format/toml-json-converter`
- `/format/toml-yaml-converter`
- `/format/toml-formatter`

验证每个页面：默认示例、双向/单向转换、格式选项、错误提示、复制/清空、SEO 标题（浏览器标签）。再验证首页导航和搜索能找到这 3 个工具。

- [ ] **Step 7: Commit**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(format): 注册 TOML 工具集（互转×2 + 格式化器）元数据与 FAQ"
```

---

## Self-Review 结论

**1. Spec coverage：**
- §2 工具清单（3 个）→ Task 5/6/7（页面）+ Task 8（注册）✓
- §3.1 双向同步交互 → Task 5/6（EnvConverter 模式）✓
- §3.2 校验+美化 → Task 7 ✓
- §4 库选型（smol-toml）→ Global Constraints + Task 1 ✓
- §5 数据模型差异（null/顶层表/日期/键名）→ Task 1（findNullPath、顶层校验、toPortableObject）✓
- §6 文件结构 → File Structure（**偏离**：互转工具不创建 worker 文件，已注明）✓
- §7 错误/无障碍/性能 → 各 Task 内（aria-label、错误提示、Worker 阈值）✓
- §8 测试策略 → Task 1–4 单元测试 ✓
- §10 验收标准 → Task 8 Step 3–6 ✓

**2. Placeholder scan：** 无 TBD/TODO；所有代码步骤含完整代码；所有命令含预期输出。

**3. Type consistency：** `TomlFailure`/`TomlStringResult`/`TomlParseResult` 在 Task 1 定义，Task 2/3/4 一致消费；`ValidationResult` 在 Task 4 定义并导出，Task 7 消费；转换函数签名（`tomlToJson(text, pretty)`、`jsonToToml(text)`、`tomlToYaml(text, indent)`、`yamlToToml(text)`、`formatToml(text)`、`validateToml(text)`）在定义任务与组件任务中一致。

**已知偏离（需交付时与用户确认是否回写 spec）：** 互转工具不引入 Worker（spec §6 列了 `toml-json.worker.ts`/`toml-yaml.worker.ts`，本计划不创建），改为主线程同步。理由：双向同步 + Worker 异步回调 + watch 防循环三者叠加 bug 风险高；TOML 配置文件通常很小；与 `EnvConverter` 既有模式一致。
