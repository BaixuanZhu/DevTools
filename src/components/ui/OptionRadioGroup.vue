<script setup lang="ts" generic="T extends string | number">
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';

/**
 * 单选按钮组选项。
 *
 * @template T - 选项值类型，限定为 string | number
 */
export interface RadioOption<T extends string | number = string> {
  /** 选项值 */
  value: T;
  /** 显示文本 */
  label: string;
}

/**
 * 组件 props。
 *
 * @template T - 选中值类型，限定为 string | number
 */
interface Props<T extends string | number> {
  /** 当前选中的值 */
  modelValue: T;
  /** 选项列表 */
  options: RadioOption<T>[];
  /** 标签文本 */
  label?: string;
  /** label 紧贴按钮组（去除固定最小宽度），用于水平并排场景 */
  inlineLabel?: boolean;
}

const props = withDefaults(defineProps<Props<T>>(), { label: undefined, inlineLabel: false });

const emit = defineEmits<{
  /** 选中值变化时触发 */
  'update:modelValue': [value: T];
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted shrink-0" :class="inlineLabel ? '' : 'min-w-18'">{{ label }}</span>
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
