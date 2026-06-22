<script setup lang="ts">
/**
 * 图片置乱/还原工具主组件。
 *
 * 顶部操作区（模式/种子/块大小 + 置乱·还原/下载/清空）+ 单一原位图片区：上传后显示原图，
 * 点「置乱」或「还原」在原位替换为处理结果（块级像素重排，尺寸恒定、完全可逆）。
 * 大图（>400 万像素）自动走 Web Worker 处理，避免阻塞主线程。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { formatBytes, checkCanvasLimits } from '../../utils/media/image-convert';
import {
  validateParams,
  scrambleImageData,
} from '../../utils/media/image-scramble';
import type {
  ScrambleMode,
  ScrambleParams,
  BlockSize,
} from '../../utils/media/image-scramble';

/** 上传文件大小上限（50MB） */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;

/** 块大小可选项 */
const blockSizeOptions: { value: number; label: string }[] = [
  { value: 2, label: '2×2' },
  { value: 4, label: '4×4' },
  { value: 8, label: '8×8' },
  { value: 16, label: '16×16' },
];

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const errorMsg = ref('');
const isProcessing = ref(false);

const mode = ref<ScrambleMode>('scramble');
const seed = ref('12345');
const blockSize = ref<number>(8);

/** 当前像素源（下一次置乱/还原的输入），尺寸自上传后恒定 */
const sourceImageData = ref<ImageData | null>(null);
/** 当前展示图的 object URL */
const displayUrl = ref('');
/** 当前展示图的状态徽标 */
const displayLabel = ref<'original' | 'scrambled' | 'restored'>('original');
/** 原图上传文件大小（体积对比基准） */
const originalSize = ref(0);
const originalName = ref('');
/** 当前展示图大小 */
const currentSize = ref(0);
const dimensions = ref<{ width: number; height: number } | null>(null);

/**
 * 派发全局 toast 通知（由 Alpine 侧 Layout 捕获并展示）。
 * @param message 通知文本
 */
function dispatchToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 当前置乱参数（由各表单控件派生） */
const params = computed<ScrambleParams>(() => ({
  seed: seed.value,
  blockSize: blockSize.value as BlockSize,
}));

const canProcess = computed(() => sourceImageData.value !== null && errorMsg.value === '');

/** 当前展示图相对原图的体积倍数（置乱后通常显著增大） */
const sizeRatio = computed(() => {
  if (!currentSize.value || !originalSize.value) return 1;
  return currentSize.value / originalSize.value;
});

/** 当前展示图的中文状态文案 */
const stateLabel = computed(() =>
  displayLabel.value === 'original' ? '原始图片' : displayLabel.value === 'scrambled' ? '已置乱' : '已还原',
);

/**
 * 校验当前参数是否合法。
 * @returns 空字符串表示合法，否则为中文错误描述
 */
function validateCurrentParams(): string {
  try {
    validateParams(params.value);
    return '';
  } catch (e) {
    return e instanceof Error ? e.message : '参数无效';
  }
}

/** 释放展示图资源并重置相关状态（不清空参数）。 */
function resetState(): void {
  if (displayUrl.value) URL.revokeObjectURL(displayUrl.value);
  displayUrl.value = '';
  sourceImageData.value = null;
  dimensions.value = null;
  originalSize.value = 0;
  originalName.value = '';
  currentSize.value = 0;
  displayLabel.value = 'original';
}

/**
 * 将 ImageData 编码为 PNG 并生成 object URL。
 * @param imageData 像素数据
 * @returns object URL 与 PNG blob 大小
 */
async function imageDataToUrl(imageData: ImageData): Promise<{ url: string; size: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG 编码失败');
  return { url: URL.createObjectURL(blob), size: blob.size };
}

/**
 * 处理上传的图片文件：校验类型/尺寸 → 解码为 ImageData 作为像素源，展示原图。
 *
 * 不自动置乱——按需求，上传后由用户显式点「置乱」。
 * @param file 用户上传或粘贴的图片文件
 */
async function processFile(file: File): Promise<void> {
  if (isProcessing.value) return;
  resetState();
  errorMsg.value = '';

  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请上传图片文件';
    return;
  }
  if (file.size > FILE_SIZE_LIMIT) {
    errorMsg.value = `图片过大（${formatBytes(file.size)}），超过 ${formatBytes(FILE_SIZE_LIMIT)} 上限`;
    return;
  }

  originalName.value = file.name;
  originalSize.value = file.size;

  try {
    const bitmap = await createImageBitmap(file);
    const limit = checkCanvasLimits(bitmap.width, bitmap.height);
    if (!limit.ok) {
      bitmap.close?.();
      errorMsg.value = limit.error!;
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    sourceImageData.value = ctx.getImageData(0, 0, canvas.width, canvas.height);
    dimensions.value = { width: canvas.width, height: canvas.height };
    displayUrl.value = URL.createObjectURL(file);
    currentSize.value = file.size;
    displayLabel.value = 'original';
  } catch {
    errorMsg.value = '图片解码失败，可能文件损坏或格式不支持';
  }
}

/**
 * 执行一次置乱/还原：校验参数 → 取像素源 → 调度算法 → 原位更新展示图。
 */
async function handleProcess(): Promise<void> {
  if (isProcessing.value) return;
  if (!sourceImageData.value) return;
  errorMsg.value = '';
  const validation = validateCurrentParams();
  if (validation) {
    errorMsg.value = validation;
    return;
  }

  isProcessing.value = true;
  try {
    const result = await processImageData(sourceImageData.value, mode.value, params.value);
    sourceImageData.value = result;
    dimensions.value = { width: result.width, height: result.height };
    const { url, size } = await imageDataToUrl(result);
    if (displayUrl.value) URL.revokeObjectURL(displayUrl.value);
    displayUrl.value = url;
    currentSize.value = size;
    displayLabel.value = mode.value === 'scramble' ? 'scrambled' : 'restored';
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '图像处理失败';
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 按尺寸阈值决定主线程直算或派发 Worker，返回处理后的像素数据。
 *
 * @param imageData 源像素数据
 * @param processMode 置乱/还原模式
 * @param processParams 置乱参数
 * @returns 处理后的像素数据
 */
async function processImageData(
  imageData: ImageData,
  processMode: ScrambleMode,
  processParams: ScrambleParams,
): Promise<ImageData> {
  const pixelCount = imageData.width * imageData.height;
  // 小图主线程直算，避免 Worker 启动开销
  if (pixelCount <= 4_000_000) {
    return scrambleImageData({ imageData, mode: processMode, params: processParams }).imageData;
  }

  const worker = new Worker(
    new URL('../../utils/media/image-scramble.worker.ts', import.meta.url),
    { type: 'module' },
  );

  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ result?: { width: number; height: number; data: Uint8ClampedArray }; error?: string }>) => {
      worker.terminate();
      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }
      const result = event.data.result!;
      resolve(new ImageData(result.data, result.width, result.height));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    // 不转移输入 buffer：结构化克隆拷贝一份给 Worker，保证失败时本地 sourceImageData 仍可用
    worker.postMessage(
      {
        imageData: { width: imageData.width, height: imageData.height, data: imageData.data },
        mode: processMode,
        params: processParams,
      },
    );
  });
}

/** 下载当前展示图 PNG，文件名带状态后缀。 */
function handleDownload(): void {
  if (!displayUrl.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const suffix =
    displayLabel.value === 'scrambled' ? 'scrambled' : displayLabel.value === 'restored' ? 'restored' : 'original';
  const a = document.createElement('a');
  a.href = displayUrl.value;
  a.download = `${baseName}-${suffix}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  dispatchToast('已开始下载');
}

/** 清空：释放资源、重置所有参数到默认值。 */
function handleClear(): void {
  resetState();
  errorMsg.value = '';
  mode.value = 'scramble';
  seed.value = '12345';
  blockSize.value = 8;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

/**
 * 全局粘贴事件处理：检测剪贴板中的图片并触发处理。
 * @param event 剪贴板事件
 */
async function handlePaste(event: ClipboardEvent): Promise<void> {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        await processFile(file);
        return;
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', handlePaste);
});

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste);
  resetState();
});
</script>

<template>
  <div class="mx-auto w-full max-w-[960px]">
    <ToolHeader
      title="图片置乱/还原"
      description="基于种子的可逆块级像素置乱，将图片分块重排为抽象效果并一键还原，输出 PNG 格式"
      :show-example="false"
    />

    <!-- 顶部操作区：参数 + 操作按钮 -->
    <div class="border border-border rounded-sm p-4 flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <OptionRadioGroup
          v-model="mode"
          :options="[
            { value: 'scramble', label: '置乱' },
            { value: 'restore', label: '还原' },
          ]"
          label="模式"
        />
        <div class="flex items-center gap-2">
          <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">种子</span>
          <input
            v-model="seed"
            type="text"
            class="px-3 py-1.5 border border-border rounded-sm text-sm w-52 bg-card text-text focus:outline-none focus:border-accent"
            placeholder="输入任意字符串"
          />
        </div>
        <OptionRadioGroup
          v-model="blockSize"
          :options="blockSizeOptions"
          label="块大小"
        />
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          :disabled="!canProcess || isProcessing"
          class="px-4 py-2 rounded-sm bg-accent text-white text-[0.8125rem] font-sans cursor-pointer transition-[filter] duration-150 hover:brightness-95 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          :aria-label="mode === 'scramble' ? '开始置乱' : '开始还原'"
          @click="handleProcess"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          {{ mode === 'scramble' ? '置乱' : '还原' }}
        </button>
        <button
          type="button"
          :disabled="!displayUrl"
          class="px-4 py-2 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="下载结果"
          @click="handleDownload"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          下载
        </button>
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <p v-if="errorMsg" class="text-[0.8125rem] text-error mt-2">{{ errorMsg }}</p>

    <!-- 单一图片区：空态为上传区，有图态为当前展示图（置乱/还原在原位替换） -->
    <div class="mt-4">
      <div
        v-if="!displayUrl"
        class="border-2 border-dashed rounded-lg p-10 min-h-[400px] flex flex-col items-center justify-center text-center cursor-pointer transition-[border-color] duration-150"
        :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
        @click="fileInputRef?.click()"
        @drop.prevent="(e) => { isDragging = false; const f = e.dataTransfer?.files?.[0]; if (f) void processFile(f); }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
      >
        <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
        <div class="text-xs text-muted mt-1">支持任意图片格式，上限 50MB</div>
      </div>

      <div v-else class="bg-hover border border-border rounded-sm p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[0.8125rem] font-medium text-muted">{{ isProcessing ? '正在处理…' : stateLabel }}</span>
          <span class="text-xs text-muted font-mono">
            {{ dimensions?.width }}×{{ dimensions?.height }} · {{ formatBytes(currentSize) }}
          </span>
        </div>
        <img
          :src="displayUrl"
          :alt="stateLabel"
          class="max-h-[480px] w-full object-contain rounded-sm bg-white"
        />
        <!-- 体积对比：置乱后像素随机化，无损 PNG 无法压缩，体积增大属正常 -->
        <div v-if="displayLabel !== 'original' && originalSize && currentSize" class="text-xs text-muted">
          原图 {{ formatBytes(originalSize) }} → 当前 {{ formatBytes(currentSize) }}
          <span class="font-mono">（{{ sizeRatio >= 1 ? sizeRatio.toFixed(1) + ' 倍' : '更小' }}）</span>
        </div>
        <p v-if="displayLabel === 'scrambled' && originalSize && sizeRatio > 1.5" class="text-xs text-muted">
          置乱后像素被打乱为随机分布，PNG 无损压缩失效，体积显著增大属正常现象，不影响还原。
        </p>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void processFile(f); }"
    />
  </div>
</template>
