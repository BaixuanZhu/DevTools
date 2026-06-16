# 三新工具实现计划：Cron 解析器 / Base64 转图片 / Base64 转文件

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增三个独立工具页面——Cron 表达式解析器、Base64 转图片、Base64 转文件——遵循项目已有的工具实现模式。

**Architecture:** 每个工具由三层文件组成：Astro 页面（极简容器）→ Vue 组件（交互逻辑 + UI）→ TypeScript 工具函数（纯计算）。两个 Base64 工具零依赖纯浏览器原生 API，Cron 工具使用 `cron-parser` 库。

**Tech Stack:** Astro 6 + Vue 3 Composition API + TypeScript + Tailwind CSS v4 + cron-parser + 浏览器原生 API（atob/Blob/URL.createObjectURL）

**Spec:** `docs/superpowers/specs/2026-06-06-three-new-tools-design.md`

---

## 文件结构总览

```
新增文件（共 9 个）：
├── src/utils/encoding/base64-image.ts       # Base64→图片 解码逻辑
├── src/utils/encoding/base64-file.ts        # Base64→文件 解码逻辑
├── src/utils/datetime/cron.ts               # Cron 解析逻辑
├── src/tools/encoding/Base64ToImage.vue     # Base64→图片 Vue 组件
├── src/tools/encoding/Base64ToFile.vue      # Base64→文件 Vue 组件
├── src/tools/datetime/CronParser.vue        # Cron 解析器 Vue 组件
├── src/pages/encoding/base64-to-image.astro # Base64→图片 页面
├── src/pages/encoding/base64-to-file.astro  # Base64→文件 页面
└── src/pages/datetime/cron-parser.astro     # Cron 解析器 页面

修改文件（1 个）：
└── src/data/tools.ts                        # 新增 3 条工具注册记录
```

---

## Task 1: Base64 转图片 — 工具函数

**Files:**
- Create: `src/utils/encoding/base64-image.ts`
- Reference: `src/utils/encoding/base64.ts`（已有 `formatFileSize`、`detectMimeType`、`base64ToArrayBuffer` 可复用）

- [ ] **Step 1: 创建 `base64-image.ts` 工具函数**

```typescript
/**
 * Base64 转图片工具函数
 * 将 Base64 字符串解码为图片 Blob，提供预览、信息提取和下载能力
 */
import { formatFileSize, detectMimeType, base64ToArrayBuffer } from './base64';

/** 图片解码结果 */
export interface ImageDecodeResult {
  /** 用于 <img src> 的 Object URL */
  objectUrl: string;
  /** 解码后的 Blob 对象 */
  blob: Blob;
  /** MIME 类型（如 image/png） */
  mimeType: string;
  /** 图片宽度（像素） */
  width: number;
  /** 图片高度（像素） */
  height: number;
  /** 文件大小（字节数） */
  size: number;
  /** 格式化后的文件大小（如 "3.2 KB"） */
  sizeFormatted: string;
}

/** 支持预览的图片 MIME 类型 */
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

/**
 * 从 data URI 中提取纯 Base64 数据和 MIME 类型
 * @param input data URI 或纯 Base64 字符串
 * @returns { pureBase64: string; mimeType: string | null }
 */
function parseDataUri(input: string): { pureBase64: string; mimeType: string | null } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { pureBase64: match[2], mimeType: match[1] };
  }
  return { pureBase64: input, mimeType: null };
}

/**
 * 检测给定 MIME 类型是否为图片
 * @param mimeType MIME 类型字符串
 */
export function isImageMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return IMAGE_MIME_TYPES.includes(mimeType);
}

/**
 * 将 Base64 字符串解码为图片 Blob
 * 自动识别 data URI 前缀，通过魔数检测 MIME 类型
 * @param base64Input data URI 或纯 Base64 字符串
 * @returns ImageDecodeResult（不含 width/height，需通过 loadImageDimensions 补充）
 */
export function decodeBase64ToImageBlob(
  base64Input: string,
): Omit<ImageDecodeResult, 'width' | 'height'> {
  const trimmed = base64Input.trim();
  if (!trimmed) {
    throw new Error('请输入 Base64 字符串');
  }

  const { pureBase64, mimeType: uriMime } = parseDataUri(trimmed);

  // 校验 Base64 有效性
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(pureBase64.replace(/\s/g, ''))) {
    throw new Error('输入不是有效的 Base64 编码');
  }

  const buffer = base64ToArrayBuffer(pureBase64);
  const detectedMime = uriMime ?? detectMimeType(pureBase64);

  if (!detectedMime || !isImageMimeType(detectedMime)) {
    throw new Error('无法识别为图片格式，请检查输入是否为图片的 Base64 编码');
  }

  const size = buffer.byteLength;
  const blob = new Blob([buffer], { type: detectedMime });
  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    blob,
    mimeType: detectedMime,
    size,
    sizeFormatted: formatFileSize(size),
  };
}

/**
 * 加载图片并获取尺寸信息
 * @param objectUrl 由 decodeBase64ToImageBlob 生成的 Object URL
 * @returns Promise<{ width: number; height: number }>
 */
export function loadImageDimensions(
  objectUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('图片加载失败，请检查输入数据'));
    };
    img.src = objectUrl;
  });
}

/**
 * 触发图片下载
 * @param blob 图片 Blob
 * @param mimeType MIME 类型，用于推断文件扩展名
 */
export function downloadImageBlob(blob: Blob, mimeType: string): void {
  const ext = mimeToImageExt(mimeType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `image${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * MIME 类型 → 图片文件扩展名
 * @param mimeType MIME 类型字符串
 */
export function mimeToImageExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
  };
  return map[mimeType] ?? '.png';
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/encoding/base64-image.ts
git commit -m "feat(base64-image): 添加 Base64 转图片工具函数"
```

---

## Task 2: Base64 转图片 — Vue 组件 + Astro 页面

**Files:**
- Create: `src/tools/encoding/Base64ToImage.vue`
- Create: `src/pages/encoding/base64-to-image.astro`

- [ ] **Step 1: 创建 `Base64ToImage.vue` 组件**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  decodeBase64ToImageBlob,
  loadImageDimensions,
  downloadImageBlob,
  isImageMimeType,
  type ImageDecodeResult,
} from '../../utils/encoding/base64-image';

const input = ref('');
const errorMsg = ref('');
const isLoading = ref(false);
const result = ref<ImageDecodeResult | null>(null);

/** 示例数据：1×1 红色像素 PNG */
const EXAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P4z8BQDwIMAQR' +
  'TEDEhAKkKDP8PhRjhAAAAAElFTkSuQmCC';

async function decode() {
  errorMsg.value = '';
  result.value = null;

  const trimmed = input.value.trim();
  if (!trimmed) return;

  // 大文件警告
  const raw = trimmed.replace(/^data:[^;]+;base64,/, '');
  const estimatedSize = Math.ceil((raw.length * 3) / 4);
  if (estimatedSize > 10 * 1024 * 1024) {
    errorMsg.value = '文件较大（超过 10MB），可能影响浏览器性能';
    return;
  }

  isLoading.value = true;
  try {
    const partial = decodeBase64ToImageBlob(trimmed);
    const dims = await loadImageDimensions(partial.objectUrl);
    result.value = {
      ...partial,
      width: dims.width,
      height: dims.height,
    };
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解码时出错';
  } finally {
    isLoading.value = false;
  }
}

watch(input, () => {
  if (!input.value.trim()) {
    result.value = null;
    errorMsg.value = '';
  }
});

function handleExample() {
  input.value = EXAMPLE_BASE64;
  decode();
}

function handleClear() {
  input.value = '';
  errorMsg.value = '';
  result.value = null;
}

function handleDownload() {
  if (!result.value) return;
  downloadImageBlob(result.value.blob, result.value.mimeType);
}

function handleCopyBase64() {
  return input.value.trim();
}
</script>

<template>
  <div>
    <ToolHeader
      title="Base64 转图片"
      description="将 Base64 字符串解码为图片，支持预览和下载"
      @example="handleExample"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">
            Base64 字符串
          </label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            placeholder="粘贴 Base64 字符串或 data:image/...;base64,... 格式"
          ></textarea>
        </div>

        <div class="flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isLoading"
            @click="decode"
          >
            {{ isLoading ? '解析中...' : '解析图片' }}
          </button>
          <ClearButton @clear="handleClear" />
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mt-3">{{ errorMsg }}</p>
      </template>

      <template #output>
        <div v-if="result">
          <div class="mb-3 p-3 border border-border rounded-sm bg-hover">
            <img
              :src="result.objectUrl"
              alt="解码图片"
              class="max-w-full max-h-80 rounded-sm"
            />
          </div>

          <div class="flex flex-col gap-1.5 mb-3">
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[60px]">尺寸：</span>
              <span class="text-text">{{ result.width }} × {{ result.height }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[60px]">大小：</span>
              <span class="text-text">{{ result.sizeFormatted }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[60px]">格式：</span>
              <span class="text-text">{{ result.mimeType }}</span>
            </div>
          </div>

          <div class="flex gap-2 items-center">
            <button
              class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
              @click="handleDownload"
            >
              下载图片
            </button>
            <CopyButton :text="handleCopyBase64" label="复制 Base64" />
          </div>
        </div>

        <div v-else class="text-muted text-sm py-8 text-center">
          输入 Base64 字符串后点击「解析图片」查看结果
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 2: 创建 `base64-to-image.astro` 页面**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import Base64ToImage from '../../tools/encoding/Base64ToImage.vue';
---

<ToolLayout title="Base64 转图片 - DevTools" toolId="encoding/base64-to-image">
  <Base64ToImage client:idle />
</ToolLayout>
```

- [ ] **Step 3: 提交**

```bash
git add src/tools/encoding/Base64ToImage.vue src/pages/encoding/base64-to-image.astro
git commit -m "feat(base64-to-image): 添加 Base64 转图片工具页面"
```

---

## Task 3: Base64 转文件 — 工具函数

**Files:**
- Create: `src/utils/encoding/base64-file.ts`
- Reference: `src/utils/encoding/base64.ts`（复用 `formatFileSize`、`base64ToArrayBuffer`）

- [ ] **Step 1: 创建 `base64-file.ts` 工具函数**

```typescript
/**
 * Base64 转文件工具函数
 * 将 Base64 字符串解码为文件 Blob，提供信息提取和下载能力
 */
import { formatFileSize, base64ToArrayBuffer } from './base64';

/** 文件解码结果 */
export interface FileDecodeResult {
  /** 解码后的 Blob 对象 */
  blob: Blob;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小（字节数） */
  size: number;
  /** 格式化后的文件大小 */
  sizeFormatted: string;
  /** 推断的文件扩展名（如 .txt） */
  extension: string;
  /** 推断的文件名（如 decoded-file.txt） */
  fileName: string;
}

/** 常用 MIME 类型选项（用于无 data URI 时手动选择） */
export const COMMON_MIME_TYPES = [
  { value: 'application/octet-stream', label: 'application/octet-stream（未知）' },
  { value: 'text/plain', label: 'text/plain（纯文本）' },
  { value: 'application/json', label: 'application/json（JSON）' },
  { value: 'application/pdf', label: 'application/pdf（PDF）' },
  { value: 'application/xml', label: 'application/xml（XML）' },
  { value: 'text/csv', label: 'text/csv（CSV）' },
  { value: 'application/zip', label: 'application/zip（ZIP）' },
  { value: 'application/gzip', label: 'application/gzip（GZIP）' },
  { value: 'image/png', label: 'image/png（PNG）' },
  { value: 'image/jpeg', label: 'image/jpeg（JPEG）' },
];

/**
 * 从 data URI 中提取纯 Base64 数据和 MIME 类型
 * @param input data URI 或纯 Base64 字符串
 */
function parseDataUri(input: string): { pureBase64: string; mimeType: string | null } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { pureBase64: match[2], mimeType: match[1] };
  }
  return { pureBase64: input, mimeType: null };
}

/**
 * MIME 类型 → 文件扩展名映射
 * @param mimeType MIME 类型字符串
 */
export function mimeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html',
    'text/xml': '.xml',
    'application/json': '.json',
    'application/pdf': '.pdf',
    'application/xml': '.xml',
    'application/zip': '.zip',
    'application/gzip': '.gz',
    'application/x-tar': '.tar',
    'application/x-7z-compressed': '.7z',
    'application/x-rar-compressed': '.rar',
    'application/octet-stream': '.bin',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/x-icon': '.ico',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[mimeType] ?? '.bin';
}

/**
 * 将 Base64 字符串解码为文件
 * @param base64Input data URI 或纯 Base64 字符串
 * @param fallbackMimeType 无 data URI 时的备用 MIME 类型，默认 application/octet-stream
 */
export function decodeBase64ToFile(
  base64Input: string,
  fallbackMimeType: string = 'application/octet-stream',
): FileDecodeResult {
  const trimmed = base64Input.trim();
  if (!trimmed) {
    throw new Error('请输入 Base64 字符串');
  }

  const { pureBase64, mimeType: uriMime } = parseDataUri(trimmed);

  // 校验 Base64 有效性
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(pureBase64.replace(/\s/g, ''))) {
    throw new Error('输入不是有效的 Base64 编码');
  }

  const mimeType = uriMime ?? fallbackMimeType;
  const buffer = base64ToArrayBuffer(pureBase64);
  const size = buffer.byteLength;
  const blob = new Blob([buffer], { type: mimeType });
  const extension = mimeToExtension(mimeType);

  return {
    blob,
    mimeType,
    size,
    sizeFormatted: formatFileSize(size),
    extension,
    fileName: `decoded-file${extension}`,
  };
}

/**
 * 触发文件下载
 * @param result 文件解码结果
 */
export function downloadFile(result: FileDecodeResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 检测输入是否包含 data URI 前缀
 * @param input 用户输入字符串
 */
export function hasDataUriPrefix(input: string): boolean {
  return /^data:[^;]+;base64,/.test(input.trim());
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/encoding/base64-file.ts
git commit -m "feat(base64-file): 添加 Base64 转文件工具函数"
```

---

## Task 4: Base64 转文件 — Vue 组件 + Astro 页面

**Files:**
- Create: `src/tools/encoding/Base64ToFile.vue`
- Create: `src/pages/encoding/base64-to-file.astro`

- [ ] **Step 1: 创建 `Base64ToFile.vue` 组件**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  decodeBase64ToFile,
  downloadFile,
  hasDataUriPrefix,
  COMMON_MIME_TYPES,
  type FileDecodeResult,
} from '../../utils/encoding/base64-file';

const input = ref('');
const errorMsg = ref('');
const result = ref<FileDecodeResult | null>(null);
const selectedMimeType = ref('application/octet-stream');
const showMimeSelector = ref(false);

/** 示例数据：JSON 文本的 Base64 */
const EXAMPLE_BASE64 = 'eyJuYW1lIjoiRGV2VG9vbHMiLCJ2ZXJzaW9uIjoiMS4wIiwiZGVzY3JpcHRpb24iOiLlnLDlnZror77nqIvlt6XkvZzmiJDliqDku6znmoTmlofmoaYifQ==';

function decode() {
  errorMsg.value = '';
  result.value = null;

  const trimmed = input.value.trim();
  if (!trimmed) return;

  // 大文件警告
  const raw = trimmed.replace(/^data:[^;]+;base64,/, '');
  const estimatedSize = Math.ceil((raw.length * 3) / 4);
  if (estimatedSize > 10 * 1024 * 1024) {
    errorMsg.value = '文件较大（超过 10MB），可能影响浏览器性能';
    return;
  }

  try {
    showMimeSelector.value = !hasDataUriPrefix(trimmed);
    result.value = decodeBase64ToFile(trimmed, selectedMimeType.value);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解码时出错';
  }
}

watch(input, () => {
  if (!input.value.trim()) {
    result.value = null;
    errorMsg.value = '';
    showMimeSelector.value = false;
  }
});

watch(selectedMimeType, () => {
  if (result.value && showMimeSelector.value) {
    // 重新解码以应用新的 MIME 类型
    try {
      result.value = decodeBase64ToFile(input.value, selectedMimeType.value);
    } catch {
      // 静默处理
    }
  }
});

function handleExample() {
  input.value = EXAMPLE_BASE64;
  decode();
}

function handleClear() {
  input.value = '';
  errorMsg.value = '';
  result.value = null;
  showMimeSelector.value = false;
}

function handleDownload() {
  if (!result.value) return;
  downloadFile(result.value);
}
</script>

<template>
  <div>
    <ToolHeader
      title="Base64 转文件"
      description="将 Base64 字符串解码为文件，支持 Data URI 格式自动识别"
      @example="handleExample"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">
            Base64 字符串
          </label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            placeholder="粘贴 Base64 字符串或 data:xxx;base64,... 格式"
          ></textarea>
        </div>

        <div class="flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
            @click="decode"
          >
            解析文件
          </button>
          <ClearButton @clear="handleClear" />
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mt-3">{{ errorMsg }}</p>
      </template>

      <template #output>
        <div v-if="result">
          <div class="flex flex-col gap-1.5 mb-4">
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">MIME 类型：</span>
              <span class="text-text">{{ result.mimeType }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">文件大小：</span>
              <span class="text-text">{{ result.sizeFormatted }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">扩展名：</span>
              <span class="text-text">{{ result.extension }}</span>
            </div>
            <div class="flex items-center gap-2 text-[0.8125rem]">
              <span class="text-muted min-w-[80px]">文件名：</span>
              <span class="text-text">{{ result.fileName }}</span>
            </div>
          </div>

          <!-- MIME 类型选择器（无 data URI 时显示） -->
          <div v-if="showMimeSelector" class="mb-4">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">
              指定 MIME 类型
            </label>
            <SelectListbox
              v-model="selectedMimeType"
              :options="COMMON_MIME_TYPES.map(m => ({ key: m.value, label: m.label }))"
            />
          </div>

          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
            @click="handleDownload"
          >
            下载文件
          </button>
        </div>

        <div v-else class="text-muted text-sm py-8 text-center">
          输入 Base64 字符串后点击「解析文件」查看结果
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 2: 创建 `base64-to-file.astro` 页面**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import Base64ToFile from '../../tools/encoding/Base64ToFile.vue';
---

<ToolLayout title="Base64 转文件 - DevTools" toolId="encoding/base64-to-file">
  <Base64ToFile client:idle />
</ToolLayout>
```

- [ ] **Step 3: 提交**

```bash
git add src/tools/encoding/Base64ToFile.vue src/pages/encoding/base64-to-file.astro
git commit -m "feat(base64-to-file): 添加 Base64 转文件工具页面"
```

---

## Task 5: 安装 cron-parser 依赖

**Files:**
- Modify: `package.json`（新增依赖）

- [ ] **Step 1: 安装 cron-parser**

```bash
pnpm add cron-parser
```

Expected: `package.json` 中新增 `"cron-parser": "^x.x.x"` 依赖。

- [ ] **Step 2: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 添加 cron-parser 依赖"
```

---

## Task 6: Cron 解析器 — 工具函数

**Files:**
- Create: `src/utils/datetime/cron.ts`

- [ ] **Step 1: 创建 `cron.ts` 工具函数**

```typescript
/**
 * Cron 表达式解析工具函数
 * 基于 cron-parser 库，提供表达式解析、字段构建和模板管理
 */
import { parseExpression } from 'cron-parser';

/** Cron 字段结构（标准 5 字段格式） */
export interface CronFields {
  minute: string;
  hour: string;
  day: string;
  month: string;
  dayOfWeek: string;
}

/** Cron 解析结果 */
export interface CronParseResult {
  /** 接下来 N 次执行时间 */
  nextExecutions: Date[];
  /** 当前表达式各字段值 */
  fields: CronFields;
}

/** 常用 Cron 模板 */
export const CRON_TEMPLATES = [
  { label: '每分钟', expression: '* * * * *' },
  { label: '每小时', expression: '0 * * * *' },
  { label: '每天零点', expression: '0 0 * * *' },
  { label: '每天 9 点', expression: '0 9 * * *' },
  { label: '每周一 9 点', expression: '0 9 * * 1' },
  { label: '每月 1 日零点', expression: '0 0 1 * *' },
  { label: '工作日 9 点', expression: '0 9 * * 1-5' },
  { label: '每 5 分钟', expression: '*/5 * * * *' },
  { label: '每 15 分钟', expression: '*/15 * * * *' },
  { label: '每 30 分钟', expression: '0,30 * * * *' },
] as const;

/** 字段名映射（中文） */
export const FIELD_LABELS: Record<keyof CronFields, string> = {
  minute: '分钟',
  hour: '小时',
  day: '日',
  month: '月',
  dayOfWeek: '周',
};

/** 各字段预设选项 */
export const FIELD_OPTIONS: Record<keyof CronFields, { key: string; label: string }[]> = {
  minute: [
    { key: '*', label: '每分钟' },
    { key: '*/5', label: '每 5 分钟' },
    { key: '*/15', label: '每 15 分钟' },
    { key: '*/30', label: '每 30 分钟' },
    { key: '0', label: '第 0 分' },
    { key: '0,30', label: '0 和 30 分' },
  ],
  hour: [
    { key: '*', label: '每小时' },
    { key: '0', label: '0 点' },
    { key: '6', label: '6 点' },
    { key: '9', label: '9 点' },
    { key: '12', label: '12 点' },
    { key: '18', label: '18 点' },
  ],
  day: [
    { key: '*', label: '每天' },
    { key: '1', label: '1 日' },
    { key: '15', label: '15 日' },
  ],
  month: [
    { key: '*', label: '每月' },
    { key: '1', label: '1 月' },
    { key: '*/3', label: '每 3 月' },
    { key: '*/6', label: '每 6 月' },
  ],
  dayOfWeek: [
    { key: '*', label: '每天' },
    { key: '1', label: '周一' },
    { key: '2', label: '周二' },
    { key: '3', label: '周三' },
    { key: '4', label: '周四' },
    { key: '5', label: '周五' },
    { key: '1-5', label: '工作日' },
    { key: '0,6', label: '周末' },
  ],
};

/**
 * 解析 Cron 表达式，返回接下来 N 次执行时间
 * @param expression 标准 5 字段 Cron 表达式
 * @param count 返回的执行时间数量，默认 10
 * @throws 表达式格式错误时抛出中文描述错误
 */
export function parseCronExpression(expression: string, count: number = 10): CronParseResult {
  const trimmed = expression.trim();

  if (!trimmed) {
    throw new Error('请输入 Cron 表达式');
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Cron 表达式应有 5 个字段（分 时 日 月 周）');
  }

  try {
    const interval = parseExpression(trimmed, {
      currentDate: new Date(),
      iterator: false,
    });

    const nextExecutions: Date[] = [];
    for (let i = 0; i < count; i++) {
      try {
        nextExecutions.push(interval.next().toDate());
      } catch {
        break;
      }
    }

    return {
      nextExecutions,
      fields: getFieldsFromExpression(trimmed),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '表达式无效';
    // 将 cron-parser 的英文错误翻译为中文
    if (msg.includes('invalid cron expression')) {
      throw new Error('无效的 Cron 表达式，请检查字段值');
    }
    throw new Error(`表达式解析失败：${msg}`);
  }
}

/**
 * 从 5 个字段值拼接 Cron 表达式
 * @param fields 各字段值
 */
export function buildCronFromFields(fields: CronFields): string {
  return [fields.minute, fields.hour, fields.day, fields.month, fields.dayOfWeek].join(' ');
}

/**
 * 将 Cron 表达式拆分为 5 个字段
 * @param expression 标准 5 字段 Cron 表达式
 */
export function getFieldsFromExpression(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  return {
    minute: parts[0] ?? '*',
    hour: parts[1] ?? '*',
    day: parts[2] ?? '*',
    month: parts[3] ?? '*',
    dayOfWeek: parts[4] ?? '*',
  };
}

/**
 * 格式化日期为本地时间字符串
 * @param date 日期对象
 */
export function formatExecutionTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/datetime/cron.ts
git commit -m "feat(cron-parser): 添加 Cron 解析器工具函数"
```

---

## Task 7: Cron 解析器 — Vue 组件 + Astro 页面

**Files:**
- Create: `src/tools/datetime/CronParser.vue`
- Create: `src/pages/datetime/cron-parser.astro`

- [ ] **Step 1: 创建 `CronParser.vue` 组件**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import DisclosureSection from '../../components/ui/DisclosureSection.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseCronExpression,
  buildCronFromFields,
  getFieldsFromExpression,
  formatExecutionTime,
  CRON_TEMPLATES,
  FIELD_OPTIONS,
  FIELD_LABELS,
  type CronFields,
} from '../../utils/datetime/cron';

const expression = ref('*/5 * * * *');
const errorMsg = ref('');
const executions = ref<string[]>([]);
const isBuilderOpen = ref(false);

const fields = ref<CronFields>({
  minute: '*/5',
  hour: '*',
  day: '*',
  month: '*',
  dayOfWeek: '*',
});

function parse() {
  errorMsg.value = '';
  executions.value = [];

  if (!expression.value.trim()) return;

  try {
    const result = parseCronExpression(expression.value);
    executions.value = result.nextExecutions.map(formatExecutionTime);
    // 同步字段到构建器
    fields.value = result.fields;
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解析时出错';
  }
}

// 输入变化时尝试实时解析
watch(expression, () => {
  const trimmed = expression.value.trim();
  if (!trimmed) {
    executions.value = [];
    errorMsg.value = '';
    return;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    parse();
  }
});

// 构建器字段变化时同步到表达式
watch(
  fields,
  (newFields) => {
    expression.value = buildCronFromFields(newFields);
  },
  { deep: true },
);

function handleTemplate(template: (typeof CRON_TEMPLATES)[number]) {
  expression.value = template.expression;
  fields.value = getFieldsFromExpression(template.expression);
}

function handleExample() {
  expression.value = '*/5 * * * *';
  fields.value = getFieldsFromExpression('*/5 * * * *');
  parse();
}

function handleClear() {
  expression.value = '';
  errorMsg.value = '';
  executions.value = [];
  fields.value = { minute: '*', hour: '*', day: '*', month: '*', dayOfWeek: '*' };
}

function copyExecutions(): string {
  return executions.value.map((t, i) => `#${i + 1}  ${t}`).join('\n');
}

// 初始解析
parse();
</script>

<template>
  <div class="max-w-[760px]">
    <ToolHeader
      title="Cron 表达式解析器"
      description="解析 Cron 表达式，预览执行时间，可视化构建"
      @example="handleExample"
    />

    <!-- Cron 输入框 -->
    <div class="mb-3">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">
        Cron 表达式
      </label>
      <input
        v-model="expression"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
        placeholder="*/5 * * * *"
      />
    </div>

    <div class="flex gap-2 items-center mb-3">
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

    <!-- 常用模板 -->
    <div class="mb-4">
      <label class="block text-[0.8125rem] text-muted font-medium mb-2">常用模板</label>
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="template in CRON_TEMPLATES"
          :key="template.expression"
          class="px-2.5 py-1 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 hover:bg-hover hover:text-text"
          @click="handleTemplate(template)"
        >
          {{ template.label }}
        </button>
      </div>
    </div>

    <!-- 可视化构建器 -->
    <DisclosureSection title="可视化构建器" v-model="isBuilderOpen">
      <div class="grid grid-cols-5 gap-3">
        <div v-for="(options, fieldKey) in FIELD_OPTIONS" :key="fieldKey" class="flex flex-col gap-1">
          <label class="text-[0.75rem] text-muted font-medium">
            {{ FIELD_LABELS[fieldKey as keyof CronFields] }}
          </label>
          <SelectListbox
            :model-value="fields[fieldKey as keyof CronFields]"
            :options="options"
            @update:model-value="(val: string) => { fields[fieldKey as keyof CronFields] = val }"
          />
        </div>
      </div>
    </DisclosureSection>

    <!-- 执行时间列表 -->
    <div v-if="executions.length" class="mt-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold m-0 text-text">下次执行时间</h3>
        <CopyButton :text="copyExecutions" label="复制列表" />
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="(time, index) in executions"
          :key="index"
          class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card"
        >
          <span class="text-xs font-semibold text-accent min-w-[32px] shrink-0">#{{ index + 1 }}</span>
          <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ time }}</code>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建 `cron-parser.astro` 页面**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import CronParser from '../../tools/datetime/CronParser.vue';
---

<ToolLayout title="Cron 表达式解析器 - DevTools" toolId="datetime/cron-parser">
  <CronParser client:idle />
</ToolLayout>
```

- [ ] **Step 3: 提交**

```bash
git add src/tools/datetime/CronParser.vue src/pages/datetime/cron-parser.astro
git commit -m "feat(cron-parser): 添加 Cron 表达式解析器工具页面"
```

---

## Task 8: 注册工具到 tools.ts

**Files:**
- Modify: `src/data/tools.ts:49-185`（在 `tools` 数组末尾追加 3 条记录）

- [ ] **Step 1: 在 `tools` 数组中追加三条记录**

在 `src/data/tools.ts` 文件中 `tools` 数组的最后一个工具条目（`qr-code-generator`）之后追加：

```typescript
  {
    id: 'base64-to-image',
    name: 'Base64 转图片',
    description: '将 Base64 字符串解码为图片，支持预览和下载',
    seoDescription: '在线 Base64 转图片工具，支持 PNG、JPEG、GIF、SVG、WebP 等格式，实时预览图片、显示尺寸大小信息，一键下载。',
    category: '编码转换',
    icon: '🖼️',
    path: '/encoding/base64-to-image',
  },
  {
    id: 'base64-to-file',
    name: 'Base64 转文件',
    description: '将 Base64 字符串解码为文件，支持 Data URI 格式自动识别',
    seoDescription: '在线 Base64 转文件工具，支持 Data URI 格式输入，自动识别 MIME 类型，一键下载还原文件。',
    category: '编码转换',
    icon: '📎',
    path: '/encoding/base64-to-file',
  },
  {
    id: 'cron-parser',
    name: 'Cron 表达式解析器',
    description: '解析 Cron 表达式，预览执行时间，可视化构建',
    seoDescription: '在线 Cron 表达式解析器，支持可视化构建、执行时间预览和常用模板，帮助开发者快速编写和验证定时任务表达式。',
    category: '日期时间',
    icon: '⏰',
    path: '/datetime/cron-parser',
  },
```

- [ ] **Step 2: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat: 注册 Base64 转图片、Base64 转文件、Cron 解析器三个工具"
```

---

## Task 9: 集成验证 — 构建测试

**Files:** 无新增/修改

- [ ] **Step 1: 运行构建**

```bash
pnpm build
```

Expected: 构建成功，无 TypeScript 错误，无 Astro 编译错误。输出中应包含三个新路由：
- `/encoding/base64-to-image`
- `/encoding/base64-to-file`
- `/datetime/cron-parser`

- [ ] **Step 2: 启动开发服务器并手动验证**

```bash
pnpm dev
```

逐个访问三个工具页面，验证：
1. **Base64 转图片**：点击「填入示例」→ 点击「解析图片」→ 看到图片预览 + 尺寸/大小/格式信息 → 点击「下载图片」→ 下载成功
2. **Base64 转文件**：点击「填入示例」→ 点击「解析文件」→ 看到 MIME/大小/扩展名信息 → 点击「下载文件」→ 下载成功
3. **Cron 解析器**：点击「填入示例」→ 看到执行时间列表 → 点击常用模板 → 输入框更新 → 打开可视化构建器 → 修改字段 → 输入框同步更新

- [ ] **Step 3: 修复发现的问题（如有）**

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "fix: 修复集成验证中发现的问题"
```
