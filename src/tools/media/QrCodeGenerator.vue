<script setup lang="ts">
/**
 * 二维码生成器组件。
 *
 * - 实时监听输入与配置变化，自动重生成 PNG/SVG 预览
 * - 支持自定义前景色、背景色、容错级别、尺寸
 * - 可下载 PNG 与 SVG 文件，复制 SVG 源码
 * - 颜色对比度过低时给出警告
 */
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ColorInput from '../../components/ui/ColorInput.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  generateQrPngDataUrl,
  generateQrSvgString,
  getContrastWarning,
  downloadFile,
  stripSvgSize,
  QR_ERROR_LEVELS,
  QR_DEFAULT_FOREGROUND,
  QR_DEFAULT_BACKGROUND,
  QR_DEFAULT_SIZE,
  QR_MIN_SIZE,
  QR_MAX_SIZE,
  type QrErrorLevel,
} from '../../utils/media/qr-code';

// 状态
const text = ref('');
const foreground = ref(QR_DEFAULT_FOREGROUND);
const background = ref(QR_DEFAULT_BACKGROUND);
const errorLevel = ref<QrErrorLevel>('M');
const size = ref(QR_DEFAULT_SIZE);

const qrSvg = ref('');
const qrDataUrl = ref('');
const errorMsg = ref('');
const isGenerating = ref(false);

const textInputRef = ref<HTMLTextAreaElement | null>(null);

// 容错级别选项（供 OptionRadioGroup 消费）
const errorLevelOptions = QR_ERROR_LEVELS.map((o) => ({ value: o.value, label: o.label }));

// 当前容错级别的中文描述
const currentLevelDescription = computed(
  () => QR_ERROR_LEVELS.find((o) => o.value === errorLevel.value)?.description ?? '',
);

// 颜色对比度警告
const contrastWarning = computed(() => getContrastWarning(foreground.value, background.value));

/**
 * 用于预览的 SVG：剥离根标签的 width/height 让浏览器按 viewBox 自适应父容器宽度。
 * 原始 qrSvg 不变，复制/下载 SVG 仍使用带固定像素的版本（扫码软件依赖此格式）。
 */
const qrSvgPreview = computed(() => (qrSvg.value ? stripSvgSize(qrSvg.value) : ''));

/** 预览容器宽度上限（与下方 max-w-[480px] 同步），超过此尺寸时显示"已缩放"提示 */
const PREVIEW_MAX_WIDTH = 480;
const isPreviewScaled = computed(() => size.value > PREVIEW_MAX_WIDTH);

/** 预览白框的实际显示宽度：真实尺寸不超过 PREVIEW_MAX_WIDTH，否则等比缩放到上限 */
const previewBoxWidth = computed(() => Math.min(size.value, PREVIEW_MAX_WIDTH));

// 自动重生成：debounce 150ms
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch([text, foreground, background, errorLevel, size], () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void regenerate();
  }, 150);
});

/**
 * 重新生成二维码：清空旧值后并行生成 SVG 与 PNG DataURL。
 * 文本为空时静默重置，不报错。
 */
async function regenerate() {
  errorMsg.value = '';
  if (!text.value.trim()) {
    qrSvg.value = '';
    qrDataUrl.value = '';
    return;
  }
  isGenerating.value = true;
  try {
    const opts = {
      size: size.value,
      errorLevel: errorLevel.value,
      foreground: foreground.value,
      background: background.value,
    };
    const [svg, dataUrl] = await Promise.all([
      generateQrSvgString(text.value, opts),
      generateQrPngDataUrl(text.value, opts),
    ]);
    qrSvg.value = svg;
    qrDataUrl.value = dataUrl;
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '生成二维码时出错';
    qrSvg.value = '';
    qrDataUrl.value = '';
  } finally {
    isGenerating.value = false;
  }
}

/** 尺寸越界时夹紧到合法范围 */
watch(size, (v) => {
  if (v < QR_MIN_SIZE) size.value = QR_MIN_SIZE;
  if (v > QR_MAX_SIZE) size.value = QR_MAX_SIZE;
});

/** 触发全局 toast 通知 */
function showToast(type: 'success' | 'error', message: string) {
  document.dispatchEvent(new CustomEvent('toast', { detail: { type, message } }));
}

/** 下载 PNG 格式 */
function downloadPng() {
  if (!qrDataUrl.value) return;
  downloadFile(qrDataUrl.value, `qrcode-${Date.now()}.png`);
  showToast('success', '已下载 PNG');
}

/** 下载 SVG 格式 */
function downloadSvg() {
  if (!qrSvg.value) return;
  const blob = new Blob([qrSvg.value], { type: 'image/svg+xml' });
  downloadFile(blob, `qrcode-${Date.now()}.svg`);
  showToast('success', '已下载 SVG');
}

/** 填入示例数据 */
function handleExample() {
  text.value = 'https://tools.openbong.cloud';
  foreground.value = QR_DEFAULT_FOREGROUND;
  background.value = QR_DEFAULT_BACKGROUND;
  errorLevel.value = 'M';
  size.value = QR_DEFAULT_SIZE;
}

/** 清空文本与结果，保留颜色与容错级别 */
function handleClear() {
  text.value = '';
  qrSvg.value = '';
  qrDataUrl.value = '';
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
      description="输入文本生成二维码，支持自定义前景色、背景色、尺寸和容错级别，可下载 PNG 与 SVG 两种格式"
      @example="handleExample"
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

      <!-- 尺寸 -->
      <div>
        <label for="qr-size-input" class="block text-[0.8125rem] text-muted font-medium mb-1.5">
          尺寸：{{ size }}px
        </label>
        <div class="flex items-center gap-3">
          <input
            type="range"
            :min="QR_MIN_SIZE"
            :max="QR_MAX_SIZE"
            step="32"
            v-model.number="size"
            class="flex-1 accent-accent cursor-pointer"
            aria-label="二维码尺寸滑块"
          />
          <input
            id="qr-size-input"
            type="number"
            :min="QR_MIN_SIZE"
            :max="QR_MAX_SIZE"
            step="32"
            v-model.number="size"
            class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[88px]"
          />
        </div>
      </div>

      <!-- 错误信息 -->
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
    </div>

    <!-- 结果区 -->
    <div class="border border-border rounded-md bg-card mt-4">
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium">预览</span>
          <span v-if="qrSvg && isPreviewScaled" class="text-[0.75rem] text-muted">
            导出 {{ size }}×{{ size }}px · 预览已等比缩放
          </span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <CopyButton v-if="qrSvg" :text="qrSvg" label="复制 SVG" />
          <button
            v-if="qrDataUrl"
            type="button"
            class="px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            @click="downloadPng"
          >
            下载 PNG
          </button>
          <button
            v-if="qrSvg"
            type="button"
            class="px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            @click="downloadSvg"
          >
            下载 SVG
          </button>
          <ClearButton @clear="handleClear" />
        </div>
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
      <div v-else-if="qrSvg" class="flex items-center justify-center p-6 max-h-[480px] overflow-hidden">
        <div
          class="border border-border rounded-sm p-3 bg-white inline-block [&_svg]:block [&_svg]:w-full [&_svg]:h-auto"
          :style="{ width: previewBoxWidth + 'px' }"
          v-html="qrSvgPreview"
        ></div>
      </div>
    </div>
  </div>
</template>
