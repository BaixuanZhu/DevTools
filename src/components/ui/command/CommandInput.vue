<script setup lang="ts">
/**
 * Command 搜索输入 —— 基于 reka-ui ListboxFilter。
 * 包含搜索图标 + 边框分隔，与 shadcn-vue Command 外观一致。
 */
import { ListboxFilter } from 'reka-ui';
import { cn } from '../../../lib/utils';
import { Search } from '@lucide/vue';

const props = defineProps<{
  modelValue?: string;
  placeholder?: string;
  class?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <ListboxFilter
      :model-value="props.modelValue"
      :placeholder="props.placeholder"
      @update:model-value="emit('update:modelValue', String($event))"
      :class="cn('flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', props.class)"
    />
  </div>
</template>
