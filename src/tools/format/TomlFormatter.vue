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
