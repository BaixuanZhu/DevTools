# JSON 转 XML / YAML 工具实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增两个独立的 JSON 转换工具：JSON 转 XML（支持自定义根元素名）和 JSON 转 YAML，均支持大文件 Web Worker 异步处理。

**Architecture:** 两个工具各自由 Astro 页面 + Vue 组件 + 转换核心 + Web Worker 组成。转换核心为纯函数，复用现有 `json-diff.ts` 模块的 `parseJsonSafe` 做 JSON 安全解析（含深度拦截、节点数限制、错误中文本地化）。YAML 转换基于 `js-yaml` 库的 `dump` 函数。组件层统一采用 500ms 防抖自动转换模式，大输入（>500KB）自动降级到 Web Worker。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript + Tailwind CSS + js-yaml + Vitest

---

## File Structure

```
src/
├── tools/format/
│   ├── JsonToXml.vue          # XML 工具 Vue 组件（根元素名选项 + 双栏布局）
│   └── JsonToYaml.vue         # YAML 工具 Vue 组件（极简 + 双栏布局）
├── pages/format/
│   ├── json-to-xml.astro      # XML 工具页面路由
│   └── json-to-yaml.astro     # YAML 工具页面路由
├── utils/format/
│   ├── json-to-xml.ts         # XML 转换核心 + 类型定义 + 常量
│   ├── json-to-xml.worker.ts  # XML Web Worker（大文件异步转换）
│   ├── json-to-yaml.ts        # YAML 转换核心 + 类型定义 + 常量
│   └── json-to-yaml.worker.ts # YAML Web Worker（大文件异步转换）
├── utils/format/__tests__/
│   ├── json-to-xml.test.ts    # XML 转换单元测试
│   └── json-to-yaml.test.ts   # YAML 转换单元测试
└── data/tools.ts              # 工具注册表（追加两个工具）
```

### 关键依赖

- **js-yaml**（运行时）：YAML 转换核心，周下载量 2000 万+，输出标准 YAML。
- **@types/js-yaml**（开发时）：TypeScript 类型支持。
- XML 转换纯原生实现，不引入额外依赖。

---

## Task 1: 安装 js-yaml 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装运行时依赖**

Run: `pnpm add js-yaml`

- [ ] **Step 2: 安装类型定义**

Run: `pnpm add -D @types/js-yaml`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
pnpm install
# 确认 node_modules/js-yaml 存在后
git add pnpm-lock.yaml
git commit -m "deps: 新增 js-yaml 用于 JSON 转 YAML"
```

---

## Task 2: XML 转换核心与单元测试

**Files:**
- Create: `src/utils/format/json-to-xml.ts`
- Create: `src/utils/format/__tests__/json-to-xml.test.ts`

TDD 顺序：先写测试 → 运行失败 → 写实现 → 运行通过。

- [ ] **Step 1: 编写 XML 转换单元测试**

```ts
/**
 * JSON 转 XML 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertJsonToXml, validateRootName } from '../json-to-xml';

describe('convertJsonToXml', () => {
  it('基础对象转换', () => {
    const result = convertJsonToXml('{"name":"Alice","age":30}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.result).toContain('<root>');
      expect(result.result).toContain('<name>Alice</name>');
      expect(result.result).toContain('<age>30</age>');
      expect(result.result).toContain('</root>');
    }
  });

  it('数组转换（复数键去 s 启发式）', () => {
    const result = convertJsonToXml('{"users":[{"name":"Alice"}]}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<users>');
      expect(result.result).toContain('<user>');
      expect(result.result).toContain('<name>Alice</name>');
      expect(result.result).toContain('</user>');
      expect(result.result).toContain('</users>');
    }
  });

  it('数组转换（非复数键加 _item）', () => {
    const result = convertJsonToXml('{"data":[{"value":1}]}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<data>');
      expect(result.result).toContain('<data_item>');
      expect(result.result).toContain('<value>1</value>');
      expect(result.result).toContain('</data_item>');
      expect(result.result).toContain('</data>');
    }
  });

  it('嵌套对象', () => {
    const result = convertJsonToXml('{"a":{"b":{"c":1}}}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<a>');
      expect(result.result).toContain('<b>');
      expect(result.result).toContain('<c>1</c>');
    }
  });

  it('null 处理为空元素', () => {
    const result = convertJsonToXml('{"value":null}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<value></value>');
    }
  });

  it('boolean 处理', () => {
    const result = convertJsonToXml('{"active":true,"deleted":false}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<active>true</active>');
      expect(result.result).toContain('<deleted>false</deleted>');
    }
  });

  it('number 处理', () => {
    const result = convertJsonToXml('{"count":42,"pi":3.14}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<count>42</count>');
      expect(result.result).toContain('<pi>3.14</pi>');
    }
  });

  it('XML 特殊字符转义', () => {
    const result = convertJsonToXml('{"text":"a < b & c > d \\"e\\" \'f\'"}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('&lt;');
      expect(result.result).toContain('&gt;');
      expect(result.result).toContain('&amp;');
      expect(result.result).toContain('&quot;');
      expect(result.result).toContain('&apos;');
    }
  });

  it('自定义根元素名', () => {
    const result = convertJsonToXml('{"a":1}', 'data');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<data>');
      expect(result.result).toContain('</data>');
    }
  });

  it('无效 JSON 报错', () => {
    const result = convertJsonToXml('{bad}', 'root');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('空对象输出空元素', () => {
    const result = convertJsonToXml('{}', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<root></root>');
    }
  });

  it('空数组输出空元素', () => {
    const result = convertJsonToXml('[]', 'root');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('<root></root>');
    }
  });
});

describe('validateRootName', () => {
  it('空字符串无效', () => {
    const result = validateRootName('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('根元素名不能为空');
    }
  });

  it('纯空格无效', () => {
    const result = validateRootName('   ');
    expect(result.ok).toBe(false);
  });

  it('含非法字符无效', () => {
    const result = validateRootName('root@name');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('根元素名只能包含字母、数字、下划线和连字符');
    }
  });

  it('数字开头无效', () => {
    const result = validateRootName('123root');
    expect(result.ok).toBe(false);
  });

  it('合法名称通过', () => {
    expect(validateRootName('root').ok).toBe(true);
    expect(validateRootName('data_1').ok).toBe(true);
    expect(validateRootName('my-name').ok).toBe(true);
    expect(validateRootName('_private').ok).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/format/__tests__/json-to-xml.test.ts`

Expected: FAIL with module not found error (`Cannot find module '../json-to-xml'`)

- [ ] **Step 3: 编写 XML 转换核心实现**

```ts
/**
 * JSON 转 XML 工具函数模块。
 *
 * 提供 JSON 到 XML 的纯函数转换（朴素元素型策略），支持自定义根元素名，
 * 以及 Web Worker 消息类型定义。
 */

import { parseJsonSafe } from './json-diff';

// ---- 类型定义 ----

/** 转换成功结果 */
export interface JsonConvertSuccess {
  ok: true;
  result: string;
}

/** 转换失败结果 */
export interface JsonConvertError {
  ok: false;
  error: string;
}

/** XML 转换返回类型 */
export type JsonToXmlResult = JsonConvertSuccess | JsonConvertError;

/** XML Worker 请求 */
export interface JsonToXmlWorkerRequest {
  json: string;
  rootName: string;
}

/** XML Worker 响应 */
export type JsonToXmlWorkerResponse = JsonConvertSuccess | JsonConvertError;

// ---- 常量 ----

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Worker 阈值（500KB），超过使用 Worker */
export const WORKER_THRESHOLD = 500 * 1024;

// XML 特殊字符转义表
const XML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

// ---- 内部辅助 ----

/**
 * 将文本中的 XML 特殊字符转义。
 */
function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * 将复数键名转换为单数（启发式规则：以 s 结尾则去 s，否则加 _item）。
 */
function singularize(key: string): string {
  if (key.length > 1 && key.endsWith('s')) {
    return key.slice(0, -1);
  }
  return `${key}_item`;
}

/**
 * 递归构建 XML 节点。
 */
function buildXmlNode(data: unknown, key: string, lines: string[], indent: number): void {
  const spaces = '  '.repeat(indent);

  if (data === null) {
    lines.push(`${spaces}<${key}></${key}>`);
    return;
  }

  if (typeof data !== 'object') {
    lines.push(`${spaces}<${key}>${escapeXml(String(data))}</${key}>`);
    return;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      lines.push(`${spaces}<${key}></${key}>`);
      return;
    }
    const childKey = singularize(key);
    lines.push(`${spaces}<${key}>`);
    for (const item of data) {
      buildXmlNode(item, childKey, lines, indent + 1);
    }
    lines.push(`${spaces}</${key}>`);
    return;
  }

  // Object
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    lines.push(`${spaces}<${key}></${key}>`);
    return;
  }

  lines.push(`${spaces}<${key}>`);
  for (const [k, v] of entries) {
    buildXmlNode(v, k, lines, indent + 1);
  }
  lines.push(`${spaces}</${key}>`);
}

// ---- 公开 API ----

/**
 * 将 JSON 文本转换为 XML 字符串（朴素元素型策略）。
 *
 * 内部使用 `parseJsonSafe` 解析 JSON，自动拦截嵌套过深和节点过多数据。
 *
 * @param jsonText - JSON 文本
 * @param rootName - XML 根元素名
 * @returns 转换结果
 */
export function convertJsonToXml(jsonText: string, rootName: string): JsonToXmlResult {
  const parseResult = parseJsonSafe(jsonText);
  if (!parseResult.ok) {
    return { ok: false, error: parseResult.error };
  }

  const lines: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`];
  buildXmlNode(parseResult.data, rootName, lines, 0);
  return { ok: true, result: lines.join('\n') };
}

/**
 * 校验 XML 根元素名是否合法。
 *
 * @param name - 根元素名
 * @returns 校验结果
 */
export function validateRootName(name: string): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: '根元素名不能为空' };
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_\-]*$/.test(trimmed)) {
    return { ok: false, error: '根元素名只能包含字母、数字、下划线和连字符' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/format/__tests__/json-to-xml.test.ts`

Expected: PASS（12 tests passed）

- [ ] **Step 5: Commit**

```bash
git add src/utils/format/json-to-xml.ts src/utils/format/__tests__/json-to-xml.test.ts
git commit -m "feat(json-to-xml): 添加 XML 转换核心与单元测试"
```

---

## Task 3: XML Web Worker

**Files:**
- Create: `src/utils/format/json-to-xml.worker.ts`

- [ ] **Step 1: 创建 XML Worker**

```ts
/**
 * JSON 转 XML Web Worker。
 *
 * 用于大文件（>500KB）的异步转换，避免阻塞主线程。
 */
import {
  convertJsonToXml,
  type JsonToXmlWorkerRequest,
  type JsonToXmlWorkerResponse,
} from './json-to-xml';

self.onmessage = (e: MessageEvent<JsonToXmlWorkerRequest>) => {
  const { json, rootName } = e.data;

  try {
    const result = convertJsonToXml(json, rootName);
    self.postMessage(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: JsonToXmlWorkerResponse = { ok: false, error: `转换执行出错：${msg}` };
    self.postMessage(resp);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/format/json-to-xml.worker.ts
git commit -m "feat(json-to-xml): 添加 XML 转换 Web Worker"
```

---

## Task 4: YAML 转换核心与单元测试

**Files:**
- Create: `src/utils/format/json-to-yaml.ts`
- Create: `src/utils/format/__tests__/json-to-yaml.test.ts`

TDD 顺序：先写测试 → 运行失败 → 写实现 → 运行通过。

- [ ] **Step 1: 编写 YAML 转换单元测试**

```ts
/**
 * JSON 转 YAML 工具函数单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertJsonToYaml } from '../json-to-yaml';

describe('convertJsonToYaml', () => {
  it('基础对象转换', () => {
    const result = convertJsonToYaml('{"name":"Alice","age":30}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('name: Alice');
      expect(result.result).toContain('age: 30');
    }
  });

  it('数组转换', () => {
    const result = convertJsonToYaml('[1,2,3]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('- 1');
      expect(result.result).toContain('- 2');
      expect(result.result).toContain('- 3');
    }
  });

  it('嵌套缩进为 2 空格', () => {
    const result = convertJsonToYaml('{"a":{"b":{"c":1}}}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('a:');
      expect(result.result).toContain('  b:');
      expect(result.result).toContain('    c: 1');
    }
  });

  it('无效 JSON 报错', () => {
    const result = convertJsonToYaml('{bad}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('语法错误');
    }
  });

  it('循环引用报错', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = convertJsonToYaml(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('JSON 包含循环引用，无法转换为 YAML');
    }
  });

  it('null 处理', () => {
    const result = convertJsonToYaml('{"value":null}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('value: null');
    }
  });

  it('boolean 处理', () => {
    const result = convertJsonToYaml('{"active":true}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain('active: true');
    }
  });

  it('不自动折行（lineWidth: 0）', () => {
    const longText = 'a'.repeat(200);
    const result = convertJsonToYaml(`{"text":"${longText}"}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 长文本不应被 YAML 折行
      expect(result.result).toContain(longText);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/format/__tests__/json-to-yaml.test.ts`

Expected: FAIL with module not found error (`Cannot find module '../json-to-yaml'`)

- [ ] **Step 3: 编写 YAML 转换核心实现**

```ts
/**
 * JSON 转 YAML 工具函数模块。
 *
 * 提供 JSON 到 YAML 的纯函数转换，基于 js-yaml 库的 dump 函数，
 * 以及 Web Worker 消息类型定义。
 */

import { dump } from 'js-yaml';
import { parseJsonSafe } from './json-diff';

// ---- 类型定义 ----

/** 转换成功结果 */
interface JsonConvertSuccess {
  ok: true;
  result: string;
}

/** 转换失败结果 */
interface JsonConvertError {
  ok: false;
  error: string;
}

/** YAML 转换返回类型 */
export type JsonToYamlResult = JsonConvertSuccess | JsonConvertError;

/** YAML Worker 请求 */
export interface JsonToYamlWorkerRequest {
  json: string;
}

/** YAML Worker 响应 */
export type JsonToYamlWorkerResponse = JsonConvertSuccess | JsonConvertError;

// ---- 常量 ----

/** 输入大小硬限制（10MB） */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;

/** Worker 阈值（500KB），超过使用 Worker */
export const WORKER_THRESHOLD = 500 * 1024;

// ---- 公开 API ----

/**
 * 将 JSON 数据转换为 YAML 字符串。
 *
 * 内部使用 `parseJsonSafe` 解析 JSON 文本（字符串输入时），
 * 或直接接收已解析数据（对象输入时，用于测试循环引用场景）。
 * YAML 输出选项：indent=2, noRefs=true, sortKeys=false, lineWidth=0。
 *
 * @param input - JSON 文本（string）或已解析数据（unknown）
 * @returns 转换结果
 */
export function convertJsonToYaml(input: string | unknown): JsonToYamlResult {
  let data: unknown;
  if (typeof input === 'string') {
    const parseResult = parseJsonSafe(input);
    if (!parseResult.ok) {
      return { ok: false, error: parseResult.error };
    }
    data = parseResult.data;
  } else {
    data = input;
  }

  try {
    const result = dump(data, {
      indent: 2,
      noRefs: true,
      sortKeys: false,
      lineWidth: 0,
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('circular') || msg.includes('Circular')) {
      return { ok: false, error: 'JSON 包含循环引用，无法转换为 YAML' };
    }
    return { ok: false, error: `转换失败：${msg}` };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/format/__tests__/json-to-yaml.test.ts`

Expected: PASS（9 tests passed）

- [ ] **Step 5: Commit**

```bash
git add src/utils/format/json-to-yaml.ts src/utils/format/__tests__/json-to-yaml.test.ts
git commit -m "feat(json-to-yaml): 添加 YAML 转换核心与单元测试"
```

---

## Task 5: YAML Web Worker

**Files:**
- Create: `src/utils/format/json-to-yaml.worker.ts`

- [ ] **Step 1: 创建 YAML Worker**

```ts
/**
 * JSON 转 YAML Web Worker。
 *
 * 用于大文件（>500KB）的异步转换，避免阻塞主线程。
 */
import {
  convertJsonToYaml,
  type JsonToYamlWorkerRequest,
  type JsonToYamlWorkerResponse,
} from './json-to-yaml';

self.onmessage = (e: MessageEvent<JsonToYamlWorkerRequest>) => {
  const { json } = e.data;

  try {
    const result = convertJsonToYaml(json);
    self.postMessage(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: JsonToYamlWorkerResponse = { ok: false, error: `转换执行出错：${msg}` };
    self.postMessage(resp);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/format/json-to-yaml.worker.ts
git commit -m "feat(json-to-yaml): 添加 YAML 转换 Web Worker"
```

---

## Task 6: JsonToXml.vue 组件

**Files:**
- Create: `src/tools/format/JsonToXml.vue`

组件行为：
- 页面加载自动聚焦 JSON 输入框
- 500ms 防抖自动转换（监听 inputText + rootName）
- 输入为空时清空输出和错误
- 输入大小 >10MB 时报错
- 输入大小 >500KB 时走 Web Worker
- 根元素名实时校验（非空 + 合法字符）
- 输出区提供复制结果和清空按钮
- 默认填入示例 JSON

- [ ] **Step 1: 创建 JsonToXml.vue 组件**

```vue
<script setup lang="ts">
/**
 * JSON 转 XML 主组件。
 *
 * 支持实时 JSON 到 XML 转换，可自定义根元素名，
 * 大文件通过 Web Worker 异步处理，避免阻塞 UI。
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  convertJsonToXml,
  validateRootName,
  type JsonToXmlWorkerResponse,
  INPUT_SIZE_LIMIT,
  WORKER_THRESHOLD,
} from '../../utils/format/json-to-xml';

// ---- 常量 ----

/** 示例 JSON */
const EXAMPLE_JSON = `{
  "users": [
    { "name": "Alice", "age": 30, "active": true },
    { "name": "Bob", "age": null, "active": false }
  ],
  "count": 2,
  "meta": { "version": "1.0" }
}`;

/** 防抖延迟 */
const DEBOUNCE_MS = 500;

// ---- 状态 ----

/** 输入文本 */
const inputText = ref(EXAMPLE_JSON);
/** 根元素名 */
const rootName = ref('root');
/** 输出文本 */
const outputText = ref('');
/** 输入错误信息 */
const errorMessage = ref('');
/** 根元素名错误 */
const rootNameError = ref('');
/** 是否正在加载 */
const isLoading = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;
/** textarea ref（用于自动聚焦） */
const textareaRef = ref<HTMLTextAreaElement | null>(null);
/** 防抖定时器 */
let convertTimer: ReturnType<typeof setTimeout> | null = null;

// ---- 核心操作 ----

/** 重置输出状态 */
function resetOutput(): void {
  outputText.value = '';
  errorMessage.value = '';
}

/** 设置错误 */
function setError(msg: string): void {
  errorMessage.value = msg;
  outputText.value = '';
}

/** 设置输出 */
function setOutput(result: string): void {
  outputText.value = result;
  errorMessage.value = '';
}

/** 检查输入大小 */
function checkSize(): boolean {
  const size = new TextEncoder().encode(inputText.value).length;
  if (size > INPUT_SIZE_LIMIT) {
    setError('数据量超过 10MB 限制，无法处理');
    return false;
  }
  return true;
}

/** 执行转换 */
async function handleConvert(): Promise<void> {
  if (!inputText.value.trim()) {
    resetOutput();
    return;
  }

  if (!checkSize()) return;

  const rootValidation = validateRootName(rootName.value);
  if (!rootValidation.ok) {
    rootNameError.value = rootValidation.error;
    outputText.value = '';
    return;
  }
  rootNameError.value = '';

  const inputSize = new TextEncoder().encode(inputText.value).length;
  if (inputSize > WORKER_THRESHOLD) {
    await convertWithWorker();
  } else {
    convertSync();
  }
}

/** 同步转换 */
function convertSync(): void {
  const result = convertJsonToXml(inputText.value, rootName.value);
  if (!result.ok) {
    setError(result.error);
    return;
  }
  setOutput(result.result);
}

/** Worker 异步转换 */
async function convertWithWorker(): Promise<void> {
  if (!worker) {
    initWorker();
  }

  isLoading.value = true;

  await new Promise<void>((resolve, reject) => {
    if (!worker) {
      reject(new Error('Worker 初始化失败'));
      return;
    }

    worker.onmessage = (e: MessageEvent<JsonToXmlWorkerResponse>) => {
      isLoading.value = false;
      const response = e.data;
      if (!response.ok) {
        setError(response.error);
        reject(new Error(response.error));
        return;
      }
      setOutput(response.result);
      resolve();
    };

    worker.onerror = () => {
      isLoading.value = false;
      setError('转换执行出错，请重试');
      reject(new Error('Worker 执行出错'));
    };

    worker.postMessage({ json: inputText.value, rootName: rootName.value });
  });
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-to-xml.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

/** 清空所有状态 */
function handleClear(): void {
  inputText.value = '';
  rootName.value = 'root';
  resetOutput();
  rootNameError.value = '';
}

/** 防抖触发转换 */
function scheduleConvert(): void {
  if (convertTimer !== null) {
    clearTimeout(convertTimer);
  }
  convertTimer = setTimeout(() => {
    handleConvert();
  }, DEBOUNCE_MS);
}

// ---- 监听与生命周期 ----

/** 监听输入和根元素名变化，自动触发转换 */
watch([inputText, rootName], () => {
  scheduleConvert();
}, { immediate: true });

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus();
  });
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (convertTimer !== null) {
    clearTimeout(convertTimer);
  }
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <!-- 头部 -->
    <ToolHeader
      title="JSON 转 XML"
      description="将 JSON 数据转换为 XML 格式，支持自定义根元素名"
      :show-example="false"
    />

    <!-- 根元素名选项与操作按钮 -->
    <div class="flex flex-wrap items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-[0.8125rem] text-muted">根元素名：</label>
        <input
          v-model="rootName"
          type="text"
          class="px-3 py-1.5 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 w-32"
          placeholder="root"
        />
      </div>
      <div v-if="rootNameError" class="text-[0.75rem] text-error">{{ rootNameError }}</div>

      <div class="ml-auto flex gap-2">
        <CopyButton :text="outputText" label="复制结果" />
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #input>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">JSON 输入</label>
          <textarea
            v-model="inputText"
            ref="textareaRef"
            class="w-full h-[calc(100vh-360px)] min-h-80 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            placeholder="粘贴或输入 JSON 数据..."
            spellcheck="false"
            aria-label="JSON 输入"
          />
          <div
            v-if="errorMessage"
            id="json-error"
            class="mt-1 text-[0.75rem] text-error"
          >
            {{ errorMessage }}
          </div>
        </div>
      </template>

      <template #output>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">XML 输出</label>
          <div
            v-if="isLoading"
            class="w-full h-[calc(100vh-360px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            转换中...
          </div>
          <pre
            v-else-if="outputText"
            class="w-full h-[calc(100vh-360px)] min-h-80 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap"
          >{{ outputText }}</pre>
          <div
            v-else
            class="w-full h-[calc(100vh-360px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            输入 JSON 后自动转换为 XML
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/format/JsonToXml.vue
git commit -m "feat(json-to-xml): 添加 JsonToXml.vue 主组件"
```

---

## Task 7: JsonToYaml.vue 组件

**Files:**
- Create: `src/tools/format/JsonToYaml.vue`

组件行为与 JsonToXml.vue 基本一致，区别：
- 无根元素名选项
- 使用 `convertJsonToYaml` 和 `json-to-yaml.worker.ts`
- YAML Worker 请求只有 `json` 字段

- [ ] **Step 1: 创建 JsonToYaml.vue 组件**

```vue
<script setup lang="ts">
/**
 * JSON 转 YAML 主组件。
 *
 * 支持实时 JSON 到 YAML 转换，大文件通过 Web Worker 异步处理。
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  convertJsonToYaml,
  type JsonToYamlWorkerResponse,
  INPUT_SIZE_LIMIT,
  WORKER_THRESHOLD,
} from '../../utils/format/json-to-yaml';

// ---- 常量 ----

/** 示例 JSON */
const EXAMPLE_JSON = `{
  "users": [
    { "name": "Alice", "age": 30, "active": true },
    { "name": "Bob", "age": null, "active": false }
  ],
  "count": 2,
  "meta": { "version": "1.0" }
}`;

/** 防抖延迟 */
const DEBOUNCE_MS = 500;

// ---- 状态 ----

/** 输入文本 */
const inputText = ref(EXAMPLE_JSON);
/** 输出文本 */
const outputText = ref('');
/** 错误信息 */
const errorMessage = ref('');
/** 是否正在加载 */
const isLoading = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;
/** textarea ref */
const textareaRef = ref<HTMLTextAreaElement | null>(null);
/** 防抖定时器 */
let convertTimer: ReturnType<typeof setTimeout> | null = null;

// ---- 核心操作 ----

/** 重置输出状态 */
function resetOutput(): void {
  outputText.value = '';
  errorMessage.value = '';
}

/** 设置错误 */
function setError(msg: string): void {
  errorMessage.value = msg;
  outputText.value = '';
}

/** 设置输出 */
function setOutput(result: string): void {
  outputText.value = result;
  errorMessage.value = '';
}

/** 检查输入大小 */
function checkSize(): boolean {
  const size = new TextEncoder().encode(inputText.value).length;
  if (size > INPUT_SIZE_LIMIT) {
    setError('数据量超过 10MB 限制，无法处理');
    return false;
  }
  return true;
}

/** 执行转换 */
async function handleConvert(): Promise<void> {
  if (!inputText.value.trim()) {
    resetOutput();
    return;
  }

  if (!checkSize()) return;

  const inputSize = new TextEncoder().encode(inputText.value).length;
  if (inputSize > WORKER_THRESHOLD) {
    await convertWithWorker();
  } else {
    convertSync();
  }
}

/** 同步转换 */
function convertSync(): void {
  const result = convertJsonToYaml(inputText.value);
  if (!result.ok) {
    setError(result.error);
    return;
  }
  setOutput(result.result);
}

/** Worker 异步转换 */
async function convertWithWorker(): Promise<void> {
  if (!worker) {
    initWorker();
  }

  isLoading.value = true;

  await new Promise<void>((resolve, reject) => {
    if (!worker) {
      reject(new Error('Worker 初始化失败'));
      return;
    }

    worker.onmessage = (e: MessageEvent<JsonToYamlWorkerResponse>) => {
      isLoading.value = false;
      const response = e.data;
      if (!response.ok) {
        setError(response.error);
        reject(new Error(response.error));
        return;
      }
      setOutput(response.result);
      resolve();
    };

    worker.onerror = () => {
      isLoading.value = false;
      setError('转换执行出错，请重试');
      reject(new Error('Worker 执行出错'));
    };

    worker.postMessage({ json: inputText.value });
  });
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-to-yaml.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

/** 清空所有状态 */
function handleClear(): void {
  inputText.value = '';
  resetOutput();
}

/** 防抖触发转换 */
function scheduleConvert(): void {
  if (convertTimer !== null) {
    clearTimeout(convertTimer);
  }
  convertTimer = setTimeout(() => {
    handleConvert();
  }, DEBOUNCE_MS);
}

// ---- 监听与生命周期 ----

/** 监听输入变化，自动触发转换 */
watch(inputText, () => {
  scheduleConvert();
}, { immediate: true });

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus();
  });
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (convertTimer !== null) {
    clearTimeout(convertTimer);
  }
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <!-- 头部 -->
    <ToolHeader
      title="JSON 转 YAML"
      description="将 JSON 数据转换为标准 YAML 格式"
      :show-example="false"
    />

    <!-- 操作按钮 -->
    <div class="flex flex-wrap items-center gap-2 mb-4 justify-end">
      <CopyButton :text="outputText" label="复制结果" />
      <ClearButton @clear="handleClear" />
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #input>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">JSON 输入</label>
          <textarea
            v-model="inputText"
            ref="textareaRef"
            class="w-full h-[calc(100vh-320px)] min-h-80 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            placeholder="粘贴或输入 JSON 数据..."
            spellcheck="false"
            aria-label="JSON 输入"
          />
          <div
            v-if="errorMessage"
            id="json-error"
            class="mt-1 text-[0.75rem] text-error"
          >
            {{ errorMessage }}
          </div>
        </div>
      </template>

      <template #output>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">YAML 输出</label>
          <div
            v-if="isLoading"
            class="w-full h-[calc(100vh-320px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            转换中...
          </div>
          <pre
            v-else-if="outputText"
            class="w-full h-[calc(100vh-320px)] min-h-80 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap"
          >{{ outputText }}</pre>
          <div
            v-else
            class="w-full h-[calc(100vh-320px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            输入 JSON 后自动转换为 YAML
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/format/JsonToYaml.vue
git commit -m "feat(json-to-yaml): 添加 JsonToYaml.vue 主组件"
```

---

## Task 8: Astro 页面路由

**Files:**
- Create: `src/pages/format/json-to-xml.astro`
- Create: `src/pages/format/json-to-yaml.astro`

- [ ] **Step 1: 创建 XML 工具页面**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import JsonToXml from '../../tools/format/JsonToXml.vue';
---

<ToolLayout title="JSON 转 XML - DevTools" toolId="format/json-to-xml">
  <JsonToXml client:idle />
</ToolLayout>
```

- [ ] **Step 2: 创建 YAML 工具页面**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import JsonToYaml from '../../tools/format/JsonToYaml.vue';
---

<ToolLayout title="JSON 转 YAML - DevTools" toolId="format/json-to-yaml">
  <JsonToYaml client:idle />
</ToolLayout>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/format/json-to-xml.astro src/pages/format/json-to-yaml.astro
git commit -m "feat: 添加 JSON 转 XML/YAML 页面路由"
```

---

## Task 9: 工具注册

**Files:**
- Modify: `src/data/tools.ts`

在 `json-diff` 工具条目之后插入两个新工具。注意保持数组末尾没有尾随逗号（或遵循现有格式）。

- [ ] **Step 1: 修改 tools.ts 注册两个新工具**

找到 `src/data/tools.ts` 中 `json-diff` 条目（约第 221-229 行），在其后插入：

```ts
  {
    id: 'json-to-xml',
    name: 'JSON 转 XML',
    description: '将 JSON 数据转换为 XML 格式，支持自定义根元素名',
    seoDescription: '在线 JSON 转 XML 工具，输入 JSON 即可生成标准 XML，支持自定义根元素名，纯浏览器端运算不上传数据。',
    category: '格式化',
    icon: '🌲',
    path: '/format/json-to-xml',
  },
  {
    id: 'json-to-yaml',
    name: 'JSON 转 YAML',
    description: '将 JSON 数据转换为标准 YAML 格式',
    seoDescription: '在线 JSON 转 YAML 工具，输入 JSON 即可生成标准 YAML 配置格式，纯浏览器端运算不上传数据。',
    category: '格式化',
    icon: '📝',
    path: '/format/json-to-yaml',
  },
```

注意：如果 `json-diff` 条目是数组最后一个元素（当前没有尾随逗号），需要先给它加上逗号，再插入新条目。

- [ ] **Step 2: Commit**

```bash
git add src/data/tools.ts
git commit -m "feat: 注册 JSON 转 XML/YAML 工具"
```

---

## Task 10: 构建与测试验证

**Files:** 无新增/修改

- [ ] **Step 1: 运行单元测试**

Run: `pnpm test`

Expected: 所有测试通过（包括原有的 json-diff 测试和新增的 xml/yaml 测试）

- [ ] **Step 2: 运行生产构建**

Run: `pnpm build`

Expected: 构建成功，无 TypeScript 类型错误，无 Vite 打包错误

- [ ] **Step 3: 最终 Commit**

```bash
git commit --allow-empty -m "feat(json-xml-yaml): JSON 转 XML/YAML 工具实现完成"
```

---

## 快速验证清单（手动 Smoke Test）

启动开发服务器后，依次验证：

1. **路由可访问**
   - `http://localhost:4321/format/json-to-xml` 正常加载
   - `http://localhost:4321/format/json-to-yaml` 正常加载

2. **自动转换**
   - 两个页面打开时均自动显示转换结果（示例 JSON 已填入）
   - 修改 JSON 输入，500ms 后输出自动更新

3. **XML 特有功能**
   - 修改根元素名，XML 输出自动更新
   - 根元素名留空或输入 `@#$`，显示错误提示

4. **错误处理**
   - 输入 `{bad}`，显示 JSON 语法错误（含中文）
   - 清空输入，输出区恢复空状态

5. **复制与清空**
   - 点击"复制结果"，触发 Toast"已复制"
   - 点击"清空"，输入/输出均清空，根元素名重置为 `root`

6. **大文件 Worker**
   - 粘贴 >500KB 的 JSON，转换时显示"转换中..."，不阻塞输入

---

## Self-Review

### 1. Spec Coverage

| 设计文档章节 | 覆盖任务 |
|-------------|---------|
| §1 概述（两个独立工具） | Task 2-9 分别覆盖 XML 和 YAML |
| §2 设计决策（页面拆分、XML 策略、js-yaml） | Task 8（页面拆分）、Task 2（XML 策略）、Task 1/4（js-yaml）|
| §3 工具注册信息 | Task 9 |
| §4 文件结构 | 计划头部 File Structure 已映射 |
| §5 组件交互（防抖 500ms、自动聚焦、复制/清空） | Task 6/7 |
| §6 转换逻辑（XML 算法、YAML dump 选项、类型、Worker 协议） | Task 2/3/4/5 |
| §7 默认值（示例 JSON） | Task 6/7 中的 EXAMPLE_JSON |
| §8 错误处理（全部 9 种场景） | Task 2（核心错误）、Task 6/7（组件错误展示） |
| §9 依赖（js-yaml） | Task 1 |
| §10 测试策略 | Task 2/4 |
| §11 性能与合规 | Task 3/5（Worker）、Task 10（构建验证） |

无 gaps。

### 2. Placeholder Scan

- 无 "TBD" / "TODO" / "implement later"
- 无 "Add appropriate error handling" 等模糊描述
- 所有代码步骤均包含完整实现代码
- 无 "Similar to Task N" 省略
- 所有测试代码均包含具体断言

### 3. Type Consistency

- `JsonToXmlResult` / `JsonToYamlResult` 均基于 `{ ok: true; result: string } | { ok: false; error: string }`
- Worker 请求/响应类型与主模块一致
- `validateRootName` 返回类型在两个任务中一致
- 组件中的 Worker 响应类型导入路径正确

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-09-json-xml-yaml-converter.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
