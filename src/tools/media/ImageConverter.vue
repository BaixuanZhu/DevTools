<script setup lang="ts">
/**
 * 图片转换与压缩工具（批量）。
 *
 * 多图导入 → 全局统一参数转换 → 列表展示 + 逐行预览/裁切/下载 + ZIP 打包。
 * 状态与队列由 useImageBatch 管理；本组件负责导入交互与子组件组装。
 */
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ImageConverterControls from '../../components/media/ImageConverterControls.vue';
import ImageBatchRow from '../../components/media/ImageBatchRow.vue';
import ImageLightbox, { type LightboxSlide } from '../../components/media/ImageLightbox.vue';
import ImageCropper, { type CropResult } from '../../components/media/ImageCropper.vue';
import { useImageBatch, type ConvertParams } from '../../composables/useImageBatch';
import { checkCanvasLimits, DEFAULT_QUALITY } from '../../utils/media/image-convert';
import { DEFAULT_ICO_SIZES } from '../../utils/media/encoders/ico';

const params = reactive<ConvertParams>({
  format: 'webp',
  quality: DEFAULT_QUALITY,
  scale: 100,
  eraseExif: true,
  icoSizes: [...DEFAULT_ICO_SIZES],
  icoFit: 'cover',
  icoAnchor: 'center',
});

const batch = useImageBatch(params);
const { items, errorMsg, doneCount } = batch;

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

/** 灯箱状态 */
const lightboxStart = ref(-1);
const lightboxSlides = computed<LightboxSlide[]>(() =>
  items.value
    .filter((it) => it.status === 'done' && it.result)
    .map((it) => ({
      id: it.id,
      url: it.result!.previewUrl ?? it.result!.url,
      name: it.name,
      width: it.result!.width,
      height: it.result!.height,
      size: it.result!.size,
    })),
);

/** 裁切弹窗状态：当前裁切项 id */
const cropId = ref<string | null>(null);
const cropItem = computed(() => items.value.find((it) => it.id === cropId.value) ?? null);
const cropBaseName = computed(() => cropItem.value?.name.replace(/\.[^.]+$/, '') || 'image');

function pick(): void {
  fileInputRef.value?.click();
}
function onChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) void batch.addFiles(Array.from(input.files));
  input.value = '';
}
function onDrop(e: DragEvent): void {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files?.length) void batch.addFiles(Array.from(files));
}
function onDragOver(e: DragEvent): void {
  e.preventDefault();
  isDragging.value = true;
}
function onDragLeave(): void {
  isDragging.value = false;
}
async function onPaste(e: ClipboardEvent): Promise<void> {
  const list = e.clipboardData?.items;
  if (!list) return;
  const files: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (it?.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) await batch.addFiles(files);
}

/** 打开某项预览（定位到 slides 中的索引） */
function openPreview(id: string): void {
  const idx = lightboxSlides.value.findIndex((s) => s.id === id);
  lightboxStart.value = idx >= 0 ? idx : 0;
}

/** 裁切完成：生成位图、尺寸校验、交给 composable 替换 */
async function onCropDone(result: CropResult): Promise<void> {
  const id = cropId.value;
  if (!id) return;
  const bitmap = await createImageBitmap(result.canvas);
  const limit = checkCanvasLimits(bitmap.width, bitmap.height);
  if (!limit.ok) {
    bitmap.close?.();
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: limit.error } }));
    return;
  }
  await batch.replaceWithCrop(id, result.blob, bitmap, result.width, result.height);
  cropId.value = null;
}

function downloadAll(): void {
  void batch.downloadAllZip();
  document.dispatchEvent(new CustomEvent('toast', { detail: { message: '已开始打包下载' } }));
}

onMounted(() => window.addEventListener('paste', onPaste));
onUnmounted(() => {
  window.removeEventListener('paste', onPaste);
  batch.clearAll();
});
</script>

<template>
  <div>
    <ToolHeader
      title="图片转换与压缩"
      description="批量将 PNG / JPG / WebP / AVIF 等格式互转、质量压缩与尺寸缩放，支持 EXIF 隐私擦除、逐图裁切与多尺寸 ICO 导出，纯浏览器端本地处理"
      :show-example="false"
    />

    <!-- 全局控件栏 -->
    <div class="border border-border rounded-sm p-4 mb-4">
      <ImageConverterControls :params="params" :has-items="items.length > 0" />
    </div>

    <!-- 操作条 -->
    <div class="flex items-center justify-end gap-2 mb-3">
      <button
        type="button" :disabled="doneCount === 0"
        class="px-3 py-1.5 text-[0.8125rem] rounded-sm border border-border text-text bg-card hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
        @click="downloadAll"
      >下载全部 ZIP</button>
      <button
        type="button" :disabled="items.length === 0"
        class="px-3 py-1.5 text-[0.8125rem] rounded-sm border border-border text-text bg-card hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
        @click="batch.clearAll()"
      >清空</button>
    </div>

    <!-- 列表 / 空态 -->
    <div
      v-if="items.length === 0"
      class="border-2 border-dashed rounded-lg p-10 min-h-60 flex flex-col items-center justify-center text-center cursor-pointer transition-[border-color] duration-150"
      :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
      @click="pick" @drop="onDrop" @dragover="onDragOver" @dragleave="onDragLeave"
    >
      <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴（最多 30 张）</div>
      <div class="text-xs text-muted mt-1">支持 PNG / JPG / WebP / AVIF / GIF / BMP / ICO / TIFF，单张上限 50MB</div>
    </div>

    <div v-else class="flex flex-col gap-2" @drop="onDrop" @dragover="onDragOver" @dragleave="onDragLeave">
      <ImageBatchRow
        v-for="item in items" :key="item.id" :item="item"
        @preview="openPreview(item.id)"
        @crop="cropId = item.id"
        @download="batch.downloadItem(item.id)"
        @remove="batch.removeItem(item.id)"
        @retry="batch.retryItem(item.id)"
      />
      <button
        type="button"
        class="border-2 border-dashed border-border rounded-sm py-3 text-[0.8125rem] text-muted hover:border-accent hover:text-text transition-[border-color,color] duration-150"
        :class="isDragging ? 'border-accent text-text' : ''"
        @click="pick"
      >+ 添加图片（拖入 / 点击 / Ctrl+V）</button>
    </div>

    <input ref="fileInputRef" type="file" accept="image/*" multiple class="hidden" @change="onChange" />
    <p v-if="errorMsg" class="text-[0.8125rem] text-error mt-2">{{ errorMsg }}</p>

    <!-- 灯箱 -->
    <ImageLightbox
      v-if="lightboxStart >= 0 && lightboxSlides.length"
      :slides="lightboxSlides" :start-index="lightboxStart"
      @close="lightboxStart = -1"
    />

    <!-- 裁切弹窗 -->
    <div
      v-if="cropItem"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
      @click.self="cropId = null"
    >
      <div class="bg-card border border-border rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-auto">
        <ImageCropper
          :src="cropItem.originalUrl" :file-name="cropBaseName"
          @crop="onCropDone" @cancel="cropId = null"
        />
      </div>
    </div>
  </div>
</template>
