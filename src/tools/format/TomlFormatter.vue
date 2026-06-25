<script setup lang="ts">
/**
 * TOML 格式化器主组件。
 *
 * 单框交互：输入即实时校验语法（编辑器边框 + 下方状态条反馈「有效 / 错误行列号」）；
 * 「美化」按钮将解析后重新序列化的规范格式原地替换输入框内容；
 * 大文件（>1MB）美化走 Web Worker。
 *
 * 编辑器自带行号 gutter（默认开启，可切换），通过 transform 与 textarea 滚动同步。
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import {
  formatToml,
  validateToml,
  checkInputSize,
  WORKER_THRESHOLD,
  EXAMPLE_TOML_FORMATTER,
  type ValidationResult,
  type TomlStringResult,
} from '../../utils/format/toml-formatter';

/** 实时校验防抖延迟（毫秒） */
const DEBOUNCE_MS = 300;

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
const inputText = ref(EXAMPLE_TOML_FORMATTER);
/** 实时校验结果 */
const validation = ref<ValidationDisplay>({ state: 'empty', message: '' });
/** 大小警告状态 */
const sizeWarning = ref<'ok' | 'warning' | 'error'>('ok');
/** 美化进行中（Worker 场景，用于禁用按钮 + loading 图标） */
const isFormatting = ref(false);
/** 是否显示行号（默认开启） */
const showLineNumbers = ref(true);
/** textarea 垂直滚动位置（px），用于同步行号 gutter */
const scrollTop = ref(0);
/** textarea 引用（读取滚动位置） */
const textareaRef = ref<HTMLTextAreaElement | null>(null);
/** Worker 实例 */
let worker: Worker | null = null;
/** 校验防抖定时器 */
let validateTimer: ReturnType<typeof setTimeout> | null = null;

/** 当前行数（用于渲染行号；空内容也保留 1 行） */
const lineCount = computed(() => inputText.value.split('\n').length);

/** textarea 滚动时同步行号 gutter 的偏移量 */
function syncGutter(): void {
  if (textareaRef.value) scrollTop.value = textareaRef.value.scrollTop;
}

/** 派发 toast 通知（与 Alpine Toast 系统对接） */
function notifyToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 执行实时校验（同步） */
function validateNow(): void {
  if (!inputText.value.trim()) {
    validation.value = { state: 'empty', message: '' };
    sizeWarning.value = 'ok';
    return;
  }

  const sizeStatus = checkInputSize(inputText.value);
  sizeWarning.value = sizeStatus;
  if (sizeStatus === 'error') {
    validation.value = {
      state: 'invalid',
      message: '数据量超过 10MB 限制，无法处理。请减小输入数据。',
    };
    return;
  }

  const result: ValidationResult = validateToml(inputText.value);
  validation.value = result.ok
    ? { state: 'valid', message: 'TOML 格式有效' }
    : { state: 'invalid', message: result.message };
}

/** 触发实时校验（带防抖，避免连续输入频繁解析） */
function scheduleValidate(): void {
  if (validateTimer !== null) clearTimeout(validateTimer);
  validateTimer = setTimeout(() => {
    validateNow();
  }, DEBOUNCE_MS);
}

/** 应用美化结果：原地替换输入框内容，watch 会自动触发重新校验 */
function applyFormatResult(result: TomlStringResult): void {
  if (result.ok) {
    inputText.value = result.result;
    notifyToast('已美化');
  } else {
    validation.value = { state: 'invalid', message: result.error };
    notifyToast(result.error);
  }
}

/** 初始化 Worker（大文件美化） */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/toml-formatter.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.onmessage = (e: MessageEvent<TomlStringResult>) => {
    isFormatting.value = false;
    applyFormatResult(e.data);
  };
  worker.onerror = () => {
    isFormatting.value = false;
    const msg = 'Worker 执行出错，请重试';
    validation.value = { state: 'invalid', message: msg };
    notifyToast(msg);
  };
}

/** 美化：解析后重新序列化，原地替换输入框内容 */
function handleFormat(): void {
  if (!inputText.value.trim()) {
    notifyToast('请输入 TOML 数据');
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
    if (!worker) initWorker();
    isFormatting.value = true;
    worker!.postMessage({ text: inputText.value });
    return;
  }
  applyFormatResult(formatToml(inputText.value));
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
  scrollTop.value = 0;
}

// 首屏同步校验一次，立即显示状态；后续输入走防抖
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
      title="TOML 格式化器"
      description="在线 TOML 语法校验与格式美化工具"
      :show-example="false"
    />

    <!-- 大小警告 -->
    <div
      v-if="sizeWarning === 'warning'"
      class="mb-4 px-4 py-2 border border-accent/30 rounded-sm bg-accent/5 text-sm text-accent"
    >
      ⚠ 数据量超过 5MB，可能导致浏览器卡顿
    </div>

    <!-- 操作区：美化 / 复制 / 清空（图标按钮）+ 行号开关 -->
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
        <svg
          v-if="isFormatting"
          class="animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <!-- 美化：sparkles -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6L12 2z" />
        </svg>
      </button>

      <!-- 复制 -->
      <CopyButton :text="inputText" />

      <!-- 清空 -->
      <button
        type="button"
        title="清空"
        aria-label="清空"
        class="w-9 h-9 flex items-center justify-center rounded-sm border border-border bg-card text-muted transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
        @click="handleClear"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      <!-- 行号开关：label 紧贴开关 -->
      <div class="ml-auto flex items-center gap-2 text-[0.8125rem] text-muted">
        <span>行号</span>
        <ToggleSwitch v-model="showLineNumbers" :show-status="false" />
      </div>
    </div>

    <!-- 行号编辑器：错误时整体边框变红 -->
    <div
      class="flex border rounded-sm overflow-hidden bg-card h-[calc(100vh-380px)] min-h-80 transition-[border-color] duration-150"
      :class="validation.state === 'invalid' ? 'border-error' : 'border-border'"
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
      <!-- 编辑区 -->
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="flex-1 min-w-0 p-4 bg-card text-text font-mono text-sm leading-6 whitespace-pre resize-none focus:outline-none"
        placeholder="粘贴或输入 TOML 数据，自动校验语法..."
        spellcheck="false"
        aria-label="TOML 输入"
        :aria-invalid="validation.state === 'invalid'"
        @scroll="syncGutter"
      ></textarea>
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
      <svg
        v-if="validation.state === 'valid'"
        class="mt-0.5 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <!-- 错误图标 -->
      <svg
        v-else
        class="mt-0.5 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>{{ validation.message }}</span>
    </div>
  </div>
</template>
