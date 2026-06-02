<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  type DateInfo,
} from '../utils/datetime';

type InputMode = 'timestamp' | 'date';

const inputMode = ref<InputMode>('timestamp');
const timestampInput = ref('');
const dateInput = ref('');
const dateInfo = ref<DateInfo | null>(null);
const errorMsg = ref('');
const copiedField = ref('');

/** 解析时间戳 */
function parseTimestamp() {
  errorMsg.value = '';
  dateInfo.value = null;

  const input = timestampInput.value.trim();
  if (!input) {
    errorMsg.value = '请输入时间戳';
    return;
  }

  const unit = detectTimestampUnit(input);
  if (!unit) {
    errorMsg.value = '无法识别时间戳格式，请输入 10 位（秒）或 13 位（毫秒）数字';
    return;
  }

  const ts = Number(input);
  dateInfo.value = timestampToDateInfo(unit === 's' ? ts * 1000 : ts);
}

/** 解析日期字符串 */
function parseDate() {
  errorMsg.value = '';
  dateInfo.value = null;

  const input = dateInput.value.trim();
  if (!input) {
    errorMsg.value = '请输入日期时间';
    return;
  }

  const result = parseDateInput(input);
  if (!result) {
    errorMsg.value = '无法解析日期，请检查格式';
    return;
  }
  dateInfo.value = result;
}

function execute() {
  if (inputMode.value === 'timestamp') {
    parseTimestamp();
  } else {
    parseDate();
  }
}

function fillNow() {
  inputMode.value = 'timestamp';
  timestampInput.value = String(Date.now());
  parseTimestamp();
}

function handleExample() {
  inputMode.value = 'timestamp';
  timestampInput.value = '1700000000000';
  parseTimestamp();
}

function handleClear() {
  timestampInput.value = '';
  dateInput.value = '';
  dateInfo.value = null;
  errorMsg.value = '';
}

async function copyField(label: string, value: string) {
  const success = await copyToClipboard(value);
  if (success) {
    copiedField.value = label;
    setTimeout(() => { copiedField.value = ''; }, 1000);
  }
}

const resultFields = computed(() => {
  if (!dateInfo.value) return [];
  return [
    { label: 'ISO 8601', value: dateInfo.value.iso },
    { label: '本地时间', value: dateInfo.value.local },
    { label: 'UTC 时间', value: dateInfo.value.utc },
    { label: '相对时间', value: dateInfo.value.relative },
    { label: 'Unix 秒', value: String(dateInfo.value.unixSeconds) },
    { label: 'Unix 毫秒', value: String(dateInfo.value.unixMillis) },
  ];
});
</script>

<template>
  <div class="datetime-tool">
    <ToolHeader
      title="日期时间转换器"
      description="时间戳与日期格式互转，支持多种日期格式"
      @example="handleExample"
    />

    <div class="mode-tabs">
      <button :class="['tab-btn', { active: inputMode === 'timestamp' }]" @click="inputMode = 'timestamp'">时间戳 → 日期</button>
      <button :class="['tab-btn', { active: inputMode === 'date' }]" @click="inputMode = 'date'">日期 → 时间戳</button>
    </div>

    <div class="input-section">
      <div v-if="inputMode === 'timestamp'" class="input-group">
        <label class="field-label">输入时间戳</label>
        <input v-model="timestampInput" class="field-input" style="width:100%" placeholder="例如：1700000000000（毫秒）或 1700000000（秒）" />
      </div>
      <div v-else class="input-group">
        <label class="field-label">输入日期时间</label>
        <input v-model="dateInput" class="field-input" style="width:100%" placeholder="例如：2023-11-14T12:00:00 或 2023/11/14 12:00:00" />
        <input v-model="dateInput" type="datetime-local" class="field-input" style="width:100%;margin-top:var(--space-xs)" step="1" @change="execute" />
      </div>
    </div>

    <div class="action-bar">
      <button class="btn-primary" @click="execute">转换</button>
      <button class="btn-secondary" @click="fillNow">当前时间</button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="resultFields.length" class="result-cards">
      <div v-for="field in resultFields" :key="field.label" class="result-card">
        <span class="result-label">{{ field.label }}</span>
        <code class="result-value">{{ field.value }}</code>
        <button class="result-copy" @click="copyField(field.label, field.value)">
          {{ copiedField === field.label ? '✓' : '复制' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datetime-tool { max-width: 720px; }

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

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.action-bar {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
}

.btn-secondary {
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-text);
  font-size: 0.875rem;
  font-family: var(--font-sans);
  cursor: pointer;
}

.btn-secondary:hover { background-color: var(--color-hover); }

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.result-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.result-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
}

.result-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  min-width: 80px;
}

.result-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
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
