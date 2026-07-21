<script setup lang="ts">
/**
 * 我的收藏列表（/favorites 页 client:load 岛）。
 *
 * 读 favoritesStore.list，按 path 与 tools 注册表 join 出完整工具信息渲染。
 * 由于 favoritesStore 是跨岛共享模块单例，可能在本岛水合前已被填充，导致
 * 水合时渲染网格而与 SSR 空状态不一致。故用 mounted 守卫：挂载前固定渲染
 * 空状态（= SSR 输出），挂载后再据真实收藏决定网格或空状态。
 */
import { computed, onMounted, ref } from 'vue';
import { Star } from '@lucide/vue';
import { tools } from '../../data/tools';
import { favoritesStore } from '../../stores/favorites';
import { toastStore } from '../../stores/toast';

/** 是否已挂载——挂载前固定 false，保证 SSR 与水合首帧一致 */
const mounted = ref(false);

/** 收藏 path 集合 → 命中注册表的工具列表（保持注册顺序） */
const favoriteTools = computed(() => {
  const paths = new Set(favoritesStore.list.value.map((f) => f.path));
  return tools.filter((t) => paths.has(t.path));
});

/** 挂载后才显示网格，避免水合不一致 */
const showGrid = computed(() => mounted.value && favoriteTools.value.length > 0);

/** 取消收藏 */
function removeFavorite(tool: { path: string; name: string; icon: string }): void {
  favoritesStore.toggle({ path: tool.path, name: tool.name, icon: tool.icon });
  toastStore.show(`已取消收藏 ${tool.name}`);
}

onMounted(() => {
  favoritesStore.load();
  mounted.value = true;
});
</script>

<template>
  <div v-if="showGrid" class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
    <div v-for="tool in favoriteTools" :key="tool.path" class="relative flex h-full">
      <a
        :href="tool.path"
        class="flex items-start gap-4 p-5 pr-14 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full h-full"
      >
        <span class="text-[1.75rem] leading-none shrink-0 mt-0.5">{{ tool.icon }}</span>
        <div class="flex-1 min-w-0">
          <h3 class="m-0 mb-1 text-[0.9375rem] font-semibold leading-snug">{{ tool.name }}</h3>
          <p class="m-0 text-[0.8125rem] text-muted-foreground leading-relaxed">{{ tool.description }}</p>
        </div>
      </a>

      <button
        class="absolute top-2 right-2 z-10 shrink-0 p-2 rounded-sm border-none bg-transparent cursor-pointer text-amber-500 hover:text-amber-400 transition-[color] duration-150"
        :aria-label="`取消收藏 ${tool.name}`"
        @click.prevent="removeFavorite(tool)"
      >
        <Star class="w-5 h-5" fill="currentColor" stroke-width="1" aria-hidden="true" />
      </button>
    </div>
  </div>

  <div v-else class="text-center py-16">
    <p class="text-muted-foreground text-base m-0 mb-2">还没有收藏任何工具</p>
    <a href="/" class="text-[0.8125rem] text-primary hover:underline">去首页看看吧 →</a>
  </div>
</template>
