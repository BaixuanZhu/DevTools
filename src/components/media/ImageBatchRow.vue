<script setup lang="ts">
/**
 * 批量列表的单行：缩略图 + 文件信息 + 转换状态 + 行内操作按钮。
 */
import { computed } from 'vue';
import { formatBytes } from '../../utils/media/image-convert';
import type { BatchItem } from '../../composables/useImageBatch';

const props = defineProps<{ item: BatchItem }>();
const emit = defineEmits<{
  preview: []; crop: []; download: []; remove: []; retry: [];
}>();

/** 体积节省比（done 时） */
const savings = computed(() => {
  const r = props.item.result;
  if (!r || props.item.originalSize === 0) return null;
  return Math.round(((props.item.originalSize - r.size) / props.item.originalSize) * 100);
});
const isDone = computed(() => props.item.status === 'done');
</script>

<template>
  <div class="flex items-center gap-3 p-2 border border-border rounded-sm bg-card">
    <!-- 缩略图 -->
    <div class="w-14 h-14 shrink-0 rounded-sm bg-hover overflow-hidden flex items-center justify-center">
      <img :src="item.originalUrl" :alt="item.name" class="w-full h-full object-cover" />
    </div>

    <!-- 信息 -->
    <div class="flex-1 min-w-0">
      <div class="text-sm text-text truncate" :title="item.name">{{ item.name }}</div>
      <div class="text-xs text-muted font-mono flex items-center gap-1.5 flex-wrap">
        <span>{{ item.width }}×{{ item.height }} · {{ formatBytes(item.originalSize) }}</span>
        <template v-if="isDone && item.result">
          <span class="text-muted">→</span>
          <span class="text-text">{{ formatBytes(item.result.size) }}</span>
          <span v-if="savings !== null" :class="savings >= 0 ? 'text-success' : 'text-error'">
            {{ savings >= 0 ? `省 ${savings}%` : `增 ${Math.abs(savings)}%` }}
          </span>
        </template>
        <span v-else-if="item.status === 'converting'" class="text-muted">转换中…</span>
        <span v-else-if="item.status === 'queued'" class="text-muted">等待中…</span>
        <span v-else-if="item.status === 'error'" class="text-error truncate" :title="item.error">{{ item.error }}</span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="flex items-center gap-1 shrink-0">
      <button
        v-if="item.status === 'error'" type="button" title="重试"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text"
        @click="emit('retry')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
      </button>
      <button
        type="button" title="预览" :disabled="!isDone"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('preview')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      </button>
      <button
        type="button" title="裁切"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text"
        @click="emit('crop')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>
      </button>
      <button
        type="button" title="下载" :disabled="!isDone"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('download')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      </button>
      <button
        type="button" title="移除"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-error"
        @click="emit('remove')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  </div>
</template>
