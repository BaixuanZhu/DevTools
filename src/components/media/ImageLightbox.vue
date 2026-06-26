<script setup lang="ts">
/**
 * 转换结果灯箱：全屏展示结果大图，支持在已完成图片间翻页。
 *
 * 纯展示组件，不持有业务状态；slides 的 url 由父组件按 previewUrl ?? url 准备好。
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { formatBytes } from '../../utils/media/image-convert';

/** 灯箱单页 */
export interface LightboxSlide {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
}

const props = defineProps<{
  slides: LightboxSlide[];
  startIndex: number;
}>();
const emit = defineEmits<{ close: [] }>();

const index = ref(props.startIndex);

/** 上一张（循环） */
function prev(): void {
  index.value = (index.value - 1 + props.slides.length) % props.slides.length;
}
/** 下一张（循环） */
function next(): void {
  index.value = (index.value + 1) % props.slides.length;
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
    @click.self="emit('close')"
  >
    <button
      type="button" aria-label="关闭"
      class="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-sm text-white/80 hover:text-white hover:bg-white/10"
      @click="emit('close')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    </button>

    <button
      v-if="slides.length > 1" type="button" aria-label="上一张"
      class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
      @click="prev"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    </button>
    <button
      v-if="slides.length > 1" type="button" aria-label="下一张"
      class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
      @click="next"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </button>

    <figure class="flex flex-col items-center gap-3 max-w-full max-h-full">
      <img
        :src="slides[index]!.url" :alt="slides[index]!.name"
        class="max-w-full max-h-[80vh] object-contain rounded-sm bg-white"
      />
      <figcaption class="text-[0.8125rem] text-white/80 font-mono text-center">
        {{ slides[index]!.name }} · {{ slides[index]!.width }}×{{ slides[index]!.height }} · {{ formatBytes(slides[index]!.size) }}
        <span v-if="slides.length > 1" class="ml-2">{{ index + 1 }} / {{ slides.length }}</span>
      </figcaption>
    </figure>
  </div>
</template>
