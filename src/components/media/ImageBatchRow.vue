<script setup lang="ts">
/**
 * 批量列表的单行：缩略图 + 文件信息 + 转换状态 + 行内操作按钮。
 */
import { computed } from 'vue';
import { formatBytes } from '../../utils/media/image-convert';
import type { BatchItem } from '../../composables/useImageBatch';
import { RotateCw, Eye, Crop, Download, X } from '@lucide/vue';

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
        <span>{{ item.width }}×{{ item.height }}</span>
        <template v-if="isDone && item.result">
          <span class="text-text">{{ formatBytes(item.result.size) }}</span>
          <span v-if="savings !== null" :class="savings >= 0 ? 'text-success' : 'text-error'">
            {{ savings >= 0 ? `-${savings}%` : `+${Math.abs(savings)}%` }}
          </span>
        </template>
        <span v-else-if="item.status === 'converting'" class="text-muted">转换中…</span>
        <span v-else-if="item.status === 'queued'" class="text-muted">待转换</span>
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
        <RotateCw :size="15" />
      </button>
      <button
        type="button" title="预览" :disabled="!isDone"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('preview')"
      >
        <Eye :size="15" />
      </button>
      <button
        type="button" title="裁切"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text"
        @click="emit('crop')"
      >
        <Crop :size="15" />
      </button>
      <button
        type="button" title="下载" :disabled="!isDone"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('download')"
      >
        <Download :size="15" />
      </button>
      <button
        type="button" title="移除"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-error"
        @click="emit('remove')"
      >
        <X :size="15" />
      </button>
    </div>
  </div>
</template>
