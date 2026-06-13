<script setup lang="ts">
/**
 * 二维码识别器组件。
 *
 * - 支持点击选择、拖拽、Ctrl+V 粘贴三种图片输入方式
 * - 调用 decodeQrFromImage 纯浏览器端解码（jsQR）
 * - URL/邮箱/电话识别为可点击链接，其余为纯文本
 * - 非图片、超大、无码等场景给出内联中文错误
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { decodeQrFromImage, type ContentResult } from '../../utils/media/qr-reader';

/** 图片文件大小上限：10MB（QR 用不着大图） */
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

/** 缩略图预览的 DataURL */
const previewUrl = ref('');
/** 解码结果（识别成功后赋值） */
const result = ref<ContentResult | null>(null);
/** 内联错误信息 */
const errorMsg = ref('');
/** 是否正在解码 */
const isProcessing = ref(false);
/** 是否处于拖拽悬停状态 */
const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 文件大小人类可读格式 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 处理一张图片文件：校验后解码并更新状态 */
async function processFile(file: File): Promise<void> {
  // 释放上一次的 object URL，避免连续识别时内存泄漏
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  errorMsg.value = '';
  result.value = null;

  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请上传图片文件（PNG / JPG / WebP 等）';
    return;
  }
  if (file.size > FILE_SIZE_LIMIT) {
    errorMsg.value = `图片过大（${formatFileSize(file.size)}），请压缩后重试`;
    return;
  }

  previewUrl.value = URL.createObjectURL(file);
  isProcessing.value = true;
  try {
    const outcome = await decodeQrFromImage(file);
    if (outcome.ok) {
      result.value = outcome.result;
    } else {
      errorMsg.value = outcome.error;
    }
  } finally {
    isProcessing.value = false;
  }
}

/** 点击选择文件 */
function handlePick(): void {
  fileInputRef.value?.click();
}

/** input change 事件 */
function handleChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void processFile(file);
}

/** 拖拽放置 */
function handleDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void processFile(file);
}

/** 全局粘贴事件：取剪贴板中的图片 */
async function handlePaste(event: ClipboardEvent): Promise<void> {
  const items = event.clipboardData?.items;
  if (!items) return;
  // DataTransferItemList 不可迭代（无 Symbol.iterator），须用索引遍历
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        await processFile(file);
        return;
      }
    }
  }
}

/** 清空全部状态 */
function handleClear(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  result.value = null;
  errorMsg.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

onMounted(() => {
  window.addEventListener('paste', handlePaste);
});

onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste);
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<template>
  <div class="mx-auto w-full max-w-[720px]">
    <ToolHeader
      title="二维码识别器"
      description="上传、拖拽或 Ctrl+V 粘贴二维码图片，纯浏览器端识别解码，支持 URL/邮箱/电话可点击"
      :show-example="false"
    />

    <!-- 输入区：点击/拖拽/粘贴三合一 -->
    <div
      class="border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-[border-color,background-color] duration-150"
      :class="isDragging ? 'border-accent bg-hover' : 'border-border bg-card hover:border-accent'"
      role="button"
      tabindex="0"
      aria-label="点击选择、拖拽或 Ctrl+V 粘贴二维码图片"
      @click="handlePick"
      @keydown.enter.prevent="handlePick"
      @keydown.space.prevent="handlePick"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <div class="text-4xl mb-3">📷</div>
      <p class="text-sm text-text m-0">拖拽图片到这里，或点击选择</p>
      <p class="text-[0.75rem] text-muted mt-1 m-0">也可按 Ctrl+V 粘贴截图</p>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleChange"
      />
    </div>

    <!-- 处理中 -->
    <div v-if="isProcessing" class="mt-4 text-sm text-muted text-center">
      识别中...
    </div>

    <!-- 错误 -->
    <p v-else-if="errorMsg" class="mt-4 text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>

    <!-- 结果区 -->
    <div
      v-if="result || (previewUrl && !isProcessing)"
      class="border border-border rounded-md bg-card mt-4"
    >
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border flex-wrap">
        <span class="text-sm font-medium">识别结果</span>
        <ClearButton @clear="handleClear" />
      </div>

      <div class="p-4 flex gap-4 items-start flex-wrap">
        <!-- 缩略图 -->
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="已识别图片缩略图"
          class="w-24 h-24 object-contain border border-border rounded-sm bg-white p-1"
        />

        <!-- 文本结果 -->
        <div class="flex-1 min-w-[200px]">
          <p class="text-[0.75rem] text-muted m-0 mb-1">
            类型：{{ result ? { url: 'URL', email: '邮箱', tel: '电话', text: '文本' }[result.type] : '—' }}
          </p>
          <div class="flex items-start gap-2 flex-wrap">
            <a
              v-if="result?.href"
              :href="result.href"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono text-sm text-accent break-all hover:underline"
            >{{ result.value }}</a>
            <span
              v-else-if="result"
              class="font-mono text-sm text-text break-all whitespace-pre-wrap"
            >{{ result.value }}</span>
            <span v-else class="text-sm text-muted">（未识别到内容）</span>
            <CopyButton v-if="result?.value" :text="result.value" />
            <a
              v-if="result?.type === 'url'"
              :href="result.href"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent no-underline"
            >打开</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
