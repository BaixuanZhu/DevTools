<script setup lang="ts">
/**
 * 文本处理工具箱交互组件。
 *
 * 提供大小写/全半角转换、去重去空行、排序、字数统计与查找替换等高频文本操作。
 * 点击变换按钮原地改写文本框内容，支持多步撤销/重做；统计实时更新。
 */
import { ref, computed } from 'vue';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
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

/** Primary 按钮（替换全部）的 Tailwind class。 */
const BTN_PRIMARY_CLASS =
  'px-4 py-2 border border-accent rounded-sm bg-accent text-white text-[0.8125rem] cursor-pointer transition-[opacity] duration-150 hover:opacity-90';

/** 工具栏图标按钮基础 class，与 CopyButton 风格一致；尺寸由各按钮追加。 */
const ICON_BTN_BASE =
  'flex items-center justify-center rounded-sm border border-border bg-card text-muted cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text disabled:opacity-50 disabled:cursor-not-allowed';

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

    <!-- 工具区：变换 + 操作 + 查找替换入口（位于输入框上方，图标 + tooltip） -->
    <Disclosure as="div" v-slot="{ open }" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-1.5 border border-border rounded-md p-3 bg-card">
        <!-- 大小写 -->
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9 font-mono font-semibold text-[0.9375rem]']" title="大写" aria-label="大写" @click="apply(toUpperCase)">A</button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9 font-mono font-semibold text-[0.9375rem]']" title="小写" aria-label="小写" @click="apply(toLowerCase)">a</button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9 font-mono font-semibold text-[0.8125rem]']" title="首字母大写" aria-label="首字母大写" @click="apply(toTitleCase)">Aa</button>
        <span class="mx-0.5 h-6 w-px self-center bg-border" aria-hidden="true"></span>
        <!-- 全角半角 -->
        <button type="button" :class="[ICON_BTN_BASE, 'h-9 px-2 text-xs']" title="转换为半角" aria-label="转换为半角" @click="apply(toHalfWidth)">半角</button>
        <button type="button" :class="[ICON_BTN_BASE, 'h-9 px-2 text-xs']" title="转换为全角" aria-label="转换为全角" @click="apply(toFullWidth)">全角</button>
        <span class="mx-0.5 h-6 w-px self-center bg-border" aria-hidden="true"></span>
        <!-- 清理 -->
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="去空行" aria-label="去空行" @click="apply(removeBlankLines)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="去重" aria-label="去重行" @click="apply(dedupeLines)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="去首尾空白" aria-label="去除每行首尾空白" @click="apply(trimLines)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        </button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="合并空白" aria-label="合并连续空白" @click="apply(collapseWhitespace)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <span class="mx-0.5 h-6 w-px self-center bg-border" aria-hidden="true"></span>
        <!-- 排序 -->
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="行升序" aria-label="行升序" @click="apply((t) => sortLines(t, 'asc'))">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="行降序" aria-label="行降序" @click="apply((t) => sortLines(t, 'desc'))">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
        <span class="mx-0.5 h-6 w-px self-center bg-border" aria-hidden="true"></span>
        <!-- 操作 -->
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" :disabled="!canUndo" title="撤销" aria-label="撤销" @click="handleUndo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
          </svg>
        </button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" :disabled="!canRedo" title="重做" aria-label="重做" @click="handleRedo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
          </svg>
        </button>
        <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9']" title="清空" aria-label="清空" @click="handleClear">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
        <CopyButton :text="text" />
        <span class="mx-0.5 h-6 w-px self-center bg-border" aria-hidden="true"></span>
        <!-- 查找替换（点击展开） -->
        <DisclosureButton :class="[ICON_BTN_BASE, 'w-9 h-9', open ? 'bg-hover text-text' : '']" title="查找替换" aria-label="查找替换">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </DisclosureButton>
      </div>

      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <DisclosurePanel class="border border-border rounded-md p-4 bg-card flex flex-col gap-3">
          <div class="flex flex-col sm:flex-row gap-2">
            <input
              v-model="find"
              type="text"
              class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent box-border"
              placeholder="查找内容"
              aria-label="查找内容"
            />
            <input
              v-model="replace"
              type="text"
              class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent box-border"
              placeholder="替换为"
              aria-label="替换内容"
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
        </DisclosurePanel>
      </transition>
    </Disclosure>

    <!-- 文本框 -->
    <div class="mt-4">
      <textarea
        v-model="text"
        rows="10"
        class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent resize-y box-border"
        placeholder="粘贴或输入文本..."
        aria-label="文本内容"
      ></textarea>
      <p class="mt-1.5 text-xs text-muted">
        字数 {{ stats.charsNoSpace }} · 字符 {{ stats.chars }} · 字节 {{ stats.bytes }} · 行 {{ stats.lines }}
      </p>
    </div>
  </div>
</template>
