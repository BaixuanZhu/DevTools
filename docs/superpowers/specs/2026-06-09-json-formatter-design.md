# JSON 格式化器 — 设计文档

> 日期：2026-06-09
> 状态：已批准（修订版）

## 概述

新增 JSON 在线格式化工具，支持美化、压缩、验证、JSON Path 查询和统计信息。语法高亮基于 Prism.js（仅导入 JSON 语言，自定义 CSS 配色匹配项目设计令牌），JSON Path 查询基于 jsonpath-plus，大文件（>1MB）通过 Web Worker 异步解析。

## 1. 基本信息 & 路由

| 项目         | 值                                                  |
| ------------ | --------------------------------------------------- |
| 工具 ID      | `json-formatter`                                    |
| URL 路径     | `/format/json-formatter`                            |
| 所属分类     | `格式化`（categorySlug: `format`）                  |
| 页面标题     | JSON 格式化器                                       |
| 工具描述     | 在线 JSON 格式化、压缩、验证与查询工具               |
| 页面文件     | `src/pages/format/json-formatter.astro`             |
| 组件文件     | `src/tools/format/JsonFormatter.vue`                |
| 工具函数     | `src/utils/format/json-formatter.ts`                |
| Web Worker   | `src/utils/format/json-parse.worker.ts`             |

### ToolMeta 注册条目

```typescript
{
  id: 'json-formatter',
  name: 'JSON 格式化器',
  description: '在线 JSON 格式化、压缩、验证与查询工具',
  seoDescription: '在线 JSON 格式化工具，支持美化、压缩、验证与 JSON Path 查询，实时语法高亮与统计信息，纯浏览器端运算。',
  category: '格式化',
  icon: '📋',
  path: '/format/json-formatter',
}
```

> `format` 分类已在 `src/data/tools.ts` 的 `categorySlugMap` 中注册（`'格式化': 'format'`），无需新增枚举值。`format` 分类暂无独立首页，侧边栏分类标题仅做导航分组。

## 2. 页面布局 & 交互

实际 DOM 结构基于 `ResponsiveWorkspace` 的三个 slot（`#input`、`#output`、`#actions`），按现有工具模式布局：

```
┌───────────────────────────────────────────────────────────┐
│ ToolHeader: "JSON 格式化器" + 示例按钮                     │
├───────────────────────────┬───────────────────────────────┤
│  #input slot              │  #output slot                 │
│                           │                               │
│  ┌─────────────────────┐  │  ┌─────────────────────────┐  │
│  │ <textarea>          │  │  │ <pre><code>             │  │
│  │ 原始 JSON 输入       │  │  │ Prism.js 高亮输出       │  │
│  │ 默认填入示例数据      │  │  │ 或错误信息              │  │
│  │ 支持拖拽/粘贴/上传   │  │  │                         │  │
│  │                     │  │  │                         │  │
│  └─────────────────────┘  │  └─────────────────────────┘  │
│                           │                               │
│  操作按钮栏                │  统计信息栏                    │
│  [美化][压缩][验证]        │  节点:42 深度:5 1.2KB 38行    │
│  缩进:[2▸]                │                               │
│  [清空] [复制]            │  [复制结果按钮]                │
├───────────────────────────┴───────────────────────────────┤
│ JSON Path 查询栏（横跨两栏）                               │
│ 输入框: $.store.book[*].author              [查询]        │
└───────────────────────────────────────────────────────────┘
```

### 交互流程

1. **输入**：左侧 textarea，默认填入示例 JSON 数据，支持手动输入、粘贴、拖拽文件上传
2. **操作按钮**（放置在 `#input` slot 底部）：
   - **美化** — 格式化为缩进排列的可读 JSON，右侧显示结果 + 语法高亮
   - **压缩** — 移除空白压缩为单行，右侧显示结果（纯文本）
   - **验证** — 不修改内容，右侧显示"✓ JSON 格式有效"或标记错误位置
   - **查询** — 在底部 JSON Path 栏输入表达式，右侧显示匹配结果
   - 本工具支持四种不同的输出操作（美化/压缩/验证/查询），无法推断用户意图，因此保留手动按钮触发
3. **缩进选择**：`SelectListbox` 组件，选项 2/4/8 空格或 1 Tab
4. **清空**：重置输入、输出、查询框和统计信息
5. **复制**：复制右侧输出内容到剪贴板
6. **统计信息**（放置在 `#output` slot 底部）：输入变化时实时更新
7. **JSON Path 查询栏**：放置在两栏下方（横跨），包含输入框和查询按钮

### 示例数据

默认填入的示例 JSON，覆盖常见结构（对象、数组、嵌套、多种值类型），大小约 200 字节：

```json
{
  "name": "DevTools",
  "version": "1.0.0",
  "features": ["格式化", "压缩", "验证"],
  "config": {
    "indent": 2,
    "theme": "light"
  },
  "active": true,
  "lastUpdate": null
}
```

### 布局细节

- 使用 `ResponsiveWorkspace` 组件，桌面端左右分栏，移动端上下堆叠
- 操作按钮和缩进选择放在 `#input` slot 底部（与现有工具模式一致）
- 统计信息放在 `#output` slot 底部
- 输出区用 Prism.js 渲染 `<pre><code class="language-json">` 实现语法高亮
- 错误信息用 `text-error` 样式 + 具体行号列号标注

## 3. 技术实现细节

### 依赖

| 库            | 用途           | 引入方式                               |
| ------------- | -------------- | -------------------------------------- |
| prismjs       | JSON 语法高亮  | `import Prism from 'prismjs'`（JSON 为内置语言，无需额外导入语言包） |
| jsonpath-plus | JSON Path 查询 | 导入 `JSONPath` 类                     |

原生 `JSON.parse()` / `JSON.stringify()` 处理格式化、压缩和验证。

### Prism.js 样式策略

**不导入 Prism 默认主题**（其深色背景与项目浅色体系冲突），改为自定义 CSS：

- Prism.js 仅用于分词（tokenize），生成 `token` + `type` 标记的 HTML
- token 颜色用项目设计令牌覆盖，例如：
  - `.token.property`（key）→ `text-primary`
  - `.token.string` → `text-accent` 或类似令牌
  - `.token.number` → `text-info`
  - `.token.boolean` / `.token.keyword`（true/false/null）→ `text-muted`
  - `.token.punctuation`（结构字符）→ `text-muted`
- 具体配色在实现时参照 `DESIGN.md` 设计令牌确定

### 功能实现

**美化**

```
输入 → JSON.parse() → JSON.stringify(obj, null, indent) → Prism.js 高亮渲染
```

**压缩**

```
输入 → JSON.parse() → JSON.stringify(obj) → 纯文本输出
```

**验证**

```
输入 → JSON.parse() 包裹 try-catch
  ✓ 成功 → 显示"JSON 格式有效" + 统计信息
  ✗ 失败 → 提取错误信息，解析行号/列号，在输出区标注
```

**JSON Path 查询**

```
输入 → JSON.parse() → JSONPath({path, json, resultType: 'value'}) → 结果高亮展示
```

- 匹配到多个结果时，用列表形式展示每个匹配项
- 无匹配时提示"未找到匹配节点"
- 表达式语法错误时捕获异常并提示

**统计信息**

- **节点数**：递归计算所有 key-value 对（含嵌套）
- **最大层级**：递归计算最大嵌套深度
- **体积**：`new TextEncoder().encode(input).length`，自动选择 B/KB/MB 单位
- **行数**：`input.split('\n').length`

### 大文件性能优化

```
主线程: 发送原始 JSON 字符串 → Worker
Worker: JSON.parse() + computeStats() → 返回结果 → 主线程渲染
```

- 阈值：输入超过 **1MB** 时自动切换到 Worker 解析
- Worker 内执行 parse + 统计计算，避免阻塞 UI
- 格式化结果仍在主线程生成（`JSON.stringify` 很快，无需 Worker）
- Worker 通过 Vite 标准语法创建：`new Worker(new URL('./json-parse.worker.ts', import.meta.url), { type: 'module' })`
- Worker 消息类型定义（共享于 `json-formatter.ts`）：

```typescript
/** Worker 请求消息 */
interface WorkerRequest {
  json: string;
}

/** Worker 成功响应 */
interface WorkerSuccessResponse {
  ok: true;
  parsed: unknown;
  stats: JsonStats;
}

/** Worker 错误响应 */
interface WorkerErrorResponse {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
```

### 错误处理

| 场景               | 处理方式                                         |
| ------------------ | ------------------------------------------------ |
| 输入为空           | 输出区显示占位提示"请输入 JSON 数据"              |
| JSON 语法错误      | 输出区显示错误行号、列号、具体原因（中文）        |
| JSON Path 语法错误  | 输出区提示表达式错误，建议检查语法               |
| JSON Path 无匹配   | 输出区提示"未找到匹配节点"                        |
| 输入超过 5MB       | 警告提示"数据量过大，可能导致浏览器卡顿"          |

### 输入限制

- **软限制**（警告阈值）：5MB — 显示警告但仍允许操作
- **硬限制**（拒绝处理）：10MB — 超过则拒绝处理并提示

## 4. 文件结构与模块职责

### 新增文件

```
src/
├── pages/format/
│   └── json-formatter.astro          # 页面壳，引入 Vue 组件，client:idle
├── tools/format/
│   └── JsonFormatter.vue             # 主交互组件，管理状态和 UI
├── utils/format/
│   ├── json-formatter.ts             # 纯函数：格式化、压缩、验证、统计、错误解析
│   └── json-parse.worker.ts          # Web Worker：大文件解析 + 统计计算
```

### 模块职责

**`json-formatter.astro`**（页面文件，位于 `src/pages/format/`）
- 使用 `ToolLayout` 包裹，传入 title/icon
- 引入 `JsonFormatter.vue`，挂载 `client:idle`（与现有工具页面一致，页面空闲时水合）

**`JsonFormatter.vue`**（主组件，位于 `src/tools/format/`）
- 状态：`inputText`、`outputText`、`errorMessage`、`stats`、`indent`、`queryPath`
- 调用 `json-formatter.ts` 纯函数执行操作
- 大文件时通过 Worker 通信
- 处理文件上传（拖拽 + 点击选择）
- 调用 Prism.js 渲染高亮输出
- 默认填入示例 JSON 数据

**`json-formatter.ts`**（纯函数模块）
- `formatJson(input, indent)` — 美化格式化，返回 `{ ok, result } | { ok: false, error }`
- `minifyJson(input)` — 压缩，返回同上
- `validateJson(input)` — 验证，返回 `{ ok, message } | { ok: false, line, column, message }`
- `queryJsonPath(input, path)` — JSON Path 查询，返回匹配结果或错误
- `computeStats(obj)` — 递归计算节点数和最大层级
- `parseErrorPosition(error, input)` — 从原生错误中提取行列号
- `formatBytes(bytes)` — 字节数格式化为可读单位
- `WorkerRequest` / `WorkerResponse` — Worker 消息类型定义

**`json-parse.worker.ts`**（Web Worker）
- 接收 `WorkerRequest` 消息
- 执行 `JSON.parse()` + `computeStats()`
- 返回 `WorkerResponse`

### 需修改的现有文件

| 文件                | 修改内容                                      |
| ------------------- | --------------------------------------------- |
| `src/data/tools.ts` | 新增 `json-formatter` 工具条目（`format` 分类已存在） |

### 复用的现有组件

- `ToolLayout.astro` — 页面骨架
- `ResponsiveWorkspace` — 双栏布局（操作按钮放 `#input` slot，统计信息放 `#output` slot）
- `CopyButton` — 复制输出结果
- `ClearButton` — 清空所有输入
- `SelectListbox` — 缩进选择器
- `ToolHeader` — 工具标题栏（含示例按钮，`showExample` 默认 true）
