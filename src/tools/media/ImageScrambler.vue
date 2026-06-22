<script setup lang="ts">
/**
 * 图片混淆工具主组件。
 *
 * 顶部操作区（块大小 + 混淆/还原/下载/清空）+ 单一原位图片区：上传后显示原图，
 * 点「混淆」或「还原」在原位替换为处理结果（块级像素重排，尺寸恒定、完全可逆）。
 * 大图（>400 万像素）自动走 Web Worker 处理，避免阻塞主线程。
 *
 * 参数自动管理：置乱时用 `crypto.randomUUID()` 自动生成种子，并把还原所需的全部参数
 * （种子 + 块大小）双写到 PNG `tEXt` 块和下载文件名；上传含参数的图片时自动识别并一键
 * 还原（tEXt 优先，文件名兜底）。
 */
import { ref, computed, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import FileDropzone from '../../components/ui/FileDropzone.vue';
import { formatBytes } from '../../utils/shared/format';
import { checkCanvasLimits } from '../../utils/media/image-convert';
import {
  validateParams,
  scrambleImageData,
} from '../../utils/media/image-scramble';
import type {
  ScrambleMode,
  ScrambleParams,
  BlockSize,
} from '../../utils/media/image-scramble';
import {
  generateSeed,
  encodeParams,
  encodeFilename,
  decodeFilename,
  readScrambleMetaFromPng,
  PARAMS_KEY,
} from '../../utils/media/scramble-meta';
import { isPng, writeTextChunk } from '../../utils/media/png-metadata';

/** 上传文件大小上限（50MB） */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;

/** 块大小可选项 */
const blockSizeOptions: { value: number; label: string }[] = [
  { value: 2, label: '2×2' },
  { value: 4, label: '4×4' },
  { value: 8, label: '8×8' },
  { value: 16, label: '16×16' },
  { value: 32, label: '32×32' },
  { value: 64, label: '64×64' },
  { value: 128, label: '128×128' },
];

/** 当前通过 FileDropzone 选中的文件 */
const selectedFile = ref<File | null>(null);
const errorMsg = ref('');
const isProcessing = ref(false);

/**
 * 当前种子（内部状态，不对用户展示）。混淆时若为空则自动生成（`generateSeed()`）；
 * 上传含元数据的图片时由 `processFile` 回填。全程自动管理，用户无需感知。
 */
const seed = ref('');
const blockSize = ref<number>(8);

/** 当前像素源（下一次置乱/还原的输入），尺寸自上传后恒定 */
const sourceImageData = ref<ImageData | null>(null);
/** 当前展示图的 object URL */
const displayUrl = ref('');
/** 当前展示图的状态徽标 */
const displayLabel = ref<'original' | 'scrambled' | 'restored'>('original');
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

/** 当前展示图的中文状态文案 */
const stateLabel = computed(() =>
  displayLabel.value === 'original' ? '原始图片' : displayLabel.value === 'scrambled' ? '已混淆' : '已还原',
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
  originalName.value = '';
  currentSize.value = 0;
  displayLabel.value = 'original';
}

/**
 * 将 ImageData 编码为 PNG 并生成 object URL。
 *
 * @param imageData 像素数据
 * @param options.embed 是否把置乱参数写入 PNG tEXt 块（仅置乱结果为 true）
 * @param options.seed 用于嵌入的种子（embed=true 时必填）
 * @param options.blockSize 用于嵌入的块大小（embed=true 时必填）
 * @returns object URL 与 PNG blob 大小
 */
async function imageDataToUrl(
  imageData: ImageData,
  options: { embed: boolean; seed?: string; blockSize?: BlockSize } = { embed: false },
): Promise<{ url: string; size: number }> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG 编码失败');

  // 不嵌入：原图 / 还原结果直接返回
  if (!options.embed) {
    return { url: URL.createObjectURL(blob), size: blob.size };
  }

  // 嵌入：toBlob 产出的 PNG → arrayBuffer → 注入 tEXt → 重新封装 Blob
  const seed = options.seed;
  const blockSize = options.blockSize;
  // 调用方约定：embed=true 时必传 seed/blockSize；防御性兜底
  if (!seed || blockSize == null) {
    return { url: URL.createObjectURL(blob), size: blob.size };
  }
  try {
    const buf = await blob.arrayBuffer();
    const encoded = writeTextChunk(buf, PARAMS_KEY, encodeParams(seed, blockSize));
    const embeddedBlob = new Blob([encoded], { type: 'image/png' });
    return { url: URL.createObjectURL(embeddedBlob), size: embeddedBlob.size };
  } catch {
    // 元数据注入失败：降级用未嵌入 blob，提示用户保留完整文件名兜底还原
    dispatchToast('元数据写入失败，请保留完整下载文件名以便还原');
    return { url: URL.createObjectURL(blob), size: blob.size };
  }
}

/**
 * 处理上传的图片文件：校验类型/尺寸 → 识别置乱参数 → 解码为 ImageData 作为像素源 →
 * 展示原图（或已置乱图）。
 *
 * 参数识别优先级：PNG tEXt > 文件名 > 无（当新图）。
 * - 命中参数：回填 blockSize/seed 并自动调用 `runProcess('restore')`，
 *   把上传的已置乱图当作 source 跑一次还原，完成后提示「已识别参数并自动还原」。
 * - 未命中：当新图处理，清空 seed（待用户点「置乱」时生成），不自动置乱。
 *
 * @param file 用户上传或粘贴的图片文件
 */
async function processFile(file: File): Promise<void> {
  if (isProcessing.value) return;
  resetState();
  errorMsg.value = '';

  // FileDropzone 已在抛出前校验类型与大小；此处仅做防御性断言。
  originalName.value = file.name;

  // 识别置乱参数：tEXt 优先，文件名兜底
  const buf = await file.arrayBuffer();
  const meta = isPng(buf) ? readScrambleMetaFromPng(buf) : null;
  const fallback = decodeFilename(file.name);
  const detected = meta ?? fallback;

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
  } catch {
    errorMsg.value = '图片解码失败，可能文件损坏或格式不支持';
    return;
  }

  if (detected) {
    // 命中参数：回填并自动还原（把上传的已置乱图当 source）
    blockSize.value = detected.blockSize;
    seed.value = detected.seed;
    displayLabel.value = 'scrambled';
    await runProcess('restore');
    dispatchToast('已识别参数并自动还原');
  } else {
    // 未命中：当新图处理，清空 seed（置乱时自动生成）
    seed.value = '';
    displayLabel.value = 'original';
  }
}

/**
 * 执行一次置乱或还原：校验参数 → 取像素源 → 调度算法 → 原位更新展示图。
 * @param processMode 置乱或还原模式
 */
async function runProcess(processMode: ScrambleMode): Promise<void> {
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
    const result = await processImageData(sourceImageData.value, processMode, params.value);
    sourceImageData.value = result;
    dimensions.value = { width: result.width, height: result.height };
    // 仅置乱结果嵌入参数（还原/原图不需要元数据）
    const { url, size } =
      processMode === 'scramble'
        ? await imageDataToUrl(result, {
            embed: true,
            seed: seed.value,
            blockSize: blockSize.value as BlockSize,
          })
        : await imageDataToUrl(result);
    if (displayUrl.value) URL.revokeObjectURL(displayUrl.value);
    displayUrl.value = url;
    currentSize.value = size;
    displayLabel.value = processMode === 'scramble' ? 'scrambled' : 'restored';
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '图像处理失败';
  } finally {
    isProcessing.value = false;
  }
}

/** 对当前展示图执行置乱，并在原位更新为结果。进入时若无种子则自动生成。 */
function handleScramble(): void {
  if (!seed.value) seed.value = generateSeed();
  void runProcess('scramble');
}

/** 对当前展示图执行还原，并在原位更新为结果。未检测到种子时静默不执行。 */
function handleRestore(): void {
  if (!seed.value) return;
  void runProcess('restore');
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

/**
 * 下载当前展示图 PNG。
 *
 * 文件名规则：
 * - 置乱态：用 `encodeFilename` 内嵌完整种子与块大小（tEXt 被剥离时的还原兜底）。
 * - 还原/原图：维持状态后缀。
 */
function handleDownload(): void {
  if (!displayUrl.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const fileName =
    displayLabel.value === 'scrambled'
      ? `${encodeFilename(baseName, seed.value, blockSize.value as BlockSize)}.png`
      : `${baseName}-${displayLabel.value === 'restored' ? 'restored' : 'original'}.png`;
  const a = document.createElement('a');
  a.href = displayUrl.value;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  dispatchToast('已开始下载');
}

/** 清空：释放资源、重置所有参数到默认值（种子清空，等待下次混淆时自动生成）。 */
function handleClear(): void {
  resetState();
  errorMsg.value = '';
  seed.value = '';
  blockSize.value = 8;
}

onUnmounted(() => {
  resetState();
});
</script>

<template>
  <div class="mx-auto w-full max-w-[960px]">
    <ToolHeader
      title="图片混淆"
      description="可逆块级像素混淆，将图片分块重排为抽象效果并一键还原，输出 PNG 格式"
      :show-example="false"
    />

    <!-- 顶部操作区：参数 + 操作按钮 -->
    <div class="border border-border rounded-sm p-4 flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
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
          aria-label="开始混淆"
          @click="handleScramble"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          混淆
        </button>
        <button
          type="button"
          :disabled="!canProcess || isProcessing"
          class="px-4 py-2 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="开始还原"
          @click="handleRestore"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          还原
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
      </div>
    </div>

    <p v-if="errorMsg" class="text-[0.8125rem] text-error mt-2">{{ errorMsg }}</p>

    <!-- 单一图片区：FileDropzone 内部只放图片预览，元信息放在外部 -->
    <div class="mt-4 flex flex-col gap-3">
      <FileDropzone
        v-model="selectedFile"
        accept="image/*"
        :max-size="FILE_SIZE_LIMIT"
        enable-drag
        enable-paste
        clearable
        @select="(f) => void processFile(f)"
        @clear="handleClear"
        @error="(msg) => errorMsg = msg"
      >
        <template #default>
          <div class="flex flex-col items-center justify-center text-center">
            <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
            <div class="text-xs text-muted mt-1">支持任意图片格式，上限 50MB</div>
          </div>
        </template>

        <template #file="{ file }">
          <div v-if="displayUrl" class="relative flex items-center justify-center rounded-sm bg-white w-full">
            <img
              :src="displayUrl"
              :alt="stateLabel"
              class="max-h-[480px] w-full object-contain rounded-sm"
            />
          </div>
        </template>
      </FileDropzone>

      <!-- 当前图片状态 -->
      <div v-if="displayUrl" class="flex items-center gap-2 text-sm">
        <span class="text-muted">状态</span>
        <span
          class="px-2 py-0.5 rounded-sm text-[0.8125rem] font-medium"
          :class="
            displayLabel === 'original'
              ? 'bg-card border border-border text-text'
              : displayLabel === 'scrambled'
                ? 'bg-accent/10 border border-accent/30 text-accent'
                : 'bg-success/10 border border-success/30 text-success'
          "
        >
          {{ isProcessing ? '正在处理…' : stateLabel }}
        </span>
      </div>

      <!-- 文件元信息区：放在 FileDropzone 外部，点击图片不会触发选择器 -->
      <div v-if="displayUrl" class="flex flex-col gap-1.5 text-xs text-muted">
        <div class="font-medium text-text break-all">{{ originalName }}</div>
        <div class="font-mono">{{ dimensions?.width }}×{{ dimensions?.height }}</div>
        <div class="font-mono">{{ formatBytes(currentSize) }}</div>
      </div>
    </div>
  </div>
</template>
