<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { encodeUrl, decodeUrl } from '../../utils/encoding/url-codec';

type Mode = 'encode' | 'decode';

const mode = ref<Mode>('encode');
const input = ref('');
const errorMsg = ref('');

const encodeComponentResult = ref('');
const encodeFullResult = ref('');
const decodeComponentResult = ref('');
const decodeFullResult = ref('');

function execute() {
  errorMsg.value = '';
  if (!input.value.trim()) {
    errorMsg.value = mode.value === 'encode' ? '请输入要编码的文本' : '请输入要解码的文本';
    return;
  }

  if (mode.value === 'encode') {
    const result = encodeUrl(input.value);
    encodeComponentResult.value = result.component;
    encodeFullResult.value = result.full;
    decodeComponentResult.value = '';
    decodeFullResult.value = '';
  } else {
    const result = decodeUrl(input.value);
    decodeComponentResult.value = result.component;
    decodeFullResult.value = result.full;
    encodeComponentResult.value = '';
    encodeFullResult.value = '';
    if (result.error) errorMsg.value = result.error;
  }
}

function switchMode(newMode: Mode) {
  mode.value = newMode;
  errorMsg.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
}

function handleExample() {
  mode.value = 'encode';
  input.value = 'https://example.com/search?q=你好世界&lang=zh-CN';
  execute();
}

function handleClear() {
  input.value = '';
  errorMsg.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
}
</script>

<template>
  <div class="url-tool">
    <ToolHeader
      title="URL 编解码"
      description="URL 编码与解码，支持组件级和完整 URL 编码"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: mode === 'encode' }]" @click="switchMode('encode')">编码</button>
      <button :class="['tab-btn', { active: mode === 'decode' }]" @click="switchMode('decode')">解码</button>
    </div>

    <div class="input-section">
      <label class="field-label">输入</label>
      <textarea v-model="input" class="field-textarea" rows="3" :placeholder="mode === 'encode' ? '输入要编码的文本或 URL' : '输入要解码的 percent-encoded 文本'"></textarea>
    </div>

    <div class="action-bar">
      <button class="btn-primary" @click="execute">{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="encodeComponentResult || decodeComponentResult" class="results-section">
      <div class="result-block">
        <div class="result-block-header">
          <span class="result-label">{{ mode === 'encode' ? 'encodeURIComponent' : 'decodeURIComponent' }}</span>
          <span class="result-hint">组件级，编码/解码所有特殊字符</span>
        </div>
        <div class="result-value-box">
          <code class="result-value">{{ mode === 'encode' ? encodeComponentResult : decodeComponentResult }}</code>
          <CopyButton :text="mode === 'encode' ? encodeComponentResult : decodeComponentResult" label="复制" />
        </div>
      </div>
      <div class="result-block">
        <div class="result-block-header">
          <span class="result-label">{{ mode === 'encode' ? 'encodeURI' : 'decodeURI' }}</span>
          <span class="result-hint">完整 URL 级，保留 URL 结构字符（: / ? & = #）</span>
        </div>
        <div class="result-value-box">
          <code class="result-value">{{ mode === 'encode' ? encodeFullResult : decodeFullResult }}</code>
          <CopyButton :text="mode === 'encode' ? encodeFullResult : decodeFullResult" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.url-tool { max-width: 720px; }

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

.input-section { margin-bottom: var(--space-md); }

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

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.results-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.result-block {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.result-block-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.result-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
  font-family: var(--font-mono);
}

.result-hint {
  font-size: 0.6875rem;
  color: var(--color-muted);
}

.result-value-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.result-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}
</style>
