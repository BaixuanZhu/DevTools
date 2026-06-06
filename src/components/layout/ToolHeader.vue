<script setup lang="ts">
/**
 * 工具页头部组件，展示标题、描述和可选的"填入示例"按钮。
 */
const props = withDefaults(defineProps<{
  /** 页面标题 */
  title: string;
  /** 工具描述 */
  description: string;
  /** 是否显示"填入示例"按钮，默认 true */
  showExample?: boolean;
}>(), {
  showExample: true,
});

const emit = defineEmits<{
  (e: 'example'): void;
}>();
</script>

<template>
  <div class="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 class="text-xl font-semibold m-0">{{ title }}</h1>
      <p class="mt-1 text-sm text-muted m-0">{{ description }}</p>
    </div>
    <button
      v-if="props.showExample"
      class="shrink-0 px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
      @click="emit('example')"
    >
      填入示例
    </button>
  </div>
</template>
