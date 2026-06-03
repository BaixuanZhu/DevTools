<script setup lang="ts">
import { ref } from 'vue';
import { copyToClipboard } from '../../utils/shared/clipboard';

const props = defineProps<{
  /** 要复制的文本 */
  text: string;
  /** 按钮文本 */
  label?: string;
}>();

const copied = ref(false);

async function handleCopy() {
  const success = await copyToClipboard(props.text);
  if (success) {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  }
}
</script>

<template>
  <button
    :class="['copy-btn', { 'copy-btn--copied': copied }]"
    @click="handleCopy"
    :disabled="!text"
  >
    {{ copied ? '✓ 已复制' : (label || '复制') }}
  </button>
</template>

<style scoped>
.copy-btn {
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

.copy-btn:hover:not(:disabled) {
  background-color: var(--color-hover);
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-btn--copied {
  border-color: var(--color-success);
  color: var(--color-success);
}
</style>
