# ICO 图标制作工具（创作形态）

## Goal

将 ICO 能力从"图片转换与压缩"批量工具中拆出，落地为**创作型**独立工具页 `/frontend/ico-maker`：导入一张图 → 裁切创作区 → 多尺寸生成 ICO；反向还提供 ICO 解析提取。同时清理批量工具中的 ICO 痕迹，保持产品叙事一致。

## Background

- 用户反馈两轮收敛：
  1. ICO 格式图片很特殊，应单独成工具；
  2. **工具不单是转换，形态更像创作——"我放一个图，可以截取一部分转换为 ICO"**（2026-08-30 评审意见，本 PRD 据此从"转换"改版为"创作"）。
- 现状复用基础：`ImageCropper.vue` 已是基于 cropperjs v2 的**嵌入式**裁切组件（比例预设含 1:1、旋转/翻转、指定输出尺寸，emit `CropResult{canvas,blob,...}`），批量工具目前仅以弹窗方式使用它；`encodeIco`（`encoders/ico.ts`）已支持多尺寸数组、手写 ICONDIR、零依赖。
- 工具页独特形态原则：创作流（导入 → 裁切 → 参数 → 产出）是本工具的形态标识，区别于批量转换器的"列表 + 全局参数"。

## Requirements

### R1 模式 A「制作 ICO」（创作流）

1. **导入**：单张图片，拖入 / 点击选择 / Ctrl+V 粘贴；导入后直接进入创作画布。
2. **裁切创作**：内嵌 `ImageCropper`（非弹窗）——比例预设**默认 1:1**（ICO 正方形场景，可切自由/16:9 等）、旋转/翻转可用；确认裁切后进入参数与预览；提供"重新裁切"回到画布（保留原图，不重复上传）。
3. **参数**：
   - 尺寸**多选**：16 / 32 / 48 / 64 / 128 / 256（checkbox，默认 16/32/48，至少 1 个）；
   - 适配：裁切填满（cover）/ 留白完整（contain）+ 九宫格锚点——作为**非正方形裁切结果或未裁切的兜底**（1:1 裁切时此组参数不参与，UI 相应弱化）；
   - 透明处理：留白/透出区域填白开关（默认不填白保透明）。
4. **预览**：按所选尺寸实时渲染逐尺寸预览（真实像素 + 尺寸标注），参数或裁切结果变更即刷新。
5. **产出**：
   - 下载 .ico（多尺寸封装，`{原名}.ico`）；
   - 每个尺寸可单独下载 PNG（`{原名}-{尺寸}.png`）。
6. canvas 重编码天然不含 EXIF（无擦除开关）；超 canvas 单边 16384px 上限给中文错误；ImageCropper 的"指定输出尺寸"作为创作基准尺寸保留，与 ICO 输出尺寸语义独立（裁切输出会被 ICO 尺寸再缩放，无害）。

### R2 模式 B「解析 ICO」（.ico → 图片）

1. 输入单个 .ico / .cur 文件（拖入 / 点击）。
2. 解析 ICONDIR 与 ICONDIRENTRY，展示条目列表：尺寸、色深（bitCount）、内嵌类型（PNG / BMP）、字节数。
3. 每条目缩略预览 + "提取为 PNG"下载：
   - PNG 内嵌条目：直接封装 Blob；
   - BMP 内嵌条目：重建 BITMAPFILEHEADER 还原独立 BMP 再解码转 PNG（Windows 旧版图标常见，必须覆盖）。
4. 非法/损坏文件给中文错误（内联 `text-error`，遵循 PRODUCT.md 错误处理）。

### R3 图片转换与压缩工具去 ICO 化

1. `image-convert.ts`：OutputFormat / OUTPUT_FORMATS / LOSSLESS_FORMATS / pickEncoderKind / EncoderKind 移除 `ico`；convertImage 移除 ICO 分支；`defaultFormatForInput` 保留 ICO 输入 → PNG。
2. `useImageBatch.ts`：ConvertParams 移除 `icoSizes/icoFit/icoAnchor` 及 watch 依赖。
3. `ImageConverterControls.vue` / `ImageConverter.vue`：移除 ICO 专属设置区与参数初始化。
4. 文案：tools.ts 中 image-converter 描述/SEO/keywords 去 ICO，`relatedToolIds` 指向新工具；tool-faqs.ts 中 ICO 两条 FAQ 迁至新工具并按创作口径改写。

### R4 新工具注册与发现

1. `tools.ts` 注册：id `ico-maker`，path `/frontend/ico-maker`，name "ICO 图标制作"，description 突出"裁切创作 + 多尺寸 favicon 生成 + ICO 解析提取"，SEO 字段全填；`relatedToolIds: ['image-converter', 'base64-to-image']`。
2. 路由 `src/pages/frontend/ico-maker.astro`（与 tools/ 目录对称，`client:idle`）。
3. `tool-faqs.ts` 新增 FAQ ≥3 条（favicon 尺寸怎么选 / 为什么要裁切 / 为什么提取出的是 PNG）。
4. 分类页卡片、Sidebar 徽标、搜索、sitemap 自动收录，人工核对。

## Acceptance Criteria

- [ ] 创作流全链路：拖入图 → 默认 1:1 裁切 → 确认 → 勾选 16/32/48/256 → 逐尺寸预览正确 → 下载 .ico 与单尺寸 PNG；"重新裁切"后参数保留、预览刷新。
- [ ] 生成的 .ico 用模式 B 回读，条目数量与尺寸一致。
- [ ] 解析模式：PNG 与 BMP 内嵌条目均可提取 PNG；损坏文件有中文报错。
- [ ] image-converter 无 ICO 输出与 ICO 文案；ICO 文件仍可作为输入转 PNG。
- [ ] 批量工具内既有裁切功能不受 `ImageCropper` 增强（新增 prop）影响。
- [ ] 单测：`ico-parse.test.ts`（crafted PNG/BMP 条目字节）全绿；`image-convert.test.ts` 更新后全绿。
- [ ] `pnpm build` + `pnpm test` + `pnpm astro check` 通过；新页面进入分类页/sitemap/搜索。

## Out of Scope

- 多图批量生成 ICO（保持单图创作形态）。
- 图形绘制/文字/素材库等重度编辑（裁切 = 本工具的创作深度边界）。
- .cur 动态光标编辑（仅按 ICO 结构解析展示）。
- ICO 条目下载原图原始格式（统一转 PNG 交付）。
