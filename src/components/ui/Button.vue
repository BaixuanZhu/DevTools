<script setup lang="ts">
/**
 * shadcn-vue 风格 Button（验证用最小实现）。
 *
 * 仅用于 Task 2 验证 cn + token 链路；Task 3 token 重构后，
 * 此组件的 class（bg-primary 等）会指向新语义变量。
 */
import { cn } from '../../lib/utils';

withDefaults(
  defineProps<{
    variant?: 'default' | 'outline';
    class?: string;
  }>(),
  { variant: 'default' },
);

const base =
  'inline-flex items-center justify-center rounded-sm px-4 py-2 text-sm font-medium transition-[background-color] duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
const variants: Record<string, string> = {
  default: 'bg-primary text-white hover:bg-primary/90',
  outline: 'border border-border bg-card text-foreground hover:bg-accent',
};
</script>

<template>
  <button :class="cn(base, variants[variant], $props.class)">
    <slot />
  </button>
</template>
