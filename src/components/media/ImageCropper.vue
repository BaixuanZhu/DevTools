/**
 * 嵌入式图片裁切组件。
 *
 * 基于 CropperJS v2 的交互式裁切器，支持自由框/比例预设/旋转/翻转/指定输出尺寸。
 * 在 onMounted 中动态导入 cropperjs 以规避 SSR 阶段 customElements 未定义的问题。
 *
 * Props:
 *   - src: string              图片源（object URL / dataURL）
 *   - fileName?: string        产出 File 的基础名（不含扩展名），默认 'cropped'
 *   - outputType?: 'image/png' | 'image/jpeg' | 'image/webp'  默认 'image/png'
 *   - outputQuality?: number   有损质量 0-1，默认 0.92
 *
 * Emits:
 *   - crop: (result: CropResult) => void
 *   - cancel: () => void
 */

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type CropperJS from 'cropperjs';
import OptionRadioGroup from '../ui/OptionRadioGroup.vue';
import ToggleSwitch from '../ui/ToggleSwitch.vue';
import {
  canvasToCropOutputs,
  type CropOutputType,
} from '../../utils/media/image-crop';

// ==================== 类型 ====================

/** 裁切结果 */
export interface CropResult {
  canvas: HTMLCanvasElement;
  blob: Blob;
  file: File;
  dataURL: string;
  width: number;
  height: number;
}

/** 比例预设值 */
type AspectPreset = 'free' | '1:1' | '16:9' | '4:3' | '3:2';

// ==================== Props & Emits ====================

interface Props {
  /** 图片源（object URL / dataURL） */
  src: string;
  /** 产出 File 的基础名（不含扩展名） */
  fileName?: string;
  /** 输出 MIME 类型 */
  outputType?: CropOutputType;
  /** 有损格式质量 0-1 */
  outputQuality?: number;
}

const props = withDefaults(defineProps<Props>(), {
  fileName: 'cropped',
  outputType: 'image/png',
  outputQuality: 0.92,
});

const emit = defineEmits<{
  /** 确认裁切后触发 */
  'crop': [result: CropResult];
  /** 取消裁切 */
  'cancel': [];
}>();

// ==================== Refs ====================

const imageRef = ref<HTMLImageElement | null>(null);
const cropper = ref<CropperJS.default | null>(null);
const cropperImage = ref<InstanceType<typeof CropperJS.CropperImage> | null>(null);
const cropperSelection = ref<InstanceType<typeof CropperJS.CropperSelection> | null>(null);

/** 比例预设 */
const aspectPreset = ref<AspectPreset>('free');

/** 翻转状态 */
const flipHorizontal = ref(false);
const flipVertical = ref(false);

/** 是否启用指定输出尺寸 */
const customSizeEnabled = ref(false);
/** 指定输出宽度 */
const customWidth = ref<number | null>(null);
/** 指定输出高度 */
const customHeight = ref<number | null>(null);

/** 是否正在处理 */
const isProcessing = ref(false);

// ==================== 常量 ====================

/** 比例预设选项 */
const ASPECT_OPTIONS: { value: AspectPreset; label: string }[] = [
  { value: 'free', label: '自由' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
];

/** 比例预设到数值的映射（自由模式为 NaN） */
const ASPECT_RATIO_MAP: Record<AspectPreset, number> = {
  free: NaN,
  '1:1': 1,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
};

// ==================== 初始化与销毁 ====================

/**
 * 初始化 CropperJS 实例。
 * 在浏览器端动态导入 cropperjs，避免 SSR 阶段调用 customElements.define。
 */
async function initCropper(): Promise<void> {
  if (!imageRef.value) return;

  // 若已有实例，先销毁
  if (cropper.value) {
    cropper.value.destroy();
    cropper.value = null;
    cropperImage.value = null;
    cropperSelection.value = null;
  }

  try {
    const { default: Cropper } = await import('cropperjs');

    const instance = new Cropper(imageRef.value, {
      template: `
        <cropper-canvas background style="height:100%">
          <cropper-image rotatable scalable translatable></cropper-image>
          <cropper-shade hidden></cropper-shade>
          <cropper-handle action="select" plain></cropper-handle>
          <cropper-selection initial-coverage="0.8" movable resizable>
            <cropper-grid role="grid" covered></cropper-grid>
            <cropper-crosshair centered></cropper-crosshair>
            <cropper-handle action="move" theme-color="rgba(255,255,255,0.35)"></cropper-handle>
            <cropper-handle action="n-resize"></cropper-handle>
            <cropper-handle action="e-resize"></cropper-handle>
            <cropper-handle action="s-resize"></cropper-handle>
            <cropper-handle action="w-resize"></cropper-handle>
            <cropper-handle action="ne-resize"></cropper-handle>
            <cropper-handle action="nw-resize"></cropper-handle>
            <cropper-handle action="se-resize"></cropper-handle>
            <cropper-handle action="sw-resize"></cropper-handle>
          </cropper-selection>
        </cropper-canvas>`,
    });

    cropper.value = instance;
    cropperImage.value = instance.getCropperImage();
    cropperSelection.value = instance.getCropperSelection();

    // 应用当前比例预设
    applyAspectRatio();
  } catch {
    dispatchToast('裁切器初始化失败，请刷新页面重试');
  }
}

/**
 * 销毁 CropperJS 实例并释放引用。
 */
function destroyCropper(): void {
  if (cropper.value) {
    cropper.value.destroy();
    cropper.value = null;
    cropperImage.value = null;
    cropperSelection.value = null;
  }
}

onMounted(() => {
  void initCropper();
});

onBeforeUnmount(() => {
  destroyCropper();
});

// ==================== 监听 ====================

watch(() => props.src, () => {
  // src 变化时销毁旧实例并重建
  destroyCropper();
  // 等待 DOM 更新后重新初始化
  requestAnimationFrame(() => {
    void initCropper();
  });
});

watch(aspectPreset, () => {
  applyAspectRatio();
});

// ==================== 比例控制 ====================

/**
 * 将当前比例预设应用到裁切选区。
 */
function applyAspectRatio(): void {
  if (!cropperSelection.value) return;
  cropperSelection.value.aspectRatio = ASPECT_RATIO_MAP[aspectPreset.value];
}

// ==================== 旋转与翻转 ====================

/**
 * 向左旋转 90 度。
 */
function rotateLeft(): void {
  if (!cropperImage.value) return;
  cropperImage.value.$rotate('-90deg');
}

/**
 * 向右旋转 90 度。
 */
function rotateRight(): void {
  if (!cropperImage.value) return;
  cropperImage.value.$rotate('90deg');
}

/**
 * 水平翻转。
 */
function flipH(): void {
  if (!cropperImage.value) return;
  flipHorizontal.value = !flipHorizontal.value;
  cropperImage.value.$scale(flipHorizontal.value ? -1 : 1, flipVertical.value ? -1 : 1);
}

/**
 * 垂直翻转。
 */
function flipV(): void {
  if (!cropperImage.value) return;
  flipVertical.value = !flipVertical.value;
  cropperImage.value.$scale(flipHorizontal.value ? -1 : 1, flipVertical.value ? -1 : 1);
}

// ==================== 导出 ====================

/**
 * 触发全局 Toast 通知。
 * @param message 提示消息
 */
function dispatchToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/**
 * 确认裁切：导出 canvas 并转换为多种形态后 emit 'crop'。
 */
async function handleCrop(): Promise<void> {
  if (!cropperSelection.value || isProcessing.value) return;

  isProcessing.value = true;
  try {
    let sizeOpts: { width: number; height: number } | undefined;
    if (customSizeEnabled.value && customWidth.value && customHeight.value) {
      sizeOpts = { width: customWidth.value, height: customHeight.value };
    } else if (cropperImage.value) {
      // 默认按原图分辨率导出：cropper-selection 的 width/height 是画布显示像素，
      // 需除以 cropper-image 当前缩放（含旋转，用 hypot 取模），否则裁切结果会被
      // 显示缩放插值放大，画质虚高且体积虚增。
      const t = cropperImage.value.$getTransform();
      const sx = Math.hypot(t[0], t[1]) || 1;
      const sy = Math.hypot(t[2], t[3]) || 1;
      sizeOpts = {
        width: Math.max(1, Math.round(cropperSelection.value.width / sx)),
        height: Math.max(1, Math.round(cropperSelection.value.height / sy)),
      };
    }

    const canvas = await cropperSelection.value.$toCanvas(sizeOpts);
    const outputs = await canvasToCropOutputs(canvas, {
      type: props.outputType,
      quality: props.outputQuality,
      fileName: props.fileName,
    });

    emit('crop', {
      canvas,
      blob: outputs.blob,
      file: outputs.file,
      dataURL: outputs.dataURL,
      width: canvas.width,
      height: canvas.height,
    });
  } catch (e) {
    dispatchToast(e instanceof Error ? e.message : '裁切导出失败，请重试');
  } finally {
    isProcessing.value = false;
  }
}

/**
 * 取消裁切。
 */
function handleCancel(): void {
  emit('cancel');
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 裁切画布区 -->
    <div class="relative w-full h-90 bg-white border border-border rounded-sm overflow-hidden">
      <img
        ref="imageRef"
        :src="src"
        alt="待裁切图片"
        class="block w-full h-full object-contain"
      />
    </div>

    <!-- 控制栏 -->
    <div class="flex flex-col gap-4">
      <!-- 比例预设 -->
      <section class="flex flex-col gap-2">
        <h3 class="text-[0.8125rem] font-semibold text-text">裁切比例</h3>
        <OptionRadioGroup
          v-model="aspectPreset"
          :options="ASPECT_OPTIONS"
          label="比例"
        />
      </section>

      <!-- 旋转/翻转 -->
      <section class="flex flex-col gap-2">
        <h3 class="text-[0.8125rem] font-semibold text-text">旋转与翻转</h3>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 左转 -->
          <button
            type="button"
            title="向左旋转"
            aria-label="向左旋转"
            class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
            @click="rotateLeft"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <!-- 右转 -->
          <button
            type="button"
            title="向右旋转"
            aria-label="向右旋转"
            class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
            @click="rotateRight"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <!-- 水平翻转 -->
          <button
            type="button"
            title="水平翻转"
            aria-label="水平翻转"
            class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
            @click="flipH"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9" />
              <path d="M12 4h9" />
              <path d="M3 12h.01" />
              <path d="M3 16h.01" />
              <path d="M3 8h.01" />
              <path d="M3 20h.01" />
              <path d="M3 4h.01" />
              <path d="M8 4v16" />
            </svg>
          </button>
          <!-- 垂直翻转 -->
          <button
            type="button"
            title="垂直翻转"
            aria-label="垂直翻转"
            class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
            @click="flipV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12h16" />
              <path d="M4 16h.01" />
              <path d="M4 8h.01" />
              <path d="M4 20h.01" />
              <path d="M4 4h.01" />
              <path d="M8 4v16" />
            </svg>
          </button>
        </div>
      </section>

      <!-- 输出尺寸 -->
      <section class="flex flex-col gap-2">
        <ToggleSwitch v-model="customSizeEnabled" label="指定输出尺寸" />
        <div v-if="customSizeEnabled" class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">宽</span>
            <input
              v-model.number="customWidth"
              type="number"
              min="1"
              placeholder="宽度"
              aria-label="输出宽度"
              class="bg-card text-text border border-border rounded-sm px-3 py-2 font-mono text-sm w-24 focus:border-accent focus:outline-none"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted">高</span>
            <input
              v-model.number="customHeight"
              type="number"
              min="1"
              placeholder="高度"
              aria-label="输出高度"
              class="bg-card text-text border border-border rounded-sm px-3 py-2 font-mono text-sm w-24 focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- 底部操作 -->
    <div class="flex items-center gap-3 pt-2 border-t border-border">
      <button
        type="button"
        class="bg-accent text-white rounded-sm px-4 py-2 transition-[filter] duration-150 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isProcessing"
        @click="handleCrop"
      >
        {{ isProcessing ? '处理中…' : '确认裁切' }}
      </button>
      <button
        type="button"
        class="bg-card text-text border border-border rounded-sm px-4 py-2 transition-[background-color] duration-150 hover:bg-hover"
        :disabled="isProcessing"
        @click="handleCancel"
      >
        取消
      </button>
    </div>
  </div>
</template>
