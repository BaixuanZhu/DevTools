<script setup lang="ts">
import { DropdownMenuRoot, type DropdownMenuRootProps } from 'reka-ui';
const props = defineProps<{ open?: DropdownMenuRootProps['open']; defaultOpen?: DropdownMenuRootProps['defaultOpen'] }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
</script>

<template>
  <DropdownMenuRoot :open="props.open" :default-open="props.defaultOpen" @update:open="emit('update:open', $event)">
    <slot />
  </DropdownMenuRoot>
</template>
