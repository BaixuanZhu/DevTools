# 图片转换压缩工具 · 格式扩展 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在图片转换压缩工具新增 AVIF / TIFF / ICO 三种输出格式，并扩展输入解码支持 AVIF / GIF(首帧) / BMP / ICO / TIFF。

**Architecture:** 解码端以浏览器原生 `createImageBitmap` 为主、TIFF 用 `utif2` 分流，统一产出 `ImageBitmap`；编码端把 `convertImage` 重构为分派器——PNG/JPEG/WebP 维持 `canvas.toBlob`，AVIF/TIFF/ICO 分别懒加载 `@jsquash/avif` / `utif2` / `to-ico` 编码。所有新依赖动态 import，首屏零增长。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、TypeScript strict、vitest（node 环境，仅测纯函数）、`@jsquash/avif`（WASM，需 `optimizeDeps.exclude`）、`utif2`；ICO 纯手写编码（无第三方库）。

**Spec:** `docs/superpowers/specs/2026-06-21-image-format-expansion-design.md`

## Global Constraints

- **浏览器原生优先**：能用 `createImageBitmap` / `canvas.toBlob` 的不引库；新编码器一律 `await import()` 懒加载。
- **无路径别名**：所有 import 用相对路径（如 `./encoders/avif`、`../../utils/media/image-convert`）。
- **注释规则**：新增/修改的公共函数、类型、常量必须写 JSDoc/TSDoc，说明职责，与现有 `image-convert.ts` 风格一致。
- **安全**：禁止 `eval` / `Function` / 字符串 `setTimeout`；正则用 `new RegExp` 包 try-catch（本计划不涉及）。
- **测试边界**：纯函数走 TDD（vitest，node 环境）；依赖浏览器 API 的函数（`createImageBitmap` / `canvas` / WASM 编解码）**不做单测**，用 `pnpm dev` + 浏览器手动验证（沿用 `image-convert.ts` 既有「浏览器 API（组件层验证，不做单测）」约定）。
- **GIF / BMP 仅作输入**，不进 `OutputFormat`；ICO 输出固定 16/32/48 三尺寸，忽略 scale。
- **AVIF WASM 配置（spike 已验证）**：`@jsquash/avif` 必须在 `astro.config.mjs` 的 `vite.optimizeDeps.exclude` 中排除；否则 Vite 预打包破坏 emscripten 的 wasm 相对路径，运行时报 `both async and sync fetching of the wasm failed`。
- **依赖规则**：`@jsquash/avif`、`utif2` 均为成熟库且**自带 TypeScript 类型**（无需 shim）；ICO **不引库**——`to-ico` 依赖 `image-size` 用动态 `require('./types/bmp')`，Vite 下彻底不可用（spike 已确认），改纯手写 ICO 编码（PNG-based，约 30 行）。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `src/utils/media/image-convert.ts` | 类型定义、纯函数映射、`loadImage` 解码分流、`convertImage` 编码分派 |
| `src/utils/media/decoders/tiff.ts` | **新增** — `utif2` 解码 TIFF → `LoadedImage` |
| `src/utils/media/encoders/avif.ts` | **新增** — `qualityToCqLevel` 纯函数 + `@jsquash/avif` 懒加载编码 |
| `src/utils/media/encoders/tiff.ts` | **新增** — `utif2` 懒加载编码 |
| `src/utils/media/encoders/ico.ts` | **新增** — 纯手写 ICO 编码（PNG 多尺寸打包，无第三方库） |
| `src/utils/media/__tests__/image-convert.test.ts` | 纯函数测试扩展 |
| `src/utils/media/encoders/__tests__/avif.test.ts` | **新增** — `qualityToCqLevel` 纯函数测试 |
| `astro.config.mjs` | 修改：`vite.optimizeDeps.exclude` 加入 `@jsquash/avif`（spike 已完成） |
| `src/tools/media/ImageConverter.vue` | UI：双格式组、质量/填白/ICO 提示、ICO 禁用 scale、下载扩展名、文案 |
| `src/data/tools.ts` | image-converter 条目 SEO 字段更新 |
| `src/data/tool-faqs.ts` | image-converter FAQ 追加 |

---

## Task 1: 安装依赖 + @jsquash/avif WASM spike（✅ 已完成）

> **本任务已由主会话于 2026-06-21 完成，并通过真实浏览器验证（dev server）。执行者跳过本任务，仅阅读结论。** 实际产出：
> - 依赖已安装：`@jsquash/avif 2.1.1`、`utif2 4.1.0`（`to-ico` 经验证不可用，已卸载）。
> - `astro.config.mjs` 已加 `vite.optimizeDeps.exclude: ['@jsquash/avif']`。
> - 无需类型 shim：`@jsquash/avif` 与 `utif2` 均自带 `.d.ts`。

**spike 结论：**

| 库 | 结论 |
|----|------|
| `@jsquash/avif` | `import { encode } from '@jsquash/avif'` 命名导出；`encode(imageData, { cqLevel })` 返回 `ArrayBuffer`。**必须** `optimizeDeps.exclude`，否则运行时报 `both async and sync fetching of the wasm failed`。 |
| `utif2` | `const UTIF = await import('utif2')` 为**命名空间**（非 default），含 `decode/decodeImage/toRGBA8/encodeImage`；`encodeImage` 返回 `ArrayBuffer`，编解码往返通过。 |
| `to-ico` | ❌ 不可用（依赖 `image-size` 动态 `require`，Vite bundle 失败）。ICO 改纯手写编码（见 Task 6，spike 已验证产物可被浏览器读回 48×48）。 |

- [ ] **Step 1: 安装依赖**

```bash
pnpm add @jsquash/avif utif2 to-ico
```

- [ ] **Step 2: 检查类型缺失情况**

```bash
pnpm exec tsc --noEmit
```

预期：可能报 `无法找到模块「utif2」/「to-ico」的声明`（`@jsquash/avif` 自带类型，通常不报）。记下哪些库报错，Step 4 为其补声明。

- [ ] **Step 3: spike 验证 @jsquash/avif 的 WASM 加载（浏览器控制台）**

启动 dev server：

```bash
pnpm dev
```

打开浏览器访问任意已水合页面（如 `/media/image-converter`），在 DevTools Console 执行：

```js
const { encode } = await import('@jsquash/avif');
const c = document.createElement('canvas'); c.width = 8; c.height = 8;
const ctx = c.getContext('2d'); ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, 8, 8);
const buf = await encode(ctx.getImageData(0, 0, 8, 8), { cqLevel: 30 });
console.log('AVIF bytes:', buf.byteLength);
```

预期：打印 `AVIF bytes: <正数>`，无 wasm 加载/CORS/404 错误。

- 若 **报错涉及 wasm 加载**（如 `Failed to fetch dynamically imported module`、wasm MIME、404）：记录错误信息，按 @jsquash 官方 Vite 集成说明排查（常见解法：确认未把 `@jsquash/avif` 的 wasm 当作静态资源缺失处理；必要时在 `astro.config.mjs` 的 `vite.optimizeDeps` 排除该包）。**必须在此步解决到能编码出 AVIF 为止**，否则后续 AVIF 任务无法进行。
- 若 **正常**：记下确认的导出形态（`import { encode } from '@jsquash/avif'`），AVIF 编码任务据此实现。

- [ ] **Step 4: spike 验证 utif2 / to-ico API（浏览器控制台）**

在同一 Console 继续：

```js
// utif2：确认 decode / toRGBA8 / encodeImage 存在
const UTIF = (await import('utif2')).default;
console.log('UTIF keys:', Object.keys(UTIF));
// to-ico：确认 default 导出
const toIco = (await import('to-ico')).default;
console.log('to-co type:', typeof toIco);
```

记下 `Object.keys(UTIF)` 是否含 `decode` / `decodeImage` / `toRGBA8` / `encodeImage`；记下 `to-ico` 返回值类型（`Promise<Buffer | Uint8Array | ArrayBuffer>`）。后续 TIFF/ICO 任务以此为准。

- [ ] **Step 5: 创建类型声明文件（针对 Step 2 报错的库）**

创建 `src/types/external-modules.d.ts`。**仅保留 Step 2 实际报错的库的声明**（自带类型的库不要重复声明，否则冲突）。下列为完整模板，按需裁剪：

```ts
/**
 * 第三方无类型声明库的模块声明（仅当库本身未携带 .d.ts 时使用）。
 */

declare module 'utif2' {
  /** TIFF 图像目录（解码后的单帧元数据与像素）。 */
  export interface IFD {
    width: number;
    height: number;
    data?: Uint8Array;
    [key: string]: unknown;
  }

  const UTIF: {
    /** 解析 TIFF 字节流为 IFD 列表（不填充像素）。 */
    decode(buffer: ArrayBuffer | Uint8Array): IFD[];
    /** 解码指定 IFD 的像素数据填充到 ifd.data。 */
    decodeImage(buffer: ArrayBuffer | Uint8Array, ifd: IFD): void;
    /** 将 IFD 像素转为 RGBA Uint8Array。 */
    toRGBA8(ifd: IFD): Uint8Array;
    /** 将 RGBA 像素编码为 TIFF 字节流。 */
    encodeImage(
      rgba: Uint8Array | ArrayBuffer,
      width: number,
      height: number,
      metadata?: unknown,
    ): ArrayBuffer;
  };

  export default UTIF;
}

declare module 'to-ico' {
  /** to-ico 选项。 */
  export interface ToIcoOptions {
    /** 输出尺寸列表（favicon 常用 16/32/48）。 */
    sizes?: number[];
    resizeOptions?: unknown;
  }

  /** 将 PNG 字节序列打包为 ICO 字节流。 */
  const toIco: (
    input: Uint8Array[] | ArrayBuffer[],
    options?: ToIcoOptions,
  ) => Promise<Uint8Array>;

  export default toIco;
}
```

- [ ] **Step 6: 验证类型通过**

```bash
pnpm exec tsc --noEmit
```

预期：无模块声明错误。

- [ ] **Step 7: 提交依赖与类型声明**

```bash
git add package.json pnpm-lock.yaml src/types/external-modules.d.ts
git commit -m "chore: add @jsquash/avif, utif2, to-ico deps + type shims for image format expansion"
```

---

## Task 2: 扩展类型与纯函数映射（TDD）

**Files:**
- Modify: `src/utils/media/image-convert.ts`
- Test: `src/utils/media/__tests__/image-convert.test.ts`

**Interfaces:**
- Produces: `OutputFormat` 增加 `'avif' | 'tiff' | 'ico'`；`OUTPUT_FORMATS` 增加 `group` 字段；新增 `EncoderKind` 类型与 `pickEncoderKind(format)` 纯函数；`getOutputMime` / `getOutputExtension` / `isLossless` / `needsFillBackground` / `defaultFormatForInput` 覆盖新格式。

- [ ] **Step 1: 先写失败测试 — 在 `image-convert.test.ts` 末尾追加新 describe 并扩展旧断言**

在 `image-convert.test.ts` 顶部 import 中追加 `pickEncoderKind`：

```ts
import {
  formatBytes,
  computeScaledSize,
  getOutputMime,
  getOutputExtension,
  isLossless,
  needsFillBackground,
  defaultFormatForInput,
  checkCanvasLimits,
  pickEncoderKind,
} from '../image-convert';
```

替换 `getOutputMime` / `getOutputExtension` / `isLossless` / `needsFillBackground` / `defaultFormatForInput` 五个 describe 块为以下内容（扩展新格式断言）：

```ts
describe('getOutputMime', () => {
  it('格式映射到 MIME', () => {
    expect(getOutputMime('png')).toBe('image/png');
    expect(getOutputMime('jpeg')).toBe('image/jpeg');
    expect(getOutputMime('webp')).toBe('image/webp');
    expect(getOutputMime('avif')).toBe('image/avif');
    expect(getOutputMime('tiff')).toBe('image/tiff');
    expect(getOutputMime('ico')).toBe('image/x-icon');
  });
});

describe('getOutputExtension', () => {
  it('jpeg 扩展名用 .jpg，其余按格式名', () => {
    expect(getOutputExtension('png')).toBe('.png');
    expect(getOutputExtension('jpeg')).toBe('.jpg');
    expect(getOutputExtension('webp')).toBe('.webp');
    expect(getOutputExtension('avif')).toBe('.avif');
    expect(getOutputExtension('tiff')).toBe('.tiff');
    expect(getOutputExtension('ico')).toBe('.ico');
  });
});

describe('isLossless', () => {
  it('png / tiff / ico 为无损，jpeg / webp / avif 为有损', () => {
    expect(isLossless('png')).toBe(true);
    expect(isLossless('tiff')).toBe(true);
    expect(isLossless('ico')).toBe(true);
    expect(isLossless('jpeg')).toBe(false);
    expect(isLossless('webp')).toBe(false);
    expect(isLossless('avif')).toBe(false);
  });
});

describe('needsFillBackground', () => {
  it('仅 jpeg 需要填白底', () => {
    expect(needsFillBackground('jpeg')).toBe(true);
    expect(needsFillBackground('png')).toBe(false);
    expect(needsFillBackground('webp')).toBe(false);
    expect(needsFillBackground('avif')).toBe(false);
    expect(needsFillBackground('tiff')).toBe(false);
    expect(needsFillBackground('ico')).toBe(false);
  });
});

describe('defaultFormatForInput', () => {
  it('原生输出格式保持原格式', () => {
    expect(defaultFormatForInput('image/png')).toBe('png');
    expect(defaultFormatForInput('image/jpeg')).toBe('jpeg');
    expect(defaultFormatForInput('image/webp')).toBe('webp');
  });

  it('AVIF / TIFF 输入映射到对应输出', () => {
    expect(defaultFormatForInput('image/avif')).toBe('avif');
    expect(defaultFormatForInput('image/tiff')).toBe('tiff');
  });

  it('GIF 输入默认 WebP（首帧）', () => {
    expect(defaultFormatForInput('image/gif')).toBe('webp');
  });

  it('BMP / ICO 输入默认 PNG（保留无损）', () => {
    expect(defaultFormatForInput('image/bmp')).toBe('png');
    expect(defaultFormatForInput('image/x-icon')).toBe('png');
    expect(defaultFormatForInput('image/vnd.microsoft.icon')).toBe('png');
  });

  it('未知/空 MIME 默认 WebP', () => {
    expect(defaultFormatForInput('')).toBe('webp');
    expect(defaultFormatForInput('image/unknown')).toBe('webp');
  });
});
```

在文件末尾追加 `pickEncoderKind` 测试：

```ts
describe('pickEncoderKind', () => {
  it('png / jpeg / webp 走 canvas 原生编码', () => {
    expect(pickEncoderKind('png')).toBe('canvas');
    expect(pickEncoderKind('jpeg')).toBe('canvas');
    expect(pickEncoderKind('webp')).toBe('canvas');
  });

  it('avif / tiff / ico 走各自编码器', () => {
    expect(pickEncoderKind('avif')).toBe('avif');
    expect(pickEncoderKind('tiff')).toBe('tiff');
    expect(pickEncoderKind('ico')).toBe('ico');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pnpm test src/utils/media/__tests__/image-convert.test.ts
```

预期：FAIL（`avif` / `tiff` / `ico` 不在 `OutputFormat`、`pickEncoderKind` 未导出）。

- [ ] **Step 3: 修改 `image-convert.ts` — 扩展类型与常量**

把 `OutputFormat` 类型（原第 11 行）改为：

```ts
/** 支持的输出格式（GIF / BMP 仅作输入，不在此列） */
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff' | 'ico';
```

把 `LOSSLESS_FORMATS`（原第 57 行）改为：

```ts
/** 无损格式（不支持质量调节） */
export const LOSSLESS_FORMATS: OutputFormat[] = ['png', 'tiff', 'ico'];
```

把 `OUTPUT_FORMATS`（原第 59-64 行）改为（新增 `group` 字段，供 UI 分组）：

```ts
/** 格式所属分组（有损可调质量 / 无损） */
export type FormatGroup = 'lossy' | 'lossless';

/** 输出格式选项（供 OptionRadioGroup 使用，按有损/无损分组） */
export const OUTPUT_FORMATS: { value: OutputFormat; label: string; group: FormatGroup }[] = [
  { value: 'jpeg', label: 'JPEG', group: 'lossy' },
  { value: 'webp', label: 'WebP', group: 'lossy' },
  { value: 'avif', label: 'AVIF', group: 'lossy' },
  { value: 'png', label: 'PNG', group: 'lossless' },
  { value: 'tiff', label: 'TIFF', group: 'lossless' },
  { value: 'ico', label: 'ICO', group: 'lossless' },
];
```

- [ ] **Step 4: 修改 `image-convert.ts` — 重写格式映射函数**

把 `getOutputMime`（原第 104-108 行）改为 switch 全覆盖：

```ts
/**
 * 输出格式映射到 MIME 类型。
 * @param format 输出格式
 */
export function getOutputMime(format: OutputFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'tiff':
      return 'image/tiff';
    case 'ico':
      return 'image/x-icon';
  }
}
```

把 `getOutputExtension`（原第 114-118 行）改为：

```ts
/**
 * 输出格式映射到文件扩展名（jpeg 用 .jpg）。
 * @param format 输出格式
 */
export function getOutputExtension(format: OutputFormat): string {
  switch (format) {
    case 'png':
      return '.png';
    case 'jpeg':
      return '.jpg';
    case 'webp':
      return '.webp';
    case 'avif':
      return '.avif';
    case 'tiff':
      return '.tiff';
    case 'ico':
      return '.ico';
  }
}
```

`isLossless`（原第 124-126 行）不变（仍 `LOSSLESS_FORMATS.includes(format)`，常量已扩展）。

`needsFillBackground`（原第 132-134 行）不变（仍仅 `format === 'jpeg'`）。

把 `defaultFormatForInput`（原第 142-147 行）改为 switch 全覆盖：

```ts
/**
 * 根据输入图片的 MIME 推荐默认输出格式。
 *
 * - PNG/JPEG/WebP/AVIF/TIFF 保持原格式；
 * - BMP / ICO 输入默认 PNG（保留无损）；
 * - GIF / 未知格式默认 WebP（GIF 仅取首帧）。
 * @param mime 输入图片 MIME 类型
 */
export function defaultFormatForInput(mime: string): OutputFormat {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/tiff':
      return 'tiff';
    case 'image/bmp':
      return 'png';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'png';
    default:
      return 'webp';
  }
}
```

- [ ] **Step 5: 修改 `image-convert.ts` — 新增 `pickEncoderKind` 纯函数**

在「格式映射」区块末尾（`defaultFormatForInput` 之后、`// ====...尺寸校验` 注释之前）插入：

```ts
/** 编码路径种类：canvas 原生 / 各懒加载编码器 */
export type EncoderKind = 'canvas' | 'avif' | 'tiff' | 'ico';

/**
 * 根据输出格式选择编码路径（纯函数，供 convertImage 分派与单测使用）。
 * @param format 输出格式
 */
export function pickEncoderKind(format: OutputFormat): EncoderKind {
  switch (format) {
    case 'png':
    case 'jpeg':
    case 'webp':
      return 'canvas';
    case 'avif':
      return 'avif';
    case 'tiff':
      return 'tiff';
    case 'ico':
      return 'ico';
  }
}
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
pnpm test src/utils/media/__tests__/image-convert.test.ts
```

预期：PASS（全绿）。

- [ ] **Step 7: 提交**

```bash
git add src/utils/media/image-convert.ts src/utils/media/__tests__/image-convert.test.ts
git commit -m "feat(image-convert): extend OutputFormat with avif/tiff/ico + encoder dispatch helper"
```

---

## Task 3: TIFF 解码封装 `decoders/tiff.ts`

**Files:**
- Create: `src/utils/media/decoders/tiff.ts`

**Interfaces:**
- Consumes: `LoadedImage`（来自 `../image-convert`）、`utif2`（Task 1 装好 + 类型声明）
- Produces: `decodeTiff(file: File): Promise<LoadedImage>`，供 Task 7 的 `loadImage` 调用

> 浏览器 API 任务，不做单测，靠 `pnpm dev` 手验（Task 7 合并验证）。

- [ ] **Step 1: 创建 `src/utils/media/decoders/tiff.ts`**

```ts
import type { LoadedImage } from '../image-convert';

/**
 * 解码 TIFF 文件为 LoadedImage。
 *
 * 浏览器原生 createImageBitmap 不支持 TIFF，故用 utif2 解码为 RGBA，
 * 再经 createImageBitmap(imageData) 统一回 ImageBitmap 接口，
 * 使下游 convertImage 无需感知格式差异。
 *
 * @param file TIFF 图片文件
 * @returns 加载后的位图与原始尺寸
 * @throws 文件损坏或为不支持的 TIFF 子格式时抛出
 */
export async function decodeTiff(file: File): Promise<LoadedImage> {
  const UTIF = await import('utif2');
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (ifds.length === 0) {
    throw new Error('TIFF 文件解析失败：未找到图像数据');
  }
  const first = ifds[0];
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);
  const { width, height } = first;
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  const bitmap = await createImageBitmap(imageData);
  return { bitmap, width, height };
}
```

> 注：`UTIF.decode` / `decodeImage` / `toRGBA8` 的确切签名以 Task 1 spike Step 4 确认的 `Object.keys(UTIF)` 为准；若 utif2 的方法名不同，据此调整。

- [ ] **Step 2: 类型检查**

```bash
pnpm exec tsc --noEmit
```

预期：无错误。

- [ ] **Step 3: 提交**

```bash
git add src/utils/media/decoders/tiff.ts
git commit -m "feat(image-convert): add utif2-based TIFF decoder"
```

---

## Task 4: AVIF 编码封装 `encoders/avif.ts`（✅ 已完成，实现已修正）

> **修订（2026-06-21，spike 后核实）：** @jsquash/avif 用 `quality`（0-100，越大越好，default 50）**而非** `cqLevel`（证据：`meta.js` defaultOptions、`avif_enc.d.ts` EncodeOptions、`encode.js`）。因此**删除 `qualityToCqLevel` 与其测试**，`encodeAvif` 直接 `encode(imageData, { quality })` 透传，无 `as never` 类型断言。下方原始步骤（cqLevel 方案）已过时，以本修订为准。commit cd1a673..ccd16cc。

**Files:**
- Create: `src/utils/media/encoders/avif.ts`
- Test: `src/utils/media/encoders/__tests__/avif.test.ts`

**Interfaces:**
- Consumes: `@jsquash/avif`（Task 1 装好）
- Produces: `qualityToCqLevel(quality: number): number`（纯函数，可单测）；`encodeAvif(imageData: ImageData, quality: number): Promise<Blob>`（供 Task 7 调用）

- [ ] **Step 1: 先写失败测试 — 创建 `src/utils/media/encoders/__tests__/avif.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { qualityToCqLevel } from '../avif';

describe('qualityToCqLevel', () => {
  it('quality 100 映射到 cqLevel 0（接近无损）', () => {
    expect(qualityToCqLevel(100)).toBe(0);
  });

  it('quality 越低 cqLevel 越高（质量越差）', () => {
    expect(qualityToCqLevel(50)).toBeGreaterThan(qualityToCqLevel(80));
  });

  it('quality 0 映射到 cqLevel 63（最大压缩）', () => {
    expect(qualityToCqLevel(0)).toBe(63);
  });

  it('超出范围被钳制', () => {
    expect(qualityToCqLevel(150)).toBe(0);
    expect(qualityToCqLevel(-10)).toBe(63);
  });

  it('结果在 0-63 区间内', () => {
    for (const q of [10, 25, 40, 55, 70, 85, 100]) {
      const cq = qualityToCqLevel(q);
      expect(cq).toBeGreaterThanOrEqual(0);
      expect(cq).toBeLessThanOrEqual(63);
    }
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pnpm test src/utils/media/encoders/__tests__/avif.test.ts
```

预期：FAIL（`../avif` 不存在）。

- [ ] **Step 3: 创建 `src/utils/media/encoders/avif.ts`**

```ts
/**
 * AVIF 编码封装。
 *
 * 浏览器 Canvas 不支持输出 AVIF，故用 @jsquash/avif（Squoosh 的 WASM 编码器）。
 * 该库的 options 不接受 1-100 的 quality，而用 cqLevel（0-63，越小质量越高），
 * 故先经 qualityToCqLevel 纯函数映射。
 */

/**
 * 将 UI 质量值（10-100）映射为 @jsquash/avif 的 cqLevel（0-63）。
 *
 * quality 100 → cqLevel 0（最佳质量），quality 0 → cqLevel 63（最大压缩）。
 * 输入钳制到 0-100 后线性反比映射。
 * @param quality 质量 0-100
 * @returns cqLevel 0-63
 */
export function qualityToCqLevel(quality: number): number {
  const clamped = Math.min(100, Math.max(0, quality));
  return Math.round((1 - clamped / 100) * 63);
}

/**
 * 将 ImageData 编码为 AVIF Blob（懒加载 @jsquash/avif WASM 编码器）。
 *
 * 首次调用时加载 WASM，后续调用复用。大图编码较慢，调用方需展示 loading。
 * @param imageData RGBA 像素数据
 * @param quality 质量 10-100
 * @returns AVIF Blob
 * @throws WASM 加载或编码失败时抛出
 */
export async function encodeAvif(imageData: ImageData, quality: number): Promise<Blob> {
  const { encode } = await import('@jsquash/avif');
  const cqLevel = qualityToCqLevel(quality);
  const buffer = await encode(imageData, { cqLevel });
  return new Blob([buffer], { type: 'image/avif' });
}
```

> 注：`import { encode } from '@jsquash/avif'` 的导出形态以 Task 1 spike Step 3 确认为准；若 spike 发现是 default 导出，改为 `const { default: encode } = await import('@jsquash/avif')`。

- [ ] **Step 4: 运行测试，确认通过**

```bash
pnpm test src/utils/media/encoders/__tests__/avif.test.ts
```

预期：PASS。

- [ ] **Step 5: 提交**

```bash
git add src/utils/media/encoders/avif.ts src/utils/media/encoders/__tests__/avif.test.ts
git commit -m "feat(image-convert): add @jsquash/avif encoder with quality->cqLevel mapping"
```

---

## Task 5: TIFF 编码封装 `encoders/tiff.ts`

**Files:**
- Create: `src/utils/media/encoders/tiff.ts`

**Interfaces:**
- Consumes: `utif2`
- Produces: `encodeTiff(imageData: ImageData): Promise<Blob>`，供 Task 7 调用

> 浏览器 API 任务，不做单测。

- [ ] **Step 1: 创建 `src/utils/media/encoders/tiff.ts`**

```ts
/**
 * 将 ImageData 编码为 TIFF Blob（懒加载 utif2）。
 *
 * @param imageData RGBA 像素数据
 * @returns TIFF Blob
 * @throws 编码失败时抛出
 */
export async function encodeTiff(imageData: ImageData): Promise<Blob> {
  const UTIF = await import('utif2');
  const { width, height, data } = imageData;
  const buffer = UTIF.encodeImage(data, width, height);
  return new Blob([buffer], { type: 'image/tiff' });
}
```

> 注：`UTIF.encodeImage(rgba, w, h)` 的签名以 Task 1 spike Step 4 确认为准。

- [ ] **Step 2: 类型检查**

```bash
pnpm exec tsc --noEmit
```

预期：无错误。

- [ ] **Step 3: 提交**

```bash
git add src/utils/media/encoders/tiff.ts
git commit -m "feat(image-convert): add utif2-based TIFF encoder"
```

---

## Task 6: ICO 编码封装 `encoders/ico.ts`

**Files:**
- Create: `src/utils/media/encoders/ico.ts`

**Interfaces:**
- Consumes: `to-ico`、`ImageBitmap`
- Produces: `encodeIco(bitmap: ImageBitmap, fillBackground: boolean): Promise<{ blob: Blob; width: number; height: number; size: number }>`，供 Task 7 调用

> 浏览器 API 任务，不做单测。ICO 固定 16/32/48 三尺寸，忽略 scale。

- [ ] **Step 1: 创建 `src/utils/media/encoders/ico.ts`**

```ts
/** ICO 输出的 favicon 标准尺寸（favicon 常用三尺寸）。 */
const ICO_SIZES = [16, 32, 48] as const;

/**
 * 将位图缩放到指定尺寸并编码为 PNG 字节（用于 ICO 打包）。
 *
 * @param bitmap 源位图
 * @param size 目标宽高（正方形）
 * @param fillBackground 是否先填白底
 */
async function rasterizeToPng(
  bitmap: ImageBitmap,
  size: number,
  fillBackground: boolean,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ICO 编码失败：无法创建 Canvas 2D 上下文');
  if (fillBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(bitmap, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('ICO 编码失败：无法生成 PNG');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 将位图编码为多尺寸 ICO（PNG-based，favicon 标准 16/32/48）。
 *
 * 纯手写：ICONDIR(6B) + 每尺寸 ICONDIRENTRY(16B) + 各尺寸 PNG 数据拼接。
 * 不依赖第三方库（to-ico 因依赖 image-size 动态 require 在 Vite 下不可用，spike 已确认）。
 * ICO 忽略外部 scale 参数，固定输出 favicon 三尺寸。
 *
 * @param bitmap 源位图
 * @param fillBackground 是否填白底
 * @returns ICO 结果（含 Blob、最大尺寸 48、字节数）
 * @throws 编码失败时抛出
 */
export async function encodeIco(
  bitmap: ImageBitmap,
  fillBackground: boolean,
): Promise<{ blob: Blob; width: number; height: number; size: number }> {
  const pngs = await Promise.all(
    ICO_SIZES.map((size) => rasterizeToPng(bitmap, size, fillBackground)),
  );

  const count = pngs.length;
  const headerSize = 6 + 16 * count;
  const totalBytes = pngs.reduce((sum, p) => sum + p.byteLength, 0);
  const buffer = new Uint8Array(headerSize + totalBytes);
  const view = new DataView(buffer.buffer);

  // ICONDIR：reserved(2)=0, type(2)=1(ICO), count(2)
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);

  // ICONDIRENTRY(16B) × count，数据区紧跟其后
  let offset = headerSize;
  pngs.forEach((png, i) => {
    const base = 6 + 16 * i;
    view.setUint8(base, ICO_SIZES[i]); // width（≤255 直接写）
    view.setUint8(base + 1, ICO_SIZES[i]); // height
    view.setUint8(base + 2, 0); // colorCount（0=无调色板）
    view.setUint8(base + 3, 0); // reserved
    view.setUint16(base + 4, 1, true); // planes
    view.setUint16(base + 6, 32, true); // bitCount
    view.setUint32(base + 8, png.byteLength, true); // bytesInRes
    view.setUint32(base + 12, offset, true); // imageOffset
    offset += png.byteLength;
  });

  let pos = headerSize;
  for (const png of pngs) {
    buffer.set(png, pos);
    pos += png.byteLength;
  }

  const blob = new Blob([buffer], { type: 'image/x-icon' });
  return { blob, width: 48, height: 48, size: blob.size };
}
```

> ICO 为纯手写编码（spike 已验证产物可被浏览器读回 48×48），无第三方依赖；`ICO_SIZES` 均为 ≤255 的正方形，width/height 字段直接写数值即可。

- [ ] **Step 2: 类型检查**

```bash
pnpm exec tsc --noEmit
```

预期：无错误。

- [ ] **Step 3: 提交**

```bash
git add src/utils/media/encoders/ico.ts
git commit -m "feat(image-convert): add to-ico multi-size ICO encoder for favicon"
```

---

## Task 7: 重构 `convertImage` 分派 + `loadImage` TIFF 分流

**Files:**
- Modify: `src/utils/media/image-convert.ts`（`loadImage` 第 181-184 行、`convertImage` 第 196-226 行）

**Interfaces:**
- Consumes: Task 2 的 `pickEncoderKind` / `getOutputMime` / `isLossless`；Task 3-6 的 `decodeTiff` / `encodeAvif` / `encodeTiff` / `encodeIco`

> 浏览器 API 重构，不做单测，本任务 Step 4 在浏览器全格式回归。

- [ ] **Step 1: 改写 `loadImage`（原第 181-184 行）增加 TIFF 分流**

```ts
/**
 * 加载图片文件为位图，自动纠正手机拍照的 EXIF 方向。
 *
 * TIFF 走 utif2 解码（浏览器原生不支持），其余格式走 createImageBitmap。
 *
 * @param file 用户上传的图片文件
 * @throws 当浏览器无法解码该文件时抛出，由调用方捕获并提示
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  if (file.type === 'image/tiff') {
    const { decodeTiff } = await import('./decoders/tiff');
    return await decodeTiff(file);
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    throw new Error(
      '图片解码失败：可能文件损坏，或浏览器不支持该格式（如 AVIF 需 Chrome / 新版 Safari）',
    );
  }
}
```

- [ ] **Step 2: 改写 `convertImage`（原第 196-226 行）为分派器**

```ts
/**
 * 转换图片：按百分比缩放尺寸，再以指定格式/质量编码。
 *
 * - 无损格式（png/tiff/ico）忽略 quality；
 * - fillBackground 为 true 时先在 canvas 填充白底（jpeg 透明→白）；
 * - ICO 固定输出 16/32/48 三尺寸，忽略 scale；
 * - avif/tiff/ico 编码器懒加载。
 *
 * @param opts 转换选项
 * @returns 转换结果（含 object URL，调用方负责释放）
 * @throws 当无法创建 2D 上下文或编码失败时抛出
 */
export async function convertImage(opts: ConvertOptions): Promise<ConvertResult> {
  const { bitmap, format, quality, scale, fillBackground } = opts;

  // ICO：多尺寸封装，忽略 scale
  if (format === 'ico') {
    const { encodeIco } = await import('./encoders/ico');
    const r = await encodeIco(bitmap, fillBackground);
    return {
      blob: r.blob,
      url: URL.createObjectURL(r.blob),
      width: r.width,
      height: r.height,
      size: r.size,
    };
  }

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

  // 原生 canvas 编码（png/jpeg/webp）
  if (pickEncoderKind(format) === 'canvas') {
    const mime = getOutputMime(format);
    const qualityArg = isLossless(format) ? undefined : quality / 100;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, qualityArg),
    );
    if (!blob) throw new Error('图片编码失败，请尝试其他格式或尺寸');
    return { blob, url: URL.createObjectURL(blob), width, height, size: blob.size };
  }

  // 懒加载编码器（avif/tiff）
  const imageData = ctx.getImageData(0, 0, width, height);
  let blob: Blob;
  if (format === 'avif') {
    const { encodeAvif } = await import('./encoders/avif');
    blob = await encodeAvif(imageData, quality);
  } else {
    const { encodeTiff } = await import('./encoders/tiff');
    blob = await encodeTiff(imageData);
  }
  return { blob, url: URL.createObjectURL(blob), width, height, size: blob.size };
}
```

- [ ] **Step 3: 类型检查 + 全量单测**

```bash
pnpm exec tsc --noEmit
pnpm test
```

预期：类型无错误；单测全绿（纯函数未受影响）。

- [ ] **Step 4: 浏览器全格式回归（手验）**

```bash
pnpm dev
```

访问 `/media/image-converter`，逐一验证（每项：能上传 → 预览 → 调质量/尺寸 → 下载，下载后用系统查看器或 `<img>` 确认格式正确）：

- 输入 PNG，分别输出 JPEG / WebP / AVIF / TIFF / ICO（回归原有 + 新增）
- 输入 JPEG，输出 AVIF（确认有损质量生效）
- 输入 AVIF 文件 → 输出 WebP（验证 AVIF 解码 + 默认格式）
- 输入 TIFF 文件 → 输出 PNG（验证 utif2 解码）
- 输入 GIF → 取首帧输出 WebP
- 输入 BMP → 输出 PNG
- 输入 ICO → 输出 PNG
- 输出 ICO：确认尺寸滑块禁用、产物为含 16/32/48 的 .ico（可用浏览器或 favicon 引用确认）
- AVIF 编码大图：确认 loading 提示、不崩溃

- [ ] **Step 5: 提交**

```bash
git add src/utils/media/image-convert.ts
git commit -m "feat(image-convert): dispatch encoding by format + TIFF decode routing in loadImage"
```

---

## Task 8: `ImageConverter.vue` UI 更新

**Files:**
- Modify: `src/tools/media/ImageConverter.vue`

**Interfaces:**
- Consumes: Task 2 的 `OUTPUT_FORMATS`（含 group）、`getOutputExtension`、`isLossless`

> UI 任务，不做单测，浏览器手验。

- [ ] **Step 1: 更新 script — 扩展 import 与计算属性**

把第 7-21 行的 import 块内 `OUTPUT_FORMATS` 那行附近补充 `getOutputExtension`：

```ts
import {
  loadImage,
  convertImage,
  formatBytes,
  computeScaledSize,
  defaultFormatForInput,
  isLossless,
  needsFillBackground,
  getOutputExtension,
  checkCanvasLimits,
  OUTPUT_FORMATS,
  DEFAULT_QUALITY,
  type OutputFormat,
  type LoadedImage,
  type ConvertResult,
} from '../../utils/media/image-convert';
```

在 `qualityDisabled` 计算属性（第 56 行）之后追加三个计算属性：

```ts
/** 质量控件是否禁用（PNG/TIFF/ICO 无损） */
const qualityDisabled = computed(() => isLossless(format.value));

/** 有损格式选项（供 OptionRadioGroup） */
const lossyFormats = computed(() =>
  OUTPUT_FORMATS.filter((f) => f.group === 'lossy'),
);

/** 无损格式选项（供 OptionRadioGroup） */
const losslessFormats = computed(() =>
  OUTPUT_FORMATS.filter((f) => f.group === 'lossless'),
);

/** 当前是否 ICO 输出（固定多尺寸，禁用 scale） */
const isIco = computed(() => format.value === 'ico');

/** 无损格式的禁用提示文案 */
const losslessHint = computed(() => {
  if (format.value === 'png') return 'PNG 为无损格式，不支持质量调节';
  if (format.value === 'tiff') return 'TIFF 为无损格式，不支持质量调节';
  if (format.value === 'ico') return 'ICO 为无损格式，不支持质量调节';
  return '';
});
```

- [ ] **Step 2: 更新 script — `handleDownload` 用 `getOutputExtension` 取扩展名**

把 `handleDownload` 内第 204 行的三元扩展名改为：

```ts
function handleDownload(): void {
  if (!result.value) return;
  const baseName = originalName.value.replace(/\.[^.]+$/, '') || 'image';
  const ext = getOutputExtension(format.value).slice(1);
  const a = document.createElement('a');
  a.href = result.value.url;
  a.download = `${baseName}-compressed.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  dispatchToast('已开始下载');
}
```

- [ ] **Step 3: 更新 template — ToolHeader 描述**

把第 241 行 `description` 改为：

```html
description="PNG / JPG / WebP / AVIF 等格式互转、质量压缩与尺寸缩放，支持读取 GIF / BMP / ICO / TIFF，纯浏览器端本地处理"
```

- [ ] **Step 4: 更新 template — 上传区提示文案**

把第 261 行支持格式提示改为：

```html
<div class="text-xs text-muted mt-1">支持 PNG / JPG / WebP / AVIF / GIF / BMP / ICO / TIFF，上限 50MB</div>
```

- [ ] **Step 5: 更新 template — 格式选择拆为有损/无损两组**

把第 316 行单个 `OptionRadioGroup`：

```html
<OptionRadioGroup v-model="format" :options="OUTPUT_FORMATS" label="输出格式" />
```

替换为两组（共享 `format`，单选天然互斥）：

```html
<div class="flex items-center gap-4 flex-wrap">
  <OptionRadioGroup v-model="format" :options="lossyFormats" label="有损" />
  <OptionRadioGroup v-model="format" :options="losslessFormats" label="无损" />
</div>
```

- [ ] **Step 6: 更新 template — 尺寸滑块在 ICO 时禁用**

把第 333-346 行的尺寸控件块，给 `<input type="range">` 加 `:disabled="isIco"`，并在尾部追加 ICO 提示。整个尺寸块替换为：

```html
<div class="flex items-center gap-2" :class="isIco ? 'opacity-50' : ''">
  <span class="text-[0.8125rem] text-muted">尺寸</span>
  <input
    v-model.number="scale"
    type="range"
    min="1"
    max="100"
    step="1"
    aria-label="尺寸"
    :disabled="isIco"
    class="w-32 accent-accent"
  />
  <span class="text-[0.8125rem] font-mono">{{ scale }}%</span>
  <span v-if="targetSize && !isIco" class="text-[0.8125rem] text-muted">({{ targetSize.width }}×{{ targetSize.height }})</span>
</div>
```

- [ ] **Step 7: 更新 template — 底部提示区覆盖新格式**

把第 350-355 行的提示块替换为（ICO 提示优先，其次无损提示，其次 JPEG 填白提示）：

```html
<!-- 预留一行高度，避免切换格式时提示文本出现/消失导致页面跳动 -->
<div class="min-h-[1.25rem] text-[0.8125rem] text-muted">
  <p v-if="isIco" class="m-0">ICO 固定输出 16 / 32 / 48 三尺寸（favicon 标准），尺寸与质量滑块不适用</p>
  <p v-else-if="qualityDisabled" class="m-0">{{ losslessHint }}</p>
  <p v-else-if="loaded && needsFillBackground(format)" class="m-0">
    JPEG 不支持透明背景，透明区域将填充白色
  </p>
</div>
```

- [ ] **Step 8: 类型检查 + 浏览器手验**

```bash
pnpm exec tsc --noEmit
pnpm dev
```

浏览器访问 `/media/image-converter` 验证：

- 格式区显示「有损 / 无损」两组按钮，6 个格式互斥单选
- 选 AVIF：质量滑块可用；选 PNG/TIFF/ICO：质量滑块禁用并显示对应无损提示
- 选 ICO：尺寸滑块禁用、提示「ICO 固定输出…」
- 选 JPEG 并上传透明 PNG：提示「透明区域将填充白色」
- 下载文件扩展名随格式正确变化（avif/tiff/ico）
- 清空按钮恢复默认 WebP

- [ ] **Step 9: 提交**

```bash
git add src/tools/media/ImageConverter.vue
git commit -m "feat(image-converter): grouped format selector + ICO/lossless UX + dynamic extension"
```

---

## Task 9: SEO（tools.ts + tool-faqs.ts）

**Files:**
- Modify: `src/data/tools.ts`（第 413-422 行 image-converter 条目）
- Modify: `src/data/tool-faqs.ts`（第 255-268 行 image-converter FAQ）

- [ ] **Step 1: 更新 `tools.ts` 的 image-converter 条目**

把第 415-416 行 `description` 与 `seoDescription`、第 420 行 `keywords` 替换为：

```ts
    description: 'PNG / JPG / WebP / AVIF / TIFF / ICO 格式互转、质量压缩与尺寸缩放，支持读取 GIF / BMP，纯浏览器端本地处理',
    seoDescription: '免费在线图片转换与压缩工具，支持 PNG、JPG、WebP、AVIF、TIFF、ICO 格式互转与读取 GIF、BMP，自定义质量压缩与按比例尺寸缩放，可生成多尺寸 favicon（ICO），纯浏览器端本地处理图片绝不上传，前端开发、博客配图与网站图标制作必备，即开即用。',
```

```ts
    keywords: ['图片压缩', '图片格式转换', 'png 转 webp', 'jpg 压缩', '在线图片压缩', '图片缩小', 'webp 转换', '图片体积压缩', 'avif 转换', 'tiff 转 png', 'ico 转换', 'favicon 生成', '图片转 avif', 'gif 转 png'],
```

- [ ] **Step 2: 在 `tool-faqs.ts` 的 image-converter FAQ（第 255-268 行）追加 4 条**

在第 264-267 行那条「带透明背景的图片转格式会怎样？」之后（即第 267 行 `},` 之后、第 268 行 `]` 之前）追加：

```ts
    {
      question: '支持哪些图片格式？',
      answer: '读取（输入）支持 <strong>PNG / JPG / WebP / AVIF / GIF / BMP / ICO / TIFF</strong>；转换（输出）支持 <strong>PNG / JPG / WebP / AVIF / TIFF / ICO</strong>。其中 GIF / BMP 仅作为输入读取，转换时需选择其他输出格式。',
    },
    {
      question: '为什么 GIF 转换后不会动？',
      answer: '本工具按<strong>单张静态图</strong>处理，GIF 输入时只取<strong>第一帧</strong>。如需保留动画（多帧、帧率、循环），属于动图编辑场景，不在本工具范围内。',
    },
    {
      question: 'AVIF 编码为什么比较慢？',
      answer: 'AVIF 压缩率高、编码运算量大，浏览器 Canvas 原生不支持输出 AVIF，本工具使用 WASM 编码器（首次使用时加载），大图编码可能需要数秒，属正常现象。',
    },
    {
      question: 'ICO 输出为什么是固定尺寸？',
      answer: 'ICO 主要用于 <strong>favicon</strong>，本工具固定输出 <strong>16 / 32 / 48</strong> 三种标准尺寸并打包进同一个 .ico 文件，覆盖主流浏览器需求，因此尺寸滑块对 ICO 不生效。',
    },
```

- [ ] **Step 3: 类型检查**

```bash
pnpm exec tsc --noEmit
```

预期：无错误。

- [ ] **Step 4: 提交**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts
git commit -m "docs(image-converter): update SEO metadata and FAQs for new formats"
```

---

## Task 10: 最终验证 — 构建 + 全量回归

**Files:** 无（仅验证）

- [ ] **Step 1: 全量单测**

```bash
pnpm test
```

预期：全绿。

- [ ] **Step 2: Astro 类型检查**

```bash
pnpm exec astro check
```

预期：无错误。

- [ ] **Step 3: 生产构建**

```bash
pnpm build
```

预期：构建成功，无报错。注意 SSG 阶段 Vue 组件可能的 SSR 警告（项目已知容忍，参考 `astro-ssg-tolerates-vue-ssr-errors` 记忆），但**不允许 build 失败**。

- [ ] **Step 4: 浏览器最终回归**

```bash
pnpm preview
```

按 Task 7 Step 4 的清单再过一遍全格式闭环（输入 PNG/JPEG/AVIF/TIFF/GIF/BMP/ICO × 输出 PNG/JPEG/WebP/AVIF/TIFF/ICO 的关键组合），确认无运行时白屏、无控制台报错。

- [ ] **Step 5: 清理 spike 临时验证产物**

确认 Task 1 的浏览器 Console 验证未留下任何提交到仓库的临时代码（spike 仅在 Console 执行，本应无残留）。若有，删除后提交。

```bash
git status
```

预期：工作区干净（或仅余设计文档/计划等有意保留的未提交文件）。

---

## Self-Review（计划自检，已执行）

**1. Spec 覆盖：**
- §3.4 方案 A（输入全开 + AVIF/TIFF/ICO 输出）→ Task 2/3/7（输入解码）+ Task 4/5/6/7（输出编码）✓
- §3.3 GIF 静态模式 → Task 2 `defaultFormatForInput`（gif→webp）+ Task 9 FAQ ✓
- §4.1 解码分流 → Task 3 + Task 7 Step 1 ✓
- §4.2 编码分派 + 懒加载 → Task 4/5/6 + Task 7 Step 2 ✓
- §4.3 类型与映射 → Task 2 ✓
- §4.4 UI（双组、质量/填白、ICO 禁 scale、下载扩展名）→ Task 8 ✓
- §4.5 不上 Worker → 计划全程主线程，无 Worker 任务 ✓
- §4.6 错误处理 → Task 3/7（中文错误信息）✓
- §4.7 测试（纯函数 TDD + 浏览器手验）→ Task 2/4 TDD + Task 7/8 手验 ✓
- §4.8 SEO → Task 9 ✓
- §6 spike → Task 1 ✓

**2. 占位符扫描：** 无 TBD/TODO；库 API 不确定处均以「以 Task 1 spike 确认为准」显式标注，并给出最可能实现，非占位符 ✓

**3. 类型一致性：** `OutputFormat` / `EncoderKind` / `LoadedImage` / `ConvertResult` / `qualityToCqLevel` / `encodeAvif` / `encodeTiff` / `encodeIco` / `decodeTiff` / `pickEncoderKind` 在各任务间签名一致 ✓
