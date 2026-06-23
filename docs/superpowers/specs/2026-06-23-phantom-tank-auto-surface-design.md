# 幻影坦克 · 单图自动生成表图

> 日期：2026-06-23
> 范围：对现有 `/media/phantom-tank` 工具的功能增强（不新增页面、不改 URL）

## 1. 背景与目标

现有幻影坦克工具要求用户准备两张满足约束的图（表图 A / 里图 B），门槛高：
算法要求每个像素 `Gray_A ≥ Gray_B`（表图亮于里图），否则该像素 alpha 被钳到 255，白底「穿帮」透出里图。用户反馈「完美符合的图片其实很少」。

**目标**：支持用户只上传里图，工具自动反解出一张满足约束、白底有合理内容的表图，把使用门槛降一半。

**核心决策（已与用户确认）**：
1. 产品形态：里图固定（用户上传、内容不变），工具自动配表图。
2. 白底效果：表图 = 里图的**反相（负片）**，经典幻影坦克效果。
3. 里图处理：提供「里图暗化」滑块（0–80%），让用户在「忠于原图」与「黑底清晰」间自调。

## 2. 算法设计

### 2.1 新增纯函数 `generateSurfaceFromHidden`

放在 `src/utils/media/phantom-tank.ts`，与 `createPhantomTank` 同文件，**复用现有私有 `toGray`** 保证灰度权重一致。

```ts
/** 自动表图生成输入 */
export interface AutoSurfaceInput {
  /** 里图原图（彩色）的像素数据 */
  imageData: ImageData;
  /** 暗化强度 d ∈ [0, 0.8]（滑块百分比 / 100） */
  darken: number;
}

/** 自动表图生成输出：表图 + 暗化里图，同尺寸、同一 d 计算 */
export interface AutoSurfaceOutput {
  /** 灰度反相表图（R=G=B=La），白底显示 */
  surface: ImageData;
  /** 等比压暗的彩色里图（保色相），黑底显示 */
  hidden: ImageData;
}

/**
 * 从里图自动生成配套表图：里图等比暗化 → 算灰度 → 自适应反相得表图。
 * 同时返回暗化里图，保证表图/里图用同一 d、尺寸天然一致。
 */
export function generateSurfaceFromHidden(input: AutoSurfaceInput): AutoSurfaceOutput;
```

### 2.2 逐像素算法

```
对每个像素 (R, G, B)：
  // 1. 暗化里图：各通道等比压暗，保持色相
  r' = R × (1 − d),  g' = G × (1 − d),  b' = B × (1 − d)
  hidden[i] = (r', g', b', 255)

  // 2. 暗化里图灰度（BT.601 权重，与现有 toGray 一致）
  L = 0.299·r' + 0.587·g' + 0.114·b'

  // 3. 自适应反相表图（核心防穿帮策略）
  La = max(255 − L, L)
  surface[i] = (La, La, La, 255)
```

### 2.3 为什么是 `max(255 − L, L)`

纯反相 `La = 255 − L` 只在 `L ≤ 127` 时满足约束 `La ≥ L`。当 `L > 127`（里图偏亮）：

- 取 `La = L`（即 `max` 的结果），该处 `alpha = L − L + 255 = 255`，理论上「穿帮」。
- 但里图此处本就偏亮（接近白），白底合成后显示的也是接近白的灰，视觉上**无突兀穿帮感**。
- 暗区（`L ≤ 127`）走真反相，白底呈现清晰负片。

这是「保证不穿帮的反相」——暗区漂亮、亮区自然归并，正是幻影坦克对暗调里图效果最佳的数学原因。

### 2.4 合成复用现有 `createPhantomTank`

`generateSurfaceFromHidden` 返回的 `{ surface, hidden }` 直接作为 `createPhantomTank({ imageDataA: surface, imageDataB: hidden })` 的输入：

- 黑底：`R_new = R_B'·255/α`，保留暗化里图的彩色。
- 白底：灰度分量精确等于 `La`（反相表图），彩色分量有可控偏差（幻影坦克固有，见 §7）。

## 3. UI 集成

### 3.1 布局（按钮注入，不做模式切换）

贴合用户「不要 Tab 切换」偏好。现有双图手动流程完整保留，自动生成作为表图的第二种来源并存。

```
┌─ 图A · 表图（白底显示）───┐  ┌─ 图B · 里图（黑底显示）───┐
│  [拖入 / 点击 / 粘贴]      │  │  [拖入 / 点击 / 粘贴]      │
│  或自动生成的反相预览      │  │  原图预览                  │
└──────────────────────────┘  └──────────────────────────┘
     ┌────────────── 自动表图控件组 ──────────────┐
     │ 🔄 从里图自动生成   里图暗化 [──●────] 30%  │
     └──────────────────────────────────────────┘
                       [生成]  [下载]  [清空]
```

自动表图控件组置于双图 grid 下方、操作栏上方。滑块用原生 `<input type="range">` + `v-model.number` + label（对齐 `ImageConverter.vue` 现有滑块风格），遵循项目 Tailwind 规范（标准类名，禁止任意值）。

### 3.2 交互

| 触发 | 行为 |
|---|---|
| 里图上传成功 | **自动生成一次表图预览**（默认 d=0.3），`surfaceSource='auto'`，让用户打开即见效果 |
| 拖动「里图暗化」滑块 | `auto`：防抖（~150ms）重算并刷新表图预览；`manual`：滑块置灰禁用 |
| 点击「🔄 从里图自动生成」 | 重新切回 `auto`，按当前 d 重算（用于手动上传后又想用自动的场景） |
| 手动拖入/上传表图 | `surfaceSource='manual'`，覆盖自动预览，滑块禁用 |
| 表图区点删除 | 清空表图与合成结果，`surfaceSource=null` |

### 3.3 表图来源管理（FileDropzone 复用方案）

`FileDropzone` 围绕 `File` 设计（`hasFile = modelValue != null`、删除按钮、`#file` slot 均依赖 `File`）。自动生成的表图没有 `File`，故采用：

- 自动生成时，把表图 `Blob` 包装为 `File`：`new File([blob], 'auto-surface.png', { type: 'image/png' })`，赋给 `surfaceFile`。
- `FileDropzone` 原样工作（预览、删除、拖拽覆盖均正常）。
- 用独立状态 `surfaceSource: 'manual' | 'auto' | null` 标记来源，驱动合成分流与滑块启停。
- `manual` 合成仍走 `surfaceBitmap`（从真实 File 解码）；`auto` 合成走缓存的 `autoSurface`/`autoHidden` ImageData（见 §4），不依赖该包装 File。

## 4. 数据流

### 4.1 状态新增

```ts
type SurfaceSource = 'manual' | 'auto' | null;
const surfaceSource = ref<SurfaceSource>(null);
const darken = ref(30);                 // 滑块值 0–80，d = darken / 100
const autoSurface = ref<ImageData | null>(null);  // 缓存，d/里图变化时重算
const autoHidden = ref<ImageData | null>(null);
```

### 4.2 里图原图 → ImageData 缓存

里图解码得到 `hiddenBitmap` 后，整图画到 canvas 取 `hiddenImageData`（**不裁剪**，auto 模式单图无对齐问题）。该 ImageData 作为 `generateSurfaceFromHidden` 的输入，缓存供滑块重算复用。

### 4.3 自动生成（含滑块联动，防抖）

```
generate(hiddenImageData, d):
  { surface, hidden } = generateSurfaceFromHidden({ imageData: hiddenImageData, darken: d })
  autoSurface.value = surface
  autoHidden.value = hidden
  surfacePreviewUrl = surface → canvas → PNG Blob → ObjectURL
  surfaceFile = new File([blob], 'auto-surface.png', ...)
  surfaceSource = 'auto'
```

### 4.4 `handleGenerate` 分流

```ts
if (surfaceSource.value === 'auto') {
  // autoSurface / autoHidden 已是目标尺寸 ImageData，直接合成
  result = await processImageData(autoSurface.value, autoHidden.value);
} else {
  // manual：现有逻辑——两图中心裁剪对齐
  const targetW = Math.min(surfaceBitmap.width, hiddenBitmap.width);
  const targetH = Math.min(surfaceBitmap.height, hiddenBitmap.height);
  // checkCanvasLimits + cropCenterToImageData 各自裁剪
  result = await processImageData(dataA, dataB);
}
```

`processImageData`（含 400 万像素 worker 阈值）原样复用，两条路径统一。

### 4.5 性能

表图生成（灰度 + 反相 + max，无除法）运算轻于合成，**主线程直算，暂不进 worker**。滑块拖动用 ~150ms 防抖避免高频重算。`checkCanvasLimits` 沿用，超限里图中文报错。

## 5. 错误处理（全部沿用现有机制，无新增异常路径）

| 场景 | 处理 |
|---|---|
| 里图超大 | `checkCanvasLimits` 拦截，中文提示 |
| 解码失败 | 现有 `errorMsg`：「图片解码失败，可能文件损坏或格式不支持」 |
| 合成失败 | 现有 `errorMsg`：「幻影坦克合成失败」 |
| 滑块越界 | 原生 `range min="0" max="80" step="1"`，物理上无法越界 |
| 里图未就绪 | 「生成」/「自动生成」按钮 `disabled`（沿用 `canGenerate` 思路） |

## 6. 测试计划

在 `src/utils/media/__tests__/phantom-tank.test.ts` 增补 `generateSurfaceFromHidden` 用例（沿用现有 fake-data 风格）：

- `d=0` 纯黑像素 `(0,0,0)` → surface 全白 `(255,255,255)`、hidden 不变。
- `d=0` 中灰 `(100,100,100)` → `L=100 ≤127` → `La=155`（真反相）。
- `d=0` 亮灰 `(200,200,200)` → `L=200 >127` → `La=max(55,200)=200`（自适应防穿帮）。
- `d=0.5` 像素 `(200,200,100)` → hidden 各通道 ×0.5 = `(100,100,50)`、surface 按压暗后灰度反相。
- **不变式**：遍历所有像素 `gray(surface) ≥ gray(hidden)`（防穿帮契约）。
- surface 三通道相等（灰度图）。
- hidden 保持原色相（R:G:B 比值不变，等比压暗）。
- `darken` 边界：`0`（不暗化）、`0.8`（上限）。
- 输出尺寸与输入一致。

## 7. 固有限制（写入 FAQ，管理用户预期）

幻影坦克本质是**亮度游戏**，由算法决定、非缺陷：

1. **白底（表图）只能是灰度反相**，无法呈现彩色负片；黑底（里图）保留彩色。
2. **亮调里图（如白底照片）即使暗化也难完美**——需把滑块调大（0.7–0.8）压暗里图，黑底主体才清晰。暗调里图（黑背景图）效果最佳。
3. 自动表图是「算出来」的，白底内容是里图的负片，非独立素材。

## 8. FAQ / SEO 改动

### 8.1 FAQ（`src/data/tool-faqs.ts`，在现有 4 条后补 2 条）

- **「只有一张图能用吗？」** → 可以。上传里图后点「从里图自动生成」（或默认已自动生成），工具按反相自动算出表图，无需手动准备。
- **「里图暗化滑块调多少？为什么白底是灰度负片？」** → 里图越亮调越大（亮图建议 0.7–0.8），目标是黑底主体清晰；白底只能显示灰度是幻影坦克的固有物理限制。

### 8.2 SEO（`src/data/tools.ts`，`phantom-tank` 条目微调）

- `description` / `seoDescription`：补一句「支持只上传里图、自动生成反相表图」。
- `keywords`：追加 `'自动生成表图'`、`'单图幻影坦克'`。
- `id` / `path` / `relatedToolIds` 不变。

## 9. 范围排除（YAGNI）

以下明确**不做**，避免范围蔓延：

- ❌ 不新增独立页面/工具（复用现有 `/media/phantom-tank`）。
- ❌ 不为表图生成单独开 Web Worker（运算轻，主线程足够；性能问题再迭代）。
- ❌ 不做彩色反相表图（物理不可行，见 §7）。
- ❌ 不做「白底强度/对比度」等额外参数（一个暗化滑块已覆盖核心调节）。
- ❌ 不做里图预处理的高级选项（如对比度、伽马）——单一暗化滑块保持简洁。

## 10. 涉及文件

| 文件 | 改动 |
|---|---|
| `src/utils/media/phantom-tank.ts` | 新增 `AutoSurfaceInput/Output` 类型 + `generateSurfaceFromHidden` 函数（复用 `toGray`） |
| `src/utils/media/__tests__/phantom-tank.test.ts` | 增补 `generateSurfaceFromHidden` 测试用例 |
| `src/tools/media/PhantomTank.vue` | 新增自动表图控件组（按钮+滑块）、`surfaceSource` 状态、自动生成/滑块联动逻辑、`handleGenerate` 分流 |
| `src/data/tool-faqs.ts` | `phantom-tank` 补 2 条 FAQ |
| `src/data/tools.ts` | `phantom-tank` 条目 `description`/`seoDescription`/`keywords` 微调 |

`phantom-tank.worker.ts`、`phantom-tank.astro` 无需改动。
