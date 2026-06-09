<script setup lang="ts">
/**
 * JSON Diff 主组件。
 *
 * 支持语义 diff 和严格文本 diff 两种模式，
 * 使用 Web Worker 处理大文件，提供同步滚动、折叠控制等功能。
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import {
  parseJsonSafe,
  semanticDiff,
  strictDiff,
  checkInputSize,
  measureMaxDepth,
  WORKER_THRESHOLD,
  INPUT_SIZE_LIMIT,
  AUTO_FOLD_THRESHOLD,
  EXPAND_CONFIRM_THRESHOLD,
  MAX_DIFF_DEPTH,
  type DiffMode,
  type DiffOptions,
  type DiffResult,
  type StrictDiffResult,
  type DiffItem,
  type LineDiff,
  type WorkerRequest,
  type WorkerResponse,
} from '../../utils/format/json-diff';

// ---- 状态 ----

/** 对比模式 */
const diffMode = ref<DiffMode>('semantic');
/** 对比选项 */
const options = ref<DiffOptions>({
  ignoreArrayOrder: false,
  indentSize: 2,
});
/** 左侧输入文本 */
const leftInput = ref('');
/** 右侧输入文本 */
const rightInput = ref('');
/** 左侧解析错误 */
const leftError = ref('');
/** 右侧解析错误 */
const rightError = ref('');
/** 是否正在加载 */
const isLoading = ref(false);
/** 是否已执行对比 */
const hasResult = ref(false);
/** 语义模式结果 */
const semanticResult = ref<DiffResult | null>(null);
/** 严格模式结果 */
const strictResult = ref<StrictDiffResult | null>(null);
/** 是否完全一致 */
const isIdentical = ref(false);
/** 运行时错误 */
const runtimeError = ref('');
/** 是否展开全部 */
const isExpanded = ref(false);
/** 是否显示展开确认对话框 */
const showExpandConfirm = ref(false);
/** 待展开的行数 */
const pendingExpandLines = ref(0);
/** 左侧文件输入 ref */
const leftFileInputRef = ref<HTMLInputElement | null>(null);
/** 右侧文件输入 ref */
const rightFileInputRef = ref<HTMLInputElement | null>(null);
/** 左侧拖拽状态 */
const leftDragging = ref(false);
/** 右侧拖拽状态 */
const rightDragging = ref(false);
/** Worker 实例 */
let worker: Worker | null = null;
/** 左侧 textarea ref（用于自动聚焦） */
const leftTextarea = ref<HTMLTextAreaElement | null>(null);
/** 右侧 textarea ref */
const rightTextarea = ref<HTMLTextAreaElement | null>(null);

// ---- 计算属性 ----

/** 当前模式的结果 */
const currentResult = computed(() => {
  if (diffMode.value === 'semantic') {
    return semanticResult.value;
  }
  return strictResult.value;
});

/** 差异行数（用于折叠控制） */
const diffLines = computed(() => {
  if (diffMode.value === 'semantic' && semanticResult.value) {
    return semanticResult.value.items.length;
  }
  if (diffMode.value === 'strict' && strictResult.value) {
    return strictResult.value.lines.length;
  }
  return 0;
});

/** 是否需要折叠 */
const needsFold = computed(() => diffLines.value > AUTO_FOLD_THRESHOLD);

/** 统计摘要文本 */
const summaryText = computed(() => {
  if (!hasResult.value) return '';

  if (isIdentical.value) {
    return '✅ 两份 JSON 完全一致，无差异';
  }

  if (diffMode.value === 'semantic' && semanticResult.value) {
    const s = semanticResult.value.summary;
    return `✅ ${s.unchanged} 处一致  🟢 ${s.added} 处新增  🔴 ${s.removed} 处删除  🟡 ${s.modified} 处修改`;
  }

  if (diffMode.value === 'strict' && strictResult.value) {
    const s = strictResult.value.summary;
    return `✅ ${s.unchanged} 处一致  🟢 ${s.added} 处新增  🔴 ${s.removed} 处删除`;
  }

  return '';
});

/** 可复制的差异文本 */
const copyableText = computed(() => {
  if (!currentResult.value) return '';

  if (diffMode.value === 'strict' && strictResult.value) {
    return strictResult.value.lines
      .map((line) => {
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        return `${prefix} ${line.content}`;
      })
      .join('\n');
  }

  // 语义模式返回 JSON 格式
  return JSON.stringify(currentResult.value, null, 2);
});

// ---- 核心操作 ----

/** 执行对比 */
async function handleCompare(): Promise<void> {
  // 重置状态
  leftError.value = '';
  rightError.value = '';
  runtimeError.value = '';
  hasResult.value = false;
  isIdentical.value = false;
  semanticResult.value = null;
  strictResult.value = null;

  // 验证输入
  if (!leftInput.value.trim()) {
    leftError.value = '请输入原始 JSON';
    return;
  }
  if (!rightInput.value.trim()) {
    rightError.value = '请输入修改后 JSON';
    return;
  }

  // 检查输入大小
  const leftSize = new TextEncoder().encode(leftInput.value).length;
  const rightSize = new TextEncoder().encode(rightInput.value).length;

  if (leftSize > INPUT_SIZE_LIMIT) {
    leftError.value = '数据量超过 10MB 限制';
    return;
  }
  if (rightSize > INPUT_SIZE_LIMIT) {
    rightError.value = '数据量超过 10MB 限制';
    return;
  }

  // 检查深度
  const leftDepth = measureMaxDepth(leftInput.value);
  const rightDepth = measureMaxDepth(rightInput.value);

  if (leftDepth > MAX_DIFF_DEPTH) {
    leftError.value = `嵌套层级过深（${leftDepth} 层），最大支持 ${MAX_DIFF_DEPTH} 层`;
    return;
  }
  if (rightDepth > MAX_DIFF_DEPTH) {
    rightError.value = `嵌套层级过深（${rightDepth} 层），最大支持 ${MAX_DIFF_DEPTH} 层`;
    return;
  }

  // 选择同步或异步执行
  const totalSize = leftSize + rightSize;
  if (totalSize > WORKER_THRESHOLD) {
    await compareWithWorker();
  } else {
    await compareSync();
  }
}

/** 同步对比 */
async function compareSync(): Promise<void> {
  isLoading.value = true;

  await nextTick();

  try {
    await executeDiff();
  } catch (e) {
    runtimeError.value = e instanceof Error ? e.message : String(e);
  } finally {
    isLoading.value = false;
  }
}

/** 使用 Worker 异步对比 */
async function compareWithWorker(): Promise<void> {
  if (!worker) {
    initWorker();
  }

  isLoading.value = true;

  await new Promise<void>((resolve, reject) => {
    if (!worker) {
      reject(new Error('Worker 初始化失败'));
      return;
    }

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      isLoading.value = false;
      const response = e.data;

      if (!response.ok) {
        runtimeError.value = response.error;
        reject(new Error(response.error));
        return;
      }

      if (diffMode.value === 'semantic') {
        semanticResult.value = response.result as DiffResult;
      } else {
        strictResult.value = response.result as StrictDiffResult;
      }

      hasResult.value = true;
      isIdentical.value = checkIdentical();
      resolve();
    };

    worker.onerror = () => {
      isLoading.value = false;
      runtimeError.value = 'Worker 执行出错';
      reject(new Error('Worker 执行出错'));
    };

    const request: WorkerRequest = {
      leftJson: leftInput.value,
      rightJson: rightInput.value,
      mode: diffMode.value,
      options: options.value,
    };

    worker.postMessage(request);
  });
}

/** 执行对比逻辑 */
async function executeDiff(): Promise<void> {
  // 解析 JSON
  const leftParse = parseJsonSafe(leftInput.value);
  const rightParse = parseJsonSafe(rightInput.value);

  if (!leftParse.ok) {
    leftError.value = leftParse.error;
    return;
  }
  if (!rightParse.ok) {
    rightError.value = rightParse.error;
    return;
  }

  // 根据模式执行对比
  if (diffMode.value === 'semantic') {
    const result = semanticDiff(leftParse.data, rightParse.data, {
      ignoreArrayOrder: options.value.ignoreArrayOrder,
    });
    semanticResult.value = result;
  } else {
    const result = strictDiff(leftInput.value, rightInput.value, options.value.indentSize);
    strictResult.value = result;
  }

  hasResult.value = true;
  isIdentical.value = checkIdentical();
}

/** 检查是否完全一致 */
function checkIdentical(): boolean {
  if (diffMode.value === 'semantic' && semanticResult.value) {
    return (
      semanticResult.value.summary.added === 0 &&
      semanticResult.value.summary.removed === 0 &&
      semanticResult.value.summary.modified === 0
    );
  }
  if (diffMode.value === 'strict' && strictResult.value) {
    return (
      strictResult.value.summary.added === 0 &&
      strictResult.value.summary.removed === 0
    );
  }
  return false;
}

/** 初始化 Worker */
function initWorker(): void {
  worker = new Worker(
    new URL('../../utils/format/json-diff.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

// ---- 展开控制 ----

/** 处理展开全部 */
function handleExpandAll(): void {
  const lines = diffLines.value;
  if (lines > EXPAND_CONFIRM_THRESHOLD) {
    pendingExpandLines.value = lines;
    showExpandConfirm.value = true;
  } else {
    isExpanded.value = true;
  }
}

/** 确认展开 */
function confirmExpand(): void {
  isExpanded.value = true;
  showExpandConfirm.value = false;
}

// ---- 文件操作 ----

/** 处理左侧文件上传 */
function handleLeftFileUpload(event: Event): void {
  handleFileUpload('left', event);
}

/** 处理右侧文件上传 */
function handleRightFileUpload(event: Event): void {
  handleFileUpload('right', event);
}

/** 处理文件上传 */
function handleFileUpload(side: 'left' | 'right', event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      if (side === 'left') {
        leftInput.value = text;
      } else {
        rightInput.value = text;
      }
    }
  };
  reader.readAsText(file);
}

/** 处理左侧拖拽 */
function handleLeftDrop(event: DragEvent): void {
  handleDrop('left', event);
}

/** 处理右侧拖拽 */
function handleRightDrop(event: DragEvent): void {
  handleDrop('right', event);
}

/** 处理拖拽 */
function handleDrop(side: 'left' | 'right', event: DragEvent): void {
  if (side === 'left') {
    leftDragging.value = false;
  } else {
    rightDragging.value = false;
  }

  const file = event.dataTransfer?.files[0];
  if (!file) return;

  event.preventDefault();

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      if (side === 'left') {
        leftInput.value = text;
      } else {
        rightInput.value = text;
      }
    }
  };
  reader.readAsText(file);
}

/** 处理左侧拖拽进入 */
function handleLeftDragOver(event: DragEvent): void {
  event.preventDefault();
  leftDragging.value = true;
}

/** 处理右侧拖拽进入 */
function handleRightDragOver(event: DragEvent): void {
  event.preventDefault();
  rightDragging.value = true;
}

/** 处理左侧拖拽离开 */
function handleLeftDragLeave(): void {
  leftDragging.value = false;
}

/** 处理右侧拖拽离开 */
function handleRightDragLeave(): void {
  rightDragging.value = false;
}

// ---- 同步滚动 ----

/** 左侧滚动处理 */
function handleLeftScroll(event: Event): void {
  if (!rightTextarea.value) return;
  const target = event.target as HTMLElement;
  syncScroll(target, rightTextarea.value);
}

/** 右侧滚动处理 */
function handleRightScroll(event: Event): void {
  if (!leftTextarea.value) return;
  const target = event.target as HTMLElement;
  syncScroll(target, leftTextarea.value);
}

/** 同步滚动（带节流） */
let scrollFrameId: number | null = null;
function syncScroll(source: HTMLElement, target: HTMLElement): void {
  if (scrollFrameId !== null) {
    cancelAnimationFrame(scrollFrameId);
  }

  scrollFrameId = requestAnimationFrame(() => {
    const scrollRatio = source.scrollTop / (source.scrollHeight - source.clientHeight);
    target.scrollTop = scrollRatio * (target.scrollHeight - target.clientHeight);
    scrollFrameId = null;
  });
}

// ---- 清空 ----

/** 清空所有状态 */
function handleClear(): void {
  leftInput.value = '';
  rightInput.value = '';
  leftError.value = '';
  rightError.value = '';
  runtimeError.value = '';
  hasResult.value = false;
  isIdentical.value = false;
  semanticResult.value = null;
  strictResult.value = null;
  isExpanded.value = false;
  showExpandConfirm.value = false;
}

// ---- 自动重新对比 ----

/** 监听模式和选项变化，自动重新对比 */
watch([diffMode, options], () => {
  if (hasResult.value && leftInput.value && rightInput.value) {
    handleCompare();
  }
});

// ---- 生命周期 ----

onMounted(() => {
  // 自动聚焦左侧输入框
  nextTick(() => {
    leftTextarea.value?.focus();
  });
});

onUnmounted(() => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (scrollFrameId !== null) {
    cancelAnimationFrame(scrollFrameId);
  }
});
</script>

<template>
  <div class="mx-auto max-w-[1600px]">
    <!-- 头部 -->
    <ToolHeader
      title="JSON Diff"
      description="对比两份 JSON 的差异，支持语义模式和严格文本模式"
      :show-example="false"
    />

    <!-- 操作栏 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <ModeTabGroup
        v-model="diffMode"
        :options="[
          { key: 'semantic', label: '语义模式' },
          { key: 'strict', label: '严格模式' },
        ]"
      />

      <ToggleSwitch
        v-if="diffMode === 'semantic'"
        v-model="options.ignoreArrayOrder"
        label="忽略数组顺序"
        description="对比时忽略数组元素顺序"
      />

      <div class="ml-auto flex gap-2">
        <button
          class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isLoading"
          @click="handleCompare"
        >
          <span v-if="isLoading" class="inline-block animate-spin mr-1">⟳</span>
          对比
        </button>

        <CopyButton :text="copyableText" label="复制结果" />
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 双栏工作区 -->
    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 左侧输入区 -->
      <template #input>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">原始 JSON</label>
          <div class="relative">
            <textarea
              v-model="leftInput"
              ref="leftTextarea"
              class="w-full h-[calc(50vh-220px)] min-h-60 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              :class="leftDragging ? 'border-accent ring-2 ring-accent/20' : ''"
              placeholder="粘贴或输入原始 JSON..."
              spellcheck="false"
              aria-label="原始 JSON 输入"
              @dragover="handleLeftDragOver"
              @dragleave="handleLeftDragLeave"
              @drop="handleLeftDrop"
            />
            <input
              ref="leftFileInputRef"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="handleLeftFileUpload"
            />
          </div>
          <div v-if="leftError" class="mt-1 text-[0.75rem] text-error">{{ leftError }}</div>
        </div>
      </template>

      <!-- 右侧输入区 -->
      <template #output>
        <div>
          <label class="block text-[0.8125rem] text-muted mb-1.5">修改后 JSON</label>
          <div class="relative">
            <textarea
              v-model="rightInput"
              ref="rightTextarea"
              class="w-full h-[calc(50vh-220px)] min-h-60 p-3 border border-border rounded-sm bg-card text-text font-mono text-sm resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              :class="rightDragging ? 'border-accent ring-2 ring-accent/20' : ''"
              placeholder="粘贴或输入修改后 JSON..."
              spellcheck="false"
              aria-label="修改后 JSON 输入"
              @dragover="handleRightDragOver"
              @dragleave="handleRightDragLeave"
              @drop="handleRightDrop"
            />
            <input
              ref="rightFileInputRef"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="handleRightFileUpload"
            />
          </div>
          <div v-if="rightError" class="mt-1 text-[0.75rem] text-error">{{ rightError }}</div>
        </div>
      </template>
    </ResponsiveWorkspace>

    <!-- 运行时错误 -->
    <div v-if="runtimeError" class="mt-4 p-3 border border-error/30 rounded-sm bg-error/5 text-error text-sm">
      {{ runtimeError }}
    </div>

    <!-- 结果区域 -->
    <div v-if="hasResult" class="mt-6">
      <!-- 统计摘要 -->
      <div aria-live="polite" class="mb-4 text-sm">
        {{ summaryText }}
      </div>

      <!-- 完全一致时的提示 -->
      <div v-if="isIdentical" class="p-4 border border-border rounded-sm bg-card text-text text-sm">
        两份 JSON 完全一致，无差异
      </div>

      <!-- 严格模式：并排对比 -->
      <div v-else-if="diffMode === 'strict' && strictResult" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 左侧（删除） -->
        <div
          class="border border-border rounded-sm bg-card overflow-hidden"
          style="max-height: 600px;"
        >
          <div class="px-3 py-2 border-b border-border bg-muted/10 text-[0.8125rem] text-muted font-medium">
            原始版本（删除行）
          </div>
          <div
            ref="leftResultPanel"
            class="overflow-auto p-0"
            style="max-height: 560px;"
            @scroll="handleLeftScroll"
          >
            <table class="w-full border-collapse font-mono text-sm">
              <tbody>
                <tr
                  v-for="(line, index) in (isExpanded ? strictResult.lines : strictResult.lines.slice(0, AUTO_FOLD_THRESHOLD))"
                  :key="`left-${index}`"
                  :class="{
                    'bg-red-50/50': line.type === 'removed',
                    'text-error': line.type === 'removed',
                    'text-text': line.type === 'unchanged',
                  }"
                >
                  <td class="px-2 py-0.5 text-right text-muted text-[0.75rem] select-none w-12">
                    {{ line.leftLineNo ?? '' }}
                  </td>
                  <td class="px-2 py-0.5 select-none w-6">
                    {{ line.type === 'removed' ? '-' : ' ' }}
                  </td>
                  <td class="px-2 py-0.5 break-all whitespace-pre-wrap">{{ line.content }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 右侧（新增） -->
        <div
          class="border border-border rounded-sm bg-card overflow-hidden"
          style="max-height: 600px;"
        >
          <div class="px-3 py-2 border-b border-border bg-muted/10 text-[0.8125rem] text-muted font-medium">
            修改版本（新增行）
          </div>
          <div
            ref="rightResultPanel"
            class="overflow-auto p-0"
            style="max-height: 560px;"
            @scroll="handleRightScroll"
          >
            <table class="w-full border-collapse font-mono text-sm">
              <tbody>
                <tr
                  v-for="(line, index) in (isExpanded ? strictResult.lines : strictResult.lines.slice(0, AUTO_FOLD_THRESHOLD))"
                  :key="`right-${index}`"
                  :class="{
                    'bg-green-50/50': line.type === 'added',
                    'text-success': line.type === 'added',
                    'text-text': line.type === 'unchanged',
                  }"
                >
                  <td class="px-2 py-0.5 text-right text-muted text-[0.75rem] select-none w-12">
                    {{ line.rightLineNo ?? '' }}
                  </td>
                  <td class="px-2 py-0.5 select-none w-6">
                    {{ line.type === 'added' ? '+' : ' ' }}
                  </td>
                  <td class="px-2 py-0.5 break-all whitespace-pre-wrap">{{ line.content }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 语义模式：差异列表 -->
      <div v-else-if="diffMode === 'semantic' && semanticResult" class="border border-border rounded-sm bg-card overflow-hidden">
        <div class="px-3 py-2 border-b border-border bg-muted/10 text-[0.8125rem] text-muted font-medium flex items-center justify-between">
          <span>差异列表</span>
          <button
            v-if="needsFold && !isExpanded"
            class="px-2 py-1 text-[0.75rem] text-accent hover:text-accent/80 cursor-pointer"
            @click="handleExpandAll"
          >
            展开全部（{{ diffLines }} 行）
          </button>
        </div>
        <div class="overflow-auto" style="max-height: 600px;">
          <table class="w-full border-collapse font-mono text-sm">
            <thead>
              <tr class="border-b border-border">
                <th class="px-3 py-2 text-left text-[0.75rem] text-muted w-16">类型</th>
                <th class="px-3 py-2 text-left text-[0.75rem] text-muted">路径</th>
                <th class="px-3 py-2 text-left text-[0.75rem] text-muted w-1/3">旧值</th>
                <th class="px-3 py-2 text-left text-[0.75rem] text-muted w-1/3">新值</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in (isExpanded ? semanticResult.items : semanticResult.items.slice(0, AUTO_FOLD_THRESHOLD))"
                :key="index"
                class="border-b border-border/50"
                :class="{
                  'bg-green-50/30': item.type === 'added',
                  'bg-red-50/30': item.type === 'removed',
                  'bg-yellow-50/30': item.type === 'modified',
                }"
              >
                <td class="px-3 py-2">
                  <span
                    class="inline-block px-1.5 py-0.5 rounded text-[0.75rem] font-medium"
                    :class="{
                      'text-success bg-success/10': item.type === 'added',
                      'text-error bg-error/10': item.type === 'removed',
                      'text-accent bg-accent/10': item.type === 'modified',
                      'text-muted bg-muted/10': item.type === 'unchanged',
                    }"
                  >
                    {{ item.type === 'added' ? '新增' : item.type === 'removed' ? '删除' : item.type === 'modified' ? '修改' : '一致' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-text break-all">{{ item.path }}</td>
                <td class="px-3 py-2 text-muted break-all">
                  {{ item.oldValue !== undefined ? JSON.stringify(item.oldValue) : '-' }}
                </td>
                <td class="px-3 py-2 text-text break-all">
                  {{ item.newValue !== undefined ? JSON.stringify(item.newValue) : '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 展开确认对话框 -->
      <div
        v-if="showExpandConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showExpandConfirm = false"
      >
        <div class="bg-card border border-border rounded-sm p-6 max-w-md">
          <h3 class="text-lg font-semibold mb-2">确认展开全部</h3>
          <p class="text-sm text-muted mb-4">
            即将展开 {{ pendingExpandLines }} 行差异，可能会导致页面卡顿。是否继续？
          </p>
          <div class="flex gap-2 justify-end">
            <button
              class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover"
              @click="showExpandConfirm = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 border border-accent rounded-sm bg-accent text-white text-[0.8125rem] cursor-pointer transition-[background-color] duration-150 hover:bg-accent/90"
              @click="confirmExpand"
            >
              确认展开
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-else class="mt-6 p-8 border border-border rounded-sm bg-card text-center text-muted text-sm">
      输入两份 JSON 后点击「对比」查看差异
    </div>
  </div>
</template>
