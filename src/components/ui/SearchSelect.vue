<script setup lang="ts">
/**
 * 可搜索下拉选择（共享 ui）：reka-ui Popover 薄壳 + 既有 Command 系列组合
 * （Command/CommandInput/CommandList/CommandEmpty/CommandItem，见 ./command/，
 * 基于 reka-ui Listbox 原语，不引 cmdk 等新依赖）。
 *
 * 适用场景：选项较多（几十条以上）需要键盘输入过滤的下拉（如 PG 时区表）；
 * 少量枚举仍用 SelectListbox。过滤由本组件 computed 完成（reka-ui ListboxFilter
 * 只负责输入不过滤，与 SearchPanel 同款做法）；选中即关闭弹层并 emit，
 * Esc / 点击外部关闭由 reka-ui Popover 默认行为承担（非 modal，默认不改）。
 */
import { computed, ref } from 'vue';
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import { cn } from '../../lib/utils';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from './command';

const props = withDefaults(
  defineProps<{
    /** 可选项（value 须非空串；keywords 供过滤，大小写不敏感） */
    options: { value: string; label: string; keywords?: string[] }[];
    /** 当前选中值（options.value 之一；不在列表时触发器回显原值） */
    modelValue: string;
    /** 无选中且值不在列表时的占位文案 */
    placeholder?: string;
    /** 无匹配结果文案（缺省"无匹配选项"；消费方可按领域定制，如"无匹配时区"） */
    emptyText?: string;
    /** 透传给触发器按钮的额外 class，用于与相邻控件对齐高度（如 h-8，对照 SelectListbox.buttonClass） */
    buttonClass?: string;
  }>(),
  { placeholder: undefined, emptyText: undefined, buttonClass: undefined },
);

const emit = defineEmits<{
  /** 选中某项（携带选项值，弹层随即关闭） */
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const query = ref('');

/** 触发器展示文本：选中项 label；值不在列表时回显原值；空值用占位文案 */
const displayText = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue);
  if (opt) return opt.label;
  return props.modelValue || props.placeholder || '';
});

/** 关键词过滤（value + label + keywords，大小写不敏感；空查询返回全量） */
const filteredOptions = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return props.options;
  return props.options.filter((o) =>
    [o.value, o.label, ...(o.keywords ?? [])].some((k) => k.toLowerCase().includes(needle)),
  );
});

/**
 * 开关弹层：打开时重置过滤词，保证每次展示全量列表。
 * @param next - 弹层目标状态
 */
function onOpenChange(next: boolean): void {
  open.value = next;
  if (next) query.value = '';
}

/**
 * 选中某项：回传值并关闭弹层（过滤词留待下次打开时重置）。
 * @param value - 选中的选项值
 */
function onSelect(value: string): void {
  emit('update:modelValue', value);
  open.value = false;
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="onOpenChange">
    <PopoverTrigger
      :class="cn(
        'relative flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 font-sans text-sm text-foreground shadow-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring',
        buttonClass,
      )"
    >
      <span class="block truncate">{{ displayText }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" :size="16" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="start"
        :side-offset="4"
        class="z-50 w-[var(--reka-popover-trigger-width)] rounded-md border border-border bg-popover p-0 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <Command>
          <CommandInput v-model="query" placeholder="输入关键词过滤..." />
          <CommandList>
            <CommandEmpty v-if="filteredOptions.length === 0">{{ emptyText ?? '无匹配选项' }}</CommandEmpty>
            <CommandItem
              v-for="option in filteredOptions"
              :key="option.value"
              :value="option.value"
              class="py-1.5"
              @select="onSelect(option.value)"
            >
              <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
              <span class="shrink-0 truncate font-mono text-xs text-muted-foreground">{{ option.value }}</span>
            </CommandItem>
          </CommandList>
        </Command>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
