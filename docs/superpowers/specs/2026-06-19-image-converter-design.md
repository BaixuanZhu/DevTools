# 设计文档：图片转换与压缩

- **路由**：`/media/image-converter`
- **工具 id**：`image-converter`（严格等于 path 末段）
- **分类**：媒体工具
- **预估工时**：3 人天（对齐 ROADMAP P3）
- **状态**：设计中

## 1. 概述

浏览器端单图处理工具：上传一张图片，在 PNG / JPEG / WebP 间转换、调节压缩质量、缩放尺寸，实时预览压缩前后对比并下载结果。全部运算基于 Canvas + `createImageBitmap` 本地完成，**零第三方依赖**，契合产品「即开即用、客户端运算、数据不上传」定位。

## 2. 功能范围

### 2.1 包含

| 维度 | 说明 |
|------|------|
| 处理模式 | 单图，一次一张 |
| 输入 | 所有浏览器可解码的 `image/*`（PNG / JPEG / WebP / GIF / BMP / AVIF 等）。GIF 仅取首帧 |
| 输出 | **PNG（无损）/ JPEG（有损）/ WebP（有损，保留透明）** 三选一 |
| 质量压缩 | 质量滑块 10–100（默认 80），仅对 JPEG / WebP 生效 |
| 尺寸缩放 | 百分比滑块 1%–100%（默认 100% 不缩放），始终锁定宽高比，显示目标像素 |
| 上传方式 | 拖拽 / 点击选择 / Ctrl+V 粘贴（复用 QrCodeReader 交互） |
| 下载 | 单键下载，文件名 `{原名}-compressed.{ext}` |

### 2.2 排除项（有意不做，避免扩范围）

- 批量处理 / 多图队列 / ZIP 打包
- 目标体积模式（输入期望大小自动二分搜质量）
- 裁剪
- AVIF / GIF / 动图 输出（浏览器编码兼容差 / 动画丢失）
- 元数据（EXIF）查看与编辑；仅在上传时自动纠正 EXIF 方向，不展示

## 3. 页面布局

采用 `ResponsiveWorkspace mode="horizontal"`（`max-w-[1600px]`，`lg` 断点双栏，移动端降级单列）。

```
#input（左栏）                 #output（右栏）
┌──────────────────────┐      ┌──────────────────────┐
│   原始图片预览        │      │   压缩结果预览        │
│   1920×1080  PNG     │      │   1920×1080  WebP    │
│      482 KB          │      │     118 KB   -76%    │
└──────────────────────┘      └──────────────────────┘
─────────── #actions（横跨两栏）──────────
输出格式 [PNG][JPEG][WebP●]   质量 ──●── 80   尺寸 ●── 100%
[拖拽/粘贴/选择上传区域]                    [清空] [下载结果]
```

- **空状态**：左侧为虚线上传区（提示「拖入图片 / 点击选择 / Ctrl+V 粘贴」），右侧占位文案「上传图片后预览压缩结果」。
- **格式选择**：`OptionRadioGroup`（PNG / JPEG / WebP）。
- **质量滑块**：选 PNG 时禁用并提示「PNG 为无损格式，不支持质量调节」。
- **尺寸滑块**：右侧实时显示目标像素，如「1920×1080」。
- **预览图**：用 `object-contain` 限制在固定高度容器内，避免大图撑破布局。

## 4. 技术实现

### 4.1 模块拆分（小而专注，便于单测）

```
src/utils/image/image-convert.ts     # 纯函数：解码、转换编码、校验、格式化
src/utils/image/__tests__/image-convert.test.ts
src/tools/media/ImageConverter.vue   # UI 组件：状态 + 交互 + 实时预览
src/pages/media/image-converter.astro # 页面（复用 Layout / ToolLayout，client:idle 水合）
```

### 4.2 `image-convert.ts` 核心 API

```ts
/** 加载图片文件为位图，自动纠正 EXIF 方向 */
loadImage(file: File): Promise<LoadedImage>
// 实现关键：createImageBitmap(file, { imageOrientation: 'from-image' })

/** 转换编码：resize + 指定格式/质量编码 */
convertImage(opts: ConvertOptions): Promise<ConvertResult>
// opts: { bitmap, format, quality, scale, fillBackground }
// resize: drawImage 到目标尺寸 canvas
// encode: canvas.toBlob(cb, mime, quality)

/** 格式化字节数为人类可读 */
formatBytes(bytes: number): string

/** 浏览器 canvas 处理上限的保守预检阈值（实际仍需 try-catch 兜底，因各浏览器实现不同） */
export const CANVAS_LIMITS = { maxDimension: 16384, maxArea: 268435456 } // 16384² ≈ 268M 像素
```

类型：`LoadedImage`（bitmap + width + height + mime）、`ConvertResult`（blob + objectUrl + width + height + size）。

### 4.3 默认输出格式策略

上传后自动选定默认输出格式（用户可改）：
- 原图为 PNG / JPEG / WebP 之一 → **默认保持原格式**
- 原图为其他格式（GIF / BMP / AVIF 等）→ **默认 WebP**（综合压缩率与兼容性最优）

## 5. 技术坑处理（关键）

| 坑 | 根因 | 处理 |
|----|------|------|
| PNG 质量无效 | `toBlob` 的 `quality` 参数对 PNG 被浏览器忽略 | 选 PNG 时质量滑块禁用 + 文案提示 |
| 透明 → JPEG 黑底 | canvas 默认透明像素，JPEG 编码为黑色 | 转 JPEG 时 `fillRect('#ffffff')` 再 drawImage；UI 提示「JPEG 不支持透明，已填充白底」 |
| canvas 尺寸上限 | 浏览器约 16384px 或总面积限制（Chrome 约 16384×16384 / 268MP） | `loadImage` 后检测，超限给内联错误「图片尺寸过大（{w}×{h}），超过浏览器处理上限，请缩小后重试」 |
| 重编码变大 | 小图或已高度压缩的图重编码可能体积增大 | 如实显示；结果 ≥ 原图时节省比区域提示「当前设置下体积未减小，可降低质量或更换为 WebP」 |
| 内存泄漏 | 连续处理多张图时 object URL 堆积 | 每次重算 / 清空时 `URL.revokeObjectURL` 释放旧 URL |

## 6. 错误处理与性能

遵循 `PRODUCT.md` §Error Handling：

| 场景 | 处理 |
|------|------|
| 非图片文件 | 内联错误「请上传图片文件（PNG / JPG / WebP 等）」 |
| 解码失败 | 内联错误「图片解码失败，可能文件损坏或格式不支持」 |
| 超尺寸上限 | 内联错误（见上表） |
| 复制/下载/清空 | `CustomEvent('toast')` 反馈，1.5s 自动消失 |

性能：
- 单图，主线程处理，**不引入 Web Worker**（YAGNI；canvas 操作主线程即可，`toBlob` 异步不阻塞）。
- 质量/尺寸滑块 `debounce(200ms)` 后重算，避免每个 `input` 事件都 `toBlob`。
- 上传文件大小软上限 50MB，超出提示「图片过大」。

## 7. 注册与 SEO

### 7.1 `src/data/tools.ts`

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
}
```

### 7.2 `src/data/tool-faqs.ts`（3 条）

1. **WebP 和 JPEG 该怎么选？** —— WebP 压缩率更高且支持透明通道，现代浏览器通用，优先选 WebP；JPEG 兼容性最广但不支持透明，适合无透明需求的照片。
2. **为什么选 PNG 时质量滑块不能用？** —— PNG 是无损格式，浏览器在编码 PNG 时会忽略质量参数，因此质量调节仅对 JPEG / WebP 有效。
3. **带透明背景的图片转格式会怎样？** —— 转 PNG / WebP 保留透明；转 JPEG 时透明区域会自动填充白色背景（JPEG 不支持透明通道）。

## 8. 测试计划（TDD）

`image-convert.test.ts` 覆盖纯函数：

- `formatBytes`：B / KB / MB 边界
- `loadImage`：有效图片返回 `{bitmap, width, height}`；非图片抛错/返回错误码；超尺寸返回明确错误
- `convertImage`：
  - JPEG/WebP 应用 quality；PNG 忽略 quality（结果体积与 quality 无关）
  - scale=100 尺寸不变；scale=50 宽高减半
  - 透明 PNG → JPEG 结果无透明（白底）
  - 透明 PNG → WebP 保留透明

组件层（ImageConverter.vue）以手动验证为主（拖拽/粘贴/滑块实时预览/下载）。

## 9. 验收清单

- [ ] `image-convert.ts` 纯函数 + 单测通过
- [ ] 页面 `/media/image-converter` 可访问，复用 Layout / ToolLayout
- [ ] 拖拽 / 选择 / 粘贴三种上传方式均可用
- [ ] 格式转换（PNG/JPEG/WebP）+ 质量滑块（PNG 禁用）+ 尺寸缩放（锁比例）均生效
- [ ] 实时预览 + 原图/结果体积与节省比显示
- [ ] 透明 → JPEG 白底处理正确
- [ ] 错误场景（非图片 / 解码失败 / 超尺寸）内联中文提示
- [ ] 清空 / 下载按钮 + Toast 反馈
- [ ] tools.ts 注册完整（id === path 末段）+ 3 条 FAQ
- [ ] 单工具 JS（gzip）< 50KB（纯 Canvas 零依赖，应远低于预算）
