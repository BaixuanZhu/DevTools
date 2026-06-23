<script setup lang="ts">
/**
 * 幻影坦克工具主组件。
 *
 * 上传两张图（图A 表图 / 图B 里图）→ 合成一张透明 PNG：白底显示图A、黑底显示图B。
 *
 * 交互：
 * - 双 FileDropzone 分别上传图A/图B，各自解码缓存 ImageBitmap 并生成预览 URL。
 * - 两图就绪后点「生成」：取两图较小公共尺寸、各自中心裁剪对齐（不缩放）→ 逐像素合成。
 * - 结果区单预览 + 「白底 / 黑底 / 棋盘格」背景切换：透明 PNG 经浏览器原生 alpha 合成，
 *   即呈现对应背景下的双重显示效果。
 * - 大图（>400 万像素）自动走 Web Worker，避免阻塞主线程。
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import FileDropzone from '../../components/ui/FileDropzone.vue';
import { formatBytes } from '../../utils/shared/format';
import { checkCanvasLimits } from '../../utils/media/image-convert';
import { createPhantomTank, generateSurfaceFromHidden } from '../../utils/media/phantom-tank';

/** 上传文件大小上限（50MB） */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;
/** 主线程直算的像素数阈值，超过则派发 Worker */
const WORKER_PIXEL_THRESHOLD = 4_000_000;

/** 预览背景模式 */
type BgMode = 'white' | 'black' | 'checker';

/** 背景切换可选项 */
const bgOptions: { value: BgMode; label: string }[] = [
  { value: 'white', label: '白底' },
  { value: 'black', label: '黑底' },
  { value: 'checker', label: '棋盘格' },
];

/** 图A（表图）受控文件与解码产物 */
const surfaceFile = ref<File | null>(null);
const surfaceBitmap = ref<ImageBitmap | null>(null);
const surfacePreviewUrl = ref('');

/** 图B（里图）受控文件与解码产物 */
const hiddenFile = ref<File | null>(null);
const hiddenBitmap = ref<ImageBitmap | null>(null);
const hiddenPreviewUrl = ref('');

/** 合成结果 */
const resultUrl = ref('');
const resultSize = ref(0);
const dimensions = ref<{ width: number; height: number } | null>(null);

/** 预览背景，默认棋盘格以直观看清透明区域 */
const bgMode = ref<BgMode>('checker');
const isProcessing = ref(false);
const errorMsg = ref('');

/** 表图来源：manual 手动上传 / auto 自动生成 / null 未设置 */
type SurfaceSource = 'manual' | 'auto' | null;
const surfaceSource = ref<SurfaceSource>(null);
/** 里图暗化滑块值 0-80（百分比），实际 d = 值/100 */
const darken = ref(30);
/** 暗化系数（滑块值/100），generateAutoSurface 与 watch 共用 */
const darkenFactor = computed(() => darken.value / 100);
/** 里图原图整图像素缓存，作为自动生成表图的输入 */
const hiddenImageData = ref<ImageData | null>(null);
/** 自动生成的表图/暗化里图像素缓存，auto 合成输入 */
const autoSurface = ref<ImageData | null>(null);
const autoHidden = ref<ImageData | null>(null);

/** 滑块防抖句柄，避免拖动时高频重算 */
let darkenTimer: ReturnType<typeof setTimeout> | null = null;
/** 滑块仅在表图为 auto 来源时启用 */
const sliderDisabled = computed(() => surfaceSource.value !== 'auto');

/**
 * 暗化滑块联动：auto 来源下防抖重算表图；manual 时滑块已禁用，不触发。
 */
watch(darken, () => {
  if (surfaceSource.value !== 'auto') return;
  if (darkenTimer) clearTimeout(darkenTimer);
  darkenTimer = setTimeout(() => {
    darkenTimer = null;
    void generateAutoSurface();
  }, 150);
});

/** 两图是否均已就绪，可否生成 */
const canGenerate = computed(() => {
  if (isProcessing.value) return false;
  if (!hiddenBitmap.value) return false;
  // auto 模式：表图已自动生成（autoSurface 就绪）即可合成；manual 模式需手动上传的表图位图
  if (surfaceSource.value === 'auto') return autoSurface.value !== null;
  return surfaceBitmap.value !== null;
});

/**
 * 派发全局 toast 通知（由 Alpine 侧 Layout 捕获并展示）。
 * @param message 通知文本
 */
function dispatchToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/**
 * 预览容器样式：根据背景模式返回纯色或棋盘格背景。
 * 透明 PNG 置于该容器上，由浏览器原生 alpha 合成呈现双重显示效果。
 */
const previewStyle = computed(() => {
  if (bgMode.value === 'white') return { backgroundColor: '#ffffff' };
  if (bgMode.value === 'black') return { backgroundColor: '#000000' };
  return {
    backgroundColor: '#ffffff',
    backgroundImage:
      'linear-gradient(45deg, #d4d4d4 25%, transparent 25%), linear-gradient(-45deg, #d4d4d4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d4 75%), linear-gradient(-45deg, transparent 75%, #d4d4d4 75%)',
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  };
});

/** 释放合成结果相关资源并重置（不清空已上传的图）。 */
function clearResult(): void {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  resultUrl.value = '';
  resultSize.value = 0;
  dimensions.value = null;
}

/**
 * 解码图片文件为 ImageBitmap，失败抛中文错误。
 * @param file 图片文件
 */
async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error('图片解码失败，可能文件损坏或格式不支持');
  }
}

/**
 * 处理图A 上传：生成预览 URL、解码缓存位图。任一图变更时清除上一次合成结果。
 * @param file 图A 文件
 */
async function handleSurfaceSelect(file: File): Promise<void> {
  clearResult();
  errorMsg.value = '';
  surfaceSource.value = 'manual'; // 手动上传覆盖 auto 预览
  if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
  surfacePreviewUrl.value = URL.createObjectURL(file);
  try {
    if (surfaceBitmap.value) surfaceBitmap.value.close?.();
    surfaceBitmap.value = await decodeBitmap(file);
  } catch (e) {
    surfaceBitmap.value = null;
    surfaceSource.value = null;
    if (surfacePreviewUrl.value) {
      URL.revokeObjectURL(surfacePreviewUrl.value);
      surfacePreviewUrl.value = '';
    }
    errorMsg.value = e instanceof Error ? e.message : '图片解码失败';
  }
}

/** 处理图B 上传，逻辑同 {@link handleSurfaceSelect}。 */
async function handleHiddenSelect(file: File): Promise<void> {
  clearResult();
  errorMsg.value = '';
  if (hiddenPreviewUrl.value) URL.revokeObjectURL(hiddenPreviewUrl.value);
  hiddenPreviewUrl.value = URL.createObjectURL(file);
  try {
    if (hiddenBitmap.value) hiddenBitmap.value.close?.();
    hiddenBitmap.value = await decodeBitmap(file);
    // 缓存里图原图整图像素（不裁剪，auto 单图无对齐问题）
    hiddenImageData.value = cropCenterToImageData(
      hiddenBitmap.value,
      hiddenBitmap.value.width,
      hiddenBitmap.value.height,
    );
    // 自动生成一次反相表图预览，让用户打开即可见效果
    await generateAutoSurface();
  } catch (e) {
    hiddenBitmap.value = null;
    hiddenImageData.value = null;
    if (hiddenPreviewUrl.value) {
      URL.revokeObjectURL(hiddenPreviewUrl.value);
      hiddenPreviewUrl.value = '';
    }
    errorMsg.value = e instanceof Error ? e.message : '图片解码失败';
  }
}

/** 清除图A：释放位图与预览 URL，并清除合成结果。 */
function handleSurfaceClear(): void {
  if (surfaceBitmap.value) surfaceBitmap.value.close?.();
  surfaceBitmap.value = null;
  if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
  surfacePreviewUrl.value = '';
  surfaceFile.value = null;
  surfaceSource.value = null;
  autoSurface.value = null;
  autoHidden.value = null;
  clearResult();
}

/** 清除图B，逻辑同 {@link handleSurfaceClear}。 */
function handleHiddenClear(): void {
  if (hiddenBitmap.value) hiddenBitmap.value.close?.();
  hiddenBitmap.value = null;
  if (hiddenPreviewUrl.value) URL.revokeObjectURL(hiddenPreviewUrl.value);
  hiddenPreviewUrl.value = '';
  hiddenFile.value = null;
  hiddenImageData.value = null;
  autoSurface.value = null;
  autoHidden.value = null;
  // 里图没了，auto 表图失效，一并清掉
  if (surfaceSource.value === 'auto') {
    if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
    surfacePreviewUrl.value = '';
    surfaceFile.value = null;
    surfaceSource.value = null;
  }
  clearResult();
}

/**
 * 将位图从中心裁剪到目标尺寸的 ImageData（不缩放，保像素清晰）。
 * @param bitmap 源位图
 * @param targetW 目标宽
 * @param targetH 目标高
 */
function cropCenterToImageData(bitmap: ImageBitmap, targetW: number, targetH: number): ImageData {
  const sx = Math.floor((bitmap.width - targetW) / 2);
  const sy = Math.floor((bitmap.height - targetH) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
  // 9 参数 drawImage：源区域 (sx,sy,targetW,targetH) → 目标 (0,0,targetW,targetH)，等比无缩放
  ctx.drawImage(bitmap, sx, sy, targetW, targetH, 0, 0, targetW, targetH);
  return ctx.getImageData(0, 0, targetW, targetH);
}

/**
 * 从里图原图生成自动表图 + 暗化里图，并把表图预览填充到表图区。
 *
 * 将 surface 画到 canvas 编码为 PNG Blob，包装成 File 赋给 surfaceFile，
 * 使现有 FileDropzone 无需改造即可显示预览与删除。来源标记为 'auto'。
 */
async function generateAutoSurface(): Promise<void> {
  const imgData = hiddenImageData.value;
  if (!imgData) return;
  errorMsg.value = '';
  try {
    const { surface, hidden } = generateSurfaceFromHidden({
      imageData: imgData,
      darken: darkenFactor.value,
    });
    autoSurface.value = surface;
    autoHidden.value = hidden;

    const canvas = document.createElement('canvas');
    canvas.width = surface.width;
    canvas.height = surface.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.putImageData(surface, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('表图编码失败');

    if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
    surfacePreviewUrl.value = URL.createObjectURL(blob);
    // 包装 File 让 FileDropzone 的 hasFile/预览/删除正常工作；auto 合成不依赖此 File
    surfaceFile.value = new File([blob], 'auto-surface.png', { type: 'image/png' });
    surfaceSource.value = 'auto';
    clearResult();
  } catch (e) {
    autoSurface.value = null;
    autoHidden.value = null;
    surfaceSource.value = null;
    errorMsg.value = e instanceof Error ? e.message : '自动表图生成失败';
  }
}

/**
 * 按像素阈值决定主线程直算或派发 Worker，返回合成后的像素数据。
 * @param imageDataA 图A 像素
 * @param imageDataB 图B 像素
 */
async function processImageData(imageDataA: ImageData, imageDataB: ImageData): Promise<ImageData> {
  const pixelCount = imageDataA.width * imageDataA.height;
  // 小图主线程直算，避免 Worker 启动开销
  if (pixelCount <= WORKER_PIXEL_THRESHOLD) {
    return createPhantomTank({ imageDataA, imageDataB });
  }

  const worker = new Worker(
    new URL('../../utils/media/phantom-tank.worker.ts', import.meta.url),
    { type: 'module' },
  );

  return new Promise((resolve, reject) => {
    worker.onmessage = (
      event: MessageEvent<{
        result?: { width: number; height: number; data: Uint8ClampedArray };
        error?: string;
      }>,
    ) => {
      worker.terminate();
      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }
      const result = event.data.result!;
      // lib.dom 将 ImageDataArray 限定为 Uint8ClampedArray<ArrayBuffer>；
      // Worker 回传的 data 实际由结构化克隆生成，此处显式收窄以通过严格类型检查。
      resolve(
        new ImageData(result.data as Uint8ClampedArray<ArrayBuffer>, result.width, result.height),
      );
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({
      imageDataA: { width: imageDataA.width, height: imageDataA.height, data: imageDataA.data },
      imageDataB: { width: imageDataB.width, height: imageDataB.height, data: imageDataB.data },
    });
  });
}

/**
 * 生成幻影坦克：取两图较小公共尺寸 → 各自中心裁剪 → 合成 → 编码 PNG 并展示。
 */
async function handleGenerate(): Promise<void> {
  if (isProcessing.value) return;
  errorMsg.value = '';
  isProcessing.value = true;
  try {
    let result: ImageData;
    if (surfaceSource.value === 'auto') {
      const s = autoSurface.value;
      const h = autoHidden.value;
      if (!s || !h) throw new Error('表图未就绪，请重新上传里图或点「从里图自动生成」');
      const limit = checkCanvasLimits(s.width, s.height);
      if (!limit.ok) throw new Error(limit.error!);
      // auto 单图：表图与暗化里图同尺寸，直接合成
      result = await processImageData(s, h);
    } else {
      const bitmapA = surfaceBitmap.value;
      const bitmapB = hiddenBitmap.value;
      if (!bitmapA || !bitmapB) throw new Error('请上传表图与里图');
      const targetW = Math.min(bitmapA.width, bitmapB.width);
      const targetH = Math.min(bitmapA.height, bitmapB.height);
      const limit = checkCanvasLimits(targetW, targetH);
      if (!limit.ok) throw new Error(limit.error!);
      const dataA = cropCenterToImageData(bitmapA, targetW, targetH);
      const dataB = cropCenterToImageData(bitmapB, targetW, targetH);
      result = await processImageData(dataA, dataB);
    }

    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.putImageData(result, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 编码失败');

    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
    resultUrl.value = URL.createObjectURL(blob);
    resultSize.value = blob.size;
    dimensions.value = { width: result.width, height: result.height };
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '幻影坦克合成失败';
  } finally {
    isProcessing.value = false;
  }
}

/** 下载合成结果（透明 PNG）。 */
function handleDownload(): void {
  if (!resultUrl.value) return;
  const a = document.createElement('a');
  a.href = resultUrl.value;
  a.download = 'phantom-tank.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  dispatchToast('已开始下载');
}

/** 清空：释放全部资源并重置到初始状态。 */
function handleClear(): void {
  handleSurfaceClear();
  handleHiddenClear();
  errorMsg.value = '';
  bgMode.value = 'checker';
  darken.value = 30;
  if (darkenTimer) {
    clearTimeout(darkenTimer);
    darkenTimer = null;
  }
}

onUnmounted(() => {
  handleClear();
});
</script>

<template>
  <div class="mx-auto w-full max-w-240">
    <ToolHeader
      title="幻影坦克"
      description="将两张图合成为透明PNG：白底显示表图、黑底显示里图，逐像素控制透明度实现双重显示"
      :show-example="false"
    />

    <!-- 双图上传区：图A（表图）/ 图B（里图） -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FileDropzone
        v-model="surfaceFile"
        accept="image/*"
        :max-size="FILE_SIZE_LIMIT"
        enable-drag
        enable-paste
        @select="(f) => void handleSurfaceSelect(f)"
        @clear="handleSurfaceClear"
        @error="(msg) => errorMsg = msg"
      >
        <template #default>
          <div class="flex flex-col items-center justify-center text-center">
            <div class="text-sm text-text font-medium">图A · 表图（白底显示）</div>
            <div class="text-xs text-muted mt-1">拖入 / 点击 / 粘贴</div>
          </div>
        </template>
        <template #file="{ file }">
          <div class="flex flex-col items-center w-full">
            <img
              v-if="surfacePreviewUrl"
              :src="surfacePreviewUrl"
              :alt="file.name"
              class="max-h-72 w-full object-contain rounded-sm"
            />
            <div class="text-xs text-muted mt-2 break-all">{{ file.name }}</div>
          </div>
        </template>
      </FileDropzone>

      <FileDropzone
        v-model="hiddenFile"
        accept="image/*"
        :max-size="FILE_SIZE_LIMIT"
        enable-drag
        enable-paste
        @select="(f) => void handleHiddenSelect(f)"
        @clear="handleHiddenClear"
        @error="(msg) => errorMsg = msg"
      >
        <template #default>
          <div class="flex flex-col items-center justify-center text-center">
            <div class="text-sm text-text font-medium">图B · 里图（黑底显示）</div>
            <div class="text-xs text-muted mt-1">拖入 / 点击 / 粘贴</div>
          </div>
        </template>
        <template #file="{ file }">
          <div class="flex flex-col items-center w-full">
            <img
              v-if="hiddenPreviewUrl"
              :src="hiddenPreviewUrl"
              :alt="file.name"
              class="max-h-72 w-full object-contain rounded-sm"
            />
            <div class="text-xs text-muted mt-2 break-all">{{ file.name }}</div>
          </div>
        </template>
      </FileDropzone>
    </div>

    <!-- 自动表图控件组：从里图生成 + 暗化滑块 -->
    <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-sm border border-border bg-card p-3">
      <button
        type="button"
        :disabled="!hiddenBitmap"
        class="px-3 py-1.5 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        aria-label="从里图自动生成表图"
        title="用里图的反相自动生成表图"
        @click="generateAutoSurface"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
        从里图自动生成
      </button>
      <div class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted">里图暗化</span>
        <input
          v-model.number="darken"
          type="range"
          min="0"
          max="80"
          step="1"
          :disabled="sliderDisabled"
          class="w-40 accent-accent cursor-pointer disabled:cursor-not-allowed"
          aria-label="里图暗化强度"
        />
        <span class="text-xs text-muted font-mono w-10">{{ darken }}%</span>
      </div>
      <span v-if="sliderDisabled && surfaceSource === 'manual'" class="text-xs text-muted">
        手动表图模式下不可调，点左侧按钮切回自动
      </span>
    </div>

    <!-- 操作按钮 -->
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="!canGenerate"
        class="px-4 py-2 rounded-sm bg-accent text-white text-[0.8125rem] font-sans cursor-pointer transition-[filter] duration-150 hover:brightness-95 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        aria-label="生成幻影坦克"
        @click="handleGenerate"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg>
        生成
      </button>
      <button
        type="button"
        :disabled="!resultUrl"
        class="px-4 py-2 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        aria-label="下载结果"
        @click="handleDownload"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        下载
      </button>
      <button
        type="button"
        :disabled="!surfaceFile && !hiddenFile && !resultUrl"
        class="px-4 py-2 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        aria-label="清空"
        @click="handleClear"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        清空
      </button>
    </div>

    <p v-if="errorMsg" class="text-[0.8125rem] text-error mt-2">{{ errorMsg }}</p>

    <!-- 结果预览区：背景切换 + 透明 PNG 经 alpha 合成呈现双重效果 -->
    <div v-if="resultUrl" class="mt-4 flex flex-col gap-3">
      <OptionRadioGroup v-model="bgMode" :options="bgOptions" label="预览背景" />
      <div
        class="rounded-sm overflow-hidden flex items-center justify-center w-full"
        :style="previewStyle"
      >
        <img
          :src="resultUrl"
          alt="幻影坦克结果"
          class="max-h-120 w-full object-contain"
        />
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span class="font-mono">{{ dimensions?.width }}×{{ dimensions?.height }}</span>
        <span class="font-mono">{{ formatBytes(resultSize) }}</span>
        <span>切换上方背景可对比白底（图A）/ 黑底（图B）效果</span>
      </div>
    </div>
  </div>
</template>
