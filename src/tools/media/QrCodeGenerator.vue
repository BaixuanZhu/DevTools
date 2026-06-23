<script setup lang="ts">
/**
 * 二维码生成器组件。
 *
 * - 实时监听输入与配置变化，自动重生成预览与下载用二维码
 * - 预览区固定显示 64×64、128×128、256×256 三种尺寸并排对比
 * - 下载区可独立设置尺寸（128–2048px），按需生成 PNG/SVG
 * - 支持自定义前景色、背景色、容错级别
 * - 颜色对比度过低时给出警告
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useCopy } from '../../composables/useCopy';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ColorInput from '../../components/ui/ColorInput.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  generateQrPngDataUrl,
  generateQrSvgString,
  getContrastWarning,
  downloadFile,
  QR_ERROR_LEVELS,
  QR_DEFAULT_FOREGROUND,
  QR_DEFAULT_BACKGROUND,
  QR_DOWNLOAD_DEFAULT_SIZE,
  QR_DOWNLOAD_MIN_SIZE,
  QR_DOWNLOAD_MAX_SIZE,
  type QrErrorLevel,
} from '../../utils/media/qr-code';

// 预览固定尺寸
const PREVIEW_SIZES = [64, 128, 256] as const;
type PreviewSize = (typeof PREVIEW_SIZES)[number];

// 状态
const text = ref('https://tools.openbong.cloud');
const foreground = ref(QR_DEFAULT_FOREGROUND);
const background = ref(QR_DEFAULT_BACKGROUND);
const errorLevel = ref<QrErrorLevel>('M');
const downloadSize = ref(QR_DOWNLOAD_DEFAULT_SIZE);

// 预览图 DataURLs（64/128/256）
const previewQrUrls = ref<Record<PreviewSize, string>>({ 64: '', 128: '', 256: '' });

const errorMsg = ref('');
const isGenerating = ref(false);

const textInputRef = ref<HTMLTextAreaElement | null>(null);

const { copied: svgCopied, copy: copySvgText } = useCopy();

// 容错级别选项（供 OptionRadioGroup 消费）
const errorLevelOptions = QR_ERROR_LEVELS.map((o) => ({ value: o.value, label: o.label }));

// 当前容错级别的中文描述
const currentLevelDescription = computed(
  () => QR_ERROR_LEVELS.find((o) => o.value === errorLevel.value)?.description ?? '',
);

// 颜色对比度警告
const contrastWarning = computed(() => getContrastWarning(foreground.value, background.value));

/** 是否有任意预览图可显示 */
const hasPreview = computed(() => PREVIEW_SIZES.some((s) => previewQrUrls.value[s]));

// 自动重生成：debounce 150ms
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch([text, foreground, background, errorLevel], () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void regenerate();
  }, 150);
}, { immediate: true });

/**
 * 重新生成预览二维码：并行生成三张固定尺寸预览 PNG。
 * 文本为空时静默重置，不报错。
 * 下载尺寸调整不触发此函数，避免不必要的重新生成。
 */
async function regenerate() {
  errorMsg.value = '';
  if (!text.value.trim()) {
    previewQrUrls.value = { 64: '', 128: '', 256: '' };
    return;
  }
  isGenerating.value = true;
  try {
    const baseOpts = {
      errorLevel: errorLevel.value,
      foreground: foreground.value,
      background: background.value,
    };
    const [url64, url128, url256] = await Promise.all([
      generateQrPngDataUrl(text.value, { ...baseOpts, size: 64 }),
      generateQrPngDataUrl(text.value, { ...baseOpts, size: 128 }),
      generateQrPngDataUrl(text.value, { ...baseOpts, size: 256 }),
    ]);
    previewQrUrls.value = { 64: url64, 128: url128, 256: url256 };
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '生成二维码时出错';
    previewQrUrls.value = { 64: '', 128: '', 256: '' };
  } finally {
    isGenerating.value = false;
  }
}

/** 下载尺寸越界时夹紧到合法范围 */
watch(downloadSize, (v) => {
  if (v < QR_DOWNLOAD_MIN_SIZE) downloadSize.value = QR_DOWNLOAD_MIN_SIZE;
  if (v > QR_DOWNLOAD_MAX_SIZE) downloadSize.value = QR_DOWNLOAD_MAX_SIZE;
});

/** 触发全局 toast 通知 */
function showToast(type: 'success' | 'error', message: string) {
  document.dispatchEvent(new CustomEvent('toast', { detail: { type, message } }));
}

/** 下载 PNG 格式（按 downloadSize 生成） */
async function downloadPng() {
  if (!text.value.trim()) return;
  try {
    const url = await generateQrPngDataUrl(text.value, {
      size: downloadSize.value,
      errorLevel: errorLevel.value,
      foreground: foreground.value,
      background: background.value,
    });
    downloadFile(url, `qrcode-${Date.now()}.png`);
    showToast('success', '已下载 PNG');
  } catch (e: unknown) {
    showToast('error', e instanceof Error ? e.message : '下载失败');
  }
}

/** 下载 SVG 格式（按 downloadSize 生成） */
async function downloadSvg() {
  if (!text.value.trim()) return;
  try {
    const svg = await generateQrSvgString(text.value, {
      size: downloadSize.value,
      errorLevel: errorLevel.value,
      foreground: foreground.value,
      background: background.value,
    });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadFile(blob, `qrcode-${Date.now()}.svg`);
    showToast('success', '已下载 SVG');
  } catch (e: unknown) {
    showToast('error', e instanceof Error ? e.message : '下载失败');
  }
}

/** 按需生成并复制 SVG 到剪贴板 */
async function copySvg() {
  if (!text.value.trim()) return;
  try {
    const svg = await generateQrSvgString(text.value, {
      size: downloadSize.value,
      errorLevel: errorLevel.value,
      foreground: foreground.value,
      background: background.value,
    });
    await copySvgText(svg);
  } catch (e: unknown) {
    // useCopy 已在失败时 dispatch toast，这里不再额外处理
  }
}

/** 清空文本与结果，保留颜色与容错级别 */
function handleClear() {
  text.value = '';
  previewQrUrls.value = { 64: '', 128: '', 256: '' };
  errorMsg.value = '';
}

onMounted(() => {
  textInputRef.value?.focus();
});
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="二维码生成器"
      description="输入文本生成二维码，支持自定义前景色、背景色、容错级别和下载尺寸，可下载 PNG 与 SVG 两种格式"
      :show-example="false"
    />

    <!-- 输入区 -->
    <div class="mb-4">
      <label for="qr-text-input" class="block text-[0.8125rem] text-muted font-medium mb-1">
        输入文本
      </label>
      <textarea
        id="qr-text-input"
        ref="textInputRef"
        v-model="text"
        rows="3"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
        placeholder="输入要编码的文本，例如网址、文字、WiFi 信息等"
      ></textarea>
      <p class="text-[0.75rem] text-muted mt-1">字符数：{{ text.length }}</p>
    </div>

    <!-- 配置卡 -->
    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <h2 class="text-[0.9375rem] font-semibold m-0">配置</h2>

      <!-- 容错级别 -->
      <div>
        <OptionRadioGroup v-model="errorLevel" label="容错级别" :options="errorLevelOptions" />
        <p class="text-[0.75rem] text-muted mt-1.5">{{ currentLevelDescription }}</p>
      </div>

      <!-- 颜色（两列） -->
      <div>
        <span class="block text-[0.8125rem] text-muted font-medium mb-1.5">颜色</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorInput v-model="foreground" label="前景色" />
          <ColorInput v-model="background" label="背景色" />
        </div>
        <p v-if="contrastWarning" class="text-[0.75rem] text-error mt-2">
          ⚠ {{ contrastWarning }}
        </p>
      </div>

      <!-- 错误信息 -->
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
    </div>

    <!-- 预览区 -->
    <div class="border border-border rounded-md bg-card mt-4">
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border flex-wrap">
        <span class="text-sm font-medium">预览</span>
        <ClearButton @clear="handleClear" />
      </div>

      <!-- 空 / 加载 / 错误 / 预览 -->
      <div
        v-if="!text.trim()"
        class="flex items-center justify-center h-[280px] text-muted text-sm"
      >
        输入文本后自动生成二维码
      </div>
      <div
        v-else-if="isGenerating"
        class="flex items-center justify-center h-[280px] text-muted text-sm"
      >
        生成中...
      </div>
      <div
        v-else-if="errorMsg"
        class="flex items-center justify-center h-[280px] px-6 text-error text-sm text-center"
      >
        {{ errorMsg }}
      </div>
      <div v-else-if="hasPreview" class="flex items-start justify-center gap-6 p-6 flex-wrap">
        <div
          v-for="s in PREVIEW_SIZES"
          :key="s"
          class="flex flex-col items-center gap-2"
        >
          <div class="border border-border rounded-sm bg-white p-2">
            <img
              :src="previewQrUrls[s]"
              :alt="`二维码预览 ${s}×${s}`"
              :width="s"
              :height="s"
              class="block [image-rendering:pixelated]"
            />
          </div>
          <span class="text-[0.75rem] text-muted">{{ s }}×{{ s }}</span>
        </div>
      </div>
    </div>

    <!-- 下载区 -->
    <div class="border border-border rounded-md bg-card mt-4">
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium">下载</span>
          <span class="text-[0.75rem] text-muted">导出 {{ downloadSize }}×{{ downloadSize }}px</span>
        </div>
      </div>

      <div class="p-6 flex flex-col gap-4">
        <!-- 下载尺寸 -->
        <div>
          <label for="qr-download-size-input" class="block text-[0.8125rem] text-muted font-medium mb-1.5">
            尺寸：{{ downloadSize }}px
          </label>
          <div class="flex items-center gap-3">
            <input
              type="range"
              :min="QR_DOWNLOAD_MIN_SIZE"
              :max="QR_DOWNLOAD_MAX_SIZE"
              step="128"
              v-model.number="downloadSize"
              class="flex-1 accent-accent cursor-pointer"
              aria-label="下载尺寸滑块"
            />
            <input
              id="qr-download-size-input"
              type="number"
              :min="QR_DOWNLOAD_MIN_SIZE"
              :max="QR_DOWNLOAD_MAX_SIZE"
              step="128"
              v-model.number="downloadSize"
              class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-22"
            />
          </div>
        </div>

        <!-- 下载按钮 -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="text.trim()"
            type="button"
            :class="[
              'w-9 h-9 flex items-center justify-center rounded-sm border',
              'bg-card text-muted',
              'transition-[background-color,border-color,color] duration-150',
              'hover:bg-hover hover:text-text',
              svgCopied ? 'border-success text-success' : 'border-border',
            ]"
            :disabled="!text.trim()"
            @click="copySvg"
          >
            <svg
              v-if="svgCopied"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            v-if="text.trim()"
            type="button"
            class="px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            @click="downloadPng"
          >
            下载 PNG
          </button>
          <button
            v-if="text.trim()"
            type="button"
            class="px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            @click="downloadSvg"
          >
            下载 SVG
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
