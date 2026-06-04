<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  encodeBase64,
  decodeBase64,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  detectMimeType,
  formatFileSize,
} from '../../utils/encoding/base64';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp', 'image/bmp'];

// Encode state
const encodeInput = ref('');
const encodeOutput = ref('');
const encodeError = ref('');
const encodeFileName = ref('');
const fileMeta = ref<{ mime: string; size: string } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

// Decode state
const decodeInput = ref('');
const decodeOutput = ref('');
const decodeError = ref('');
const decodedImageSrc = ref('');
const decodedBinaryMeta = ref<{ mime: string; size: string } | null>(null);
const decodedBinaryBase64 = ref('');

function isDecodeBinaryResult(): boolean {
  return !!decodedImageSrc.value || !!decodedBinaryMeta.value;
}

function executeEncode() {
  encodeError.value = '';
  encodeOutput.value = '';
  fileMeta.value = null;

  if (!encodeInput.value.trim() && !encodeFileName.value) {
    encodeError.value = '请输入要编码的文本';
    return;
  }

  try {
    encodeOutput.value = encodeBase64(encodeInput.value);
  } catch (e) {
    encodeError.value = e instanceof Error ? e.message : '编码时出错';
  }
}

function executeDecode() {
  decodeError.value = '';
  decodeOutput.value = '';
  decodedImageSrc.value = '';
  decodedBinaryMeta.value = null;
  decodedBinaryBase64.value = '';

  if (!decodeInput.value.trim()) {
    decodeError.value = '请输入要解码的 Base64 字符串';
    return;
  }

  try {
    try {
      decodeOutput.value = decodeBase64(decodeInput.value);
    } catch {
      // Text decode failed — treat as binary
      handleBinaryDecode();
    }
  } catch (e) {
    decodeError.value = e instanceof Error ? e.message : '解码时出错';
  }
}

function handleBinaryDecode() {
  const base64 = decodeInput.value.trim();
  const mime = detectMimeType(base64);
  const buffer = base64ToArrayBuffer(base64);
  const size = formatFileSize(buffer.byteLength);

  if (mime && IMAGE_TYPES.includes(mime)) {
    decodedImageSrc.value = `data:${mime};base64,${base64}`;
  } else {
    decodedBinaryMeta.value = { mime: mime ?? '未知类型', size };
    decodedBinaryBase64.value = base64;
  }
}

async function handleFile() {
  const file = fileInputRef.value?.files?.[0];
  if (!file) return;
  processFile(file);
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  processFile(file);
}

function processFile(file: File) {
  encodeError.value = '';
  encodeOutput.value = '';
  encodeFileName.value = file.name;
  fileMeta.value = { mime: file.type || '未知类型', size: formatFileSize(file.size) };

  const reader = new FileReader();
  reader.onload = () => {
    encodeOutput.value = arrayBufferToBase64(reader.result as ArrayBuffer);
  };
  reader.onerror = () => {
    encodeError.value = '读取文件时出错';
  };
  reader.readAsArrayBuffer(file);
}

function handleExample() {
  encodeInput.value = 'Hello, DevTools! 你好，开发者工具！';
  encodeFileName.value = '';
  executeEncode();
}

function handleClear() {
  encodeInput.value = '';
  encodeOutput.value = '';
  encodeError.value = '';
  encodeFileName.value = '';
  fileMeta.value = null;
  decodeInput.value = '';
  decodeOutput.value = '';
  decodeError.value = '';
  decodedImageSrc.value = '';
  decodedBinaryMeta.value = null;
  decodedBinaryBase64.value = '';
}

function handleDownload() {
  if (!decodedBinaryBase64.value) return;
  const buffer = base64ToArrayBuffer(decodedBinaryBase64.value);
  const mime = decodedBinaryMeta.value?.mime;
  const ext = mimeToExt(mime);
  const blob = new Blob([buffer], mime ? { type: mime } : undefined);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `decoded${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function mimeToExt(mime: string | undefined): string {
  if (!mime) return '';
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
  };
  return map[mime] ?? '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="Base64 编解码"
      description="Base64 编码与解码，支持文本和文件"
      @example="handleExample"
    />

    <div class="grid md:grid-cols-2 gap-4">
      <!-- Left column: Encode -->
      <div>
        <h3 class="text-[0.9375rem] font-semibold text-text mb-3">编码</h3>

        <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入文本</label>
        <textarea
          v-model="encodeInput"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="6"
          placeholder="输入要编码的文本"
        ></textarea>

        <!-- Drag-and-drop file upload -->
        <div
          class="mt-2 border-dashed border-2 border-border rounded-md p-6 text-center cursor-pointer hover:border-accent hover:bg-hover transition-[border-color,background-color] duration-150"
          :class="{ 'border-accent bg-hover': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
          @click="fileInputRef?.click()"
        >
          <input ref="fileInputRef" type="file" class="hidden" @change="handleFile" />
          <template v-if="fileMeta && encodeFileName">
            <span>📄 {{ encodeFileName }} · {{ fileMeta.mime }} · {{ fileMeta.size }}</span>
          </template>
          <template v-else>
            <span class="text-muted text-sm">拖拽文件到这里或点击选择</span>
          </template>
        </div>

        <!-- File meta info bar -->
        <div v-if="fileMeta" class="mt-2 px-3 py-1.5 bg-hover border border-border rounded-sm text-[0.8125rem] text-muted flex items-center gap-1.5">
          <span>📄</span>
          <span>{{ fileMeta.mime }} · {{ fileMeta.size }}</span>
        </div>

        <p v-if="encodeError" class="text-error text-[0.8125rem] m-0 mt-2">{{ encodeError }}</p>

        <div class="mt-3 flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
            @click="executeEncode"
          >编码</button>
        </div>

        <!-- Encode output -->
        <div v-if="encodeOutput" class="mt-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">编码结果</label>
          <textarea
            v-model="encodeOutput"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
            rows="6"
            readonly
          ></textarea>
          <div class="mt-1">
            <CopyButton :text="encodeOutput" label="复制结果" />
          </div>
        </div>
      </div>

      <!-- Right column: Decode -->
      <div>
        <h3 class="text-[0.9375rem] font-semibold text-text mb-3">解码</h3>

        <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入 Base64</label>
        <textarea
          v-model="decodeInput"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="6"
          placeholder="输入要解码的 Base64 字符串"
        ></textarea>

        <p v-if="decodeError" class="text-error text-[0.8125rem] m-0 mt-2">{{ decodeError }}</p>

        <div class="mt-3 flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
            @click="executeDecode"
          >解码</button>
        </div>

        <!-- Decode output -->
        <div v-if="decodeOutput && !isDecodeBinaryResult()" class="mt-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">解码结果</label>
          <textarea
            v-model="decodeOutput"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
            rows="6"
            readonly
          ></textarea>
        </div>

        <!-- Image preview -->
        <div v-if="decodedImageSrc" class="mt-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">解码结果</label>
          <div class="p-3 border border-border rounded-sm bg-hover">
            <img :src="decodedImageSrc" alt="解码图片" class="max-w-full max-h-80 rounded-sm" />
          </div>
        </div>

        <!-- Binary file card -->
        <div v-else-if="decodedBinaryMeta" class="mt-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">解码结果</label>
          <div class="p-3 border border-border rounded-sm bg-hover flex items-center gap-3">
            <div class="flex-1">
              <div class="text-[0.8125rem] text-muted">📄 {{ decodedBinaryMeta.mime }} · {{ decodedBinaryMeta.size }}</div>
            </div>
            <button
              class="px-3 py-1.5 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90"
              @click="handleDownload"
            >下载文件</button>
          </div>
        </div>

        <!-- Decode action buttons -->
        <div v-if="decodeOutput || isDecodeBinaryResult()" class="mt-2 flex gap-2 items-center">
          <CopyButton v-if="decodeOutput && !isDecodeBinaryResult()" :text="decodeOutput" label="复制结果" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
    </div>
  </div>
</template>
