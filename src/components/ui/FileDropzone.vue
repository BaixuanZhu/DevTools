<script setup lang="ts">
/**
 * 通用文件拖拽/点击/粘贴选择区。
 *
 * 支持点击选择、拖拽上传、剪贴板粘贴，内置文件类型与大小校验。
 * 选中文件后通过 `select` 事件与 `update:modelValue` 抛出。
 *
 * 组件始终维持一个外层拖拽区，空态与已选文件态都保持可点击/可拖拽。
 * 文件预览内容通过 `file` slot 注入到拖拽区内部；删除 ICON 固定在右上角，
 * 点击时阻止冒泡以避免误触发选择器。
 */
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { validateFile } from './file-dropzone';
import { Trash2 } from '@lucide/vue';

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
  /** 是否在默认 trigger 中显示删除按钮（默认 true） */
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
    class="relative border-2 border-dashed rounded-lg min-h-[400px] flex flex-col transition-[border-color,background-color] duration-150 cursor-pointer"
    :class="[isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent']"
    @click="handleClick"
    @drop.prevent="handleDrop"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
  >
    <input
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      @change="handleChange"
    />

    <!-- 删除按钮：右上角，点击只清空不打开选择器 -->
    <button
      v-if="clearable && hasFile"
      type="button"
      class="absolute top-3 right-3 z-10 p-1.5 rounded-sm text-muted hover:text-error hover:bg-hover transition-[color,background-color] duration-150 cursor-pointer"
      aria-label="删除已选文件"
      @click.stop="handleClear"
    >
      <Trash2 class="w-5 h-5" :size="20" :stroke-width="2" />
    </button>

    <!-- 空态：整个区域可点击 -->
    <div
      v-if="!hasFile"
      class="flex-1 flex flex-col items-center justify-center w-full"
    >
      <slot>
        <div class="text-sm text-text">拖入文件 / 点击选择</div>
        <div v-if="accept" class="text-xs text-muted mt-1">支持 {{ accept }} 格式</div>
      </slot>
    </div>

    <!-- 已选文件态：文件预览/内容在拖拽区内部，点击会打开选择器 -->
    <div
      v-else
      class="flex-1 flex flex-col items-center justify-center w-full p-4"
    >
      <slot
        name="file"
        :file="modelValue"
        :clear="handleClear"
      >
        <div class="text-sm text-text">{{ modelValue?.name }}</div>
      </slot>
    </div>
  </div>
</template>
