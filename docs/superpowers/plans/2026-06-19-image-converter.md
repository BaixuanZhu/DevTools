# 图片转换与压缩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/media/image-converter` 单图工具，支持 PNG/JPEG/WebP 互转、质量压缩与尺寸缩放，纯 Canvas 本地处理。

**Architecture:** 纯函数模块 `src/utils/media/image-convert.ts`（可测的逻辑 + 浏览器 API）+ Vue 组件 `src/tools/media/ImageConverter.vue`（复用 `ResponsiveWorkspace` horizontal 双栏 + `OptionRadioGroup` + 现有拖拽/粘贴上传模式）+ Astro 页面。零第三方依赖。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">` + Tailwind v4 + Canvas API（`createImageBitmap` / `canvas.toBlob`）+ vitest。

## Global Constraints

- **零第三方依赖**：仅用浏览器原生 Canvas API + `createImageBitmap`，不引入图片库。
- **JS 预算**：单工具 JS（gzip）< 50KB（纯 Canvas 应远低于）。
- **id === path 末段**：`id: 'image-converter'`，`path: '/media/image-converter'`。
- **相对路径导入**：项目无路径别名，用 `../../utils/...`。
- **中文 UI 与错误提示**；反馈用 `document.dispatchEvent(new CustomEvent('toast', { detail: { message } }))`。
- **测试惯例**：只测纯函数（依赖 canvas/createImageBitmap 的浏览器 API 不做单测，组件层手动验证），测试放 `src/utils/media/__tests__/`。
- **TypeScript strict**；公共 API 写 TSDoc。
- **样式**：Tailwind utility class，消费设计令牌（`accent-accent` 等），禁内联 style。

## File Structure

| 文件 | 职责 | 动作 |
|------|------|------|
| `src/utils/media/image-convert.ts` | 类型、常量、纯函数（formatBytes / computeScaledSize / 格式映射 / 尺寸校验）+ 浏览器 API（loadImage / convertImage） | Create |
| `src/utils/media/__tests__/image-convert.test.ts` | 纯函数单元测试 | Create |
| `src/tools/media/ImageConverter.vue` | UI 组件：上传/拖拽/粘贴、实时预览、格式/质量/尺寸控件、下载、错误处理 | Create |
| `src/pages/media/image-converter.astro` | 页面，复用 ToolLayout | Create |
| `src/data/tools.ts` | 注册工具元数据 | Modify |
| `src/data/tool-faqs.ts` | 3 条 FAQ | Modify |
| `docs/ROADMAP.md` | 勾选完成项 | Modify |

---

## Task 1: 纯函数 —— 字节格式化与尺寸缩放

**Files:**
- Create: `src/utils/media/image-convert.ts`
- Test: `src/utils/media/__tests__/image-convert.test.ts`

**Interfaces:**
- Produces: `formatBytes(bytes: number): string`、`computeScaledSize(width: number, height: number, scalePercent: number): { width: number; height: number }`

- [ ] **Step 1: 写失败测试（新建测试文件）**

创建 `src/utils/media/__tests__/image-convert.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { formatBytes, computeScaledSize } from '../image-convert';

describe('formatBytes', () => {
  it('小于 1KB 显示 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('1KB 及以上显示 KB（一位小数）', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('1MB 及以上显示 MB（两位小数）', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });

  it('负数返回 0 B', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });
});

describe('computeScaledSize', () => {
  it('100% 保持原尺寸', () => {
    expect(computeScaledSize(1920, 1080, 100)).toEqual({ width: 1920, height: 1080 });
  });

  it('50% 缩小一半，锁定宽高比', () => {
    expect(computeScaledSize(1920, 1080, 50)).toEqual({ width: 960, height: 540 });
  });

  it('按百分比等比缩放', () => {
    expect(computeScaledSize(1000, 800, 25)).toEqual({ width: 250, height: 200 });
  });

  it('最小为 1px（极小百分比不产生 0）', () => {
    expect(computeScaledSize(10, 10, 1)).toEqual({ width: 1, height: 1 });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/utils/media/__tests__/image-convert.test.ts`
Expected: FAIL —— `Failed to resolve import '../image-convert'`（模块尚未创建）。

- [ ] **Step 3: 实现纯函数（新建模块文件）**

创建 `src/utils/media/image-convert.ts`：

```ts
/**
 * 图片转换与压缩工具的核心模块。
 *
 * 包含可单测的纯函数（字节格式化、尺寸缩放、格式映射、尺寸校验）
 * 以及依赖浏览器 Canvas API 的解码/编码函数。
 */

// ==================== 类型 ====================

/** 支持的输出格式 */
export type OutputFormat = 'png' | 'jpeg' | 'webp';

/** 加载后的位图及其原始尺寸 */
export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** 图片转换选项 */
export interface ConvertOptions {
  /** 源位图 */
  bitmap: ImageBitmap;
  /** 目标格式 */
  format: OutputFormat;
  /** 质量 10-100，仅对有损格式（jpeg/webp）生效 */
  quality: number;
  /** 尺寸缩放百分比 1-100（100 = 原尺寸） */
  scale: number;
  /** 是否填充白底（jpeg 不支持透明） */
  fillBackground: boolean;
}

/** 图片转换结果 */
export interface ConvertResult {
  /** 编码后的 Blob */
  blob: Blob;
  /** 预览用的 object URL（用完需 revokeObjectURL） */
  url: string;
  /** 结果宽度 */
  width: number;
  /** 结果高度 */
  height: number;
  /** 结果字节数 */
  size: number;
}

// ==================== 常量 ====================

/** 浏览器 canvas 单边最大像素（保守阈值，超此值预检拒绝） */
export const CANVAS_MAX_DIMENSION = 16384;

/** 默认质量（有损格式） */
export const DEFAULT_QUALITY = 80;

/** 无损格式（不支持质量调节） */
export const LOSSLESS_FORMATS: OutputFormat[] = ['png'];

/** 输出格式选项（供 OptionRadioGroup 使用） */
export const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

// ==================== 纯函数 ====================

/**
 * 格式化字节数为人类可读字符串。
 *
 * <1KB 显示 B，<1MB 显示 KB（一位小数），≥1MB 显示 MB（两位小数）。
 * @param bytes 字节数
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 按百分比计算目标尺寸，锁定宽高比，最小为 1px。
 * @param width 原始宽度
 * @param height 原始高度
 * @param scalePercent 缩放百分比 1-100
 */
export function computeScaledSize(
  width: number,
  height: number,
  scalePercent: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((width * scalePercent) / 100)),
    height: Math.max(1, Math.round((height * scalePercent) / 100)),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/utils/media/__tests__/image-convert.test.ts`
Expected: PASS（8 个测试全绿）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/media/image-convert.ts src/utils/media/__tests__/image-convert.test.ts
git commit -m "feat(image-converter): 添加字节格式化与尺寸缩放纯函数"
```

---

## Task 2: 纯函数 —— 格式映射与尺寸校验

**Files:**
- Modify: `src/utils/media/image-convert.ts`（追加函数）
- Test: `src/utils/media/__tests__/image-convert.test.ts`（追加测试）

**Interfaces:**
- Produces: `getOutputMime(format): string`、`getOutputExtension(format): string`、`isLossless(format): boolean`、`needsFillBackground(format): boolean`、`defaultFormatForInput(mime: string): OutputFormat`、`checkCanvasLimits(width, height): { ok: boolean; error?: string }`

- [ ] **Step 1: 追加失败测试**

在 `src/utils/media/__tests__/image-convert.test.ts` 末尾追加：

```ts
import {
  getOutputMime,
  getOutputExtension,
  isLossless,
  needsFillBackground,
  defaultFormatForInput,
  checkCanvasLimits,
} from '../image-convert';

describe('getOutputMime', () => {
  it('格式映射到 MIME', () => {
    expect(getOutputMime('png')).toBe('image/png');
    expect(getOutputMime('jpeg')).toBe('image/jpeg');
    expect(getOutputMime('webp')).toBe('image/webp');
  });
});

describe('getOutputExtension', () => {
  it('jpeg 扩展名用 .jpg', () => {
    expect(getOutputExtension('png')).toBe('.png');
    expect(getOutputExtension('jpeg')).toBe('.jpg');
    expect(getOutputExtension('webp')).toBe('.webp');
  });
});

describe('isLossless', () => {
  it('仅 png 为无损', () => {
    expect(isLossless('png')).toBe(true);
    expect(isLossless('jpeg')).toBe(false);
    expect(isLossless('webp')).toBe(false);
  });
});

describe('needsFillBackground', () => {
  it('仅 jpeg 需要填白底', () => {
    expect(needsFillBackground('jpeg')).toBe(true);
    expect(needsFillBackground('png')).toBe(false);
    expect(needsFillBackground('webp')).toBe(false);
  });
});

describe('defaultFormatForInput', () => {
  it('PNG/JPEG/WebP 保持原格式', () => {
    expect(defaultFormatForInput('image/png')).toBe('png');
    expect(defaultFormatForInput('image/jpeg')).toBe('jpeg');
    expect(defaultFormatForInput('image/webp')).toBe('webp');
  });

  it('其他格式（GIF/BMP/空）默认 WebP', () => {
    expect(defaultFormatForInput('image/gif')).toBe('webp');
    expect(defaultFormatForInput('image/bmp')).toBe('webp');
    expect(defaultFormatForInput('')).toBe('webp');
  });
});

describe('checkCanvasLimits', () => {
  it('正常尺寸通过', () => {
    expect(checkCanvasLimits(1920, 1080)).toEqual({ ok: true });
  });

  it('宽度超限拒绝并带尺寸信息', () => {
    const r = checkCanvasLimits(20000, 1000);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('20000×1000');
  });

  it('高度超限拒绝', () => {
    expect(checkCanvasLimits(1000, 20000).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认新用例失败**

Run: `pnpm test src/utils/media/__tests__/image-convert.test.ts`
Expected: FAIL —— 新增函数未导出（`does not provide an export named 'getOutputMime'`）。

- [ ] **Step 3: 追加实现**

在 `src/utils/media/image-convert.ts` 的 `computeScaledSize` 之后追加：

```ts
// ==================== 格式映射 ====================

/**
 * 输出格式映射到 MIME 类型。
 * @param format 输出格式
 */
export function getOutputMime(format: OutputFormat): string {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  return 'image/webp';
}

/**
 * 输出格式映射到文件扩展名（jpeg 用 .jpg）。
 * @param format 输出格式
 */
export function getOutputExtension(format: OutputFormat): string {
  if (format === 'png') return '.png';
  if (format === 'jpeg') return '.jpg';
  return '.webp';
}

/**
 * 判断格式是否为无损（不支持质量调节）。
 * @param format 输出格式
 */
export function isLossless(format: OutputFormat): boolean {
  return LOSSLESS_FORMATS.includes(format);
}

/**
 * 判断该格式是否需要填充白底（jpeg 不支持透明通道）。
 * @param format 输出格式
 */
export function needsFillBackground(format: OutputFormat): boolean {
  return format === 'jpeg';
}

/**
 * 根据输入图片的 MIME 推荐默认输出格式。
 *
 * PNG/JPEG/WebP 保持原格式，其余（GIF/BMP/AVIF 等）默认 WebP。
 * @param mime 输入图片 MIME 类型
 */
export function defaultFormatForInput(mime: string): OutputFormat {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/webp') return 'webp';
  return 'webp';
}

// ==================== 尺寸校验 ====================

/**
 * 校验目标尺寸是否超过浏览器 canvas 单边处理上限。
 *
 * 注：原设计含总面积上限，因「两边 ≤ 16384 ⇒ 面积 ≤ 16384²」被单边上限蕴含，
 * 属冗余检查，按 YAGNI 省略。
 * @param width 目标宽度
 * @param height 目标高度
 * @returns 校验通过返回 { ok: true }，否则返回含中文错误信息的 { ok: false, error }
 */
export function checkCanvasLimits(
  width: number,
  height: number,
): { ok: boolean; error?: string } {
  if (width > CANVAS_MAX_DIMENSION || height > CANVAS_MAX_DIMENSION) {
    return {
      ok: false,
      error: `图片尺寸过大（${width}×${height}），单边超过 ${CANVAS_MAX_DIMENSION}px 浏览器处理上限，请缩小后重试`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

Run: `pnpm test src/utils/media/__tests__/image-convert.test.ts`
Expected: PASS（全部测试绿）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/media/image-convert.ts src/utils/media/__tests__/image-convert.test.ts
git commit -m "feat(image-converter): 添加格式映射与尺寸校验纯函数"
```

---

## Task 3: 浏览器 API —— 解码与转换

**Files:**
- Modify: `src/utils/media/image-convert.ts`（追加 `loadImage` / `convertImage`）

**Interfaces:**
- Consumes: Task 1-2 的 `computeScaledSize`、`getOutputMime`、`isLossless`
- Produces: `loadImage(file: File): Promise<LoadedImage>`、`convertImage(opts: ConvertOptions): Promise<ConvertResult>`

> **不写单元测试**：这两个函数依赖 `createImageBitmap` / `canvas.toBlob`，jsdom 环境不可用。遵循项目惯例（`qr-reader.ts` 的实际解码同样不单测），通过 Task 4 组件层手动验证。

- [ ] **Step 1: 追加浏览器 API 实现**

在 `src/utils/media/image-convert.ts` 末尾追加：

```ts
// ==================== 浏览器 API（组件层验证，不做单测） ====================

/**
 * 加载图片文件为位图，自动纠正手机拍照的 EXIF 方向。
 *
 * @param file 用户上传的图片文件
 * @throws 当浏览器无法解码该文件时抛出，由调用方捕获并提示
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/**
 * 转换图片：按百分比缩放尺寸，再以指定格式/质量编码。
 *
 * - 无损格式（png）忽略 quality；
 * - fillBackground 为 true 时先在 canvas 填充白底（jpeg 透明→白）。
 *
 * @param opts 转换选项
 * @returns 转换结果（含 object URL，调用方负责释放）
 * @throws 当无法创建 2D 上下文或编码失败时抛出
 */
export async function convertImage(opts: ConvertOptions): Promise<ConvertResult> {
  const { bitmap, format, quality, scale, fillBackground } = opts;
  const { width, height } = computeScaledSize(bitmap.width, bitmap.height, scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');

  if (fillBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  const mime = getOutputMime(format);
  const qualityArg = isLossless(format) ? undefined : quality / 100;
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, qualityArg);
  });
  if (!blob) throw new Error('图片编码失败，请尝试其他格式或尺寸');

  return {
    blob,
    url: URL.createObjectURL(blob),
    width,
    height,
    size: blob.size,
  };
}
```

- [ ] **Step 2: 类型检查（确保模块无类型错误）**

Run: `pnpm exec astro check`
Expected: 无新增错误（首次运行可能较慢）。

> 若 `astro check` 报 `createImageBitmap` 类型缺失，确认 `tsconfig` 继承 `astro/tsconfigs/strict`（已含 DOM lib），通常无需额外配置。

- [ ] **Step 3: 确认现有测试仍通过（模块可正常导入）**

Run: `pnpm test src/utils/media/__tests__/image-convert.test.ts`
Expected: PASS（纯函数测试不受浏览器 API 影响）。

- [ ] **Step 4: Commit**

```bash
git add src/utils/media/image-convert.ts
git commit -m "feat(image-converter): 添加图片解码与 Canvas 转换 API"
```

---

## Task 4: ImageConverter.vue 组件

**Files:**
- Create: `src/tools/media/ImageConverter.vue`

**Interfaces:**
- Consumes: Task 1-3 全部导出（`loadImage`、`convertImage`、`formatBytes`、`computeScaledSize`、`defaultFormatForInput`、`isLossless`、`needsFillBackground`、`checkCanvasLimits`、`OUTPUT_FORMATS`、`DEFAULT_QUALITY`、类型 `OutputFormat`、`LoadedImage`、`ConvertResult`）；组件 `ResponsiveWorkspace`、`OptionRadioGroup`、`ClearButton`

> **不写组件单元测试**：项目无 Vue 组件测试基建，按惯例手动验证（Step 4 检查清单）。

- [ ] **Step 1: 创建组件文件**

创建 `src/tools/media/ImageConverter.vue`：

```vue
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
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec astro check`
Expected: 无错误（IDE 对新文件可能有索引延迟的假阳性，以 `astro check` 为准）。

- [ ] **Step 3: 启动开发服务器手动验证**

Run: `pnpm dev`，打开浏览器访问（此步骤需先完成 Task 5 的页面创建；若 Task 5 未做，可临时在 `src/pages/media/` 建页面预览）。手动验证清单见 Step 4。

- [ ] **Step 4: 手动验证清单（逐项确认）**

- [ ] 拖入一张 PNG，左侧显示原图与尺寸/体积
- [ ] 默认输出格式为 PNG（保持原格式），右侧显示结果与节省比
- [ ] 切换为 WebP，右侧实时更新（防抖），体积明显下降
- [ ] 切换为 JPEG，质量滑块可用，拖动质量右侧实时变化
- [ ] 切换为 PNG，质量滑块禁用并显示提示
- [ ] 拖动尺寸滑块，目标像素实时显示，结果尺寸变化
- [ ] 上传带透明背景的 PNG → 转 JPEG，透明区变白底，显示填充提示
- [ ] 点击选择文件上传可用
- [ ] Ctrl+V 粘贴截图可用
- [ ] 上传非图片文件（如 .txt），显示「请上传图片文件」
- [ ] 点击「下载结果」，浏览器下载 `{原名}-compressed.{ext}`，Toast「已开始下载」
- [ ] 点击「清空」，回到空上传区
- [ ] 窄屏（<1024px）双栏降级为单列堆叠

- [ ] **Step 5: Commit**

```bash
git add src/tools/media/ImageConverter.vue
git commit -m "feat(image-converter): 实现图片转换压缩 Vue 组件"
```

---

## Task 5: 页面、注册与 FAQ

**Files:**
- Create: `src/pages/media/image-converter.astro`
- Modify: `src/data/tools.ts`（在 `'qr-code-reader'` 条目后追加新工具）
- Modify: `src/data/tool-faqs.ts`（新增 `'image-converter'` 键）

**Interfaces:**
- Consumes: Task 4 的 `ImageConverter` 组件；现有 `ToolLayout`、`tools` 数组、`toolFaqs` 记录

- [ ] **Step 1: 创建页面文件**

创建 `src/pages/media/image-converter.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import ImageConverter from '../../tools/media/ImageConverter.vue';
---

<ToolLayout toolId="media/image-converter">
  <ImageConverter client:idle />
</ToolLayout>
```

- [ ] **Step 2: 在 tools.ts 注册工具**

在 `src/data/tools.ts` 的 `tools` 数组中，找到 `qr-code-reader` 条目（id 为 `'qr-code-reader'`）所在的 `{ ... }` 之后，追加：

```ts
  {
    id: 'image-converter',
    name: '图片转换与压缩',
    description: 'PNG / JPG / WebP 格式互转、质量压缩与尺寸缩放，纯浏览器端 Canvas 本地处理',
    seoDescription: '免费在线图片转换与压缩工具，支持 PNG、JPG、WebP 格式互转、自定义质量压缩与按比例尺寸缩放，纯浏览器端 Canvas 本地处理图片绝不上传，前端开发与博客配图优化必备，即开即用。',
    category: '媒体工具',
    icon: '🗜️',
    path: '/media/image-converter',
    keywords: ['图片压缩', '图片格式转换', 'png 转 webp', 'jpg 压缩', '在线图片压缩', '图片缩小', 'webp 转换', '图片体积压缩'],
    relatedToolIds: ['base64-to-image', 'qr-code-generator'],
  },
```

- [ ] **Step 3: 在 tool-faqs.ts 添加 FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中，追加新键（放在任意条目后，建议紧跟 `'qr-code-reader'`）：

```ts
  'image-converter': [
    {
      question: 'WebP 和 JPEG 该怎么选？',
      answer: '<strong>WebP</strong> 压缩率更高且支持透明通道，现代浏览器通用，优先选 WebP；<strong>JPEG</strong> 兼容性最广但不支持透明，适合无透明需求的照片。',
    },
    {
      question: '为什么选 PNG 时质量滑块不能用？',
      answer: 'PNG 是<strong>无损格式</strong>，浏览器在编码 PNG 时会忽略质量参数，因此质量调节仅对 JPEG / WebP 有效。',
    },
    {
      question: '带透明背景的图片转格式会怎样？',
      answer: '转 <strong>PNG / WebP</strong> 保留透明；转 <strong>JPEG</strong> 时透明区域会自动填充白色背景（JPEG 不支持透明通道），工具会给出提示。',
    },
  ],
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build`
Expected: 构建成功，无报错；`dist/media/image-converter/index.html` 生成。

- [ ] **Step 5: 启动并访问页面确认渲染**

Run: `pnpm preview`（或 `pnpm dev`）
访问 `/media/image-converter`，确认：页面标题/描述正确显示，双栏布局渲染，FAQ 区块（如模板包含）显示 3 条问答。

- [ ] **Step 6: Commit**

```bash
git add src/pages/media/image-converter.astro src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(image-converter): 注册工具页面与 FAQ"
```

---

## Task 6: 全量验证与 ROADMAP 更新

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部测试通过（含新增 image-convert 测试，且不影响既有测试）。

- [ ] **Step 2: 类型与构建**

Run: `pnpm exec astro check && pnpm build`
Expected: 无类型错误，构建成功。

- [ ] **Step 3: 端到端手动验收（对照设计文档第 9 节验收清单）**

- [ ] 纯函数模块 + 单测通过
- [ ] `/media/image-converter` 可访问
- [ ] 拖拽 / 选择 / 粘贴三种上传
- [ ] 格式转换 + 质量（PNG 禁用）+ 尺寸缩放（锁比例）
- [ ] 原图/结果体积与节省比显示
- [ ] 透明 → JPEG 白底
- [ ] 错误场景内联中文提示
- [ ] 清空 / 下载 + Toast
- [ ] tools.ts 注册完整（id === path 末段）+ 3 条 FAQ
- [ ] （可选）检查构建产物 JS 体积是否 < 50KB gzip

- [ ] **Step 4: 更新 ROADMAP 勾选完成项**

在 `docs/ROADMAP.md` 第「六、进度追踪 / P3」中，将：

```markdown
- [ ] 媒体工具：图片转换与压缩
```

改为：

```markdown
- [x] 媒体工具：图片转换与压缩 — 已完成（2026-06-19）。新建 `/media/image-converter`，单图模式，PNG/JPEG/WebP 互转 + 质量滑块 + 尺寸缩放，纯 Canvas + createImageBitmap 零依赖；自研 `utils/media/image-convert.ts` 纯函数（格式映射/尺寸校验/字节格式化，含单测），处理 PNG 无损禁用质量、透明→JPEG 白底、canvas 尺寸预检；配套 3 条 FAQ
```

并将文件顶部的 `**最后更新**：2026-06-19`（若已被改）保持为当日日期。

- [ ] **Step 5: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): 图片转换与压缩标记完成"
```

---

## Self-Review 记录

- **Spec coverage**：设计文档 §2 功能范围 → Task 1-4；§3 布局 → Task 4；§4 技术实现 → Task 1-3；§5 技术坑 → Task 2（PNG 无损 `isLossless`、透明 `needsFillBackground`、尺寸 `checkCanvasLimits`）+ Task 3（白底 `fillBackground`）+ Task 4（禁用/提示 UI）；§6 错误处理 → Task 4；§7 注册 SEO → Task 5。全覆盖。
- **Placeholder scan**：无 TBD/TODO；每步含完整代码或确切命令。
- **Type consistency**：`OutputFormat` / `LoadedImage` / `ConvertResult` / `ConvertOptions` 在 Task 1-4 间一致；`computeScaledSize` 参数 `scalePercent`（百分比）在 Task 1 定义、Task 3 `convertImage` 内调用传入 `scale`（组件里 `scale` ref 为 1-100 百分比）一致；`loadImage` / `convertImage` 签名与 Task 4 调用一致。
