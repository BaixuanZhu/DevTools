<script setup lang="ts">
defineProps<{
  /** 按钮文本 */
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
}>();
</script>

<template>
  <button class="clear-btn" @click="$emit('clear')">
    {{ label || '清空' }}
  </button>
</template>

<style scoped>
.clear-btn {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.clear-btn:hover {
  background-color: var(--color-hover);
  color: var(--color-text);
}
</style>
