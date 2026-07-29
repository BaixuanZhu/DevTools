<script setup lang="ts">
/**
 * shadcn-vue Sheet —— 基于 reka-ui DialogRoot 的滑出抽屉。
 * 用于 Shell 移动端导航（替代原手写 sidebar-open 状态）。
 */
import { DialogRoot, type DialogRootProps } from 'reka-ui';

const props = defineProps<{
  open?: DialogRootProps['open'];
  defaultOpen?: DialogRootProps['defaultOpen'];
  modal?: DialogRootProps['modal'];
}>();

const emit = defineEmits<{ 'update:open': [value: boolean] }>();
</script>

<template>
  <DialogRoot
    :open="props.open"
    :default-open="props.defaultOpen"
    :modal="props.modal"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </DialogRoot>
</template>
