<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { computeHash, computeFileHash, HASH_ALGORITHMS, type HashAlgorithm } from '../../utils/crypto/hash';

const inputText = ref('');
const selectedAlgorithms = ref<HashAlgorithm[]>(['MD5', 'SHA-256']);
const outputFormat = ref<'hex' | 'hexUpper' | 'base64'>('hex');
const results = ref<Record<string, string>>({});
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const isProcessing = ref(false);

/** 切换算法选中状态 */
function toggleAlgorithm(algo: HashAlgorithm) {
  const idx = selectedAlgorithms.value.indexOf(algo);
  if (idx >= 0) {
    selectedAlgorithms.value.splice(idx, 1);
  } else {
    selectedAlgorithms.value.push(algo);
  }
}

/** 执行哈希计算 */
async function compute() {
  errorMsg.value = '';
  if (!inputText.value && !fileName.value) {
    errorMsg.value = '请输入文本或上传文件';
    return;
  }
  if (selectedAlgorithms.value.length === 0) {
    errorMsg.value = '请至少选择一种哈希算法';
    return;
  }

  isProcessing.value = true;
  try {
    const newResults: Record<string, string> = {};
    for (const algo of selectedAlgorithms.value) {
      if (fileName.value && fileInputRef.value?.files?.[0]) {
        const buffer = await fileInputRef.value.files[0].arrayBuffer();
        const result = await computeFileHash(buffer, algo);
        newResults[algo] = result[outputFormat.value];
      } else {
        const result = await computeHash(inputText.value, algo);
        newResults[algo] = result[outputFormat.value];
      }
    }
    results.value = newResults;
  } catch {
    errorMsg.value = '计算哈希时出错，请检查输入';
  } finally {
    isProcessing.value = false;
  }
}

/** 处理文件选择 */
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    fileName.value = file.name;
    inputText.value = '';
  }
}

/** 清空文件输入 */
function clearFile() {
  fileName.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

function handleExample() {
  inputText.value = 'Hello, DevTools!';
  fileName.value = '';
  clearFile();
  selectedAlgorithms.value = ['MD5', 'SHA-256'];
  outputFormat.value = 'hex';
  compute();
}

function handleClear() {
  inputText.value = '';
  results.value = {};
  errorMsg.value = '';
  clearFile();
}

const allResultsText = computed(() =>
  Object.entries(results.value)
    .map(([algo, hash]) => `${algo}: ${hash}`)
    .join('\n'),
);
</script>

<template>
  <div class="hash-tool">
    <ToolHeader
      title="哈希生成器"
      description="支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制"
      @example="handleExample"
    />

    <div class="hash-input-section">
      <div class="input-group">
        <label class="field-label">输入文本</label>
        <textarea
          v-model="inputText"
          class="field-textarea"
          rows="4"
          placeholder="输入要计算哈希的文本"
          @input="clearFile()"
        ></textarea>
      </div>
      <div class="file-upload-group">
        <label class="field-label">或上传文件</label>
        <div class="file-upload-row">
          <input
            ref="fileInputRef"
            type="file"
            class="file-input"
            @change="handleFileChange"
          />
          <span v-if="fileName" class="file-name">{{ fileName }}</span>
        </div>
      </div>
    </div>

    <div class="hash-controls">
      <div class="algorithm-group">
        <label class="field-label">哈希算法</label>
        <div class="checkbox-row">
          <label v-for="algo in HASH_ALGORITHMS" :key="algo" class="checkbox-label">
            <input
              type="checkbox"
              :checked="selectedAlgorithms.includes(algo)"
              @change="toggleAlgorithm(algo)"
            />
            {{ algo }}
          </label>
        </div>
      </div>
      <div class="format-group">
        <label class="field-label">输出格式</label>
        <select v-model="outputFormat" class="field-select">
          <option value="hex">小写 Hex</option>
          <option value="hexUpper">大写 HEX</option>
          <option value="base64">Base64</option>
        </select>
      </div>
    </div>

    <div class="hash-actions">
      <button class="btn-primary" :disabled="isProcessing" @click="compute">
        {{ isProcessing ? '计算中...' : '计算哈希' }}
      </button>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="Object.keys(results).length" class="hash-output">
      <div class="output-header">
        <span class="output-label">计算结果</span>
        <div class="output-actions">
          <CopyButton :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="results-area">
        <div v-for="(hash, algo) in results" :key="algo" class="result-row">
          <span class="result-algo">{{ algo }}</span>
          <code class="result-value">{{ hash }}</code>
          <CopyButton :text="hash" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hash-tool {
  max-width: 720px;
}

.hash-input-section {
  margin-bottom: var(--space-md);
}

.input-group {
  margin-bottom: var(--space-sm);
}

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

.file-upload-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.file-upload-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.file-input {
  font-size: 0.8125rem;
}

.file-name {
  font-size: 0.8125rem;
  color: var(--color-muted);
}

.hash-controls {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.algorithm-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.checkbox-row {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8125rem;
  cursor: pointer;
}

.format-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.hash-actions {
  margin-bottom: var(--space-md);
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
  background-color: var(--color-card);
}

.result-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-algo {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  min-width: 60px;
}

.result-value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
}
</style>
