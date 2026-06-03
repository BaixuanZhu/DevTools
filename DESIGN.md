---
name: DevTools
description: 零门槛的浏览器端开发者工具集合
colors:
  warm-ivory: "#faf9f7"    → Tailwind: surface
  charcoal-ink: "#1a1a1a"   → Tailwind: text
  slate-gray: "#6b7280"     → Tailwind: muted
  warm-sand: "#e5e2dd"      → Tailwind: border
  forged-orange: "#e8590c"  → Tailwind: accent
  white: "#ffffff"          → Tailwind: card
  linen: "#f3f1ee"          → Tailwind: hover
  signal-red: "#dc2626"     → Tailwind: error
  confirm-green: "#16a34a"  → Tailwind: success
typography:
  body:
    class: "font-sans font-normal text-base leading-normal"
  mono:
    class: "font-mono font-normal text-sm"
  title:
    class: "font-sans font-semibold text-xl leading-tight"
  dashboard-title:
    class: "font-sans font-semibold text-2xl leading-tight"
  label:
    class: "font-sans font-medium text-[0.8125rem]"
  sidebar-heading:
    class: "font-sans font-semibold text-xs uppercase tracking-wider text-muted"
rounded:
  sm: "4px"   → Tailwind: rounded-sm
  md: "8px"   → Tailwind: rounded-md
  lg: "12px"  → Tailwind: rounded-lg
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:     "bg-accent text-white rounded-sm px-4 py-2"
  button-ghost:       "bg-card text-text border border-border rounded-sm px-4 py-2 hover:bg-hover"
  input-field:        "bg-card text-text border border-border rounded-sm px-4 py-2 font-mono text-sm focus:border-accent"
  input-readonly:     "bg-hover text-text border border-border rounded-sm px-4 py-2 font-mono text-sm"
  tool-card:          "bg-card border border-border rounded-lg p-6 hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
  search-bar:         "bg-card border border-border rounded-md px-4 py-2 flex gap-2"
  search-bar-focus:   "focus-within:border-accent"
  filter-chip-default: "bg-card border border-border rounded-lg px-4 py-1 text-muted"
  filter-chip-active:  "bg-accent text-white rounded-lg px-4 py-1"
---

# Design System: DevTools

## 0. Tailwind CSS 实现概述

项目统一使用 Tailwind CSS v4 作为唯一样式基座。所有设计令牌通过 `src/styles/global.css` 的 `@theme` 块注入 Tailwind 命名空间，组件通过 utility class 消费，不使用 inline style 或 scoped CSS。

### 设计令牌 → Tailwind 映射

| 设计语义       | 色值       | Tailwind Utility            |
|---------------|-----------|----------------------------|
| 页面底色       | #faf9f7  | `bg-surface`               |
| 卡片/Header 底 | #ffffff  | `bg-card`                  |
| 主文字         | #1a1a1a  | `text-text`                |
| 次要文字/禁用   | #6b7280  | `text-muted`               |
| 边框/分割线     | #e5e2dd  | `border-border`            |
| 强调色         | #e8590c  | `text-accent` `bg-accent` `border-accent` |
| 悬停底色        | #f3f1ee  | `bg-hover`                 |
| 错误文字        | #dc2626  | `text-error`               |
| 成功文字        | #16a34a  | `text-success`             |
| 正文字体        | Noto Sans SC | `font-sans`            |
| 等宽字体        | JetBrains Mono | `font-mono`            |
| 4px 圆角       | -        | `rounded-sm`               |
| 8px 圆角       | -        | `rounded-md`               |
| 12px 圆角      | -        | `rounded-lg`               |

### 样式分层

| 层级     | 位置                   | 技术                      | 职责                            |
|----------|------------------------|---------------------------|--------------------------------|
| 设计令牌 | `src/styles/global.css` | Tailwind v4 `@theme` 块    | 颜色/字体/圆角定义，唯一真相源     |
| 全局布局 | `src/layouts/`          | Astro + Alpine + Tailwind | HTML 骨架、Sidebar、SearchBar、Toast |
| 工具组件 | `src/tools/`            | Vue 3 岛屿 + Tailwind     | 工具交互逻辑、输入/输出 UI         |
| 共享组件 | `src/components/`       | Astro 或 Vue + Tailwind   | Footer、ToolCard、CopyButton 等   |

---

## 1. Overview

**Creative North Star: "The Utility Shelf"**

Every tool visible, labeled, ready. No drawers to open, no manuals to read. The interface is a well-organized shelf: you see what you need, you grab it, you use it, you put it back. Warm ivory surfaces, forged orange accents used as signals not decoration. The palette feels warm and precise: never clinical, never loud.

Light surfaces with a subtle warm tint carry 90% of the viewport. A single saturated accent (forged orange) appears only on interactive elements in active state: focused inputs, active tabs, selected categories. Its rarity makes it noticeable. Components feel tactile and confident: borders define shape, padding creates breathing room, transitions give feedback without theater.

The system rejects everything PRODUCT.md calls out: login walls, multi-step flows, loading spinners, unnecessary navigation depth. A tool page loads and the cursor is already in the input field.

**Key Characteristics:**
- `bg-surface`（#faf9f7）铺底，`text-accent` / `border-accent`（#e8590c）每屏占比 ≤ 10%
- 触感明确：边框定义形状，150ms transition 确认动作
- 无阴影层级：tonal layering（`bg-card` on `bg-surface`，`bg-hover` 悬停）
- 零摩擦交互：页面加载后输入框自动聚焦，结果实时更新，无需提交按钮
- 单一无衬线字体（`font-sans`）+ `font-mono` 专用于代码区域

---

## 2. Colors

**The Shelf Rule.** 中性色承载 90% 的面。`accent`（#e8590c）仅出现在交互元素的活跃态：聚焦输入框、活跃标签页、选中筛选、悬停 Logo。稀缺即力量。任一屏幕超过 10% 的橙色即为异常。

### Neutral（暖调中性色）

- **surface**（#faf9f7）：`bg-surface`。页面主底色，所有页面以此色铺底。
- **text**（#1a1a1a）：`text-text`。主文字，近黑但带暖调，从不使用纯黑。
- **muted**（#6b7280）：`text-muted`。辅助文字、placeholder、侧栏分组标题、禁用态。
- **border**（#e5e2dd）：`border-border`。输入框、卡片、分割线的边框色。
- **card**（#ffffff）：`bg-card`。"浮起"的表面：卡片、Header、Sidebar、Footer。
- **hover**（#f3f1ee）：`bg-hover`。按钮、卡片、侧栏项的悬停底色，比 `surface` 深一阶。
- **accent**（#e8590c）：仅 `text-accent` / `border-accent` / `bg-accent`。从不作为大面积底色。
- **error**（#dc2626）：仅 `text-error`。错误提示文字，不做底色。
- **success**（#16a34a）：仅 `text-success`。成功反馈文字（如复制确认），不做底色。

---

## 3. Typography

**Body Font:** Noto Sans SC（`font-sans`）
**Mono Font:** JetBrains Mono（`font-mono`）

**Character:** 单一 humanist sans-serif 覆盖全界面。Noto Sans SC 在中英文之间渲染均等清晰，略微圆润的字形强化亲和感。JetBrains Mono 处理代码：输入区、输出结果、hash、编码数据。

### Hierarchy

- **Dashboard Title**：`font-sans font-semibold text-2xl leading-tight`。首页标题，页面唯一。
- **Tool Title**：`font-sans font-semibold text-xl leading-tight`。工具页标题。
- **Body**：`font-sans font-normal text-base leading-normal`。描述、标签、通用文字。最大行宽 65–75ch。
- **Label**：`font-sans font-medium text-[0.8125rem]`。按钮文字、字段标签、卡片描述、筛选芯片。
- **Mono**：`font-mono font-normal text-sm`。代码输入/输出区域、hash 结果、编码字符串。
- **Sidebar Heading**：`font-sans font-semibold text-xs uppercase tracking-wider text-muted`。侧栏分组标题。

**The One Family Rule.** `font-sans` 覆盖除代码外的所有文字。标题与正文的层级差异由字号和字重产生，不引入第二套无衬线字体。

---

## 4. Elevation

Flat by default。深度通过 tonal layering 传达：`bg-card`（#ffffff）坐落在 `bg-surface`（#faf9f7）上，悬停态切换为 `bg-hover`（#f3f1ee）。无投影。唯一的投影是工具卡片的悬停微提：`hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]`。

**The No-Shadow Rule.** 静态元素禁止投影。如需"浮起"感，使用不同的中性色阶（card on surface）。工具卡片 hover shadow 是唯一例外，且必须保持 imperceptible。

---

## 5. Components

组件触感明确。边框定义形状，padding 留出呼吸空间，状态切换统一 150ms ease。每个可交互元素都有 hover 响应。每个聚焦输入框都获得 `border-accent`。

所有实现使用 Tailwind utility class。禁用 `transition-colors duration-150`，始终使用具体属性 `transition-[border-color] duration-150`，避免意外触发布局抖动。

### Buttons

- **Primary**：`bg-accent text-white rounded-sm px-4 py-2`。每工具页面唯一主操作（编码、解码、生成）。
- **Ghost / Outline**：`bg-card text-text border border-border rounded-sm px-4 py-2`。复制按钮、清空按钮、示例按钮、非活跃模式标签。
- **Hover**：Ghost 按钮 `hover:bg-hover`。Primary 按钮不改变颜色。
- **Disabled**：`opacity-50 cursor-not-allowed`。
- **Copied state**：Ghost 按钮 `border-success text-success` 持续 1.5s，显示复制反馈。

### Filter Chips

- **Default**：`bg-card border border-border rounded-lg px-4 py-1 text-muted`
- **Active**：`bg-accent text-white rounded-lg px-4 py-1`（border 随 bg 同色）
- **Hover（inactive）**：`hover:bg-hover hover:text-text`

### Tool Cards

- **Default**：`bg-card border border-border rounded-lg p-6`
- **Hover**：`hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]`
- **Content**：icon（emoji, 1.75rem）左 + name（`font-semibold text-[0.9375rem]`）和 description（`text-[0.8125rem] text-muted`）右

### Inputs / Textareas

- **Editable**：`bg-card text-text border border-border rounded-sm px-4 py-2 font-mono text-sm`
- **Read-only**：`bg-hover text-text border border-border rounded-sm px-4 py-2 font-mono text-sm`
- **Focus**：`focus:border-accent`，无 outline ring，无 glow
- **Error**：下方显示 `text-[0.8125rem] text-error` 错误消息

### Search Bar

- **Container**：`bg-card border border-border rounded-md px-4 py-2 flex gap-2`
- **Focus**：`focus-within:border-accent transition-[border-color] duration-150`
- **Input**：占位文本 `text-muted`，输入文字 `text-text`，无边框、无 outline

### Sidebar Navigation

- **Container**：`w-[240px] fixed bg-card border-r border-border`
- **Group headings**：`font-semibold text-xs uppercase tracking-wider text-muted px-4 py-4 pb-1`
- **Nav links**：`flex items-center gap-2 px-4 py-2`
- **Active link**：`bg-hover text-accent border-r-2 border-accent`
- **Hover**：`hover:bg-hover`
- **Mobile**：slide-in from left，`bg-[rgba(0,0,0,0.3)]` backdrop，escape 关闭

### Header

- **Container**：`h-[57px] fixed top-0 bg-card border-b border-border`
- **Layout**：Logo 左 + SearchBar 右（`w-[280px]`）
- **Logo**：`font-semibold text-[1.125rem]`，`hover:text-accent`
- **Mobile**：汉堡按钮替换 SearchBar，三条 2px 横线，宽 18px

### Tool Header

- **Layout**：`flex justify-between items-start`，标题 + 描述 左，示例按钮 右
- **Title**：`font-semibold text-xl`
- **Description**：`text-sm text-muted mt-1`
- **Example button**：Ghost 风格，`hover:border-accent`

### Footer

- **Container**：`bg-card border-t border-border`
- **Content**：居中，`text-[0.8125rem] text-muted`，链接 `hover:text-accent`

---

## 6. Do's and Don'ts

### Do:
- **Do** focus the main input field on page load so the user can start typing immediately.
- **Do** show results in real-time as the user types, with no submit button required (unless the operation is destructive or slow).
- **Do** use `bg-surface`（#faf9f7）as the page surface and `bg-card`（#ffffff）for raised surfaces (cards, sidebar, header).
- **Do** use `text-accent` / `border-accent`（#e8590c）only on interactive elements in active state. Its rarity is its strength.
- **Do** cap code field body text at 65 to 75ch for readability.
- **Do** use 150ms ease transitions for all state changes (`transition-[border-color]` etc.). Fast enough to feel responsive, slow enough to perceive.
- **Do** keep tool pages self-contained at max-width 720px: input, output, and actions all visible without scrolling on desktop.
- **Do** respect prefers-reduced-motion by setting transition durations to 0ms.

### Don't:
- **Don't** use a dark theme with blue/cyan neon accents. This is the first training-data reflex for "dev tools" and it is prohibited.
- **Don't** use glassmorphism, gradient text (background-clip: text), or side-stripe borders greater than 1px as colored accents.
- **Don't** add login walls, onboarding flows, multi-step wizards, or loading spinners. From PRODUCT.md anti-references: forced login, complex flows, and anything that makes the user wait are prohibited.
- **Don't** use `accent` as a background fill for large areas (`bg-accent` on full-width sections). It is a signal, not a surface.
- **Don't** add shadows to resting elements. The tool card `hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` is the sole exception.
- **Don't** animate layout properties or add ambient/choreographed animations. Motion serves feedback only.
- **Don't** use identical card grids with the same-sized cards repeated endlessly without visual differentiation.
- **Don't** introduce a second sans-serif font family. `font-sans` handles everything except code; `font-mono` handles code.
- **Don't** use `transition-colors` — always target specific properties (`transition-[border-color]`, `transition-shadow`) to avoid accidental layout jitter.
