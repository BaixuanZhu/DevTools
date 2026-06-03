<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import { copyToClipboard } from '../../utils/shared/clipboard';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  type DateInfo,
} from '../../utils/datetime/datetime';

type InputMode = 'timestamp' | 'date';

const inputMode = ref<InputMode>('timestamp');
const timestampInput = ref('');
const dateInput = ref('');
const dateInfo = ref<DateInfo | null>(null);
const errorMsg = ref('');
const copiedField = ref('');

watch(inputMode, () => {
  dateInfo.value = null;
  errorMsg.value = '';
});

function parseTimestamp() {
  errorMsg.value = '';
  dateInfo.value = null;
  const input = timestampInput.value.trim();
  if (!input) { errorMsg.value = '请输入时间戳'; return; }
  const unit = detectTimestampUnit(input);
  if (!unit) { errorMsg.value = '无法识别时间戳格式，请输入 10 位（秒）或 13 位（毫秒）数字'; return; }
  const ts = Number(input);
  dateInfo.value = timestampToDateInfo(unit === 's' ? ts * 1000 : ts);
}

function parseDate() {
  errorMsg.value = '';
  dateInfo.value = null;
  const input = dateInput.value.trim();
  if (!input) { errorMsg.value = '请输入日期时间'; return; }
  const result = parseDateInput(input);
  if (!result) { errorMsg.value = '无法解析日期，请检查格式'; return; }
  dateInfo.value = result;
}

function execute() {
  if (inputMode.value === 'timestamp') parseTimestamp();
  else parseDate();
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
  <div class="max-w-[720px]">
    <ToolHeader title="日期时间转换器" description="时间戳与日期格式互转，支持多种日期格式" @example="handleExample" />

    <ModeTabGroup v-model="inputMode" :options="[{ key: 'timestamp', label: '时间戳 → 日期' }, { key: 'date', label: '日期 → 时间戳' }]" />

    <div class="mb-4">
      <div v-if="inputMode === 'timestamp'" class="flex flex-col gap-1">
        <label class="field-label">输入时间戳</label>
        <input v-model="timestampInput" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent" placeholder="例如：1700000000000（毫秒）或 1700000000（秒）" />
      </div>
      <div v-else class="flex flex-col gap-1">
        <label class="field-label">输入日期时间</label>
        <input v-model="dateInput" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent" placeholder="例如：2023-11-14T12:00:00 或 2023/11/14 12:00:00" />
        <input v-model="dateInput" type="datetime-local" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent" step="1" @change="execute" />
      </div>
    </div>

    <div class="flex gap-2 items-center mb-4">
      <button class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90" @click="execute">转换</button>
      <button class="px-6 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans cursor-pointer hover:bg-hover" @click="fillNow">当前时间</button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <div v-if="resultFields.length" class="flex flex-col gap-1">
      <div v-for="field in resultFields" :key="field.label" class="flex items-center gap-4 px-4 py-2 border border-border rounded-sm bg-card">
        <span class="text-xs font-semibold text-accent min-w-[80px]">{{ field.label }}</span>
        <code class="flex-1 font-mono text-[0.8125rem] text-text">{{ field.value }}</code>
        <button class="shrink-0 border-none bg-transparent cursor-pointer text-muted text-xs px-1 py-0.5 hover:text-accent" @click="copyField(field.label, field.value)">
          {{ copiedField === field.label ? '✓' : '复制' }}
        </button>
      </div>
    </div>
  </div>
</template>
