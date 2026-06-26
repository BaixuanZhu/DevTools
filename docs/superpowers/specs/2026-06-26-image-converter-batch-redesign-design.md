# 图片转换与压缩工具 · 批量列表重做设计

- 日期：2026-06-26
- 工具：图片转换与压缩（`id: image-converter`，`/media/image-converter`）
- 顶层组件：`src/tools/media/ImageConverter.vue`

## 1. 背景与动机

现有工具功能齐全（格式互转、质量压缩、尺寸缩放、EXIF 隐私擦除、多尺寸 ICO、裁切），但采用**单图 + 双栏**（`ResponsiveWorkspace`）布局：左原图、右结果、底部统一控件。问题在于：

- 一次只能处理一张图，缺少主流图片工具的**批量转换**能力。
- 双栏左右分离，原图与结果的协同、流程感弱，体验"一般"。
- 预览方式固定（左右各一张大图），无法快速浏览多图。

本次重做的目标是**改造交互形态而非重写算法**：转为多图、列表式、缩略图 + 点击预览的批量工作流，复用现有干净的转换算法层（`convertImage()` 等）。

## 2. 目标

1. 支持**多图批量**导入（拖拽 / 点击 / Ctrl+V 粘贴），上限 30 张。
2. 以**单栏列表**展示，每行一张图：统一缩略图 + 文件信息 + 转换状态 + 行内操作。
3. **全局统一参数**：顶部一套控件（格式 / 质量 / 尺寸 / EXIF 擦除 / ICO），作用于所有图。
4. **点击预览**：灯箱查看转换结果大图，支持多图翻页。
5. 保留**逐图裁切**（弹窗形态）。
6. 支持**单张下载**与 **ZIP 打包下载全部**。
7. 转换流畅、内存可控、错误隔离（个别图失败不阻塞整批）。

## 3. 非目标（范围外）

- 不做逐图差异化参数（每张图独立格式/质量）。全局统一即可，逐图差异通过"先转一批、改参数再转下一批"满足。
- 不引入 Web Worker 后台转换（串行队列 + 进度反馈已足够，避免 wasm 编码器跨线程接线的复杂度）。
- 不做原图 vs 结果的对比视图（灯箱仅看结果）。
- 不新增独立"图片裁切"工具（裁切继续内置于本工具）。

## 4. 已确认的关键决策

| # | 决策 | 取舍说明 |
|---|---|---|
| 1 | 全局统一参数 | 批量工具标准心智，最简洁 |
| 2 | 保留裁切，改逐图弹窗 | 裁切天然逐图，唯一无法全局化的功能 |
| 3 | 灯箱仅看转换结果 + 多图翻页 | 用户明确"转换后想预览" |
| 4 | 单张 + ZIP 打包（fflate） | 浏览器逐个触发下载会被拦截；引入轻量 zip 库 |
| 5 | EXIF 擦除 = 全局开关，默认开启，用原生 checkbox | 轻量；保留 JPEG 无损 strip 优化避免画质退化 |
| 6 | 数量上限 30 张 | 内存与流畅度平衡 |
| 7 | 尺寸控件仅显示百分比 | 每张原尺寸不同，"具体像素预览"不再适用 |
| 8 | 架构方案 A：纯前台串行转换 + 组件拆分 | 复用现有算法，风险最低 |

## 5. 整体布局（单栏纵向流）

废弃 `ResponsiveWorkspace` 双栏，本组件改为单栏自上而下：

```
ToolHeader（标题 / 描述）
全局控件栏（常驻）：有损/无损格式 · 质量 slider · 尺寸 slider · ☑ 擦除隐私元数据 · ICO 设置
操作条：                                        [下载全部 ZIP] [清空]
图片列表（单栏，每行一项）
  ┌─[缩略图]  文件名.png                         [预览][裁切][下载][✕]
  │   1920×1080 · 2.1MB  →  860KB · 节省 59%   ✓
  └─ …
底部「+ 添加图片」入口（拖拽 / 点击 / 粘贴全程可用）
```

- **空态**：整块虚线大 Dropzone（拖入 / 点击选择 / Ctrl+V 粘贴），沿用现有空态文案与受支持格式说明。
- **有图态**：列表呈现，顶部/底部保留细长"+ 添加图片"入口；拖拽与全局粘贴在有图时仍可继续追加。
- ICO 输出时，控件栏展开 ICO 专属设置（尺寸多选 / 适配 / 锚点），逻辑沿用现有，仅作用对象由 1 张变 N 张。

## 6. 列表行状态机

每张图是一个状态项，由串行队列驱动：

```
queued（待转换）
  → converting（转换中，行内显示转圈 / 进度）
      → done（✓，显示结果体积 + 节省%，预览/下载可用）
      → error（✗，显示中文错误，提供「重试」）
```

状态转移规则：

- 改任意**全局参数**（格式/质量/尺寸/EXIF/ICO）→ 所有项重置为 `queued` 重新入队；沿用现有 200ms 防抖。
- 单张**裁切完成** → 仅该项重置重转，不影响其他项。
- **预览 / 下载**按钮在该项 `done` 前禁用。
- 个别项 `error` 不阻塞队列，其余项继续转换。

## 7. 全局控件栏（`ImageConverterControls.vue`）

从现有 `ImageConverter.vue` 抽离控件区为独立组件，逻辑与现状一致，仅作用对象变为整批：

- 格式选择：有损（JPEG/WebP/AVIF）+ 无损（PNG/TIFF/ICO）两个 `OptionRadioGroup`。
- 质量 slider：无损格式禁用（沿用 `isLossless`）。
- 尺寸 slider：1–100%，**仅显示百分比**（去掉"具体像素 W×H"，因每张原尺寸不同）。
- EXIF 擦除：**原生 checkbox**（`type="checkbox"` + `accent-accent cursor-pointer`，参考 `TextToolbox.vue`），label「擦除隐私元数据」，**默认勾选**。
- ICO 设置：尺寸多选按钮组 + 适配 `OptionRadioGroup` + 锚点 `SelectListbox`，沿用现有。
- 操作条：仅保留 [下载全部 ZIP] 与 [清空] 两个操作按钮，不显示批量统计文案（逐行仍显示各自体积与节省%）。

> EXIF 擦除沿用现有"逐张判定"：JPEG 输入且满足纯擦除场景（输出仍 JPEG + 原尺寸 + Orientation 正常）走 `stripJpegMetadata` 无损字节剥离；其余走 canvas 重编码（重绘自动清除元数据）。为省内存，**仅 JPEG 输入项保留原始字节**（`originalBytes`），其他格式不存。

## 8. 灯箱预览（`ImageLightbox.vue`，新建）

- 点某行"预览" → 全屏遮罩展示**该图转换结果大图**；TIFF 等浏览器 `<img>` 无法直接渲染的格式用 `result.previewUrl ?? result.url`。
- 翻页：左右箭头按钮 + 键盘 ←/→，在**已 `done` 的图**之间循环切换。
- 关闭：Esc 键 / 点击遮罩 / 关闭按钮。
- 底部信息条：文件名 + 结果尺寸 + 结果体积。
- 纯展示组件，通过 props 接收当前图列表与起始索引，emit 关闭事件；不持有业务状态。

## 9. 裁切弹窗（复用 `ImageCropper.vue`）

- 点某行"裁切" → 模态弹窗内挂载现有 `ImageCropper`，`src` 传该项 `originalUrl`、`fileName` 传基础名。
- `@crop`（`CropResult`）→ 复用现有 `onCrop` 逻辑：
  1. 用 `result.canvas` 生成新 `ImageBitmap`；
  2. `checkCanvasLimits` 尺寸校验，超限提示并放弃；
  3. 关闭旧 bitmap、释放旧 `originalUrl`，替换为裁切结果；
  4. 清空该项 `originalBytes`（裁切已重新编码，strip 路径自动失效）；
  5. 关闭弹窗，重置该项为 `queued` 重转。
- `ImageCropper` 内部**零改动**，仅由内联嵌入改为弹窗容器承载。

## 10. 数据流 / 内存管理 / 性能

核心状态与队列抽到 **`useImageBatch` composable**。每项结构：

```ts
interface BatchItem {
  id: string;                       // 唯一键（递增计数，避免 Math.random）
  file: File;
  name: string;
  bitmap: ImageBitmap;              // 整生命周期保留，避免改参数时重复解码
  width: number;
  height: number;
  originalUrl: string;              // 缩略图 + 裁切源
  originalSize: number;
  originalBytes: ArrayBuffer | null;// 仅 JPEG 输入项保留，用于无损 strip
  inputFormat: OutputFormat | null;
  sensitiveExif: SensitiveExifInfo | null;
  status: 'queued' | 'converting' | 'done' | 'error';
  result: ConvertResult | null;
  error: string;
}
```

- **保留 bitmap**：改全局参数只需重新编码，无需重新解码原文件；30 张上限保证内存可控。
- **串行队列**：单个 async 循环消费 `queued` 项，逐张调用 `convertImage()` / `stripJpegMetadata()`，每张完成立即更新该行，列表实时反映进度。避免 N 张并发打爆主线程与 wasm 编码器。
- **严格释放 object URL 与 bitmap**：删除项 / 清空 / 重转覆盖旧结果 / 组件卸载时，`revokeObjectURL`（`url` 与 `previewUrl`）+ `bitmap.close()`。
- **数量上限 30 张**：导入超出时仅接收前若干张并友好提示；单张仍受 50MB 上限与 16384px 单边上限约束。

## 11. ZIP 打包下载（`zip-download.ts`，新建）

- 依赖 **fflate**（轻量、无依赖、周下载量高，符合项目依赖规则）。
- 收集所有 `done` 项的结果 blob，按 `原名-compressed.<ext>` / `原名-clean.<ext>`（strip 路径）命名，**同名自动加序号去重**，用 `fflate.zip` 打包为单个 `images.zip` 下载。
- 单张下载沿用现有 `handleDownload` 逻辑（按处理路径区分后缀）。

## 12. 组件拆分与文件清单

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/tools/media/ImageConverter.vue` | 顶层壳：组装控件栏 + 列表 + 灯箱 + 裁切弹窗 | 重写 |
| `src/composables/useImageBatch.ts` | 批量状态机、串行队列、内存管理 | 新建 |
| `src/components/media/ImageBatchRow.vue` | 单行：缩略图 + 信息 + 状态 + 操作 | 新建 |
| `src/components/media/ImageLightbox.vue` | 结果灯箱 + 翻页 | 新建 |
| `src/components/media/ImageConverterControls.vue` | 全局控件栏 | 新建（从旧组件抽离） |
| `src/utils/media/zip-download.ts` | fflate 打包 + 文件名去重 | 新建 |
| `src/components/media/ImageCropper.vue` | 裁切器 | 复用，套弹窗 |
| `src/utils/media/image-convert.ts` | 转换算法 | 不动 |
| `src/utils/media/exif-strip.ts` | 无损字节剥离 | 不动 |

- 本组件不再使用 `ResponsiveWorkspace`（其他工具仍在用，组件本身保留）。
- 公共 composable / 组件 / 工具函数均补 TSDoc 文档注释。

## 13. 边界与错误处理

- 非图片文件 / 超 50MB / 解码失败 / 单边超 16384px：逐条中文提示，沿用现有文案。
- 导入超 30 张：接收前 30 张并提示"最多同时处理 30 张"。
- 批量中个别图失败：该行标 `error` 并可「重试」，其余继续。
- ZIP 内同名文件自动加序号去重。
- 无任何 `done` 项时，"下载全部 ZIP"按钮禁用。

## 14. 测试计划

- **纯函数单测**（vitest，node 环境）：
  - `zip-download.ts` 文件名去重逻辑（同名加序号、扩展名保留）。
  - `useImageBatch` 中可抽离的纯逻辑（统计聚合：总体积 / 节省%；状态转移规则），尽量将其设计为不依赖 DOM 的纯函数以便单测。
- **浏览器手验**（Astro SSG 容忍 Vue SSR 错误，须 `pnpm dev` 实测）：
  - 多图导入（拖拽 / 点击 / 粘贴）、超量提示。
  - 改全局参数触发整批重转、进度反馈。
  - 逐图裁切 → 替换 → 重转。
  - 灯箱翻页、键盘操作、TIFF previewUrl。
  - 单张下载、ZIP 打包下载、文件名去重。
  - 删除/清空后无 object URL 泄漏（DevTools 检查）。
- 现有 `image-convert` / `ico` / `exif-strip` 单测保持通过（算法层不动）。

## 15. SEO / 注册

- `src/data/tools.ts` 中 `image-converter` 的 SEO 文案补充"批量转换"能力点。
- FAQ（`src/data/tool-faqs.ts`）按需新增"能否批量转换""一次最多多少张"等问答。
- `id` 保持 `image-converter`，与 path 末段一致，不改路由。
