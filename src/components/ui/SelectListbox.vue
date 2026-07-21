<script setup lang="ts">
/**
 * 下拉选择框（共享 ui，公共 API 冻结）。
 *
 * 底层由 Headless UI Listbox 迁移至 reka-ui Select（portal 化）。
 * 迁移同时修复历史 ui-active/ui-selected 死类名（Tailwind v4 未注册）：
 * 选中态走 data-[state=checked] + SelectItemIndicator（对勾），键盘高亮走 data-[highlighted]。
 * 值解析兼容历史 (option.key ?? option.value)。
 */
import { computed } from 'vue';
import {
  SelectRoot,
  SelectTrigger,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemIndicator,
} from 'reka-ui';
import { Check, ChevronDown } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    options: { value: string | number; label: string }[];
    label?: string;
    /** 透传给触发器按钮的额外 class，用于行内紧凑场景对齐高度（如 h-9） */
    buttonClass?: string;
  }>(),
  { label: undefined, buttonClass: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

/** 解析选项值：兼容历史 `(option as any).key ?? option.value`。 */
function optionValue(option: { value: string | number; [k: string]: unknown }): string | number {
  return (option.key as string | number | undefined) ?? option.value;
}

/** v-model 转发（Reka Select 接受 AcceptableValue，这里收窄回 string|number）。 */
const model = computed<string | number>({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue || optionValue(o) === props.modelValue);
  return opt?.label ?? '';
});
</script>

<template>
  <div class="relative">
    <label v-if="label" class="block mb-1 text-[0.8125rem] text-muted-foreground font-sans">{{ label }}</label>
    <SelectRoot v-model="model">
      <SelectTrigger
        :class="[
          'relative w-full px-2 py-1 border border-border rounded-sm bg-background text-foreground text-[0.8125rem] font-sans cursor-pointer flex items-center justify-center',
          props.buttonClass,
        ]"
      >
        <span class="block truncate">{{ selectedLabel }}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown class="h-4 w-4 text-muted-foreground" :size="16" aria-hidden="true" />
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          position="popper"
          :side-offset="4"
          class="z-50 max-h-60 min-w-[var(--reka-select-trigger-width)] overflow-auto rounded-sm bg-card border border-border py-1 text-[0.8125rem] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        >
          <SelectViewport>
            <SelectItem
              v-for="option in options"
              :key="optionValue(option)"
              :value="optionValue(option)"
              class="relative cursor-pointer select-none py-1.5 px-2 outline-none data-[highlighted]:bg-accent data-[highlighted]:text-foreground"
            >
              <span class="flex items-center justify-center gap-1.5 truncate data-[state=checked]:font-semibold data-[state=checked]:text-primary">{{ option.label }}</span>
              <SelectItemIndicator class="absolute inset-y-0 left-0 flex items-center pl-1.5 text-primary">
                <Check class="h-4 w-4" :size="16" aria-hidden="true" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>
