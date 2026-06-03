<script setup lang="ts">
defineProps<{
  /** 工具名称 */
  title: string;
  /** 工具描述 */
  description: string;
  /** 是否显示"填入示例"按钮，默认 true */
  showExample?: boolean;
}>();

const emit = defineEmits<{
  (e: 'example'): void;
}>();
</script>

<template>
  <div class="tool-header">
    <div class="tool-header-info">
      <h1 class="tool-header-title">{{ title }}</h1>
      <p class="tool-header-desc">{{ description }}</p>
    </div>
    <button v-if="showExample !== false" class="tool-header-example" @click="$emit('example')">
      填入示例
    </button>
  </div>
</template>

<style scoped>
.tool-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.tool-header-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.tool-header-desc {
  margin: var(--space-xs) 0 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

.tool-header-example {
  flex-shrink: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.tool-header-example:hover {
  background-color: var(--color-hover);
  border-color: var(--color-accent);
}
</style>
