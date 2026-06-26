<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import exifr from 'exifr';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import ImageCropper from '../../components/media/ImageCropper.vue';
import type { CropResult } from '../../components/media/ImageCropper.vue';
import {
  loadImage,
  convertImage,
  formatBytes,
  computeScaledSize,
  defaultFormatForInput,
  isLossless,
  needsFillBackground,
  getOutputExtension,
  checkCanvasLimits,
  OUTPUT_FORMATS,
  DEFAULT_QUALITY,
  type OutputFormat,
  type LoadedImage,
  type ConvertResult,
} from '../../utils/media/image-convert';
import { stripJpegMetadata } from '../../utils/media/exif-strip';
import {
  ICO_SIZE_OPTIONS,
  DEFAULT_ICO_SIZES,
  type IcoFit,
  type IcoAnchor,
} from '../../utils/media/encoders/ico';

/** 单条敏感 EXIF 信息。 */
interface SensitiveItem {
  /** 字段中文名 */
  label: string;
  /** 字段值 */
  value: string;
  /** GPS 坐标对应的地图链接 */
  mapLink?: string;
}

/** exifr 解析出的敏感元数据摘要。 */
interface SensitiveExifInfo {
  /** 命中的敏感字段列表 */
  items: SensitiveItem[];
  /** EXIF Orientation，1 表示无需旋转 */
  orientation: number;
}

/** 处理路径：strip=无损字节剥离，canvas=像素重绘 */
type ProcessPath = 'strip' | 'canvas';

/** 上传文件大小上限 50MB */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;
/** 滑块重算防抖时长 */
const RECONVERT_DEBOUNCE_MS = 200;

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const errorMsg = ref('');
const isProcessing = ref(false);

/** 原图信息 */
const loaded = ref<LoadedImage | null>(null);
const originalUrl = ref('');
const originalSize = ref(0);
const originalName = ref('');
/** 原始文件字节（JPEG 无损剥离路径需要） */
const originalBytes = ref<ArrayBuffer | null>(null);
/** 输入图片对应的输出格式（用于判断「纯擦除场景」） */
const inputFormat = ref<OutputFormat | null>(null);

/** 转换参数 */
const format = ref<OutputFormat>('webp');
const quality = ref(DEFAULT_QUALITY);
const scale = ref(100);

/** 隐私擦除 */
const eraseExif = ref(false);
const sensitiveExif = ref<SensitiveExifInfo | null>(null);
/** 最近一次处理实际清除的隐私项数（结果区展示） */
const erasedCount = ref(0);

/** ICO 输出尺寸（多选）、裁切适配方式与锚点 */
const icoSizes = ref<number[]>([...DEFAULT_ICO_SIZES]);
const icoFit = ref<IcoFit>('cover');
const icoAnchor = ref<IcoAnchor>('center');

/** ICO 适配方式选项（供 OptionRadioGroup） */
const icoFitOptions: { value: IcoFit; label: string }[] = [
  { value: 'cover', label: '裁切填满' },
  { value: 'contain', label: '留白完整' },
];

/** ICO cover 模式的九宫格锚点选项 */
const icoAnchorOptions: { value: IcoAnchor; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'middle-left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'middle-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' },
];

/** 最近一次走到的处理路径（下载文件名与结果展示用） */
const lastPath = ref<ProcessPath>('canvas');

/** 转换结果 */
const result = ref<ConvertResult | null>(null);

/** 是否处于裁切态 */
const isCropping = ref(false);

/** 裁切器使用的文件基础名（去掉扩展名） */
const cropBaseName = computed(() => originalName.value.replace(/\.[^.]+$/, '') || 'image');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 切换某个 ICO 输出尺寸（至少保留一个，不允许全部取消） */
function toggleIcoSize(size: number): void {
  if (icoSizes.value.includes(size)) {
    if (icoSizes.value.length === 1) return;
    icoSizes.value = icoSizes.value.filter((s) => s !== size);
  } else {
    icoSizes.value = [...icoSizes.value, size].sort((a, b) => a - b);
  }
}

/** 输入是否为 JPEG（无损剥离仅对 JPEG 生效） */
const isJpegInput = computed(() => inputFormat.value === 'jpeg');

/**
 * 是否命中「纯擦除场景」：开启擦除 + JPEG 输入 + 输出仍为 JPEG +
 * 原尺寸 + Orientation 正常。命中则走无损字节剥离，否则走 Canvas。
 */
const isPureStrip = computed(
  () =>
    eraseExif.value &&
    isJpegInput.value &&
    format.value === 'jpeg' &&
    scale.value === 100 &&
    (sensitiveExif.value?.orientation ?? 1) === 1,
);

/** 隐私擦除的动态提示文案（空串表示无提示） */
const privacyHint = computed(() => {
  if (!eraseExif.value) return '';
  if (isPureStrip.value) return '将无损擦除（不重新编码，画质与像素完全不变）';
  if (!isJpegInput.value) return '该格式将重新编码擦除；仅 JPEG 支持无损剥离';
  if ((sensitiveExif.value?.orientation ?? 1) !== 1) return '为保持拍摄方向将重新编码，画质略有损失';
  return '当前转换已自动清除元数据';
});

/** 尺寸缩放后的目标像素（预览用） */
const targetSize = computed(() => {
  if (!loaded.value) return null;
  return computeScaledSize(loaded.value.width, loaded.value.height, scale.value);
});

/** 质量控件是否禁用（PNG/TIFF/ICO 无损） */
const qualityDisabled = computed(() => isLossless(format.value));

/** 有损格式选项（供 OptionRadioGroup） */
const lossyFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossy'));

/** 无损格式选项（供 OptionRadioGroup） */
const losslessFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossless'));

/** 当前是否 ICO 输出（固定多尺寸，禁用 scale） */
const isIco = computed(() => format.value === 'ico');

/** 体积节省比（负数表示增大） */
const savings = computed(() => {
  if (!result.value || originalSize.value === 0) return null;
  const pct = Math.round(((originalSize.value - result.value.size) / originalSize.value) * 100);
  return { pct };
});

/** 触发全局 Toast 通知 */
function dispatchToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/**
 * 用 exifr 读取图片中的敏感元数据（GPS / 设备 / 时间 / 软件等）与 Orientation。
 *
 * 解析失败或不含任何敏感字段时返回空列表（不抛错，隐私擦除仍可基于字节剥离工作）。
 *
 * @param file 用户上传的图片
 * @returns 敏感字段摘要
 */
async function readSensitiveExif(file: File): Promise<SensitiveExifInfo> {
  try {
    const data = (await exifr.parse(file, { tiff: true, exif: true, gps: true })) as
      | Record<string, unknown>
      | null
      | undefined;
    if (!data) return { items: [], orientation: 1 };

    const items: SensitiveItem[] = [];
    const orientation = typeof data.Orientation === 'number' ? data.Orientation : 1;

    const lat = typeof data.latitude === 'number' ? data.latitude : undefined;
    const lon = typeof data.longitude === 'number' ? data.longitude : undefined;
    if (lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
      items.push({
        label: 'GPS 定位',
        value: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        mapLink: `https://www.google.com/maps?q=${lat},${lon}`,
      });
    }

    const make = typeof data.Make === 'string' ? data.Make : undefined;
    const model = typeof data.Model === 'string' ? data.Model : undefined;
    const device = [make, model].filter(Boolean).join(' ').trim();
    if (device) items.push({ label: '设备型号', value: device });

    if (typeof data.Software === 'string' && data.Software) {
      items.push({ label: '软件', value: data.Software });
    }
    if (typeof data.Artist === 'string' && data.Artist) {
      items.push({ label: '作者', value: data.Artist });
    }

    const dt = data.DateTimeOriginal ?? data.DateTime;
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
      items.push({ label: '拍摄时间', value: dt.toLocaleString('zh-CN') });
    }

    return { items, orientation };
  } catch {
    return { items: [], orientation: 1 };
  }
}

/** 处理上传文件：校验 → 解码 + 读字节 + 读 EXIF → 首次转换 */
async function processFile(file: File): Promise<void> {
  if (isProcessing.value) return;
  clearResult();
  resetOriginal();
  errorMsg.value = '';

  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请上传图片文件（PNG / JPG / WebP 等）';
    return;
  }
  if (file.size > FILE_SIZE_LIMIT) {
    errorMsg.value = `图片过大（${formatBytes(file.size)}），超过 ${formatBytes(FILE_SIZE_LIMIT)} 上限`;
    return;
  }

  originalName.value = file.name;
  originalSize.value = file.size;
  const detected = defaultFormatForInput(file.type);
  format.value = detected;
  inputFormat.value = detected;

  isProcessing.value = true;
  try {
    const [img, bytes, exifInfo] = await Promise.all([
      loadImage(file),
      file.arrayBuffer(),
      readSensitiveExif(file),
    ]);
    const limit = checkCanvasLimits(img.width, img.height);
    if (!limit.ok) {
      img.bitmap.close?.();
      errorMsg.value = limit.error!;
      resetOriginal();
      return;
    }
    loaded.value = img;
    originalBytes.value = bytes;
    sensitiveExif.value = exifInfo;
    originalUrl.value = URL.createObjectURL(file);
    await reconvert();
  } catch {
    errorMsg.value = '图片解码失败，可能文件损坏或格式不支持';
    resetOriginal();
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 立即执行一次处理（释放旧结果）。
 *
 * 命中纯擦除场景走 `stripJpegMetadata` 无损字节剥离；其余走 `convertImage`
 * Canvas 重绘（EXIF 随重绘自动清除）。
 */
async function reconvert(): Promise<void> {
  if (!loaded.value) return;
  clearResult();
  try {
    if (isPureStrip.value && originalBytes.value) {
      const cleaned = stripJpegMetadata(originalBytes.value);
      const blob = new Blob([cleaned], { type: 'image/jpeg' });
      result.value = {
        blob,
        url: URL.createObjectURL(blob),
        width: loaded.value.width,
        height: loaded.value.height,
        size: blob.size,
      };
      lastPath.value = 'strip';
    } else {
      result.value = await convertImage({
        bitmap: loaded.value.bitmap,
        format: format.value,
        quality: quality.value,
        scale: scale.value,
        fillBackground: needsFillBackground(format.value),
        icoSizes: icoSizes.value,
        icoFit: icoFit.value,
        icoAnchor: icoAnchor.value,
      });
      lastPath.value = 'canvas';
    }
    erasedCount.value = eraseExif.value ? sensitiveExif.value?.items.length ?? 0 : 0;
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '图片转换失败';
  }
}

/** 参数变化时防抖重算 */
function scheduleReconvert(): void {
  if (!loaded.value) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void reconvert();
  }, RECONVERT_DEBOUNCE_MS);
}

watch([format, quality, scale, eraseExif, icoFit, icoAnchor, () => [...icoSizes.value]], () => {
  errorMsg.value = '';
  scheduleReconvert();
});

/** 释放结果 object URL 并清空 */
function clearResult(): void {
  if (result.value) {
    URL.revokeObjectURL(result.value.url);
    if (result.value.previewUrl) URL.revokeObjectURL(result.value.previewUrl);
    result.value = null;
  }
}

/** 释放原图 object URL 并清空原图状态 */
function resetOriginal(): void {
  if (loaded.value?.bitmap) loaded.value.bitmap.close?.();
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  originalUrl.value = '';
  originalSize.value = 0;
  originalName.value = '';
  loaded.value = null;
  originalBytes.value = null;
  inputFormat.value = null;
  sensitiveExif.value = null;
  erasedCount.value = 0;
}

function handlePick(): void {
  fileInputRef.value?.click();
}

function handleChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void processFile(file);
  // 重置 value，确保连续选择同一文件仍能触发 change
  input.value = '';
}

function handleDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void processFile(file);
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(): void {
  isDragging.value = false;
}

/** 全局粘贴：取剪贴板中的图片 */
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

/** 裁切完成后的处理：用裁切结果替换原图并重新转换。
 *
 * @param result 裁切组件返回的 canvas、blob 与尺寸信息
 */
async function onCrop(result: CropResult): Promise<void> {
  // 用裁切 canvas 生成新位图替换源
  const bitmap = await createImageBitmap(result.canvas);
  // 复用尺寸上限校验，超限则放弃并提示
  const limit = checkCanvasLimits(bitmap.width, bitmap.height);
  if (!limit.ok) {
    bitmap.close?.();
    dispatchToast(limit.error!);
    return;
  }
  loaded.value?.bitmap.close?.();      // 关闭旧位图
  loaded.value = { bitmap, width: result.width, height: result.height };
  // 刷新预览与体积
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  originalUrl.value = URL.createObjectURL(result.blob);
  originalSize.value = result.blob.size;
  // 裁切已重新编码，原始字节失效 → 清空使纯擦除 strip 路径自动失效
  originalBytes.value = null;
  isCropping.value = false;
  await reconvert();
}

/** 下载结果（文件名后缀按处理路径区分） */
function handleDownload(): void {
  if (!result.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const ext = getOutputExtension(format.value).slice(1);
  const suffix = lastPath.value === 'strip' ? 'clean' : 'compressed';
  const a = document.createElement('a');
  a.href = result.value.url;
  a.download = `${baseName}-${suffix}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  dispatchToast('已开始下载');
}

/** 清空全部状态 */
function handleClear(): void {
  clearResult();
  resetOriginal();
  errorMsg.value = '';
  format.value = 'webp';
  quality.value = DEFAULT_QUALITY;
  scale.value = 100;
  eraseExif.value = false;
  icoSizes.value = [...DEFAULT_ICO_SIZES];
  icoFit.value = 'cover';
  icoAnchor.value = 'center';
  isCropping.value = false;
  if (fileInputRef.value) fileInputRef.value.value = '';
}

onMounted(() => {
  window.addEventListener('paste', handlePaste);
});

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste);
  if (debounceTimer) clearTimeout(debounceTimer);
  clearResult();
  resetOriginal();
});
</script>

<template>
  <div>
    <ToolHeader
      title="图片转换与压缩"
      description="PNG / JPG / WebP / AVIF 等格式互转、质量压缩与尺寸缩放，支持 EXIF 隐私擦除与多尺寸 ICO 图标导出，纯浏览器端本地处理"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <!-- 原图 -->
      <template #input>
        <div class="flex flex-col gap-3">
          <div class="text-[0.8125rem] font-medium text-muted">原始图片</div>

          <div
            v-if="isCropping"
            class="border rounded-sm p-3 flex flex-col gap-2"
            :class="isDragging ? 'border-accent' : 'border-border'"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <ImageCropper
              :src="originalUrl"
              :file-name="cropBaseName"
              @crop="onCrop"
              @cancel="isCropping = false"
            />
          </div>

          <div
            v-else-if="!originalUrl"
            class="border-2 border-dashed rounded-lg p-10 min-h-90 flex flex-col items-center justify-center text-center cursor-pointer transition-[border-color] duration-150"
            :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
            @click="handlePick"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
            <div class="text-xs text-muted mt-1">支持 PNG / JPG / WebP / AVIF / GIF / BMP / ICO / TIFF，上限 50MB</div>
          </div>

          <div
            v-else
            class="group relative bg-hover border rounded-sm p-3 flex flex-col gap-2 cursor-pointer transition-[border-color] duration-150"
            :class="isDragging ? 'border-accent' : 'border-border hover:border-accent'"
            @click="handlePick"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <div class="relative">
              <img
                :src="originalUrl"
                alt="原始图片"
                class="max-h-90 w-full object-contain rounded-sm bg-white"
              />
              <div
                class="absolute inset-0 flex items-center justify-center rounded-sm bg-black/45 text-sm text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                :class="isDragging ? 'opacity-100' : ''"
              >
                点击或拖入图片更换 · Ctrl+V 粘贴
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="text-xs text-muted font-mono">
                {{ loaded?.width }}×{{ loaded?.height }} · {{ formatBytes(originalSize) }}
              </div>
              <button
                type="button"
                title="裁切"
                aria-label="裁切"
                class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
                @click.stop="isCropping = true"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="6" cy="6" r="3" />
                  <path d="M8.4 20.4a2 2 0 0 1-1.4-.6l-6-6a2 2 0 0 1 0-2.8l6-6a2 2 0 0 1 2.8 0l6 6a2 2 0 0 1 0 2.8l-6 6a2 2 0 0 1-1.4.6z" />
                  <circle cx="18" cy="18" r="3" />
                  <path d="M8.4 8.4 15.6 15.6" />
                </svg>
              </button>
            </div>
          </div>

          <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleChange" />
          <p v-if="errorMsg" class="text-[0.8125rem] text-error">{{ errorMsg }}</p>
        </div>
      </template>

      <!-- 结果 -->
      <template #output>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="text-[0.8125rem] font-medium text-muted">压缩结果</div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                title="下载结果"
                aria-label="下载结果"
                :disabled="!result"
                class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleDownload"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                type="button"
                title="清空"
                aria-label="清空"
                class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
                @click="handleClear"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          <div v-if="result" class="bg-hover border border-border rounded-sm p-3 flex flex-col gap-2">
            <img
              :src="result.previewUrl ?? result.url"
              alt="压缩结果"
              class="max-h-90 w-full object-contain rounded-sm bg-white"
            />
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-muted">{{ result.width }}×{{ result.height }} · {{ formatBytes(result.size) }}</span>
              <span v-if="savings" :class="savings.pct >= 0 ? 'text-success' : 'text-error'">
                {{ savings.pct >= 0 ? `节省 ${savings.pct}%` : `增大 ${Math.abs(savings.pct)}%` }}
              </span>
            </div>
            <p v-if="eraseExif && erasedCount > 0" class="text-[0.8125rem]" :class="lastPath === 'strip' ? 'text-success' : 'text-muted'">
              {{ lastPath === 'strip' ? `已无损清除 ${erasedCount} 项隐私信息` : `已通过重新编码清除 ${erasedCount} 项隐私信息` }}
            </p>
          </div>

          <div v-else-if="loaded" class="bg-hover border border-border rounded-sm p-10 min-h-90 flex flex-col items-center justify-center text-center text-muted text-sm">
            正在生成预览…
          </div>

          <div v-else class="bg-hover border border-border rounded-sm p-10 min-h-90 flex flex-col items-center justify-center text-center text-muted text-sm">
            上传图片后预览压缩结果
          </div>
        </div>
      </template>

      <!-- 控件栏（横跨两栏） -->
      <template #actions>
        <div class="w-full flex flex-col gap-5 border-t border-border pt-4">
          <!-- 输出设置 -->
          <section class="flex flex-col gap-3">
            <h3 class="text-[0.8125rem] font-semibold text-text">输出设置</h3>
            <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div class="flex items-center gap-4 flex-wrap">
                <OptionRadioGroup v-model="format" :options="lossyFormats" label="有损" />
                <OptionRadioGroup v-model="format" :options="losslessFormats" label="无损" />
              </div>

              <template v-if="!isIco">
                <div class="flex items-center gap-2" :class="qualityDisabled ? 'opacity-50' : ''">
                  <span class="text-[0.8125rem] text-muted">质量</span>
                  <input
                    v-model.number="quality"
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    aria-label="质量"
                    :disabled="qualityDisabled"
                    class="w-32 accent-accent"
                  />
                  <span class="text-[0.8125rem] font-mono w-6">{{ qualityDisabled ? '—' : quality }}</span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-[0.8125rem] text-muted">尺寸</span>
                  <input
                    v-model.number="scale"
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    aria-label="尺寸"
                    class="w-32 accent-accent"
                  />
                  <span class="text-[0.8125rem] font-mono">{{ scale }}%</span>
                  <span v-if="targetSize" class="text-[0.8125rem] text-muted">({{ targetSize.width }}×{{ targetSize.height }})</span>
                </div>
              </template>
            </div>

            <!-- ICO 专属：输出尺寸多选 + 裁切适配方式 + 锚点 -->
            <div v-if="isIco" class="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[0.8125rem] text-muted min-w-18 shrink-0">尺寸</span>
                <div class="flex gap-1 flex-wrap">
                  <button
                    v-for="size in ICO_SIZE_OPTIONS"
                    :key="size"
                    type="button"
                    :class="[
                      'px-3 py-1.5 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
                      'transition-[background-color,border-color] duration-150',
                      icoSizes.includes(size)
                        ? 'bg-accent border-accent text-white'
                        : 'bg-surface border-border text-text hover:bg-hover hover:border-accent',
                    ]"
                    @click="toggleIcoSize(size)"
                  >
                    {{ size }}
                  </button>
                </div>
              </div>

              <OptionRadioGroup v-model="icoFit" :options="icoFitOptions" label="适配" />

              <div v-if="icoFit === 'cover'" class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted">锚点</span>
                <SelectListbox
                  class="w-28"
                  :model-value="icoAnchor"
                  :options="icoAnchorOptions"
                  @update:model-value="(v) => (icoAnchor = v as IcoAnchor)"
                />
              </div>
            </div>

            <!-- 预留一行高度，避免切换格式时提示文本出现/消失导致页面跳动 -->
            <div class="min-h-[1.25rem] text-[0.8125rem] text-muted">
              <p v-if="isIco" class="m-0">ICO 按所选尺寸多尺寸封装；非正方形图按所选适配方式处理（裁切填满 / 留白完整）</p>
              <p v-else-if="loaded && needsFillBackground(format)" class="m-0">
                JPEG 不支持透明背景，透明区域将填充白色
              </p>
            </div>
          </section>

          <!-- 隐私元数据擦除 -->
          <section class="flex flex-col gap-2 border-t border-border pt-4">
            <ToggleSwitch v-model="eraseExif" label="擦除隐私元数据" />
            <div v-if="eraseExif" class="flex flex-col gap-1 text-[0.8125rem] text-muted">
              <p v-if="privacyHint" class="m-0">{{ privacyHint }}</p>
              <div v-if="sensitiveExif && sensitiveExif.items.length" class="mt-1">
                <span>检测到 {{ sensitiveExif.items.length }} 项隐私信息：</span>
                <ul class="m-0 mt-1 flex flex-col gap-0.5">
                  <li v-for="(item, idx) in sensitiveExif.items" :key="idx">
                    {{ item.label }}：<span class="font-mono">{{ item.value }}</span>
                    <a
                      v-if="item.mapLink"
                      :href="item.mapLink"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-accent underline ml-1"
                    >查看地图</a>
                  </li>
                </ul>
              </div>
              <p v-else class="m-0">未检测到敏感信息</p>
            </div>
          </section>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
