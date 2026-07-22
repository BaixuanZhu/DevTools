<script setup lang="ts">
/**
 * Toast 通知容器（全局单岛，client:load）。
 *
 * 渲染 toastStore.items 队列，成功/失败用 lucide 图标 + TransitionGroup 动画。
 * 生产者一律直接调用 toastStore.show()/error()（13 处 CustomEvent 桥接已于阶段 3 清零）。
 */
import { CircleCheck, CircleX } from '@lucide/vue';
import { toastStore } from '../../stores/toast';

const { items } = toastStore;
</script>

<template>
  <div
    class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-3 max-w-[90vw]"
    role="region"
    aria-label="通知"
  >
    <TransitionGroup
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95"
    >
      <div
        v-for="t in items"
        :key="t.id"
        :class="t.type === 'success' ? 'border-border' : 'border-error/20'"
        class="flex items-center gap-3 px-5 py-3.5 rounded-lg border shadow-lg bg-card text-foreground text-sm font-sans min-w-48 max-w-sm"
        role="status"
        aria-live="polite"
      >
        <CircleCheck v-if="t.type === 'success'" class="w-5 h-5 shrink-0 text-success" />
        <CircleX v-else class="w-5 h-5 shrink-0 text-error" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
