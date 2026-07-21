<script setup lang="ts">
/**
 * 首页工具搜索面板（client:load 岛）。
 *
 * 搜索框 + 防抖过滤 + 空态。工具网格由 .astro SSR（保 SEO + ToolCard 单源），
 * 本岛通过 [data-search-grid] [data-id] 切换 DOM display 完成客户端过滤，
 * 过滤逻辑复用 searchStore.filterTools 纯函数。
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { Search, X } from '@lucide/vue';
import { searchStore, filterTools } from '../../stores/search';
import { tools } from '../../data/tools';

const DEBOUNCE_MS = 150;

const query = ref('');
const empty = ref(false);
let gridEl: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** 应用过滤到网格 DOM */
function applyFilter(): void {
  const ids = filterTools(tools, query.value);
  empty.value = !!ids && ids.size === 0;
  if (!gridEl) return;
  gridEl.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
    const id = el.getAttribute('data-id');
    el.style.display = !ids || ids.has(id!) ? '' : 'none';
  });
}

/** 防抖触发过滤 */
function onInput(): void {
  searchStore.setQuery(query.value);
  if (timer) clearTimeout(timer);
  timer = setTimeout(applyFilter, DEBOUNCE_MS);
}

/** 清空搜索 */
function clear(): void {
  query.value = '';
  searchStore.clear();
  applyFilter();
}

onMounted(() => {
  gridEl = document.querySelector('[data-search-grid]');
});
onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="max-w-140 mx-auto mb-6">
    <div class="flex items-center gap-2 px-5 py-3 border border-border rounded-lg bg-card transition-[border-color] duration-150 focus-within:border-primary">
      <Search class="w-4 h-4 shrink-0 text-muted-foreground" />
      <input
        v-model="query"
        type="text"
        placeholder="搜索工具..."
        class="flex-1 border-none outline-none text-base font-sans text-foreground bg-transparent placeholder:text-muted-foreground"
        @input="onInput"
      />
      <button
        v-if="query"
        class="border-none bg-transparent cursor-pointer text-muted-foreground text-sm px-1 py-0.5 rounded-sm hover:text-foreground"
        aria-label="清除搜索"
        @click="clear"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
    <div v-if="empty" class="text-center py-16">
      <p class="text-muted-foreground text-base m-0">没有找到匹配「<span class="text-foreground font-medium">{{ query }}</span>」的工具</p>
    </div>
  </div>
</template>
