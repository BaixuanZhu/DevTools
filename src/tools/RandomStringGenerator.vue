<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import {
  generateRandomString,
  applyLetterCase,
  hasLetters,
  PRESET_CHARSETS,
  type CharsetPreset,
  type LetterCase,
} from '../utils/random-string';

/** 字符集预设选项 */
const CHARSET_PRESETS = [
  { value: 'alphanumeric', label: '字母 + 数字' },
  { value: 'digits', label: '仅数字' },
  { value: 'special', label: '+ 特殊字符' },
  { value: 'custom', label: '自定义' },
] as const;

const length = ref(32);
const charsetPreset = ref<string>('alphanumeric');
const customChars = ref('');
const amount = ref(1);
const letterCase = ref<LetterCase>('none');
const results = ref<string[]>([]);
const errorMsg = ref('');

/** 字符集是否包含字母 */
const charsetHasLetters = computed(() => {
  if (charsetPreset.value === 'custom') return hasLetters(`custom:${customChars.value}`);
  return hasLetters(charsetPreset.value as CharsetPreset);
});

/** 获取实际字符集参数 */
function getCharset(): CharsetPreset {
  if (charsetPreset.value === 'custom') {
    return `custom:${customChars.value}`;
  }
  return charsetPreset.value as CharsetPreset;
}

/** 生成随机字符串 */
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
  results.value = Array.from(
    { length: count },
    () => applyLetterCase(generateRandomString(length.value, charset), letterCase.value)
  );
}

/** 复制相关 */
const copiedRow = ref(-1);

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => { copiedRow.value = -1; }, 1000);
  }
}

const allResultsText = computed(() => results.value.join('\n'));

/** 监听参数变化自动重新生成 */
watch(
  [length, charsetPreset, customChars, amount, letterCase],
  () => { generate(); },
  { immediate: false }
);

/** 字符集切换为非字母时重置大小写 */
watch(charsetHasLetters, (has) => {
  if (!has) letterCase.value = 'none';
});

onMounted(() => { generate(); });
</script>

<template>
  <div class="random-tool">
    <ToolHeader
      title="随机字符串生成"
      description="自定义长度和字符集的随机字符串生成器"
      :show-example="false"
    />

    <!-- 第一行：长度 + 字符集 + 大小写 -->
    <div class="control-row">
      <div class="control-inline">
        <label class="inline-label">长度</label>
        <input
          v-model.number="length"
          type="number"
          :min="1"
          :max="10000"
          class="inline-input"
          style="width: 70px"
        />
      </div>
      <div class="chip-group">
        <button
          v-for="p in CHARSET_PRESETS"
          :key="p.value"
          :class="['chip', { active: charsetPreset === p.value }]"
          @click="charsetPreset = p.value"
        >
          {{ p.label }}
        </button>
      </div>
      <template v-if="charsetHasLetters">
        <button
          :class="['chip', 'chip--case', { active: letterCase === 'upper' }]"
          @click="letterCase = letterCase === 'upper' ? 'none' : 'upper'"
        >
          大写
        </button>
        <button
          :class="['chip', 'chip--case', { active: letterCase === 'lower' }]"
          @click="letterCase = letterCase === 'lower' ? 'none' : 'lower'"
        >
          小写
        </button>
      </template>
    </div>

    <!-- 自定义字符集（条件显示） -->
    <div v-if="charsetPreset === 'custom'" class="custom-row">
      <input
        v-model="customChars"
        class="inline-text"
        placeholder="输入允许的字符"
      />
    </div>

    <!-- 第二行：数量 + 操作 -->
    <div class="control-row">
      <div class="control-inline">
        <label class="inline-label">×</label>
        <input
          v-model.number="amount"
          type="number"
          :min="1"
          :max="100"
          class="inline-input"
          style="width: 50px"
        />
      </div>
      <button class="refresh-btn" @click="generate" title="重新生成">↻</button>
      <CopyButton v-if="results.length" :text="allResultsText" label="复制全部" />
    </div>

    <!-- 错误提示 -->
    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <!-- 结果区（始终可见） -->
    <div class="results-area">
      <div
        v-for="(str, index) in results"
        :key="index"
        class="result-row"
      >
        <code class="result-value">{{ str }}</code>
        <button class="result-copy" @click="copyRow(index)">
          {{ copiedRow === index ? '✓' : '复制' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.random-tool {
  max-width: 720px;
}

/* 控制行 */
.control-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}

/* Chip 切换组 */
.chip-group {
  display: flex;
  gap: 4px;
}

.chip {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chip:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.chip--case.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

/* inline 控件 */
.control-inline {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.inline-label {
  font-size: 0.8125rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.inline-input {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
}

.inline-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.inline-text {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
  min-width: 200px;
}

.inline-text:focus {
  outline: none;
  border-color: var(--color-accent);
}

/* 刷新按钮 */
.refresh-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* 自定义字符行 */
.custom-row {
  margin-bottom: var(--space-md);
}

/* 错误提示 */
.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

/* 结果区 */
.results-area {
  display: flex;
  flex-direction: column;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
  min-width: 0;
  flex: 1;
}

.result-copy {
  flex-shrink: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
  margin-left: var(--space-sm);
}

.result-copy:hover {
  color: var(--color-accent);
}
</style>
