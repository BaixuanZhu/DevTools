# aside / header / footer 通栏化重构设计

- **日期**：2026-06-30
- **方案**：A（应用外壳式）
- **唯一代码改动点**：`src/layouts/ToolLayout.astro`（含其 `<style>` 内移动端媒体查询）
- **同步文档**：`DESIGN.md`（§Header、§Sidebar Navigation、§Layout Principles）

## 1. 背景与目标

当前布局为「侧栏全高 + 右侧 header/main/footer」并列结构：

- `aside` 用 `fixed left-0 top-0 bottom-0 w-60` 占满左侧全高，**顶部内嵌一块 57px 的 Logo 区**（DevTools logo + 移动端关闭按钮）。
- 右侧区域用 `ml-60` 偏移，内部依次为 `header`（57px，含汉堡、移动端 logo、收藏夹/暗色/Gitee/GitHub）、`main`、`Footer`。
- 移动端（<1024px）`aside` 变成可滑出抽屉，由 Alpine `x-data` 控制 `sidebar-open` 并配 overlay。

目标改为「**顶部通栏 header + 下方左右分栏**」的 T 字形布局：

1. aside 的 Logo 集成进 header。
2. header 顶部通栏，横跨全宽。
3. aside 与内容左右布局，aside 桌面端保持纯静态（无 `fixed` 定位 hack）。
4. footer 位置不变（仍在内容列底部，不横跨 aside）。
5. 移动端保留可折叠抽屉（已与用户确认）。

## 2. 影响面

- **唯一代码改动点**：`src/layouts/ToolLayout.astro`。首页（`src/pages/index.astro`）与所有工具页共用此布局，改一处全站生效。
- **同步文档**：`DESIGN.md` 的 §Header、§Sidebar Navigation、§Layout Principles。
- `Layout.astro`、`Footer.astro` 不改动。

## 3. 新 DOM 骨架

```
#app  (h-dvh flex flex-col overflow-hidden)
├── header   ← 通栏，shrink-0，h-[57px]，横跨全宽
│     左侧: [汉堡 max-lg:flex] + [Logo 全断点常驻]
│     右侧: 收藏夹 · 暗色 · Gitee · GitHub
├── div  (flex-1 flex min-h-0)        ← 主体行
│     ├── aside  (w-60 shrink-0，纯静态，导航区独立滚动；移动端抽屉)
│     └── div   (flex-1 flex flex-col overflow-y-auto min-w-0)  ← 内容列
│           ├── main (flex-1)
│           └── Footer
├── mobile overlay
└── Toast
```

## 4. 具体改动

### A. Logo 统一进 header

- 删除 `aside` 顶部那块 57px 的 Logo 区（含其中的移动端关闭按钮）。
- 删除 `header` 内原「移动端 Logo（`lg:hidden`）」。
- `header` 左侧新增一个**全断点都显示**的 Logo，与汉堡并列：移动端为 `[汉堡][Logo]`，桌面端汉堡 `max-lg:hidden` 后自然只剩 `[Logo]`。
- 原 aside 里的关闭按钮去掉——移动端靠「再点汉堡 / 点 overlay / Esc」关闭已足够。

### B. header 通栏

- `header` 从右侧列提升到 `#app` 顶层，`shrink-0` 横跨全宽，保留 `h-[57px] bg-card border-b`。
- 去掉 `sticky`（外壳锁高，header 本就常驻顶部，无需吸顶）。

### C. aside 纯静态（桌面）

- 移除 `fixed left-0 top-0 bottom-0`，改为 `w-60 shrink-0 flex flex-col border-r bg-card`，高度由 flex 主体行自然撑满。
- 导航区保留 `flex-1 overflow-y-auto sidebar-nav-scroll`。
- 移动端抽屉逻辑（`x-data` 开关 + `:class="sidebar-open"` + `@keydown.escape`）**保留**。

### D. 内容列 + Footer

- 新增内容列 `div`：`flex-1 flex flex-col overflow-y-auto min-w-0`，作为唯一的内容滚动容器。
- `main` 去掉自身 `overflow-y-auto`，改 `flex-1`；`Footer` 紧随其后自然沉底，内容超长时随内容列滚到底显示。

### E. 移动端媒体查询调整（`<style>` 内）

- 抽屉 `aside` 仍 `position:fixed`，但 `top` 从 `0` 改为 `57px`、`height: calc(100dvh - 57px)`，从 header 下方滑出，保持 header 常驻可见。
- overlay 从 `57px` 下方开始，盖住内容区不盖 header。

### F. 外壳

- `#app` 设为 `h-dvh flex flex-col overflow-hidden`，避免整页出现外层滚动条。

## 5. 滚动与层级

- 桌面：header 与 aside 始终可见，仅内容列滚动；aside 导航过长时自身独立滚动。
- z-index：移动端抽屉 `z-100`、overlay `z-99` 维持；header 在外壳内常驻无需高 z；Toast `z-100` fixed 相对视口，不受影响。

## 6. 风险与验证

- **Astro SSG 容忍 Vue/Alpine 运行时差异**：build/check 通过不代表页面正常，必须 `pnpm dev` 浏览器实测。
- 验证清单：
  1. 桌面：header 通栏 + aside 静止 + 内容滚动 + footer 沉底。
  2. 移动端：汉堡开抽屉、overlay/Esc 关闭、header 常驻可见。
  3. `pnpm build` + `pnpm astro check` 通过。

## 7. 排除项（不在本次范围）

- 不改 Footer 内容与样式。
- 不改 Header 右侧按钮组的功能（收藏夹/暗色/Gitee/GitHub）。
- 不引入新的状态管理或依赖。
