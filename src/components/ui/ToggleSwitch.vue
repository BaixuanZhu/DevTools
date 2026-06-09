<script setup lang="ts">
import { Switch } from '@headlessui/vue';

withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    description?: string;
  }>(),
  { label: undefined, description: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">{{ label }}</span>
    <Switch
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-[background-color] duration-150',
        'focus:outline-none',
        modelValue ? 'bg-accent' : 'bg-border',
      ]"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          modelValue ? 'translate-x-4' : 'translate-x-0',
        ]"
      />
    </Switch>
    <span class="text-[0.8125rem] text-muted">{{ description ?? (modelValue ? '已开启' : '已关闭') }}</span>
  </div>
</template>
