<script setup lang="ts">
/**
 * 文本处理工具箱交互组件。
 *
 * 提供大小写/全半角转换、去重去空行、排序、字数统计与查找替换等高频文本操作。
 * 点击变换按钮原地改写文本框内容，支持多步撤销/重做；统计实时更新。
 */
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import { useCopy } from '../../composables/useCopy';
import {
  toUpperCase,
  toLowerCase,
  toTitleCase,
  toHalfWidth,
  toFullWidth,
  removeBlankLines,
  dedupeLines,
  trimLines,
  collapseWhitespace,
  sortLines,
  computeStats,
  replaceAll,
  createHistory,
} from '../../utils/text/text-toolbox';

/** 初始示例文本，打开页面即可体验。 */
const DEFAULT_TEXT = 'Hello World\nFoo Bar\nfoo bar\n\nHello World';

/** 文本框内容（当前状态）。 */
const text = ref(DEFAULT_TEXT);

/** 查找词。 */
const find = ref('');
/** 替换词。 */
const replace = ref('');
/** 查找替换是否区分大小写。 */
const caseSensitive = ref(false);
/** 查找替换是否使用正则。 */
const useRegex = ref(false);
/** 查找替换错误信息。 */
const replaceError = ref('');

/** 撤销/重做历史栈。 */
const history = createHistory(50);
history.reset(DEFAULT_TEXT);

/** 是否可撤销。 */
const canUndo = ref(false);
/** 是否可重做。 */
const canRedo = ref(false);

const { copy } = useCopy();

/** 实时统计（依赖 text 自动 memo）。 */
const stats = computed(() => computeStats(text.value));

/** Ghost 按钮（变换/操作）的 Tailwind class，集中定义以避免重复。 */
const BTN_CLASS =
  'px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color] duration-150 hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed';
/** Primary 按钮（替换全部）的 Tailwind class。 */
const BTN_PRIMARY_CLASS =
  'px-4 py-2 border border-accent rounded-sm bg-accent text-white text-[0.8125rem] cursor-pointer transition-[opacity] duration-150 hover:opacity-90';

/** 同步撤销/重做按钮可用状态。 */
function syncHistoryFlags(): void {
  canUndo.value = history.canUndo();
  canRedo.value = history.canRedo();
}

/**
 * 应用一个文本变换：基于当前文本计算新值，写回文本框并入历史栈。
 * @param fn - 变换函数
 */
function apply(fn: (input: string) => string): void {
  const next = fn(text.value);
  if (next === text.value) return;
  text.value = next;
  history.push(next);
  syncHistoryFlags();
}

/** 撤销一步。 */
function handleUndo(): void {
  const prev = history.undo();
  if (prev !== null) {
    text.value = prev;
    syncHistoryFlags();
  }
}

/** 重做一步。 */
function handleRedo(): void {
  const next = history.redo();
  if (next !== null) {
    text.value = next;
    syncHistoryFlags();
  }
}

/** 清空文本框并重置历史。 */
function handleClear(): void {
  text.value = '';
  history.reset('');
  syncHistoryFlags();
}

/** 复制当前文本框内容。 */
async function handleCopy(): Promise<void> {
  await copy(text.value);
}

/** 执行查找替换并写回文本框。 */
function handleReplace(): void {
  replaceError.value = '';
  const { result, error } = replaceAll(text.value, find.value, replace.value, {
    caseSensitive: caseSensitive.value,
    regex: useRegex.value,
  });
  if (error) {
    replaceError.value = error;
    return;
  }
  if (result === text.value) return;
  text.value = result;
  history.push(result);
  syncHistoryFlags();
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="文本处理工具箱"
      description="大小写/全半角转换、去重去空行、排序、字数统计与查找替换，一站式文本处理。"
      :show-example="false"
    />

    <!-- 变换按钮区 -->
    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-3">
      <div>
        <p class="text-[0.8125rem] text-muted mb-1.5">变换</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="BTN_CLASS" @click="apply(toUpperCase)">大写</button>
          <button type="button" :class="BTN_CLASS" @click="apply(toLowerCase)">小写</button>
          <button type="button" :class="BTN_CLASS" @click="apply(toTitleCase)">首字母大写</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="BTN_CLASS" @click="apply(toHalfWidth)">全角→半角</button>
        <button type="button" :class="BTN_CLASS" @click="apply(toFullWidth)">半角→全角</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="BTN_CLASS" @click="apply(removeBlankLines)">去空行</button>
        <button type="button" :class="BTN_CLASS" @click="apply(dedupeLines)">去重</button>
        <button type="button" :class="BTN_CLASS" @click="apply(trimLines)">去首尾空白</button>
        <button type="button" :class="BTN_CLASS" @click="apply(collapseWhitespace)">合并空白</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="BTN_CLASS" @click="apply((t) => sortLines(t, 'asc'))">行升序</button>
        <button type="button" :class="BTN_CLASS" @click="apply((t) => sortLines(t, 'desc'))">行降序</button>
      </div>
      <div class="flex flex-wrap gap-2 pt-3 border-t border-border">
        <button type="button" :class="BTN_CLASS" :disabled="!canUndo" @click="handleUndo">↶ 撤销</button>
        <button type="button" :class="BTN_CLASS" :disabled="!canRedo" @click="handleRedo">↻ 重做</button>
        <button type="button" :class="BTN_CLASS" @click="handleClear">清空</button>
        <button type="button" :class="BTN_CLASS" @click="handleCopy">复制</button>
      </div>
    </div>

    <!-- 文本框 -->
    <div class="mt-4">
      <textarea
        v-model="text"
        rows="10"
        class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent resize-y box-border"
        placeholder="粘贴或输入文本..."
      ></textarea>
      <p class="mt-1.5 text-xs text-muted">
        字数 {{ stats.charsNoSpace }} · 字符 {{ stats.chars }} · 字节 {{ stats.bytes }} · 行 {{ stats.lines }}
      </p>
    </div>

    <!-- 查找替换 -->
    <div class="border border-border rounded-md p-6 bg-card mt-4 flex flex-col gap-3">
      <p class="text-[0.8125rem] text-muted">查找替换</p>
      <div class="flex flex-col sm:flex-row gap-2">
        <input
          v-model="find"
          type="text"
          class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent box-border"
          placeholder="查找内容"
        />
        <input
          v-model="replace"
          type="text"
          class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent box-border"
          placeholder="替换为"
        />
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-1.5 text-sm text-text cursor-pointer select-none">
          <input v-model="caseSensitive" type="checkbox" class="cursor-pointer" />
          区分大小写
        </label>
        <label class="flex items-center gap-1.5 text-sm text-text cursor-pointer select-none">
          <input v-model="useRegex" type="checkbox" class="cursor-pointer" />
          使用正则
        </label>
        <button type="button" :class="BTN_PRIMARY_CLASS" class="ml-auto" @click="handleReplace">替换全部</button>
      </div>
      <p v-if="replaceError" class="text-xs text-error">{{ replaceError }}</p>
    </div>
  </div>
</template>
