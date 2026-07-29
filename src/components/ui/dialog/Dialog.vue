<script setup lang="ts">
import { DialogRoot } from 'reka-ui';
const props = defineProps<{ open?: boolean; defaultOpen?: boolean; modal?: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();
</script>

<template>
  <DialogRoot :open="props.open" :default-open="props.defaultOpen" :modal="props.modal" @update:open="emit('update:open', $event)">
    <slot />
  </DialogRoot>
</template>
