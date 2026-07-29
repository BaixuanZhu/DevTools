<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui';
import { cn } from '../../../lib/utils';

const props = defineProps<{
  class?: string;
  disabled?: boolean;
  /** 选中态（用于主题切换当前项勾选）*/
  inset?: boolean;
}>();

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <DropdownMenuItem
    :disabled="disabled"
    :data-inset="inset ? '' : undefined"
    @select="emit('select')"
    :class="cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8',
      props.class,
    )"
  >
    <slot />
  </DropdownMenuItem>
</template>
