<script setup lang="ts">
/**
 * shadcn-vue Input —— 原生 <input> 封装，仅统一样式与 v-model。
 */
import { computed } from 'vue';
import { cn } from '../../../lib/utils';

const props = defineProps<{
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

function onInput(e: Event): void {
  const target = e.target as HTMLInputElement;
  const v = props.type === 'number' ? Number(target.value) : target.value;
  emit('update:modelValue', v);
}

const classes = computed(() =>
  cn(
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    props.class,
  ),
);
</script>

<template>
  <input
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="classes"
    @input="onInput"
  />
</template>
