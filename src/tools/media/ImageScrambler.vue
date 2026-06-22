<script setup lang="ts">
/**
 * 图片置乱/还原工具主组件。
 *
 * 提供双栏工作区：左栏上传图片、选择算法与参数、点击置乱/还原；右栏预览结果并下载 PNG。
 * 大图（>400 万像素）自动走 Web Worker 处理，避免阻塞主线程。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
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
  ScrambleAlgorithm,
  ArnoldPadding,
  ScrambleParams,
} from '../../utils/media/image-scramble';

/** 上传文件大小上限（50MB） */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const errorMsg = ref('');
const isProcessing = ref(false);

const mode = ref<ScrambleMode>('scramble');
const algorithm = ref<ScrambleAlgorithm>('arnold');
const iterations = ref(10);
const r = ref(3.99);
const x0 = ref(0.5);
const seed = ref('12345');
const padding = ref<ArnoldPadding>('expand');

const loaded = ref<ImageBitmap | null>(null);
const originalUrl = ref('');
const originalSize = ref(0);
const originalName = ref('');

const resultUrl = ref('');
const resultInfo = ref<{ width: number; height: number; size: number } | null>(null);

/**
 * 派发全局 toast 通知（由 Alpine 侧 Layout 捕获并展示）。
 * @param message 通知文本
 */
function dispatchToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 当前置乱参数（由各表单控件派生） */
const params = computed<ScrambleParams>(() => ({
  algorithm: algorithm.value,
  iterations: iterations.value,
  r: r.value,
  x0: x0.value,
  seed: seed.value,
  padding: padding.value,
}));

const showArnoldOptions = computed(() => algorithm.value === 'arnold');
const showLogisticOptions = computed(() => algorithm.value === 'logistic');
const showConfusionOptions = computed(() => algorithm.value === 'confusion');

const canProcess = computed(() => loaded.value !== null && errorMsg.value === '');

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

/**
 * 处理上传的图片文件：校验类型/尺寸 → 解码 → 触发首次置乱。
 * @param file 用户上传或粘贴的图片文件
 */
async function processFile(file: File): Promise<void> {
  if (isProcessing.value) return;
  clearResult();
  resetOriginal();
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
    loaded.value = bitmap;
    originalUrl.value = URL.createObjectURL(file);
    await handleProcess();
  } catch {
    errorMsg.value = '图片解码失败，可能文件损坏或格式不支持';
  }
}

/** 释放原始图片资源并重置相关状态。 */
function resetOriginal(): void {
  loaded.value?.close?.();
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  originalUrl.value = '';
  originalSize.value = 0;
  originalName.value = '';
  loaded.value = null;
}

/** 释放结果资源并重置相关状态。 */
function clearResult(): void {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  resultUrl.value = '';
  resultInfo.value = null;
}

/**
 * 执行一次置乱/还原：校验参数 → 取像素 → 调度算法 → 转 PNG → 更新预览。
 */
async function handleProcess(): Promise<void> {
  if (!loaded.value) return;
  errorMsg.value = '';
  const validation = validateCurrentParams();
  if (validation) {
    errorMsg.value = validation;
    return;
  }

  isProcessing.value = true;
  try {
    const result = await processInWorker(loaded.value, mode.value, params.value);
    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.putImageData(result.imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('PNG 编码失败');

    clearResult();
    resultUrl.value = URL.createObjectURL(blob);
    resultInfo.value = { width: result.width, height: result.height, size: blob.size };
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '图像处理失败';
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 将位图绘制到 canvas 取出像素，按尺寸阈值决定主线程直算或派发 Worker。
 *
 * @param bitmap 源位图
 * @param processMode 置乱/还原模式
 * @param processParams 置乱参数
 * @returns 处理后的像素数据及尺寸
 */
async function processInWorker(
  bitmap: ImageBitmap,
  processMode: ScrambleMode,
  processParams: ScrambleParams,
): Promise<{ imageData: ImageData; width: number; height: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  const pixelCount = bitmap.width * bitmap.height;
  const useWorker = pixelCount > 4_000_000;

  // 小图主线程直算，避免 Worker 启动开销
  if (!useWorker) {
    return scrambleImageData({ imageData, mode: processMode, params: processParams });
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
      resolve({ imageData: new ImageData(result.data, result.width, result.height), width: result.width, height: result.height });
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage(
      {
        imageData: { width: imageData.width, height: imageData.height, data: imageData.data },
        mode: processMode,
        params: processParams,
      },
      [imageData.data.buffer],
    );
  });
}

/** 下载当前结果 PNG，文件名带置乱/还原后缀。 */
function handleDownload(): void {
  if (!resultUrl.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const suffix = mode.value === 'scramble' ? 'scrambled' : 'restored';
  const a = document.createElement('a');
  a.href = resultUrl.value;
  a.download = `${baseName}-${suffix}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  dispatchToast('已开始下载');
}

/** 清空：释放资源、重置所有参数到默认值。 */
function handleClear(): void {
  clearResult();
  resetOriginal();
  errorMsg.value = '';
  mode.value = 'scramble';
  algorithm.value = 'arnold';
  iterations.value = 10;
  r.value = 3.99;
  x0.value = 0.5;
  seed.value = '12345';
  padding.value = 'expand';
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
  clearResult();
  resetOriginal();
});
</script>

<template>
  <div>
    <ToolHeader
      title="图片置乱/还原"
      description="通过 Arnold 变换、Logistic 混沌或快速混淆对图片进行可逆置乱，输出 PNG 格式"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #actions>
        <div class="flex items-center gap-3">
          <OptionRadioGroup
            v-model="mode"
            :options="[
              { value: 'scramble', label: '置乱' },
              { value: 'restore', label: '还原' },
            ]"
            label="模式"
          />
        </div>
      </template>

      <template #input>
        <div class="flex flex-col gap-3">
          <div class="text-[0.8125rem] font-medium text-muted">原始图片</div>

          <div
            v-if="!originalUrl"
            class="border-2 border-dashed rounded-lg p-10 min-h-[360px] flex flex-col items-center justify-center text-center cursor-pointer transition-[border-color] duration-150"
            :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
            @click="fileInputRef?.click()"
            @drop.prevent="(e) => { isDragging = false; const f = e.dataTransfer?.files?.[0]; if (f) void processFile(f); }"
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
          >
            <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
            <div class="text-xs text-muted mt-1">支持任意图片格式，上限 50MB</div>
          </div>

          <div v-else class="bg-hover border border-border rounded-sm p-3 flex flex-col gap-2">
            <img
              :src="originalUrl"
              alt="原始图片"
              class="max-h-[360px] w-full object-contain rounded-sm bg-white"
            />
            <div class="text-xs text-muted font-mono">
              {{ loaded?.width }}×{{ loaded?.height }} · {{ formatBytes(originalSize) }}
            </div>
          </div>

          <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void processFile(f); }" />
          <p v-if="errorMsg" class="text-[0.8125rem] text-error">{{ errorMsg }}</p>

          <!-- 参数面板 -->
          <div class="border border-border rounded-sm p-4 flex flex-col gap-4">
            <OptionRadioGroup
              v-model="algorithm"
              :options="[
                { value: 'arnold', label: 'Arnold 变换' },
                { value: 'logistic', label: 'Logistic 混沌' },
                { value: 'confusion', label: '快速混淆' },
              ]"
              label="算法"
            />

            <div v-if="showArnoldOptions" class="flex flex-col gap-2">
              <OptionRadioGroup
                v-model="padding"
                :options="[
                  { value: 'expand', label: '边缘外扩填充' },
                  { value: 'crop', label: '居中裁切' },
                ]"
                label="正方形处理"
              />
              <p v-if="padding === 'crop'" class="text-xs text-error">居中裁切会丢失边缘内容，还原后无法恢复原始尺寸</p>
              <p v-else class="text-xs text-muted">边缘外扩会输出正方形（带边缘填充），内容不丢失，可完整还原</p>
            </div>

            <div v-if="showLogisticOptions" class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted min-w-[72px]">控制参数 r</span>
                <input v-model.number="r" type="number" step="0.01" min="3.57" max="4.0" class="px-2 py-1 border border-border rounded-sm text-sm w-24" />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted min-w-[72px]">初始值 x₀</span>
                <input v-model.number="x0" type="number" step="0.01" min="0.01" max="0.99" class="px-2 py-1 border border-border rounded-sm text-sm w-24" />
              </div>
            </div>

            <div v-if="showConfusionOptions" class="flex items-center gap-2">
              <span class="text-[0.8125rem] text-muted min-w-[72px]">种子</span>
              <input v-model="seed" type="text" class="px-2 py-1 border border-border rounded-sm text-sm flex-1" placeholder="输入任意字符串" />
            </div>

            <div class="flex items-center gap-2">
              <span class="text-[0.8125rem] text-muted min-w-[72px]">迭代次数</span>
              <input v-model.number="iterations" type="range" min="1" max="50" step="1" class="w-32 accent-accent" />
              <span class="text-[0.8125rem] font-mono w-6">{{ iterations }}</span>
            </div>
          </div>

          <!-- ICON 操作栏 -->
          <div class="flex items-center gap-2">
            <ClearButton @clear="handleClear" />
            <button
              type="button"
              :disabled="!canProcess || isProcessing"
              class="px-4 py-2 rounded-sm bg-accent text-white text-[0.8125rem] font-sans cursor-pointer transition-[filter] duration-150 hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              @click="handleProcess"
              :aria-label="mode === 'scramble' ? '开始置乱' : '开始还原'"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              {{ mode === 'scramble' ? '置乱' : '还原' }}
            </button>
            <button
              type="button"
              :disabled="!resultUrl"
              class="px-4 py-2 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color] duration-150 hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              @click="handleDownload"
              aria-label="下载结果"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              下载
            </button>
          </div>
        </div>
      </template>

      <template #output>
        <div class="flex flex-col gap-3">
          <div class="text-[0.8125rem] font-medium text-muted">处理结果</div>

          <div v-if="resultUrl" class="bg-hover border border-border rounded-sm p-3 flex flex-col gap-2">
            <img
              :src="resultUrl"
              alt="处理结果"
              class="max-h-[360px] w-full object-contain rounded-sm bg-white"
            />
            <div class="text-xs text-muted font-mono">
              {{ resultInfo?.width }}×{{ resultInfo?.height }} · {{ resultInfo ? formatBytes(resultInfo.size) : '' }}
            </div>
          </div>

          <div v-else-if="isProcessing" class="bg-hover border border-border rounded-sm p-10 min-h-[360px] flex flex-col items-center justify-center text-center text-muted text-sm">
            正在处理…
          </div>

          <div v-else class="bg-hover border border-border rounded-sm p-10 min-h-[360px] flex flex-col items-center justify-center text-center text-muted text-sm">
            上传图片并点击置乱/还原后预览结果
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
