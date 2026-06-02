<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import { generateRandomString, PRESET_CHARSETS, type CharsetPreset } from '../utils/random-string';

const length = ref(32);
const charsetPreset = ref<string>('alphanumeric');
const customChars = ref('');
const amount = ref(1);
const results = ref<string[]>([]);
const errorMsg = ref('');
const copiedRow = ref(-1);

const presets = [
  { value: 'alphanumeric', label: '字母 + 数字' },
  { value: 'digits', label: '仅数字' },
  { value: 'special', label: '字母 + 数字 + 特殊字符' },
  { value: 'custom', label: '自定义' },
];

/** 获取实际的字符集参数 */
function getCharset(): CharsetPreset {
  if (charsetPreset.value === 'custom') {
    return `custom:${customChars.value}`;
  }
  return charsetPreset.value as CharsetPreset;
}

function generate() {
  errorMsg.value = '';
  if (charsetPreset.value === 'custom' && !customChars.value.trim()) {
    errorMsg.value = '请输入自定义字符集';
    return;
  }
  if (length.value < 1 || length.value > 10000) {
    errorMsg.value = '长度应在 1-10000 之间';
    return;
  }
  const count = Math.min(Math.max(amount.value || 1, 1), 100);
  const charset = getCharset();
  results.value = Array.from({ length: count }, () => generateRandomString(length.value, charset));
}

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => { copiedRow.value = -1; }, 1000);
  }
}

function handleExample() {
  length.value = 32;
  charsetPreset.value = 'alphanumeric';
  amount.value = 5;
  generate();
}

function handleClear() {
  results.value = [];
  errorMsg.value = '';
}

const allResultsText = computed(() => results.value.join('\n'));
</script>

<template>
  <div class="random-tool">
    <ToolHeader
      title="随机字符串生成"
      description="自定义长度和字符集的随机字符串生成器"
      @example="handleExample"
    />

    <div class="random-controls">
      <div class="control-group">
        <label class="field-label">长度</label>
        <input v-model.number="length" type="number" :min="1" :max="10000" class="field-input" style="width:100px" />
      </div>
      <div class="control-group">
        <label class="field-label">字符集</label>
        <select v-model="charsetPreset" class="field-select">
          <option v-for="p in presets" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div v-if="charsetPreset === 'custom'" class="control-group">
        <label class="field-label">自定义字符</label>
        <input v-model="customChars" class="field-input" placeholder="输入允许的字符" />
      </div>
      <div class="control-group">
        <label class="field-label">数量</label>
        <input v-model.number="amount" type="number" :min="1" :max="100" class="field-input" style="width:80px" />
      </div>
    </div>

    <div class="random-actions">
      <button class="btn-primary" @click="generate">生成</button>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="results.length" class="random-output">
      <div class="output-header">
        <span class="output-label">生成结果</span>
        <div class="output-actions">
          <CopyButton :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="results-area">
        <div v-for="(str, index) in results" :key="index" class="result-row">
          <code class="result-value">{{ str }}</code>
          <button class="result-copy" @click="copyRow(index)">
            {{ copiedRow === index ? '✓' : '复制' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.random-tool { max-width: 720px; }

.random-controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-muted);
}

.field-select,
.field-input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background-color: var(--color-card);
}

.field-select:focus,
.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.random-actions { margin-bottom: var(--space-md); }

.btn-primary {
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: #fff;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-primary:hover {
  opacity: 0.9;
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label { font-size: 0.875rem; font-weight: 500; }

.output-actions { display: flex; gap: var(--space-sm); }

.results-area {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-height: 120px;
  background-color: var(--color-card);
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.result-row + .result-row { border-top: 1px solid var(--color-border); }

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}

.result-copy {
  flex-shrink: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
}

.result-copy:hover { color: var(--color-accent); }
</style>
