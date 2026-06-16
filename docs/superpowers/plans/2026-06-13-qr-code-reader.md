# 二维码识别器（QR Code Reader）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/media/qr-code-reader` 工具，支持上传/拖拽/`Ctrl+V` 粘贴图片，纯浏览器端用 jsQR 解码二维码，识别 URL/邮箱/电话渲染为可点链接。

**Architecture:** Vue 3 组件 `QrCodeReader.vue` 负责输入交互与结果展示；纯函数模块 `src/utils/media/qr-reader.ts` 封装内容类型识别、缩放计算与 jsQR 解码（纯逻辑可单测，canvas 集成不单测）；`qr-code-reader.astro` 页面用 `ToolLayout` + `client:idle` 水合。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、Tailwind v4 令牌、jsQR（新增）、vitest。

**Spec:** `docs/superpowers/specs/2026-06-13-qr-code-reader-design.md`

**提交约定:** 本计划每个任务末尾含 commit step。项目当前在 `main` 分支，执行前应先开特性分支（如 `feat/qr-code-reader`），再按任务提交；提交信息用中文 + `feat(qr-reader):` 前缀，结尾附 `Co-Authored-By: Claude <noreply@anthropic.com>`。

---

## 文件结构

| 文件 | 责任 | 动作 |
|------|------|------|
| `src/utils/media/qr-reader.ts` | 内容类型识别、缩放计算、jsQR 解码封装 | 新增 |
| `src/utils/media/__tests__/qr-reader.test.ts` | 纯函数单测 | 新增 |
| `src/tools/media/QrCodeReader.vue` | 输入交互（上传/拖拽/粘贴）+ 结果展示 | 新增 |
| `src/pages/media/qr-code-reader.astro` | 页面壳层 | 新增 |
| `src/data/tools.ts` | 注册新工具 + 生成器双向关联 | 修改 |
| `src/data/tool-faqs.ts` | 新增 2 条 FAQ | 修改 |
| `package.json` | 新增 `jsqr` 依赖 | 修改 |

---

## Task 1: 安装 jsQR 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加 jsQR 到 dependencies**

在 `package.json` 的 `dependencies` 中（按字母序，`js-md5` 之后、`js-yaml` 之前）加入：

```json
    "jsqr": "^1.4.0",
```

- [ ] **Step 2: 安装依赖**

Run: `pnpm install`
Expected: 安装成功，`node_modules/jsqr` 存在，`jsqr/dist/index.d.ts` 存在（自带 TS 类型，无需 `@types/jsqr`）。

- [ ] **Step 3: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(qr-reader): 引入 jsQR 依赖

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 实现 detectContentType 纯函数（TDD）

按 `url → email → tel → text` 顺序判定，仅当整体严格匹配才归类，否则降级为 `text`。

**Files:**
- Create: `src/utils/media/__tests__/qr-reader.test.ts`
- Create: `src/utils/media/qr-reader.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/utils/media/__tests__/qr-reader.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { detectContentType } from '../qr-reader';

describe('detectContentType', () => {
  it('识别 http/https URL 为 url 类型', () => {
    const r = detectContentType('https://example.com/path?q=1');
    expect(r).toEqual({ type: 'url', value: 'https://example.com/path?q=1', href: 'https://example.com/path?q=1' });
  });

  it('识别 http URL', () => {
    expect(detectContentType('http://a.com').type).toBe('url');
  });

  it('含前导文字的 URL 降级为 text（避免误判）', () => {
    expect(detectContentType('请访问 https://x.com').type).toBe('text');
  });

  it('识别单个邮箱为 email 类型，href 为 mailto:', () => {
    const r = detectContentType('a@b.com');
    expect(r).toEqual({ type: 'email', value: 'a@b.com', href: 'mailto:a@b.com' });
  });

  it('非法邮箱降级为 text', () => {
    expect(detectContentType('not @valid').type).toBe('text');
  });

  it('识别中国大陆手机号为 tel', () => {
    const r = detectContentType('13800138000');
    expect(r.type).toBe('tel');
    expect(r.href).toBe('tel:13800138000');
  });

  it('识别 tel: 前缀', () => {
    expect(detectContentType('tel:13800138000').type).toBe('tel');
  });

  it('识别带国家码的国际号码', () => {
    expect(detectContentType('+86 13800138000').type).toBe('tel');
  });

  it('识别座机号码', () => {
    expect(detectContentType('010-12345678').type).toBe('tel');
  });

  it('过短数字串降级为 text', () => {
    expect(detectContentType('12345').type).toBe('text');
  });

  it('普通文本为 text', () => {
    expect(detectContentType('hello world')).toEqual({ type: 'text', value: 'hello world', href: '' });
  });

  it('空字符串为 text 且 value 为空', () => {
    expect(detectContentType('   ')).toEqual({ type: 'text', value: '', href: '' });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test -- src/utils/media/__tests__/qr-reader.test.ts`
Expected: FAIL，报错 `Failed to resolve import "../qr-reader"`（模块尚未创建）。

- [ ] **Step 3: 实现最小代码**

创建 `src/utils/media/qr-reader.ts`：

```typescript
/** 二维码解码后的内容类型 */
export type ContentType = 'url' | 'email' | 'tel' | 'text';

/** 内容识别结果 */
export interface ContentResult {
  /** 内容类型 */
  type: ContentType;
  /** 原始文本（已 trim） */
  value: string;
  /** 可点击链接（url/email/tel 有值，text 为空字符串） */
  href: string;
}

/** 整体匹配 http(s) URL */
const URL_RE = /^https?:\/\/\S+$/i;
/** 整体匹配单个邮箱 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 整体匹配电话：可选 tel: 前缀、可选国家码、手机号或座机 */
const TEL_RE = /^(?:tel:)?(?:\+\d{1,3}[\s-]?)?(?:1[3-9]\d{9}|\d{3,4}[\s-]?\d{7,8})$/;

/**
 * 识别二维码文本的内容类型，按 url → email → tel → text 顺序判定。
 * 仅当内容整体严格匹配对应格式时才归类，否则降级为 text。
 * @param raw 解码出的原始文本
 * @returns 内容识别结果
 */
export function detectContentType(raw: string): ContentResult {
  const value = raw.trim();
  if (!value) return { type: 'text', value: '', href: '' };

  if (URL_RE.test(value)) return { type: 'url', value, href: value };
  if (EMAIL_RE.test(value)) return { type: 'email', value, href: `mailto:${value}` };
  if (TEL_RE.test(value)) {
    const digits = value.replace(/^tel:/i, '').replace(/[\s()-]/g, '');
    return { type: 'tel', value, href: `tel:${digits}` };
  }
  return { type: 'text', value, href: '' };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test -- src/utils/media/__tests__/qr-reader.test.ts`
Expected: PASS（全部用例通过）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/media/qr-reader.ts src/utils/media/__tests__/qr-reader.test.ts
git commit -m "feat(qr-reader): 新增二维码内容类型识别

按 url→email→tel→text 顺序判定，整体严格匹配，含 12 条单测。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 实现 computeScaledSize 纯函数（TDD）

QR 不需高分辨率，解码前把长边限制在 1024px 以内，防止 O(w·h) 卡顿。

**Files:**
- Modify: `src/utils/media/qr-reader.ts`（追加函数与常量）
- Modify: `src/utils/media/__tests__/qr-reader.test.ts`（追加测试）

- [ ] **Step 1: 追加失败测试**

在 `src/utils/media/__tests__/qr-reader.test.ts` 顶部 import 追加 `computeScaledSize, QR_MAX_EDGE`：

```typescript
import { detectContentType, computeScaledSize, QR_MAX_EDGE } from '../qr-reader';
```

在文件末尾追加：

```typescript
describe('computeScaledSize', () => {
  it('长边超过上限时按比例缩放', () => {
    expect(computeScaledSize(2000, 1000)).toEqual({ width: 1024, height: 512 });
  });

  it('长边等于上限时保持原尺寸', () => {
    expect(computeScaledSize(1024, 512)).toEqual({ width: 1024, height: 512 });
  });

  it('小于上限时保持原尺寸', () => {
    expect(computeScaledSize(100, 100)).toEqual({ width: 100, height: 100 });
  });

  it('正方形大图缩放到上限', () => {
    expect(computeScaledSize(3000, 3000)).toEqual({ width: 1024, height: 1024 });
  });

  it('竖图按长边（高）缩放', () => {
    expect(computeScaledSize(500, 2000)).toEqual({ width: 256, height: 1024 });
  });

  it('非法尺寸返回 0', () => {
    expect(computeScaledSize(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it('默认上限为 QR_MAX_EDGE 常量', () => {
    expect(QR_MAX_EDGE).toBe(1024);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test -- src/utils/media/__tests__/qr-reader.test.ts`
Expected: FAIL，报错 `computeScaledSize is not a function` 或导入失败。

- [ ] **Step 3: 实现函数**

在 `src/utils/media/qr-reader.ts` 末尾追加：

```typescript
/** 解码前图像长边的最大像素，超过则等比缩放 */
export const QR_MAX_EDGE = 1024;

/**
 * 计算等比缩放后的图像尺寸：长边超过 maxEdge 时按比例缩小，否则保持原尺寸。
 * @param width 原始宽度
 * @param height 原始高度
 * @param maxEdge 长边上限，默认 QR_MAX_EDGE
 * @returns 缩放后尺寸；非法输入返回 {0, 0}
 */
export function computeScaledSize(
  width: number,
  height: number,
  maxEdge: number = QR_MAX_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test -- src/utils/media/__tests__/qr-reader.test.ts`
Expected: PASS（detectContentType + computeScaledSize 全部通过）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/media/qr-reader.ts src/utils/media/__tests__/qr-reader.test.ts
git commit -m "feat(qr-reader): 新增大图等比缩放计算

长边超过 1024px 时按比例缩小，防 jsQR O(w·h) 卡顿，含 7 条单测。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 实现 decodeQrFromImage 集成函数

封装 createImageBitmap → canvas 缩放 → getImageData → jsQR → detectContentType。依赖浏览器 canvas/ImageBitmap，不做单测，由组件集成与手动验收覆盖。

**Files:**
- Modify: `src/utils/media/qr-reader.ts`（追加类型与函数）

- [ ] **Step 1: 追加集成函数**

在 `src/utils/media/qr-reader.ts` 文件最顶部（所有 `export` 之前）追加 import：

```typescript
import jsQR from 'jsqr';
```

在文件末尾追加：

```typescript
/** 解码未识别到二维码时的统一错误提示 */
export const QR_DECODE_ERROR = '未识别到二维码，请确保图片清晰、二维码完整且占图较大比例';

/** 解码成功结果 */
export interface DecodeSuccess {
  ok: true;
  result: ContentResult;
}

/** 解码失败结果 */
export interface DecodeFailure {
  ok: false;
  error: string;
}

/** 解码结果（成功或失败） */
export type DecodeOutcome = DecodeSuccess | DecodeFailure;

/**
 * 从图片源解码二维码：createImageBitmap → 等比缩放 → jsQR 识别 → 内容类型判定。
 * 运行于浏览器环境（依赖 canvas 与 createImageBitmap）。
 * @param source 图片源（File / Blob 等 ImageBitmapSource）
 * @returns 成功返回内容识别结果，失败返回中文错误提示
 */
export async function decodeQrFromImage(source: ImageBitmapSource): Promise<DecodeOutcome> {
  try {
    const bitmap = await createImageBitmap(source);
    const { width, height } = computeScaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: QR_DECODE_ERROR };
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height);
    if (!decoded?.data) return { ok: false, error: QR_DECODE_ERROR };
    return { ok: true, result: detectContentType(decoded.data) };
  } catch {
    return { ok: false, error: QR_DECODE_ERROR };
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec astro check`
Expected: 无类型错误（jsQR 自带类型，`ImageBitmapSource` / `createImageBitmap` 为 lib.dom 类型）。

- [ ] **Step 3: 提交**

```bash
git add src/utils/media/qr-reader.ts
git commit -m "feat(qr-reader): 封装 jsQR 图片解码集成函数

createImageBitmap → 等比缩放 → jsQR → 内容识别，失败统一中文提示。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 实现 QrCodeReader.vue 组件

上传/拖拽/`Ctrl+V` 粘贴三合一输入，调用 `decodeQrFromImage`，展示文本 + 可点链接 + 复制 + 清空，内联中文错误。

**Files:**
- Create: `src/tools/media/QrCodeReader.vue`

- [ ] **Step 1: 创建组件**

创建 `src/tools/media/QrCodeReader.vue`：

```vue
<script setup lang="ts">
/**
 * 二维码识别器组件。
 *
 * - 支持点击选择、拖拽、Ctrl+V 粘贴三种图片输入方式
 * - 调用 decodeQrFromImage 纯浏览器端解码（jsQR）
 * - URL/邮箱/电话识别为可点击链接，其余为纯文本
 * - 非图片、超大、无码等场景给出内联中文错误
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { decodeQrFromImage, type ContentResult } from '../../utils/media/qr-reader';

/** 图片文件大小上限：10MB（QR 用不着大图） */
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

/** 缩略图预览的 DataURL */
const previewUrl = ref('');
/** 解码结果（识别成功后赋值） */
const result = ref<ContentResult | null>(null);
/** 内联错误信息 */
const errorMsg = ref('');
/** 是否正在解码 */
const isProcessing = ref(false);
/** 是否处于拖拽悬停状态 */
const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 文件大小人类可读格式 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 处理一张图片文件：校验后解码并更新状态 */
async function processFile(file: File): Promise<void> {
  // 释放上一次的 object URL，避免连续识别时内存泄漏
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  errorMsg.value = '';
  result.value = null;

  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请上传图片文件（PNG / JPG / WebP 等）';
    return;
  }
  if (file.size > FILE_SIZE_LIMIT) {
    errorMsg.value = `图片过大（${formatFileSize(file.size)}），请压缩后重试`;
    return;
  }

  previewUrl.value = URL.createObjectURL(file);
  isProcessing.value = true;
  try {
    const outcome = await decodeQrFromImage(file);
    if (outcome.ok) {
      result.value = outcome.result;
    } else {
      errorMsg.value = outcome.error;
    }
  } finally {
    isProcessing.value = false;
  }
}

/** 点击选择文件 */
function handlePick(): void {
  fileInputRef.value?.click();
}

/** input change 事件 */
function handleChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void processFile(file);
}

/** 拖拽放置 */
function handleDrop(event: DragEvent): void {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) void processFile(file);
}

/** 全局粘贴事件：取剪贴板中的图片 */
async function handlePaste(event: ClipboardEvent): Promise<void> {
  const items = event.clipboardData?.items;
  if (!items) return;
  // DataTransferItemList 不可迭代（无 Symbol.iterator），须用索引遍历
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

/** 清空全部状态 */
function handleClear(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  result.value = null;
  errorMsg.value = '';
  if (fileInputRef.value) fileInputRef.value.value = '';
}

onMounted(() => {
  window.addEventListener('paste', handlePaste);
});

onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste);
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<template>
  <div class="mx-auto w-full max-w-[720px]">
    <ToolHeader
      title="二维码识别器"
      description="上传、拖拽或 Ctrl+V 粘贴二维码图片，纯浏览器端识别解码，支持 URL/邮箱/电话可点击"
      :show-example="false"
    />

    <!-- 输入区：点击/拖拽/粘贴三合一 -->
    <div
      class="border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-[border-color,background-color] duration-150"
      :class="isDragging ? 'border-accent bg-hover' : 'border-border bg-card hover:border-accent'"
      role="button"
      tabindex="0"
      aria-label="点击选择、拖拽或 Ctrl+V 粘贴二维码图片"
      @click="handlePick"
      @keydown.enter.prevent="handlePick"
      @keydown.space.prevent="handlePick"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <div class="text-4xl mb-3">📷</div>
      <p class="text-sm text-text m-0">拖拽图片到这里，或点击选择</p>
      <p class="text-[0.75rem] text-muted mt-1 m-0">也可按 Ctrl+V 粘贴截图</p>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleChange"
      />
    </div>

    <!-- 处理中 -->
    <div v-if="isProcessing" class="mt-4 text-sm text-muted text-center">
      识别中...
    </div>

    <!-- 错误 -->
    <p v-else-if="errorMsg" class="mt-4 text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>

    <!-- 结果区 -->
    <div
      v-if="result || previewUrl"
      class="border border-border rounded-md bg-card mt-4"
    >
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-border flex-wrap">
        <span class="text-sm font-medium">识别结果</span>
        <ClearButton @clear="handleClear" />
      </div>

      <div class="p-4 flex gap-4 items-start flex-wrap">
        <!-- 缩略图 -->
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="已识别图片缩略图"
          class="w-24 h-24 object-contain border border-border rounded-sm bg-white p-1"
        />

        <!-- 文本结果 -->
        <div class="flex-1 min-w-[200px]">
          <p class="text-[0.75rem] text-muted m-0 mb-1">
            类型：{{ result ? { url: 'URL', email: '邮箱', tel: '电话', text: '文本' }[result.type] : '—' }}
          </p>
          <div class="flex items-start gap-2 flex-wrap">
            <a
              v-if="result?.href"
              :href="result.href"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono text-sm text-accent break-all hover:underline"
            >{{ result.value }}</a>
            <span
              v-else-if="result"
              class="font-mono text-sm text-text break-all whitespace-pre-wrap"
            >{{ result.value }}</span>
            <span v-else class="text-sm text-muted">（未识别到内容）</span>
            <CopyButton v-if="result?.value" :text="result.value" />
            <a
              v-if="result?.type === 'url'"
              :href="result.href"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent no-underline"
            >打开</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec astro check`
Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/tools/media/QrCodeReader.vue
git commit -m "feat(qr-reader): 新增二维码识别器组件

点击/拖拽/Ctrl+V 三合一输入，jsQR 解码，URL/邮箱/电话可点击，内联中文错误。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 创建页面 qr-code-reader.astro

**Files:**
- Create: `src/pages/media/qr-code-reader.astro`

- [ ] **Step 1: 创建页面**

创建 `src/pages/media/qr-code-reader.astro`（照搬生成器页面结构，改 import 与 toolId）：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import QrCodeReader from '../../tools/media/QrCodeReader.vue';
---

<ToolLayout toolId="media/qr-code-reader">
  <QrCodeReader client:idle />
</ToolLayout>
```

- [ ] **Step 2: 提交**

```bash
git add src/pages/media/qr-code-reader.astro
git commit -m "feat(qr-reader): 新增二维码识别器页面路由 /media/qr-code-reader

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 注册工具 + 生成器双向关联

**Files:**
- Modify: `src/data/tools.ts`

- [ ] **Step 1: 在 tools 数组追加新工具**

在 `src/data/tools.ts` 的 `tools` 数组末尾（`docker-converter` 对象之后、结束 `];` 之前）追加：

```typescript
  {
    id: 'qr-code-reader',
    name: '二维码识别器',
    description: '上传、拖拽或 Ctrl+V 粘贴二维码图片，纯浏览器端识别解码，支持 URL/邮箱/电话可点击',
    seoDescription: '在线二维码识别工具，支持拖拽上传与 Ctrl+V 粘贴截图识别二维码，纯浏览器端解码数据不上传，识别 URL/邮箱/电话等内容并提供可点击链接。',
    category: '媒体工具',
    icon: '📷',
    path: '/media/qr-code-reader',
    keywords: ['二维码识别', '二维码解码', 'qr code 识别', '在线扫码', '截图识别二维码', '二维码图片读取'],
    relatedToolIds: ['qr-code-generator'],
  },
```

- [ ] **Step 2: 生成器 relatedToolIds 追加双向关联**

找到 `qr-code-generator` 对象的 `relatedToolIds`（当前为 `['base64-to-image']`），改为：

```typescript
    relatedToolIds: ['base64-to-image', 'qr-code-reader'],
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec astro check`
Expected: 无类型错误（新对象字段齐全，符合 `ToolMeta`）。

- [ ] **Step 4: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat(qr-reader): 注册二维码识别器并与生成器双向关联

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 添加 FAQ

**Files:**
- Modify: `src/data/tool-faqs.ts`

- [ ] **Step 1: 追加 qr-code-reader FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中，`qr-code-generator` 数组之后（`cron-parser` 之前，或任意位置）追加新 key：

```typescript
  'qr-code-reader': [
    {
      question: '为什么识别失败？',
      answer: '常见原因：图片<strong>模糊</strong>、二维码<strong>残缺或被遮挡</strong>、二维码在图中<strong>占比过小</strong>、或是非标准 QR 码（如某些艺术变形码）。建议截取二维码主体区域、放大后重新识别。本工具会在解码前将图片长边缩放至 1024px，过小的二维码反而可能因缩放丢失细节。',
    },
    {
      question: '支持哪些图片格式？',
      answer: '支持浏览器可解码的所有常见格式：<strong>PNG / JPG / WebP / BMP / GIF（取首帧）</strong>等。可直接拖拽文件、点击选择，或用 <code>Ctrl+V</code> 粘贴截图。单张图片上限 <strong>10MB</strong>。',
    },
  ],
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec astro check`
Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/data/tool-faqs.ts
git commit -m "feat(qr-reader): 新增二维码识别器 FAQ

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 构建验收与体积检查

**Files:** 无（验证任务）

- [ ] **Step 1: 运行全部单测**

Run: `pnpm test`
Expected: 全部 PASS（含新增 qr-reader 测试与既有测试）。

- [ ] **Step 2: 生产构建**

Run: `pnpm build`
Expected: 构建成功，无错误。

- [ ] **Step 3: 体积检查**

在 `dist/` 输出中找到 `qr-code-reader` 页面相关 JS chunk（含 jsQR，文件名通常含哈希）。检查其 gzip 体积：
- jsQR gzip ≈ 16KB，加组件本身预计 < 25KB
- **验收线：gzip < 50KB**（PRODUCT.md §Performance Baselines）

若超 50KB，排查是否误打包其他大依赖。

- [ ] **Step 4: 手动验收（pnpm dev 后逐项确认）**

Run: `pnpm dev`，访问 `/media/qr-code-reader`，逐项核对 spec §6 验收标准：

- [ ] 拖拽一张含网址的二维码 PNG → 识别出 URL，显示为可点击链接 + 「打开」按钮
- [ ] 点击选择图片可识别
- [ ] 截图后 `Ctrl+V` 粘贴可识别
- [ ] 邮箱内容渲染为 `mailto:` 链接；电话渲染为 `tel:` 链接
- [ ] 「复制」按钮可用并触发 Toast「已复制」
- [ ] 「清空」重置全部状态（含缩略图、结果、错误）
- [ ] 上传非图片文件 → 内联提示「请上传图片文件…」
- [ ] 上传 >10MB 图片 → 内联提示「图片过大…」
- [ ] 上传无二维码的图片 → 内联提示「未识别到二维码…」
- [ ] 侧边栏媒体分类显示新工具，生成器「相关工具」出现识别器（双向关联生效）
- [ ] 链接带 `target="_blank" rel="noopener noreferrer"`
- [ ] Tab 键可聚焦上传区，Enter/Space 可触发选择（键盘可达）

- [ ] **Step 5: 提交（如有验收中发现的修复）**

若 Step 4 发现并修复了问题，提交修复；否则跳过。

```bash
git add -A
git commit -m "fix(qr-reader): 验收修复（按实际情况填写）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 完成标准

全部 9 个 Task 的 checkbox 勾选完毕，且：
- `pnpm test` 全绿
- `pnpm build` 成功，单页 JS gzip < 50KB
- spec §6 验收标准全部手动确认通过
