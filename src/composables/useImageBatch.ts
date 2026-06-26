/**
 * 图片批量转换的状态管理 composable。
 *
 * 维护图片列表的状态机（queued → converting → done/error）、串行转换队列、
 * object URL 与 ImageBitmap 的生命周期，以及导入/删除/重转/下载等操作。
 * 转换算法复用 image-convert，不在此实现。
 */
import { ref, computed, watch, type Ref } from 'vue';
import exifr from 'exifr';
import {
  convertImage,
  loadImage,
  checkCanvasLimits,
  defaultFormatForInput,
  needsFillBackground,
  getOutputExtension,
  type OutputFormat,
  type ConvertResult,
} from '../utils/media/image-convert';
import { stripJpegMetadata } from '../utils/media/exif-strip';
import { downloadAllAsZip, type ZipFile } from '../utils/media/zip-download';
import { type IcoFit, type IcoAnchor } from '../utils/media/encoders/ico';

/** 全局统一的转换参数 */
export interface ConvertParams {
  format: OutputFormat;
  quality: number;
  scale: number;
  eraseExif: boolean;
  icoSizes: number[];
  icoFit: IcoFit;
  icoAnchor: IcoAnchor;
}

/** 单项转换状态 */
export type BatchStatus = 'queued' | 'converting' | 'done' | 'error';

/** 批量列表的单项 */
export interface BatchItem {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  originalUrl: string;
  originalSize: number;
  /** 仅 JPEG 输入项保留，用于无损 strip；其余为 null */
  originalBytes: ArrayBuffer | null;
  inputFormat: OutputFormat | null;
  /** EXIF Orientation，1 表示无需旋转 */
  orientation: number;
  status: BatchStatus;
  result: ConvertResult | null;
  error: string;
}

/** 同时处理的图片数量上限 */
const MAX_ITEMS = 30;
/** 单张文件大小上限 50MB */
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;
/** 参数变更重转防抖 */
const REQUEUE_DEBOUNCE_MS = 200;

/**
 * 创建批量转换状态与操作集合。
 * @param params 全局转换参数（响应式），变更时整批重转
 */
export function useImageBatch(params: ConvertParams) {
  const items: Ref<BatchItem[]> = ref([]);
  const errorMsg = ref('');
  let idSeq = 0;
  let processing = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const doneCount = computed(
    () => items.value.filter((it) => it.status === 'done').length,
  );

  /** 读取 JPEG 的 Orientation（失败回退 1） */
  async function readOrientation(file: File): Promise<number> {
    try {
      const data = (await exifr.parse(file, { tiff: true, exif: true })) as
        | Record<string, unknown>
        | null
        | undefined;
      return typeof data?.Orientation === 'number' ? data.Orientation : 1;
    } catch {
      return 1;
    }
  }

  /** 释放单项持有的 object URL 与位图 */
  function disposeItem(it: BatchItem): void {
    it.bitmap.close?.();
    if (it.originalUrl) URL.revokeObjectURL(it.originalUrl);
    disposeResult(it);
  }

  /** 仅释放结果资源 */
  function disposeResult(it: BatchItem): void {
    if (it.result) {
      URL.revokeObjectURL(it.result.url);
      if (it.result.previewUrl) URL.revokeObjectURL(it.result.previewUrl);
      it.result = null;
    }
  }

  /** 判断某项当前参数下是否命中纯擦除（无损 strip）场景 */
  function isPureStrip(it: BatchItem): boolean {
    return (
      params.eraseExif &&
      it.inputFormat === 'jpeg' &&
      params.format === 'jpeg' &&
      params.scale === 100 &&
      it.orientation === 1 &&
      it.originalBytes !== null
    );
  }

  /** 转换单项（就地更新 status/result/error） */
  async function convertItem(it: BatchItem): Promise<void> {
    it.status = 'converting';
    disposeResult(it);
    try {
      if (isPureStrip(it) && it.originalBytes) {
        const cleaned = stripJpegMetadata(it.originalBytes);
        const blob = new Blob([cleaned], { type: 'image/jpeg' });
        it.result = {
          blob,
          url: URL.createObjectURL(blob),
          width: it.width,
          height: it.height,
          size: blob.size,
        };
      } else {
        it.result = await convertImage({
          bitmap: it.bitmap,
          format: params.format,
          quality: params.quality,
          scale: params.scale,
          fillBackground: needsFillBackground(params.format),
          icoSizes: params.icoSizes,
          icoFit: params.icoFit,
          icoAnchor: params.icoAnchor,
        });
      }
      it.status = 'done';
      it.error = '';
    } catch (e) {
      it.status = 'error';
      it.error = e instanceof Error ? e.message : '图片转换失败';
    }
  }

  /** 串行消费所有 queued 项 */
  async function processQueue(): Promise<void> {
    if (processing) return;
    processing = true;
    try {
      // 每轮重新扫描，兼容处理途中新增的项
      let next = items.value.find((it) => it.status === 'queued');
      while (next) {
        await convertItem(next);
        next = items.value.find((it) => it.status === 'queued');
      }
    } finally {
      processing = false;
    }
  }

  /** 将所有项标记为 queued 并重新入队（参数变更时调用） */
  function requeueAll(): void {
    for (const it of items.value) it.status = 'queued';
    void processQueue();
  }

  /**
   * 导入文件：逐个校验、解码、入列，超量与非法文件给出提示。
   * @param files 用户选择/拖入/粘贴的文件
   */
  async function addFiles(files: File[]): Promise<void> {
    errorMsg.value = '';
    const remaining = MAX_ITEMS - items.value.length;
    if (remaining <= 0) {
      errorMsg.value = `最多同时处理 ${MAX_ITEMS} 张图片`;
      return;
    }
    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      errorMsg.value = `最多同时处理 ${MAX_ITEMS} 张，已忽略超出的 ${files.length - remaining} 张`;
    }

    for (const file of accepted) {
      if (!file.type.startsWith('image/')) {
        errorMsg.value = `「${file.name}」不是图片文件，已跳过`;
        continue;
      }
      if (file.size > FILE_SIZE_LIMIT) {
        errorMsg.value = `「${file.name}」过大，超过 50MB 上限，已跳过`;
        continue;
      }
      try {
        const inputFormat = defaultFormatForInput(file.type);
        const isJpeg = inputFormat === 'jpeg';
        const [img, bytes, orientation] = await Promise.all([
          loadImage(file),
          isJpeg ? file.arrayBuffer() : Promise.resolve(null),
          isJpeg ? readOrientation(file) : Promise.resolve(1),
        ]);
        const limit = checkCanvasLimits(img.width, img.height);
        if (!limit.ok) {
          img.bitmap.close?.();
          errorMsg.value = limit.error!;
          continue;
        }
        idSeq += 1;
        items.value.push({
          id: `img-${idSeq}`,
          name: file.name,
          bitmap: img.bitmap,
          width: img.width,
          height: img.height,
          originalUrl: URL.createObjectURL(file),
          originalSize: file.size,
          originalBytes: bytes,
          inputFormat,
          orientation,
          status: 'queued',
          result: null,
          error: '',
        });
      } catch {
        errorMsg.value = `「${file.name}」解码失败，已跳过`;
      }
    }
    void processQueue();
  }

  /** 删除并释放某项 */
  function removeItem(id: string): void {
    const idx = items.value.findIndex((it) => it.id === id);
    if (idx === -1) return;
    disposeItem(items.value[idx]!);
    items.value.splice(idx, 1);
  }

  /** 重试失败项 */
  function retryItem(id: string): void {
    const it = items.value.find((x) => x.id === id);
    if (!it) return;
    it.status = 'queued';
    void processQueue();
  }

  /**
   * 用裁切结果替换某项的源位图并重转。
   * @param id 目标项 id
   * @param blob 裁切结果 blob（刷新缩略图与体积）
   * @param bitmap 裁切结果位图（已通过尺寸校验）
   * @param width 裁切宽
   * @param height 裁切高
   */
  async function replaceWithCrop(
    id: string,
    blob: Blob,
    bitmap: ImageBitmap,
    width: number,
    height: number,
  ): Promise<void> {
    const it = items.value.find((x) => x.id === id);
    if (!it) {
      bitmap.close?.();
      return;
    }
    it.bitmap.close?.();
    if (it.originalUrl) URL.revokeObjectURL(it.originalUrl);
    it.bitmap = bitmap;
    it.width = width;
    it.height = height;
    it.originalUrl = URL.createObjectURL(blob);
    it.originalSize = blob.size;
    it.originalBytes = null; // 已重新编码，strip 失效
    it.status = 'queued';
    await processQueue();
  }

  /** 下载单项结果（按 strip/canvas 区分后缀） */
  function downloadItem(id: string): void {
    const it = items.value.find((x) => x.id === id);
    if (!it?.result) return;
    const base = it.name.replace(/\.[^.]+$/, '') || 'image';
    const ext = getOutputExtension(params.format).slice(1);
    const a = document.createElement('a');
    a.href = it.result.url;
    a.download = `${base}-compressed.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** 打包下载所有已完成项 */
  async function downloadAllZip(): Promise<void> {
    const ext = getOutputExtension(params.format).slice(1);
    const files: ZipFile[] = items.value
      .filter((it) => it.status === 'done' && it.result)
      .map((it) => ({
        name: `${it.name.replace(/\.[^.]+$/, '') || 'image'}-compressed.${ext}`,
        blob: it.result!.blob,
      }));
    if (files.length === 0) return;
    await downloadAllAsZip(files);
  }

  /** 清空并释放全部项 */
  function clearAll(): void {
    for (const it of items.value) disposeItem(it);
    items.value = [];
    errorMsg.value = '';
  }

  // 参数变更 → 整批重转（防抖）
  watch(
    () => [
      params.format,
      params.quality,
      params.scale,
      params.eraseExif,
      params.icoFit,
      params.icoAnchor,
      [...params.icoSizes],
    ],
    () => {
      if (items.value.length === 0) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(requeueAll, REQUEUE_DEBOUNCE_MS);
    },
    { deep: true },
  );

  return {
    items,
    errorMsg,
    MAX_ITEMS,
    doneCount,
    addFiles,
    removeItem,
    retryItem,
    replaceWithCrop,
    downloadItem,
    downloadAllZip,
    clearAll,
  };
}
