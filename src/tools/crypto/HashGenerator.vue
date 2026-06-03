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

function toggleAlgorithm(algo: HashAlgorithm) {
  const idx = selectedAlgorithms.value.indexOf(algo);
  if (idx >= 0) {
    selectedAlgorithms.value.splice(idx, 1);
  } else {
    selectedAlgorithms.value.push(algo);
  }
}

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

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    fileName.value = file.name;
    inputText.value = '';
  }
}

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
  <div class="max-w-[720px]">
    <ToolHeader
      title="哈希生成器"
      description="支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制"
      @example="handleExample"
    />

    <div class="mb-4">
      <div class="mb-2">
        <label class="field-label">输入文本</label>
        <textarea
          v-model="inputText"
          class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="4"
          placeholder="输入要计算哈希的文本"
          @input="clearFile()"
        ></textarea>
      </div>
      <div>
        <label class="field-label">或上传文件</label>
        <div class="flex items-center gap-2">
          <input ref="fileInputRef" type="file" class="text-[0.8125rem]" @change="handleFileChange" />
          <span v-if="fileName" class="text-[0.8125rem] text-muted">{{ fileName }}</span>
        </div>
      </div>
    </div>

    <div class="flex items-start gap-6 mb-4 flex-wrap">
      <div class="flex flex-col gap-1">
        <label class="field-label">哈希算法</label>
        <div class="flex gap-4 flex-wrap">
          <label v-for="algo in HASH_ALGORITHMS" :key="algo" class="flex items-center gap-1 text-[0.8125rem] cursor-pointer">
            <input type="checkbox" :checked="selectedAlgorithms.includes(algo)" @change="toggleAlgorithm(algo)" />
            {{ algo }}
          </label>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label">输出格式</label>
        <select v-model="outputFormat" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans outline-none cursor-pointer focus:border-accent">
          <option value="hex">小写 Hex</option>
          <option value="hexUpper">大写 HEX</option>
          <option value="base64">Base64</option>
        </select>
      </div>
    </div>

    <div class="mb-4">
      <button class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isProcessing" @click="compute">
        {{ isProcessing ? '计算中...' : '计算哈希' }}
      </button>
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <div v-if="Object.keys(results).length">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">计算结果</span>
        <div class="flex gap-2">
          <CopyButton :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="border border-border rounded-md p-4 bg-card">
        <div v-for="(hash, algo) in results" :key="algo" class="flex items-center gap-4 py-2 border-b border-border last:border-b-0">
          <span class="text-xs font-semibold text-accent min-w-[60px]">{{ algo }}</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ hash }}</code>
          <CopyButton :text="hash" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>
