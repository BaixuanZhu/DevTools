<script setup lang="ts">
/**
 * Toast 通知容器（全局单岛，client:load）。
 *
 * 渲染 toastStore.items 队列，成功/失败用 lucide 图标 + TransitionGroup 动画。
 * 兼容 shim：阶段 1 过渡期，把遗留 `document` CustomEvent('toast')
 * 转发到 toastStore，使未迁移的工具本地 showToast 助手继续工作。
 * 阶段 3 迁移完所有工具后移除该 shim。
 */
import { onMounted, onUnmounted } from 'vue';
import { CircleCheck, CircleX } from '@lucide/vue';
import { toastStore, type ToastType } from '../../stores/toast';

const { items } = toastStore;

/** 遗留 toast 事件 → toastStore 桥接（阶段 3 移除） */
function legacyBridge(e: Event): void {
  const detail = (e as CustomEvent).detail || {};
  if (detail.message) {
    toastStore.show(String(detail.message), (detail.type as ToastType) || 'success');
  }
}
onMounted(() => document.addEventListener('toast', legacyBridge as EventListener));
onUnmounted(() => document.removeEventListener('toast', legacyBridge as EventListener));
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
