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

type Mode = 'encode' | 'decode';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp', 'image/bmp'];

const mode = ref<Mode>('encode');
const input = ref('');
const output = ref('');
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');

// Encode meta info
const fileMeta = ref<{ mime: string; size: string } | null>(null);

// Decode result types
const decodedImageSrc = ref('');
const decodedBinaryMeta = ref<{ mime: string; size: string } | null>(null);
const decodedBinaryBase64 = ref('');

function isDecodeBinaryResult(): boolean {
  return !!decodedImageSrc.value || !!decodedBinaryMeta.value;
}

function execute() {
  errorMsg.value = '';
  output.value = '';
  fileMeta.value = null;
  decodedImageSrc.value = '';
  decodedBinaryMeta.value = null;
  decodedBinaryBase64.value = '';

  if (!input.value.trim() && !fileName.value) {
    errorMsg.value = mode.value === 'encode' ? '请输入要编码的文本' : '请输入要解码的 Base64 字符串';
    return;
  }

  try {
    if (mode.value === 'encode') {
      output.value = encodeBase64(input.value);
    } else {
      try {
        output.value = decodeBase64(input.value);
      } catch {
        // Text decode failed — treat as binary
        handleBinaryDecode();
      }
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '处理时出错';
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

async function handleFile() {
  const file = fileInputRef.value?.files?.[0];
  if (!file) return;

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
  execute();
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

    <div class="mb-4">
      <div class="mb-2">
        <label class="field-label">{{ mode === 'encode' ? '输入文本' : '输入 Base64' }}</label>
        <textarea v-model="input" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="6" :placeholder="mode === 'encode' ? '输入要编码的文本' : '输入要解码的 Base64 字符串'"></textarea>
      </div>

      <div v-if="mode === 'encode'" class="mb-2">
        <label class="field-label">或上传文件编码</label>
        <div class="flex items-center gap-2">
          <input ref="fileInputRef" type="file" class="text-[0.8125rem]" @change="handleFile" />
          <span v-if="fileName" class="text-[0.8125rem] text-muted">{{ fileName }}</span>
        </div>
      </div>

      <!-- Encode: file meta info bar -->
      <div v-if="fileMeta" class="mb-2 px-3 py-1.5 bg-hover border border-border rounded-sm text-[0.8125rem] text-muted flex items-center gap-1.5">
        <span>📄</span>
        <span>{{ fileMeta.mime }} · {{ fileMeta.size }}</span>
      </div>

      <!-- Decode: image preview -->
      <div v-if="decodedImageSrc" class="mb-2">
        <label class="field-label">输出结果</label>
        <div class="p-3 border border-border rounded-sm bg-hover">
          <img :src="decodedImageSrc" alt="解码图片" class="max-w-full max-h-80 rounded-sm" />
        </div>
      </div>

      <!-- Decode: binary file card -->
      <div v-else-if="decodedBinaryMeta" class="mb-2">
        <label class="field-label">输出结果</label>
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

      <!-- Text output (encode result or decode text result) -->
      <div v-if="output && !isDecodeBinaryResult()" class="mb-2">
        <label class="field-label">输出结果</label>
        <textarea v-model="output" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent" rows="6" readonly></textarea>
      </div>
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <div class="flex gap-2 items-center">
      <button class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90" @click="execute">{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <CopyButton v-if="output" :text="output" label="复制结果" />
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>
