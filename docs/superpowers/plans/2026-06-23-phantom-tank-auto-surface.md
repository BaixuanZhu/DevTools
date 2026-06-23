# 幻影坦克 · 单图自动生成表图 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让幻影坦克工具支持只上传里图，自动反解出满足约束的反相表图并合成，附带「里图暗化」滑块调节黑底清晰度。

**Architecture:** 新增纯函数 `generateSurfaceFromHidden(imageData, darken)` 同时产出「灰度反相表图 + 等比压暗里图」，复用现有 `createPhantomTank` 合成。`PhantomTank.vue` 新增 `surfaceSource` 来源标记（manual/auto），里图上传后自动生成表图预览（包装成 `File` 喂给现有 `FileDropzone`），`handleGenerate` 按来源分流转合成输入。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、Tailwind v4、Vitest（node 环境）。

## Global Constraints

- TypeScript strict 模式；**无路径别名**，所有导入用相对路径（如 `../../utils/media/phantom-tank`）。
- Tailwind v4：优先标准类名（4px 基准），**禁止任意值语法** `-[value]` 表示标准间距；设计令牌文本尺寸 `text-[0.8125rem]` 等允许。
- 公共类/接口/方法必须写 JSDoc/TSDoc；注释只补「为什么」，不重复代码。
- 安全：禁止 `eval()`/`Function()`；正则用 `new RegExp` + try-catch。
- 测试：Vitest `environment: 'node'`、`globals: true`，单测置于被测模块同目录 `__tests__/`。
- 不新增依赖（纯 Canvas API + 现有 `createPhantomTank`）。

**参考设计文档：** `docs/superpowers/specs/2026-06-23-phantom-tank-auto-surface-design.md`

---

## File Structure

| 文件 | 责任 | 改动 |
|---|---|---|
| `src/utils/media/phantom-tank.ts` | 合成算法 + 自动表图生成纯函数 | 新增 `AutoSurfaceInput/Output` 类型 + `generateSurfaceFromHidden`（复用私有 `toGray`） |
| `src/utils/media/__tests__/phantom-tank.test.ts` | 算法单测 | 增补 `generateSurfaceFromHidden` 用例 |
| `src/tools/media/PhantomTank.vue` | 工具主组件 | 状态、自动生成逻辑、合成分流、滑块/按钮 UI |
| `src/data/tool-faqs.ts` | FAQ 文案 | `phantom-tank` 补 2 条 |
| `src/data/tools.ts` | 工具注册表 | `phantom-tank` 的 `description`/`seoDescription`/`keywords` 微调 |

`phantom-tank.worker.ts`、`phantom-tank.astro` 不改。

---

### Task 1: `generateSurfaceFromHidden` 纯函数（TDD）

**Files:**
- Modify: `src/utils/media/phantom-tank.ts`（在文件末尾 `createPhantomTank` 之后追加）
- Test: `src/utils/media/__tests__/phantom-tank.test.ts`

**Interfaces:**
- Consumes: 现有私有 `toGray(r,g,b): number`（同文件，直接复用）
- Produces: `generateSurfaceFromHidden(input: AutoSurfaceInput): AutoSurfaceOutput`，其中 `AutoSurfaceInput = { imageData: ImageData; darken: number }`，`AutoSurfaceOutput = { surface: ImageData; hidden: ImageData }`。Task 2 的 `PhantomTank.vue` 依赖此签名。

- [ ] **Step 1: 写失败测试**

在 `src/utils/media/__tests__/phantom-tank.test.ts` 顶部 import 追加 `generateSurfaceFromHidden`，并在文件末尾追加测试块与彩色像素 helper：

```ts
// 顶部 import 行改为：
import { createPhantomTank, validateSameSize, generateSurfaceFromHidden } from '../phantom-tank';
```

```ts
/**
 * 构造一张 1×1 彩色像素图，用于验证色相保持与通道独立运算。
 * @param r 红色 0-255
 * @param g 绿色 0-255
 * @param b 蓝色 0-255
 */
function pixel(r: number, g: number, b: number): ImageData {
  const data = new Uint8ClampedArray([r, g, b, 255]);
  return new ImageData(data, 1, 1);
}

describe('generateSurfaceFromHidden', () => {
  it('输出尺寸与输入一致', () => {
    const img = solidGray(5, 3, 100);
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: img, darken: 0 });
    expect(surface.width).toBe(5);
    expect(surface.height).toBe(3);
    expect(hidden.width).toBe(5);
    expect(hidden.data.length).toBe(img.data.length);
  });

  it('d=0 纯黑像素 → surface 全白、hidden 不变', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: pixel(0, 0, 0), darken: 0 });
    expect(surface.data[0]).toBe(255);
    expect(surface.data[1]).toBe(255);
    expect(surface.data[2]).toBe(255);
    expect(hidden.data[0]).toBe(0);
  });

  it('d=0 中灰(100) → 真反相 La=155', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: solidGray(1, 1, 100), darken: 0 });
    expect(surface.data[0]).toBe(155);
    expect(hidden.data[0]).toBe(100);
  });

  it('d=0 亮灰(200) → 自适应防穿帮 La=max(55,200)=200', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: solidGray(1, 1, 200), darken: 0 });
    expect(surface.data[0]).toBe(200);
    expect(hidden.data[0]).toBe(200);
  });

  it('d=0.5 彩色(200,200,100) → hidden 等比压暗、surface 按压暗后灰度反相、三通道相等', () => {
    const { surface, hidden } = generateSurfaceFromHidden({ imageData: pixel(200, 200, 100), darken: 0.5 });
    // hidden 各通道 ×0.5
    expect(hidden.data[0]).toBe(100);
    expect(hidden.data[1]).toBe(100);
    expect(hidden.data[2]).toBe(50);
    // L=0.299·100+0.587·100+0.114·50=94.3 → La=max(160.7,94.3)=160.7 → 取整 161
    expect(surface.data[0]).toBe(161);
    expect(surface.data[1]).toBe(161);
    expect(surface.data[2]).toBe(161);
  });

  it('不变式：任意灰度下 gray(surface) ≥ gray(hidden)（防穿帮契约）', () => {
    for (const gray of [0, 50, 100, 127, 128, 180, 200, 255]) {
      const { surface, hidden } = generateSurfaceFromHidden({ imageData: solidGray(2, 2, gray), darken: 0.3 });
      for (let i = 0; i < surface.data.length; i += 4) {
        const gs = 0.299 * surface.data[i] + 0.587 * surface.data[i + 1] + 0.114 * surface.data[i + 2];
        const gh = 0.299 * hidden.data[i] + 0.587 * hidden.data[i + 1] + 0.114 * hidden.data[i + 2];
        expect(gs).toBeGreaterThanOrEqual(gh - 0.5);
      }
    }
  });

  it('hidden 保持原色相（等比压暗，R:G:B 比值不变）', () => {
    const { hidden } = generateSurfaceFromHidden({ imageData: pixel(200, 200, 100), darken: 0.5 });
    // 原 200:200:100 = 2:2:1；压暗后 100:100:50 = 2:2:1
    expect(hidden.data[0] / hidden.data[2]).toBeCloseTo(2, 1);
    expect(hidden.data[1] / hidden.data[2]).toBeCloseTo(2, 1);
  });

  it('d=0.8 上限：纯白(255) → hidden 压到 51', () => {
    const { hidden } = generateSurfaceFromHidden({ imageData: solidGray(1, 1, 255), darken: 0.8 });
    expect(hidden.data[0]).toBe(51); // 255×0.2=51
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/utils/media/__tests__/phantom-tank.test.ts`
Expected: FAIL，报 `generateSurfaceFromHidden is not exported`（函数尚未实现）。

- [ ] **Step 3: 实现函数**

在 `src/utils/media/phantom-tank.ts` 末尾（`createPhantomTank` 之后）追加：

```ts
/** 自动表图生成输入：里图原图 + 暗化强度。 */
export interface AutoSurfaceInput {
  /** 里图原图（彩色）的像素数据 */
  imageData: ImageData;
  /** 暗化强度 d ∈ [0, 0.8]，滑块百分比 / 100；0 不暗化 */
  darken: number;
}

/** 自动表图生成输出：表图 + 暗化里图，同尺寸、同一 d 计算。 */
export interface AutoSurfaceOutput {
  /** 灰度反相表图（R=G=B=La），白底显示 */
  surface: ImageData;
  /** 等比压暗的彩色里图（保色相），黑底显示 */
  hidden: ImageData;
}

/**
 * 从里图自动生成配套表图：里图各通道等比压暗 → 算灰度 → 自适应反相得表图。
 *
 * 自适应反相 La = max(255 − L, L)：L ≤ 127 走真反相（白底清晰负片）；
 * L > 127 时 La = L，该处 alpha=255，但里图本就偏亮、白底合成也接近白，视觉无穿帮。
 *
 * 同时返回暗化里图，保证表图与里图用同一 d、尺寸天然一致，供 {@link createPhantomTank} 合成。
 *
 * @param input 里图原图与暗化强度
 * @returns surface 灰度反相表图、hidden 暗化彩色里图（均与输入同尺寸）
 */
export function generateSurfaceFromHidden(input: AutoSurfaceInput): AutoSurfaceOutput {
  const { imageData, darken } = input;
  const { width, height, data } = imageData;
  const surfaceData = new Uint8ClampedArray(data.length);
  const hiddenData = new Uint8ClampedArray(data.length);
  const keep = 1 - darken; // 暗化后保留比例

  for (let i = 0; i < data.length; i += 4) {
    // 1. 等比压暗里图（保色相），赋 Uint8ClampedArray 自动取整
    const rd = data[i] * keep;
    const gd = data[i + 1] * keep;
    const bd = data[i + 2] * keep;
    hiddenData[i] = rd;
    hiddenData[i + 1] = gd;
    hiddenData[i + 2] = bd;
    hiddenData[i + 3] = 255;

    // 2. 暗化里图灰度 → 3. 自适应反相表图（灰度）
    const l = toGray(rd, gd, bd);
    const la = Math.max(255 - l, l);
    surfaceData[i] = la;
    surfaceData[i + 1] = la;
    surfaceData[i + 2] = la;
    surfaceData[i + 3] = 255;
  }

  return {
    surface: new ImageData(surfaceData, width, height),
    hidden: new ImageData(hiddenData, width, height),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/utils/media/__tests__/phantom-tank.test.ts`
Expected: PASS，全部 `generateSurfaceFromHidden` 用例通过，原有用例不回归。

- [ ] **Step 5: 类型检查**

Run: `pnpm exec astro check`
Expected: 无新增错误（IDE 对新文件可能有索引延迟的假阳性，以 astro check 为准）。

- [ ] **Step 6: Commit**

```bash
git add src/utils/media/phantom-tank.ts src/utils/media/__tests__/phantom-tank.test.ts
git commit -m "feat(phantom-tank): add generateSurfaceFromHidden for auto surface generation"
```

---

### Task 2: `PhantomTank.vue` 自动生成数据流

接通核心数据流：里图上传后自动生成反相表图预览，`handleGenerate` 按来源分流合成。**本任务不加滑块/按钮 UI**（Task 3 加），仅靠里图上传自动触发即可验证。

**Files:**
- Modify: `src/tools/media/PhantomTank.vue`

**Interfaces:**
- Consumes: Task 1 的 `generateSurfaceFromHidden({ imageData, darken }): { surface, hidden }`
- Produces: `PhantomTank.vue` 具备 `surfaceSource` 来源管理与 auto 合成分流。

- [ ] **Step 1: 修改 import**

`src/tools/media/PhantomTank.vue` 第 20 行改为：

```ts
import { createPhantomTank, generateSurfaceFromHidden } from '../../utils/media/phantom-tank';
```

- [ ] **Step 2: 新增状态（在现有 `errorMsg` ref 之后插入）**

在 `const errorMsg = ref('');` 之后插入：

```ts
/** 表图来源：manual 手动上传 / auto 自动生成 / null 未设置 */
type SurfaceSource = 'manual' | 'auto' | null;
const surfaceSource = ref<SurfaceSource>(null);
/** 里图暗化滑块值 0-80（百分比），实际 d = 值/100；Task 3 加 UI */
const darken = ref(30);
/** 暗化系数（滑块值/100），generateAutoSurface 与 Task 3 watch 共用 */
const darkenFactor = computed(() => darken.value / 100);
/** 里图原图整图像素缓存，作为自动生成表图的输入 */
const hiddenImageData = ref<ImageData | null>(null);
/** 自动生成的表图/暗化里图像素缓存，auto 合成输入 */
const autoSurface = ref<ImageData | null>(null);
const autoHidden = ref<ImageData | null>(null);
```

- [ ] **Step 3: 新增 `generateAutoSurface` 函数（在 `cropCenterToImageData` 之后插入）**

```ts
/**
 * 从里图原图生成自动表图 + 暗化里图，并把表图预览填充到表图区。
 *
 * 将 surface 画到 canvas 编码为 PNG Blob，包装成 File 赋给 surfaceFile，
 * 使现有 FileDropzone 无需改造即可显示预览与删除。来源标记为 'auto'。
 */
async function generateAutoSurface(): Promise<void> {
  const imgData = hiddenImageData.value;
  if (!imgData) return;
  errorMsg.value = '';
  try {
    const { surface, hidden } = generateSurfaceFromHidden({
      imageData: imgData,
      darken: darkenFactor.value,
    });
    autoSurface.value = surface;
    autoHidden.value = hidden;

    const canvas = document.createElement('canvas');
    canvas.width = surface.width;
    canvas.height = surface.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.putImageData(surface, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('表图编码失败');

    if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
    surfacePreviewUrl.value = URL.createObjectURL(blob);
    // 包装 File 让 FileDropzone 的 hasFile/预览/删除正常工作；auto 合成不依赖此 File
    surfaceFile.value = new File([blob], 'auto-surface.png', { type: 'image/png' });
    surfaceSource.value = 'auto';
    clearResult();
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '自动表图生成失败';
  }
}
```

- [ ] **Step 4: 修改 `handleSurfaceSelect`（手动上传标记 manual）**

将现有 `handleSurfaceSelect` 函数体替换为：

```ts
async function handleSurfaceSelect(file: File): Promise<void> {
  clearResult();
  errorMsg.value = '';
  surfaceSource.value = 'manual'; // 手动上传覆盖 auto 预览
  if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
  surfacePreviewUrl.value = URL.createObjectURL(file);
  try {
    if (surfaceBitmap.value) surfaceBitmap.value.close?.();
    surfaceBitmap.value = await decodeBitmap(file);
  } catch (e) {
    surfaceBitmap.value = null;
    surfaceSource.value = null;
    if (surfacePreviewUrl.value) {
      URL.revokeObjectURL(surfacePreviewUrl.value);
      surfacePreviewUrl.value = '';
    }
    errorMsg.value = e instanceof Error ? e.message : '图片解码失败';
  }
}
```

- [ ] **Step 5: 修改 `handleHiddenSelect`（解码后缓存 ImageData + 自动生成表图）**

将现有 `handleHiddenSelect` 函数体替换为：

```ts
async function handleHiddenSelect(file: File): Promise<void> {
  clearResult();
  errorMsg.value = '';
  if (hiddenPreviewUrl.value) URL.revokeObjectURL(hiddenPreviewUrl.value);
  hiddenPreviewUrl.value = URL.createObjectURL(file);
  try {
    if (hiddenBitmap.value) hiddenBitmap.value.close?.();
    hiddenBitmap.value = await decodeBitmap(file);
    // 缓存里图原图整图像素（不裁剪，auto 单图无对齐问题）
    hiddenImageData.value = cropCenterToImageData(
      hiddenBitmap.value,
      hiddenBitmap.value.width,
      hiddenBitmap.value.height,
    );
    // 自动生成一次反相表图预览，让用户打开即可见效果
    await generateAutoSurface();
  } catch (e) {
    hiddenBitmap.value = null;
    hiddenImageData.value = null;
    if (hiddenPreviewUrl.value) {
      URL.revokeObjectURL(hiddenPreviewUrl.value);
      hiddenPreviewUrl.value = '';
    }
    errorMsg.value = e instanceof Error ? e.message : '图片解码失败';
  }
}
```

- [ ] **Step 6: 修改 `handleGenerate`（按来源分流）**

将现有 `handleGenerate` 函数体替换为：

```ts
async function handleGenerate(): Promise<void> {
  if (isProcessing.value) return;
  errorMsg.value = '';
  isProcessing.value = true;
  try {
    let result: ImageData;
    if (surfaceSource.value === 'auto') {
      const s = autoSurface.value;
      const h = autoHidden.value;
      if (!s || !h) throw new Error('表图未就绪，请重新上传里图或点「从里图自动生成」');
      const limit = checkCanvasLimits(s.width, s.height);
      if (!limit.ok) throw new Error(limit.error!);
      // auto 单图：表图与暗化里图同尺寸，直接合成
      result = await processImageData(s, h);
    } else {
      const bitmapA = surfaceBitmap.value;
      const bitmapB = hiddenBitmap.value;
      if (!bitmapA || !bitmapB) throw new Error('请上传表图与里图');
      const targetW = Math.min(bitmapA.width, bitmapB.width);
      const targetH = Math.min(bitmapA.height, bitmapB.height);
      const limit = checkCanvasLimits(targetW, targetH);
      if (!limit.ok) throw new Error(limit.error!);
      const dataA = cropCenterToImageData(bitmapA, targetW, targetH);
      const dataB = cropCenterToImageData(bitmapB, targetW, targetH);
      result = await processImageData(dataA, dataB);
    }

    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.putImageData(result, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG 编码失败');

    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
    resultUrl.value = URL.createObjectURL(blob);
    resultSize.value = blob.size;
    dimensions.value = { width: result.width, height: result.height };
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '幻影坦克合成失败';
  } finally {
    isProcessing.value = false;
  }
}
```

- [ ] **Step 7: 修改 `handleSurfaceClear` / `handleHiddenClear`（重置新状态）**

将 `handleSurfaceClear` 替换为：

```ts
function handleSurfaceClear(): void {
  if (surfaceBitmap.value) surfaceBitmap.value.close?.();
  surfaceBitmap.value = null;
  if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
  surfacePreviewUrl.value = '';
  surfaceFile.value = null;
  surfaceSource.value = null;
  autoSurface.value = null;
  autoHidden.value = null;
  clearResult();
}
```

将 `handleHiddenClear` 替换为：

```ts
function handleHiddenClear(): void {
  if (hiddenBitmap.value) hiddenBitmap.value.close?.();
  hiddenBitmap.value = null;
  if (hiddenPreviewUrl.value) URL.revokeObjectURL(hiddenPreviewUrl.value);
  hiddenPreviewUrl.value = '';
  hiddenFile.value = null;
  hiddenImageData.value = null;
  autoSurface.value = null;
  autoHidden.value = null;
  // 里图没了，auto 表图失效，一并清掉
  if (surfaceSource.value === 'auto') {
    if (surfacePreviewUrl.value) URL.revokeObjectURL(surfacePreviewUrl.value);
    surfacePreviewUrl.value = '';
    surfaceFile.value = null;
    surfaceSource.value = null;
  }
  clearResult();
}
```

- [ ] **Step 8: 类型检查 + 单测不回归**

Run: `pnpm exec astro check && pnpm test src/utils/media/__tests__/phantom-tank.test.ts`
Expected: astro check 无新增错误；单测全过。

- [ ] **Step 9: 浏览器手验**

Run: `pnpm dev`，打开 `/media/phantom-tank`：
1. 上传一张里图（建议暗调图，如黑底照片）→ 表图区**自动出现反相预览**（无需手动上传表图）。
2. 点「生成」→ 结果区出现合成透明 PNG。
3. 切换「白底/黑底」→ 白底看反相表图、黑底看里图，双重显示生效。
4. 清空 → 所有状态复位。

- [ ] **Step 10: Commit**

```bash
git add src/tools/media/PhantomTank.vue
git commit -m "feat(phantom-tank): auto-generate surface on hidden upload + route by source"
```

---

### Task 3: 暗化滑块 + 「从里图自动生成」按钮 UI

加上滑块（联动重算）、切回 auto 的按钮、手动上传时滑块禁用。

**Files:**
- Modify: `src/tools/media/PhantomTank.vue`

**Interfaces:**
- Consumes: Task 2 的 `generateAutoSurface`、`surfaceSource`、`darken`、`darkenFactor`
- Produces: 完整可用的自动表图控件组。

- [ ] **Step 1: import 加 `watch`**

第 14 行改为：

```ts
import { ref, computed, watch, onUnmounted } from 'vue';
```

- [ ] **Step 2: 新增滑块防抖句柄 + 联动 watch + 禁用计算属性**

在 Task 2 新增的 `autoHidden` ref 之后插入：

```ts
/** 滑块防抖句柄，避免拖动时高频重算 */
let darkenTimer: ReturnType<typeof setTimeout> | null = null;
/** 滑块仅在表图为 auto 来源时启用 */
const sliderDisabled = computed(() => surfaceSource.value !== 'auto');

/**
 * 暗化滑块联动：auto 来源下防抖重算表图；manual 时滑块已禁用，不触发。
 */
watch(darken, () => {
  if (surfaceSource.value !== 'auto') return;
  if (darkenTimer) clearTimeout(darkenTimer);
  darkenTimer = setTimeout(() => {
    darkenTimer = null;
    void generateAutoSurface();
  }, 150);
});
```

- [ ] **Step 3: `handleClear` 重置 darken 与防抖句柄**

将现有 `handleClear` 替换为：

```ts
function handleClear(): void {
  handleSurfaceClear();
  handleHiddenClear();
  errorMsg.value = '';
  bgMode.value = 'checker';
  darken.value = 30;
  if (darkenTimer) {
    clearTimeout(darkenTimer);
    darkenTimer = null;
  }
}
```

- [ ] **Step 4: 模板新增「自动表图控件组」**

在模板中「双图上传区」`</div>`（grid 容器结束）之后、「操作按钮」`<div class="mt-4 flex flex-wrap items-center gap-3">` 之前，插入：

```html
    <!-- 自动表图控件组：从里图生成 + 暗化滑块 -->
    <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-sm border border-border bg-card p-3">
      <button
        type="button"
        :disabled="!hiddenBitmap"
        class="px-3 py-1.5 rounded-sm bg-card border border-border text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        aria-label="从里图自动生成表图"
        title="用里图的反相自动生成表图"
        @click="generateAutoSurface"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
        从里图自动生成
      </button>
      <div class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted">里图暗化</span>
        <input
          v-model.number="darken"
          type="range"
          min="0"
          max="80"
          step="1"
          :disabled="sliderDisabled"
          class="w-40 accent-accent cursor-pointer disabled:cursor-not-allowed"
          aria-label="里图暗化强度"
        />
        <span class="text-xs text-muted font-mono w-10">{{ darken }}%</span>
      </div>
      <span v-if="sliderDisabled && surfaceSource === 'manual'" class="text-xs text-muted">
        手动表图模式下不可调，点左侧按钮切回自动
      </span>
    </div>
```

- [ ] **Step 5: 类型检查**

Run: `pnpm exec astro check`
Expected: 无新增错误。

- [ ] **Step 6: 浏览器手验**

Run: `pnpm dev`，打开 `/media/phantom-tank`：
1. 上传里图 → 表图自动生成；拖动「里图暗化」滑块 → 表图预览防抖刷新（值越大里图越暗、黑底主体越清晰）。
2. 手动拖入一张表图 → 滑块禁用、出现提示文案、表图变为手动上传的。
3. 点「从里图自动生成」→ 切回 auto、滑块恢复启用、表图回到反相预览。
4. 滑块拉到 80% → 里图明显压暗，黑底对比增强。
5. 清空 → darken 回到 30%。

- [ ] **Step 7: Commit**

```bash
git add src/tools/media/PhantomTank.vue
git commit -m "feat(phantom-tank): add darken slider and auto-generate button UI"
```

---

### Task 4: FAQ + SEO 文案

**Files:**
- Modify: `src/data/tool-faqs.ts`（`phantom-tank` 数组）
- Modify: `src/data/tools.ts`（`phantom-tank` 条目）

**Interfaces:** 无（纯文案）。

- [ ] **Step 1: 补 2 条 FAQ**

在 `src/data/tool-faqs.ts` 的 `'phantom-tank'` 数组中，最后一条「两张图尺寸不一样可以用吗？」对象之后、`]` 之前，追加：

```ts
    {
      question: '只有一张图能用吗？',
      answer: '可以。上传里图后，工具会<strong>自动用里图的反相生成一张表图</strong>（也可点「从里图自动生成」重新生成），无需手动准备第二张图，直接点「生成」即可合成。',
    },
    {
      question: '里图暗化滑块调多少合适？为什么白底是灰度负片？',
      answer: '里图越亮，黑底越看不清，需要把<strong>「里图暗化」调大</strong>（亮调图建议 70%–80%）压暗里图，黑底主体才会清晰；暗调图保持较小值即可。白底只能显示灰度反相、无法是彩色负片，这是幻影坦克<strong>逐像素亮度算法的固有限制</strong>，非工具缺陷。',
    },
```

- [ ] **Step 2: 微调 SEO 字段**

在 `src/data/tools.ts` 的 `phantom-tank` 条目中：

将 `description` 改为：

```ts
    description: '将两张图合成为透明PNG：白底显示表图、黑底显示里图；也支持只上传里图、自动生成反相表图',
```

将 `seoDescription` 改为：

```ts
    seoDescription: '免费在线幻影坦克生成器，把两张图片合成一张带透明通道的PNG，纯白背景下呈现表图、纯黑背景下呈现里图；也可只上传里图，自动生成反相表图并通过暗化滑块调节黑底清晰度，逐像素计算透明度实现双重显示效果，纯浏览器端本地处理图片绝不上传，社交头像封面趣味图片制作必备。',
```

将 `keywords` 改为：

```ts
    keywords: ['幻影坦克', 'phantom tank', 'mirage tank', '双重图片', '透明背景图片', '白底黑底图片', '图片合成', '隐藏图片', '一图双义', '自动生成表图', '单图幻影坦克'],
```

`id`、`name`、`category`、`icon`、`path`、`relatedToolIds` 保持不变。

- [ ] **Step 3: 类型检查**

Run: `pnpm exec astro check`
Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add src/data/tool-faqs.ts src/data/tools.ts
git commit -m "docs(phantom-tank): add auto-surface FAQ and refresh SEO copy"
```

---

## Self-Review 记录

- **Spec 覆盖**：§2 算法 → Task 1；§3 UI/§4 数据流 → Task 2/3；§5 错误处理 → Task 2/3 沿用现有机制（checkCanvasLimits、errorMsg、按钮 disabled）；§6 测试 → Task 1；§7 固有限制 → Task 4 FAQ；§8 FAQ/SEO → Task 4；§9 排除项均未实现；§10 文件全覆盖。
- **占位符扫描**：无 TBD/TODO，每个代码步骤含完整代码。
- **类型一致性**：`generateSurfaceFromHidden` 签名 Task 1 定义、Task 2 消费一致；`surfaceSource`/`darken`/`autoSurface`/`autoHidden`/`hiddenImageData` 在 Task 2 定义、Task 3 消费一致；`generateAutoSurface`/`sliderDisabled` 命名前后一致。
