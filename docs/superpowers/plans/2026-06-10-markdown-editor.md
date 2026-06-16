# Markdown 编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增在线 Markdown 编辑器工具，支持编辑/预览/分栏三种视图、精简工具栏、多格式导出（.md/.html/.pdf）。

**Architecture:** 原生 textarea + marked 解析渲染 + prismjs 代码高亮。三个工具函数模块（renderer / toolbar / export）独立封装，主 Vue 组件组合消费。视图切换复用 ModeTabGroup，布局复用 ResponsiveWorkspace，编辑/预览双栏通过条件渲染驱动。

**Tech Stack:** Vue 3 Composition API、marked（Markdown 解析）、prismjs（代码高亮，已有）、@headlessui/vue（UI 组件）、Tailwind CSS v4。

---

## File Structure

```
创建:
  src/utils/editor/markdown-renderer.ts   # marked 配置 + 渲染封装
  src/utils/editor/markdown-toolbar.ts    # 工具栏动作定义（插入语法片段）
  src/utils/editor/markdown-export.ts     # 导出逻辑（.md / .html / .pdf）
  src/tools/editor/MarkdownEditor.vue     # 主 Vue 组件（~300 行）
  src/pages/editor/markdown-editor.astro  # 页面入口

修改:
  src/data/tools.ts                       # 新增分类 + 工具注册条目
  src/data/tool-faqs.ts                   # 新增 FAQ 数据

新增依赖:
  marked                                   # Markdown → HTML 解析（~12KB gzip）
```

---

### Task 1: 安装 marked 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 marked**

```bash
pnpm add marked
```

- [ ] **Step 2: 验证安装成功**

```bash
pnpm ls marked
```

Expected: 输出包含 `marked x.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 添加 marked 依赖用于 Markdown 解析"
```

---

### Task 2: 注册新分类和工具元数据

**Files:**
- Modify: `src/data/tools.ts` — `ToolCategory` 类型（第 2-13 行）、`categorySlugMap`（第 16-28 行）、`tools` 数组（第 55 行起）

- [ ] **Step 1: 在 ToolCategory 联合类型中新增 `'编辑器'`**

在 `src/data/tools.ts` 第 13 行 `'媒体工具'` 后追加：

```typescript
  | '编辑器';
```

完整类型应为：

```typescript
export type ToolCategory =
  | '编码转换'
  | '加密哈希'
  | '格式化'
  | '文本处理'
  | '正则工具'
  | '网络工具'
  | '颜色工具'
  | '日期时间'
  | 'CSS 工具'
  | 'API 工具'
  | '媒体工具'
  | '编辑器';
```

- [ ] **Step 2: 在 categorySlugMap 中新增映射**

在 `categorySlugMap` 对象的 `'媒体工具': 'media'` 行后追加：

```typescript
  '编辑器': 'editor',
```

- [ ] **Step 3: 在 tools 数组中新增工具条目**

在 `tools` 数组末尾（`json-to-yaml` 条目之后，`]` 之前）追加：

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
  },
```

- [ ] **Step 4: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 无错误输出（或仅有已存在的与本次修改无关的错误）

- [ ] **Step 5: Commit**

```bash
git add src/data/tools.ts
git commit -m "feat(editor): 注册 Markdown 编辑器工具和新分类"
```

---

### Task 3: 添加 FAQ 数据

**Files:**
- Modify: `src/data/tool-faqs.ts` — `toolFaqs` 对象（第 24 行起）

- [ ] **Step 1: 在 toolFaqs 对象中新增 markdown-editor 条目**

在 `toolFaqs` 对象中（`'cron-parser'` 条目之后）追加：

```typescript
  'markdown-editor': [
    {
      question: '什么是 Markdown？',
      answer: 'Markdown 是一种<strong>轻量级标记语言</strong>，用简洁的纯文本语法编写文档，可转换为 HTML 等格式。广泛用于技术文档、README、博客和笔记等场景。',
    },
    {
      question: '支持哪些 Markdown 扩展语法？',
      answer: '除标准 Markdown 语法外，本工具支持<strong>表格</strong>、<strong>任务列表</strong>（<code>- [ ]</code>）、<strong>删除线</strong>（<code>~~文本~~</code>）和<strong>代码块语法高亮</strong>等 GFM（GitHub Flavored Markdown）扩展。',
    },
    {
      question: '如何导出为 PDF？',
      answer: '点击"导出 PDF"按钮后会调用浏览器的打印功能。在打印对话框中选择"另存为 PDF"即可。导出内容只包含预览区域，不包含编辑器和工具栏。',
    },
    {
      question: '数据安全吗？',
      answer: '所有编辑和渲染在<strong>浏览器本地完成</strong>，Markdown 内容不会上传到任何服务器。关闭页面后数据自动清除。',
    },
  ],
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/data/tool-faqs.ts
git commit -m "feat(editor): 添加 Markdown 编辑器 FAQ 数据"
```

---

### Task 4: 实现 markdown-renderer.ts

**Files:**
- Create: `src/utils/editor/markdown-renderer.ts`

- [ ] **Step 1: 创建 markdown-renderer.ts**

```typescript
/**
 * Markdown 渲染封装模块。
 *
 * 配置 marked 解析器并集成 Prism.js 代码块高亮，
 * 提供 `renderMarkdown` 函数供主组件调用。
 */
import { Marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-sql';

/** 配置并创建 Marked 实例 */
const marked = new Marked({
  gfm: true,
  breaks: false,
});

/** 自定义 renderer：代码块使用 Prism.js 高亮 */
const renderer = {
  code({ text, lang }: { text: string; lang?: string }): string {
    const language = lang && Prism.languages[lang] ? lang : 'plaintext';
    const highlighted = lang && Prism.languages[lang]
      ? Prism.highlight(text, Prism.languages[lang], language)
      : escapeHtml(text);
    return `<pre class="md-code-block"><code class="language-${language}">${highlighted}</code></pre>`;
  },
};

marked.use({ renderer });

/**
 * 将 Markdown 文本渲染为 HTML。
 * @param markdown - Markdown 源文本
 * @returns 渲染后的 HTML 字符串
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}

/**
 * HTML 转义工具函数。
 * @param str - 需要转义的字符串
 * @returns 转义后的字符串
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/editor/markdown-renderer.ts
git commit -m "feat(editor): 实现 Markdown 渲染封装模块"
```

---

### Task 5: 实现 markdown-toolbar.ts

**Files:**
- Create: `src/utils/editor/markdown-toolbar.ts`

- [ ] **Step 1: 创建 markdown-toolbar.ts**

```typescript
/**
 * Markdown 工具栏动作定义模块。
 *
 * 每个动作函数接收 textarea 的选区信息，返回插入后的文本和新光标位置，
 * 供主组件调用以在编辑区插入 Markdown 语法片段。
 */

/** 工具栏动作函数的输入参数 */
export interface TextareaState {
  /** textarea 的当前完整文本 */
  value: string;
  /** 选区起始位置 */
  selectionStart: number;
  /** 选区结束位置 */
  selectionEnd: number;
}

/** 工具栏动作函数的返回结果 */
export interface InsertResult {
  /** 插入后的完整文本 */
  newValue: string;
  /** 新光标起始位置 */
  newSelectionStart: number;
  /** 新光标结束位置 */
  newSelectionEnd: number;
}

/**
 * 在选区前后包裹语法。无选区时插入占位文本。
 * @param state - textarea 当前状态
 * @param before - 选区前插入的文本
 * @param after - 选区后插入的文本
 * @param placeholder - 无选区时的占位文本
 * @returns 插入结果
 */
function wrapSelection(
  state: TextareaState,
  before: string,
  after: string,
  placeholder: string,
): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const text = selectedText || placeholder;
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);
  const newValue = beforeText + before + text + after + afterText;

  if (selectedText) {
    return {
      newValue,
      newSelectionStart: selectionStart + before.length,
      newSelectionEnd: selectionStart + before.length + selectedText.length,
    };
  }
  // 无选区时选中占位文本
  const placeholderStart = selectionStart + before.length;
  return {
    newValue,
    newSelectionStart: placeholderStart,
    newSelectionEnd: placeholderStart + placeholder.length,
  };
}

/**
 * 在光标所在行首插入前缀。若已选多行，每行都插入。
 * @param state - textarea 当前状态
 * @param prefix - 行首前缀文本
 * @param placeholder - 空行时的占位文本
 * @returns 插入结果
 */
function prefixLine(
  state: TextareaState,
  prefix: string,
  placeholder: string,
): InsertResult {
  const { value, selectionStart, selectionEnd } = state;

  // 找到选区起始行的行首
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  // 找到选区结束行的行尾
  let lineEnd = value.indexOf('\n', selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;

  const selectedLines = value.slice(lineStart, lineEnd);
  const lines = selectedLines.split('\n');

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return prefix + placeholder;
    return prefix + line;
  });

  const newText = newLines.join('\n');
  const before = value.slice(0, lineStart);
  const after = value.slice(lineEnd);
  const newValue = before + newText + after;

  return {
    newValue,
    newSelectionStart: lineStart,
    newSelectionEnd: lineStart + newText.length,
  };
}

/** 插入加粗语法 */
export function insertBold(state: TextareaState): InsertResult {
  return wrapSelection(state, '**', '**', '粗体文本');
}

/** 插入斜体语法 */
export function insertItalic(state: TextareaState): InsertResult {
  return wrapSelection(state, '*', '*', '斜体文本');
}

/** 插入行内代码语法 */
export function insertInlineCode(state: TextareaState): InsertResult {
  return wrapSelection(state, '`', '`', '代码');
}

/** 插入链接语法 */
export function insertLink(state: TextareaState): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);

  const displayText = selectedText || '链接文本';
  const insertText = `[${displayText}](url)`;
  const newValue = beforeText + insertText + afterText;

  const urlStart = selectionStart + displayText.length + 3; // ]( 后的位置
  return {
    newValue,
    newSelectionStart: urlStart,
    newSelectionEnd: urlStart + 3, // 选中 "url"
  };
}

/** 插入代码块语法 */
export function insertCodeBlock(state: TextareaState): InsertResult {
  const { value, selectionStart, selectionEnd } = state;
  const selectedText = value.slice(selectionStart, selectionEnd);
  const beforeText = value.slice(0, selectionStart);
  const afterText = value.slice(selectionEnd);

  const codeContent = selectedText || '代码内容';
  const insertText = `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
  const newValue = beforeText + insertText + afterText;

  // 光标定位到代码内容区
  const contentStart = selectionStart + 5; // \n``` 后的换行位置
  const contentEnd = contentStart + codeContent.length;

  if (selectedText) {
    return { newValue, newSelectionStart: contentStart, newSelectionEnd: contentEnd };
  }
  return { newValue, newSelectionStart: contentStart, newSelectionEnd: contentEnd };
}

/** 插入标题语法 */
export function insertHeading(state: TextareaState, level: 1 | 2 | 3): InsertResult {
  const prefix = '#'.repeat(level) + ' ';
  return prefixLine(state, prefix, '标题');
}

/** 插入有序列表语法 */
export function insertOrderedList(state: TextareaState): InsertResult {
  return prefixLine(state, '1. ', '列表项');
}

/** 插入无序列表语法 */
export function insertUnorderedList(state: TextareaState): InsertResult {
  return prefixLine(state, '- ', '列表项');
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/editor/markdown-toolbar.ts
git commit -m "feat(editor): 实现工具栏动作定义模块"
```

---

### Task 6: 实现 markdown-export.ts

**Files:**
- Create: `src/utils/editor/markdown-export.ts`

- [ ] **Step 1: 创建 markdown-export.ts**

```typescript
/**
 * Markdown 导出功能模块。
 *
 * 支持 .md 文件下载、.html 文件下载和 .pdf（浏览器打印）三种导出方式。
 */

/**
 * 导出为 Markdown 文件。
 * @param content - Markdown 源文本
 * @param filename - 文件名（默认 'document.md'）
 */
export function exportMarkdown(content: string, filename = 'document.md'): void {
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), filename);
}

/**
 * 导出为独立 HTML 文件。
 * @param renderedHtml - marked 渲染后的 HTML 内容
 * @param filename - 文件名（默认 'document.html'）
 */
export function exportHtml(renderedHtml: string, filename = 'document.html'): void {
  const htmlContent = buildHtmlDocument(renderedHtml);
  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }), filename);
}

/**
 * 导出为 PDF（调用浏览器打印）。
 * 通过在预览区上触发 window.print()，配合 @media print 样式隐藏非打印内容。
 */
export function exportPdf(): void {
  window.print();
}

/**
 * 构建完整的独立 HTML 文档，内联预览区排版样式。
 * @param bodyHtml - 渲染后的 HTML body 内容
 * @returns 完整 HTML 文档字符串
 */
function buildHtmlDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Export</title>
  <style>
    body {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
    }
    h1 { font-size: 1.75rem; margin: 1.5rem 0 0.75rem; }
    h2 { font-size: 1.5rem; margin: 1.25rem 0 0.625rem; }
    h3 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
    h4, h5, h6 { font-size: 1rem; margin: 0.75rem 0 0.375rem; }
    p { margin: 0.5rem 0; }
    a { color: #e8590c; }
    code {
      background: #f3f1ee;
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      font-size: 0.875rem;
      font-family: 'JetBrains Mono', monospace;
    }
    pre {
      background: #f3f1ee;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 3px solid #e8590c;
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      background: #f3f1ee;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
    th, td { border: 1px solid #e5e2dd; padding: 0.5rem 0.75rem; text-align: left; }
    tr:nth-child(even) { background: #faf9f7; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #e5e2dd; margin: 1rem 0; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * 通过 Blob 触发文件下载。
 * @param blob - 文件 Blob 数据
 * @param filename - 下载文件名
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/editor/markdown-export.ts
git commit -m "feat(editor): 实现导出功能模块"
```

---

### Task 7: 创建页面入口文件

**Files:**
- Create: `src/pages/editor/markdown-editor.astro`

- [ ] **Step 1: 创建 markdown-editor.astro**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import MarkdownEditor from '../../tools/editor/MarkdownEditor.vue';
---

<ToolLayout toolId="editor/markdown-editor">
  <MarkdownEditor client:idle />
</ToolLayout>
```

- [ ] **Step 2: 验证开发服务器可启动**

```bash
pnpm dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/editor/markdown-editor
kill %1
```

Expected: HTTP 200（或页面能正常加载。如果端口不同请调整）

- [ ] **Step 3: Commit**

```bash
git add src/pages/editor/markdown-editor.astro
git commit -m "feat(editor): 创建 Markdown 编辑器页面入口"
```

---

### Task 8: 实现 MarkdownEditor.vue 主组件

**Files:**
- Create: `src/tools/editor/MarkdownEditor.vue`

这是核心任务，组件约 350 行。包含：视图模式切换、工具栏、编辑区、预览区、同步滚动、导出。

- [ ] **Step 1: 创建 MarkdownEditor.vue**

```vue
<script setup lang="ts">
/**
 * Markdown 编辑器主组件。
 *
 * 支持仅编辑 / 仅预览 / 分栏三种视图模式，
 * 提供精简工具栏辅助语法插入，支持导出 .md / .html / .pdf。
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { renderMarkdown } from '../../utils/editor/markdown-renderer';
import {
  insertBold,
  insertItalic,
  insertInlineCode,
  insertLink,
  insertCodeBlock,
  insertHeading,
  insertOrderedList,
  insertUnorderedList,
  type TextareaState,
} from '../../utils/editor/markdown-toolbar';
import {
  exportMarkdown,
  exportHtml,
  exportPdf,
} from '../../utils/editor/markdown-export';

// ---- 常量 ----

/** 视图模式选项 */
const VIEW_OPTIONS = [
  { key: 'split', label: '分栏' },
  { key: 'edit', label: '编辑' },
  { key: 'preview', label: '预览' },
];

/** 标题级别选项 */
const HEADING_OPTIONS = [
  { value: '1', label: 'H1' },
  { value: '2', label: 'H2' },
  { value: '3', label: 'H3' },
];

/** 列表类型选项 */
const LIST_OPTIONS = [
  { value: 'ordered', label: '有序列表' },
  { value: 'unordered', label: '无序列表' },
];

/** 示例 Markdown */
const EXAMPLE_MARKDOWN = `# Markdown 编辑器示例

## 基础语法

这是一段 **粗体**、*斜体* 和 \`行内代码\` 的演示。

### 列表

- 第一项
- 第二项
- 第三项

1. 步骤一
2. 步骤二
3. 步骤三

### 代码块

\`\`\`javascript
function hello() {
  console.log('Hello, Markdown!');
}
\`\`\`

### 表格

| 功能 | 状态 |
|------|------|
| 编辑 | ✅ |
| 预览 | ✅ |
| 导出 | ✅ |

> 这是一段引用文本，用于展示 Markdown 引用块的渲染效果。

---

以上是 Markdown 编辑器的功能演示，开始编辑吧！`;

// ---- 状态 ----

/** Markdown 源文本 */
const markdownSource = ref(EXAMPLE_MARKDOWN);
/** 当前视图模式 */
const viewMode = ref('split');
/** 同步滚动开关 */
const syncScroll = ref(true);
/** 选中的标题级别 */
const headingLevel = ref('2');
/** 选中的列表类型 */
const listType = ref('unordered');
/** 编辑区 textarea ref */
const editorRef = ref<HTMLTextAreaElement | null>(null);
/** 预览区容器 ref */
const previewRef = ref<HTMLDivElement | null>(null);
/** 同步滚动锁（防止循环触发） */
let scrollLock = false;

// ---- 计算属性 ----

/** 渲染后的 HTML */
const renderedHtml = computed(() => renderMarkdown(markdownSource.value));

// ---- 工具栏操作 ----

/**
 * 获取 textarea 当前状态快照。
 * @returns TextareaState
 */
function getTextareaState(): TextareaState {
  const el = editorRef.value;
  if (!el) {
    return { value: '', selectionStart: 0, selectionEnd: 0 };
  }
  return {
    value: el.value,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
  };
}

/**
 * 应用工具栏动作的插入结果到 textarea。
 * @param result - 插入结果
 */
function applyInsertResult(result: { newValue: string; newSelectionStart: number; newSelectionEnd: number }): void {
  markdownSource.value = result.newValue;
  nextTick(() => {
    const el = editorRef.value;
    if (el) {
      el.focus();
      el.setSelectionRange(result.newSelectionStart, result.newSelectionEnd);
    }
  });
}

/** 加粗 */
function handleBold(): void {
  applyInsertResult(insertBold(getTextareaState()));
}

/** 斜体 */
function handleItalic(): void {
  applyInsertResult(insertItalic(getTextareaState()));
}

/** 行内代码 */
function handleInlineCode(): void {
  applyInsertResult(insertInlineCode(getTextareaState()));
}

/** 链接 */
function handleLink(): void {
  applyInsertResult(insertLink(getTextareaState()));
}

/** 代码块 */
function handleCodeBlock(): void {
  applyInsertResult(insertCodeBlock(getTextareaState()));
}

/** 标题（下拉） */
function handleHeadingChange(level: string): void {
  headingLevel.value = level;
  applyInsertResult(insertHeading(getTextareaState(), Number(level) as 1 | 2 | 3));
}

/** 列表（下拉） */
function handleListChange(type: string): void {
  listType.value = type;
  if (type === 'ordered') {
    applyInsertResult(insertOrderedList(getTextareaState()));
  } else {
    applyInsertResult(insertUnorderedList(getTextareaState()));
  }
}

// ---- 同步滚动 ----

/** 编辑区滚动时同步预览区 */
function handleEditorScroll(): void {
  if (!syncScroll.value || scrollLock) return;
  const editor = editorRef.value;
  const preview = previewRef.value;
  if (!editor || !preview) return;

  scrollLock = true;
  const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
  const ratio = editorMaxScroll > 0 ? editor.scrollTop / editorMaxScroll : 0;
  const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
  preview.scrollTop = ratio * previewMaxScroll;

  requestAnimationFrame(() => { scrollLock = false; });
}

/** 预览区滚动时同步编辑区 */
function handlePreviewScroll(): void {
  if (!syncScroll.value || scrollLock) return;
  const editor = editorRef.value;
  const preview = previewRef.value;
  if (!editor || !preview) return;

  scrollLock = true;
  const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
  const ratio = previewMaxScroll > 0 ? preview.scrollTop / previewMaxScroll : 0;
  const editorMaxScroll = editor.scrollHeight - editor.clientHeight;
  editor.scrollTop = ratio * editorMaxScroll;

  requestAnimationFrame(() => { scrollLock = false; });
}

// ---- Tab 键和快捷键 ----

/** 处理键盘事件：Tab 缩进 + 快捷键 */
function handleKeydown(e: KeyboardEvent): void {
  const el = editorRef.value;
  if (!el) return;

  // Tab → 2 空格缩进
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    markdownSource.value = value.slice(0, start) + '  ' + value.slice(end);
    nextTick(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
    return;
  }

  // Ctrl/Cmd + B → 加粗
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    handleBold();
    return;
  }

  // Ctrl/Cmd + I → 斜体
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    handleItalic();
    return;
  }

  // Ctrl/Cmd + K → 链接
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    handleLink();
    return;
  }
}

// ---- 清空与导出 ----

/** 清空编辑内容 */
function handleClear(): void {
  markdownSource.value = '';
}

/** 导出 .md */
function handleExportMd(): void {
  exportMarkdown(markdownSource.value);
  document.dispatchEvent(new CustomEvent('toast', { detail: { message: '已导出 Markdown 文件' } }));
}

/** 导出 .html */
function handleExportHtml(): void {
  exportHtml(renderedHtml.value);
  document.dispatchEvent(new CustomEvent('toast', { detail: { message: '已导出 HTML 文件' } }));
}

/** 导出 .pdf */
function handleExportPdf(): void {
  exportPdf();
}

// ---- 生命周期 ----

onMounted(() => {
  nextTick(() => {
    editorRef.value?.focus();
  });
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <!-- 头部 -->
    <ToolHeader
      title="Markdown 编辑器"
      description="在线 Markdown 编辑器，支持实时预览、语法高亮和多格式导出"
      :show-example="false"
    />

    <!-- 视图模式 + 操作按钮 -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <!-- 视图模式切换 -->
      <ModeTabGroup v-model="viewMode" :options="VIEW_OPTIONS" />

      <!-- 右侧操作 -->
      <div class="ml-auto flex items-center gap-2">
        <CopyButton :text="markdownSource" label="复制" />
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 工具栏 -->
    <div
      class="flex flex-wrap items-center gap-1 mb-3 px-2 py-1.5 border border-border rounded-sm bg-card"
      :class="viewMode === 'preview' ? 'opacity-50 pointer-events-none' : ''"
    >
      <!-- 标题下拉 -->
      <div class="flex items-center">
        <label class="text-[0.75rem] text-muted mr-1 select-none">标题</label>
        <select
          :value="headingLevel"
          class="h-7 px-1.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans cursor-pointer focus:outline-none focus:border-accent"
          @change="handleHeadingChange(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in HEADING_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <span class="w-px h-5 bg-border mx-1"></span>

      <!-- 格式按钮 -->
      <button
        class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans font-bold cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover"
        title="加粗 (Ctrl+B)"
        @click="handleBold"
      >B</button>
      <button
        class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans italic cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover"
        title="斜体 (Ctrl+I)"
        @click="handleItalic"
      >I</button>
      <button
        class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-mono cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover"
        title="行内代码"
        @click="handleInlineCode"
      >&lt;/&gt;</button>
      <button
        class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover"
        title="链接 (Ctrl+K)"
        @click="handleLink"
      >🔗</button>
      <button
        class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-mono cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover"
        title="代码块"
        @click="handleCodeBlock"
      >{ }</button>

      <span class="w-px h-5 bg-border mx-1"></span>

      <!-- 列表下拉 -->
      <div class="flex items-center">
        <label class="text-[0.75rem] text-muted mr-1 select-none">列表</label>
        <select
          :value="listType"
          class="h-7 px-1.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans cursor-pointer focus:outline-none focus:border-accent"
          @change="handleListChange(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in LIST_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <span class="w-px h-5 bg-border mx-1"></span>

      <!-- 同步滚动开关 -->
      <ToggleSwitch v-model="syncScroll" label="同步滚动" />

      <!-- 导出按钮组（右侧） -->
      <div class="ml-auto flex items-center gap-1">
        <button
          class="px-2.5 py-1 border border-border rounded-sm bg-card text-muted text-[0.75rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-hover hover:text-text"
          @click="handleExportMd"
        >导出 .md</button>
        <button
          class="px-2.5 py-1 border border-border rounded-sm bg-card text-muted text-[0.75rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-hover hover:text-text"
          @click="handleExportHtml"
        >导出 .html</button>
        <button
          class="px-2.5 py-1 border border-border rounded-sm bg-card text-muted text-[0.75rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-hover hover:text-text"
          @click="handleExportPdf"
        >导出 .pdf</button>
      </div>
    </div>

    <!-- 仅编辑模式 -->
    <div v-if="viewMode === 'edit'" class="border border-border rounded-sm bg-card">
      <textarea
        ref="editorRef"
        v-model="markdownSource"
        class="w-full h-[calc(100vh-340px)] min-h-96 p-4 bg-card text-text font-mono text-sm resize-y focus:outline-none focus:border-accent"
        spellcheck="false"
        aria-label="Markdown 编辑区"
        @keydown="handleKeydown"
      ></textarea>
    </div>

    <!-- 仅预览模式 -->
    <div
      v-else-if="viewMode === 'preview'"
      class="border border-border rounded-sm bg-card p-6 overflow-auto h-[calc(100vh-340px)] min-h-96"
    >
      <div class="md-preview" v-html="renderedHtml"></div>
    </div>

    <!-- 分栏模式 -->
    <div
      v-else
      class="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-border rounded-sm overflow-hidden"
    >
      <!-- 编辑区 -->
      <div class="border-r border-border bg-card">
        <div class="px-3 py-1.5 border-b border-border bg-hover">
          <span class="text-[0.75rem] text-muted font-sans">编辑</span>
        </div>
        <textarea
          ref="editorRef"
          v-model="markdownSource"
          class="w-full h-[calc(100vh-380px)] min-h-80 p-4 bg-card text-text font-mono text-sm resize-none focus:outline-none focus:border-accent"
          spellcheck="false"
          aria-label="Markdown 编辑区"
          @keydown="handleKeydown"
          @scroll="handleEditorScroll"
        ></textarea>
      </div>

      <!-- 预览区 -->
      <div class="bg-card">
        <div class="px-3 py-1.5 border-b border-border bg-hover">
          <span class="text-[0.75rem] text-muted font-sans">预览</span>
        </div>
        <div
          ref="previewRef"
          class="p-6 overflow-auto h-[calc(100vh-380px)] min-h-80"
          @scroll="handlePreviewScroll"
        >
          <div class="md-preview" v-html="renderedHtml"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Markdown 预览区排版样式 */
.md-preview {
  line-height: 1.7;
  color: var(--color-text);
  word-wrap: break-word;
}
.md-preview h1 { font-size: 1.75rem; font-weight: 600; margin: 1.5rem 0 0.75rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--color-border); }
.md-preview h2 { font-size: 1.5rem; font-weight: 600; margin: 1.25rem 0 0.625rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--color-border); }
.md-preview h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.md-preview h4, .md-preview h5, .md-preview h6 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.375rem; }
.md-preview p { margin: 0.5rem 0; }
.md-preview a { color: var(--color-accent); text-decoration: none; }
.md-preview a:hover { text-decoration: underline; }
.md-preview strong { font-weight: 600; }
.md-preview em { font-style: italic; }
.md-preview del { text-decoration: line-through; }
.md-preview code {
  background: var(--color-hover);
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
  font-size: 0.875rem;
  font-family: var(--font-mono);
}
.md-preview pre {
  background: var(--color-hover);
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.75rem 0;
}
.md-preview pre code {
  background: none;
  padding: 0;
  font-size: 0.875rem;
}
.md-preview blockquote {
  border-left: 3px solid var(--color-accent);
  margin: 0.75rem 0;
  padding: 0.5rem 1rem;
  background: var(--color-hover);
  color: var(--color-muted);
}
.md-preview ul, .md-preview ol { padding-left: 1.5rem; margin: 0.5rem 0; }
.md-preview li { margin: 0.25rem 0; }
.md-preview li input[type="checkbox"] { margin-right: 0.5rem; }
.md-preview table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
.md-preview th, .md-preview td { border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; text-align: left; }
.md-preview th { background: var(--color-hover); font-weight: 600; }
.md-preview tr:nth-child(even) { background: var(--color-surface); }
.md-preview img { max-width: 100%; border-radius: 4px; }
.md-preview hr { border: none; border-top: 1px solid var(--color-border); margin: 1rem 0; }

/* Prism.js 代码高亮自定义颜色（匹配设计令牌） */
.md-preview .token.comment,
.md-preview .token.prolog,
.md-preview .token.doctype,
.md-preview .token.cdata { color: var(--color-muted); }
.md-preview .token.punctuation { color: var(--color-border); }
.md-preview .token.property,
.md-preview .token.tag,
.md-preview .token.boolean,
.md-preview .token.number,
.md-preview .token.constant,
.md-preview .token.symbol { color: var(--color-accent); }
.md-preview .token.selector,
.md-preview .token.attr-name,
.md-preview .token.string,
.md-preview .token.char,
.md-preview .token.builtin { color: var(--color-success); }
.md-preview .token.operator,
.md-preview .token.entity,
.md-preview .token.url { color: var(--color-text); }
.md-preview .token.atrule,
.md-preview .token.attr-value,
.md-preview .token.keyword { color: #7c3aed; }
.md-preview .token.function,
.md-preview .token.class-name { color: #2563eb; }
.md-preview .token.regex,
.md-preview .token.important,
.md-preview .token.variable { color: var(--color-accent); }

/* 打印样式 */
@media print {
  body * { visibility: hidden; }
  .md-preview, .md-preview * { visibility: visible; }
  .md-preview { position: absolute; left: 0; top: 0; width: 100%; }
}
</style>
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: 验证开发服务器页面正常加载**

```bash
pnpm dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/editor/markdown-editor
kill %1
```

Expected: HTTP 200

- [ ] **Step 4: Commit**

```bash
git add src/tools/editor/MarkdownEditor.vue
git commit -m "feat(editor): 实现 Markdown 编辑器主组件"
```

---

### Task 9: 端到端验证

**Files:** 无新增/修改

- [ ] **Step 1: 启动开发服务器并验证功能**

```bash
pnpm dev
```

在浏览器中访问 `http://localhost:4321/editor/markdown-editor`，手动验证：

1. ✅ 页面正常加载，侧边栏显示"编辑器"分类和 Markdown 编辑器工具
2. ✅ 默认分栏模式，左侧编辑区有示例 Markdown，右侧预览区正确渲染
3. ✅ 切换到"编辑"模式，显示全宽编辑区
4. ✅ 切换到"预览"模式，显示全宽预览区
5. ✅ 工具栏按钮（加粗、斜体、行内代码、链接、代码块）正常插入语法
6. ✅ 标题下拉和列表下拉正常工作
7. ✅ 快捷键 Ctrl+B / Ctrl+I / Ctrl+K 正常工作
8. ✅ Tab 键插入 2 空格
9. ✅ 同步滚动开关可正常切换
10. ✅ 导出 .md 按钮下载文件
11. ✅ 导出 .html 按钮下载文件
12. ✅ 导出 .pdf 按钮触发浏览器打印
13. ✅ 复制按钮正常工作
14. ✅ 清空按钮重置编辑区
15. ✅ FAQ 区域正确显示

- [ ] **Step 2: 验证构建无错误**

```bash
pnpm build
```

Expected: 构建成功，无错误输出

- [ ] **Step 3: Commit（如有修复）**

```bash
git add -A
git commit -m "fix(editor): 修复端到端验证发现的问题"
```
