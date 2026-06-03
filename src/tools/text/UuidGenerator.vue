<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import { copyToClipboard } from '../../utils/shared/clipboard';
import {
  generateUuids,
  isNamespaceVersion,
  hasConversion,
  getConvertedUuid,
  getConversionLabel,
  NAMESPACE_PRESETS,
  type UuidVersion,
} from '../../utils/text/uuid-generator';

/** 可选的 UUID 版本列表（从小到大排列） */
const VERSIONS: { value: UuidVersion; label: string }[] = [
  { value: 'v1', label: 'v1' },
  { value: 'v3', label: 'v3' },
  { value: 'v4', label: 'v4' },
  { value: 'v5', label: 'v5' },
  { value: 'v6', label: 'v6' },
  { value: 'v7', label: 'v7' },
];

const version = ref<UuidVersion>('v4');
const amount = ref(1);
const results = ref<string[]>([]);

/** v3/v5 专用参数 */
const nsName = ref('');
const nsType = ref<'DNS' | 'URL' | 'custom'>('DNS');
const nsCustom = ref('');

/** 获取实际 namespace UUID */
function getNamespace(): string {
  if (nsType.value === 'custom') return nsCustom.value;
  return NAMESPACE_PRESETS[nsType.value];
}

/** 是否需要 name/namespace 参数 */
const needsNamespace = computed(() => isNamespaceVersion(version.value));

/** 是否显示转换结果 */
const showConversion = computed(() => hasConversion(version.value));

/** 转换后的结果（每个 UUID 对应一个转换值） */
const conversions = computed(() =>
  results.value.map((uuid) => getConvertedUuid(version.value, uuid))
);

/** 转换标签 */
const conversionLabel = computed(() => getConversionLabel(version.value));

/** 生成 UUID */
function generate() {
  if (needsNamespace.value && !nsName.value.trim()) return;
  if (needsNamespace.value && nsType.value === 'custom' && !nsCustom.value.trim()) return;

  results.value = generateUuids(amount.value, version.value, {
    name: nsName.value,
    namespace: getNamespace(),
  });
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

const copiedConversion = ref(-1);

async function copyConversion(index: number) {
  const text = conversions.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedConversion.value = index;
    setTimeout(() => { copiedConversion.value = -1; }, 1000);
  }
}

const allResultsText = computed(() => results.value.join('\n'));

/** 监听参数变化自动重新生成 */
watch(
  [version, amount, nsName, nsType, nsCustom],
  () => { generate(); },
  { immediate: false }
);

onMounted(() => { generate(); });
</script>

<template>
  <div class="uuid-tool">
    <ToolHeader
      title="UUID 生成器"
      description="生成多种版本的 UUID（v1、v3、v4、v5、v6、v7）"
      :show-example="false"
    />

    <!-- 版本选择 + 数量 + 操作 -->
    <div class="control-row">
      <div class="chip-group">
        <button
          v-for="v in VERSIONS"
          :key="v.value"
          :class="['chip', { active: version === v.value }]"
          @click="version = v.value"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="control-inline">
        <label class="inline-label">×</label>
        <input
          v-model.number="amount"
          type="number"
          :min="1"
          :max="100"
          class="inline-input"
        />
      </div>
      <button class="refresh-btn" @click="generate" title="重新生成">↻</button>
      <CopyButton v-if="results.length" :text="allResultsText" label="复制全部" />
    </div>

    <!-- v3/v5 条件输入 -->
    <div v-if="needsNamespace" class="namespace-row">
      <div class="control-inline">
        <label class="inline-label">名称</label>
        <input
          v-model="nsName"
          class="inline-text"
          placeholder="输入名称"
        />
      </div>
      <div class="control-inline">
        <label class="inline-label">命名空间</label>
        <select v-model="nsType" class="inline-select">
          <option value="DNS">DNS</option>
          <option value="URL">URL</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div v-if="nsType === 'custom'" class="control-inline">
        <input
          v-model="nsCustom"
          class="inline-text"
          placeholder="输入 UUID 命名空间"
        />
      </div>
    </div>

    <!-- 生成结果 -->
    <div class="results-area">
      <div
        v-for="(uuid, index) in results"
        :key="index"
        class="result-row"
      >
        <div class="result-content">
          <code class="result-value">{{ uuid }}</code>
          <template v-if="showConversion && conversions[index]">
            <span class="conversion-label">{{ conversionLabel }}</span>
            <code class="result-value result-conversion">{{ conversions[index] }}</code>
          </template>
        </div>
        <div class="result-actions">
          <button class="result-copy" @click="copyRow(index)">
            {{ copiedRow === index ? '✓' : '复制' }}
          </button>
          <button
            v-if="showConversion && conversions[index]"
            class="result-copy"
            @click="copyConversion(index)"
          >
            {{ copiedConversion === index ? '✓' : '复制转换' }}
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
  width: 50px;
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
  min-width: 160px;
}

.inline-text:focus {
  outline: none;
  border-color: var(--color-accent);
}

.inline-select {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
}

.inline-select:focus {
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

/* namespace 条件行 */
.namespace-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
  padding: var(--space-sm) 0;
}

/* 结果区 */
.results-area {
  display: flex;
  flex-direction: column;
  gap: 0;
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

.result-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  flex: 1;
}

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
}

.result-conversion {
  color: var(--color-muted);
}

.conversion-label {
  font-size: 0.75rem;
  color: var(--color-muted);
  flex-shrink: 0;
}

.result-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.result-copy {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
  white-space: nowrap;
}

.result-copy:hover {
  color: var(--color-accent);
}
</style>
