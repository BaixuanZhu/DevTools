# 二维码识别器（QR Code Reader）设计文档

- **日期**：2026-06-13
- **状态**：已通过 brainstorming，待用户 review
- **分类**：媒体工具（`/media/`）
- **关联**：`docs/ROADMAP.md` P0 第 1 项；与现有「二维码生成器」（`/media/qr-code-generator`）并列

---

## 1. 背景与目标

`docs/ROADMAP.md` P0 阶段的第一项是把"二维码"能力补成闭环：现有「二维码生成器」只做生成，缺识别。本工具补齐"从图片读取并解码二维码"的能力，与生成器形成双向闭环。

**为什么不合并到生成器**：遵循本项目既有的"单一职责、细分独立工具"架构语言（参考编码转换分类下 `base64` / `base64-to-image` / `base64-to-file` / `file-to-base64` 四个独立工具并列的模式），生成与识别是两个相反方向的心智任务，独立成工具更聚焦、更简洁。

**成功标准**：用户截图或保存一张二维码图片后，打开本页→拖入/粘贴→5 秒内拿到解码内容，纯浏览器运算，数据不上传。

---

## 2. 范围

### In Scope

- 上传 / 拖拽图片文件识别
- `Ctrl+V` 粘贴剪贴板图片（截图）识别
- 解码出二维码文本内容
- 轻量内容类型识别：URL / 邮箱 / 电话渲染为可点链接，其余为纯文本
- 复制结果、清空、内联错误提示

### Out of Scope（明确不做）

- 摄像头实时扫码（体积与权限成本高，未来可扩展）
- 粘贴图片 URL 识别（受跨域限制，成功率不稳定）
- 多码识别（一张图识别多个二维码）
- vCard / WiFi / 日历事件等结构化解析（YAGNI）
- 条形码（非 QR）识别

---

## 3. 关键决策（brainstorming 结论）

| 决策点 | 结论 | 理由 |
|--------|------|------|
| 输入方式 | 上传/拖拽 + `Ctrl+V` 粘贴 | 纯本地、无权限/跨域负担，覆盖截图这一最高频场景 |
| 结果展示 | 文本 + 链接可点 | 二维码最大用途是跳 URL，可点链接 ROI 最高，投入小 |
| 多码识别 | 只识别一个 | 截图场景通常单码，实现简单、无误报 |
| 识别库 | 纯 jsQR | 单一依赖、gzip ≈ 16KB、跨浏览器行为一致、API 简单；原生 BarcodeDetector 收益不明显却增复杂度；@zxing/library 超 50KB 预算 |

---

## 4. 详细设计

### 4.1 元数据

| 项 | 值 |
|----|----|
| id / slug | `qr-code-reader` |
| 名称 | 二维码识别器 |
| URL | `/media/qr-code-reader` |
| 分类 | 媒体工具 |
| 图标 | 📷 |
| relatedToolIds | `['qr-code-generator']`（生成器侧同步追加 `qr-code-reader`，双向关联） |

slug 选 `reader` 而非 `scanner`：本工具读取已有图片解码，不涉摄像头，`reader` 更准确。

### 4.2 架构（遵循项目双引擎模式）

| 层 | 文件 | 职责 |
|----|------|------|
| 页面 | `src/pages/media/qr-code-reader.astro` | ToolLayout + SeoHead，`client:idle` 水合 |
| 组件 | `src/tools/media/QrCodeReader.vue` | `<script setup lang="ts">`，UI 与交互 |
| 纯函数 | `src/utils/media/qr-reader.ts` | 封装 jsQR 调用 + 内容类型识别，便于单测 |
| 依赖 | `jsQR`（新增） | 纯 JS QR 解码 |

水合策略 `client:idle`：识别动作由用户触发（拖入/粘贴），无需 `client:load` 抢占首屏。

### 4.3 数据流

```
上传/拖拽 File 或 Ctrl+V Blob
        ▼
createImageBitmap(file)            ← 原生 API，比 <img>+onload 简洁
        ▼
绘制到 Canvas（长边缩放至 ≤1024px）  ← jsQR 复杂度 O(w·h)，缩放防卡顿
        ▼
ctx.getImageData() → jsQR(imageData, w, h)
        ▼
detectContentType(text)  → { type, value, href }
        ▼
渲染：文本 + 复制 + 可点链接
```

**大图缩放**：QR 不需要高分辨率。绘制时把长边限制在约 1024px，既加速解码，又避免巨幅 ImageData 卡死主线程。主线程几十毫秒级完成，**不需要 Web Worker**。

### 4.4 输入处理（复用现有模式）

- **拖拽/点击**：照搬 `Base64ToFile.vue` 的 `fileInputRef` + `isDragging` + `handleDrop` 模式
- **`Ctrl+V` 粘贴**：组件挂载时监听 `window` 的 `paste` 事件，从 `clipboardData.items` 取 `image/*` 的 `Blob`
- **文件校验**：仅接受 `image/*`；上限 10MB（QR 用不着大图）
- 识别后展示原图缩略图 + 结果

### 4.5 内容类型识别（`detectContentType`，纯函数）

按 **url → email → tel → text** 的顺序判定：仅当内容**整体**严格匹配对应格式时才归类，否则降级为 `text`（避免对"含网址的普通文本"误判为链接）。返回 `{ type, value, href }`（`text` 类型 `href` 为空）：

| 内容特征 | type | 渲染 |
|---------|------|------|
| `^https?://` | `url` | `<a target="_blank" rel="noopener noreferrer">` + 「打开」按钮 |
| 纯邮箱（单个） | `email` | `mailto:` 链接 |
| 纯电话号码 | `tel` | `tel:` 链接 |
| 其余 | `text` | 纯文本 |

链接统一 `target="_blank" rel="noopener noreferrer"`，避免 `window.opener` 安全风险（遵循 `CLAUDE.md` §Security Rules）。

### 4.6 错误处理（遵循 `PRODUCT.md` §Error Handling）

| 场景 | 内联提示（中文） |
|------|----------------|
| 非图片文件 | 请上传图片文件（PNG / JPG / WebP 等） |
| 超过 10MB | 图片过大（{size}），请压缩后重试 |
| 解码失败（无码/模糊/反光） | 未识别到二维码，请确保图片清晰、二维码完整且占图较大比例 |
| jsQR 抛错 | try-catch 归入"解码失败"，同上提示 |
| 粘贴非图片内容 | 静默忽略，不打扰 |

复制成功 → `CustomEvent('toast', { detail: { message: '已复制' } })`，由 Alpine Toast 呈现。

### 4.7 UI 布局

```
┌─ 二维码识别器 ───────────────────────────────┐
│  上传/拖拽图片，或 Ctrl+V 粘贴截图即可识别       │
│                                                │
│  ┌────────────────────────────────┐           │
│  │     📷  拖拽图片到这里            │  ← 点击/拖拽/粘贴三合一 │
│  │         或点击选择               │           │
│  │       （也可 Ctrl+V 粘贴）        │           │
│  └────────────────────────────────┘           │
│                                                │
│  〔识别成功后〕                                 │
│  ┌────────┐  结果类型：URL                     │
│  │ 缩略图  │  https://example.com/abc…  [复制][打开]│
│  └────────┘  [清空]                            │
│                                                │
│  〔识别失败〕                                   │
│  内联错误提示（text-error）                      │
└────────────────────────────────────────────────┘
```

遵循现有工具页布局：`ToolHeader`（标题 + 描述）+ 居中工作区（`max-w-5xl`）。

### 4.8 SEO 与注册

- **`src/data/tools.ts`** 注册新工具：
  - `name`: 二维码识别器
  - `description`: 上传或粘贴二维码图片，纯浏览器端识别解码，支持 URL/邮箱/电话可点击
  - `seoDescription`（120–160 字）：在线二维码识别工具，支持拖拽上传与 Ctrl+V 粘贴截图识别二维码，纯浏览器端解码数据不上传，识别 URL/邮箱/电话等内容并提供可点击链接。
  - `keywords`: 二维码识别、二维码解码、qr code 识别、在线扫码、截图识别二维码、二维码图片读取
  - `relatedToolIds`: `['qr-code-generator']`
- **`src/data/tool-faqs.ts`** 维护 2 条 FAQ：
  - 为什么识别失败？（图片模糊/残缺/占比过小/非标准 QR）
  - 支持哪些图片格式？（PNG/JPG/WebP/GIF 首帧/BMP 等浏览器可解码格式）
- **生成器** `qr-code-generator` 的 `relatedToolIds` 追加 `qr-code-reader`，实现双向关联。

### 4.9 测试

- **`src/utils/media/__tests__/qr-reader.test.ts`** 单测：
  - `detectContentType`：四类分派（URL / 邮箱 / 电话 / 文本）+ 边界（空串、混合内容归文本）
  - 大图缩放：长边 > 1024px 时按比例缩放、≤1024px 时保持原尺寸
- jsQR 本体不测（第三方库）。
- 遵循 `CLAUDE.md`：测试位于被测模块同级 `__tests__/` 子目录。

### 4.10 体积与性能

- jsQR gzip ≈ 16KB + Vue 组件极小 → 单页 gzip 预计 < 25KB，**远低于 50KB 红线**（`PRODUCT.md` §Performance Baselines）。
- `createImageBitmap` + Canvas 缩放，主线程几十毫秒完成，无需 Worker。
- 大图强制缩放，防止 O(w·h) 卡顿。

---

## 5. 文件清单

### 新增

| 文件 | 说明 |
|------|------|
| `src/pages/media/qr-code-reader.astro` | 工具页面 |
| `src/tools/media/QrCodeReader.vue` | 交互组件 |
| `src/utils/media/qr-reader.ts` | jsQR 封装 + 内容识别纯函数 |
| `src/utils/media/__tests__/qr-reader.test.ts` | 纯函数单测 |

### 修改

| 文件 | 改动 |
|------|------|
| `src/data/tools.ts` | 注册 `qr-code-reader`；生成器 `relatedToolIds` 追加 `qr-code-reader` |
| `src/data/tool-faqs.ts` | 新增 2 条 FAQ |
| `package.json` | 新增依赖 `jsqr` + `@types/jsqr`（如有） |

---

## 6. 验收标准

- [ ] 拖拽 PNG/JPG/WebP 二维码图片可识别出文本
- [ ] `Ctrl+V` 粘贴截图可识别
- [ ] URL 内容显示为可点击链接 + 「打开」按钮，`rel="noopener noreferrer"`
- [ ] 邮箱、电话分别渲染为 `mailto:` / `tel:` 链接
- [ ] 复制按钮可用并触发 Toast
- [ ] 清空按钮重置全部状态
- [ ] 非图片、超 10MB、无码图片给出对应中文内联错误
- [ ] `tools.ts` / `tool-faqs.ts` 注册完整，SEO 字段齐全
- [ ] 生成器与识别器双向关联
- [ ] `src/utils/media/__tests__/qr-reader.test.ts` 通过
- [ ] 单页 JS gzip < 50KB
- [ ] 键盘可达、对比度符合 WCAG AA

---

## 7. 开放问题

无。所有关键决策已在 brainstorming 阶段确定。
