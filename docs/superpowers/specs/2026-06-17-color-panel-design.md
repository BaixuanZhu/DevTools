# 颜色面板（Color Panel）设计文档

> 工具分类「颜色工具」（`/color/`）首个工具。围绕「一个当前颜色」提供多空间实时互转、WCAG 无障碍对比度检查与和谐配色板，是前端日常调色、对色、可访问性自查的一站式工作台。
>
> - **创建日期**：2026-06-17
> - **来源**：`docs/ROADMAP.md` §P1 · 颜色工具（空→首开）
> - **预估工时**：3 人天（UI + 逻辑 + SEO + 自测）
> - **状态**：设计定稿，待实现

---

## 一、定位与命名

### 1.1 为什么叫「颜色面板」而非「颜色转换器」

ROADMAP 原名「颜色转换器」，但本工具实际能力是「转换 + 对比度检查 + 配色板」三合一，核心体验是**围绕一个颜色做各种事**，「转换器」把能力说窄了。

命名为「颜色面板」：
- 「面板」天然暗示多控件聚合（转换输入、对比度、配色同处一面）；
- 不与分类名「颜色工具」撞车（避免侧边栏/面包屑出现「颜色工具 › 颜色工具」）；
- 未来若 `color` 分类新增细分工具（如取色器），「颜色面板」作为综合入口依然成立。

### 1.2 标识

| 项 | 值 |
|---|---|
| 显示名 `name` | 颜色面板 |
| 工具 ID `id` | `panel` |
| 路由 `path` | `/color/panel` |
| 分类 | 颜色工具（`color`，已有分类、首个工具） |
| 图标 `icon` | 🎨 |
| 默认当前色 | `#3B82F6`（Tailwind blue-500，醒目） |

> **约束**：`id` 必须等于 `path` 末段（`panel`），否则 FAQ / 相关工具 / SEO 结构化数据会静默失效（参见项目记忆 `tool-id-must-match-path-slug`）。

---

## 二、范围

### 2.1 做

1. **多颜色空间实时互转**：HEX ⇄ RGB ⇄ HSL ⇔ HSV，任一空间可编辑、其余实时联动。
2. **WCAG 对比度检查**：前景（=当前色）与背景（可输入）的对比度比值，给出 AA / AAA（普通字 / 大字）达标判定与示例文字预览。
3. **配色板**：基于当前色生成互补色、类似色、三角配色、分裂互补四种和谐方案，色块点击即设为当前色。

### 2.2 不做（YAGNI，记入排除项）

- **屏幕取色器（EyeDropper API）**：仅 Chrome/Edge 系支持，Safari/Firefox 不可用，体验打折。可在 `color` 分类后续单独建工具。
- **CMYK / Lab / LCH**：偏印刷/学术，非开发者日常刚需。超出 ROADMAP 既定的 HEX/RGB/HSL/HSV 四件套。
- **Alpha 通道**：保持简洁。HEX 只支持 `#RGB` / `#RRGGBB`，不支持 `#RRGGBBAA`。
- **颜色名称 / 近似命名**：低频，不做。

---

## 三、架构与模块拆分

遵循项目「纯计算自研、不引第三方库」约定（对齐正则工具自研引擎先例）。颜色转换是初等数学，**无需 Web Worker**。

```
src/utils/color/
├── color-space.ts          # 类型 + 空间转换纯函数（hex↔rgb↔hsl↔hsv）
├── color-harmony.ts        # 配色板生成（互补/类似/三角/分裂互补）
├── wcag.ts                 # 相对亮度 + 对比度 + AA/AAA 判定
└── __tests__/
    ├── color-space.test.ts
    ├── color-harmony.test.ts
    └── wcag.test.ts
src/tools/color/ColorPanel.vue      # 工具组件（交互核心）
src/pages/color/panel.astro         # 页面（极简：ToolLayout 包裹）
src/data/tools.ts                   # 注册工具元数据
src/data/tool-faqs.ts               # FAQ（key = 'panel'）
```

**单一数据源**：组件状态 `currentColor: RGB`。每个空间表示行维护本地输入字符串，提交（blur / Enter）时解析反算回 RGB，再驱动其余行更新。所有 util 为纯函数，可独立单测。

---

## 四、颜色空间转换（核心算法）

### 4.1 数据结构

```ts
/** RGB，三通道 0–255（整数） */
interface RGB { r: number; g: number; b: number; }
/** HSL，h: 0–360，s/l: 0–100 */
interface HSL { h: number; s: number; l: number; }
/** HSV（HSB），h: 0–360，s/v: 0–100 */
interface HSV { h: number; s: number; v: number; }
```

### 4.2 以 RGB 为枢纽

所有空间互转经 RGB 中转，避免 N×N 矩阵，共 6 个双向转换函数：

```
        hex
         │
    hexToRgb / rgbToHex
         │
         ▼
        rgb ◄──────┐
       /   \       │
  ↔hsl      ↔hsv   │
 (hslToRgb/ (hsvToRgb/
  rgbToHsl)  rgbToHsv)
```

- `hexToRgb(hex: string): RGB | null` — 解析 `#RGB` / `#RRGGBB`（带/不带 `#`、大小写均可），非法返回 `null`。
- `rgbToHex(rgb: RGB): string` — 输出 `#RRGGBB`（6 位、小写）。
- `rgbToHsl` / `hslToRgb` — 标准 HSL 算法。
- `rgbToHsv` / `hsvToRgb` — 标准 HSV 算法。

### 4.3 HEX 输入容错规则

| 输入 | 处理 |
|---|---|
| `3B82F6` / `#3B82F6` | 正常解析 |
| `3B8` / `#3B8` | 3 位展开为 `#BB3388`（每字符重复） |
| `3b82f6`（小写） | 大小写不敏感 |
| 含空白 / 前后空格 | `trim` 后解析 |
| 长度非 3/6、非十六进制字符 | 返回 `null` → UI 内联报错 |

> HSL / HSV 输入框数值越界时（如 `h=400`、`s=120`），按通道钳制到合法范围（h 模 360，s/l/v 钳 0–100），不报错。

---

## 五、UI 设计（单列竖向，以当前色为中心）

遵循 `DESIGN.md` 既有规范，复用 `ToolHeader` / `CodePanel` / `useCopy` / `CustomEvent('toast')`。配色用项目设计令牌（`text-text` / `text-muted` / `text-accent` / `bg-card` / `border-border` 等）。

```
┌──────────────────────────────────────────┐
│ ToolHeader  颜色面板                       │
├──────────────────────────────────────────┤
│ ① 顶部色板区                              │
│   ████████  当前色大块预览（高 ~96px）      │
│   HEX [#3B82F6     ] [🎨原生选色] [复制]   │
├──────────────────────────────────────────┤
│ ② 空间表示区（每行：标签 + 输入 + 复制）    │
│   HEX   #3B82F6                    [复制] │
│   RGB   59  130  246              [复制]  │
│   HSL   217°  91%  60%           [复制]   │
│   HSV   217°  76%  96%           [复制]   │
│   ↑ 任一行可编辑，提交后联动其余行          │
├──────────────────────────────────────────┤
│ ③ WCAG 对比度检查                         │
│   前景 [当前色块]   背景 [#FFFFFF 🎨]      │
│   对比度 3.68 : 1                          │
│   ❌ AA 普通   ✅ AA 大字   ❌ AAA 普通   ❌ AAA 大字 │
│   示例：The quick brown fox  你好世界 123  │
├──────────────────────────────────────────┤
│ ④ 配色板                                  │
│   [互补] [类似] [三角] [分裂互补]          │
│   ■  ■  ■  ■   ← 点击任一色块设为当前色    │
└──────────────────────────────────────────┘
```

### 5.1 交互要点

- **当前色同步**：顶部色板、HEX 输入、原生 `<input type="color">`、四行表示、对比度前景均绑定 `currentColor`。
- **按分量输入**：HEX 行为单个文本框；RGB / HSL / HSV 行各拆为独立分量数字输入框（如 RGB 的 R/G/B、HSL 的 H/S/L），便于精确微调，每分量失焦或回车即触发联动。MVP 不加滑块（YAGNI，可后续增强）。
- **逐行编辑联动**：任一分量修改 → 反算回 RGB 更新 `currentColor` → 其余行所有分量重新计算显示。
- **复制**：每行尾部 + 顶部 HEX 行均有复制按钮，复用 `useCopy`，成功/失败经 `CustomEvent('toast')` 反馈。
- **清空**：顶部提供「重置」按钮，恢复默认色 `#3B82F6`（颜色工具无「清空为空」语义，重置到默认值更合理）。
- **响应式**：单列竖向天然适配窄屏；色板区与各模块宽度跟随 `max-w-[1600px]` 容器。

---

## 六、WCAG 对比度（算法）

遵循 WCAG 2.x 相对亮度法。

### 6.1 单色相对亮度 L

1. RGB 三通道归一化：`c = channel / 255`（0–1）；
2. 逐通道 gamma 校正（线性化）：
   - `c ≤ 0.03928 → c_lin = c / 12.92`
   - 否则 `c_lin = ((c + 0.055) / 1.055) ^ 2.4`
3. `L = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin`。

### 6.2 对比度比值

```
contrast = (L_lighter + 0.05) / (L_darker + 0.05)
```

取两色中较亮 / 较暗分别代入，结果范围 1.0–21.0（黑白为 21:1）。

### 6.3 达标判定阈值

| 等级 | 普通文字（<18pt / <14pt bold） | 大文字（≥18pt / ≥14pt bold） |
|---|---|---|
| AA | ≥ 4.5 | ≥ 3.0 |
| AAA | ≥ 7.0 | ≥ 4.5 |

UI 用 ✅/❌ 徽标逐项展示。背景色默认 `#FFFFFF`，可输入或用原生选色器更改；非法背景色走 §四 HEX 容错，解析失败时对比度区显示内联错误。

---

## 七、配色板（算法）

基于 HSL **色相旋转**，保持当前色的饱和度 S 与亮度 L，仅偏移 H（结果 H 模 360 归一化）。每种方案返回一组 RGB 色（含当前色本身，便于对比）。

| 方案 | 色相偏移 | 色数 |
|---|---|---|
| 互补（Complementary） | `[0, 180]` | 2 |
| 类似（Analogous） | `[-30, 0, +30]` | 3 |
| 三角（Triadic） | `[0, 120, 240]` | 3 |
| 分裂互补（Split-Complementary） | `[0, 150, 210]` | 3 |

- `generateHarmony(base: RGB, scheme: HarmonyScheme): RGB[]` — 先 `rgbToHsl`，按方案偏移 H，再 `hslToRgb` 还原。
- 默认选中「互补」；点击任一色块 → `emit` 设为当前色。

---

## 八、错误处理与默认值

- **HEX 非法**：输入框下方 `text-error` + `role="alert"` 提示「请输入合法的 HEX 颜色，如 #3B82F6 或 #3B8」。
- **HSL/HSV 越界**：钳制到合法区间，不报错（颜色工具的正常使用习惯）。
- **背景色非法**：对比度区显示内联错误，不崩。
- **安全规则**：颜色值为纯字符串解析，无 `eval/Function`，无正则执行用户输入风险（HEX 校验用正则常量，非用户动态正则）。

默认值：当前色 `#3B82F6`、对比度背景 `#FFFFFF`、配色板默认「互补」。

---

## 九、SEO / FAQ / 相关工具

### 9.1 `tools.ts` 注册（`id='panel'`）

- `name`：颜色面板
- `description`：HEX/RGB/HSL/HSV 实时互转、WCAG 对比度检查、互补/类似/三角配色板
- `seoDescription`（120–160 字符）：在线颜色面板工具，支持 HEX/RGB/HSL/HSV 多色彩空间实时互转、WCAG 无障碍对比度检查（AA/AAA 达标判定）与互补/类似/三角配色方案生成，纯浏览器端运算数据不上传。
- `keywords`：颜色转换、hex rgb 转换、hsl hsv、颜色对照表、wcag 对比度、无障碍颜色检查、配色方案、互补色、调色板、颜色搭配、color picker
- `relatedToolIds`：`['qr-code-generator']`（都涉颜色配置；待 CSS 工具上线后回填更贴切的）

### 9.2 `tool-faqs.ts`（key = `'panel'`，4 条）

1. **HEX 的 3 位和 6 位写法有什么区别？** —— 3 位 `#RGB` 是简写，每字符重复一次展开为 `#RRGGBB`（如 `#3B8` = `#BB3388`）；6 位为标准写法。本工具两种都支持。
2. **HSL 和 HSV 有什么区别？** —— 都是基于色相(H)的直观色彩模型，区别在第三维：HSL 的 L 是「亮度」，100% 为纯白；HSV 的 V 是「明度」，100% 为纯色（饱和度足时）。设计师软件多用 HSV，CSS `hsl()` 用 HSL。
3. **WCAG 对比度是怎么算的？AA 和 AAA 有何区别？** —— 先把颜色线性化（gamma 校正）得到相对亮度，对比度 = (亮+0.05)/(暗+0.05)。AA 普通文字需 ≥4.5、大字 ≥3.0；AAA 更严，普通 ≥7.0、大字 ≥4.5。
4. **配色板的几种和谐配色是什么原理？** —— 都基于色相轮旋转：互补色 = 对角 180°（最强对比）；类似色 = ±30°（柔和协调）；三角配色 = 120° 三等分（活泼均衡）；分裂互补 = 互补色的两侧（对比中带协调）。

### 9.3 结构化数据

由 `ToolLayout.astro` 自动生成 BreadcrumbList / WebPage / SoftwareApplication / FAQPage JSON-LD，无需手写。

---

## 十、测试计划

单测位于各 util 同目录 `__tests__/`（项目约定）。

### 10.1 `color-space.test.ts`

- **往返一致性**：`rgb → hsl → rgb`、`rgb → hsv → rgb` 误差 ≤ 1（整数化舍入）。
- **HEX 解析**：`#3B82F6` / `3B82F6` / `#3B8`→`#BB3388` / 小写 / 带空格 均正确；非法输入（`#GGG`、`12345`、空串）返回 `null`。
- **`rgbToHex`**：黑→`#000000`、白→`#ffffff`、纯红→`#ff0000`。
- **边界**：纯黑、纯白、中灰在 HSL/HSV 下的 S=0、L/V 正确。

### 10.2 `color-harmony.test.ts`

- 各方案色相偏移正确（互补 = +180、三角 = +120/+240 等），结果色数正确。
- 基色经 `rgbToHsl` 旋转再 `hslToRgb` 后 S/L 不变。

### 10.3 `wcag.test.ts`

- 已知对比度：黑/白 = 21、白/白 = 1。
- `#3B82F6`（蓝）on 白 ≈ 3.68 → AA 普通不通过（<4.5）、AA 大字通过（≥3.0）、AAA 均不通过。
- 达标判定函数各等级阈值边界正确（4.5、3.0、7.0）。

---

## 十一、完成清单对照

依 `ROADMAP.md` 通用完成清单逐项验收：

- [ ] `src/data/tools.ts` 注册 `id='panel'`，完整填写 name / description / seoDescription / keywords / relatedToolIds
- [ ] 创建 `src/pages/color/panel.astro`，`<ToolLayout toolId="color/panel">` 包裹 `ColorPanel.vue`（`client:idle`）
- [ ] HEX 输入格式校验 + 中文内联错误提示
- [ ] 「重置」（恢复默认色）+ 各行「复制」按钮，复用 `useCopy` + `CustomEvent('toast')`
- [ ] 合理默认值（`#3B82F6`），打开即可体验
- [ ] 完整 SEO：title / meta description（120–160）/ keywords
- [ ] `src/data/tool-faqs.ts` 维护 4 条 FAQ（key=`panel`）
- [ ] 遵守安全规则：无 `eval/Function`，HEX 校验用正则常量
- [ ] util 纯函数单测覆盖（color-space / color-harmony / wcag）

---

## 十二、后续回填项

- `relatedToolIds` 待 CSS 工具（CSS 单位转换器 / 渐变生成器，ROADMAP §P2）上线后回填更贴切的相关项。
- 屏幕取色器若后续单独建工具，可在 `color` 分类新增 `color/eyedropper`。
