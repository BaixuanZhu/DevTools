<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  loadImage,
  convertImage,
  formatBytes,
  computeScaledSize,
  defaultFormatForInput,
  isLossless,
  needsFillBackground,
  checkCanvasLimits,
  OUTPUT_FORMATS,
  DEFAULT_QUALITY,
  type OutputFormat,
  type LoadedImage,
  type ConvertResult,
} from '../../utils/media/image-convert';

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

/** 转换参数 */
const format = ref<OutputFormat>('webp');
const quality = ref(DEFAULT_QUALITY);
const scale = ref(100);

/** 转换结果 */
const result = ref<ConvertResult | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** 尺寸缩放后的目标像素（预览用） */
const targetSize = computed(() => {
  if (!loaded.value) return null;
  return computeScaledSize(loaded.value.width, loaded.value.height, scale.value);
});

/** 质量控件是否禁用（PNG 无损） */
const qualityDisabled = computed(() => isLossless(format.value));

/** 体积节省比（负数表示增大） */
const savings = computed(() => {
  if (!result.value || originalSize.value === 0) return null;
  const diff = originalSize.value - result.value.size;
  const pct = Math.round((diff / originalSize.value) * 100);
  return { diff, pct };
});

/** 触发全局 Toast 通知 */
function dispatchToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 处理上传文件：校验 → 解码 → 首次转换 */
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
  format.value = defaultFormatForInput(file.type);

  isProcessing.value = true;
  try {
    const img = await loadImage(file);
    const limit = checkCanvasLimits(img.width, img.height);
    if (!limit.ok) {
      img.bitmap.close?.();
      errorMsg.value = limit.error!;
      resetOriginal();
      return;
    }
    loaded.value = img;
    originalUrl.value = URL.createObjectURL(file);
    await reconvert();
  } catch {
    errorMsg.value = '图片解码失败，可能文件损坏或格式不支持';
    resetOriginal();
  } finally {
    isProcessing.value = false;
  }
}

/** 立即执行一次转换（释放旧结果） */
async function reconvert(): Promise<void> {
  if (!loaded.value) return;
  clearResult();
  try {
    result.value = await convertImage({
      bitmap: loaded.value.bitmap,
      format: format.value,
      quality: quality.value,
      scale: scale.value,
      fillBackground: needsFillBackground(format.value),
    });
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

watch([format, quality, scale], () => {
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

/** 下载压缩结果 */
function handleDownload(): void {
  if (!result.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const ext = format.value === 'png' ? 'png' : format.value === 'jpeg' ? 'jpg' : 'webp';
  const a = document.createElement('a');
  a.href = result.value.url;
  a.download = `${baseName}-compressed.${ext}`;
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
  if (fileInputRef.value) fileInputRef.value.value = '';
}

onMounted(() => {
  window.addEventListener('paste', handlePaste);
});

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste);
  if (debounceTimer) clearTimeout(debounceTimer);
  clearResult();
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
});
</script>

<template>
  <ResponsiveWorkspace mode="horizontal" gap="gap-6">
    <!-- 原图 -->
    <template #input>
      <div class="flex flex-col gap-3">
        <div class="text-[0.8125rem] font-medium text-muted">原始图片</div>

        <div
          v-if="!originalUrl"
          class="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-[border-color] duration-150"
          :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
          @click="handlePick"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
        >
          <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
          <div class="text-xs text-muted mt-1">支持 PNG / JPG / WebP / GIF / BMP 等，上限 50MB</div>
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
          <p v-if="savings && savings.pct < 0" class="text-[0.8125rem] text-muted">
            当前设置下体积未减小，可降低质量或更换为 WebP
          </p>
        </div>

        <div v-else-if="loaded" class="bg-hover border border-border rounded-sm p-10 text-center text-muted text-sm">
          正在生成预览…
        </div>

        <div v-else class="bg-hover border border-border rounded-sm p-10 text-center text-muted text-sm">
          上传图片后预览压缩结果
        </div>
      </div>
    </template>

    <!-- 控件栏（横跨两栏） -->
    <template #actions>
      <div class="w-full flex flex-col gap-4 border-t border-border pt-4">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
          <OptionRadioGroup v-model="format" :options="OUTPUT_FORMATS" label="输出格式" />

          <div class="flex items-center gap-2" :class="qualityDisabled ? 'opacity-50' : ''">
            <span class="text-[0.8125rem] text-muted">质量</span>
            <input
              v-model.number="quality"
              type="range"
              min="10"
              max="100"
              step="1"
              :disabled="qualityDisabled"
              class="w-32 accent-accent"
            />
            <span class="text-[0.8125rem] font-mono w-6">{{ qualityDisabled ? '—' : quality }}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">尺寸</span>
            <input v-model.number="scale" type="range" min="1" max="100" step="1" class="w-32 accent-accent" />
            <span class="text-[0.8125rem] font-mono">{{ scale }}%</span>
            <span v-if="targetSize" class="text-[0.8125rem] text-muted">({{ targetSize.width }}×{{ targetSize.height }})</span>
          </div>
        </div>

        <p v-if="qualityDisabled" class="text-[0.8125rem] text-muted">PNG 为无损格式，不支持质量调节</p>
        <p v-if="loaded && needsFillBackground(format)" class="text-[0.8125rem] text-muted">
          JPEG 不支持透明背景，透明区域将填充白色
        </p>

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
</template>
