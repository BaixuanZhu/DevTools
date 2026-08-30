# PC 端 Header 高频工具快捷入口

## Goal

在桌面分辨率下利用 Shell Header 中部空白区，展示固定精选的高频工具快捷入口，让高频工具（如图片转换与压缩）一键直达，缩短"想到工具 → 打开工具"的路径。移动端 Header 保持现状。

## Background

- 用户反馈：图片转换与压缩是高频工具，PC 端 Header 中部完全空白，希望利用起来放常用工具入口。
- 已确认决策：**固定精选列表**（非 localStorage 使用频率统计），清单以数据文件维护，随时可调整。
- Shell（`src/components/shell/Shell.vue`）是全局唯一壳层 island，Header 目前为：左（Logo + 移动端汉堡）+ 右（主题切换 + Gitee/GitHub），中部空白。
- Sidebar 断点为 lg（1024px），Header 快捷入口采用同一断点，保持"PC 形态"认知一致。

## Requirements

1. **展示位置与断点**：Header 中部区域（Logo 与右侧按钮组之间），`hidden lg:flex`——≥1024px 显示，<1024px 完全不渲染占位。
2. **清单内容**：4~6 个精选工具（建议首发 5 个：JSON 格式化、Base64 编解码、图片转换与压缩、日期时间转换器、正则表达式测试器，以实际 id 在数据文件中核对），每个入口展示图标 + 工具名。
3. **数据驱动**：新增 `src/data/quick-links.ts`，维护精选工具 id 有序数组；由 `src/data/tools.ts` 解析为完整 ToolMeta（缺失 id 忽略并在开发环境 console.warn，避免下线工具后白链接）。Layout.astro 与 ToolLayout.astro 解析后以 prop 传给 Shell（保持 Shell 不直接 import tools 注册表，序列化体积最小）。
4. **交互与状态**：
   - 每个入口为 `<a>` 链接（站内跳转，非 SPA 路由，与 Sidebar 行为一致）。
   - 当前路径等于该工具 path 时显示激活态（`text-primary`，遵循 DESIGN.md「primary 只用于激活态交互元素」）。
   - hover：`bg-accent` 过渡 150ms（遵循全局过渡规则）。
   - 无障碍：容器用 `<nav aria-label="常用工具">`；链接有可读文本（图标 aria-hidden）。
5. **主题**：使用设计令牌（`text-foreground`/`text-muted-foreground`/`bg-accent`/`text-primary`），浅色/暗色双主题自然适配。
6. **首页/分类页/工具页**：Shell 全局常驻，所有页面均显示；无当前工具时无激活项。

## Acceptance Criteria

- [ ] ≥lg 断点 Header 中部出现精选工具入口（图标 + 名称），<lg 断点 DOM 中不渲染该区域。
- [ ] 点击入口跳转到对应工具页；当前工具对应入口呈激活态，其余为默认态。
- [ ] 清单在 `quick-links.ts` 中调整后无需改组件代码。
- [ ] 浅色/暗色主题下均符合 DESIGN.md 对比度与令牌约束。
- [ ] `Shell.test.ts` 新增用例：渲染入口数量与顺序、激活态匹配 currentPath、无匹配时无激活项；既有用例全部通过。
- [ ] `pnpm build` + `pnpm test` + `pnpm astro check` 通过；Header 在 lg 宽度（1024px）下不换行、不溢出。

## Out of Scope

- 使用频率统计与个性化排序（用户已否决）。
- 下拉收纳"更多工具"（Sidebar 与搜索已覆盖）。
- 移动端 Header 的任何变化。
