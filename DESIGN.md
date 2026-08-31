---
name: DevTools
description: Browser-based developer tool suite with clean, precise utility-first design (shadcn zinc tokens; brand orange reserved for the logo)
colors:
  surface: "#ffffff"
  card: "#ffffff"
  text: "#09090b"
  muted: "#71717a"
  border: "#e4e4e7"
  primary: "#18181b"
  brand: "#e8590c"
  hover: "#f4f4f5"
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
    backgroundColor: "{colors.primary}"
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
---

# Design System: DevTools

> 本文档定义视觉和交互规范。产品行为原则见 PRODUCT.md。

## 1. Overview

**Creative North Star: "The Utility Shelf"**

Every tool visible, labeled, ready. No drawers to open, no manuals to read. The interface is a well-organized shelf: you see what you need, you grab it, you use it, you put it back. Clean neutral (shadcn zinc) surfaces carry the palette; one warm orange is reserved exclusively for the brand mark. Precise and quiet: never clinical, never loud.

Neutral light surfaces (pure white, zinc base) carry 90% of the viewport. Interactive emphasis is tonal: primary（浅色 zinc-900，暗色反相为近白）marks primary actions and active states; hover uses the tonal accent. The saturated forged orange appears only as the brand signature（Logo 艺术字），never as a UI state color. Components feel precise and restrained: borders define shape, padding creates breathing room, transitions give feedback without theater.

The system rejects everything PRODUCT.md calls out: login walls, multi-step flows, loading spinners, unnecessary navigation depth. A tool page loads and the cursor is already in the input field.

**Key Characteristics:**
- `bg-background`（#ffffff）铺底，`text-primary`（zinc-900 主交互色）仅用于主操作与激活态；品牌橙（`--brand`）仅出现在 Logo
- 触感明确：边框定义形状，150ms transition 确认动作
- 无阴影层级：tonal layering（`bg-card` on `bg-background`，`bg-accent` 悬停）
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

**工作台页形态（例外，2026-08 起）：** 旗舰工作台（Markdown 工作台 `/markdown`）不套用上述工具页模板，也不使用站点壳层：页面为完整独立 HTML 文档（不用 Layout.astro），`body` 为 `h-dvh overflow-hidden` 全屏锁高容器，仅挂一个 `client:only="vue"` 全屏岛。岛自含应用级顶栏（文档操作 + 标题 + 视图切换 + 主题三态切换，控件复用 Header 同款按钮/下拉规范）、左侧文档列表侧栏（桌面 `w-60` 静态列、移动端 fixed 抽屉 + 遮罩）与主编辑区。因无 Shell，岛内需自含 `themeStore.load()` 初始化与 `<Toaster />` 挂载；无 FAQ、无 Footer、无面包屑等站点化元素。第三方编辑器（md-editor-v3）通过自身的 theme prop 跟随 `themeStore.current`，整体视觉仍消费语义 token。

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
- 可访问交互原语使用 reka-ui（Tabs / Switch / Select / RadioGroup / Collapsible / Dialog / DropdownMenu 等），不要手写或引入其他 UI 框架；shadcn-vue 预制件可按 `components.json`（无 `@/` 别名）`add` 后改相对路径引入
- `src/components/ui/` 下已有封装组件优先复用：ToggleSwitch、SelectListbox、ModeTabGroup、OptionRadioGroup、CopyButton、ClearButton、ColorInput、CodePanel
- reka-ui 无法覆盖的交互需求，使用 Vue 3 Composition API 自行实现，保持无障碍（ARIA、键盘导航、focus 管理）

**样式实现：**
- 统一使用 Tailwind utility class，禁止内联 style、禁止引入额外 CSS 框架
- 消费设计令牌（`global.css` @theme 中定义的令牌），避免硬编码数值
- 每个可交互元素必须覆盖 hover / focus / active / disabled 状态

**Focus 样式约束：** `input`、`textarea` 等文本输入元素使用 `focus:outline-none focus:border-primary` 表示焦点状态。其他交互元素（按钮、开关、下拉选择等）使用 `focus:outline-none` 移除默认 outline，通过背景色变化或 reka-ui 原语的内置 focus 管理处理焦点。不使用 `focus:ring`。

**工具页面组件模式：** 工具 Vue 组件（`.vue` 文件）使用 `<script setup lang="ts">` + Composition API，导入布局组件，输入即输出（无需"运行"按钮，耗时操作除外）。使用 `ResponsiveWorkspace` 组件统一管理宽度约束：单列工具用 `vertical` 模式（720px），双栏工具用 `horizontal` 模式（1600px）。未使用 ResponsiveWorkspace 的工具通过 `<div class="max-w-[720px]">` 或 `<div class="mx-auto max-w-[1600px]">` 自行控制宽度。

---

## 2. Colors

**The Shelf Rule.** 中性色（shadcn zinc 体系）承载 90% 的面。primary（浅色 zinc-900 / 暗色近白，双主题反相）是主交互色：主按钮、激活标签/筛选、焦点边框。品牌橙 `--brand`（#e8590c）降级为品牌识别色，仅用于 Logo/品牌图标，不进入交互系统——任一屏幕的橙色占比接近 0% 是常态。

**令牌体系（2026-07 重构）：** 设计令牌定义于 `src/styles/global.css`，采用 shadcn 语义的双层结构——`:root` / `.dark` 两组 CSS 变量（语义层）经 `@theme inline` 映射进 Tailwind 命名空间（映射层）。组件只消费语义类名，切换 `<html class="dark">` 即整站换主题。**语义对齐 shadcn 约定：`primary` = 主交互色（浅色 zinc-900 / 暗色近白），`accent` = 悬停/次要底色（灰）**。品牌橙独立为 `--brand`，不随交互态变化。与重构前的旧体系（暖调象牙白底、primary=橙）完全不同，引用旧文档时注意。

### Neutral + Primary（浅色 / 暗色双组）

| 语义 | 浅色 | 暗色 | Tailwind Utility | 使用范围 |
|------|------|------|-----------------|---------|
| 页面底色 | #ffffff | #09090b | `bg-background` | 所有页面的 `<body>` 底色 |
| 卡片/弹层底 | #ffffff | #09090b | `bg-card` `bg-popover` | 卡片、Sidebar、Header、Footer、下拉弹层（与底色同值，边界由 border 划定） |
| 主文字 | #09090b | #fafafa | `text-foreground` | 正文、标题、输入内容。从不使用纯黑 |
| 次要文字/禁用 | #71717a | #a1a1aa | `text-muted-foreground` | 辅助说明、placeholder、禁用态文字 |
| 次要背景 | #f4f4f5 | #27272a | `bg-muted` `bg-secondary` | 需要填充区分层的区域 |
| 边框/分割线 | #e4e4e7 | #27272a | `border-border` | 输入框、卡片、分割线、侧栏右边框 |
| 悬停底色 | #f4f4f5 | #27272a | `bg-accent` | 按钮、卡片、侧栏项的悬停底色 |
| 主交互色 | #18181b | #fafafa | `text-primary` `bg-primary` `border-primary` | 主按钮、激活态；`bg-primary` 上配 `text-primary-foreground` |
| 品牌橙 | #e8590c | #f97316 | `text-brand` `bg-brand`（配 `text-brand-foreground`） | 仅 Logo/品牌识别（`.logo-text` 渐变）。不进入交互系统 |
| 焦点环 | #18181b | #d4d4d8 | `ring-ring` | 键盘导航焦点可见性（reka-ui 组件内置 focus 管理） |
| 圆角基准 | — | — | `--radius: 0.5rem` | `rounded-sm`/`rounded-md`/`rounded-lg` 由此推导 |

### Semantic（状态反馈色矩阵）

每个状态色都配 `*-foreground` 文字配对色与可选的 `*-strong` 深色变体，确保任意场景下文字对比度满足 WCAG 2.1 AA（normal text ≥ 4.5:1，large text ≥ 3:1）。

| 语义 | 浅色 | 暗色 | Tailwind Utility | foreground | 使用范围 |
|------|------|------|-----------------|------------|---------|
| 错误/危险 | #dc2626 | #ef4444 | `text-destructive` `bg-destructive` `text-error`（兼容别名） | `text-destructive-foreground` (#fff / #fff) | 错误提示、删除按钮、危险操作 |
| 成功 | #16a34a | #22c55e | `text-success` `bg-success` | `text-success-foreground` (#fff) | 复制确认、校验通过、成功 Toast |
| 信息 | #2563eb | #3b82f6 | `text-info` `bg-info` | `text-info-foreground` (#fff / #fff) | 中性提示、帮助气泡、链接说明 |
| 警告 | #d97706 | #f59e0b | `text-warning` `bg-warning` | `text-warning-foreground` (#fff) | 非破坏性警告、兼容性提示 |

### WCAG 2.1 AA 对比度约束

**核心原则：** 凡承载正常文字（< 18px 或 < 14px bold）的彩色背景，必须使用对应的 配对的 `*-foreground` 或满足 4.5:1 对比度。base 色相（`primary`/`success`/`warning`）保留识别度，用于图标、大标签（≥ 18px）、装饰、边框——这些场景仅需 3:1（large text AA）。

| 组合 | 对比度 | 等级 | 适用 |
|------|--------|------|------|
| `text-foreground` 对 `bg-background` | ≈19:1 | AAA | 正文（两主题均顶级） |
| `text-muted-foreground` 对 `bg-background` | 4.6:1 | AA | 辅助文字（暗色侧 7.4:1 AAA；边界值，勿叠多层） |
| `text-primary-foreground` 对 `bg-primary` | ≈16:1 | AAA | 主按钮文字 |
| `text-white` 对 `bg-destructive` | 4.8:1 | AA | 错误按钮 |
| `text-white` 对 `bg-info` | 5.2:1 | AA | 信息按钮 |

> success / warning 的白字配对对比度处于 AA 边界附近，仅用于图标与大字号文字；新增大面积用法前先实测对比度。

### 品牌橙使用边界

全局**不设渐变令牌**。橙色渐变仅存在于一处：`.logo-text`（Logo 艺术字，135° 品牌橙→亮橙，`background-clip: text`，定义于 `global.css`）。UI 状态与组件不使用渐变、不使用品牌橙；功能性预览图案（如透明底棋盘格）可使用自定义 `bg-[image:...]`，不属品牌色范畴。

---

## 3. Typography

**The One Family Rule.** `font-sans`（Noto Sans SC）覆盖除代码外的所有文字。标题与正文的层级差异由字号和字重产生，不引入第二套无衬线字体。

| 角色 | 字体 | Tailwind class | 使用场景 |
|------|------|---------------|---------|
| Dashboard Title | Noto Sans SC | `font-sans font-semibold text-2xl leading-tight` | 首页标题，页面唯一 |
| Tool Title | Noto Sans SC | `font-sans font-semibold text-xl leading-tight` | 工具页标题 |
| Body | Noto Sans SC | `font-sans font-normal text-base leading-normal` | 描述、标签、通用文字。最大行宽 65–75ch |
| Label | Noto Sans SC | `font-sans font-medium text-[0.8125rem]` | 按钮文字、字段标签、卡片描述、筛选芯片 |
| Sidebar Heading | Noto Sans SC | `font-sans font-semibold text-xs uppercase tracking-wider text-muted-foreground` | 侧栏分组标题 |
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

Flat by default。深度通过 tonal layering 传达：`bg-card` 坐落在 `bg-background` 上（两主题均同值，边界由 `border-border` 划定），悬停态切换为 `bg-accent`。投影仅用于需要从背景浮出的功能性浮层。

**The Minimal Shadow Rule.** 静态内容区域不使用投影。投影仅用于浮层组件（下拉菜单、Toast 通知、弹出面板）和工具卡片悬停态，且必须保持 imperceptible（`shadow-sm` 或 `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`）。内容卡片、按钮、输入框等常规元素不使用投影。

**Dark Mode: Supported（2026-07 起）。** 中性浅色为默认，含三态 `system` 模式；暗色通过 `.dark` 组 token 实现（见 §Colors），由 Header 主题菜单切换（浅色/暗色/跟随系统，`themeStore`，选择持久化于 localStorage）。全局壳层（Header/Sidebar/Toast/卡片）与所有消费语义 token 的组件自动适配；**不使用 token 而硬编码颜色的组件在暗色下属于缺陷**，应改消费 token。个别工具的暗色对比度深度校验为持续跟进项，发现具体问题进行具体修复。

---

## 5. Components

组件精确而克制。边框定义形状，padding 留出呼吸空间，状态切换统一 150ms ease。每个可交互元素都有 hover 响应。每个聚焦输入框都获得 `border-primary`。主要操作按钮应覆盖 complete 状态矩阵（default / hover / active / disabled），辅助组件（开关、选择器等）至少覆盖 default / hover。

### Buttons

| 状态 | Primary | Ghost |
|------|---------|-------|
| Default | `bg-primary text-white rounded-sm px-4 py-2` | `bg-card text-foreground border border-border rounded-sm px-4 py-2` |
| Hover | 不变色 | `hover:bg-accent` |
| Focus | 无（按钮不显示 focus 样式） | 同 Primary |
| Active (pressed) | `active:brightness-90` | `active:bg-accent/80` |
| Disabled | `opacity-50 cursor-not-allowed`（覆盖所有状态） | 同 Primary |
| Copied | — | Ghost 按钮 `border-success text-success` 持续 1.5s，显示"已复制" |

- **Primary**：每工具页面唯一主操作（编码、解码、生成）。
- **Ghost / Outline**：复制按钮、清空按钮、示例按钮、非活跃模式标签。

### Filter Chips

| 状态 | Class |
|------|-------|
| Default | `bg-card border border-border rounded-lg px-4 py-1 text-muted-foreground` |
| Active | `bg-primary text-white rounded-lg px-4 py-1`（border 随 bg 同色） |
| Hover（inactive） | `hover:bg-accent hover:text-foreground` |
| Disabled | `opacity-50 cursor-not-allowed pointer-events-none` |

### Category Chips（全局筛选，CSS 组件）

Pill 形状（`rounded-full`），`border: 1.5px solid transparent`，活跃态 `bg-foreground text-background`（反转），过渡 `background-color 0.15s, color 0.15s, border-color 0.15s`。

### Tool Cards

| 状态 | Class |
|------|-------|
| Default | `bg-card border border-border rounded-lg p-6` |
| Hover | `hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| Focus | 无（卡片不显示 focus 样式） |

Content 结构：icon（emoji, 1.75rem）左 + name（`font-semibold text-[0.9375rem]`）和 description（`text-[0.8125rem] text-muted-foreground`）右。

### Category Cards（首页分类入口）

状态矩阵复用 Tool Cards（零 JS 纯展示，整卡 `<a href="/{slug}">`）。

| 状态 | Class |
|------|-------|
| Default | `bg-card border border-border rounded-lg p-6` |
| Hover | `hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]`，图标 `group-hover:scale-110`，标题 `group-hover:text-primary` |

Content 结构：顶行 icon（emoji, 2rem）左 + 工具数徽标（`bg-accent text-muted-foreground rounded-full`）右；底行 name（`text-lg font-semibold`）+ description（`text-sm text-muted-foreground`）。

### Inputs / Textareas

| 状态 | Class |
|------|-------|
| Editable | `bg-card text-foreground border border-border rounded-sm px-4 py-2 font-mono text-sm` |
| Read-only | `bg-accent text-foreground border border-border rounded-sm px-4 py-2 font-mono text-sm` |
| Focus | `focus:border-primary focus:outline-none`，无 glow |
| Disabled | `bg-background opacity-60 cursor-not-allowed` |
| Error | 输入框 `border-error`；下方显示 `text-[0.8125rem] text-error` 错误消息 |

错误消息与输入框的间距：`mt-1`（4px）。

### Search Panel（首页搜索，reka-ui Command）

| 元素 | 描述 |
|------|------|
| Container | `<Command class="rounded-lg border shadow-sm">`（reka-ui Listbox） |
| Input | `CommandInput`：无边框无 outline，placeholder `text-muted-foreground`，v-model 实时过滤 |
| List | `CommandList` 常驻挂载、显隐由 reka-ui 管理；空态 `CommandEmpty`（文案「没有匹配的工具」） |
| Item | `CommandItem`：icon + 名称 + 描述两行；↑↓ 键盘高亮，Enter / 点击直达 `tool.path`（MPA 跳转） |

过滤逻辑（name/keywords/description 加权评分排序）由组件内 computed 实现——reka-ui 不提供内置 filter。

### Sidebar Navigation

| 元素 | Class |
|------|-------|
| Container（桌面） | `hidden lg:flex w-60 shrink-0 border-r border-border bg-card flex-col`（静态 flex 列，无 `fixed`） |
| Container（移动） | Sheet 抽屉（reka-ui Dialog）：`<SheetContent side="left" class="w-72 p-0">`，标题「工具导航」，显隐由 `sidebarStore.isOpen` 驱动 |
| Nav scroll | `flex-1 sidebar-nav-scroll overflow-y-auto py-2`（导航区独立滚动，隐藏滚动条见 §Sidebar Scroll） |
| 分类项 | `flex items-center gap-2 px-4 py-2.5 text-sm`，整项 `<a href="/{slug}">`（仅 7 个分类，不再展开工具链接） |
| 分类图标 | `text-base w-6 text-center shrink-0`（emoji，来自 `categories.ts`） |
| 工具数徽标 | `inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-[0.6875rem] font-medium rounded-full bg-muted text-muted-foreground tabular-nums` |
| Active 分类 | `bg-accent text-primary font-medium`（当前路径前缀匹配 `/{slug}` 或恰好等于 `/{slug}`） |
| Hover | `hover:bg-accent` |
| Overlay（移动） | Sheet 内置遮罩，点击遮罩或 Esc 关闭（reka-ui Dialog 原语行为，无需手写 overlay） |

### Header

| 元素 | Class |
|------|-------|
| Container | `flex items-center justify-between px-6 py-2 border-b border-border bg-card h-[57px] shrink-0`（通栏，作为 `#app` flex 子项天然钉顶，无需 `sticky`） |
| Layout | 左侧（汉堡按钮 mobile-only + Logo 全断点常驻）+ 中部（快捷入口 ≥lg）+ 右侧（暗色模式 · Gitee · GitHub） |
| Logo | `group flex items-center gap-1.5 text-lg font-semibold`，全断点常驻；图标 `text-violet-600`，hover `-rotate-12` |
| 汉堡按钮 | `hidden max-lg:flex`，三条 2px 横线，宽 18px，点击调用 `sidebarStore.toggle()` |
| 快捷入口 | `hidden lg:flex` 的 `<nav aria-label="常用工具">`（清单数据驱动于 `src/data/quick-links.ts`，≤6 个）；项为 `px-2 py-1 rounded-sm text-sm` 图标+名称，激活态与 Sidebar 激活分类同款 `bg-accent text-primary font-medium`，hover `bg-accent`，150ms 过渡 |
| 暗色模式按钮 | `flex items-center gap-1.5 h-9 px-2` 文本 + 图标，点击调用 `themeStore.toggle()` 切换浅色/暗色（持久化于 localStorage） |
| Gitee / GitHub | 纯图标链接（simple-icons SVG），`target="_blank" rel="noopener noreferrer"` |

### Tool Header

| 元素 | Class |
|------|-------|
| Layout | `flex justify-between items-start`，标题 + 描述 左，示例按钮 右 |
| Title | `font-semibold text-xl` |
| Description | `text-sm text-muted-foreground mt-1` |
| Example button | Ghost 风格，`hover:border-primary` |

### Footer

居中堆叠三行布局（版权 / 链接 / 备案），位于内容列底部、`main` 之后，随内容滚动（非 `fixed`/`sticky`）。

| 元素 | Class |
|------|-------|
| Container | `bg-card border-t border-border px-6 py-5` |
| 内容包裹 | `max-w-3xl mx-auto flex flex-col items-center gap-2 text-center` |
| 版权行 / 链接行 / 备案行 | `text-[0.8125rem] text-muted-foreground`，链接 `hover:text-primary` |
| 备案行 | ICP / 公安备案号通过组件顶部 `SITE` 常量配置，留空则不渲染；公安备案前缀盾牌图标（内联 SVG 占位，未来替换为官方国徽） |

### Toast（vue-sonner）

全局由 Shell 挂载 `<Toaster />`（vue-sonner，top-center）。任意组件经 `toastStore.show/success/error(message)` 触发（AGENTS.md：禁止自建 toast 队列）；toastStore 以镜像计时（默认 3000ms）与 sonner 内部 duration 保持出列一致。样式由 sonner 主题消费语义 token，不自绘容器。

### ResponsiveWorkspace

统一封装工具页面宽度约束和布局模式的容器组件。

| 模式 | 最大宽度 | 布局 | 适用场景 |
|------|---------|------|---------|
| `vertical`（默认） | `max-w-[720px]` | `flex flex-col` | 单列输入→输出流 |
| `horizontal` | `max-w-[1600px]` | `grid grid-cols-1 lg:grid-cols-2` | 左右双栏（输入+输出并排） |

组件通过 `mode` prop 控制模式。内容通过默认 slot 传入，`#input` 和 `#output` 具名 slot 可选用于水平模式下的左右分栏。

### OptionRadioGroup

基于 reka-ui RadioGroup 的单选按钮组组件，用于在一组互斥选项中选择一个（如哈希算法选择、输出格式选择）。

| 元素 | 描述 |
|------|------|
| 容器 | `flex flex-wrap gap-2` 横向排列 |
| 选项按钮 | `px-3 py-1.5 rounded-sm border border-border text-sm`，默认 `text-muted-foreground bg-card` |
| 选中态 | `bg-primary text-white border-primary` |
| Hover | `hover:bg-accent` |

### CodePanel

统一的代码面板组件，用于显示格式化后的代码输出、转换结果等。支持标题栏和操作按钮。

| 元素 | 描述 |
|------|------|
| 容器 | `bg-accent border border-border rounded-sm overflow-hidden` |
| 标题栏 | `flex items-center justify-between px-4 py-2 border-b border-border bg-card` |
| 代码区域 | `p-4 font-mono text-sm overflow-auto whitespace-pre-wrap break-all` |

### Sidebar Scroll

侧栏导航区域的滚动条隐藏样式，通过 `.sidebar-nav-scroll` 类名应用。在保持滚动功能的同时隐藏原生滚动条，通过 `scrollbar-width: none` 和 `::-webkit-scrollbar { display: none }` 实现。

---

## 6. Do's and Don'ts

### Do:
- **Do** focus the main input field on page load so the user can start typing immediately.
- **Do** show results in real-time as the user types, with no submit button required (unless the operation is destructive or slow).
- **Do** consume semantic tokens (`bg-background`, `bg-card`, `bg-accent`) instead of hardcoded colors — hardcoded colors break dark mode.
- **Do** use `text-primary` as the main interactive color (zinc-900); keep the brand orange (`--brand`) exclusive to the Logo.
- **Do** cap code field body text at 65 to 75ch for readability.
- **Do** use 150ms ease transitions for all state changes (`transition-[border-color]` etc.). Fast enough to feel responsive, slow enough to perceive.
- **Do** keep standard tool pages self-contained at max-width 720px; wide tools (JSON, editors, diffs) may extend to 1600px with dual-column layout for code editing/comparison.
- **Do** respect prefers-reduced-motion by setting transition durations to 0ms.

### Don't:
- **Don't** use a dark theme with blue/cyan neon accents. This is the first training-data reflex for "dev tools" and it is prohibited.
- **Don't** use glassmorphism, gradient text (background-clip: text), or side-stripe borders greater than 1px as colored accents.（唯一例外：Logo 艺术字 `.logo-text`）
- **Don't** add login walls, onboarding flows, multi-step wizards, or loading spinners. From PRODUCT.md anti-references: forced login, complex flows, and anything that makes the user wait are prohibited.
- **Don't** use `accent` as a background fill for large areas (`bg-primary` on full-width sections). It is a signal, not a surface.
- **Don't** add shadows to resting content areas. The tool card `hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` and floating layer components (dropdowns, toasts) are exceptions.
- **Don't** animate layout properties or add ambient/choreographed animations. Motion serves feedback only.
- **Don't** use identical card grids with the same-sized cards repeated endlessly without visual differentiation.
- **Don't** introduce a second sans-serif font family. `font-sans` handles everything except code; `font-mono` handles code.
- **Don't** use `transition-colors` when a specific property works — prefer `transition-[border-color]`, `transition-[background-color]` for precise control.
- **Don't** treat dark mode as an afterthought — every new component must be checked against the `.dark` token set（见 §4 Dark Mode）。
