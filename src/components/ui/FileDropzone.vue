<script setup lang="ts">
/**
 * 通用文件拖拽/点击/粘贴选择区。
 *
 * 支持点击选择、拖拽上传、剪贴板粘贴，内置文件类型与大小校验。
 * 选中文件后通过 `select` 事件与 `update:modelValue` 抛出，调用方负责后续处理。
 */
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { formatBytes } from '../../utils/media/image-convert';
import { validateFile } from './file-dropzone';

interface Props {
  /** 当前已选文件（受控） */
  modelValue?: File | null;
  /** accept 属性，与原生 input 一致，如 "image/*" 或 ".json" */
  accept?: string;
  /** 文件大小上限（字节），0 表示不限 */
  maxSize?: number;
  /** 是否启用拖拽（默认 true） */
  enableDrag?: boolean;
  /** 是否监听全局 paste 事件（默认 false） */
  enablePaste?: boolean;
  /** 是否显示内置删除 ICON（默认 true） */
  clearable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  enableDrag: true,
  enablePaste: false,
  clearable: true,
});

const emit = defineEmits<{
  'update:modelValue': [file: File | null];
  /** 用户通过点击、拖拽、粘贴选中有效文件时触发 */
  select: [file: File];
  /** 点击内置删除 ICON 时触发 */
  clear: [];
  /** 校验失败时触发，消息为中文 */
  error: [message: string];
}>();

const isDragging = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const hasFile = computed(() => props.modelValue != null);

function processFile(file: File | undefined | null): void {
  if (!file) return;
  const error = validateFile(file, props.accept, props.maxSize);
  if (error) {
    emit('error', error);
    return;
  }
  emit('update:modelValue', file);
  emit('select', file);
}

function handleClick(): void {
  if (inputRef.value) inputRef.value.value = '';
  inputRef.value?.click();
}

function handleChange(event: Event): void {
  processFile((event.target as HTMLInputElement).files?.[0]);
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  if (!props.enableDrag) {
    isDragging.value = false;
    return;
  }
  isDragging.value = false;
  processFile(event.dataTransfer?.files?.[0]);
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  if (!props.enableDrag) return;
  isDragging.value = true;
}

function handleDragLeave(): void {
  if (!props.enableDrag) return;
  isDragging.value = false;
}

function handlePaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        processFile(file);
        return;
      }
    }
  }
}

function handleClear(): void {
  emit('update:modelValue', null);
  emit('clear');
}

onMounted(() => {
  if (props.enablePaste) window.addEventListener('paste', handlePaste);
});

onUnmounted(() => {
  if (props.enablePaste) window.removeEventListener('paste', handlePaste);
});
</script>

<template>
  <div
    class="relative border-2 border-dashed rounded-lg min-h-[400px] flex flex-col transition-[border-color,background-color] duration-150"
    :class="[isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent']"
    @click="handleClick"
    @drop.prevent="handleDrop"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
  >
    <button
      v-if="clearable && hasFile"
      type="button"
      class="absolute top-3 right-3 z-10 p-1.5 rounded-sm text-muted hover:text-error hover:bg-hover transition-[color,background-color] duration-150 cursor-pointer"
      aria-label="删除已选文件"
      @click.stop="handleClear"
    >
      <svg
        class="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>

    <input
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      @change="handleChange"
    />

    <div class="flex-1 flex flex-col items-center justify-center w-full">
      <slot>
        <div class="text-sm text-text">拖入文件 / 点击选择</div>
        <div v-if="accept" class="text-xs text-muted mt-1">支持 {{ accept }} 格式</div>
      </slot>
    </div>
  </div>
</template>
