<script setup lang="ts">
/**
 * 收藏星标按钮（ToolCard 内 client:visible 岛）。
 *
 * SSR 渲染未收藏态（favoritesStore 在 SSR 为空）。由于 favoritesStore 是
 * 跨岛共享的模块单例，可能在本岛水合前已被其他岛（或本岛自身）的 load()
 * 填充，导致水合时渲染已收藏态而与 SSR 不一致。故用 mounted 守卫：挂载前
 * 固定渲染未收藏态（= SSR 输出），挂载后再反映真实状态。
 */
import { computed, onMounted, ref } from 'vue';
import { Star } from '@lucide/vue';
import { favoritesStore } from '../../stores/favorites';
import { toastStore } from '../../stores/toast';
import type { ToolMeta } from '../../data/tools';

interface Props {
  /** 工具元数据子集 */
  tool: Pick<ToolMeta, 'path' | 'name' | 'icon'>;
}
const props = defineProps<Props>();

/** 是否已挂载——挂载前固定 false，保证 SSR 与水合首帧一致 */
const mounted = ref(false);
const isFav = computed(() => mounted.value && favoritesStore.isFavorite(props.tool.path));

/** 挂载后读 localStorage 并解锁真实状态 */
onMounted(() => {
  favoritesStore.load();
  mounted.value = true;
});

/** 切换收藏 + toast 反馈 */
function onClick(): void {
  const was = isFav.value;
  favoritesStore.toggle({ path: props.tool.path, name: props.tool.name, icon: props.tool.icon });
  toastStore.show(was ? `已取消收藏 ${props.tool.name}` : `已收藏 ${props.tool.name}`);
}
</script>

<template>
  <button
    class="absolute top-2 right-2 z-10 shrink-0 p-2 rounded-sm border-none bg-transparent cursor-pointer transition-[color] duration-150"
    :class="isFav ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-400'"
    :aria-label="isFav ? `取消收藏 ${props.tool.name}` : `收藏 ${props.tool.name}`"
    @click.prevent="onClick"
  >
    <Star v-if="isFav" class="w-5 h-5" fill="currentColor" stroke-width="1" aria-hidden="true" />
    <Star v-else class="w-5 h-5" aria-hidden="true" />
  </button>
</template>
