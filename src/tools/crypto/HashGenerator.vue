<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import { computeHash, computeFileHash, HASH_ALGORITHMS, type HashAlgorithm } from '../../utils/crypto/hash';
import { formatFileSize } from '../../utils/encoding/base64';

const inputText = ref('Hello, DevTools!');
const selectedAlgorithms = ref<HashAlgorithm[]>([...HASH_ALGORITHMS]);
const outputFormat = ref<'hex' | 'hexUpper' | 'base64'>('base64');
const results = ref<Record<string, string>>({});
const errorMsg = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileData = ref<ArrayBuffer | null>(null);
const fileMeta = ref<{ name: string; mime: string; size: string } | null>(null);
const isDragging = ref(false);
const isProcessing = ref(false);

/** 是否有计算结果 */
const hasResults = computed(() => Object.keys(results.value).length > 0);

/** 全部结果文本，用于批量复制 */
const allResultsText = computed(() =>
  Object.entries(results.value)
    .map(([algo, hash]) => `${algo}: ${hash}`)
    .join('\n'),
);

/**
 * 切换算法的选中状态
 * @param algo - 要切换的哈希算法
 */
function toggleAlgorithm(algo: HashAlgorithm) {
  const idx = selectedAlgorithms.value.indexOf(algo);
  if (idx >= 0) {
    selectedAlgorithms.value.splice(idx, 1);
  } else {
    selectedAlgorithms.value.push(algo);
  }
}

/**
 * 核心计算函数：根据当前输入和选中的算法计算哈希值。
 * 文本和文件优先取文件数据，空输入时静默返回。
 */
async function computeHashes() {
  errorMsg.value = '';
  results.value = {};

  const hasText = inputText.value.trim();
  const hasFile = !!fileData.value;

  if (!hasText && !hasFile) return;
  if (selectedAlgorithms.value.length === 0) {
    errorMsg.value = '请至少选择一种哈希算法';
    return;
  }

  isProcessing.value = true;
  try {
    const newResults: Record<string, string> = {};
    for (const algo of selectedAlgorithms.value) {
      if (hasFile && fileData.value) {
        const result = await computeFileHash(fileData.value, algo);
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

/** 处理文件拖拽放置 */
function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) processFile(file);
}

/** 处理文件选择框变更 */
function handleFileInput(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) processFile(file);
}

/**
 * 读取文件并缓存 ArrayBuffer，触发 watcher 自动计算哈希
 * @param file - 用户选择的文件
 */
async function processFile(file: File) {
  errorMsg.value = '';
  fileMeta.value = {
    name: file.name,
    mime: file.type || '未知类型',
    size: formatFileSize(file.size),
  };
  try {
    fileData.value = await file.arrayBuffer();
  } catch {
    errorMsg.value = '读取文件时出错';
    fileData.value = null;
  }
}

/** 清除文件相关状态 */
function clearFile() {
  fileData.value = null;
  fileMeta.value = null;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

/** 清空所有输入和结果 */
function handleClear() {
  inputText.value = '';
  clearFile();
  results.value = {};
  errorMsg.value = '';
}

// 监听输入变化，自动触发哈希计算
watch(
  [inputText, fileData, selectedAlgorithms, outputFormat],
  () => {
    computeHashes();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="哈希生成器"
      description="支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制"
      :show-example="false"
    />

    <!-- 文本输入 -->
    <div class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入文本</label>
      <textarea
        v-model="inputText"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
        rows="4"
        placeholder="输入要计算哈希的文本"
        @input="clearFile()"
      ></textarea>
    </div>

    <!-- 文件上传拖拽区域 -->
    <div class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">或上传文件</label>
      <div
        class="border-dashed border-2 border-border rounded-md p-5 text-center cursor-pointer hover:border-accent hover:bg-hover transition-[border-color,background-color] duration-150"
        :class="{ 'border-accent bg-hover': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="fileInputRef?.click()"
      >
        <input ref="fileInputRef" type="file" class="hidden" @change="handleFileInput" />
        <template v-if="fileMeta">
          <span class="text-[0.8125rem] text-text">📄 {{ fileMeta.name }} · {{ fileMeta.mime }} · {{ fileMeta.size }}</span>
        </template>
        <template v-else>
          <span class="text-muted text-sm">拖拽文件到这里或点击选择</span>
        </template>
      </div>
    </div>

    <!-- 算法选择 -->
    <div class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">哈希算法</label>
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="algo in HASH_ALGORITHMS"
          :key="algo"
          :class="[
            'px-3 py-1.5 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
            'transition-[background-color,border-color] duration-150',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
            selectedAlgorithms.includes(algo)
              ? 'bg-accent border-accent text-white'
              : 'bg-surface border-border text-text hover:bg-hover hover:border-accent',
          ]"
          :aria-pressed="selectedAlgorithms.includes(algo)"
          @click="toggleAlgorithm(algo)"
        >
          {{ algo }}
        </button>
      </div>
    </div>

    <!-- 输出格式 -->
    <div class="mb-4">
      <SelectListbox
        v-model="outputFormat"
        label="输出格式"
        :options="[
          { value: 'hex', label: '小写 Hex' },
          { value: 'hexUpper', label: '大写 HEX' },
          { value: 'base64', label: 'Base64' },
        ]"
      />
    </div>

    <!-- 结果区域（始终可见） -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">计算结果</span>
        <div class="flex gap-2">
          <CopyButton v-if="hasResults" :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!hasResults && !errorMsg && !isProcessing"
        class="border border-border rounded-md p-6 bg-card text-center text-muted text-sm"
      >
        输入文本或上传文件后自动计算哈希值
      </div>

      <!-- 计算中 -->
      <div
        v-if="isProcessing"
        class="border border-border rounded-md p-4 bg-card text-center text-muted text-sm"
      >
        计算中...
      </div>

      <!-- 错误信息 -->
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>

      <!-- 结果列表 -->
      <div v-if="hasResults" class="border border-border rounded-md bg-card">
        <div
          v-for="(hash, algo) in results"
          :key="algo"
          class="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-b-0"
        >
          <span class="text-xs font-semibold text-accent min-w-[60px]">{{ algo }}</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ hash }}</code>
          <CopyButton :text="hash" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>
