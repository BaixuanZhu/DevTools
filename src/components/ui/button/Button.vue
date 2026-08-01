<script setup lang="ts">
/**
 * shadcn-vue Button —— new-york 风格。
 * 基于 cva 变体 + cn() 合并，通过 reka-ui Primitive 渲染。
 * Primitive 支持 asChild 透传，使 reka-ui 触发器（DropdownMenuTrigger / DialogTrigger 等）
 * 的 as-child 模式能正确合并事件监听器到此按钮。
 */
import { computed } from 'vue';
import { Primitive } from 'reka-ui';
import { cn } from '../../../lib/utils';
import { buttonVariants, type ButtonVariants } from './index';

interface Props {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  /** 原生 button type */
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  class?: string;
  /** reka-ui Primitive as：默认渲染 button */
  as?: string;
  /** reka-ui Primitive asChild：透传给父级 reka-ui 触发器 */
  asChild?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  type: 'button',
  disabled: false,
  as: 'button',
  asChild: false,
});

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class),
);
</script>

<template>
  <Primitive :as="as" :as-child="asChild" :class="classes" :type="as === 'button' ? type : undefined" :disabled="as === 'button' ? disabled : undefined">
    <slot />
  </Primitive>
</template>
