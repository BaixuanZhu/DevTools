---
name: DevTools
description: Browser-based developer tool suite with warm, precise utility-first design
colors:
  surface: "#faf9f7"
  card: "#ffffff"
  text: "#1a1a1a"
  muted: "#6b7280"
  border: "#e5e2dd"
  accent: "#e8590c"
  hover: "#f3f1ee"
  error: "#dc2626"
  success: "#16a34a"
typography:
  display:
    fontFamily: "'Noto Sans SC', system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "'Noto Sans SC', system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "'Noto Sans SC', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Noto Sans SC', system-ui, -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  sidebar-heading:
    fontFamily: "'Noto Sans SC', system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.05em"
  mono:
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
  button-ghost-copied:
    textColor: "{colors.success}"
  input-editable:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  input-readonly:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  chip-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted}"
    rounded: "9999px"
    padding: "6px 16px"
  chip-active:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    rounded: "9999px"
    padding: "6px 16px"
---

# Design System: DevTools

> 本文档定义视觉和交互规范。产品行为原则见 PRODUCT.md。

## 1. Overview

**Creative North Star: "The Utility Shelf"**

Every tool visible, labeled, ready. No drawers to open, no manuals to read. The interface is a well-organized shelf: you see what you need, you grab it, you use it, you put it back. Warm ivory surfaces, forged orange accents used as signals not decoration. The palette feels warm and precise: never clinical, never loud.

Light surfaces with a subtle warm tint carry 90% of the viewport. A single saturated accent (forged orange) appears only on interactive elements in active state: focused inputs, active tabs, selected categories. Its rarity makes it noticeable. Components feel precise and restrained: borders define shape, padding creates breathing room, transitions give feedback without theater.

The system rejects everything PRODUCT.md calls out: login walls, multi-step flows, loading spinners, unnecessary navigation depth. A tool page loads and the cursor is already in the input field.

**Key Characteristics:**
- `bg-surface`（#faf9f7）铺底，`text-accent` / `border-accent`（#e8590c）每屏占比 ≤ 10%
- 触感明确：边框定义形状，150ms transition 确认动作
- 无阴影层级：tonal layering（`bg-card` on `bg-surface`，`bg-hover` 悬停）
- 零摩擦交互：页面加载后输入框自动聚焦，结果实时更新，无需提交按钮
- 单一无衬线字体（`font-sans`）+ `font-mono` 专用于代码区域

### Layout Principles

**应用外壳结构：** 整体页面采用应用外壳式布局，`#app` 为 `h-dvh flex flex-col overflow-hidden` 锁高容器：顶部通栏 Header（`h-[57px] shrink-0`，作为 flex 子项天然钉顶，无需 `sticky`）；下方主体行 `flex-1 flex min-h-0` 内含 Sidebar 与内容列。内容列 `flex-1 flex flex-col overflow-x-hidden overflow-y-auto min-w-0` 是唯一的内容滚动容器，内部依次为 `main`（`flex-1`）与 Footer。**滚动归属：仅内容列与 Sidebar 导航区滚动**——`main` 不可自带 `overflow-x-hidden`（会触发 `overflow-y: auto` 副作用使其自身成为滚动容器、把 Footer 排除在滚动流之外），防水平溢出改由内容列承担。Sidebar 桌面端为静态 flex 列（`w-60 shrink-0`），移动端为 `fixed` 抽屉（详见 §Sidebar Navigation）。Footer 位于内容列底部、随内容滚动。

工具页面采用**分层宽度策略**：ToolLayout.astro 主容器使用 `max-w-full` 不限制宽度，宽度约束由各工具组件自行控制。布局以 1024px 为 Sidebar 常驻/抽屉的分界线（对应 Tailwind `lg` 断点）。

**宽度分层：**

| 模式 | 最大宽度 | 适用工具 | 特征 |
|------|---------|---------|------|
| 标准（Standard） | `max-w-[720px]`（等同于 `max-w-3xl`） | 哈希、UUID、加解密、编解码等单列工具 | 输入输出上下排列，紧凑聚焦 |
| 宽屏（Wide） | `max-w-[1600px]` | JSON 格式化、JSON Diff、JSON 转换、Markdown 编辑器、Docker 转换 | 左右双栏布局（`grid-cols-2`），代码编辑/对比需要更宽空间 |
| 过渡（Intermediate） | `max-w-5xl`（1024px）或 `max-w-[760px]` | Cron 解析器、日期时间转换器等特殊工具 | 介于标准和宽屏之间 |

ResponsiveWorkspace 组件封装了宽度选择逻辑：`vertical` 模式使用 `max-w-[720px]`，`horizontal` 模式使用 `max-w-[1600px]` 并切换为 `grid grid-cols-1 lg:grid-cols-2` 双栏网格。

**响应式断点：**

| 断点 | 布局行为 |
|------|---------|
| mobile（< 768px） | 单列布局，Sidebar 隐藏为抽屉，Header 显示汉堡按钮 |
| tablet（768px – 1023px） | 单列但加宽，Sidebar 仍为抽屉 |
| desktop（≥ 1024px） | Sidebar 常驻（240px），内容区自适应 |

间距规则：Tool Header 与下方内容 `mb-6`（24px），表单区块之间 `mb-3`~`mb-4`（12~16px），错误消息与输入框 `mt-1`~`mt-3`（4~12px），多个 Ghost 按钮横向排列 `gap-2`（8px）。

### Transitions

可交互元素的状态切换默认使用 `duration-150`（150ms）。装饰性动画（如 Logo 图标旋转）可使用 `duration-300`（300ms）。始终使用具体属性名，如 `transition-[border-color] duration-150`。尽量避免 `transition-colors`——优先使用具体属性（`transition-[border-color]`、`transition-[background-color]`）以避免意外的重绘。尊重 `prefers-reduced-motion`：在该偏好下所有 transition duration 设为 `0ms`。

### Implementation Rules

本节定义如何将设计系统落地到代码。

**组件库选型：**
- 优先使用 @headlessui/vue 组件（TabGroup / Switch / Listbox / Disclosure / Dialog / Popover 等），不要手写或引入其他 UI 框架
- `src/components/ui/` 下已有封装组件优先复用：ToggleSwitch、SelectListbox、ModeTabGroup、OptionRadioGroup、CopyButton、ClearButton、ColorInput、CodePanel
- Headless UI 无法覆盖的交互需求，使用 Vue 3 Composition API 自行实现，保持无障碍（ARIA、键盘导航、focus 管理）

**样式实现：**
- 统一使用 Tailwind utility class，禁止内联 style、禁止引入额外 CSS 框架
- 消费设计令牌（`global.css` @theme 中定义的令牌），避免硬编码数值
- 每个可交互元素必须覆盖 hover / focus / active / disabled 状态

**Focus 样式约束：** `input`、`textarea` 等文本输入元素使用 `focus:outline-none focus:border-accent` 表示焦点状态。其他交互元素（按钮、开关、下拉选择等）使用 `focus:outline-none` 移除默认 outline，通过背景色变化或 Headless UI 的内置 focus 管理处理焦点。不使用 `focus:ring` 或 `focus:border-accent`。

**工具页面组件模式：** 工具 Vue 组件（`.vue` 文件）使用 `<script setup lang="ts">` + Composition API，导入布局组件，输入即输出（无需"运行"按钮，耗时操作除外）。使用 `ResponsiveWorkspace` 组件统一管理宽度约束：单列工具用 `vertical` 模式（720px），双栏工具用 `horizontal` 模式（1600px）。未使用 ResponsiveWorkspace 的工具通过 `<div class="max-w-[720px]">` 或 `<div class="mx-auto max-w-[1600px]">` 自行控制宽度。

---

## 2. Colors

**The Shelf Rule.** 中性色承载 90% 的面。accent（#e8590c）仅出现在交互元素的活跃态：聚焦输入框、活跃标签页、选中筛选、悬停 Logo。稀缺即力量。任一屏幕超过 10% 的橙色即为异常。

### Neutral

| 语义 | 色值 | Tailwind Utility | 使用范围 |
|------|------|-----------------|---------|
| 页面底色 | #faf9f7 | `bg-surface` | 所有页面的 `<body>` 底色 |
| 卡片/Header 底 | #ffffff | `bg-card` | 卡片、Sidebar、Header、Footer 的背景 |
| 主文字 | #1a1a1a | `text-text` | 正文、标题、输入内容。从不使用纯黑 |
| 次要文字/禁用 | #6b7280 | `text-muted` | 辅助说明、placeholder、侧栏分组标题、禁用态文字 |
| 边框/分割线 | #e5e2dd | `border-border` | 输入框、卡片、分割线、侧栏右边框 |
| 悬停底色 | #f3f1ee | `bg-hover` | 按钮、卡片、侧栏项的悬停底色，比 surface 深一阶 |

### Accent

| 语义 | 色值 | Tailwind Utility | 使用范围 |
|------|------|-----------------|---------|
| 强调色 | #e8590c | `text-accent` `bg-accent` `border-accent` | 仅交互元素活跃态。从不作为大面积底色 |

### Semantic

| 语义 | 色值 | Tailwind Utility | 使用范围 |
|------|------|-----------------|---------|
| 错误 | #dc2626 | `text-error` | 仅文字，不做底色 |
| 成功 | #16a34a | `text-success` | 仅文字，不做底色（如复制确认） |

---

## 3. Typography

**The One Family Rule.** `font-sans`（Noto Sans SC）覆盖除代码外的所有文字。标题与正文的层级差异由字号和字重产生，不引入第二套无衬线字体。

| 角色 | 字体 | Tailwind class | 使用场景 |
|------|------|---------------|---------|
| Dashboard Title | Noto Sans SC | `font-sans font-semibold text-2xl leading-tight` | 首页标题，页面唯一 |
| Tool Title | Noto Sans SC | `font-sans font-semibold text-xl leading-tight` | 工具页标题 |
| Body | Noto Sans SC | `font-sans font-normal text-base leading-normal` | 描述、标签、通用文字。最大行宽 65–75ch |
| Label | Noto Sans SC | `font-sans font-medium text-[0.8125rem]` | 按钮文字、字段标签、卡片描述、筛选芯片 |
| Sidebar Heading | Noto Sans SC | `font-sans font-semibold text-xs uppercase tracking-wider text-muted` | 侧栏分组标题 |
| Mono | JetBrains Mono | `font-mono font-normal text-sm` | 代码输入/输出区域、hash 结果、编码字符串 |

### Border Radius

| 语义 | 值 | Tailwind class | 使用场景 |
|------|-----|---------------|---------|
| sm | 4px | `rounded-sm` | 按钮、输入框 |
| md | 8px | `rounded-md` | 搜索栏 |
| lg | 12px | `rounded-lg` | 卡片、筛选芯片 |

### Spacing Scale

令牌值定义于 `global.css`，组件通过 Tailwind 的间距 utility 消费。

| 令牌 | 值 | Tailwind 等价 | 使用场景 |
|------|-----|-------------|---------|
| xs | 4px | `gap-1` / `p-1` | 组件内部微间距（图标与文字之间） |
| sm | 8px | `gap-2` / `p-2` | 表单元素间距、按钮内 padding 的一半 |
| md | 16px | `gap-4` / `p-4` | 标准内边距、按钮 padding（`px-4`） |
| lg | 24px | `gap-6` / `p-6` | 卡片内边距 |
| xl | 32px | `gap-8` | 区块之间的间距 |
| 2xl | 48px | `gap-12` | 大区块分隔 |

---

## 4. Elevation

Flat by default。深度通过 tonal layering 传达：`bg-card`（#ffffff）坐落在 `bg-surface`（#faf9f7）上，悬停态切换为 `bg-hover`（#f3f1ee）。投影仅用于需要从背景浮出的功能性浮层。

**The Minimal Shadow Rule.** 静态内容区域不使用投影。投影仅用于浮层组件（下拉菜单、Toast 通知、弹出面板）和工具卡片悬停态，且必须保持 imperceptible（`shadow-sm` 或 `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`）。内容卡片、按钮、输入框等常规元素不使用投影。

**Dark Mode: Not Supported.** 当前设计有意只支持暖调浅色主题。warm-ivory 底色是刻意的设计身份标识，不做暗色模式。如未来需要支持，应作为独立项目在 PRODUCT.md 中声明后再启动。

---

## 5. Components

组件精确而克制。边框定义形状，padding 留出呼吸空间，状态切换统一 150ms ease。每个可交互元素都有 hover 响应。每个聚焦输入框都获得 `border-accent`。主要操作按钮应覆盖 complete 状态矩阵（default / hover / active / disabled），辅助组件（开关、选择器等）至少覆盖 default / hover。

### Buttons

| 状态 | Primary | Ghost |
|------|---------|-------|
| Default | `bg-accent text-white rounded-sm px-4 py-2` | `bg-card text-text border border-border rounded-sm px-4 py-2` |
| Hover | 不变色 | `hover:bg-hover` |
| Focus | 无（按钮不显示 focus 样式） | 同 Primary |
| Active (pressed) | `active:brightness-90` | `active:bg-hover/80` |
| Disabled | `opacity-50 cursor-not-allowed`（覆盖所有状态） | 同 Primary |
| Copied | — | Ghost 按钮 `border-success text-success` 持续 1.5s，显示"已复制" |

- **Primary**：每工具页面唯一主操作（编码、解码、生成）。
- **Ghost / Outline**：复制按钮、清空按钮、示例按钮、非活跃模式标签。

### Filter Chips

| 状态 | Class |
|------|-------|
| Default | `bg-card border border-border rounded-lg px-4 py-1 text-muted` |
| Active | `bg-accent text-white rounded-lg px-4 py-1`（border 随 bg 同色） |
| Hover（inactive） | `hover:bg-hover hover:text-text` |
| Disabled | `opacity-50 cursor-not-allowed pointer-events-none` |

### Category Chips（全局筛选，CSS 组件）

Pill 形状（`rounded-full`），`border: 1.5px solid transparent`，活跃态 `bg-text text-surface`（反转），过渡 `background-color 0.15s, color 0.15s, border-color 0.15s`。

### Tool Cards

| 状态 | Class |
|------|-------|
| Default | `bg-card border border-border rounded-lg p-6` |
| Hover | `hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| Focus | 无（卡片不显示 focus 样式） |

Content 结构：icon（emoji, 1.75rem）左 + name（`font-semibold text-[0.9375rem]`）和 description（`text-[0.8125rem] text-muted`）右。

### Inputs / Textareas

| 状态 | Class |
|------|-------|
| Editable | `bg-card text-text border border-border rounded-sm px-4 py-2 font-mono text-sm` |
| Read-only | `bg-hover text-text border border-border rounded-sm px-4 py-2 font-mono text-sm` |
| Focus | `focus:border-accent focus:outline-none`，无 glow |
| Disabled | `bg-surface opacity-60 cursor-not-allowed` |
| Error | 输入框 `border-error`；下方显示 `text-[0.8125rem] text-error` 错误消息 |

错误消息与输入框的间距：`mt-1`（4px）。

### Search Bar

| 状态 | Class |
|------|-------|
| Container | `bg-card border border-border rounded-md px-4 py-2 flex gap-2` |
| Focus（容器） | `focus-within:border-accent transition-[border-color] duration-150` |
| Input | 占位文本 `text-muted`，输入文字 `text-text`，无边框、无 outline |

### Sidebar Navigation

| 元素 | Class |
|------|-------|
| Container（桌面） | `sidebar w-60 shrink-0 border-r border-border bg-card flex flex-col`（静态 flex 列，无 `fixed`） |
| Container（移动） | `position: fixed`，`top: 57px; height: calc(100dvh - 57px); transform: translateX(-100%)`，`.sidebar-open` 时 `translateX(0)` |
| Nav scroll | `flex-1 sidebar-nav-scroll overflow-y-auto py-2`（导航区独立滚动，隐藏滚动条见 §Sidebar Scroll） |
| Group headings | `font-semibold text-xs uppercase tracking-wider text-muted px-4 py-4 pb-1` |
| Nav links | `flex items-center gap-2 px-4 py-2 text-sm` |
| Active link | `bg-hover text-accent font-medium` |
| Hover | `hover:bg-hover` |
| Overlay（移动） | `.sidebar-overlay fixed inset-0 bg-black/30 z-[99]`，`top: 57px`；显隐由 Alpine `x-show` 跟随 `sidebar-toggle`/`sidebar-close` 事件（响应式 `show` 变量），点击或 Esc 关闭 |

### Header

| 元素 | Class |
|------|-------|
| Container | `flex items-center justify-between px-6 py-2 border-b border-border bg-card h-[57px] shrink-0`（通栏，作为 `#app` flex 子项天然钉顶，无需 `sticky`） |
| Layout | 左侧（汉堡按钮 mobile-only + Logo 全断点常驻）+ 右侧（收藏夹 · 暗色模式 · Gitee · GitHub） |
| Logo | `group flex items-center gap-1.5 text-lg font-semibold`，全断点常驻；图标 `text-violet-600`，hover `-rotate-12` |
| 汉堡按钮 | `hidden max-lg:flex`，三条 2px 横线，宽 18px，`@click` 触发 `sidebar-toggle` |
| 收藏夹按钮 | `w-9 h-9 rounded-sm text-muted hover:text-accent hover:bg-hover`，下拉面板 `w-[260px]` |
| 暗色模式按钮 | 同收藏夹按钮样式，当前为 UI 预留（Toast 提示"即将支持"） |
| Gitee / GitHub | 同收藏夹按钮样式，`target="_blank" rel="noopener noreferrer"` |

### Tool Header

| 元素 | Class |
|------|-------|
| Layout | `flex justify-between items-start`，标题 + 描述 左，示例按钮 右 |
| Title | `font-semibold text-xl` |
| Description | `text-sm text-muted mt-1` |
| Example button | Ghost 风格，`hover:border-accent` |

### Footer

| 元素 | Class |
|------|-------|
| Container | `bg-card border-t border-border`，位于内容列底部、`main` 之后，随内容滚动（非 `fixed`/`sticky`） |
| Content | 居中，`text-[0.8125rem] text-muted`，链接 `hover:text-accent` |

### Toast Notification

| 元素 | Class |
|------|-------|
| Position | `fixed top-4 left-1/2 -translate-x-1/2 z-50` |
| Container | `bg-card border border-border rounded-md px-4 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| Success | `border-success text-success` |
| Error | `border-error text-error` |
| Animation | `transition-[opacity,transform] duration-150`，入场 `opacity-0 → opacity-100`，1.5s 后自动消失 |

### ResponsiveWorkspace

统一封装工具页面宽度约束和布局模式的容器组件。

| 模式 | 最大宽度 | 布局 | 适用场景 |
|------|---------|------|---------|
| `vertical`（默认） | `max-w-[720px]` | `flex flex-col` | 单列输入→输出流 |
| `horizontal` | `max-w-[1600px]` | `grid grid-cols-1 lg:grid-cols-2` | 左右双栏（输入+输出并排） |

组件通过 `mode` prop 控制模式。内容通过默认 slot 传入，`#input` 和 `#output` 具名 slot 可选用于水平模式下的左右分栏。

### OptionRadioGroup

基于 Headless UI 的单选按钮组组件，用于在一组互斥选项中选择一个（如哈希算法选择、输出格式选择）。

| 元素 | 描述 |
|------|------|
| 容器 | `flex flex-wrap gap-2` 横向排列 |
| 选项按钮 | `px-3 py-1.5 rounded-sm border border-border text-sm`，默认 `text-muted bg-card` |
| 选中态 | `bg-accent text-white border-accent` |
| Hover | `hover:bg-hover` |

### CodePanel

统一的代码面板组件，用于显示格式化后的代码输出、转换结果等。支持标题栏和操作按钮。

| 元素 | 描述 |
|------|------|
| 容器 | `bg-hover border border-border rounded-sm overflow-hidden` |
| 标题栏 | `flex items-center justify-between px-4 py-2 border-b border-border bg-card` |
| 代码区域 | `p-4 font-mono text-sm overflow-auto whitespace-pre-wrap break-all` |

### Category Filter Chip（CSS 组件）

首页全局分类筛选芯片，使用原生 CSS 类（非 Vue 组件），定义于 `global.css`。

| 状态 | 类名 | 样式 |
|------|------|------|
| 默认 | `.chip-default` | `bg-card border border-border rounded-full px-4 py-1.5 text-muted` |
| 活跃 | `.chip-active` | `bg-text text-surface border-transparent` |
| Hover | `.chip-default:hover` | `bg-hover text-text` |

### Sidebar Scroll

侧栏导航区域的滚动条隐藏样式，通过 `.sidebar-nav-scroll` 类名应用。在保持滚动功能的同时隐藏原生滚动条，通过 `scrollbar-width: none` 和 `::-webkit-scrollbar { display: none }` 实现。

---

## 6. Do's and Don'ts

### Do:
- **Do** focus the main input field on page load so the user can start typing immediately.
- **Do** show results in real-time as the user types, with no submit button required (unless the operation is destructive or slow).
- **Do** use `bg-surface`（#faf9f7）as the page surface and `bg-card`（#ffffff）for raised surfaces (cards, sidebar, header).
- **Do** use `text-accent` / `border-accent`（#e8590c）only on interactive elements in active state. Its rarity is its strength.
- **Do** cap code field body text at 65 to 75ch for readability.
- **Do** use 150ms ease transitions for all state changes (`transition-[border-color]` etc.). Fast enough to feel responsive, slow enough to perceive.
- **Do** keep standard tool pages self-contained at max-width 720px; wide tools (JSON, editors, diffs) may extend to 1600px with dual-column layout for code editing/comparison.
- **Do** respect prefers-reduced-motion by setting transition durations to 0ms.

### Don't:
- **Don't** use a dark theme with blue/cyan neon accents. This is the first training-data reflex for "dev tools" and it is prohibited.
- **Don't** use glassmorphism, gradient text (background-clip: text), or side-stripe borders greater than 1px as colored accents.
- **Don't** add login walls, onboarding flows, multi-step wizards, or loading spinners. From PRODUCT.md anti-references: forced login, complex flows, and anything that makes the user wait are prohibited.
- **Don't** use `accent` as a background fill for large areas (`bg-accent` on full-width sections). It is a signal, not a surface.
- **Don't** add shadows to resting content areas. The tool card `hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` and floating layer components (dropdowns, toasts) are exceptions.
- **Don't** animate layout properties or add ambient/choreographed animations. Motion serves feedback only.
- **Don't** use identical card grids with the same-sized cards repeated endlessly without visual differentiation.
- **Don't** introduce a second sans-serif font family. `font-sans` handles everything except code; `font-mono` handles code.
- **Don't** use `transition-colors` when a specific property works — prefer `transition-[border-color]`, `transition-[background-color]` for precise control.
- **Don't** implement a dark theme. The warm-ivory light palette is a deliberate design identity; dark mode is not in scope.
