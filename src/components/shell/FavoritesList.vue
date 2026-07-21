<script setup lang="ts">
/**
 * 我的收藏列表（/favorites 页 client:load 岛）。
 *
 * 读 favoritesStore.list，按 path 与 tools 注册表 join 出完整工具信息渲染。
 * SSR 渲染空状态（SSG 无法预知用户收藏），onMounted 读 localStorage 后更新。
 */
import { computed, onMounted } from 'vue';
import { Star } from '@lucide/vue';
import { tools } from '../../data/tools';
import { favoritesStore } from '../../stores/favorites';
import { toastStore } from '../../stores/toast';

onMounted(() => favoritesStore.load());

/** 收藏 path 集合 → 命中注册表的工具列表（保持注册顺序） */
const favoriteTools = computed(() => {
  const paths = new Set(favoritesStore.list.value.map((f) => f.path));
  return tools.filter((t) => paths.has(t.path));
});

/** 取消收藏 */
function removeFavorite(tool: { path: string; name: string; icon: string }): void {
  favoritesStore.toggle({ path: tool.path, name: tool.name, icon: tool.icon });
  toastStore.show(`已取消收藏 ${tool.name}`);
}
</script>

<template>
  <div v-if="favoriteTools.length > 0" class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
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
