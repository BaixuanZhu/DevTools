<script setup lang="ts">
/**
 * shadcn-vue Toaster —— 基于 vue-sonner 的 Toaster 容器。
 * 替代项目原手写 ToastContainer.vue，主题跟随项目 light/dark。
 * 在 Shell.vue 挂载一次，全局任意位置调用 toast() 即可弹出。
 */
import { Toaster as Sonner } from 'vue-sonner';

defineProps<{ position?: 'top-center' | 'bottom-center' | 'top-right' | 'bottom-right' }>();
</script>

<template>
  <Sonner
    :position="$props.position || 'top-center'"
    :theme="'system'"
    class="toaster group"
    :toast-options="{
      classes: {
        toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-muted-foreground',
        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
      },
    }"
  />
</template>
