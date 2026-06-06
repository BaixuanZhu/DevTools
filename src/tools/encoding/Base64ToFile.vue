<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  decodeBase64ToFileAsync,
  downloadFile,
  hasDataUriPrefix,
  COMMON_MIME_TYPES,
  type FileDecodeResult,
} from '../../utils/encoding/base64-file';
import { formatFileSize } from '../../utils/encoding/base64';

/** 文件大小上限：40MB（支持大 Base64 文本文件上传） */
const FILE_SIZE_LIMIT = 40 * 1024 * 1024;
/** 硬性上限：超过此大小拒绝处理 */
const SIZE_HARD = 100 * 1024 * 1024;

const input = ref('');
const errorMsg = ref('');
const isProcessing = ref(false);
const result = ref<FileDecodeResult | null>(null);
const selectedMimeType = ref('application/octet-stream');
const showMimeSelector = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const fileName = ref('');
/** 存储从文件上传读取的 Base64 内容（避免大字符串渲染到 textarea 造成卡顿） */
const decodeSource = ref('');
/** 解析进度，0-1 */
const progress = ref(0);
/** 防止 decode() 中同步 selectedMimeType 时触发 watch 递归 */
const isUpdatingFromDecode = ref(false);

async function decode() {
  errorMsg.value = '';
  result.value = null;
  progress.value = 0;

  // 优先使用文件上传的内容，其次是 textarea 输入
  const source = decodeSource.value || input.value.trim();
  if (!source) return;

  // 大小估算
  const raw = source.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const estimatedSize = Math.ceil((raw.length * 3) / 4);

  if (estimatedSize > SIZE_HARD) {
    errorMsg.value = `文件过大（约 ${formatFileSize(estimatedSize)}），超过 100MB 上限`;
    return;
  }

  isProcessing.value = true;
  try {
    result.value = await decodeBase64ToFileAsync(
      source,
      selectedMimeType.value,
      (ratio) => { progress.value = ratio; },
    );
    // 魔数检测到真实格式 或 data URI 已声明类型 → 无需显示选择器
    // 未检测到且无 data URI → 显示选择器让用户手动指定（默认选中 application/octet-stream）
    showMimeSelector.value = !result.value.isDetectedByMagic && !hasDataUriPrefix(source);
    isUpdatingFromDecode.value = true;
    selectedMimeType.value = result.value.mimeType;
    isUpdatingFromDecode.value = false;
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解码时出错';
  } finally {
    isProcessing.value = false;
    progress.value = 0;
  }
}

async function handleFile() {
  const file = fileInputRef.value?.files?.[0];
  if (!file) return;
  await processFile(file);
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  processFile(file);
}

/**
 * 处理 txt 文件上传：读取 Base64 字符串并自动解析为文件
 *
 * 大 Base64 内容不渲染到 textarea，避免 DOM 阻塞。
 * 内容存入 decodeSource，由 decode() 直接使用。
 */
async function processFile(file: File) {
  errorMsg.value = '';
  result.value = null;
  fileName.value = file.name;
  decodeSource.value = '';
  input.value = '';

  if (file.size > FILE_SIZE_LIMIT) {
    errorMsg.value = `文件过大（超过 ${formatFileSize(FILE_SIZE_LIMIT)}），请选择较小的 txt 文件`;
    return;
  }

  isProcessing.value = true;
  try {
    const text = await readFileAsText(file);
    decodeSource.value = text.trim();
    // 自动解析（使用 decodeSource，不经过 textarea）
    await decode();
  } catch {
    errorMsg.value = '读取文件时出错';
  } finally {
    isProcessing.value = false;
  }
}

/** 将文件读取为文本（Promise 包装 FileReader） */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取文件时出错'));
    reader.readAsText(file);
  });
}

watch(input, () => {
  if (input.value.trim()) {
    // 用户在 textarea 中输入了新内容，清空文件上传的 source，让新输入优先
    decodeSource.value = '';
  }
  if (!input.value.trim()) {
    result.value = null;
    errorMsg.value = '';
    decodeSource.value = '';
    showMimeSelector.value = false;
  }
});

watch(selectedMimeType, (newVal, oldVal) => {
  if (newVal !== oldVal && !isUpdatingFromDecode.value) {
    // 用户从选择器中手动切换了 MIME 类型，重新解码
    if (showMimeSelector.value && (decodeSource.value || input.value.trim())) {
      decode();
    }
  }
});


function handleClear() {
  input.value = '';
  errorMsg.value = '';
  result.value = null;
  showMimeSelector.value = false;
  fileName.value = '';
  decodeSource.value = '';
  progress.value = 0;
}

function handleDownload() {
  if (!result.value) return;
  downloadFile(result.value);
}
</script>

<template>
  <div>
    <ToolHeader
      title="Base64 转文件"
      description="将 Base64 字符串解码为文件，支持 Data URI 格式自动识别。图片请使用「Base64 转图片」工具。"
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
            @click="fileInputRef?.click()"
          >
            <input ref="fileInputRef" type="file" accept=".txt" class="hidden" @change="handleFile" />
            <template v-if="fileName">
              <span class="text-[0.8125rem] text-text">📄 {{ fileName }}</span>
            </template>
            <template v-else>
              <span class="text-muted text-sm">拖拽 txt 文件到这里或点击上传</span>
              <span class="text-muted text-[0.75rem] block mt-1">支持最大 40MB 的 txt 文件</span>
            </template>
          </div>
        </div>

        <div class="text-center text-muted text-sm my-1">— 或 —</div>

        <!-- Base64 输入 -->
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">
            Base64 字符串
          </label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="6"
            placeholder="粘贴 Base64 字符串或 data:xxx;base64,... 格式"
          ></textarea>
        </div>

        <p class="text-muted text-[0.75rem] m-0 mb-3">
          提示：粘贴过大的 Base64 字符串可能导致页面响应缓慢，建议上传 txt 文件替代
        </p>

        <div class="flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isProcessing"
            @click="decode"
          >
            {{ isProcessing ? `解析中 ${Math.round(progress * 100)}%...` : '解析文件' }}
          </button>
          <ClearButton @clear="handleClear" />
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mt-3">{{ errorMsg }}</p>
      </template>

      <template #output>
        <div v-if="result">
          <div class="flex flex-col gap-1.5 mb-4">
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">MIME 类型：</span>
              <span class="text-text">{{ result.mimeType }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">文件大小：</span>
              <span class="text-text">{{ result.sizeFormatted }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">扩展名：</span>
              <span class="text-text">{{ result.extension }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">文件名：</span>
              <span class="text-text">{{ result.fileName }}</span>
            </div>
          </div>

          <!-- MIME 类型选择器（无 data URI 时显示） -->
          <div v-if="showMimeSelector" class="mb-4">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">
              指定 MIME 类型（无法自动识别时使用）
            </label>
            <SelectListbox
              v-model="selectedMimeType"
              :options="COMMON_MIME_TYPES.map(m => ({ value: m.value, label: m.label }))"
            />
          </div>

          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
            @click="handleDownload"
          >
            下载文件
          </button>
        </div>

        <div v-else class="text-muted text-sm py-8 text-center">
          输入 Base64 字符串后点击「解析文件」查看结果
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
