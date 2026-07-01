<script setup lang="ts">
import { computed } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
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

/** 通过计算属性 getter/setter 实现 v-model 转发 */
const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue || (o as any).key === props.modelValue);
  return opt?.label ?? '';
});
</script>

<template>
  <div class="relative">
    <label v-if="label" class="block mb-1 text-[0.8125rem] text-muted font-sans">{{ label }}</label>
    <Listbox v-model="model">
      <ListboxButton
        :class="[
          'relative w-full px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans cursor-pointer flex items-center justify-center',
          props.buttonClass,
        ]"
      >
        <span class="block truncate">{{ selectedLabel }}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown class="h-4 w-4 text-muted" :size="16" aria-hidden="true" />
        </span>
      </ListboxButton>
      <ListboxOptions
        class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm bg-card border border-border py-1 text-[0.8125rem] shadow-[0_2px_8px_rgba(0,0,0,0.06)] focus:outline-none"
      >
        <ListboxOption
          v-for="option in options"
          :key="(option as any).key ?? option.value"
          :value="(option as any).key ?? option.value"
          :class="[
            'relative cursor-pointer select-none py-1.5 px-2',
            'ui-active:bg-hover ui-active:text-text',
          ]"
        >
          <span class="flex items-center justify-center gap-1.5 truncate ui-selected:font-semibold ui-selected:text-accent">{{ option.label }}</span>
          <span class="absolute inset-y-0 left-0 flex items-center pl-1.5 ui-selected:text-accent">
            <Check class="h-4 w-4 ui-selected:block hidden" :size="16" aria-hidden="true" />
          </span>
        </ListboxOption>
      </ListboxOptions>
    </Listbox>
  </div>
</template>
