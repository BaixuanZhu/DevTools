<script setup lang="ts">
/**
 * 收藏星标按钮（ToolCard 内 client:visible 岛）。
 *
 * SSR 渲染未收藏态（favoritesStore 在 SSR 为空），onMounted 读 localStorage
 * 后反映真实状态。点击切换收藏并 toast 反馈。
 */
import { computed, onMounted } from 'vue';
import { Star } from '@lucide/vue';
import { favoritesStore } from '../../stores/favorites';
import { toastStore } from '../../stores/toast';
import type { ToolMeta } from '../../data/tools';

interface Props {
  /** 工具元数据子集 */
  tool: Pick<ToolMeta, 'path' | 'name' | 'icon'>;
}
const props = defineProps<Props>();

const isFav = computed(() => favoritesStore.isFavorite(props.tool.path));

/** 确保本地状态已加载（与 Shell 的 load 幂等，防御岛挂载顺序） */
onMounted(() => favoritesStore.load());

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
