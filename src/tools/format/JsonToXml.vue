<script setup lang="ts">
/**
 * JSON 转 XML 主组件。
 *
 * 将 JSON 数据实时转换为 XML 格式，支持自定义根元素名。
 * 大文件（>500KB）通过 Web Worker 异步处理，避免阻塞主线程。
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  convertJsonToXml,
  validateRootName,
  INPUT_SIZE_LIMIT,
  WORKER_THRESHOLD,
  type JsonToXmlWorkerResponse,
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

/** 防抖延迟（毫秒） */
const DEBOUNCE_MS = 500;

// ---- 状态 ----

/** 输入文本（默认填入示例） */
const inputText = ref(EXAMPLE_JSON);
/** 根元素名称 */
const rootName = ref('root');
/** 输出 XML 文本 */
const outputText = ref('');
/** 输入错误信息 */
const inputError = ref('');
/** 根元素名错误信息 */
const rootNameError = ref('');
/** 运行时错误信息 */
const runtimeError = ref('');
/** 是否正在加载（Worker 场景） */
const isLoading = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;
/** 自动转换防抖定时器 */
let convertTimer: ReturnType<typeof setTimeout> | null = null;
/** 输入框 ref（用于自动聚焦） */
const inputTextarea = ref<HTMLTextAreaElement | null>(null);

// ---- 核心操作 ----

/** 重置输出状态 */
function resetOutput(): void {
  outputText.value = '';
  runtimeError.value = '';
}

/** 校验输入大小 */
function checkInputSize(): boolean {
  const size = new TextEncoder().encode(inputText.value).length;
  if (size > INPUT_SIZE_LIMIT) {
    inputError.value = '数据量超过 10MB 限制，无法处理。请减小输入数据。';
    return false;
  }
  inputError.value = '';
  return true;
}

/** 校验根元素名 */
function checkRootName(): boolean {
  const result = validateRootName(rootName.value);
  if (!result.ok) {
    rootNameError.value = result.error;
    return false;
  }
  rootNameError.value = '';
  return true;
}

/** 执行转换 */
async function doConvert(): Promise<void> {
  // 输入为空时清空输出
  if (!inputText.value.trim()) {
    resetOutput();
    inputError.value = '';
    return;
  }

  // 校验输入大小
  if (!checkInputSize()) {
    resetOutput();
    return;
  }

  // 校验根元素名
  if (!checkRootName()) {
    resetOutput();
    return;
  }

  const size = new TextEncoder().encode(inputText.value).length;

  if (size > WORKER_THRESHOLD) {
    await convertWithWorker();
  } else {
    await convertSync();
  }
}

/** 同步转换 */
async function convertSync(): Promise<void> {
  const result = convertJsonToXml(inputText.value, rootName.value.trim());
  if (!result.ok) {
    runtimeError.value = result.error;
    outputText.value = '';
    return;
  }
  runtimeError.value = '';
  outputText.value = result.result;
}

/** 使用 Worker 异步转换 */
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
        runtimeError.value = response.error;
        outputText.value = '';
        reject(new Error(response.error));
        return;
      }

      runtimeError.value = '';
      outputText.value = response.result;
      resolve();
    };

    worker.onerror = () => {
      isLoading.value = false;
      runtimeError.value = 'Worker 执行出错，请重试';
      outputText.value = '';
      reject(new Error('Worker 执行出错'));
    };

    worker.postMessage({
      json: inputText.value,
      rootName: rootName.value.trim(),
    });
  });
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-to-xml.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

/** 触发自动转换（带防抖） */
function scheduleConvert(): void {
  if (convertTimer !== null) {
    clearTimeout(convertTimer);
  }

  convertTimer = setTimeout(() => {
    doConvert();
  }, DEBOUNCE_MS);
}

/** 清空所有状态 */
function handleClear(): void {
  inputText.value = '';
  rootName.value = 'root';
  resetOutput();
  inputError.value = '';
  rootNameError.value = '';
}

// ---- 监听 ----

watch([inputText, rootName], () => {
  scheduleConvert();
}, { immediate: true });

// ---- 生命周期 ----

onMounted(() => {
  nextTick(() => {
    inputTextarea.value?.focus();
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
      description="将 JSON 数据转换为 XML 格式，支持自定义根元素名称"
      :show-example="false"
    />

    <!-- 操作栏 -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-[0.8125rem] text-muted">根元素名:</label>
        <input
          v-model="rootName"
          type="text"
          class="px-3 py-1.5 w-32 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          placeholder="root"
          spellcheck="false"
        />
      </div>

      <div v-if="rootNameError" class="text-[0.75rem] text-error">
        {{ rootNameError }}
      </div>

      <div class="ml-auto flex gap-2">
        <CopyButton :text="outputText" label="复制结果" />
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入区 -->
      <template #input>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">JSON 输入</label>
          <textarea
            ref="inputTextarea"
            v-model="inputText"
            class="w-full h-[calc(100vh-360px)] min-h-80 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            placeholder="粘贴或输入 JSON 数据..."
            spellcheck="false"
            aria-label="JSON 输入"
          />
          <div v-if="inputError" class="mt-1 text-[0.75rem] text-error">{{ inputError }}</div>
        </div>
      </template>

      <!-- 输出区 -->
      <template #output>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">XML 输出</label>

          <!-- 加载中 -->
          <div
            v-if="isLoading"
            class="w-full h-[calc(100vh-360px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            正在转换...
          </div>

          <!-- 错误输出 -->
          <div
            v-else-if="runtimeError"
            class="w-full h-[calc(100vh-360px)] min-h-80 p-3 border border-border rounded-sm bg-card overflow-auto"
          >
            <pre class="m-0 text-sm text-error whitespace-pre-wrap font-mono">{{ runtimeError }}</pre>
          </div>

          <!-- 正常输出 -->
          <div
            v-else-if="outputText"
            class="w-full h-[calc(100vh-360px)] min-h-80 p-3 border border-border rounded-sm bg-card overflow-auto"
          >
            <pre class="m-0 text-sm font-mono whitespace-pre-wrap leading-relaxed text-text">{{ outputText }}</pre>
          </div>

          <!-- 空状态 -->
          <div
            v-else
            class="w-full h-[calc(100vh-360px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            输入 JSON 数据后将自动转换为 XML
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
