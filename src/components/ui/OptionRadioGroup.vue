<script setup lang="ts">
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';

export interface RadioOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: RadioOption[];
    label?: string;
  }>(),
  { label: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">{{ label }}</span>
    <RadioGroup :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" class="flex gap-1 flex-wrap">
      <RadioGroupOption
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :class="[
          'px-2 py-1 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
          'transition-[background-color,border-color] duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          'ui-checked:bg-accent ui-checked:border-accent ui-checked:text-white',
          'ui-unchecked:bg-surface ui-unchecked:border-border ui-unchecked:text-text ui-unchecked:hover:bg-hover ui-unchecked:hover:border-accent',
        ]"
      >
        {{ option.label }}
      </RadioGroupOption>
    </RadioGroup>
  </div>
</template>
