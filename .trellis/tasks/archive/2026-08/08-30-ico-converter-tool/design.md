# Design — ICO 图标制作工具（创作形态）

## 模块边界

```
src/utils/media/
  encoders/ico.ts          【微调】导出 rasterizeToPng（预览/单尺寸 PNG 复用）；删 DEFAULT_ICO_SIZE；encodeIco 不动
  ico-parse.ts             【新增】纯函数：parseIco / 条目类型判定 / buildBmpFromIcoEntry
src/components/media/
  ImageCropper.vue         【增强】新增可选 prop defaultAspect?: 'free'|'1:1'|...（默认 'free'，向后兼容）
  IcoMakerPanel.vue        【新增】模式 A：导入 → 内嵌裁切 → 参数 → 逐尺寸预览 → 下载
  IcoParsePanel.vue        【新增】模式 B：输入 → 条目列表 → 提取 PNG
src/tools/frontend/
  IcoMaker.vue             【新增】页面组件：Tabs「制作 ICO」/「解析 ICO」
src/pages/frontend/
  ico-maker.astro          【新增】ToolLayout + client:idle
```

- 编码完全复用 `encodeIco`（懒加载）；`image-convert.ts` 只做减法。
- `ico-parse.ts` 只做字节级纯函数（node 可测）；Blob/Image 解码留组件层。
- `ImageCropper` 增强仅加一个可选 prop（`aspectPreset` 初值），批量工具弹窗用法零感知；其"指定输出尺寸"区保留（创作基准尺寸，语义独立于 ICO 输出尺寸）。

## 模式 A 数据流（创作三段式）

```
[导入] File(拖/点/粘贴) → objectURL(originalUrl，保留供重新裁切)
   ↓
[裁切] <ImageCropper :src="originalUrl" default-aspect="1:1" @crop @cancel>
   ↓ crop 事件（CropResult{canvas, blob, width, height}）
   → createImageBitmap(canvas) → 创作位图 croppedBitmap（16384 校验同批量工具口径）
   ↓
[参数+预览] 尺寸多选(默认16/32/48) / fit / anchor / fillBackground
   → 每选中尺寸调用 rasterizeToPng(croppedBitmap, size, opts) → 逐尺寸 PNG blob
   → <img :src="objectURL"> 预览网格（真实像素 + CSS 缩放展示 + 尺寸标注）
   ↓
[产出] 下载 .ico → encodeIco(croppedBitmap, {sizes, fit, anchor, fillBackground})
       下载 PNG → 直接用预览阶段已持有的对应尺寸 blob
```

要点：

- **重新裁切**：回到裁切段时复用 originalUrl 重挂 ImageCropper（其内部 watch(src) 已支持重建实例）；已选参数保留；确认后重算位图与预览。
- **1:1 裁切时** fit/anchor 不参与（正方形直缩放）；非 1:1（自由/其他比例）时 fit/anchor 生效——UI 用提示文案说明，不隐藏控件（隐藏逻辑增加状态复杂度，收益低）。
- **未裁切快速路径**：导入后也可跳过裁切直接用原图整图生成（入口：跳过裁切按钮），fit/anchor 兜底适配——"创作"为主，"直转"保底。
- 每尺寸 PNG blob 缓存于组件 ref，参数/位图变更即重建并 revoke 旧 URL（防泄漏）。

## ico-parse.ts 契约

```ts
interface IcoEntry {
  index: number;
  width: number;           // 目录项 0 → 256
  height: number;
  colorCount: number;
  bitCount: number;
  planes: number;
  bytes: Uint8Array;       // 条目原始数据
  format: 'png' | 'bmp';   // \x89PNG magic → png；否则按 biSize 判 bmp
  isCursor: boolean;       // 目录 type=2（.cur）
}
function parseIco(bytes: Uint8Array): { type: 'icon' | 'cursor'; entries: IcoEntry[] }  // 非法 throw 中文 Error
function icoEntryToPng(entry: IcoEntry): Blob            // png 条目直封装（同步）
function buildBmpFromIcoEntry(entry: IcoEntry): Blob     // bmp 条目重建文件头（同步纯字节）
```

`buildBmpFromIcoEntry` 字节规则（ICO 内 BMP 的 biHeight = XOR+AND 两倍高，独立 BMP 减半）：

1. 读 BITMAPINFOHEADER biSize(40/108/124)/biWidth/biHeight/biBitCount/biClrUsed（偏移 0/4/8/14/32）。
2. 调色板字节 = biClrUsed ? biClrUsed*4 : (biBitCount<=8 ? 2^biBitCount*4 : 0)。
3. FILEHEADER(14B)：'BM' + bfSize=14+entryBytes + rsv 0 + bfOffBits=14+biSize+palette。
4. 复制条目数据并将 biHeight 减半（偏移 8 u32）。

组件层解码：bmpBlob → objectURL → `new Image()` → canvas → toBlob('image/png') → 下载；PNG 条目直下载。

## 模式 B 数据流

```
File → arrayBuffer → parseIco → entries 列表（尺寸/色深/类型/字节数）
     → 每条目懒生成预览 URL（png 直封装 / bmp 重建后经 Image+canvas 转 PNG）
下载 → 对应 PNG blob
```

## tools.ts / tool-faqs.ts 文案迁移

| 字段 | image-converter（改） | ico-maker（新） |
|------|----------------------|-----------------|
| description | 移除"ICO 图标导出" | "导入图片裁切创作多尺寸 ICO favicon，支持 ICO 解析提取内嵌 PNG，纯浏览器端" |
| seoDescription | 删 ICO/favicon/裁切句 | 创作流 + 尺寸集 + 解析提取，120~160 字 |
| keywords | 删 ico/favicon/图标裁切类 | ico 制作 / favicon 生成 / png 转 ico / ico 转换 / ico 提取 / ico 解析 / 图标裁切 / ico 在线 |
| relatedToolIds | + 'ico-maker' | ['image-converter', 'base64-to-image'] |
| FAQ | 删 ICO 两条 | 迁入改写（创作口径）+ 新增解析类，≥3 条 |

工具 icon：`🎨`（创作）或 `🧩`，实现时定。Tabs 文案：「制作 ICO」「解析 ICO」。

## 兼容性 / 回滚

- ImageCropper 新 prop 为可选默认值，批量工具零改动；回归点：批量工具裁切弹窗行为不变。
- 常量 `DEFAULT_ICO_SIZE`（单选口径）随批量工具去 ICO 删除；`DEFAULT_ICO_SIZES`（三尺寸）保留为新工具默认勾选。
- 拆分与新增同一子任务内完成，避免"批量无 ICO / 新工具未上线"中间态被部署。
- 回滚：revert 整个子任务分支。

## 测试设计

1. `ico-parse.test.ts`（node 纯字节）：2 条目 crafted ICO（16px BMP + 32px PNG）→ 条目数/尺寸/类型；width=0→256；type=2→isCursor；buildBmpFromIcoEntry 的 'BM'/bfSize/bfOffBits/biHeight 减半；截断/坏 magic → 中文 throw。
2. `encoders/__tests__/ico.test.ts`：不动（rasterizeToPng 导出后引用同步）。
3. `image-convert.test.ts`：删 ico 输出用例；`defaultFormatForInput('image/x-icon') → 'png'` 保留。
4. ImageCropper 增强：批量工具既有交互测试/人工回归确认无感。
5. 创作流与解析流的浏览器行为（裁切/预览/解码转 PNG）：人工验收，不做 happy-dom 单测（canvas 不可用，与既有媒体工具口径一致）。
