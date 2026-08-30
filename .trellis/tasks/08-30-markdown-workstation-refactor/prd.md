# Markdown 编辑器独立工作台重构

## Goal

将现有普通工具页 `/devops/markdown-editor` 升级为**完全独立的专属页面 `/markdown`**：
自成一体的全屏 Markdown 工作台应用——不使用站点 Layout.astro、不渲染任何站点壳层（Header/Sidebar/Footer/面包屑）、
不渲染 FAQ 或营销介绍内容——内核替换为 md-editor-v3，能力密度与形态和站内普通工具明显区分，形成竞争力。

## 已确认决策（用户拍板）

| 决策项 | 结论 |
|--------|------|
| Trellis 任务 | 创建（本任务），走完整规划流程 |
| 编辑器内核 | **md-editor-v3**（Vue3 原生：分栏/预览/工具栏/目录/图片粘贴/mermaid/katex/暗色/导出） |
| 页面定位 | **独立一级页 `/markdown`**，旧 URL 301 |
| 页面形态（2026-08-30 修订） | **完全独立**：不用 Layout.astro，无 Shell 壳层、无 FAQ、无介绍内容；`markdown.astro` 即完整文档，全屏应用式 |
| 多文档草稿箱 | 用户未答，按推荐档默认执行（localStorage 多文档管理）；批准时可否决降级为单文档 |
| Header 快捷入口 | 用户未答，按推荐默认纳入第 6 位（≤6 预算内） |
| 功能底线（2026-08-30 拍板） | **至少 编辑 / 分栏 / 预览 三视图模式 + mermaid 支持**（md-editor-v3 原生覆盖，选型经复审维持） |
| MDX / x-markdown | 已澄清：MDX 是内容格式非编辑器；Vue 生态无 x-markdown，实际候选为 md-editor-v3 / Vditor / Milkdown |

## Confirmed Facts（代码证据）

- 现状组件 `src/tools/devops/MarkdownEditor.vue`（587 行）：textarea + 自研 `renderMarkdown`（marked）+ Prism 高亮
  + 6 个工具栏按钮 + 导出 md/html/pdf（`src/utils/editor/`）。无自动保存、无图片粘贴、无目录、无 mermaid/公式。
- 注册表 `src/data/tools.ts:357` 条目 `markdown-editor`，`path: '/devops/markdown-editor'`；
  FAQ 在 `src/data/tool-faqs.ts:177`（页面无 FAQ 后成为死数据，需删除该键）。
- **保留注册条目、仅把 `path` 改为 `/markdown`**：分类页卡片（`getToolsByCategory`）、全局搜索（`SearchPanel` 直查
  `tools`）、相关工具、Sidebar 徽标全部经 `path` 取链接，零改动生效（注册表仅是元数据/入口，不影响页面独立性）。
- sitemap 过滤（`astro.config.mjs:53`）：单段路径白名单仅 7 分类 slug → **必须把 `/markdown` 加入白名单**。
- 301 机制：`astro.config.mjs` `redirects` 补 `/devops/markdown-editor → /markdown`，删除旧路由文件。
- Layout.astro 目前承载：SEO head、Shell 岛（Header/Sidebar/Toaster/主题切换）、全局样式、Footer。
  **独立页需自含**：global.css 令牌引入、`themeStore.load()` 初始化、vue-sonner `<Toaster />` 挂载、
  主题三态切换控件（岛内顶栏）。
- localStorage 目前仅 theme store 使用；多文档草稿为新持久化模式，需定义 key 规范。
- 依赖影响（实施核实修正）：`marked` 唯一消费方是 `utils/editor/markdown-export.ts`（HTML 导出渲染），
  JsonFormatter.vue 并不使用 marked；`prismjs` 除旧渲染链外还有第二消费方 JsonFormatter.vue
  （直接 import Prism），**渲染链删除后 prismjs 必须保留**。

## Requirements

- R1 **完全独立页面**：`src/pages/markdown.astro` 自成完整 HTML 文档，不 import Layout.astro/ToolLayout；
  全屏 100vh 工作台，无站点壳层、无 FAQ、无介绍/营销内容；仅保留 `<head>` 内不可见 SEO 元数据
  （title/description/keywords/canonical/SoftwareApplication JSON-LD）。
- R2 **工作台能力**（md-editor-v3）：**三视图模式——仅编辑 / 分栏 / 仅预览**（顶栏切换）、完整工具栏、目录大纲、
  图片粘贴与拖拽（FileReader 转 base64 内联，无上传后端）、mermaid、katex、导入 .md 文件、导出 md/html/pdf。
- R3 **自含壳层能力**：岛内顶栏提供主题三态切换（复用 `themeStore`，含 `load()` 初始化）、文档操作
  （新建/导入/导出/文档列表开关）；岛内挂载 `<Toaster />` 供 toastStore 正常弹通知。
- R4 **多文档草稿箱**：localStorage 多文档（新建/切换/重命名/删除）+ 自动保存，刷新/关闭后恢复。
- R5 **入口与迁移**：注册表 path → `/markdown`；旧 URL 301；sitemap 收录（priority 0.9）；Header 快捷入口第 6 位。
- R6 **依赖清理**：移除被替代的自研渲染链（markdown-renderer / markdown-toolbar / 旧组件 / 旧路由），
  主包 gzip 不增长（编辑器独立 chunk）。**prismjs 保留**（实施核实：JsonFormatter.vue 直接 import Prism，
  为渲染链之外的第二消费方）。

## Acceptance Criteria

- [ ] `/markdown` 渲染全屏工作台：产物 HTML 中无站点 Header/Sidebar/Footer/FAQ/介绍内容；`<head>` 元数据完整
- [ ] `/devops/markdown-editor` 301 → `/markdown`；`/markdown` 在 sitemap 中
- [ ] 编辑内容刷新后自动恢复；多文档可新建/切换/重命名/删除
- [ ] 仅编辑 / 分栏 / 仅预览三模式切换正常；预览模式下 mermaid/katex 正确渲染
- [ ] 粘贴/拖拽图片以 base64 内联；页面内主题三态切换生效且持久（localStorage）
- [ ] toast 在独立页内正常弹出（Toaster 自含）
- [ ] `pnpm build` / `pnpm test` / `pnpm astro check` 全绿；主包 gzip 相对 46841c1 零增长
- [ ] 自研渲染链删除后无残留引用；prismjs 保留（JsonFormatter 依赖）；`tool-faqs.ts` 无 `markdown-editor` 死键

## Out of Scope

- 协作编辑、账号体系、云端同步、分享链接（无后端原则）
- 图片上传到远端（浏览器端 base64 内联）
- 场景模板库（README/周报等，列为二期增强）
- 独立页上的相关工具推荐、面包屑等站点化元素

## Open Questions

（无阻塞项；多文档草稿箱与快捷入口为推荐默认值，用户批准摘要时可否决）
