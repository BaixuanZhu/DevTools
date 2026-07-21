<script setup lang="ts" generic="T extends string | number">
/**
 * 单选按钮组（共享 ui，公共 API 冻结）。
 *
 * 底层由 @headlessui/vue RadioGroup/RadioGroupOption 迁移至 reka-ui
 * RadioGroupRoot/RadioGroupItem。选中态改用 data-[state=checked] 表达，
 * props/emits 与迁移前一致。
 *
 * @template T - 选项值类型，限定为 string | number
 */
import { RadioGroupRoot, RadioGroupItem } from 'reka-ui';

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
    <span v-if="label" class="text-[0.8125rem] text-muted-foreground shrink-0" :class="inlineLabel ? '' : 'min-w-18'">{{ label }}</span>
    <RadioGroupRoot :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v as T)" class="flex gap-1 flex-wrap">
      <RadioGroupItem
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        as-child
      >
        <button
          type="button"
          :class="[
            'px-3 py-1.5 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
            'transition-[background-color,border-color] duration-150',
            'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-white',
            'bg-background border-border text-foreground hover:bg-accent hover:border-primary',
          ]"
        >
          {{ option.label }}
        </button>
      </RadioGroupItem>
    </RadioGroupRoot>
  </div>
</template>
