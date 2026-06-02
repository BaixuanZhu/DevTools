<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { searchTools } from '../data/tools';
import type { ToolMeta } from '../data/tools';

const props = defineProps<{
  /** 占位符文本 */
  placeholder?: string;
}>();

const emit = defineEmits<{
  /** 搜索结果变化时触发 */
  (e: 'results', tools: ToolMeta[]): void;
}>();

const query = ref('');

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounce 150ms 过滤 */
watch(query, (val) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const results = searchTools(val);
    emit('results', results);
    // 同时通过 DOM CustomEvent 通知非 Vue 消费者（如首页工具网格）
    document.dispatchEvent(new CustomEvent('search-results', { detail: { tools: results, query: val } }));
  }, 150);
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="search-bar">
    <span class="search-icon">🔍</span>
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder || '搜索工具...'"
      class="search-input"
    />
    <button
      v-if="query"
      class="search-clear"
      @click="query = ''"
      aria-label="清除搜索"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-card);
  transition: border-color var(--transition-fast);
}

.search-bar:focus-within {
  border-color: var(--color-accent);
}

.search-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: transparent;
}

.search-input::placeholder {
  color: var(--color-muted);
}

.search-clear {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}

.search-clear:hover {
  color: var(--color-text);
}
</style>
