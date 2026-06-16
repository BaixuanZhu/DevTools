# UI 样式细节优化设计文档

> 范围：侧边栏、布局架构、底部版权、Focus 样式统一  
> 原则：不做大幅度调整，仅做细节优化，保持简洁

---

## 1. 布局架构调整

### 目标
将侧边栏提升为独立的左侧面板，从页面顶部贯穿到底部，右侧区域包含 Header、内容区、Footer。

### 变更前
```
┌─────────────────────────────────────┐
│ Header (full width)                 │
├──────────┬──────────────────────────┤
│ Sidebar  │ Content                  │
│ (240px)  │                          │
├──────────┴──────────────────────────┤
│ Footer (full width)                 │
└─────────────────────────────────────┘
```

### 变更后
```
┌──────────┬──────────────────────────┐
│ Logo     │ Header (fixed)           │
│ (fixed)  ├──────────────────────────┤
├──────────│ Breadcrumb               │
│ 分类标题 │                          │
│ 工具链接 │ Content                  │
│          │  (scrollable)            │
│          │                          │
│          │                          │
│          ├──────────────────────────┤
│          │ Footer (scrollable)      │
└──────────┴──────────────────────────┘
```

### 具体调整

| 元素 | 变更 |
|------|------|
| Sidebar | `position: fixed; left: 0; top: 0; bottom: 0; width: 240px;` |
| Sidebar 顶部 | 新增 Logo + "DevTools" 品牌区，点击回首页 |
| Header | 固定定位 `sticky top-0`；移除 Logo，保留功能按钮区 |
| Footer | 不固定，随内容自然滚动 |
| 右侧区域 | `margin-left: 240px`，内部为 Header → Content → Footer 垂直堆叠 |
| 移动端 | Sidebar 仍为抽屉式，从左侧滑出，overlay 覆盖内容区 |

### 关键代码变更点
- `ToolLayout.astro`：重构整体 grid/flex 结构
- Sidebar `<aside>`：改为 fixed 定位，增加 Logo 区域
- Header：移除 `<a href="/">` Logo 块
- `<main>` 和 `<Footer />`：增加 `ml-[240px]` 或等效偏移

---

## 2. 侧边栏（Sidebar）优化

### 2.1 去除滚动条

```css
.sidebar {
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;     /* IE/Edge */
}
.sidebar::-webkit-scrollbar {
  display: none;                /* Chrome/Safari */
}
```

### 2.2 去除 Active 项的右边框

**变更前：**
```
bg-hover text-accent font-medium border-r-2 border-accent
```

**变更后：**
```
bg-hover text-accent font-medium
```

仅通过背景色（`bg-hover`）和文字颜色（`text-accent`）区分 active 状态，去掉 `border-r-2` 的物理分割线，更简洁。

### 2.3 Logo 区域（新增，固定顶部）

Sidebar 内部分为两层：
- **顶部固定区**：Logo 品牌区（`position: sticky; top: 0; z-index: 10`）
- **下方滚动区**：分类导航列表

```
┌──────────────────┐  ← sticky top, z-10
│ </>  DevTools    │  ← 点击回首页
├──────────────────┤  ← border-b border-border
│ 文本处理         │  ← scrollable area starts
│ 🔑 UUID 生成器   │
│ ...              │
│                  │
└──────────────────┘
```

- Logo 区高度：`h-[57px]`，与右侧 Header 同高，视觉对齐
- Logo 区背景：`bg-card`
- 底部分割线：`border-b border-border`
- Logo hover：`hover:text-accent transition-[color] duration-150`
- **移除原有的"首页"导航项**，点击 Logo 直接回首页

### 2.4 移动端适配

- Sidebar 抽屉高度：`h-screen`（占满全屏高度）
- 顶部需包含关闭按钮（或点击 overlay 关闭）
- Logo 区域在移动端同样显示

---

## 3. Focus 样式统一

### 原则
**仅输入框保留 focus 视觉反馈，其余所有交互元素（按钮、链接、切换开关、Tab）全部移除 focus ring/outline。**

### 3.1 需要移除 focus 样式的元素

| 组件/元素 | 当前 focus 样式 | 操作 |
|-----------|----------------|------|
| `ModeTabGroup` 按钮 | `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` | 移除 |
| `ToggleSwitch` | `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` | 移除 ring，保留 `focus:outline-none` |
| `CopyButton` | 无 | 保持无 |
| `ClearButton` | 无 | 保持无 |
| Sidebar 链接 | 无 | 保持无 |
| Footer 链接 | 无 | 保持无 |
| Header 按钮/链接 | 无 | 保持无 |
| 分类筛选 chip | `box-shadow: 0 0 0 2px ... 0 0 0 4px var(--color-accent)` | 移除 |

### 3.2 保留 focus 样式的元素

| 组件/元素 | 保留样式 |
|-----------|---------|
| `input` / `textarea` | `focus:border-accent focus:outline-none` |
| SearchBar | `focus-within:border-accent`（容器聚焦态） |

### 3.3 代码变更点

- `ModeTabGroup.vue`：移除 `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`
- `ToggleSwitch.vue`：移除 `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`
- `global.css` `.chip:focus-visible`：移除整个规则块
- `ToolLayout.astro`：检查 Header 按钮、Sidebar 链接是否需要显式声明 `focus:outline-none` 以防止浏览器默认 outline

---

## 4. 底部版权（Footer）丰富化

### 目标
保持简洁的前提下，丰富 Footer 的信息层次和实用性。

### 设计

```
┌────────────────────────────────────────────────────────────┐
│  © 2026 DevTools                    关于 · GitHub · 反馈   │
│  基于 Astro + Vue 构建                                      │
└────────────────────────────────────────────────────────────┘
```

#### 第一行（主行）
- **左侧**：`© {year} DevTools. All rights reserved.`（保持现有）
- **右侧**：链接组
  - `关于` → 指向首页 `/`
  - `GitHub` → 仓库外链
  - `反馈` → 外链或 toast 提示"功能开发中"
- 链接样式：`text-[0.8125rem] text-muted hover:text-accent transition-[color] duration-150`

#### 第二行（次行，可选）
- **左侧**：`v{version} · Astro + Vue 3`（技术栈标签）
- 样式：`text-xs text-muted/70`
- 如果版本号获取不便，可省略此行，仅保留第一行

### 响应式
- 移动端：两列变单列居中堆叠

### Props 变更

Footer.astro 当前已有 `icp?: string` prop，保持兼容。新增链接为硬编码（站点级链接，不随页面变化）。

---

## 5. 文件变更清单

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `src/layouts/ToolLayout.astro` | 重构 | 布局架构改为 Sidebar 全高独立面板 |
| `src/components/layout/Footer.astro` | 修改 | 丰富内容结构，增加链接组 |
| `src/components/ui/ModeTabGroup.vue` | 修改 | 移除 focus-visible ring |
| `src/components/ui/ToggleSwitch.vue` | 修改 | 移除 focus-visible ring |
| `src/styles/global.css` | 修改 | 移除 chip focus-visible；增加 sidebar 滚动条隐藏 |
| `src/components/ui/CopyButton.vue` | 可选 | 如已有 outline，确认移除 |
| `src/components/ui/ClearButton.vue` | 可选 | 如已有 outline，确认移除 |

---

## 6. 设计原则检查

- ✅ 不做大幅度调整 — 仅布局微调 + 样式细节
- ✅ 保持简洁 — 去边框、去滚动条、去多余 focus
- ✅ 搜索栏保持在首页 — Header 中不出现搜索
- ✅ Header 固定 — 全局功能按钮始终可达
- ✅ Footer 不固定 — 随内容自然滚动，避免底部空白
- ✅ Sidebar 内部分层 — 顶部 Logo 区固定，下方导航可滚动
- ✅ Logo 即首页入口 — 移除独立的"首页"导航项
- ✅ 符合 DESIGN.md 现有规范 — 颜色/字体/间距令牌不变
- ✅ 移动端行为兼容 — Sidebar 抽屉逻辑保持不变
