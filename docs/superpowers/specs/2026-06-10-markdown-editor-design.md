# Markdown 编辑器 — 设计文档

> 日期：2026-06-10
> 状态：已批准

## 概述

新增在线 Markdown 编辑器工具，支持编辑、预览和分栏三种视图模式，提供精简工具栏辅助语法插入，支持导出为 .md / .html / .pdf 三种格式。采用轻量组装方案，控制 JS 体积在 50KB gzip 以内。

## 1. 工具注册

| 字段 | 值 |
|------|-----|
| 分类 | 新增 `编辑器`，slug: `editor` |
| 工具 ID | `markdown-editor` |
| 路径 | `/editor/markdown-editor` |
| 图标 | ✏️ |

需在 `src/data/tools.ts` 中：
1. `ToolCategory` 联合类型新增 `'编辑器'`
2. `categorySlugMap` 新增 `'编辑器': 'editor'`
3. `tools` 数组新增工具条目

### SEO 元数据

```typescript
{
  id: 'markdown-editor',
  name: 'Markdown 编辑器',
  description: '在线 Markdown 编辑器，支持实时预览、语法高亮和多格式导出',
  seoDescription: '在线 Markdown 编辑器，支持实时预览、分栏编辑、代码块高亮，可导出为 Markdown、HTML、PDF 格式，纯浏览器端运行。',
  category: '编辑器',
  icon: '✏️',
  path: '/editor/markdown-editor',
  keywords: ['markdown 编辑器', 'markdown 在线', 'markdown 预览', '在线 md 编辑器', 'markdown 导出', 'markdown 转换'],
  relatedToolIds: ['json-formatter', 'json-to-yaml'],
}
```

### FAQ

在 `src/data/tool-faqs.ts` 中添加 3-5 条问答：
- 什么是 Markdown？
- 支持哪些 Markdown 扩展语法？
- 如何导出为 PDF？
- 数据安全吗？（纯浏览器端运算）
- 分栏模式下编辑和预览如何同步？

## 2. 文件结构

```
src/
├── pages/editor/markdown-editor.astro     # 页面入口
├── tools/editor/MarkdownEditor.vue        # 主 Vue 组件
├── utils/editor/
│   ├── markdown-renderer.ts               # marked 配置 + 渲染封装
│   ├── markdown-toolbar.ts                # 工具栏动作定义
│   └── markdown-export.ts                # 导出逻辑（.md / .html / .pdf）
├── data/tools.ts                          # 新增工具注册 + 新分类
└── data/tool-faqs.ts                      # FAQ 数据
```

## 3. 依赖

| 依赖 | 用途 | 估算体积（gzip） |
|------|------|-----------------|
| `marked` | Markdown → HTML 解析 | ~12KB |
| `prismjs`（已有） | 预览区代码块语法高亮 | 0（复用） |

总新增体积约 12KB，远低于 50KB 限制。

## 4. 视图模式

利用已有 `ModeTabGroup` 组件提供三种视图切换：

| 模式 | Key | 布局 | 说明 |
|------|-----|------|------|
| 仅编辑 | `edit` | 单栏 textarea，全宽 | 纯写作模式 |
| 仅预览 | `preview` | 单栏渲染 HTML，全宽 | 查看最终效果 |
| 分栏 | `split` | 左右双栏 | **默认模式**，编辑与预览同屏 |

### 默认值

- 默认视图为 `split`（分栏模式）
- 编辑区预填一段示例 Markdown（含标题、列表、代码块、表格、引用等），用户打开即可看到效果

### 响应式布局

- 分栏模式使用 `ResponsiveWorkspace` 的 `horizontal` 模式
- 移动端（<1024px）自动切换为纵向堆叠（编辑在上，预览在下）
- 编辑区和预览区各占 50% 宽度，中间 `border-r border-border` 分割

### 同步滚动

- 分栏模式下，编辑区滚动时预览区按比例同步滚动（基于 scrollTop / scrollHeight 比例计算）
- 通过 `ToggleSwitch` 组件提供同步滚动开关（默认开启）
- 同步滚动逻辑在 `MarkdownEditor.vue` 中实现，不抽取为独立工具函数

## 5. 编辑区

### 基础编辑

- 原生 `<textarea>` + `font-mono text-sm` 样式
- Tab 键输入 2 空格缩进（拦截默认 Tab 行为）
- 快捷键支持：Ctrl+B（加粗）、Ctrl+I（斜体）、Ctrl+K（链接）

### 语法高亮

- 不做编辑区的实时语法高亮（textarea 不支持富文本渲染）
- 通过工具栏按钮和快捷键提供语法插入辅助，降低手动输入负担

## 6. 工具栏（精简版）

位于 textarea 上方，只保留最核心的操作：

| 按钮 | 插入语法 |
|------|---------|
| 标题（下拉选择 H1/H2/H3） | `# ` / `## ` / `### ` |
| **B** | `**粗体**` |
| *I* | `*斜体*` |
| 🔗 | `[text](url)` |
| \`Code\` | `` `代码` `` |
| 代码块 | 三反引号代码块 |
| 列表（下拉选择有序/无序） | `1. ` / `- ` |

- 标题和列表使用 `SelectListbox` 下拉选择，减少按钮数量
- 按钮使用 Ghost 风格（`bg-card border border-border rounded-sm px-2 py-1`）
- 工具栏在仅预览模式下禁用但仍可见
- 导出按钮组（.md / .html / .pdf）位于工具栏右侧，始终可用

### 工具栏动作逻辑

`markdown-toolbar.ts` 导出每个按钮对应的插入动作函数：
- 接收参数：textarea 引用、当前选区（selectionStart / selectionEnd / selectedText）
- 行为：在选区前后包裹对应语法符号（如 `**selectedText**`），无选区时插入占位文本
- 返回插入后的完整文本和新光标位置

## 7. 预览区

### 渲染

- 使用 `marked` 将 Markdown 解析为 HTML
- 代码块高亮复用已有 `prismjs`，通过 `marked` 的 renderer 扩展接入
- 预览区使用 `v-html` 渲染

### 排版样式

不引入 `@tailwindcss/typography` 插件，在组件内手写轻量 Markdown 排版样式（`.md-preview` 命名空间下）：

- 标题（h1-h6）：字号和间距层级
- 段落、列表（有序/无序/任务列表）：标准排版间距
- 代码块：`bg-hover` 背景 + `font-mono` + 横向溢出滚动
- 表格：`border-border` 边框 + 斑马纹行
- 引用块：左侧 `border-accent` 竖线 + `bg-hover` 背景
- 链接：`text-accent`
- 图片：`max-w-full`
- 水平分割线：`border-border`

## 8. 导出功能

| 按钮 | 格式 | 实现方式 |
|------|------|---------|
| 导出 .md | Markdown 源文件 | `Blob` + `URL.createObjectURL` + `<a download>` |
| 导出 .html | 独立 HTML 文件 | 拼接完整 HTML 模板（内联预览区样式），Blob 下载 |
| 导出 .pdf | PDF | `window.print()` + `@media print` 打印样式 |

- 文件名默认为 `document.md` / `document.html`
- PDF 导出使用浏览器原生打印对话框，通过 `@media print` 隐藏工具栏和编辑区，只打印预览区内容
- 导出逻辑封装在 `markdown-export.ts` 中

## 9. 数据流

```
用户输入 markdown 文本
       │
       ▼
  ref<string> markdownSource
       │
       ├──▶ computed: marked.parse() ──▶ ref<string> renderedHtml ──▶ v-html 预览区
       │
       └──▶ 导出：markdownSource（.md）或 renderedHtml（.html/.pdf）
```

- 使用 Vue `computed` 驱动渲染，输入即输出
- 无需 Web Worker（`marked` 解析速度快，单次解析 < 1ms）

## 10. 水合策略

- 使用 `client:idle`（页面空闲时水合）
- 编辑器不需要首帧立即交互，符合项目默认策略

## 11. 错误处理

- Markdown 解析错误静默处理（`marked` 容错性强）
- 导出失败时通过 Toast（`CustomEvent('toast')`）提示具体错误信息
- 所有错误提示使用中文描述

## 12. 性能预估

| 指标 | 预估值 |
|------|--------|
| 新增 JS（gzip） | ~30KB（marked ~12KB + 组件逻辑 ~18KB） |
| 首次渲染 | < 1.5s（LCP） |
| 实时预览延迟 | < 16ms（单帧） |
