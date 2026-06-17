<script setup lang="ts">
/**
 * JSON 转 TypeScript 主组件。
 *
 * 将 JSON 数据实时推断为 TypeScript interface 定义，支持自定义顶层类型名。
 * 大文件（>500KB）通过 Web Worker 异步处理，避免阻塞主线程。
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import {
  jsonToTs,
  validateTypeName,
  INPUT_SIZE_LIMIT,
  WORKER_THRESHOLD,
  type JsonToTsWorkerResponse,
} from '../../utils/format/json-to-ts';

// ---- 常量 ----

/** 示例 JSON */
const EXAMPLE_JSON = `{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob", "active": true }
  ],
  "count": 2,
  "tags": ["a", 1],
  "meta": null
}`;

/** 防抖延迟（毫秒） */
const DEBOUNCE_MS = 500;

// ---- 状态 ----

/** 输入文本（默认填入示例） */
const inputText = ref(EXAMPLE_JSON);
/** 顶层类型名 */
const rootName = ref('RootObject');
/** 输出 TypeScript 文本 */
const outputText = ref('');
/** 输入错误信息 */
const inputError = ref('');
/** 根类型名错误信息 */
const rootNameError = ref('');
/** 运行时错误信息 */
const runtimeError = ref('');
/** 是否正在加载（Worker 场景） */
const isLoading = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;
/** 自动转换防抖定时器 */
let convertTimer: ReturnType<typeof setTimeout> | null = null;
/** 转换请求序列号（丢弃过期 Worker 响应，避免快速连续输入时 UI 错配） */
let convertSeq = 0;
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

/** 校验根类型名 */
function checkRootName(): boolean {
  const result = validateTypeName(rootName.value);
  if (!result.ok) {
    rootNameError.value = result.error;
    return false;
  }
  rootNameError.value = '';
  return true;
}

/** 执行转换 */
async function doConvert(): Promise<void> {
  // 新一轮转换：在任何提前返回（空输入 / 超限 / 根类型名非法）之前使
  // 所有在途（过期）Worker 响应失效，避免清空或校验失败后被晚到的
  // Worker 结果污染输出
  convertSeq++;

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

  // 校验根类型名
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
  const result = jsonToTs(inputText.value, rootName.value.trim());
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
  const seq = convertSeq;

  await new Promise<void>((resolve, reject) => {
    if (!worker) {
      reject(new Error('Worker 初始化失败'));
      return;
    }

    worker.onmessage = (e: MessageEvent<JsonToTsWorkerResponse>) => {
      // 过期响应（输入已变更、被更新的请求取代）：丢弃，不更新 UI
      if (e.data.seq !== convertSeq) return;

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
      // onerror 不携带 seq，用闭包 seq 近似过滤过期请求
      if (seq !== convertSeq) return;

      isLoading.value = false;
      runtimeError.value = 'Worker 执行出错，请重试';
      outputText.value = '';
      reject(new Error('Worker 执行出错'));
    };

    worker.postMessage({
      json: inputText.value,
      rootName: rootName.value.trim(),
      seq,
    });
  });
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-to-ts.worker.ts', import.meta.url),
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
  rootName.value = 'RootObject';
  resetOutput();
  inputError.value = '';
  rootNameError.value = '';
  // 清空时若有在途 Worker 请求，立即取消加载态（响应到达后会被 seq 丢弃）
  isLoading.value = false;
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
      title="JSON 转 TS"
      description="将 JSON 智能推断为 TypeScript interface，自动合并数组字段并标注可选类型"
      :show-example="false"
    />

    <!-- 根类型名配置 -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-[0.8125rem] text-muted">根类型名:</label>
        <input
          v-model="rootName"
          type="text"
          class="px-3 py-1.5 w-40 border border-border rounded-sm bg-card text-text font-mono text-sm focus:outline-none focus:border-accent"
          placeholder="RootObject"
          spellcheck="false"
          aria-label="根类型名"
          aria-describedby="root-name-error"
        />
      </div>

      <div v-if="rootNameError" id="root-name-error" class="text-[0.75rem] text-error">
        {{ rootNameError }}
      </div>
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入区 -->
      <template #input>
        <CodePanel label="JSON 输入" showClear @clear="handleClear">
          <textarea
            ref="inputTextarea"
            v-model="inputText"
            class="w-full h-[calc(100vh-280px)] min-h-80 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus:border-accent"
            placeholder="粘贴或输入 JSON 数据..."
            spellcheck="false"
            aria-label="JSON 输入"
            aria-describedby="json-input-error"
          />
          <div v-if="inputError" id="json-input-error" class="mt-1 text-[0.75rem] text-error">{{ inputError }}</div>
        </CodePanel>
      </template>

      <!-- 输出区 -->
      <template #output>
        <CodePanel label="TypeScript 输出" showCopy :copyText="outputText">
          <!-- 加载中 -->
          <div
            v-if="isLoading"
            class="w-full h-[calc(100vh-280px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            正在转换...
          </div>

          <!-- 错误输出 -->
          <div
            v-else-if="runtimeError"
            class="w-full h-[calc(100vh-280px)] min-h-80 p-3 border border-border rounded-sm bg-card overflow-auto"
          >
            <pre class="m-0 text-sm text-error whitespace-pre-wrap font-mono">{{ runtimeError }}</pre>
          </div>

          <!-- 正常输出 -->
          <div
            v-else-if="outputText"
            class="w-full h-[calc(100vh-280px)] min-h-80 p-3 border border-border rounded-sm bg-card overflow-auto"
          >
            <pre class="m-0 text-sm font-mono whitespace-pre-wrap leading-relaxed text-text">{{ outputText }}</pre>
          </div>

          <!-- 空状态 -->
          <div
            v-else
            class="w-full h-[calc(100vh-280px)] min-h-80 flex items-center justify-center border border-border rounded-sm bg-card text-muted text-sm"
          >
            输入 JSON 数据后将自动生成 TypeScript 类型
          </div>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
