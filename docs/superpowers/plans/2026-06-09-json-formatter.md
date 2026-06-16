# JSON 格式化器 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/format/json-formatter` 工具页面，支持 JSON 美化、压缩、验证、JSON Path 查询和统计信息。

**Architecture:** 纯前端工具页面，使用 Vue 3 组件 + 纯函数模块。Prism.js 负责 JSON 分词高亮，jsonpath-plus 负责 Path 查询，大文件（>1MB）通过 Web Worker 异步解析避免阻塞 UI。所有计算在浏览器端完成。

**Tech Stack:** Astro 6 + Vue 3 Composition API + TypeScript + Tailwind CSS + Prism.js + jsonpath-plus

---

## File Map

| 操作   | 文件路径                                          | 职责                                   |
| ------ | ------------------------------------------------- | -------------------------------------- |
| Create | `src/utils/format/json-formatter.ts`              | 纯函数：格式化/压缩/验证/统计/错误解析  |
| Create | `src/utils/format/json-parse.worker.ts`            | Web Worker：大文件解析                  |
| Create | `src/tools/format/JsonFormatter.vue`               | 主交互 Vue 组件                         |
| Create | `src/pages/format/json-formatter.astro`            | 页面壳                                 |
| Modify | `src/data/tools.ts`                                | 新增工具注册条目                        |

---

### Task 1: 安装依赖

**Files:** 无文件变更

- [ ] **Step 1: 安装 prismjs 和 jsonpath-plus**

```bash
pnpm add prismjs jsonpath-plus
```

- [ ] **Step 2: 安装类型声明**

```bash
pnpm add -D @types/prismjs
```

- [ ] **Step 3: 验证安装成功**

```bash
pnpm ls prismjs jsonpath-plus
```

Expected: 显示 prismjs 和 jsonpath-plus 版本号

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 添加 prismjs 和 jsonpath-plus 依赖"
```

---

### Task 2: 创建纯函数模块 `json-formatter.ts`

**Files:**
- Create: `src/utils/format/json-formatter.ts`

- [ ] **Step 1: 创建文件**

```typescript
/**
 * JSON 格式化器工具函数模块。
 *
 * 提供 JSON 美化、压缩、验证、JSON Path 查询、统计计算等纯函数，
 * 以及 Web Worker 消息类型定义。
 */

/** JSON 统计信息 */
export interface JsonStats {
  /** 节点总数（key-value 对，含嵌套） */
  nodeCount: number;
  /** 最大嵌套层级 */
  maxDepth: number;
  /** 原始输入字节数 */
  byteSize: number;
  /** 行数 */
  lineCount: number;
}

/** 操作成功结果 */
export interface SuccessResult {
  ok: true;
  result: string;
  stats?: JsonStats;
}

/** 操作失败结果 */
export interface ErrorResult {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

/** 操作返回类型 */
export type OperationResult = SuccessResult | ErrorResult;

/** 验证结果 */
export interface ValidationResult {
  ok: boolean;
  message: string;
  line?: number;
  column?: number;
}

/** JSON Path 查询成功结果 */
export interface PathQuerySuccess {
  ok: true;
  results: unknown[];
}

/** JSON Path 查询失败结果 */
export interface PathQueryError {
  ok: false;
  error: string;
}

/** JSON Path 查询返回类型 */
export type PathQueryResult = PathQuerySuccess | PathQueryError;

/** Web Worker 请求消息 */
export interface WorkerRequest {
  json: string;
}

/** Web Worker 成功响应 */
export interface WorkerSuccessResponse {
  ok: true;
  parsed: unknown;
  stats: JsonStats;
}

/** Web Worker 错误响应 */
export interface WorkerErrorResponse {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

/** Web Worker 响应类型 */
export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

/** 缩进选项值类型 */
export type IndentValue = 2 | 4 | 8 | 'tab';

/** 输入大小软限制（5MB），超过显示警告 */
export const INPUT_SIZE_WARNING = 5 * 1024 * 1024;
/** 输入大小硬限制（10MB），超过拒绝处理 */
export const INPUT_SIZE_LIMIT = 10 * 1024 * 1024;
/** Worker 阈值（1MB），超过使用 Worker 解析 */
export const WORKER_THRESHOLD = 1 * 1024 * 1024;

/** 示例 JSON 数据 */
export const EXAMPLE_JSON = `{
  "name": "DevTools",
  "version": "1.0.0",
  "features": ["格式化", "压缩", "验证"],
  "config": {
    "indent": 2,
    "theme": "light"
  },
  "active": true,
  "lastUpdate": null
}`;

/** 缩进选项列表（供 SelectListbox 使用） */
export const INDENT_OPTIONS: { value: IndentValue; label: string }[] = [
  { value: 2, label: '2 空格' },
  { value: 4, label: '4 空格' },
  { value: 8, label: '8 空格' },
  { value: 'tab', label: 'Tab' },
];

/**
 * 将字节数格式化为可读单位。
 *
 * @param bytes - 字节数
 * @returns 格式化后的字符串，如 "1.2 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 计算输入数据的统计信息。
 *
 * @param input - 原始 JSON 字符串
 * @param parsed - 已解析的 JSON 对象
 * @returns 统计信息
 */
export function computeStats(input: string, parsed: unknown): JsonStats {
  return {
    nodeCount: countNodes(parsed),
    maxDepth: measureDepth(parsed),
    byteSize: new TextEncoder().encode(input).length,
    lineCount: input.split('\n').length,
  };
}

/**
 * 美化格式化 JSON。
 *
 * @param input - 原始 JSON 字符串
 * @param indent - 缩进值（数字或 'tab'）
 * @returns 操作结果
 */
export function formatJson(input: string, indent: IndentValue = 2): OperationResult {
  try {
    const parsed = JSON.parse(input);
    const indentStr = indent === 'tab' ? '\t' : indent;
    const result = JSON.stringify(parsed, null, indentStr);
    const stats = computeStats(input, parsed);
    return { ok: true, result, stats };
  } catch (e) {
    return handleError(e, input);
  }
}

/**
 * 压缩 JSON 为最小体积。
 *
 * @param input - 原始 JSON 字符串
 * @returns 操作结果
 */
export function minifyJson(input: string): OperationResult {
  try {
    const parsed = JSON.parse(input);
    const result = JSON.stringify(parsed);
    const stats = computeStats(input, parsed);
    return { ok: true, result, stats };
  } catch (e) {
    return handleError(e, input);
  }
}

/**
 * 验证 JSON 格式，不做修改。
 *
 * @param input - 原始 JSON 字符串
 * @returns 验证结果
 */
export function validateJson(input: string): ValidationResult {
  try {
    JSON.parse(input);
    return { ok: true, message: '✓ JSON 格式有效' };
  } catch (e) {
    const pos = parseErrorPosition(e, input);
    return {
      ok: false,
      message: `JSON 语法错误：${extractErrorMessage(e)}`,
      ...pos,
    };
  }
}

/**
 * 执行 JSON Path 查询。
 *
 * @param input - 原始 JSON 字符串
 * @param path - JSON Path 表达式
 * @returns 查询结果
 */
export async function queryJsonPath(input: string, path: string): Promise<PathQueryResult> {
  try {
    const parsed = JSON.parse(input);
    const { JSONPath } = await import('jsonpath-plus');
    const results = JSONPath({ path, json: parsed, resultType: 'value' });
    if (!Array.isArray(results) || results.length === 0) {
      return { ok: true, results: [] };
    }
    return { ok: true, results };
  } catch (e) {
    if (e instanceof SyntaxError && String(e.message).includes('JSON')) {
      return { ok: false, error: `JSON 语法错误：${e.message}` };
    }
    return { ok: false, error: `JSON Path 表达式错误：${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * 检查输入大小是否超限。
 *
 * @param input - 原始输入字符串
 * @returns 状态：'ok'、'warning' 或 'error'
 */
export function checkInputSize(input: string): 'ok' | 'warning' | 'error' {
  const size = new TextEncoder().encode(input).length;
  if (size > INPUT_SIZE_LIMIT) return 'error';
  if (size > INPUT_SIZE_WARNING) return 'warning';
  return 'ok';
}

// ---- 内部辅助函数 ----

/**
 * 递归计算 JSON 对象的节点数。
 */
function countNodes(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 1;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countNodes(item), 0);
  }
  return Object.values(obj as Record<string, unknown>).reduce(
    (sum, val) => sum + countNodes(val),
    0,
  );
}

/**
 * 递归计算 JSON 对象的最大嵌套深度。
 */
function measureDepth(obj: unknown): number {
  if (obj === null || typeof obj !== 'object') return 0;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 1;
    return 1 + Math.max(...obj.map(measureDepth));
  }
  const values = Object.values(obj as Record<string, unknown>);
  if (values.length === 0) return 1;
  return 1 + Math.max(...values.map(measureDepth));
}

/**
 * 从 JSON.parse 错误中提取行列号。
 */
function parseErrorPosition(e: unknown, input: string): { line?: number; column?: number } {
  const msg = e instanceof Error ? e.message : String(e);
  const posMatch = msg.match(/position\s+(\d+)/i);
  if (!posMatch) return {};
  const pos = parseInt(posMatch[1], 10);
  const beforeError = input.substring(0, pos);
  const line = beforeError.split('\n').length;
  const lastNewline = beforeError.lastIndexOf('\n');
  const column = lastNewline === -1 ? pos + 1 : pos - lastNewline;
  return { line, column };
}

/**
 * 从错误对象中提取消息。
 */
function extractErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const msg = e.message;
  // 将英文常见错误关键词翻译为中文
  return msg
    .replace(/Unexpected token/i, '意外的字符')
    .replace(/Unexpected end of JSON input/i, 'JSON 数据意外结束')
    .replace(/Expected property name/i, '期望属性名')
    .replace(/Expected ':'/i, '期望冒号 ":"')
    .replace(/Bad control character/i, '非法控制字符')
    .replace(/Bad string/i, '非法字符串')
    .replace(/Bad escape sequence/i, '非法转义序列');
}

/**
 * 统一处理 JSON.parse 错误，返回 ErrorResult。
 */
function handleError(e: unknown, input: string): ErrorResult {
  const pos = parseErrorPosition(e, input);
  const message = extractErrorMessage(e);
  let error = `JSON 语法错误：${message}`;
  if (pos.line !== undefined && pos.column !== undefined) {
    error += `（第 ${pos.line} 行，第 ${pos.column} 列）`;
  }
  return { ok: false, error, ...pos };
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit src/utils/format/json-formatter.ts
```

Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/utils/format/json-formatter.ts
git commit -m "feat(json-formatter): 添加 JSON 格式化器纯函数模块"
```

---

### Task 3: 创建 Web Worker `json-parse.worker.ts`

**Files:**
- Create: `src/utils/format/json-parse.worker.ts`

- [ ] **Step 1: 创建文件**

```typescript
/**
 * JSON 解析 Web Worker。
 *
 * 用于大文件（>1MB）的异步 JSON 解析，避免阻塞主线程。
 * 接收原始 JSON 字符串，返回解析结果和统计信息。
 */
import { computeStats, type WorkerRequest, type WorkerResponse } from './json-formatter';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { json } = e.data;
  try {
    const parsed = JSON.parse(json);
    const stats = computeStats(json, parsed);
    const response: WorkerResponse = { ok: true, parsed, stats };
    self.postMessage(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const response: WorkerResponse = { ok: false, error: msg };
    self.postMessage(response);
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/format/json-parse.worker.ts
git commit -m "feat(json-formatter): 添加 JSON 解析 Web Worker"
```

---

### Task 4: 在工具注册表中添加 JSON 格式化器条目

**Files:**
- Modify: `src/data/tools.ts` (在 `tools` 数组末尾，`cron-parser` 条目之后)

- [ ] **Step 1: 在 tools 数组末尾添加条目**

在 `cron-parser` 条目（第 211 行附近）之后、`];` 之前，添加：

```typescript
  {
    id: 'json-formatter',
    name: 'JSON 格式化器',
    description: '在线 JSON 格式化、压缩、验证与查询工具',
    seoDescription: '在线 JSON 格式化工具，支持美化、压缩、验证与 JSON Path 查询，实时语法高亮与统计信息，纯浏览器端运算。',
    category: '格式化',
    icon: '📋',
    path: '/format/json-formatter',
  },
```

- [ ] **Step 2: 验证工具注册无报错**

```bash
pnpm build 2>&1 | head -20
```

Expected: 构建开始无 TS 报错

- [ ] **Step 3: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat(json-formatter): 注册工具条目到 tools.ts"
```

---

### Task 5: 创建页面壳 `json-formatter.astro`

**Files:**
- Create: `src/pages/format/json-formatter.astro`

- [ ] **Step 1: 创建文件**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import JsonFormatter from '../../tools/format/JsonFormatter.vue';
---

<ToolLayout title="JSON 格式化器 - DevTools" toolId="format/json-formatter">
  <JsonFormatter client:idle />
</ToolLayout>
```

- [ ] **Step 2: 提交**

```bash
git add src/pages/format/json-formatter.astro
git commit -m "feat(json-formatter): 创建页面壳"
```

---

### Task 6: 创建主 Vue 组件 `JsonFormatter.vue`（核心框架）

**Files:**
- Create: `src/tools/format/JsonFormatter.vue`

这是最大的任务，组件包含完整的交互逻辑、布局、Prism.js 高亮、Worker 通信。

- [ ] **Step 1: 创建组件文件**

```vue
<script setup lang="ts">
/**
 * JSON 格式化器主组件。
 *
 * 支持 JSON 美化、压缩、验证和 JSON Path 查询，
 * 使用 Prism.js 实现语法高亮，大文件通过 Web Worker 异步解析。
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Prism from 'prismjs';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  formatJson,
  minifyJson,
  validateJson,
  queryJsonPath,
  checkInputSize,
  formatBytes,
  EXAMPLE_JSON,
  INDENT_OPTIONS,
  WORKER_THRESHOLD,
  type IndentValue,
  type JsonStats,
  type OperationResult,
  type PathQueryResult,
  type ValidationResult,
  type WorkerResponse,
} from '../../utils/format/json-formatter';

// ---- 状态 ----

/** 输入文本（默认填入示例） */
const inputText = ref(EXAMPLE_JSON);
/** 输出文本（纯文本，用于复制） */
const outputText = ref('');
/** 高亮后的 HTML（用于渲染） */
const highlightedHtml = ref('');
/** 错误信息 */
const errorMessage = ref('');
/** 当前是否为错误状态 */
const isError = ref(false);
/** 统计信息 */
const stats = ref<JsonStats | null>(null);
/** 缩进值 */
const indent = ref<IndentValue>(2);
/** JSON Path 查询表达式 */
const queryPath = ref('');
/** 输入大小警告状态 */
const sizeWarning = ref<'ok' | 'warning' | 'error'>('ok');
/** Worker 实例 */
let worker: Worker | null = null;
/** 是否正在加载（Worker 场景） */
const isLoading = ref(false);
/** 文件输入 ref */
const fileInputRef = ref<HTMLInputElement | null>(null);
/** 拖拽状态 */
const isDragging = ref(false);

// ---- 计算属性 ----

/** 输出区显示内容（纯文本，用于复制按钮） */
const copyableText = computed(() => outputText.value);

/** 统计信息文本 */
const statsText = computed(() => {
  if (!stats.value) return '';
  const s = stats.value;
  return `节点: ${s.nodeCount}  深度: ${s.maxDepth}  ${formatBytes(s.byteSize)}  ${s.lineCount} 行`;
});

// ---- 核心操作 ----

/** 重置输出状态 */
function resetOutput(): void {
  outputText.value = '';
  highlightedHtml.value = '';
  errorMessage.value = '';
  isError.value = false;
  stats.value = null;
}

/** 设置错误输出 */
function setError(msg: string): void {
  errorMessage.value = msg;
  isError.value = true;
  outputText.value = '';
  highlightedHtml.value = '';
}

/** 设置成功输出 */
function setOutput(text: string, highlight = true): void {
  outputText.value = text;
  errorMessage.value = '';
  isError.value = false;
  if (highlight) {
    highlightedHtml.value = Prism.highlight(text, Prism.languages.json, 'json');
  } else {
    // 压缩结果不做高亮，直接转义显示
    highlightedHtml.value = escapeHtml(text);
  }
}

/** HTML 转义 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 检查输入是否为空 */
function checkEmpty(): boolean {
  if (!inputText.value.trim()) {
    setError('请输入 JSON 数据');
    return true;
  }
  return false;
}

/** 检查输入大小限制 */
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
  if (checkEmpty() || !checkSize()) return;

  const inputSize = new TextEncoder().encode(inputText.value).length;

  if (inputSize > WORKER_THRESHOLD) {
    // 大文件：使用 Worker
    formatWithWorker('format');
  } else {
    const result = formatJson(inputText.value, indent.value);
    handleFormatResult(result);
  }
}

/** 压缩 */
function handleMinify(): void {
  resetOutput();
  if (checkEmpty() || !checkSize()) return;

  const inputSize = new TextEncoder().encode(inputText.value).length;

  if (inputSize > WORKER_THRESHOLD) {
    formatWithWorker('minify');
  } else {
    const result = minifyJson(inputText.value);
    handleFormatResult(result, false);
  }
}

/** 验证 */
function handleValidate(): void {
  resetOutput();
  if (checkEmpty()) return;

  const result = validateJson(inputText.value);
  if (result.ok) {
    // 验证通过也需要 parse 来算统计
    const formatResult = formatJson(inputText.value, indent.value);
    if (formatResult.ok) {
      stats.value = formatResult.stats ?? null;
    }
    setOutput(result.message, false);
  } else {
    let msg = result.message;
    if (result.line !== undefined && result.column !== undefined) {
      msg += `（第 ${result.line} 行，第 ${result.column} 列）`;
    }
    setError(msg);
  }
}

/** JSON Path 查询 */
async function handleQuery(): Promise<void> {
  resetOutput();
  if (checkEmpty()) return;

  const path = queryPath.value.trim();
  if (!path) {
    setError('请输入 JSON Path 表达式');
    return;
  }

  const result: PathQueryResult = await queryJsonPath(inputText.value, path);
  if (!result.ok) {
    setError(result.error);
    return;
  }

  if (result.results.length === 0) {
    setError('未找到匹配节点');
    return;
  }

  // 将查询结果格式化展示
  const formatted = result.results
    .map((r, i) => `[${i}] ${JSON.stringify(r, null, 2)}`)
    .join('\n\n');
  setOutput(formatted);
}

/** 处理格式化结果 */
function handleFormatResult(result: OperationResult, highlight = true): void {
  if (!result.ok) {
    setError(result.error);
    return;
  }
  stats.value = result.stats ?? null;
  setOutput(result.result, highlight);
}

/** 使用 Worker 异步格式化 */
function formatWithWorker(mode: 'format' | 'minify'): void {
  if (!worker) {
    initWorker();
  }
  isLoading.value = true;
  worker!.postMessage({ json: inputText.value });
  // Worker 只做 parse，格式化在 onmessage 回调中完成
  workerMode = mode;
}

/** Worker 当前模式 */
let workerMode: 'format' | 'minify' = 'format';

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-parse.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    isLoading.value = false;
    const response = e.data;
    if (!response.ok) {
      setError(`JSON 语法错误：${response.error}`);
      return;
    }
    stats.value = response.stats;
    if (workerMode === 'format') {
      const indentStr = indent.value === 'tab' ? '\t' : indent.value;
      const result = JSON.stringify(response.parsed, null, indentStr);
      setOutput(result);
    } else {
      const result = JSON.stringify(response.parsed);
      setOutput(result, false);
    }
  };
  worker.onerror = () => {
    isLoading.value = false;
    setError('Worker 执行出错，请重试');
  };
}

// ---- 文件操作 ----

/** 处理文件上传 */
function handleFileUpload(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  readFile(file);
}

/** 处理拖拽文件 */
function handleDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();
  readFile(file);
}

/** 读取文件内容到输入框 */
function readFile(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      inputText.value = text;
    }
  };
  reader.readAsText(file);
}

/** 拖拽进入 */
function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = true;
}

/** 拖拽离开 */
function handleDragLeave(): void {
  isDragging.value = false;
}

// ---- 清空 ----

/** 清空所有状态 */
function handleClear(): void {
  inputText.value = '';
  queryPath.value = '';
  resetOutput();
  sizeWarning.value = 'ok';
}

// ---- 填入示例 ----

/** 填入示例数据 */
function handleExample(): void {
  inputText.value = EXAMPLE_JSON;
  resetOutput();
}

// ---- 监听输入大小 ----

watch(inputText, () => {
  const status = checkInputSize(inputText.value);
  sizeWarning.value = status;
});

// ---- 生命周期 ----

onMounted(() => {
  // 初始检查输入大小
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
  <div>
    <!-- 头部 -->
    <ToolHeader
      title="JSON 格式化器"
      description="在线 JSON 格式化、压缩、验证与查询工具"
      @example="handleExample"
    />

    <!-- 大小警告 -->
    <div
      v-if="sizeWarning === 'warning'"
      class="mb-4 px-4 py-2 border border-accent/30 rounded-sm bg-accent/5 text-sm text-accent"
    >
      ⚠ 数据量超过 5MB，可能导致浏览器卡顿
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal">
      <!-- 输入区 -->
      <template #input>
        <div class="relative">
          <textarea
            v-model="inputText"
            class="w-full h-80 p-4 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            :class="isDragging ? 'border-accent ring-2 ring-accent/20' : ''"
            placeholder="粘贴或输入 JSON 数据，支持拖拽 .json 文件..."
            spellcheck="false"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          />
          <!-- 隐藏的文件输入 -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            class="hidden"
            @change="handleFileUpload"
          />
        </div>

        <!-- 操作按钮栏 -->
        <div class="flex flex-wrap items-center gap-2 mt-3">
          <button
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
            @click="handleFormat"
          >
            美化
          </button>
          <button
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
            @click="handleMinify"
          >
            压缩
          </button>
          <button
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
            @click="handleValidate"
          >
            验证
          </button>

          <div class="flex items-center gap-1.5 ml-2">
            <span class="text-[0.8125rem] text-muted">缩进:</span>
            <SelectListbox
              v-model="indent"
              :options="INDENT_OPTIONS"
              class="w-24"
            />
          </div>

          <div class="ml-auto flex gap-2">
            <ClearButton @clear="handleClear" />
          </div>
        </div>

        <!-- 上传按钮 -->
        <button
          class="mt-2 px-4 py-1.5 border border-border rounded-sm bg-card text-muted text-[0.75rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-hover hover:text-text"
          @click="fileInputRef?.click()"
        >
          📁 上传 .json 文件
        </button>
      </template>

      <!-- 输出区 -->
      <template #output>
        <!-- 加载中 -->
        <div
          v-if="isLoading"
          class="w-full h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
        >
          正在解析...
        </div>

        <!-- 错误输出 -->
        <div
          v-else-if="isError"
          class="w-full h-80 p-4 border border-border rounded-sm bg-card overflow-auto"
        >
          <pre class="m-0 text-sm text-error whitespace-pre-wrap font-mono">{{ errorMessage }}</pre>
        </div>

        <!-- 正常输出 -->
        <div
          v-else-if="outputText"
          class="w-full h-80 p-4 border border-border rounded-sm bg-card overflow-auto"
        >
          <pre class="m-0 text-sm font-mono whitespace-pre-wrap leading-relaxed json-highlight" v-html="highlightedHtml"></pre>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="w-full h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
        >
          点击"美化"、"压缩"或"验证"按钮查看结果
        </div>

        <!-- 统计信息 + 复制 -->
        <div class="flex items-center justify-between mt-3">
          <span v-if="stats" class="text-[0.75rem] text-muted">{{ statsText }}</span>
          <span v-else class="text-[0.75rem] text-muted">统计信息将在操作后显示</span>
          <CopyButton :text="copyableText" label="复制结果" />
        </div>
      </template>
    </ResponsiveWorkspace>

    <!-- JSON Path 查询栏 -->
    <div class="mx-auto max-w-[1600px] mt-6">
      <div class="flex items-center gap-3">
        <label class="shrink-0 text-[0.8125rem] text-muted font-sans">JSON Path:</label>
        <input
          v-model="queryPath"
          type="text"
          class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          placeholder='输入 JSON Path 表达式，如 $.store.book[*].author'
          @keydown.enter="handleQuery"
        />
        <button
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
          @click="handleQuery"
        >
          查询
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* Prism.js JSON 语法高亮自定义样式（匹配项目设计令牌） */
.json-highlight .token.property {
  color: var(--color-text);
}
.json-highlight .token.string {
  color: var(--color-success);
}
.json-highlight .token.number {
  color: var(--color-accent);
}
.json-highlight .token.boolean,
.json-highlight .token.keyword {
  color: var(--color-muted);
}
.json-highlight .token.null {
  color: var(--color-muted);
}
.json-highlight .token.punctuation {
  color: var(--color-border);
}
.json-highlight .token.operator {
  color: var(--color-text);
}
</style>
```

- [ ] **Step 2: 启动开发服务器验证页面可加载**

```bash
pnpm dev
```

Expected: 访问 `http://localhost:4321/format/json-formatter` 能看到页面，点击"美化"按钮能正常格式化 JSON

- [ ] **Step 3: 提交**

```bash
git add src/tools/format/JsonFormatter.vue
git commit -m "feat(json-formatter): 添加 JSON 格式化器主组件"
```

---

### Task 7: 构建验证 & 边界测试

**Files:** 无新增

- [ ] **Step 1: 运行生产构建**

```bash
pnpm build
```

Expected: 构建成功，无 TS 错误、无 Astro 路由错误

- [ ] **Step 2: 预览构建结果**

```bash
pnpm preview
```

Expected: 访问 `/format/json-formatter` 页面正常加载

- [ ] **Step 3: 手动测试所有功能**

验证清单：
1. ✅ 页面加载时输入框默认有示例 JSON
2. ✅ 点击"美化"→ 右侧显示格式化 JSON + 语法高亮
3. ✅ 点击"压缩"→ 右侧显示单行压缩 JSON
4. ✅ 点击"验证"→ 合法 JSON 显示"✓ JSON 格式有效"
5. ✅ 输入非法 JSON → 点击美化/压缩/验证，显示中文错误信息 + 行列号
6. ✅ JSON Path 输入 `$.features` → 点击查询 → 显示匹配结果
7. ✅ JSON Path 输入非法表达式 → 显示错误提示
8. ✅ 缩进选择切换为 4 空格 → 点击美化 → 缩进为 4 空格
9. ✅ 点击"清空"→ 所有输入输出清空
10. ✅ 点击"复制结果"→ 输出内容复制到剪贴板
11. ✅ 点击"填入示例"→ 输入框恢复示例数据
12. ✅ 拖拽 .json 文件到输入框 → 文件内容加载
13. ✅ 统计信息在操作后正确显示
14. ✅ 侧边栏显示"格式化"分类和"JSON 格式化器"链接

- [ ] **Step 4: 提交（如有修复）**

```bash
git add -A
git commit -m "fix(json-formatter): 修复构建和测试中发现的问题"
```

---

### Task 8: 最终提交 & 整理

**Files:** 无新增

- [ ] **Step 1: 确认所有文件已提交**

```bash
git status
git log --oneline -10
```

Expected: 工作区干净，commit 历史包含所有功能提交

- [ ] **Step 2: 确认页面在生产模式下正常工作**

```bash
pnpm build && pnpm preview
```

Expected: `/format/json-formatter` 页面功能完整
