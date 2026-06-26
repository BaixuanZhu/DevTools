# 图片转换与压缩工具 · 批量列表重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「图片转换与压缩」工具从单图双栏改造为多图、列表式、缩略图 + 点击预览的批量工作流，复用现有转换算法层。

**Architecture:** 纯前台串行转换（方案 A）。核心状态与串行队列抽到 `useImageBatch` composable；UI 拆为「全局控件栏 / 列表行 / 灯箱 / 裁切弹窗」子组件；顶层 `ImageConverter.vue` 负责组装。转换沿用现有 `convertImage()` / `stripJpegMetadata()`，不改算法。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、Tailwind CSS v4、Vitest（node 环境，纯函数单测）、fflate（ZIP 打包）、cropperjs v2（裁切，已装）、exifr（EXIF 读取，已装）。

## Global Constraints

- 包管理器 pnpm；Node >= 22.12.0。
- 无路径别名，全部相对路径导入。
- 禁止 `eval()` / `Function()` / `setTimeout(string)`。
- 样式优先标准 Tailwind 类名，禁止可被标准类名表达的任意值语法；设计令牌类任意值（如 `text-[0.8125rem]`）允许。
- 新增公共类 / 接口 / 函数 / composable / 组件必须写 TSDoc 文档注释。
- 工具 `id` 保持 `image-converter`，与 path 末段一致，不改路由。
- 数量上限 30 张；单张 50MB 上限；单边 16384px 上限（沿用 `checkCanvasLimits`）。
- EXIF 擦除默认开启，用原生 checkbox。
- 串行转换，逐行进度反馈；严格释放 object URL 与 `ImageBitmap`。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/utils/media/zip-download.ts` | 文件名去重（纯函数）+ ZIP 打包下载 | 新建 |
| `src/utils/media/__tests__/zip-download.test.ts` | 去重纯函数单测 | 新建 |
| `src/composables/useImageBatch.ts` | 批量状态机、串行队列、内存管理、导入/删除/重转/下载 | 新建 |
| `src/components/media/ImageConverterControls.vue` | 全局控件栏（格式/质量/尺寸/EXIF/ICO） | 新建 |
| `src/components/media/ImageBatchRow.vue` | 列表单行（缩略图+信息+状态+操作） | 新建 |
| `src/components/media/ImageLightbox.vue` | 结果灯箱 + 翻页 | 新建 |
| `src/tools/media/ImageConverter.vue` | 顶层壳：组装控件栏+列表+灯箱+裁切弹窗 | 重写 |
| `src/components/media/ImageCropper.vue` | 裁切器 | 复用，套弹窗 |
| `src/utils/media/image-convert.ts` | 转换算法 | 不动 |
| `src/data/tools.ts` | SEO 文案补「批量」 | 修改 |
| `src/data/tool-faqs.ts` | 新增批量相关 FAQ | 修改 |

---

## Task 1: ZIP 打包下载与文件名去重

**Files:**
- Create: `src/utils/media/zip-download.ts`
- Test: `src/utils/media/__tests__/zip-download.test.ts`
- Modify: `package.json`（新增依赖 fflate）

**Interfaces:**
- Consumes: 无。
- Produces:
  - `dedupeNames(names: string[]): string[]` — 同名在扩展名前追加 `-1`/`-2`… 去重，保持顺序。
  - `interface ZipFile { name: string; blob: Blob }`
  - `downloadAllAsZip(files: ZipFile[], zipName?: string): Promise<void>` — 打包为单个 zip 触发下载。

- [ ] **Step 1: 安装 fflate**

Run: `pnpm add fflate`
Expected: `package.json` dependencies 出现 `"fflate"`，`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 写失败测试**

Create `src/utils/media/__tests__/zip-download.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dedupeNames } from '../zip-download';

describe('dedupeNames', () => {
  it('保持不重复的名字原样', () => {
    expect(dedupeNames(['a.png', 'b.jpg'])).toEqual(['a.png', 'b.jpg']);
  });

  it('对重复名字在扩展名前追加序号', () => {
    expect(dedupeNames(['a.png', 'a.png', 'a.png'])).toEqual([
      'a.png',
      'a-1.png',
      'a-2.png',
    ]);
  });

  it('处理无扩展名的文件', () => {
    expect(dedupeNames(['img', 'img'])).toEqual(['img', 'img-1']);
  });

  it('追加序号后若仍冲突则继续递增', () => {
    expect(dedupeNames(['a.png', 'a-1.png', 'a.png'])).toEqual([
      'a.png',
      'a-1.png',
      'a-2.png',
    ]);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test src/utils/media/__tests__/zip-download.test.ts`
Expected: FAIL（`dedupeNames` 未定义 / 模块解析失败）。

- [ ] **Step 4: 实现 zip-download.ts**

Create `src/utils/media/zip-download.ts`:

```ts
/**
 * 图片批量转换的 ZIP 打包下载模块。
 *
 * 含纯函数文件名去重（可单测）与依赖浏览器 / fflate 的打包下载。
 */
import { zipSync, type Zippable } from 'fflate';

/** 待打包文件 */
export interface ZipFile {
  /** 期望的文件名（含扩展名） */
  name: string;
  /** 文件内容 */
  blob: Blob;
}

/**
 * 拆分文件名为 [基础名, 扩展名]，扩展名含前导点；无扩展名时返回 ['', '']。
 * @param name 文件名
 */
function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return [name, ''];
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * 对文件名列表去重：重复名在扩展名前追加 `-1`/`-2`…，保持原顺序。
 *
 * 追加序号后若仍与已用名冲突，继续递增直到唯一。
 * @param names 原始文件名列表
 * @returns 去重后等长的文件名列表
 */
export function dedupeNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const [base, ext] = splitExt(name);
    let i = 1;
    let candidate = `${base}-${i}${ext}`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${base}-${i}${ext}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/**
 * 将多个文件打包为单个 ZIP 并触发浏览器下载。
 *
 * 文件名经 {@link dedupeNames} 去重，避免 zip 内同名覆盖。
 * @param files 待打包文件
 * @param zipName 下载文件名，默认 `images.zip`
 */
export async function downloadAllAsZip(
  files: ZipFile[],
  zipName = 'images.zip',
): Promise<void> {
  const names = dedupeNames(files.map((f) => f.name));
  const entries: Zippable = {};
  await Promise.all(
    files.map(async (f, i) => {
      entries[names[i]!] = new Uint8Array(await f.blob.arrayBuffer());
    }),
  );
  const zipped = zipSync(entries);
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test src/utils/media/__tests__/zip-download.test.ts`
Expected: PASS（4 个用例全过）。

- [ ] **Step 6: 提交**

```bash
git add package.json pnpm-lock.yaml src/utils/media/zip-download.ts src/utils/media/__tests__/zip-download.test.ts
git commit -m "feat(media): 新增 ZIP 打包下载与文件名去重"
```

---

## Task 2: useImageBatch composable

**Files:**
- Create: `src/composables/useImageBatch.ts`

**Interfaces:**
- Consumes:
  - `convertImage`, `loadImage`, `checkCanvasLimits`, `defaultFormatForInput`, `needsFillBackground`, `getOutputExtension`, `formatBytes`, `type OutputFormat`, `type LoadedImage`, `type ConvertResult` from `../utils/media/image-convert`。
  - `stripJpegMetadata` from `../utils/media/exif-strip`。
  - `downloadAllAsZip`, `type ZipFile` from `../utils/media/zip-download`。
  - `type IcoFit`, `type IcoAnchor`, `DEFAULT_ICO_SIZES` from `../utils/media/encoders/ico`。
- Produces:
  - `interface ConvertParams { format: OutputFormat; quality: number; scale: number; eraseExif: boolean; icoSizes: number[]; icoFit: IcoFit; icoAnchor: IcoAnchor }`
  - `type BatchStatus = 'queued' | 'converting' | 'done' | 'error'`
  - `interface BatchItem { id: string; name: string; bitmap: ImageBitmap; width: number; height: number; originalUrl: string; originalSize: number; originalBytes: ArrayBuffer | null; inputFormat: OutputFormat | null; orientation: number; status: BatchStatus; result: ConvertResult | null; error: string }`
  - `function useImageBatch(params: ConvertParams)` 返回：`{ items: Ref<BatchItem[]>, errorMsg: Ref<string>, MAX_ITEMS: number, addFiles(files: File[]): Promise<void>, removeItem(id: string): void, retryItem(id: string): void, replaceWithCrop(id: string, blob: Blob, bitmap: ImageBitmap, width: number, height: number): Promise<void>, downloadItem(id: string): void, downloadAllZip(): Promise<void>, clearAll(): void, doneCount: ComputedRef<number> }`

> **说明：** `params` 由顶层组件以 `reactive` 创建并同时传给控件栏；composable 内部 `watch` 它触发整批重转（200ms 防抖）。EXIF 的 orientation 通过轻量读取 `exifr` 仅对 JPEG 输入项判定纯擦除场景；其余项不读 EXIF。

- [ ] **Step 1: 实现 composable**

Create `src/composables/useImageBatch.ts`:

```ts
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
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无新增类型错误（IDE 对新文件可能短暂报「找不到模块」，以 astro check / 构建为准）。

- [ ] **Step 3: 提交**

```bash
git add src/composables/useImageBatch.ts
git commit -m "feat(media): 新增 useImageBatch 批量转换状态管理 composable"
```

---

## Task 3: 全局控件栏组件 ImageConverterControls.vue

**Files:**
- Create: `src/components/media/ImageConverterControls.vue`

**Interfaces:**
- Consumes: `type ConvertParams` from `../../composables/useImageBatch`；`OUTPUT_FORMATS`, `isLossless`, `needsFillBackground`, `type OutputFormat` from `../../utils/media/image-convert`；`ICO_SIZE_OPTIONS`, `type IcoFit`, `type IcoAnchor` from `../../utils/media/encoders/ico`；`OptionRadioGroup`、`SelectListbox`。
- Produces: 组件 props `{ params: ConvertParams; hasItems: boolean }`，直接读写 `params`（reactive 透传）。无 emit。

- [ ] **Step 1: 实现组件**

Create `src/components/media/ImageConverterControls.vue`:

```vue
<script setup lang="ts">
/**
 * 图片批量转换的全局控件栏。
 *
 * 直接读写传入的响应式 params（格式/质量/尺寸/EXIF 擦除/ICO 设置），
 * 作用于整批图片。EXIF 擦除用原生 checkbox，默认开启。
 */
import { computed } from 'vue';
import OptionRadioGroup from '../ui/OptionRadioGroup.vue';
import SelectListbox from '../ui/SelectListbox.vue';
import { OUTPUT_FORMATS, isLossless, type OutputFormat } from '../../utils/media/image-convert';
import {
  ICO_SIZE_OPTIONS,
  type IcoFit,
  type IcoAnchor,
} from '../../utils/media/encoders/ico';
import type { ConvertParams } from '../../composables/useImageBatch';

const props = defineProps<{
  /** 响应式全局参数（就地修改） */
  params: ConvertParams;
  /** 当前是否已有图片（控制提示文案展示） */
  hasItems: boolean;
}>();

const lossyFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossy'));
const losslessFormats = computed(() => OUTPUT_FORMATS.filter((f) => f.group === 'lossless'));
const isIco = computed(() => props.params.format === 'ico');
const qualityDisabled = computed(() => isLossless(props.params.format));

const icoFitOptions: { value: IcoFit; label: string }[] = [
  { value: 'cover', label: '裁切填满' },
  { value: 'contain', label: '留白完整' },
];
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

/** 切换 ICO 输出尺寸（至少保留一个） */
function toggleIcoSize(size: number): void {
  const sizes = props.params.icoSizes;
  if (sizes.includes(size)) {
    if (sizes.length === 1) return;
    props.params.icoSizes = sizes.filter((s) => s !== size);
  } else {
    props.params.icoSizes = [...sizes, size].sort((a, b) => a - b);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-4 flex-wrap">
        <OptionRadioGroup v-model="params.format" :options="lossyFormats" label="有损" />
        <OptionRadioGroup v-model="params.format" :options="losslessFormats" label="无损" />
      </div>

      <template v-if="!isIco">
        <div class="flex items-center gap-2" :class="qualityDisabled ? 'opacity-50' : ''">
          <span class="text-[0.8125rem] text-muted">质量</span>
          <input
            v-model.number="params.quality"
            type="range" min="10" max="100" step="1" aria-label="质量"
            :disabled="qualityDisabled" class="w-32 accent-accent"
          />
          <span class="text-[0.8125rem] font-mono w-6">{{ qualityDisabled ? '—' : params.quality }}</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-[0.8125rem] text-muted">尺寸</span>
          <input
            v-model.number="params.scale"
            type="range" min="1" max="100" step="1" aria-label="尺寸"
            class="w-32 accent-accent"
          />
          <span class="text-[0.8125rem] font-mono">{{ params.scale }}%</span>
        </div>
      </template>

      <label class="flex items-center gap-1.5 text-[0.8125rem] text-text cursor-pointer select-none">
        <input v-model="params.eraseExif" type="checkbox" class="cursor-pointer accent-accent" />
        擦除隐私元数据
      </label>
    </div>

    <!-- ICO 专属设置 -->
    <div v-if="isIco" class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-18 shrink-0">尺寸</span>
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="size in ICO_SIZE_OPTIONS" :key="size" type="button"
            :class="[
              'px-3 py-1.5 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
              'transition-[background-color,border-color] duration-150',
              params.icoSizes.includes(size)
                ? 'bg-accent border-accent text-white'
                : 'bg-surface border-border text-text hover:bg-hover hover:border-accent',
            ]"
            @click="toggleIcoSize(size)"
          >{{ size }}</button>
        </div>
      </div>
      <OptionRadioGroup v-model="params.icoFit" :options="icoFitOptions" label="适配" />
      <div v-if="params.icoFit === 'cover'" class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted">锚点</span>
        <SelectListbox
          class="w-28" :model-value="params.icoAnchor" :options="icoAnchorOptions"
          @update:model-value="(v) => (params.icoAnchor = v as IcoAnchor)"
        />
      </div>
    </div>

    <div class="min-h-[1.25rem] text-[0.8125rem] text-muted">
      <p v-if="isIco" class="m-0">ICO 按所选尺寸多尺寸封装；非正方形图按所选适配方式处理</p>
      <p v-else-if="hasItems && params.format === 'jpeg'" class="m-0">JPEG 不支持透明背景，透明区域将填充白色</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无新增类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/components/media/ImageConverterControls.vue
git commit -m "feat(media): 抽离图片转换全局控件栏组件"
```

---

## Task 4: 灯箱组件 ImageLightbox.vue

**Files:**
- Create: `src/components/media/ImageLightbox.vue`

**Interfaces:**
- Consumes: `formatBytes` from `../../utils/media/image-convert`（重导出自 shared/format）。
- Produces: props `{ slides: LightboxSlide[]; startIndex: number }`，emit `close`。本地 `interface LightboxSlide { url: string; name: string; width: number; height: number; size: number }`（url 已是 `previewUrl ?? url`，由父组件准备）。

- [ ] **Step 1: 实现组件**

Create `src/components/media/ImageLightbox.vue`:

```vue
<script setup lang="ts">
/**
 * 转换结果灯箱：全屏展示结果大图，支持在已完成图片间翻页。
 *
 * 纯展示组件，不持有业务状态；slides 的 url 由父组件按 previewUrl ?? url 准备好。
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { formatBytes } from '../../utils/media/image-convert';

/** 灯箱单页 */
export interface LightboxSlide {
  url: string;
  name: string;
  width: number;
  height: number;
  size: number;
}

const props = defineProps<{
  slides: LightboxSlide[];
  startIndex: number;
}>();
const emit = defineEmits<{ close: [] }>();

const index = ref(props.startIndex);

/** 上一张（循环） */
function prev(): void {
  index.value = (index.value - 1 + props.slides.length) % props.slides.length;
}
/** 下一张（循环） */
function next(): void {
  index.value = (index.value + 1) % props.slides.length;
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
    @click.self="emit('close')"
  >
    <button
      type="button" aria-label="关闭"
      class="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-sm text-white/80 hover:text-white hover:bg-white/10"
      @click="emit('close')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    </button>

    <button
      v-if="slides.length > 1" type="button" aria-label="上一张"
      class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
      @click="prev"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    </button>
    <button
      v-if="slides.length > 1" type="button" aria-label="下一张"
      class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
      @click="next"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </button>

    <figure class="flex flex-col items-center gap-3 max-w-full max-h-full">
      <img
        :src="slides[index]!.url" :alt="slides[index]!.name"
        class="max-w-full max-h-[80vh] object-contain rounded-sm bg-white"
      />
      <figcaption class="text-[0.8125rem] text-white/80 font-mono text-center">
        {{ slides[index]!.name }} · {{ slides[index]!.width }}×{{ slides[index]!.height }} · {{ formatBytes(slides[index]!.size) }}
        <span v-if="slides.length > 1" class="ml-2">{{ index + 1 }} / {{ slides.length }}</span>
      </figcaption>
    </figure>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无新增类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/components/media/ImageLightbox.vue
git commit -m "feat(media): 新增转换结果灯箱组件"
```

---

## Task 5: 列表行组件 ImageBatchRow.vue

**Files:**
- Create: `src/components/media/ImageBatchRow.vue`

**Interfaces:**
- Consumes: `type BatchItem` from `../../composables/useImageBatch`；`formatBytes` from `../../utils/media/image-convert`。
- Produces: props `{ item: BatchItem }`，emit `preview`、`crop`、`download`、`remove`、`retry`（均无参，父组件按当前行 id 操作）。

- [ ] **Step 1: 实现组件**

Create `src/components/media/ImageBatchRow.vue`:

```vue
<script setup lang="ts">
/**
 * 批量列表的单行：缩略图 + 文件信息 + 转换状态 + 行内操作按钮。
 */
import { computed } from 'vue';
import { formatBytes } from '../../utils/media/image-convert';
import type { BatchItem } from '../../composables/useImageBatch';

const props = defineProps<{ item: BatchItem }>();
const emit = defineEmits<{
  preview: []; crop: []; download: []; remove: []; retry: [];
}>();

/** 体积节省比（done 时） */
const savings = computed(() => {
  const r = props.item.result;
  if (!r || props.item.originalSize === 0) return null;
  return Math.round(((props.item.originalSize - r.size) / props.item.originalSize) * 100);
});
const isDone = computed(() => props.item.status === 'done');
</script>

<template>
  <div class="flex items-center gap-3 p-2 border border-border rounded-sm bg-card">
    <!-- 缩略图 -->
    <div class="w-14 h-14 shrink-0 rounded-sm bg-hover overflow-hidden flex items-center justify-center">
      <img :src="item.originalUrl" :alt="item.name" class="w-full h-full object-cover" />
    </div>

    <!-- 信息 -->
    <div class="flex-1 min-w-0">
      <div class="text-sm text-text truncate" :title="item.name">{{ item.name }}</div>
      <div class="text-xs text-muted font-mono flex items-center gap-1.5 flex-wrap">
        <span>{{ item.width }}×{{ item.height }} · {{ formatBytes(item.originalSize) }}</span>
        <template v-if="isDone && item.result">
          <span class="text-muted">→</span>
          <span class="text-text">{{ formatBytes(item.result.size) }}</span>
          <span v-if="savings !== null" :class="savings >= 0 ? 'text-success' : 'text-error'">
            {{ savings >= 0 ? `省 ${savings}%` : `增 ${Math.abs(savings)}%` }}
          </span>
        </template>
        <span v-else-if="item.status === 'converting'" class="text-muted">转换中…</span>
        <span v-else-if="item.status === 'queued'" class="text-muted">等待中…</span>
        <span v-else-if="item.status === 'error'" class="text-error truncate" :title="item.error">{{ item.error }}</span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="flex items-center gap-1 shrink-0">
      <button
        v-if="item.status === 'error'" type="button" title="重试"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text"
        @click="emit('retry')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
      </button>
      <button
        type="button" title="预览" :disabled="!isDone"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('preview')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      </button>
      <button
        type="button" title="裁切"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text"
        @click="emit('crop')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>
      </button>
      <button
        type="button" title="下载" :disabled="!isDone"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
        @click="emit('download')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      </button>
      <button
        type="button" title="移除"
        class="w-8 h-8 flex items-center justify-center rounded-sm border border-border text-muted hover:bg-hover hover:text-error"
        @click="emit('remove')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无新增类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/components/media/ImageBatchRow.vue
git commit -m "feat(media): 新增批量列表行组件"
```

---

## Task 6: 顶层组件 ImageConverter.vue 重写

**Files:**
- Modify（整体重写）: `src/tools/media/ImageConverter.vue`

**Interfaces:**
- Consumes: `useImageBatch`, `type ConvertParams` from `../../composables/useImageBatch`；`ImageConverterControls`、`ImageBatchRow`、`ImageLightbox`（`type LightboxSlide`）、`ImageCropper`（`type CropResult`）；`ToolHeader`；`checkCanvasLimits`, `DEFAULT_QUALITY` from image-convert；`DEFAULT_ICO_SIZES` from encoders/ico。
- Produces: 工具页面入口组件（被 `.astro` 以 `client:idle` 水合）。

- [ ] **Step 1: 重写组件**

Replace 全文 `src/tools/media/ImageConverter.vue`:

```vue
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
  const idx = lightboxSlides.value.findIndex(
    (s) => s.name === items.value.find((it) => it.id === id)?.name,
  );
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
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `pnpm astro check && pnpm build`
Expected: 类型检查无新增错误；构建成功产出 `dist/`。

- [ ] **Step 3: 提交**

```bash
git add src/tools/media/ImageConverter.vue
git commit -m "feat(media): 图片转换工具重写为批量列表式工作流"
```

---

## Task 7: 更新工具注册与 FAQ

**Files:**
- Modify: `src/data/tools.ts:447-449`（image-converter 的 `seoDescription` / 关键词补「批量」）
- Modify: `src/data/tool-faqs.ts`（新增批量相关问答）

**Interfaces:**
- Consumes: 现有 `tools.ts` / `tool-faqs.ts` 结构。
- Produces: 无代码接口，仅数据。

- [ ] **Step 1: 更新 SEO 描述**

在 `src/data/tools.ts` 中 `id: 'image-converter'` 条目的 `seoDescription` 开头补充批量能力。将原描述首句改为：

```ts
seoDescription:
  '免费在线图片转换与压缩工具，支持多图批量处理（一次最多 30 张），PNG、JPG、WebP、AVIF、TIFF、ICO 格式互转与读取 GIF、BMP，自定义质量压缩与按比例尺寸缩放；可逐图裁切、点击预览转换结果、一键打包 ZIP 下载；ICO 可自选 16 / 32 / 48 / 64 / 128 / 256 多尺寸并选择裁切适配方式（裁切填满 / 留白完整、九宫格锚点），一键生成 favicon；内置 EXIF 隐私擦除（默认开启，无损去除 GPS 定位、设备型号、拍摄时间等元数据），纯浏览器端本地处理图片绝不上传，即开即用。',
```

- [ ] **Step 2: 新增 FAQ**

在 `src/data/tool-faqs.ts` 中 `'image-converter'` 的 FAQ 数组追加两条（字段为 `question` / `answer`，`answer` 可含 `<strong>` 等 HTML，与文件既有写法一致）：

```ts
{
  question: '可以一次转换多张图片吗？',
  answer:
    '可以。支持<strong>拖入、点击选择或 Ctrl+V 粘贴</strong>批量导入，一次最多同时处理 <strong>30 张</strong>，所有图片共用顶部统一的格式、质量与尺寸设置，转换完成后可逐张下载或一键<strong>打包成 ZIP</strong> 下载。',
},
{
  question: '怎么预览转换后的效果？',
  answer:
    '每张图片转换完成后，点击该行的<strong>「预览」</strong>按钮即可在灯箱中查看转换结果大图，并用左右箭头或键盘方向键在多张图片间翻页。',
},
```

- [ ] **Step 3: 校验数据结构**

Run: `pnpm astro check`
Expected: 无类型错误。

- [ ] **Step 4: 提交**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts
git commit -m "docs(media): 更新图片转换工具批量能力的 SEO 与 FAQ"
```

---

## Task 8: 浏览器手验与内存检查

**Files:** 无（验证任务）。

**Interfaces:** 无。

- [ ] **Step 1: 启动 dev**

Run: `pnpm dev`
打开 `http://localhost:4321/media/image-converter`（以终端输出端口为准）。

- [ ] **Step 2: 逐项手验**

确认以下行为，逐条记录通过/异常：

1. 空态拖入 / 点击 / Ctrl+V 导入多张图，列表逐行出现并依次从「等待中→转换中→✓」。
2. 一次性导入超 30 张：仅接收 30 张并提示忽略数量。
3. 改格式 / 质量 / 尺寸 → 全部行重新转换，体积与节省%更新。
4. 切到 ICO：控件出现尺寸多选 / 适配 / 锚点，各行转出 ICO。
5. EXIF 默认勾选；上传带 GPS 的 JPEG，取消勾选后体积/行为变化符合预期。
6. 点某行「裁切」→ 弹窗裁切 → 确认后该行替换为裁切图并重转，其余行不变。
7. 点某行「预览」→ 灯箱显示结果大图；←/→ 与箭头按钮翻页；Esc/点遮罩关闭。
8. 导入一张 TIFF 输出，预览能正常显示（走 previewUrl）。
9. 单行「下载」得到单文件；「下载全部 ZIP」得到含全部结果、文件名去重的 zip。
10. 「移除」单行、「清空」全部后，列表与提示正确复位。

- [ ] **Step 3: 内存释放检查**

在 DevTools Memory/Performance 中：导入 → 清空，确认无残留的 detached `<img>` 与未释放 object URL（可在 Console 观察，或多轮导入清空后内存回落）。

- [ ] **Step 4: 全量测试**

Run: `pnpm test`
Expected: 全部测试通过（含新增 zip-download 用例，及既有 image-convert / ico / exif-strip）。

- [ ] **Step 5: 提交（如手验中有修复）**

```bash
git add -A
git commit -m "fix(media): 批量图片转换手验问题修复"
```

---

## Self-Review

**1. Spec coverage（逐节核对）：**
- 多图导入 + 30 张上限 → Task 2 `addFiles`、Task 6 拖拽/粘贴/multiple input。✓
- 单栏列表 + 缩略图 + 状态 → Task 5 行、Task 6 列表。✓
- 全局统一参数 → Task 3 控件栏 + Task 2 watch 重转。✓
- 点击预览灯箱 + 翻页 → Task 4 + Task 6 openPreview。✓
- 逐图弹窗裁切 → Task 6 裁切弹窗 + Task 2 replaceWithCrop。✓
- 单张 + ZIP 下载 → Task 1 + Task 2 downloadItem/downloadAllZip。✓
- EXIF 默认开启 checkbox + JPEG 无损 strip 逐张 → Task 2 isPureStrip / 仅 JPEG 存 bytes、Task 3 checkbox。✓
- 尺寸仅百分比 → Task 3（无像素预览）。✓
- 操作条仅按钮、无统计文案 → Task 6 操作条。✓
- 内存释放 → Task 2 disposeItem/disposeResult、Task 6 onUnmounted clearAll。✓
- 错误隔离 → Task 2 convertItem try/catch + 队列继续。✓
- SEO / FAQ → Task 7。✓

**2. Placeholder scan:** 无 TBD/TODO；所有 code step 含完整代码；无「类似 Task N」省略。✓

**3. Type consistency:** `ConvertParams`、`BatchItem`、`BatchStatus`、`LightboxSlide`、`ZipFile`、`dedupeNames`、`replaceWithCrop(id, blob, bitmap, width, height)`、`downloadAllZip`、`doneCount` 在定义任务（1/2/4）与消费任务（3/5/6）间签名一致。✓
- 注意：`tool-faqs.ts` 的 FAQ 对象字段名为 `question` / `answer`（`answer` 含 HTML），Task 7 已对齐。

---

## Execution Handoff

实现计划已保存到 `docs/superpowers/plans/2026-06-26-image-converter-batch-redesign.md`。
