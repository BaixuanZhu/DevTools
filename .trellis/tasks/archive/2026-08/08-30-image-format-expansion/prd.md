# 图片格式转换扩展（BMP/GIF 输出、SVG/HEIC 输入）

## Goal

为"图片转换与压缩"工具扩展格式覆盖：输出新增 BMP（自研编码，无新依赖）与 GIF（gifenc），输入新增 SVG（浏览器原生光栅化）与 HEIC/HEIF（libheif-js 懒加载解码），并同步全部文案、SEO 与 FAQ。

## Background

- 用户反馈：希望支持更多格式转换。已确认范围：BMP 输出、GIF 输出、SVG 输入、HEIC/HEIF 输入（四项全做）。
- 现状：输入 PNG/JPG/WebP/AVIF/GIF/BMP/ICO/TIFF；输出 PNG/JPEG/WebP/AVIF/TIFF。TIFF 已有"懒加载解码器/编码器"先例（`decoders/tiff.ts`、`encoders/tiff.ts`，utif2），AVIF 用 @jsquash/avif——新格式沿用同一架构模式。
- 依赖决策：
  - **gifenc**（mattdesl，v1.0.3，纯 JS ESM，零依赖，MIT）：GIF 编码事实上的轻量标准，`quantize` + `applyPalette` + `GIFEncoder` 三步 API。
  - **libheif-js**（catdad-experiments）：libheif 的 Emscripten 构建，浏览器可用的 HEIC/HEIF 解码基座（heic2any 等均基于它）；体积大（MB 级），必须动态 import 懒加载，仅当用户导入 HEIC 时加载。
- GIF 仍为静态单帧口径（与现有 FAQ 一致：本工具按单张静态图处理）。

## Requirements

### R1 BMP 输出

1. 自研编码器 `encoders/bmp.ts`：32 位 BGRA + BITMAPV4HEADER（BI_BITFIELDS 四通道掩码），**保留透明通道**（不做 JPEG 式强制填白），自底向上行序。
2. 归入"无损"分组（不提供质量调节）；核心字节构造为纯函数（node 可单测）。
3. 大文件体积属预期（未压缩），输出提示文案说明。

### R2 GIF 输出

1. 引入 gifenc 依赖（pnpm add gifenc），懒加载编码器 `encoders/gif.ts`：静态单帧 GIF89a。
2. 归入"有损"分组；质量滑块映射调色板颜色数（quality → maxColors，映射为纯函数：单调、值域 [16, 256]）。
3. 保留透明（rgba4444 量化 + transparent 帧）。

### R3 SVG 输入

1. 解码器 `decoders/svg.ts`：blob URL + `Image.decode()` 原生光栅化，再经 canvas 转 ImageBitmap（对齐 `LoadedImage` 契约）。
2. 无固有尺寸的 SVG 回退链：naturalWidth=0 → 读文本解析 viewBox → 仍无则 512×512，避免解码失败。
3. 判定：MIME `image/svg+xml` 或扩展名 `.svg`（部分系统 MIME 为空）。
4. 安全：`<img>` 加载 SVG 处于 secure static mode，脚本不执行；blob 同源不污染 canvas（代码注释说明）。

### R4 HEIC/HEIF 输入

1. 引入 libheif-js 依赖，解码器 `decoders/heic.ts`：`HeifDecoder.decode` → `image.display` 回调转 Promise → RGBA → canvas → ImageBitmap。
2. 判定：MIME `image/heic|image/heif`（含 -sequence）或扩展名 `.heic/.heif`（Windows 常报空 MIME）。
3. 懒加载：仅当命中 HEIC 文件时动态 import；确认独立 chunk 不进主包（检查 dist 体积）；必要时 `astro.config.mjs` `vite.optimizeDeps.exclude` 追加 `libheif-js`（与 @jsquash/avif 同例）。
4. 解码失败中文提示与现有错误口径一致（首图加载失败可读）。

### R5 接线与文案

1. `image-convert.ts`：OutputFormat/OUTPUT_FORMATS/LOSSLESS_FORMATS/mime/extension/pickEncoderKind 增补 bmp/gif；convertImage 增加 gif/bmp 分支（ImageData 懒取）；`defaultFormatForInput` 增补：SVG → PNG（图形无损）、HEIC → WebP（照片场景小体积）。
2. `ImageConverter.vue` 空态支持格式文案、`tools.ts` 的 description / seoDescription / keywords 增补 bmp/gif/svg/heic 关键词。
3. `tool-faqs.ts`：「支持哪些格式」更新；新增"为什么输出 BMP 特别大""HEIC 是什么、为什么首次转换要加载解码器"两条；GIF 相关 FAQ 补"输出为静态单帧"。

## Acceptance Criteria

- [ ] PNG（含透明）→ BMP 输出可用且透明保留；BMP 重新导入工具可正常解码（自环验证）。
- [ ] 任意输入 → GIF 输出为合法 GIF89a 静态图；质量滑块改变输出体积；透明保留。
- [ ] SVG（有/无固有尺寸两种）拖入可转换；HEIC 文件（iPhone 实拍或样张）拖入可转换为 PNG/WebP。
- [ ] HEIC 解码器仅在首次遇到 HEIC 时加载（Network 面板可见独立 chunk），主包体积不增长。
- [ ] 文案/SEO/FAQ 全部更新；`bmp/gif` 相关纯函数单测通过（magic、行序、通道序、映射值域）。
- [ ] `pnpm build` + `pnpm test` + `pnpm astro check` 通过；构建产物主 chunk 增量 < 5KB gzip（新依赖均为懒加载）。

## Out of Scope

- GIF 动图（多帧）输入/输出。
- SVG 输出（位图矢量化为伪需求）。
- HEIC 编码输出。
- AVIF 动图。
