<script setup lang="ts">
/**
 * 开关切换组件（共享 ui，27 个调用方公共 API 冻结）。
 *
 * 底层由 Headless UI Switch 迁移至 reka-ui SwitchRoot/SwitchThumb。
 * 行为/外观/props/emits 与迁移前一致：modelValue 双向绑定、可选 label 与状态文字。
 */
import { SwitchRoot, SwitchThumb } from 'reka-ui';

withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    description?: string;
    /** 是否在开关右侧显示状态文字（description 或「已开启/已关闭」），默认 true */
    showStatus?: boolean;
  }>(),
  { label: undefined, description: undefined, showStatus: true },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted-foreground min-w-18 shrink-0">{{ label }}</span>
    <SwitchRoot
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-[background-color] duration-150',
        'focus:outline-none',
        modelValue ? 'bg-primary' : 'bg-border',
      ]"
    >
      <SwitchThumb
        :class="[
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          modelValue ? 'translate-x-4' : 'translate-x-0',
        ]"
      />
    </SwitchRoot>
    <span v-if="showStatus" class="text-[0.8125rem] text-muted-foreground">{{ description ?? (modelValue ? '已开启' : '已关闭') }}</span>
  </div>
</template>
