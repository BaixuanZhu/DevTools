<script setup lang="ts">
/**
 * Markdown 编辑器主组件。
 *
 * 支持仅编辑 / 仅预览 / 分栏三种视图模式，
 * 提供图标化工具栏辅助语法插入，支持导出 .md / .html / .pdf。
 */
import { ref, computed, nextTick, onMounted } from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
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

// ---- 图标按钮样式 ----

/** 视图模式按钮基础样式 */
const viewBtnBase = 'w-8 h-8 flex items-center justify-center rounded-sm border cursor-pointer transition-[background-color,border-color,color] duration-150';

/** 视图模式 - 选中态 */
const activeView = 'bg-accent border-accent text-white';

/** 视图模式 - 未选中态 */
const inactiveView = 'bg-card border-border text-muted hover:bg-hover hover:text-text';

/** 工具按钮样式（无激活态） */
const toolBtn = 'w-8 h-8 flex items-center justify-center rounded-sm border border-border bg-card text-muted cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text';

/** SVG 图标通用属性 */
const svgAttrs = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

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
  try {
    exportMarkdown(markdownSource.value);
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '已导出 Markdown 文件' } }));
  } catch {
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '导出失败，请重试', type: 'error' } }));
  }
}

/** 导出 .html */
function handleExportHtml(): void {
  try {
    exportHtml(renderedHtml.value);
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '已导出 HTML 文件' } }));
  } catch {
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '导出失败，请重试', type: 'error' } }));
  }
}

/** 导出 .pdf */
function handleExportPdf(): void {
  try {
    exportPdf();
  } catch {
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '导出失败，请重试', type: 'error' } }));
  }
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

    <!-- 图标化工具栏（统一一行） -->
    <div class="flex flex-wrap items-center gap-1.5 mb-4">

      <!-- 1. 视图模式组 -->
      <div class="flex items-center gap-1">
        <!-- 分栏 -->
        <button
          :class="[viewBtnBase, viewMode === 'split' ? activeView : inactiveView]"
          title="分栏"
          @click="viewMode = 'split'"
        >
          <svg v-bind="svgAttrs">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
        </button>
        <!-- 编辑 -->
        <button
          :class="[viewBtnBase, viewMode === 'edit' ? activeView : inactiveView]"
          title="编辑"
          @click="viewMode = 'edit'"
        >
          <svg v-bind="svgAttrs">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <!-- 预览 -->
        <button
          :class="[viewBtnBase, viewMode === 'preview' ? activeView : inactiveView]"
          title="预览"
          @click="viewMode = 'preview'"
        >
          <svg v-bind="svgAttrs">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <!-- 2. 编辑工具组（仅编辑/分栏模式可用） -->
      <template v-if="viewMode !== 'preview'">
        <span class="w-px h-5 bg-border"></span>
        <div class="flex items-center gap-1">
          <!-- 标题下拉 -->
          <SelectListbox
            :model-value="headingLevel"
            :options="HEADING_OPTIONS"
            class="w-16"
            @update:model-value="handleHeadingChange($event as string)"
          />
          <!-- 加粗 -->
          <button :class="toolBtn" title="加粗 (Ctrl+B)" @click="handleBold">
            <svg v-bind="svgAttrs">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            </svg>
          </button>
          <!-- 斜体 -->
          <button :class="toolBtn" title="斜体 (Ctrl+I)" @click="handleItalic">
            <svg v-bind="svgAttrs">
              <line x1="19" y1="4" x2="10" y2="4" />
              <line x1="14" y1="20" x2="5" y2="20" />
              <line x1="15" y1="4" x2="9" y2="20" />
            </svg>
          </button>
          <!-- 行内代码 -->
          <button :class="toolBtn" title="行内代码" @click="handleInlineCode">
            <svg v-bind="svgAttrs">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <!-- 链接 -->
          <button :class="toolBtn" title="链接 (Ctrl+K)" @click="handleLink">
            <svg v-bind="svgAttrs">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <!-- 代码块 -->
          <button :class="toolBtn" title="代码块" @click="handleCodeBlock">
            <svg v-bind="svgAttrs">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          <!-- 列表下拉 -->
          <SelectListbox
            :model-value="listType"
            :options="LIST_OPTIONS"
            class="w-24"
            @update:model-value="handleListChange($event as string)"
          />
        </div>
      </template>

      <!-- 3. 实用工具组 -->
      <span class="w-px h-5 bg-border"></span>
      <div class="flex items-center gap-1.5">
        <!-- 同步滚动切换（仅分栏模式可见） -->
        <button
          v-show="viewMode === 'split'"
          :class="[
            viewBtnBase,
            syncScroll
              ? 'bg-accent/10 border-accent/30 text-accent'
              : inactiveView,
          ]"
          title="同步滚动"
          @click="syncScroll = !syncScroll"
        >
          <svg v-bind="svgAttrs">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

        <!-- 导出下拉菜单 -->
        <Menu as="div" class="relative">
          <MenuButton :class="toolBtn" title="导出">
            <svg v-bind="svgAttrs">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </MenuButton>
          <MenuItems class="absolute right-0 z-10 mt-1 w-28 origin-top-right rounded-sm bg-card border border-border py-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <MenuItem v-slot="{ active }">
              <button
                :class="[active ? 'bg-hover' : '', 'block w-full px-3 py-1.5 text-center text-[0.8125rem] text-text font-sans']"
                @click="handleExportMd"
              >Markdown</button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                :class="[active ? 'bg-hover' : '', 'block w-full px-3 py-1.5 text-center text-[0.8125rem] text-text font-sans']"
                @click="handleExportHtml"
              >HTML</button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                :class="[active ? 'bg-hover' : '', 'block w-full px-3 py-1.5 text-center text-[0.8125rem] text-text font-sans']"
                @click="handleExportPdf"
              >PDF</button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </div>

    <!-- 仅编辑模式 -->
    <CodePanel v-if="viewMode === 'edit'" label="Markdown 编辑" showClear showCopy :copyText="markdownSource" @clear="handleClear">
      <textarea
        ref="editorRef"
        v-model="markdownSource"
        class="w-full h-[calc(100vh-300px)] min-h-96 p-4 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus:border-accent"
        spellcheck="false"
        aria-label="Markdown 编辑区"
        @keydown="handleKeydown"
      ></textarea>
    </CodePanel>

    <!-- 仅预览模式 -->
    <div
      v-else-if="viewMode === 'preview'"
      class="border border-border rounded-sm bg-card p-6 overflow-auto h-[calc(100vh-300px)] min-h-96"
    >
      <div class="md-preview" v-html="renderedHtml"></div>
    </div>

    <!-- 分栏模式 -->
    <div
      v-else
      class="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      <!-- 编辑区 -->
      <CodePanel label="编辑" showClear showCopy :copyText="markdownSource" @clear="handleClear">
        <textarea
          ref="editorRef"
          v-model="markdownSource"
          class="w-full h-[calc(100vh-340px)] min-h-80 p-4 border border-border rounded-sm bg-card text-text font-mono text-sm resize-none focus:outline-none focus:border-accent"
          spellcheck="false"
          aria-label="Markdown 编辑区"
          @keydown="handleKeydown"
          @scroll="handleEditorScroll"
        ></textarea>
      </CodePanel>

      <!-- 预览区 -->
      <div class="border border-border rounded-sm overflow-hidden bg-card">
        <div
          ref="previewRef"
          class="w-full h-[calc(100vh-340px)] min-h-80 p-6 overflow-auto"
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
