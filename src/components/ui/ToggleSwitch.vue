<script setup lang="ts">
/**
 * 开关切换组件（共享 ui，27 个调用方公共 API 冻结）。
 *
 * shadcn-vue 重构：内部直接渲染 src/components/ui/switch/Switch.vue，
 * 让所有调用方自动继承 shadcn Switch 视觉（rounded-full + ring-offset + thumb 平移）。
 * 行为/外观/props/emits 与重构前一致：modelValue 双向绑定、可选 label 与状态文字。
 */
import { Switch } from './switch';

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
  <div class="flex flex-wrap items-center gap-2">
    <span v-if="label" class="min-w-18 shrink-0 text-[0.8125rem] text-muted-foreground">{{ label }}</span>
    <Switch
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <span v-if="showStatus" class="text-[0.8125rem] text-muted-foreground">{{ description ?? (modelValue ? '已开启' : '已关闭') }}</span>
  </div>
</template>
