<script setup lang="ts">
/**
 * 打字机文本（client:visible 岛）。
 *
 * 视觉：逐字显现 + 闪烁竖线光标，打字完成后光标持续闪烁。
 * 无障碍：aria-label 输出完整文本（读屏器一次读完），视觉层为装饰。
 */
import { ref, onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 目标文本（必填） */
    text: string;
    /** 每字打字间隔 ms */
    speed?: number;
    /** 打完后光标是否持续闪烁 */
    cursor?: boolean;
  }>(),
  { speed: 120, cursor: true },
);

const shown = ref('');
const done = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  const chars = Array.from(props.text); // 兼容多字节字符（中文/emoji）
  let i = 0;
  timer = setInterval(() => {
    if (i >= chars.length) {
      if (timer) clearInterval(timer);
      done.value = true;
      return;
    }
    shown.value += chars[i];
    i++;
  }, props.speed);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <span :aria-label="text" class="inline-flex items-baseline">
    <span aria-hidden="true">{{ shown }}</span>
    <span
      v-if="cursor && !done"
      aria-hidden="true"
      class="ml-0.5 inline-block w-[2px] h-[0.9em] bg-brand animate-blink"
    ></span>
    <span
      v-else-if="cursor && done"
      aria-hidden="true"
      class="ml-0.5 inline-block w-[2px] h-[0.9em] bg-brand animate-blink"
    ></span>
  </span>
</template>

<style>
@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.animate-blink {
  animation: blink 1s steps(1) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-blink { animation: none; opacity: 1; }
}
</style>
