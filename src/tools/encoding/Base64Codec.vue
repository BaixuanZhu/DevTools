<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
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

type Mode = 'encode' | 'decode';
const mode = ref<Mode>('encode');
const input = ref('');
const output = ref('');
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const fileMeta = ref<{ mime: string; size: string } | null>(null);
const isDragging = ref(false);

// Decode-specific state
const decodedImageSrc = ref('');
const decodedBinaryMeta = ref<{ mime: string; size: string } | null>(null);
const decodedBinaryBase64 = ref('');

function isDecodeBinaryResult(): boolean {
  return !!decodedImageSrc.value || !!decodedBinaryMeta.value;
}

function executeEncode() {
  errorMsg.value = '';
  output.value = '';

  if (!input.value.trim() && !fileName.value) {
    errorMsg.value = '请输入要编码的文本';
    return;
  }

  try {
    output.value = encodeBase64(input.value);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '编码时出错';
  }
}

function executeDecode() {
  errorMsg.value = '';
  output.value = '';
  decodedImageSrc.value = '';
  decodedBinaryMeta.value = null;
  decodedBinaryBase64.value = '';

  if (!input.value.trim()) {
    errorMsg.value = '请输入要解码的 Base64 字符串';
    return;
  }

  try {
    try {
      output.value = decodeBase64(input.value);
    } catch {
      // Text decode failed — treat as binary
      handleBinaryDecode();
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解码时出错';
  }
}

function handleBinaryDecode() {
  const base64 = input.value.trim();
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

function execute() {
  if (mode.value === 'encode') {
    executeEncode();
  } else {
    executeDecode();
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
  errorMsg.value = '';
  output.value = '';
  fileName.value = file.name;
  fileMeta.value = { mime: file.type || '未知类型', size: formatFileSize(file.size) };

  const reader = new FileReader();
  reader.onload = () => {
    output.value = arrayBufferToBase64(reader.result as ArrayBuffer);
  };
  reader.onerror = () => {
    errorMsg.value = '读取文件时出错';
  };
  reader.readAsArrayBuffer(file);
}

watch(mode, () => {
  input.value = '';
  output.value = '';
  errorMsg.value = '';
  fileName.value = '';
  fileMeta.value = null;
  decodedImageSrc.value = '';
  decodedBinaryMeta.value = null;
  decodedBinaryBase64.value = '';
});

function handleExample() {
  mode.value = 'encode';
  input.value = 'Hello, DevTools! 你好，开发者工具！';
  fileName.value = '';
  executeEncode();
}

function handleClear() {
  input.value = '';
  output.value = '';
  errorMsg.value = '';
  fileName.value = '';
  fileMeta.value = null;
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
  <div class="max-w-[720px]">
    <ToolHeader
      title="Base64 编解码"
      description="Base64 编码与解码，支持文本和文件"
      @example="handleExample"
    />

    <ModeTabGroup v-model="mode" :options="[{ key: 'encode', label: '编码' }, { key: 'decode', label: '解码' }]" />

    <!-- Input area -->
    <div class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">
        {{ mode === 'encode' ? '输入文本' : '输入 Base64' }}
      </label>
      <textarea
        v-model="input"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
        rows="6"
        :placeholder="mode === 'encode' ? '输入要编码的文本' : '输入要解码的 Base64 字符串'"
      ></textarea>
    </div>

    <!-- Encode mode: drag-drop file upload -->
    <div v-if="mode === 'encode'" class="mb-3">
      <div
        class="border-dashed border-2 border-border rounded-md p-5 text-center cursor-pointer hover:border-accent hover:bg-hover transition-[border-color,background-color] duration-150"
        :class="{ 'border-accent bg-hover': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="fileInputRef?.click()"
      >
        <input ref="fileInputRef" type="file" class="hidden" @change="handleFile" />
        <template v-if="fileMeta && fileName">
          <span class="text-[0.8125rem] text-text">📄 {{ fileName }} · {{ fileMeta.mime }} · {{ fileMeta.size }}</span>
        </template>
        <template v-else>
          <span class="text-muted text-sm">拖拽文件到这里或点击选择</span>
        </template>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex gap-2 items-center mb-4">
      <button
        class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
        @click="execute"
      >{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <ClearButton @clear="handleClear" />
    </div>

    <!-- Error message -->
    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

    <!-- Encode output (always visible) -->
    <div v-if="mode === 'encode'" class="mb-3">
      <div v-if="fileMeta" class="mb-2 px-3 py-1.5 bg-hover border border-border rounded-sm text-[0.8125rem] text-muted flex items-center gap-1.5">
        <span>📄</span>
        <span>{{ fileMeta.mime }} · {{ fileMeta.size }}</span>
      </div>
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">编码结果</label>
      <textarea
        v-model="output"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
        rows="6"
        readonly
        :placeholder="output ? '' : '点击「编码」查看结果'"
      ></textarea>
      <div v-if="output" class="mt-1.5">
        <CopyButton :text="output" label="复制结果" />
      </div>
    </div>

    <!-- Decode output (always visible) -->
    <div v-if="mode === 'decode'" class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">解码结果</label>

      <!-- Text result -->
      <template v-if="!isDecodeBinaryResult()">
        <textarea
          v-model="output"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
          rows="6"
          readonly
          :placeholder="output ? '' : '点击「解码」查看结果'"
        ></textarea>
        <div v-if="output" class="mt-1.5">
          <CopyButton :text="output" label="复制结果" />
        </div>
      </template>

      <!-- Image preview -->
      <div v-if="decodedImageSrc" class="p-3 border border-border rounded-sm bg-hover">
        <img :src="decodedImageSrc" alt="解码图片" class="max-w-full max-h-80 rounded-sm" />
      </div>
      <div v-if="decodedImageSrc" class="mt-1.5">
        <CopyButton :text="input" label="复制原始 Base64" />
      </div>

      <!-- Binary file card -->
      <div v-if="decodedBinaryMeta" class="p-3 border border-border rounded-sm bg-hover flex items-center gap-3">
        <div class="flex-1">
          <div class="text-[0.8125rem] text-muted">📄 {{ decodedBinaryMeta.mime }} · {{ decodedBinaryMeta.size }}</div>
        </div>
        <button
          class="px-3 py-1.5 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90"
          @click="handleDownload"
        >下载文件</button>
      </div>
    </div>
  </div>
</template>
