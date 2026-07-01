<script setup lang="ts">
/**
 * JSON 格式化器主组件。
 *
 * 单框交互（对齐 TOML 格式化器）：
 * - 透明 textarea 叠加在 Prism 高亮 <pre> 之上，构成可编辑的语法高亮编辑器；
 * - 行号 gutter 与高亮层通过 transform 跟随 textarea 滚动（三方同步）；
 * - 输入即实时校验（防抖），编辑框边框 + 状态条反馈「有效 / 错误行列号」；
 * - 美化 / 压缩 / JSON Path 查询结果原地替换编辑框内容；
 * - 大文件（>1MB）解析走 Web Worker。
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  formatJson,
  minifyJson,
  analyzeJson,
  checkInputSize,
  formatBytes,
  EXAMPLE_JSON,
  INDENT_OPTIONS,
  WORKER_THRESHOLD,
  type IndentValue,
  type JsonStats,
  type OperationResult,
  type AnalysisResult,
  type WorkerResponse,
} from '../../utils/format/json-formatter';
import { LoaderCircle, Sparkles, Minimize2, FolderUp, Trash2, Check, TriangleAlert } from '@lucide/vue';

/** 实时校验防抖延迟（毫秒） */
const DEBOUNCE_MS = 300;
/** 超过该字节量跳过 Prism 高亮，避免大输入卡顿（降级为转义纯文本） */
const HIGHLIGHT_LIMIT = 500 * 1024;

/** 校验状态 */
type ValidationState = 'empty' | 'valid' | 'invalid';

/** 校验结果展示模型 */
interface ValidationDisplay {
  /** 当前状态 */
  state: ValidationState;
  /** 提示信息（有效为成功语，无效为错误描述） */
  message: string;
}

/** 输入文本（默认填入示例） */
const inputText = ref(EXAMPLE_JSON);
/** 高亮后的 HTML（叠加层底层渲染） */
const highlightedHtml = ref('');
/** 实时校验结果 */
const validation = ref<ValidationDisplay>({ state: 'empty', message: '' });
/** 统计信息 */
const stats = ref<JsonStats | null>(null);
/** 缩进值 */
const indent = ref<IndentValue>(2);
/** 输入大小警告状态 */
const sizeWarning = ref<'ok' | 'warning' | 'error'>('ok');
/** 美化/压缩进行中（Worker 场景，用于禁用按钮 + loading 图标） */
const isFormatting = ref(false);
/** 是否显示行号（默认开启） */
const showLineNumbers = ref(true);
/** textarea 垂直滚动位置（px），用于同步行号 gutter 与高亮层 */
const scrollTop = ref(0);
/** textarea 水平滚动位置（px），用于同步高亮层 */
const scrollLeft = ref(0);
/** textarea 引用（读取滚动位置） */
const textareaRef = ref<HTMLTextAreaElement | null>(null);
/** 隐藏的文件输入引用 */
const fileInputRef = ref<HTMLInputElement | null>(null);
/** 拖拽状态 */
const isDragging = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;
/** Worker 当前模式 */
let workerMode: 'format' | 'minify' = 'format';
/** 校验防抖定时器 */
let validateTimer: ReturnType<typeof setTimeout> | null = null;

/** 当前行数（用于渲染行号；空内容也保留 1 行） */
const lineCount = computed(() => inputText.value.split('\n').length);

/** 统计信息文本 */
const statsText = computed(() => {
  if (!stats.value) return '';
  const s = stats.value;
  return `节点: ${s.nodeCount}  深度: ${s.maxDepth}  ${formatBytes(s.byteSize)}  ${s.lineCount} 行`;
});

/** HTML 转义（高亮降级时使用） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 刷新高亮层：小输入用 Prism 高亮，超大输入降级为转义纯文本 */
function refreshHighlight(): void {
  const text = inputText.value;
  const size = new TextEncoder().encode(text).length;
  highlightedHtml.value =
    size > HIGHLIGHT_LIMIT
      ? escapeHtml(text)
      : Prism.highlight(text, Prism.languages.json, 'json');
}

/** textarea 滚动时同步行号 gutter 与高亮层偏移量 */
function syncScroll(): void {
  if (textareaRef.value) {
    scrollTop.value = textareaRef.value.scrollTop;
    scrollLeft.value = textareaRef.value.scrollLeft;
  }
}

/** 派发 toast 通知（与 Alpine Toast 系统对接） */
function notifyToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 将分析结果应用到校验状态 + 统计 */
function applyAnalysis(result: AnalysisResult): void {
  if (result.ok) {
    validation.value = { state: 'valid', message: result.message };
    stats.value = result.stats ?? null;
  } else {
    let msg = result.message;
    if (result.line !== undefined && result.column !== undefined) {
      msg += `（第 ${result.line} 行，第 ${result.column} 列）`;
    }
    validation.value = { state: 'invalid', message: msg };
    stats.value = null;
  }
}

/** 执行实时校验（同步，含大小检查与高亮刷新） */
function validateNow(): void {
  refreshHighlight();
  if (!inputText.value.trim()) {
    validation.value = { state: 'empty', message: '' };
    sizeWarning.value = 'ok';
    stats.value = null;
    return;
  }
  const sizeStatus = checkInputSize(inputText.value);
  sizeWarning.value = sizeStatus;
  if (sizeStatus === 'error') {
    validation.value = {
      state: 'invalid',
      message: '数据量超过 10MB 限制，无法处理。请减小输入数据。',
    };
    stats.value = null;
    return;
  }
  applyAnalysis(analyzeJson(inputText.value));
}

/** 触发实时校验（带防抖，避免连续输入频繁解析） */
function scheduleValidate(): void {
  if (validateTimer !== null) clearTimeout(validateTimer);
  validateTimer = setTimeout(() => {
    validateNow();
  }, DEBOUNCE_MS);
}

/** 应用格式化结果：原地替换输入框内容，watch 会自动触发重新校验 + 高亮 */
function applyFormatResult(result: OperationResult): void {
  if (result.ok) {
    inputText.value = result.result;
    notifyToast('已完成');
  } else {
    validation.value = { state: 'invalid', message: result.error };
    notifyToast(result.error);
  }
}

/** 美化：解析后按当前缩进重新序列化，原地替换输入框内容 */
function handleFormat(): void {
  if (!inputText.value.trim()) {
    notifyToast('请输入 JSON 数据');
    return;
  }
  const sizeStatus = checkInputSize(inputText.value);
  sizeWarning.value = sizeStatus;
  if (sizeStatus === 'error') {
    validation.value = {
      state: 'invalid',
      message: '数据量超过 10MB 限制，无法处理。请减小输入数据。',
    };
    notifyToast('数据量超过 10MB 限制');
    return;
  }
  const size = new TextEncoder().encode(inputText.value).length;
  if (size > WORKER_THRESHOLD) {
    formatWithWorker('format');
    return;
  }
  applyFormatResult(formatJson(inputText.value, indent.value));
}

/** 压缩：解析后序列化为最小体积，原地替换输入框内容 */
function handleMinify(): void {
  if (!inputText.value.trim()) {
    notifyToast('请输入 JSON 数据');
    return;
  }
  const sizeStatus = checkInputSize(inputText.value);
  sizeWarning.value = sizeStatus;
  if (sizeStatus === 'error') {
    validation.value = {
      state: 'invalid',
      message: '数据量超过 10MB 限制，无法处理。请减小输入数据。',
    };
    notifyToast('数据量超过 10MB 限制');
    return;
  }
  const size = new TextEncoder().encode(inputText.value).length;
  if (size > WORKER_THRESHOLD) {
    formatWithWorker('minify');
    return;
  }
  applyFormatResult(minifyJson(inputText.value));
}

/** 使用 Worker 异步格式化（大文件） */
function formatWithWorker(mode: 'format' | 'minify'): void {
  if (!worker) initWorker();
  isFormatting.value = true;
  worker!.postMessage({ json: inputText.value });
  workerMode = mode;
}

/** 初始化 Worker（大文件美化/压缩） */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-parse.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    isFormatting.value = false;
    const response = e.data;
    if (!response.ok) {
      validation.value = {
        state: 'invalid',
        message: `JSON 语法错误：${response.error}`,
      };
      notifyToast(`JSON 语法错误：${response.error}`);
      return;
    }
    const indentStr = indent.value === 'tab' ? '\t' : indent.value;
    inputText.value =
      workerMode === 'format'
        ? JSON.stringify(response.parsed, null, indentStr)
        : JSON.stringify(response.parsed);
    notifyToast('已完成');
  };
  worker.onerror = () => {
    isFormatting.value = false;
    validation.value = { state: 'invalid', message: 'Worker 执行出错，请重试' };
    notifyToast('Worker 执行出错，请重试');
  };
}

/** 处理文件上传（按钮触发） */
function handleFileUpload(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) readFile(file);
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
    if (typeof text === 'string') inputText.value = text;
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

/** 清空输入与状态，并复位滚动 */
function handleClear(): void {
  if (validateTimer !== null) {
    clearTimeout(validateTimer);
    validateTimer = null;
  }
  inputText.value = '';
  validation.value = { state: 'empty', message: '' };
  sizeWarning.value = 'ok';
  stats.value = null;
  scrollTop.value = 0;
  scrollLeft.value = 0;
}

// 首屏同步校验一次，立即显示状态 + 高亮；后续输入走防抖
validateNow();

watch(inputText, () => {
  scheduleValidate();
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (validateTimer !== null) {
    clearTimeout(validateTimer);
  }
});
</script>

<template>
  <div class="mx-auto max-w-200">
    <ToolHeader
      title="JSON 格式化器"
      description="在线 JSON 格式化、压缩与校验工具"
      :show-example="false"
    />

    <!-- 大小警告 -->
    <div
      v-if="sizeWarning === 'warning'"
      class="mb-4 px-4 py-2 border border-accent/30 rounded-sm bg-accent/5 text-sm text-accent"
    >
      ⚠ 数据量超过 5MB，可能导致浏览器卡顿
    </div>

    <!-- 操作区：美化 / 压缩 / 缩进 / 上传 + 复制 / 清空 / 行号开关 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <!-- 美化 -->
      <button
        type="button"
        :disabled="isFormatting"
        :title="isFormatting ? '美化中' : '美化'"
        aria-label="美化"
        class="w-9 h-9 flex items-center justify-center rounded-sm border transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
        :class="isFormatting ? 'border-accent text-accent' : 'border-border bg-card text-muted'"
        @click="handleFormat"
      >
        <!-- 美化中：旋转 loader -->
        <LoaderCircle v-if="isFormatting" class="animate-spin" :size="16" />
        <!-- 美化：sparkles -->
        <Sparkles v-else :size="16" />
      </button>

      <!-- 压缩 -->
      <button
        type="button"
        :disabled="isFormatting"
        title="压缩"
        aria-label="压缩"
        class="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-card text-muted transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleMinify"
      >
        <Minimize2 :size="16" />
      </button>

      <!-- 缩进 -->
      <div class="flex items-center gap-1.5 ml-1">
        <span class="text-[0.8125rem] text-muted">缩进</span>
        <SelectListbox
          v-model="indent"
          :options="INDENT_OPTIONS"
          class="w-24"
        />
      </div>

      <!-- 上传文件 -->
      <button
        type="button"
        title="上传文件"
        aria-label="上传文件"
        class="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-card text-muted transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
        @click="fileInputRef?.click()"
      >
        <FolderUp :size="16" />
      </button>

      <!-- 右侧：复制 / 清空 / 行号开关 -->
      <div class="ml-auto flex items-center gap-2">
        <CopyButton :text="inputText" />

        <!-- 清空 -->
        <button
          type="button"
          title="清空"
          aria-label="清空"
          class="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-card text-muted transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
        @click="handleClear"
      >
        <Trash2 :size="16" />
      </button>

        <!-- 行号开关 -->
        <div class="flex items-center gap-2 text-[0.8125rem] text-muted">
          <span>行号</span>
          <ToggleSwitch v-model="showLineNumbers" :show-status="false" />
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="handleFileUpload"
    />

    <!-- 行号编辑器：错误时整体边框变红，拖拽时高亮 -->
    <div
      class="flex border rounded-sm overflow-hidden bg-card h-[calc(100vh-380px)] min-h-80 transition-[border-color] duration-150"
      :class="
        validation.state === 'invalid'
          ? 'border-error'
          : isDragging
            ? 'border-accent ring-2 ring-accent/20'
            : 'border-border'
      "
    >
      <!-- 行号列 -->
      <div
        v-if="showLineNumbers"
        aria-hidden="true"
        class="flex-none select-none overflow-hidden bg-hover text-muted border-r border-border"
      >
        <div :style="{ transform: `translateY(${-scrollTop}px)` }" class="pt-4 pb-4 text-right">
          <div
            v-for="n in lineCount"
            :key="n"
            class="px-3 leading-6 font-mono text-[0.8125rem]"
          >{{ n }}</div>
        </div>
      </div>

      <!-- 编辑区：高亮 pre 在底层，透明 textarea 叠在上层 -->
      <div class="relative flex-1 min-w-0 overflow-hidden">
        <!-- 高亮渲染层（底层，不可交互，内容用 transform 跟随滚动） -->
        <div
          aria-hidden="true"
          class="absolute inset-0 overflow-hidden p-4 font-mono text-sm leading-6 whitespace-pre pointer-events-none"
        >
          <div
            :style="{ transform: `translate(${-scrollLeft}px, ${-scrollTop}px)` }"
            class="json-highlight"
            v-html="highlightedHtml"
          ></div>
        </div>
        <!-- 透明可编辑层（上层，接管交互与滚动；wrap=off 保证与 pre 的 whitespace-pre 对齐） -->
        <textarea
          ref="textareaRef"
          v-model="inputText"
          wrap="off"
          class="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent resize-none focus:outline-none font-mono text-sm leading-6 whitespace-pre"
          :style="{ caretColor: 'var(--color-text)' }"
          placeholder="粘贴或输入 JSON 数据，自动校验与高亮，支持拖拽 .json 文件..."
          spellcheck="false"
          aria-label="JSON 输入"
          :aria-invalid="validation.state === 'invalid'"
          @scroll="syncScroll"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        ></textarea>
      </div>
    </div>

    <!-- 实时校验状态条：图标 + 强背景，醒目 -->
    <div
      v-if="validation.state !== 'empty'"
      class="mt-2 flex items-start gap-2 px-4 py-2.5 border rounded-sm text-sm font-sans"
      :class="
        validation.state === 'valid'
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-error/40 bg-error/10 text-error'
      "
      :role="validation.state === 'invalid' ? 'alert' : undefined"
    >
      <!-- 成功图标 -->
      <Check v-if="validation.state === 'valid'" class="mt-0.5 shrink-0" :size="16" :stroke-width="2.5" />
      <!-- 错误图标 -->
      <TriangleAlert v-else class="mt-0.5 shrink-0" :size="16" />
      <span>{{ validation.message }}</span>
    </div>

    <!-- 统计信息 -->
    <div
      v-if="stats && validation.state === 'valid'"
      class="mt-1.5 text-[0.75rem] text-muted font-sans"
    >
      {{ statsText }}
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
