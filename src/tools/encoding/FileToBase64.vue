<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import { arrayBufferToBase64Async, formatFileSize } from '../../utils/encoding/base64';
import { useCopy } from '../../composables/useCopy';

/** 文件大小上限：50MB（Base64 结果约为输入 1.33 倍，需常驻内存供复制/下载） */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;
/** 大字符串复制提示阈值：超过此大小先建议用户优先下载 */
const COPY_WARN_SIZE = 10 * 1024 * 1024;

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const fileName = ref('');
const fileSize = ref(0);
const mimeType = ref('');
const isProcessing = ref(false);
/** 编码进度，0-1 */
const progress = ref(0);
const errorMsg = ref('');
/** 纯 Base64 结果（不含前缀），仅存于内存，不渲染进 DOM 以避免大字符串阻塞页面 */
const base64Result = ref('');
/** 是否在输出中附带 Data URI 前缀 */
const includeDataUri = ref(false);

/** 实际生效的 MIME 类型：file.type 为空时回退通用二进制类型 */
const effectiveMime = computed(() => mimeType.value || 'application/octet-stream');

/** 最终输出文本：按开关决定是否拼接 Data URI 前缀，用于复制与下载（切换开关实时重算，无需重新编码） */
const outputText = computed(() => {
  if (!base64Result.value) return '';
  return includeDataUri.value
    ? `data:${effectiveMime.value};base64,${base64Result.value}`
    : base64Result.value;
});

/** Base64 字符数 */
const base64Length = computed(() => base64Result.value.length);

/** 编码后字节数（Base64 字符以单字节计） */
const encodedSize = computed(() => base64Result.value.length);

/** 是否已有编码结果 */
const hasResult = computed(() => base64Result.value.length > 0);

/** 编码后相对原文件的体积膨胀百分比 */
const inflatePercent = computed(() => {
  if (fileSize.value === 0) return 0;
  return Math.round((encodedSize.value / fileSize.value) * 100 - 100);
});

/** 触发隐藏的文件选择框 */
function triggerFilePick() {
  fileInputRef.value?.click();
}

/** 文件选择框 change 事件处理 */
function handleFileChange() {
  const file = fileInputRef.value?.files?.[0];
  if (file) processFile(file);
}

/** 拖拽释放事件处理 */
function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) processFile(file);
}

/**
 * 处理上传文件：校验大小后异步读取并编码为 Base64
 * @param file 用户选择的文件
 */
async function processFile(file: File) {
  if (isProcessing.value) return;
  errorMsg.value = '';
  base64Result.value = '';
  progress.value = 0;

  if (file.size === 0) {
    errorMsg.value = '文件为空，无法编码';
    return;
  }
  if (file.size > FILE_SIZE_LIMIT) {
    errorMsg.value = `文件过大（${formatFileSize(file.size)}），超过 ${formatFileSize(FILE_SIZE_LIMIT)} 上限`;
    return;
  }

  fileName.value = file.name;
  fileSize.value = file.size;
  mimeType.value = file.type;
  isProcessing.value = true;

  try {
    const buffer = await readFileAsArrayBuffer(file);
    base64Result.value = await arrayBufferToBase64Async(buffer, (ratio) => {
      progress.value = ratio;
    });
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '编码时出错';
  } finally {
    isProcessing.value = false;
    progress.value = 0;
  }
}

/**
 * 将文件读取为 ArrayBuffer
 * @param file 待读取文件
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('读取文件时出错'));
    reader.readAsArrayBuffer(file);
  });
}

const { copy } = useCopy({ errorMessage: '复制失败，请尝试下载 .txt' });

/** 复制完整结果到剪贴板，超大结果先提示优先下载 */
async function handleCopy() {
  if (!outputText.value) return;
  if (outputText.value.length > COPY_WARN_SIZE) {
    dispatchToast('结果较大，复制可能耗时，建议优先下载 .txt');
  }
  await copy(outputText.value);
}

/** 将结果下载为 .txt 文件 */
function handleDownloadTxt() {
  if (!outputText.value) return;
  const blob = new Blob([outputText.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName.value || 'encoded'}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，确保下载已启动
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * 触发全局 Toast 通知
 * @param message 通知文案
 */
function dispatchToast(message: string) {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 清空所有状态，允许重新选择文件 */
function handleClear() {
  base64Result.value = '';
  fileName.value = '';
  fileSize.value = 0;
  mimeType.value = '';
  errorMsg.value = '';
  progress.value = 0;
  includeDataUri.value = false;
  if (fileInputRef.value) fileInputRef.value.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="文件转 Base64"
      description="将任意文件编码为 Base64 字符串，可选附带 Data URI 前缀。"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <!-- 文件上传区域 -->
        <div class="mb-3">
          <div
            class="border-dashed border-2 border-border rounded-md p-4 text-center cursor-pointer hover:border-accent hover:bg-hover transition-[border-color,background-color] duration-150"
            :class="{ 'border-accent bg-hover': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @drop.prevent="handleDrop"
            @click="triggerFilePick"
          >
            <input ref="fileInputRef" type="file" class="hidden" @change="handleFileChange" />
            <template v-if="fileName">
              <span class="text-[0.8125rem] text-text">📄 {{ fileName }}（{{ formatFileSize(fileSize) }}）</span>
            </template>
            <template v-else>
              <span class="text-muted text-sm">拖拽文件到这里或点击上传</span>
              <span class="text-muted text-[0.75rem] block mt-1">支持最大 {{ formatFileSize(FILE_SIZE_LIMIT) }} 的任意文件</span>
            </template>
          </div>
        </div>

        <!-- Data URI 前缀开关 -->
        <div class="mb-3 flex items-center gap-2 flex-wrap">
          <ToggleSwitch v-model="includeDataUri" label="包含 Data URI 前缀" />
          <span class="text-muted text-[0.75rem]">
            开启后输出 <code>data:{{ effectiveMime }};base64,...</code> 格式
          </span>
        </div>

        <div class="flex gap-2 items-center">
          <ClearButton @clear="handleClear" />
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mt-3">{{ errorMsg }}</p>
        <p v-if="isProcessing" class="text-muted text-[0.8125rem] m-0 mt-3">
          编码中 {{ Math.round(progress * 100) }}%...
        </p>
      </template>

      <template #output>
        <div v-if="hasResult">
          <!-- 文件元信息 -->
          <div class="flex flex-col gap-1.5 mb-4">
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">文件名：</span>
              <span class="text-text break-all">{{ fileName }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">原始大小：</span>
              <span class="text-text">{{ formatFileSize(fileSize) }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">MIME 类型：</span>
              <span class="text-text">{{ effectiveMime }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">Base64 长度：</span>
              <span class="text-text">{{ base64Length.toLocaleString() }} 字符</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">编码后大小：</span>
              <span class="text-text">{{ formatFileSize(encodedSize) }}（约膨胀 {{ inflatePercent }}%）</span>
            </div>
          </div>

          <p class="text-muted text-[0.75rem] m-0 mb-3">
            为避免大字符串阻塞页面，结果不直接显示。请复制或下载查看完整内容。
          </p>

          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
              @click="handleCopy"
            >复制完整结果</button>
            <button
              class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
              @click="handleDownloadTxt"
            >下载为 .txt</button>
          </div>
        </div>

        <div v-else class="text-muted text-sm py-8 text-center">
          上传文件后将自动编码为 Base64
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
