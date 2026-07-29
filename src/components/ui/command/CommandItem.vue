<script setup lang="ts">
/**
 * Command 可选项 —— 基于 reka-ui ListboxItem。
 * 选中时 emit select，消费方据此跳转/执行操作。
 */
import { ListboxItem } from 'reka-ui';
import { cn } from '../../../lib/utils';

const props = defineProps<{
  class?: string;
  /** 选项值（用于匹配） */
  value?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ select: [value: string] }>();
</script>

<template>
  <ListboxItem
    :value="props.value"
    :disabled="disabled"
    @select="emit('select', String(props.value))"
    :class="cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      props.class,
    )"
  >
    <slot />
  </ListboxItem>
</template>
