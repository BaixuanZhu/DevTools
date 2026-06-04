# Design System: DevTools

> 本文档定义视觉和交互规范。产品行为原则见 PRODUCT.md。

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

## 2. Design Tokens

所有令牌在 `src/styles/global.css` 的 Tailwind v4 `@theme` 块中定义，是样式系统的唯一真相源。本节是令牌的语义文档，不重复定义值。

### Colors

**The Shelf Rule.** 中性色承载 90% 的面。`accent`（#e8590c）仅出现在交互元素的活跃态：聚焦输入框、活跃标签页、选中筛选、悬停 Logo。稀缺即力量。任一屏幕超过 10% 的橙色即为异常。

| 设计语义       | 色值       | Tailwind Utility            | 使用范围 |
|---------------|-----------|----------------------------|---------|
| 页面底色       | #faf9f7  | `bg-surface`               | 所有页面的 `<body>` 底色 |
| 卡片/Header 底 | #ffffff  | `bg-card`                  | 卡片、Sidebar、Header、Footer 的背景 |
| 主文字         | #1a1a1a  | `text-text`                | 正文、标题、输入内容。从不使用纯黑 |
| 次要文字/禁用   | #6b7280  | `text-muted`               | 辅助说明、placeholder、侧栏分组标题、禁用态文字 |
| 边框/分割线     | #e5e2dd  | `border-border`            | 输入框、卡片、分割线、侧栏右边框 |
| 强调色         | #e8590c  | `text-accent` `bg-accent` `border-accent` | 仅交互元素活跃态。从不作为大面积底色 |
| 悬停底色        | #f3f1ee  | `bg-hover`                 | 按钮、卡片、侧栏项的悬停底色，比 `surface` 深一阶 |
| 错误文字        | #dc2626  | `text-error`               | 仅文字，不做底色 |
| 成功文字        | #16a34a  | `text-success`             | 仅文字，不做底色（如复制确认） |

### Typography

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

令牌值定义于 `global.css`，组件通过 Tailwind 的间距 utility 消费。以下是语义映射：

| 令牌 | 值 | Tailwind 等价 | 使用场景 |
|------|-----|-------------|---------|
| xs | 4px | `gap-1` / `p-1` | 组件内部微间距（图标与文字之间） |
| sm | 8px | `gap-2` / `p-2` | 表单元素间距、按钮内 padding 的一半 |
| md | 16px | `gap-4` / `p-4` | 标准内边距、按钮 padding（`px-4`） |
| lg | 24px | `gap-6` / `p-6` | 卡片内边距 |
| xl | 32px | `gap-8` | 区块之间的间距 |
| 2xl | 48px | `gap-12` | 大区块分隔 |

### Responsive Breakpoints

| 名称 | 断点 | 布局行为 |
|------|------|---------|
| mobile | < 768px | 单列布局，Sidebar 隐藏为抽屉，Header 显示汉堡按钮 |
| tablet | 768px – 1023px | 单列但加宽，Sidebar 仍为抽屉 |
| desktop | ≥ 1024px | Sidebar 常驻（240px），内容区自适应 |

> 当前实现以 `1024px` 为 Sidebar 常驻/抽屉的分界线，对应 Tailwind 的 `lg` 断点。

### Transitions

所有可交互元素的状态切换使用 `duration-150`（150ms），感知为即时反馈但又有可感知的过渡。

**规则：始终使用具体属性名**，如 `transition-[border-color] duration-150`、`transition-shadow duration-150`。

禁止使用 `transition-colors`——它会过渡所有颜色属性（`background-color`、`color`、`border-color`），可能触发意外的重绘或视觉抖动，且无法控制过渡的具体属性。

尊重 `prefers-reduced-motion`：在该偏好下所有 transition duration 设为 `0ms`。

---

## 3. Elevation

Flat by default。深度通过 tonal layering 传达：`bg-card`（#ffffff）坐落在 `bg-surface`（#faf9f7）上，悬停态切换为 `bg-hover`（#f3f1ee）。无投影。唯一的投影是工具卡片的悬停微提：`hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]`。

**The No-Shadow Rule.** 静态元素禁止投影。如需"浮起"感，使用不同的中性色阶（card on surface）。工具卡片 hover shadow 是唯一例外，且必须保持 imperceptible。

**Dark Mode: Not Supported.** 当前设计有意只支持暖调浅色主题。warm-ivory 底色是刻意的设计身份标识，不做暗色模式。如未来需要支持，应作为独立项目在 PRODUCT.md 中声明后再启动。

---

## 4. Components

组件触感明确。边框定义形状，padding 留出呼吸空间，状态切换统一 150ms ease。每个可交互元素都有 hover 响应。每个聚焦输入框都获得 `border-accent`。

### Buttons

| 状态 | Primary | Ghost |
|------|---------|-------|
| Default | `bg-accent text-white rounded-sm px-4 py-2` | `bg-card text-text border border-border rounded-sm px-4 py-2` |
| Hover | 不变色 | `hover:bg-hover` |
| Focus | `focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-1` | 同 Primary |
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

### Tool Cards

| 状态 | Class |
|------|-------|
| Default | `bg-card border border-border rounded-lg p-6` |
| Hover | `hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| Focus（键盘） | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30` |

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
| Container | `w-[240px] fixed bg-card border-r border-border` |
| Group headings | `font-semibold text-xs uppercase tracking-wider text-muted px-4 py-4 pb-1` |
| Nav links | `flex items-center gap-2 px-4 py-2` |
| Active link | `bg-hover text-accent border-r-2 border-accent` |
| Hover | `hover:bg-hover` |
| Mobile | slide-in from left，`bg-[rgba(0,0,0,0.3)]` backdrop，escape 关闭 |

### Header

| 元素 | Class |
|------|-------|
| Container | `h-[57px] fixed top-0 bg-card border-b border-border` |
| Layout | Logo 左 + SearchBar 右（`w-[280px]`） |
| Logo | `font-semibold text-[1.125rem]`，`hover:text-accent transition-[color] duration-150` |
| Mobile | 汉堡按钮替换 SearchBar，三条 2px 横线，宽 18px |

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
| Container | `bg-card border-t border-border` |
| Content | 居中，`text-[0.8125rem] text-muted`，链接 `hover:text-accent` |

### Toast Notification

| 元素 | Class |
|------|-------|
| Position | `fixed top-4 left-1/2 -translate-x-1/2 z-50` |
| Container | `bg-card border border-border rounded-md px-4 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)]` |
| Success | `border-success text-success` |
| Error | `border-error text-error` |
| Animation | `transition-[opacity,transform] duration-150`，入场 `opacity-0 → opacity-100`，1.5s 后自动消失 |

---

## 5. Composition & Layout

组件单独定义后，需要规则约束它们如何组合。

### 工具页面布局模板

```
┌─────────────────────────────────────┐
│ Header (fixed, h-57px)              │
├──────────┬──────────────────────────┤
│ Sidebar  │ Tool Header              │
│ (240px)  │ ├─ Title + Description   │
│          │ └─ Example Button        │
│          │                          │
│          │ Input Area               │
│          │ ├─ Label + Input/Textarea│
│          │ └─ Error Message (mt-1)  │
│          │                          │
│          │ Actions (gap-2)          │
│          │ ├─ Primary Button        │
│          │ └─ Ghost Buttons         │
│          │                          │
│          │ Output Area              │
│          │ └─ Readonly field        │
│          │                          │
│          │ Copy Button              │
├──────────┴──────────────────────────┤
│ Footer                              │
└─────────────────────────────────────┘
```

- 内容区最大宽度 `max-w-3xl`（720px），居中。
- Tool Header 与下方内容间距：`mt-6`（24px）。
- 输入区与操作按钮间距：`mt-4`（16px）。
- 操作按钮与输出区间距：`mt-4`（16px）。
- 多个 Ghost 按钮横向排列时使用 `gap-2`（8px）。

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
- **Don't** implement a dark theme. The warm-ivory light palette is a deliberate design identity; dark mode is not in scope.

---

## Appendix: Tailwind 实现映射

设计令牌通过 `src/styles/global.css` 的 `@theme` 块注入 Tailwind v4 命名空间。组件通过 utility class 消费，不使用 inline style 或独立的 scoped CSS。

### 样式分层

| 层级 | 位置 | 技术 | 职责 |
|------|------|------|------|
| 设计令牌 | `src/styles/global.css` | Tailwind v4 `@theme` 块 | 颜色/字体/圆角定义，唯一真相源 |
| 全局布局 | `src/layouts/` | Astro + Alpine + Tailwind | HTML 骨架、Sidebar、SearchBar、Toast |
| 工具组件 | `src/tools/` | Vue 3 岛屿 + Tailwind | 工具交互逻辑、输入/输出 UI |
| 共享组件 | `src/components/` | Astro 或 Vue + Tailwind | Footer、ToolCard、CopyButton 等 |
