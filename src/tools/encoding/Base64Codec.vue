<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { encodeBase64, decodeBase64 } from '../../utils/encoding/base64';

type Mode = 'encode' | 'decode';

const mode = ref<Mode>('encode');
const input = ref('');
const output = ref('');
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');

function execute() {
  errorMsg.value = '';
  output.value = '';

  if (!input.value.trim() && !fileName.value) {
    errorMsg.value = mode.value === 'encode' ? '请输入要编码的文本' : '请输入要解码的 Base64 字符串';
    return;
  }

  try {
    if (mode.value === 'encode') {
      output.value = encodeBase64(input.value);
    } else {
      output.value = decodeBase64(input.value);
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '处理时出错';
  }
}

async function handleFile() {
  const file = fileInputRef.value?.files?.[0];
  if (!file) return;

  errorMsg.value = '';
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    output.value = reader.result as string;
  };
  reader.onerror = () => {
    errorMsg.value = '读取文件时出错';
  };
  reader.readAsDataURL(file);
}

watch(mode, () => {
  input.value = output.value;
  output.value = '';
  errorMsg.value = '';
  fileName.value = '';
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
        <label class="field-label">或上传文件编码为 Data URL</label>
        <div class="flex items-center gap-2">
          <input ref="fileInputRef" type="file" class="text-[0.8125rem]" @change="handleFile" />
          <span v-if="fileName" class="text-[0.8125rem] text-muted">{{ fileName }}</span>
        </div>
      </div>

      <div class="mb-2">
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
