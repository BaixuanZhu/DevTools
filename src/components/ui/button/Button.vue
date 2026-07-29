<script setup lang="ts">
/**
 * shadcn-vue Button —— new-york 风格。
 * 基于 cva 变体 + cn() 合并，渲染为原生 <button>（保留原生 type/disabled 等）。
 * 通过 asChild 模式（本项目用 v-if 简化）支持 <a> 等标签变体。
 */
import { computed } from 'vue';
import { cn } from '../../../lib/utils';
import { buttonVariants, type ButtonVariants } from './index';

interface Props {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  /** 原生 button type */
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
  disabled: false,
});

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
);
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
