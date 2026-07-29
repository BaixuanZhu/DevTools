<script setup lang="ts">
/**
 * 模式 Tab 组（共享 ui，公共 API 冻结；6 个工具消费）。
 *
 * shadcn-vue 重构：内部直接渲染 src/components/ui/tabs/ 下的
 * TabsList / TabsTrigger / TabsContent，让所有调用方自动继承 shadcn Tabs
 * 视觉（muted 底色容器 + active 白底阴影）。
 * value 制直接消费 string key，省去 index↔key 转换。所有面板 force-mount +
 * data-[state=inactive]:hidden，复刻迁移前「全部挂载、非选中隐藏」行为。
 */
import { computed } from 'vue';
import { TabsList, TabsTrigger, TabsContent } from './tabs';
import { TabsRoot } from 'reka-ui';

const props = defineProps<{
  modelValue: string;
  options: { key: string; label: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

/** 当前激活值：modelValue 命中选项时用它，否则回落首项（对齐原 HeadlessUI selectedIndex 回落 0）。 */
const activeValue = computed(() =>
  props.options.some((opt) => opt.key === props.modelValue) ? props.modelValue : (props.options[0]?.key ?? ''),
);
</script>

<template>
  <TabsRoot :model-value="activeValue" @update:model-value="(v) => emit('update:modelValue', v as string)">
    <TabsList class="mb-4">
      <TabsTrigger
        v-for="option in options"
        :key="option.key"
        :value="option.key"
        class="px-6"
      >
        {{ option.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="option in options"
      :key="option.key"
      :value="option.key"
      force-mount
      class="data-[state=inactive]:hidden"
    >
      <slot :name="option.key" />
    </TabsContent>
  </TabsRoot>
</template>
