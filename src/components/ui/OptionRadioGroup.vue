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
        v-slot="{ checked }"
        :value="option.value"
        as="template"
      >
        <button
          :class="[
            'px-3 py-1.5 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
            'transition-[background-color,border-color] duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            checked
              ? 'bg-accent border-accent text-white'
              : 'bg-surface border-border text-text hover:bg-hover hover:border-accent',
          ]"
        >
          {{ option.label }}
        </button>
      </RadioGroupOption>
    </RadioGroup>
  </div>
</template>
