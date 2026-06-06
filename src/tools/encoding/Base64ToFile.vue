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

/** 硬性上限：超过此大小拒绝处理 */
const SIZE_HARD = 100 * 1024 * 1024;

const input = ref('');
const errorMsg = ref('');
const isProcessing = ref(false);
const result = ref<FileDecodeResult | null>(null);
const selectedMimeType = ref('application/octet-stream');
const showMimeSelector = ref(false);

/** 示例数据：JSON 文本的 Base64 */
const EXAMPLE_BASE64 = 'eyJuYW1lIjoiRGV2VG9vbHMiLCJ2ZXJzaW9uIjoiMS4wIiwiZGVzY3JpcHRpb24iOiLlnLDlnZror77nqIvlt6XkvZzmiJDliqDku6znmoTmlofmoaYifQ==';

async function decode() {
  errorMsg.value = '';
  result.value = null;

  const trimmed = input.value.trim();
  if (!trimmed) return;

  // 大小估算
  const raw = trimmed.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const estimatedSize = Math.ceil((raw.length * 3) / 4);

  if (estimatedSize > SIZE_HARD) {
    errorMsg.value = `文件过大（约 ${formatFileSize(estimatedSize)}），超过 100MB 上限`;
    return;
  }

  showMimeSelector.value = !hasDataUriPrefix(trimmed);

  isProcessing.value = true;
  try {
    result.value = await decodeBase64ToFileAsync(trimmed, selectedMimeType.value);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解码时出错';
  } finally {
    isProcessing.value = false;
  }
}

watch(input, () => {
  if (!input.value.trim()) {
    result.value = null;
    errorMsg.value = '';
    showMimeSelector.value = false;
  }
});

watch(selectedMimeType, async () => {
  if (result.value && showMimeSelector.value) {
    try {
      result.value = await decodeBase64ToFileAsync(input.value, selectedMimeType.value);
    } catch {
      // 静默处理
    }
  }
});

function handleExample() {
  input.value = EXAMPLE_BASE64;
  decode();
}

function handleClear() {
  input.value = '';
  errorMsg.value = '';
  result.value = null;
  showMimeSelector.value = false;
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
      description="将 Base64 字符串解码为文件，支持 Data URI 格式自动识别"
      @example="handleExample"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">
            Base64 字符串
          </label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            placeholder="粘贴 Base64 字符串或 data:xxx;base64,... 格式"
          ></textarea>
        </div>

        <div class="flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isProcessing"
            @click="decode"
          >
            {{ isProcessing ? '解析中...' : '解析文件' }}
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
              指定 MIME 类型
            </label>
            <SelectListbox
              :model-value="selectedMimeType"
              :options="COMMON_MIME_TYPES.map(m => ({ key: m.value, label: m.label }))"
              @update:model-value="(val: string) => { selectedMimeType = val }"
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
