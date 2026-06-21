# 图片转换压缩工具 · 格式扩展设计

- 日期：2026-06-21
- 涉及工具：`/media/image-converter`（图片转换与压缩）
- 范围：在现有 PNG / JPEG / WebP 基础上，扩展 AVIF、GIF、BMP、ICO、TIFF 五种格式

## 1. 背景与目标

现有图片转换压缩工具仅支持 PNG / JPEG / WebP 三种格式（输入与输出一致）。用户希望扩充支持格式。

目标格式：**AVIF、GIF（动图）、TIFF、BMP、ICO**。

## 2. 现状分析

核心模块 `src/utils/media/image-convert.ts` 完全基于浏览器原生 Canvas API：

- **解码**：`createImageBitmap(file, { imageOrientation: 'from-image' })`。该 API 实际已能解码 PNG/JPEG/WebP/BMP/GIF(首帧)/ICO/AVIF（现代浏览器）等多种格式，但当前仅暴露三种输出、未扩展输入识别。
- **编码**：`canvas.toBlob(resolve, mime, qualityArg)`。支持质量参数，但输出格式被 Canvas API 硬限制为 PNG / JPEG / WebP 三种，**无法**原生输出 AVIF / GIF / TIFF / ICO / BMP。

由此得出两个关键事实：

1. **输入（解码）端扩展成本极低**——原生 `createImageBitmap` 已覆盖大部分目标格式，仅 TIFF 需引库。
2. **输出（编码）端是真正的工作量**——五种新格式 Canvas 全部不支持，需按需引入编码器库。

## 3. 方案决策

### 3.1 排除 `image-in-browser`

调研结论：不采用。三个致命问题：

- **WebP 只读不能写**——会破坏现有默认输出 WebP 的核心压缩能力。
- **生态极小**——npm 全网仅 1 个依赖者，4 天前才发版，违反项目 CLAUDE.md「只用 npm 周下载量高、社区广泛验证的库」「禁止引入未经广泛验证的库」的硬性依赖规则。
- **纯 TypeScript 实现，官方自述性能不及原生库**——替换现有原生方案属降级。

### 3.2 采用「分层、按需」策略

- **输入**：优先吃浏览器原生 `createImageBitmap`（覆盖 AVIF/GIF首帧/BMP/ICO），仅 TIFF 引 `utif2`。
- **输出**：PNG/JPEG/WebP 维持原生；AVIF 引 `@jsquash/avif`（Squoosh/Google 出品 WASM 编码器），TIFF 用 `utif2`，ICO 用 `to-ico`。所有编码器**懒加载**。

### 3.3 GIF 定位：静态图模式

当前工具心智模型为「单张静态图：上传 → 选格式/质量/缩放 → 预览 → 下载」。GIF 动画保留（多帧/帧率/循环）会打破该模型、显著抬高复杂度，且与「独立工具、不扩范围」的产品取向冲突。

因此 GIF 走静态图模式：

- GIF 输入：取首帧，当普通静态图处理。
- GIF 不作为输出格式（单帧 GIF 真实需求低，YAGNI）。

动画 GIF 完整互转（保留多帧、GIF↔动画WebP/APNG）作为**独立工具**，本期不做。

### 3.4 输出范围：方案 A

- **输入全开**：AVIF / GIF首帧 / BMP / ICO（原生）+ TIFF（`utif2`）。
- **输出新增**：AVIF + TIFF + ICO。
- **仅作输入**：GIF、BMP（单帧 GIF 输出、BMP 输出真实需求低，省 `gifenc` 与手写 BMP 编码器两个引入点；接口预留，后续可无痛追加）。

净增依赖：`@jsquash/avif`、`utif2`、`to-ico`，全部懒加载，首屏零增长。

## 4. 详细设计

### 4.1 解码路径：统一到 `ImageBitmap`

`loadImage` 增加分流。TIFF 走 `utif2`，其余走 `createImageBitmap`，两条路最终都产出 `ImageBitmap`，对下游 `convertImage` 透明：

```ts
export async function loadImage(file: File): Promise<LoadedImage> {
  if (file.type === 'image/tiff') {
    return await decodeTiff(file);  // utif2 → ImageData → createImageBitmap(imageData)
  }
  try {
    return await decodeNative(file);  // createImageBitmap，含 EXIF 方向纠正
  } catch {
    throw new Error('图片解码失败：可能文件损坏，或浏览器不支持该格式（如 AVIF 需 Chrome / 新版 Safari）');
  }
}
```

`decodeTiff`（`decoders/tiff.ts`）流程：`file.arrayBuffer()` → `utif2.decode` → `utif2.toRGBA8` → `new ImageData(...)` → `createImageBitmap(imageData)`。`createImageBitmap(imageData)` 现代浏览器广泛支持，用于把解码结果统一回 `ImageBitmap` 接口。

### 4.2 编码路径：分派器 + 懒加载（核心重构）

`convertImage` 改为分派器。原生三格式继续走 `canvas.toBlob`；新格式先光栅化到 canvas 取 `ImageData`，再分派到各自懒加载编码器：

```ts
export async function convertImage(opts: ConvertOptions): Promise<ConvertResult> {
  const { bitmap, format, quality, scale, fillBackground } = opts;
  const { canvas, ctx, width, height } = rasterize(bitmap, scale, fillBackground);

  // 原生格式
  if (format === 'png' || format === 'jpeg' || format === 'webp') {
    return await encodeViaCanvas(canvas, format, quality);
  }
  // 新格式：取 ImageData，分派懒加载编码器
  const imageData = ctx.getImageData(0, 0, width, height);
  switch (format) {
    case 'avif': return await encodeAvif(imageData, quality);   // encoders/avif.ts
    case 'tiff': return await encodeTiff(imageData);            // encoders/tiff.ts
    case 'ico':  return await encodeIco(bitmap, fillBackground); // encoders/ico.ts
  }
}
```

文件组织（小而聚焦的单元，符合项目约定）：

```
src/utils/media/
├── image-convert.ts            # 解码分流 + 编码分派 + 纯函数（类型/映射/校验）
├── decoders/
│   └── tiff.ts                 # utif2 解码封装
├── encoders/
│   ├── avif.ts                 # @jsquash/avif 封装（WASM），含 quality→cqLevel 映射纯函数
│   ├── tiff.ts                 # utif2 编码封装
│   └── ico.ts                  # to-ico 封装（PNG 多尺寸打包）
└── __tests__/
    └── image-convert.test.ts   # 纯函数测试扩展
```

每个编码器封装内部 `await import(...)` 懒加载，用到对应格式才下载，首屏体积零增长。

各封装职责：

- **`avif.ts`**：`await import('@jsquash/avif')` → `encode(imageData, options)` → `Blob`。`@jsquash/avif` 的 options 不直接用 1-100 quality，而是 `cqLevel`(0-63)；封装内提供 **纯函数** `qualityToCqLevel(quality)` 做映射（可单测）。
- **`tiff.ts`**：`await import('utif2')` → `UTIF.encodeImage(rgba, w, h)` → `Blob`。
- **`ico.ts`**：先将 `bitmap` 经 canvas 转 PNG buffer，`await import('to-ico')` → `toIco([pngBuffer], { sizes: [16, 32, 48] })` → `Blob`。

> ⚠️ `@jsquash/avif` / `utif2` / `to-ico` 的具体 API 形态与浏览器可用性，在实现前由 §6 的 spike 实测确认；上述为预期接口。

### 4.3 类型与映射扩展

```ts
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff' | 'ico';
// GIF / BMP 仅作输入，不进 OutputFormat
```

映射规则：

| 格式 | getOutputMime | getOutputExtension | isLossless | needsFillBackground | defaultFormatForInput |
|------|---------------|--------------------|-----------|--------------------|-----------------------|
| avif | image/avif | .avif | 否（可调质量） | 否（支持透明） | → avif |
| tiff | image/tiff | .tiff | 是 | 否（支持透明） | → tiff |
| ico | image/x-icon | .ico | 是 | 否（支持透明） | → png |
| gif（仅输入）| — | — | — | — | → webp（首帧） |
| bmp（仅输入）| — | — | — | — | → png |

`LOSSLESS_FORMATS` 扩展为 `['png', 'tiff', 'ico']`。`needsFillBackground` 仍仅 jpeg 为 true（其余新输出格式均支持透明）。

`OUTPUT_FORMATS` 从 3 项扩到 6 项，按「有损 / 无损」分组（AVIF 归有损，TIFF/ICO 归无损）。

文件 input 的 `accept` 放开为 `image/*` 并补 `.tif,.tiff` 兜底；输入校验 `file.type.startsWith('image/')` 不变（TIFF/AVIF/GIF/BMP/ICO 的 MIME 均以 `image/` 开头）。

### 4.4 UI 改动（`src/tools/media/ImageConverter.vue`）

- **格式选择**：6 项按「有损 / 无损」分组展示。
- **质量滑块**：AVIF 可调（与 jpeg/webp 一致）；TIFF/ICO/PNG 无损时禁用（复用现有 `qualityDisabled = isLossless(format)` 逻辑）。
- **ICO 特殊处理**：favicon 标准需多尺寸。选 ICO 时**忽略 scale 滑块**，固定从原图生成 16/32/48 三尺寸打包；UI 给一行说明文字。
- **下载扩展名**：`handleDownload` 的扩展名映射扩展（avif/tiff/ico）。
- **加载态**：AVIF 编码（WASM）较慢，复用 `isProcessing` 并显示明确的「正在编码…」提示。

### 4.5 Worker 决策：本期不上 Worker

AVIF 的 WASM 编码在主线程异步执行，大图可能短暂占满主线程几百 ms~数秒。本期先主线程 + loading 提示（YAGNI，与项目「组件层验证」约定一致）。若实测大图明显卡顿，后续按项目 Heavy Computation Pattern 把 `@jsquash/avif` 挪进 Worker——标为「已知后续优化点」。

### 4.6 错误处理（中文具体提示）

- TIFF 解析失败：「TIFF 文件解析失败，可能文件损坏或使用了不支持的子格式」
- AVIF 解码失败（老浏览器）：见 §4.1 的 catch 文案
- 编码失败（WASM 加载/编码异常）：「{格式}编码失败，请尝试其他格式或缩小尺寸」
- 沿用现有「上传大小上限 50MB」「canvas 单边 16384px 上限」校验

### 4.7 测试策略

- **纯函数（单测）**：扩展 `getOutputMime / getOutputExtension / isLossless / needsFillBackground / defaultFormatForInput` 对新格式的映射测试；新增 `qualityToCqLevel` 映射测试；编码分派的**格式路由逻辑**用注入 mock 编码器测试（不依赖真实 WASM）。
- **浏览器 API 层（不单测）**：`createImageBitmap`、canvas、各 WASM 编码器按项目约定走 `pnpm dev` 浏览器手动验证。注意：类型检查与单测全过不代表页面运行正常，必须真机验证 AVIF/TIFF/ICO 的编解码闭环。

### 4.8 SEO

- `src/data/tools.ts`：更新 image-converter 的支持格式清单。
- `src/data/tool-faqs.ts`：新增 1~2 条 FAQ（如「为什么 GIF 转换后不会动」「AVIF 压缩为什么慢」），同步结构化数据。

## 5. 文件改动清单

| 文件 | 改动 |
|------|------|
| `src/utils/media/image-convert.ts` | 重构：解码分流 + 编码分派 + 类型/映射扩展 |
| `src/utils/media/decoders/tiff.ts` | 新增：utif2 解码封装 |
| `src/utils/media/encoders/avif.ts` | 新增：@jsquash/avif 封装 + quality→cqLevel 纯函数 |
| `src/utils/media/encoders/tiff.ts` | 新增：utif2 编码封装 |
| `src/utils/media/encoders/ico.ts` | 新增：to-ico 多尺寸封装 |
| `src/utils/media/__tests__/image-convert.test.ts` | 纯函数测试扩展 |
| `src/tools/media/ImageConverter.vue` | UI：格式分组、质量/填白、ICO 多尺寸、加载态、下载扩展名 |
| `src/data/tools.ts` | SEO 字段更新 |
| `src/data/tool-faqs.ts` | FAQ 补充 |
| `package.json` | 新增 `@jsquash/avif`、`utif2`、`to-ico` |

## 6. 实现风险与前置 spike

最大风险：**`@jsquash/avif` 的 WASM 在 Astro 6 + Vite 下的加载**（wasm 资源路径、Content-Type、`import.meta.url` 解析、懒加载边界）。这是整个方案的成败点。

因此实现**第一步是 spike**：在本项目引 `@jsquash/avif`，跑通「一张 PNG → AVIF」最小闭环——确认 wasm 能加载、能编码、产物体积可接受、懒加载正常。spike 通过后再全面铺开。

spike 同时确认：

- `utif2` 的 `encodeImage` / `toRGBA8` API 与浏览器可用性。
- `to-ico` 的多尺寸接口在浏览器的表现。

## 7. 排除项（Out of Scope）

- **GIF 动画保留与互转**（GIF↔动画WebP/APNG，多帧/帧率/循环）——独立工具，本期不做。
- **GIF / BMP 作为输出格式**——真实需求低，YAGNI；编码接口预留，后续可追加。
- **HEIC / HEIF**——解码需较大 WASM（~1MB+），偏消费用户场景，与开发者工具站定位不符，不做。
- **AVIF 编码上 Worker**——本期主线程，后续按需优化。
- **SVG**——矢量格式，转出有坑（光栅化时机、尺寸语义），不在本次五格式内。
