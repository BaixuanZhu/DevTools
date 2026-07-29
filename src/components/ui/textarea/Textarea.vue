<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '../../../lib/utils';

const props = defineProps<{
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  class?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
}

const classes = computed(() =>
  cn(
    'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ),
);
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :class="classes"
    @input="onInput"
  />
</template>
