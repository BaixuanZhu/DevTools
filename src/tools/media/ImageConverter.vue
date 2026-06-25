<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import exifr from 'exifr';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
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
import { DEFAULT_WATERMARK, type WatermarkOptions, type WatermarkSlot } from '../../utils/media/watermark';

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

/** 文字水印 */
const watermarkEnabled = ref(false);
const watermarkText = ref(DEFAULT_WATERMARK.text);
const watermarkSize = ref(DEFAULT_WATERMARK.fontSize);
const watermarkColor = ref(DEFAULT_WATERMARK.color);
const watermarkOpacity = ref(DEFAULT_WATERMARK.opacity);
const watermarkRotation = ref(DEFAULT_WATERMARK.rotation);
const watermarkSlot = ref<WatermarkSlot>(DEFAULT_WATERMARK.slot);

/** 水印位置选项（九宫格 + 平铺） */
const watermarkSlotOptions: { value: WatermarkSlot; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'middle-left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'middle-right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' },
  { value: 'tile', label: '平铺' },
];

/** 最近一次走到的处理路径（下载文件名与结果展示用） */
const lastPath = ref<ProcessPath>('canvas');

/** 转换结果 */
const result = ref<ConvertResult | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 聚合的水印选项（供 convertImage） */
const watermarkOpts = computed<WatermarkOptions>(() => ({
  text: watermarkText.value,
  fontSize: watermarkSize.value,
  color: watermarkColor.value,
  opacity: watermarkOpacity.value,
  rotation: watermarkRotation.value,
  slot: watermarkSlot.value,
  padding: DEFAULT_WATERMARK.padding,
  tileGap: DEFAULT_WATERMARK.tileGap,
}));

/** 输入是否为 JPEG（无损剥离仅对 JPEG 生效） */
const isJpegInput = computed(() => inputFormat.value === 'jpeg');

/**
 * 是否命中「纯擦除场景」：开启擦除 + JPEG 输入 + 输出仍为 JPEG +
 * 原尺寸 + 不加水印 + Orientation 正常。命中则走无损字节剥离，否则走 Canvas。
 */
const isPureStrip = computed(
  () =>
    eraseExif.value &&
    isJpegInput.value &&
    format.value === 'jpeg' &&
    scale.value === 100 &&
    !watermarkEnabled.value &&
    (sensitiveExif.value?.orientation ?? 1) === 1,
);

/** 隐私擦除的动态提示文案（空串表示无提示） */
const privacyHint = computed(() => {
  if (!eraseExif.value) return '';
  if (isPureStrip.value) return '将无损擦除（不重新编码，画质与像素完全不变）';
  if (!isJpegInput.value) return '该格式将重新编码擦除；仅 JPEG 支持无损剥离';
  if ((sensitiveExif.value?.orientation ?? 1) !== 1) return '为保持拍摄方向将重新编码，画质略有损失';
  if (watermarkEnabled.value) return '加水印需重新编码，元数据会一并清除';
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

/** 无损格式的禁用提示文案 */
const losslessHint = computed(() => {
  if (format.value === 'png') return 'PNG 为无损格式，不支持质量调节';
  if (format.value === 'tiff') return 'TIFF 为无损格式，不支持质量调节';
  if (format.value === 'ico') return 'ICO 为无损格式，不支持质量调节';
  return '';
});

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
 * Canvas 重绘（水印在此绘制，EXIF 随重绘自动清除）。
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
        watermark: watermarkEnabled.value ? watermarkOpts.value : undefined,
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

watch([format, quality, scale, eraseExif, watermarkEnabled, watermarkOpts], () => {
  errorMsg.value = '';
  scheduleReconvert();
});

/** 释放结果 object URL 并清空 */
function clearResult(): void {
  if (result.value) {
    URL.revokeObjectURL(result.value.url);
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
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void processFile(file);
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

/** 下载结果（文件名后缀按处理路径区分） */
function handleDownload(): void {
  if (!result.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const ext = getOutputExtension(format.value).slice(1);
  const suffix = lastPath.value === 'strip' ? 'clean' : watermarkEnabled.value ? 'watermarked' : 'compressed';
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
  watermarkEnabled.value = false;
  watermarkText.value = DEFAULT_WATERMARK.text;
  watermarkSize.value = DEFAULT_WATERMARK.fontSize;
  watermarkColor.value = DEFAULT_WATERMARK.color;
  watermarkOpacity.value = DEFAULT_WATERMARK.opacity;
  watermarkRotation.value = DEFAULT_WATERMARK.rotation;
  watermarkSlot.value = DEFAULT_WATERMARK.slot;
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
      description="PNG / JPG / WebP / AVIF 等格式互转、质量压缩与尺寸缩放，支持 EXIF 隐私擦除与文字水印，纯浏览器端本地处理"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <!-- 原图 -->
      <template #input>
        <div class="flex flex-col gap-3">
          <div class="text-[0.8125rem] font-medium text-muted">原始图片</div>

          <div
            v-if="!originalUrl"
            class="border-2 border-dashed rounded-lg p-10 min-h-[360px] flex flex-col items-center justify-center text-center cursor-pointer transition-[border-color] duration-150"
            :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
            @click="handlePick"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
          >
            <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
            <div class="text-xs text-muted mt-1">支持 PNG / JPG / WebP / AVIF / GIF / BMP / ICO / TIFF，上限 50MB</div>
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

          <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleChange" />
          <p v-if="errorMsg" class="text-[0.8125rem] text-error">{{ errorMsg }}</p>
        </div>
      </template>

      <!-- 结果 -->
      <template #output>
        <div class="flex flex-col gap-3">
          <div class="text-[0.8125rem] font-medium text-muted">压缩结果</div>

          <div v-if="result" class="bg-hover border border-border rounded-sm p-3 flex flex-col gap-2">
            <img
              :src="result.url"
              alt="压缩结果"
              class="max-h-[360px] w-full object-contain rounded-sm bg-white"
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
            <p v-else-if="savings && savings.pct < 0" class="text-[0.8125rem] text-muted">
              当前设置下体积未减小，可降低质量或更换为 WebP
            </p>
          </div>

          <div v-else-if="loaded" class="bg-hover border border-border rounded-sm p-10 min-h-[360px] flex flex-col items-center justify-center text-center text-muted text-sm">
            正在生成预览…
          </div>

          <div v-else class="bg-hover border border-border rounded-sm p-10 min-h-[360px] flex flex-col items-center justify-center text-center text-muted text-sm">
            上传图片后预览压缩结果
          </div>
        </div>
      </template>

      <!-- 控件栏（横跨两栏） -->
      <template #actions>
        <div class="w-full flex flex-col gap-4 border-t border-border pt-4">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div class="flex items-center gap-4 flex-wrap">
              <OptionRadioGroup v-model="format" :options="lossyFormats" label="有损" />
              <OptionRadioGroup v-model="format" :options="losslessFormats" label="无损" />
            </div>

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

            <div class="flex items-center gap-2" :class="isIco ? 'opacity-50' : ''">
              <span class="text-[0.8125rem] text-muted">尺寸</span>
              <input
                v-model.number="scale"
                type="range"
                min="1"
                max="100"
                step="1"
                aria-label="尺寸"
                :disabled="isIco"
                class="w-32 accent-accent"
              />
              <span class="text-[0.8125rem] font-mono">{{ scale }}%</span>
              <span v-if="targetSize && !isIco" class="text-[0.8125rem] text-muted">({{ targetSize.width }}×{{ targetSize.height }})</span>
            </div>
          </div>

          <!-- 预留一行高度，避免切换格式时提示文本出现/消失导致页面跳动 -->
          <div class="min-h-[1.25rem] text-[0.8125rem] text-muted">
            <p v-if="isIco" class="m-0">ICO 固定输出 16 / 32 / 48 三尺寸（favicon 标准），尺寸与质量滑块不适用</p>
            <p v-else-if="qualityDisabled" class="m-0">{{ losslessHint }}</p>
            <p v-else-if="loaded && needsFillBackground(format)" class="m-0">
              JPEG 不支持透明背景，透明区域将填充白色
            </p>
          </div>

          <!-- 隐私元数据擦除 -->
          <div v-if="loaded" class="flex flex-col gap-2 border-t border-border pt-3">
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
          </div>

          <!-- 文字水印 -->
          <div v-if="loaded" class="flex flex-col gap-2 border-t border-border pt-3">
            <ToggleSwitch v-model="watermarkEnabled" label="添加文字水印" />
            <div v-if="watermarkEnabled" class="flex flex-wrap items-center gap-x-5 gap-y-2">
              <input
                v-model="watermarkText"
                type="text"
                placeholder="水印文字"
                aria-label="水印文字"
                class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] w-40"
              />
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted">字号</span>
                <input v-model.number="watermarkSize" type="range" min="10" max="120" step="1" aria-label="字号" class="w-28 accent-accent" />
                <span class="text-[0.8125rem] font-mono w-8">{{ watermarkSize }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted">透明度</span>
                <input v-model.number="watermarkOpacity" type="range" min="0" max="1" step="0.05" aria-label="透明度" class="w-28 accent-accent" />
                <span class="text-[0.8125rem] font-mono w-8">{{ Math.round(watermarkOpacity * 100) }}%</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted">旋转</span>
                <input v-model.number="watermarkRotation" type="range" min="-90" max="90" step="1" aria-label="旋转" class="w-28 accent-accent" />
                <span class="text-[0.8125rem] font-mono w-10">{{ watermarkRotation }}°</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted">颜色</span>
                <input v-model="watermarkColor" type="color" aria-label="颜色" class="w-8 h-8 rounded-sm cursor-pointer border border-border bg-surface p-0.5" />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[0.8125rem] text-muted">位置</span>
                <SelectListbox
                  class="w-24"
                  :model-value="watermarkSlot"
                  :options="watermarkSlotOptions"
                  @update:model-value="(v) => (watermarkSlot = v as WatermarkSlot)"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <ClearButton @clear="handleClear" />
            <button
              type="button"
              :disabled="!result"
              class="px-4 py-2 rounded-sm bg-accent text-white text-[0.8125rem] font-sans cursor-pointer transition-[filter] duration-150 hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="handleDownload"
            >
              下载结果
            </button>
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
