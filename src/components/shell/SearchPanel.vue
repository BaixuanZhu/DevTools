<script setup lang="ts">
/**
 * 首页搜索面板（client:load 岛）—— 下拉直达模式。
 *
 * 输入实时匹配 tools（按 name/keywords/description 相关性排序）→ 下拉建议列表
 * → ↑↓ 选择、↵ 直达 tool.path、Esc 关闭。数据直接 import { tools }，
 * 不再依赖首页 DOM 网格（首页主体已改为分类卡片，不参与搜索过滤）。
 */
import { ref, computed } from 'vue';
import { Search, X } from '@lucide/vue';
import { searchStore } from '../../stores/search';
import { tools } from '../../data/tools';
import type { ToolMeta } from '../../data/tools';

const MAX_RESULTS = 8;

const query = ref('');
const activeIndex = ref(-1);

/** 单工具相关性评分（越大越靠前） */
function scoreTool(tool: ToolMeta, needle: string): number {
  const name = tool.name.toLowerCase();
  let score = 0;
  if (name === needle) score += 100;
  else if (name.startsWith(needle)) score += 50;
  else if (name.includes(needle)) score += 20;
  if (tool.keywords.some((k) => k.toLowerCase().includes(needle))) score += 10;
  if (tool.description.toLowerCase().includes(needle)) score += 5;
  return score;
}

/** 匹配结果（相关性降序，最多 MAX_RESULTS 条） */
const results = computed<ToolMeta[]>(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return [];
  return tools
    .map((t) => ({ tool: t, score: scoreTool(t, needle) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name, 'zh'))
    .slice(0, MAX_RESULTS)
    .map((x) => x.tool);
});

const isOpen = computed(() => query.value.trim().length > 0);

function onInput(): void {
  searchStore.setQuery(query.value);
  activeIndex.value = results.value.length > 0 ? 0 : -1;
}

/** 直达工具页（MPA 全页跳转） */
function go(tool: ToolMeta): void {
  window.location.href = tool.path;
}

function onKeyDown(e: KeyboardEvent): void {
  if (!isOpen.value || results.value.length === 0) {
    if (e.key === 'Escape') query.value = '';
    return;
  }
  const last = results.value.length - 1;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = activeIndex.value >= last ? 0 : activeIndex.value + 1;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = activeIndex.value <= 0 ? last : activeIndex.value - 1;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const target = results.value[activeIndex.value];
    if (target) go(target);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    query.value = '';
    searchStore.clear();
  }
}

function clear(): void {
  query.value = '';
  searchStore.clear();
  activeIndex.value = -1;
}
</script>

<template>
  <div class="max-w-140 mx-auto mb-8">
    <div class="relative">
      <div class="flex items-center gap-2 px-5 py-3 border border-border rounded-lg bg-card transition-[border-color] duration-150 focus-within:border-primary">
        <Search class="w-4 h-4 shrink-0 text-muted-foreground" />
        <input
          v-model="query"
          type="text"
          placeholder="搜索工具，如 base64 / jwt / 二维码..."
          class="flex-1 border-none outline-none text-base font-sans text-foreground bg-transparent placeholder:text-muted-foreground"
          autocomplete="off"
          aria-label="搜索工具"
          @input="onInput"
          @keydown="onKeyDown"
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

      <!-- 下拉建议 -->
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden z-10"
      >
        <!-- 有结果 -->
        <ul v-if="results.length > 0" class="list-none m-0 p-0 max-h-80 overflow-y-auto">
          <li v-for="(tool, i) in results" :key="tool.id">
            <a
              :href="tool.path"
              :class="[
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-[background-color] duration-100',
                i === activeIndex ? 'bg-accent text-primary' : 'text-foreground hover:bg-accent',
              ]"
              @mouseenter="activeIndex = i"
              @focus="activeIndex = i"
            >
              <span class="text-lg w-6 text-center shrink-0">{{ tool.icon }}</span>
              <span class="flex-1 min-w-0">
                <span class="block font-medium truncate">{{ tool.name }}</span>
                <span class="block text-xs text-muted-foreground truncate">{{ tool.description }}</span>
              </span>
            </a>
          </li>
        </ul>
        <!-- 无结果 -->
        <div v-else class="px-4 py-6 text-center">
          <p class="text-muted-foreground text-sm m-0">没有找到匹配「<span class="text-foreground font-medium">{{ query }}</span>」的工具</p>
        </div>
      </div>
    </div>
  </div>
</template>
