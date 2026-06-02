<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { copyToClipboard } from '../utils/clipboard';

const version = ref('v4');
const amount = ref(1);
const results = ref<string[]>([]);

/** 生成 UUID v4 */
function generateV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 生成 UUID v1（简化版，基于时间戳和随机数） */
function generateV1(): string {
  const now = Date.now();
  const hex = now.toString(16).padStart(12, '0');
  const rand = () => Math.random().toString(16).substring(2, 6);
  return `${hex.slice(-8)}-${rand()}-1${rand().slice(1)}-${rand()}-${rand()}${rand()}`.replace(
    /^(.{8})-(.{4})-(.{4})-(.{4})-(.{12}).*$/,
    '$1-$2-$3-$4-$5',
  );
}

/** 生成 UUID v7（基于 Unix 时间戳） */
function generateV7(): string {
  const now = Date.now();
  const hex = now.toString(16).padStart(12, '0');
  const rand = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${rand().slice(1)}-${rand()}-${rand()}${rand()}`;
}

function generate() {
  const count = Math.min(Math.max(amount.value || 1, 1), 100);
  const gen = version.value === 'v1' ? generateV1 : version.value === 'v7' ? generateV7 : generateV4;
  results.value = Array.from({ length: count }, () => gen());
}

function handleExample() {
  version.value = 'v4';
  amount.value = 5;
  generate();
}

function handleClear() {
  results.value = [];
}

const allResultsText = computed(() => results.value.join('\n'));

const copiedRow = ref(-1);

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => {
      copiedRow.value = -1;
    }, 1000);
  }
}
</script>

<template>
  <div class="uuid-tool">
    <ToolHeader
      title="UUID 生成器"
      description="生成多种版本的 UUID（v1、v4、v7 等）"
      @example="handleExample"
    />

    <div class="uuid-controls">
      <div class="uuid-version">
        <label class="field-label">UUID 版本</label>
        <select v-model="version" class="field-select">
          <option value="v4">v4（随机）</option>
          <option value="v1">v1（时间戳）</option>
          <option value="v7">v7（时间排序）</option>
        </select>
      </div>
      <div class="uuid-amount">
        <label class="field-label">生成数量</label>
        <input v-model.number="amount" type="number" :min="1" :max="100" class="field-input" />
      </div>
      <button class="btn-primary" @click="generate">生成</button>
    </div>

    <div class="uuid-output">
      <div class="output-header">
        <span class="output-label">生成结果</span>
        <div class="output-actions">
          <CopyButton v-if="results.length" :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="results-area">
        <p v-if="!results.length" class="results-placeholder">点击"生成"按钮或输入后自动生成 UUID</p>
        <div
          v-for="(uuid, index) in results"
          :key="index"
          class="result-row"
        >
          <code class="result-value">{{ uuid }}</code>
          <button class="result-copy" @click="copyRow(index)">
            {{ copiedRow === index ? '✓' : '复制' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uuid-tool {
  max-width: 720px;
}

.uuid-controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}

.uuid-version,
.uuid-amount {
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

.field-input {
  width: 80px;
}

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

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.output-actions {
  display: flex;
  gap: var(--space-sm);
}

.results-area {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-height: 120px;
  background-color: var(--color-card);
}

.results-placeholder {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: var(--space-xl) 0;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
}

.result-copy {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
}

.result-copy:hover {
  color: var(--color-accent);
}
</style>
