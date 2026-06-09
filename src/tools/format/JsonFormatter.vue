<script setup lang="ts">
/**
 * JSON 格式化器主组件。
 *
 * 支持 JSON 美化、压缩、验证和 JSON Path 查询，
 * 使用 Prism.js 实现语法高亮，大文件通过 Web Worker 异步解析。
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
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

/** Worker 当前模式 */
let workerMode: 'format' | 'minify' = 'format';

/** 使用 Worker 异步格式化 */
function formatWithWorker(mode: 'format' | 'minify'): void {
  if (!worker) {
    initWorker();
  }
  isLoading.value = true;
  worker!.postMessage({ json: inputText.value });
  workerMode = mode;
}

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

// ---- 监听输入大小 ----

watch(inputText, () => {
  const status = checkInputSize(inputText.value);
  sizeWarning.value = status;
});

// ---- 生命周期 ----

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
    <!-- 头部 -->
    <ToolHeader
      title="JSON 格式化器"
      description="在线 JSON 格式化、压缩、验证与查询工具"
      :show-example="false"
    />

    <!-- 大小警告 -->
    <div
      v-if="sizeWarning === 'warning'"
      class="mb-4 px-4 py-2 border border-accent/30 rounded-sm bg-accent/5 text-sm text-accent"
    >
      ⚠ 数据量超过 5MB，可能导致浏览器卡顿
    </div>

    <!-- 操作栏（顶部横跨两栏） -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
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

      <div class="flex items-center gap-2 ml-2">
        <button
          class="px-3 py-1.5 border border-border rounded-sm bg-card text-muted text-[0.75rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-hover hover:text-text"
          @click="fileInputRef?.click()"
        >
          📁 上传文件
        </button>
      </div>

      <div class="ml-auto flex gap-2">
        <CopyButton :text="copyableText" label="复制结果" />
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal">
      <!-- 输入区 -->
      <template #input>
        <div class="relative">
          <textarea
            v-model="inputText"
            class="w-full h-[calc(100vh-380px)] min-h-80 p-4 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
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
      </template>

      <!-- 输出区 -->
      <template #output>
        <!-- 加载中 -->
        <div
          v-if="isLoading"
          class="w-full h-[calc(100vh-380px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
        >
          正在解析...
        </div>

        <!-- 错误输出 -->
        <div
          v-else-if="isError"
          class="w-full h-[calc(100vh-380px)] min-h-80 p-4 border border-border rounded-sm bg-card overflow-auto"
        >
          <pre class="m-0 text-sm text-error whitespace-pre-wrap font-mono">{{ errorMessage }}</pre>
        </div>

        <!-- 正常输出 -->
        <div
          v-else-if="outputText"
          class="w-full h-[calc(100vh-380px)] min-h-80 p-4 border border-border rounded-sm bg-card overflow-auto"
        >
          <pre class="m-0 text-sm font-mono whitespace-pre-wrap leading-relaxed json-highlight" v-html="highlightedHtml"></pre>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="w-full h-[calc(100vh-380px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
        >
          点击"美化"、"压缩"或"验证"按钮查看结果
        </div>

        <!-- 统计信息 -->
        <div class="mt-2">
          <span v-if="stats" class="text-[0.75rem] text-muted">{{ statsText }}</span>
          <span v-else class="text-[0.75rem] text-muted">统计信息将在操作后显示</span>
        </div>
      </template>
    </ResponsiveWorkspace>

    <!-- JSON Path 查询栏 -->
    <div class="mt-6">
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
