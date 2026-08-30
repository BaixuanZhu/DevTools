<script setup lang="ts">
/**
 * ICO 制作面板（IcoMaker 工具私有，模式 A「制作 ICO」）。
 *
 * 创作三段式：导入（拖入 / 点击 / Ctrl+V 粘贴）→ 内嵌 ImageCropper 裁切
 * （默认 1:1，含"跳过裁切"快速路径）→ 参数（尺寸多选 / 适配 / 锚点 / 填白）
 * 与逐尺寸预览 + 下载。预览与单尺寸 PNG 复用 encoders/ico 的 rasterizeToPng，
 * 保证与 .ico 内封装图像同一渲染口径。
 *
 * 资源约定：originalUrl / croppedUrl / 逐尺寸预览 URL / ImageBitmap 均在本
 * 组件创建，变更即释放（revoke / close），组件卸载时统一清理。
 */
import { computed, onUnmounted, ref, watch } from 'vue';
import FileDropzone from '../ui/FileDropzone.vue';
import OptionRadioGroup from '../ui/OptionRadioGroup.vue';
import SelectListbox from '../ui/SelectListbox.vue';
import ToggleSwitch from '../ui/ToggleSwitch.vue';
import ImageCropper, { type CropResult } from './ImageCropper.vue';
import {
  encodeIco,
  rasterizeToPng,
  ICO_SIZE_OPTIONS,
  DEFAULT_ICO_SIZES,
  type IcoFit,
  type IcoAnchor,
} from '../../utils/media/encoders/ico';
import { loadImage, checkCanvasLimits } from '../../utils/media/image-convert';

/** 创作流程阶段 */
type Phase = 'import' | 'crop' | 'params';

/** 单尺寸预览项（真实像素渲染 + 下载用 PNG blob） */
interface SizePreview {
  /** 预览尺寸（px，正方形边长） */
  size: number;
  /** PNG object URL（组件内创建，变更即 revoke） */
  url: string;
  /** PNG blob（单尺寸下载复用，避免重复编码） */
  blob: Blob;
}

// ==================== 流程状态 ====================

const phase = ref<Phase>('import');
/** 导入的原始文件（"跳过裁切"路径与重新裁切都需要） */
const importFile = ref<File | null>(null);
/** 原图 object URL（供裁切画布复用，重新裁切不重复上传） */
const originalUrl = ref('');
/** 裁切结果 object URL（参数段摘要缩略图用；未裁切时为空回退原图） */
const croppedUrl = ref('');
/** 下载命名用的文件基础名（去扩展名） */
const baseName = ref('icon');
/** 创作位图：裁切结果位图，或跳过裁切时的原图位图 */
const croppedBitmap = ref<ImageBitmap | null>(null);
/** 创作位图尺寸（px） */
const croppedSize = ref({ width: 0, height: 0 });
/** 创作位图是否经过裁切（false = 跳过裁切用原图） */
const isCropped = ref(false);
/** 面板内联错误（中文，PRODUCT.md 错误处理口径） */
const errorMsg = ref('');

// ==================== 参数 ====================

/** 输出尺寸多选（默认 favicon 标准三尺寸） */
const selectedSizes = ref<number[]>([...DEFAULT_ICO_SIZES]);
/** 适配方式：cover=裁切填满，contain=留白完整 */
const fit = ref<IcoFit>('cover');
/** cover 模式九宫格锚点 */
const anchor = ref<IcoAnchor>('center');
/** 留白/透出区域填白开关（默认关，保透明） */
const fillBackground = ref(false);

/** 适配方式选项 */
const FIT_OPTIONS: { value: IcoFit; label: string }[] = [
  { value: 'cover', label: '裁切填满' },
  { value: 'contain', label: '留白完整' },
];

/** cover 锚点选项（九宫格） */
const ANCHOR_OPTIONS: { value: IcoAnchor; label: string }[] = [
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

/** 创作位图是否为正方形（正方形直缩放，适配/锚点不参与计算） */
const isSquare = computed(
  () => croppedSize.value.width > 0 && croppedSize.value.width === croppedSize.value.height,
);

// ==================== 逐尺寸预览 ====================

const previews = ref<SizePreview[]>([]);
/** 预览重建代际令牌：参数快速切换时丢弃过期的异步渲染结果 */
let previewToken = 0;

/**
 * 按当前参数重建逐尺寸预览。
 *
 * 串行渲染各尺寸并在每步检查令牌，保证过期请求不写入状态；
 * 重建前释放旧预览 URL，防止 object URL 泄漏。
 */
async function rebuildPreviews(): Promise<void> {
  const bitmap = croppedBitmap.value;
  const token = ++previewToken;
  if (!bitmap) {
    disposePreviews();
    return;
  }
  const opts = { fit: fit.value, anchor: anchor.value, fillBackground: fillBackground.value };
  const results: SizePreview[] = [];
  /** 过期请求中途退出：本轮迭代已创建但未挂载的 URL 也要释放，否则快速切参时逐轮遗弃 */
  const discardResults = (): void => {
    for (const r of results) URL.revokeObjectURL(r.url);
  };
  for (const size of selectedSizes.value) {
    try {
      const png = await rasterizeToPng(bitmap, size, opts);
      if (token !== previewToken) {
        discardResults();
        return;
      }
      const blob = new Blob([png], { type: 'image/png' });
      results.push({ size, url: URL.createObjectURL(blob), blob });
    } catch (e) {
      if (token !== previewToken) {
        discardResults();
        return;
      }
      errorMsg.value = e instanceof Error ? e.message : '预览生成失败，请重试';
      discardResults();
      return;
    }
  }
  disposePreviews();
  previews.value = results;
}

/** 释放当前全部预览 object URL */
function disposePreviews(): void {
  for (const p of previews.value) URL.revokeObjectURL(p.url);
  previews.value = [];
}

watch(
  [croppedBitmap, () => [...selectedSizes.value], fit, anchor, fillBackground],
  () => {
    void rebuildPreviews();
  },
);

// ==================== 流程流转 ====================

/**
 * 导入图片：记录基础名、创建原图 object URL 并进入裁切段。
 * 重复导入（含粘贴）会先释放上一轮的位图与 URL。
 */
function handleImport(file: File): void {
  errorMsg.value = '';
  disposeBitmap();
  importFile.value = file;
  baseName.value = file.name.replace(/\.[^.]+$/, '') || 'icon';
  originalUrl.value = URL.createObjectURL(file);
  isCropped.value = false;
  phase.value = 'crop';
}

/**
 * 确认裁切：canvas 转 ImageBitmap，超 canvas 上限给中文错误。
 */
async function handleCrop(result: CropResult): Promise<void> {
  errorMsg.value = '';
  try {
    const bitmap = await createImageBitmap(result.canvas);
    const limit = checkCanvasLimits(bitmap.width, bitmap.height);
    if (!limit.ok) {
      bitmap.close?.();
      errorMsg.value = limit.error!;
      return;
    }
    replaceBitmap(bitmap, result.width, result.height);
    croppedUrl.value = URL.createObjectURL(result.blob);
    isCropped.value = true;
    phase.value = 'params';
  } catch {
    errorMsg.value = '裁切结果处理失败，请重试';
  }
}

/**
 * 跳过裁切快速路径：直接用原图整图生成（EXIF 方向由 loadImage 校正），
 * 非正方形由适配方式兜底。
 */
async function skipCrop(): Promise<void> {
  const file = importFile.value;
  if (!file) return;
  errorMsg.value = '';
  try {
    const img = await loadImage(file);
    const limit = checkCanvasLimits(img.width, img.height);
    if (!limit.ok) {
      img.bitmap.close?.();
      errorMsg.value = limit.error!;
      return;
    }
    replaceBitmap(img.bitmap, img.width, img.height);
    isCropped.value = false;
    phase.value = 'params';
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '图片解码失败，请重试';
  }
}

/** 替换创作位图并释放旧位图与旧裁切缩略 URL */
function replaceBitmap(bitmap: ImageBitmap, width: number, height: number): void {
  croppedBitmap.value?.close?.();
  if (croppedUrl.value) {
    URL.revokeObjectURL(croppedUrl.value);
    croppedUrl.value = '';
  }
  croppedBitmap.value = bitmap;
  croppedSize.value = { width, height };
}

/**
 * 重新裁切：回到裁切段复用原图 object URL（ImageCropper 因阶段 v-if 重挂，
 * 内部 watch(src) 亦支持同源重建），已选参数全部保留。
 */
function recrop(): void {
  errorMsg.value = '';
  disposePreviews();
  phase.value = 'crop';
}

/** 重新选择图片：释放全部资源并重置参数，回到导入段 */
function reselect(): void {
  errorMsg.value = '';
  disposePreviews();
  disposeBitmap();
  importFile.value = null;
  isCropped.value = false;
  selectedSizes.value = [...DEFAULT_ICO_SIZES];
  fit.value = 'cover';
  anchor.value = 'center';
  fillBackground.value = false;
  phase.value = 'import';
}

/** 释放创作位图与裁切缩略 URL（重新导入前调用） */
function disposeBitmap(): void {
  croppedBitmap.value?.close?.();
  croppedBitmap.value = null;
  croppedSize.value = { width: 0, height: 0 };
  if (croppedUrl.value) {
    URL.revokeObjectURL(croppedUrl.value);
    croppedUrl.value = '';
  }
  if (originalUrl.value) {
    URL.revokeObjectURL(originalUrl.value);
    originalUrl.value = '';
  }
}

// ==================== 下载 ====================

const isEncoding = ref(false);

/** 勾选尺寸变更（保持 ICO_SIZE_OPTIONS 的规范顺序） */
function toggleSize(size: number, checked: boolean): void {
  const set = new Set(selectedSizes.value);
  if (checked) set.add(size);
  else set.delete(size);
  selectedSizes.value = ICO_SIZE_OPTIONS.filter((s) => set.has(s));
}

/**
 * 触发浏览器下载，完成后延迟释放临时 object URL（立即 revoke 部分浏览器会中断下载）。
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 下载多尺寸 .ico：懒触发 encodeIco 封装（与预览同一渲染口径）。
 */
async function downloadIco(): Promise<void> {
  const bitmap = croppedBitmap.value;
  if (!bitmap || selectedSizes.value.length === 0 || isEncoding.value) return;
  isEncoding.value = true;
  try {
    const result = await encodeIco(bitmap, {
      sizes: selectedSizes.value,
      fit: fit.value,
      anchor: anchor.value,
      fillBackground: fillBackground.value,
    });
    downloadBlob(result.blob, `${baseName.value}.ico`);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'ICO 编码失败，请重试';
  } finally {
    isEncoding.value = false;
  }
}

/** 下载单尺寸 PNG（直接复用预览阶段已编码的 blob） */
function downloadPng(preview: SizePreview): void {
  downloadBlob(preview.blob, `${baseName.value}-${preview.size}.png`);
}

// ==================== 生命周期 ====================

onUnmounted(() => {
  previewToken++; // 丢弃在途预览渲染
  disposePreviews();
  disposeBitmap();
  importFile.value = null;
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="errorMsg" class="text-[0.8125rem] text-error m-0" role="alert">{{ errorMsg }}</p>

    <!-- 段 1：导入 -->
    <FileDropzone
      v-if="phase === 'import'"
      v-model="importFile"
      accept="image/*"
      :max-size="50 * 1024 * 1024"
      enable-paste
      @select="handleImport"
      @error="errorMsg = $event"
    >
      <div class="text-sm text-foreground">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
      <div class="text-xs text-muted-foreground mt-1">单张图片，导入后进入裁切创作，单张上限 50MB</div>
    </FileDropzone>

    <!-- 段 2：裁切创作 -->
    <template v-else-if="phase === 'crop'">
      <ImageCropper
        :src="originalUrl"
        :file-name="baseName"
        default-aspect="1:1"
        @crop="handleCrop"
        @cancel="reselect"
      />
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="bg-card text-foreground border border-border rounded-sm px-4 py-2 transition-[background-color] duration-150 hover:bg-accent"
          @click="skipCrop"
        >跳过裁切，用原图生成</button>
        <button
          type="button"
          class="bg-card text-foreground border border-border rounded-sm px-4 py-2 transition-[background-color] duration-150 hover:bg-accent"
          @click="reselect"
        >重新选择图片</button>
      </div>
    </template>

    <!-- 段 3：参数 + 逐尺寸预览 + 下载 -->
    <template v-else>
      <!-- 源图摘要 -->
      <div class="flex items-center gap-3 p-3 border border-border rounded-sm bg-card">
        <img
          :src="croppedUrl || originalUrl"
          alt="创作源图"
          class="w-14 h-14 rounded-sm bg-accent object-cover shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div class="text-sm text-foreground truncate">{{ baseName }}</div>
          <div class="text-xs text-muted-foreground font-mono mt-0.5">
            {{ isCropped ? '裁切结果' : '原图（未裁切）' }} · {{ croppedSize.width }}×{{ croppedSize.height }}
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 bg-card text-foreground border border-border rounded-sm px-3 py-1.5 text-[0.8125rem] transition-[background-color] duration-150 hover:bg-accent"
          @click="recrop"
        >重新裁切</button>
        <button
          type="button"
          class="shrink-0 bg-card text-foreground border border-border rounded-sm px-3 py-1.5 text-[0.8125rem] transition-[background-color] duration-150 hover:bg-accent"
          @click="reselect"
        >重新选择图片</button>
      </div>

      <!-- 输出尺寸多选 -->
      <section class="flex flex-col gap-2">
        <h3 class="text-[0.8125rem] font-semibold text-foreground m-0">输出尺寸</h3>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label
            v-for="s in ICO_SIZE_OPTIONS"
            :key="s"
            class="flex items-center gap-1.5 text-[0.8125rem] text-foreground cursor-pointer select-none"
          >
            <input
              type="checkbox"
              class="cursor-pointer accent-accent"
              :checked="selectedSizes.includes(s)"
              :aria-label="`输出尺寸 ${s} 像素`"
              @change="toggleSize(s, ($event.target as HTMLInputElement).checked)"
            />
            {{ s }} px
          </label>
        </div>
        <p v-if="selectedSizes.length === 0" class="text-[0.8125rem] text-error m-0">
          请至少选择一个输出尺寸
        </p>
      </section>

      <!-- 适配方式与填白 -->
      <section class="flex flex-col gap-2">
        <h3 class="text-[0.8125rem] font-semibold text-foreground m-0">适配方式</h3>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
          <OptionRadioGroup v-model="fit" :options="FIT_OPTIONS" label="适配" inline-label />
          <div v-if="fit === 'cover'" class="flex items-center gap-2">
            <span class="text-[0.8125rem] text-muted-foreground">锚点</span>
            <SelectListbox
              class="w-28"
              :model-value="anchor"
              :options="ANCHOR_OPTIONS"
              aria-label="裁切锚点"
              @update:model-value="(v) => (anchor = v as IcoAnchor)"
            />
          </div>
          <ToggleSwitch v-model="fillBackground" label="留白填白" :show-status="false" />
        </div>
        <p class="text-[0.8125rem] text-muted-foreground m-0">
          {{
            isSquare
              ? '当前源图为正方形，直接等比缩放到各尺寸，适配方式与锚点不参与计算'
              : '仅当源图非正方形时参与计算：裁切填满按锚点截取正方形，留白完整等比放入；留白/透出区域默认保持透明'
          }}
        </p>
      </section>

      <!-- 逐尺寸预览 -->
      <section class="flex flex-col gap-2">
        <h3 class="text-[0.8125rem] font-semibold text-foreground m-0">逐尺寸预览（真实像素）</h3>
        <div v-if="previews.length" class="flex flex-wrap items-start gap-4">
          <div v-for="p in previews" :key="p.size" class="flex flex-col items-center gap-1.5">
            <div
              class="p-1 border border-border rounded-sm bg-card bg-[image:repeating-conic-gradient(var(--color-muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
            >
              <img
                :src="p.url"
                :width="p.size"
                :height="p.size"
                :alt="`${p.size}×${p.size} 预览`"
                class="block"
              />
            </div>
            <div class="text-xs text-muted-foreground font-mono tabular-nums">{{ p.size }} × {{ p.size }}</div>
            <button
              type="button"
              class="bg-card text-foreground border border-border rounded-sm px-2.5 py-1 text-[0.8125rem] transition-[background-color] duration-150 hover:bg-accent"
              @click="downloadPng(p)"
            >下载 PNG</button>
          </div>
        </div>
        <p v-else class="text-[0.8125rem] text-muted-foreground m-0">勾选输出尺寸后生成预览</p>
      </section>

      <!-- 下载 .ico -->
      <div class="flex items-center gap-3 pt-3 border-t border-border">
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-sm px-4 py-2 transition-[filter] duration-150 active:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="selectedSizes.length === 0 || isEncoding"
          @click="downloadIco"
        >
          {{ isEncoding ? '编码中…' : `下载 .ico（${selectedSizes.length} 个尺寸）` }}
        </button>
        <span class="text-[0.8125rem] text-muted-foreground">{{ baseName }}.ico · PNG 多尺寸封装</span>
      </div>
    </template>
  </div>
</template>
