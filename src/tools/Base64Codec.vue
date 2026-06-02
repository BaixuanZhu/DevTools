<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { encodeBase64, decodeBase64 } from '../utils/base64';

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

/** 处理文件编码 */
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

function switchMode(newMode: Mode) {
  mode.value = newMode;
  input.value = output.value;
  output.value = '';
  errorMsg.value = '';
  fileName.value = '';
}

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
  <div class="base64-tool">
    <ToolHeader
      title="Base64 编解码"
      description="Base64 编码与解码，支持文本和文件"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: mode === 'encode' }]" @click="switchMode('encode')">编码</button>
      <button :class="['tab-btn', { active: mode === 'decode' }]" @click="switchMode('decode')">解码</button>
    </div>

    <div class="io-section">
      <div class="io-block">
        <label class="field-label">{{ mode === 'encode' ? '输入文本' : '输入 Base64' }}</label>
        <textarea v-model="input" class="field-textarea" rows="6" :placeholder="mode === 'encode' ? '输入要编码的文本' : '输入要解码的 Base64 字符串'"></textarea>
      </div>

      <div v-if="mode === 'encode'" class="file-section">
        <label class="field-label">或上传文件编码为 Data URL</label>
        <div class="file-row">
          <input ref="fileInputRef" type="file" class="file-input" @change="handleFile" />
          <span v-if="fileName" class="file-name">{{ fileName }}</span>
        </div>
      </div>

      <div class="io-block">
        <label class="field-label">输出结果</label>
        <textarea v-model="output" class="field-textarea output-textarea" rows="6" readonly></textarea>
      </div>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div class="action-bar">
      <button class="btn-primary" @click="execute">{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <CopyButton v-if="output" :text="output" label="复制结果" />
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>

<style scoped>
.base64-tool { max-width: 720px; }

.mode-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.tab-btn.active {
  background-color: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.io-section { margin-bottom: var(--space-md); }

.io-block { margin-bottom: var(--space-sm); }

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.output-textarea {
  background-color: var(--color-hover);
}

.file-section { margin-bottom: var(--space-sm); }

.file-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.file-input { font-size: 0.8125rem; }

.file-name {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}
</style>
