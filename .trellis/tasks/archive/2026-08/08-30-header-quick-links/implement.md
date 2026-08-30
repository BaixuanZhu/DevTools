# Implement — PC 端 Header 高频工具快捷入口

## 执行清单（顺序执行）

1. [ ] **数据文件** `src/data/quick-links.ts`
   - `QUICK_LINK_TOOL_IDS`（TSDoc 注释：职责 + 调整指引，≤6 个）
   - `getQuickLinkTools()`：解析 + DEV warn 缺失 id；返回 `Pick<ToolMeta,...>[]`
   - import 一律相对路径（无 `@/` 别名）
2. [ ] **Shell.vue**：新增 `quickLinks` prop（可选，默认 []）+ 中部 `<nav>`；右侧组加 `ml-auto`；核对 aria 与双主题令牌
3. [ ] **Layout.astro / ToolLayout.astro**：`import { getQuickLinkTools }` → `:quick-links`（两处同改，目录对称）
4. [ ] **测试**：`src/components/shell/__tests__/Shell.test.ts` 按 design.md 测试设计补 4 组用例
5. [ ] **样式自检**：`pnpm dev` 下 1024/1280/1920 三档宽度人工核对（不换行、激活态、双主题）；任意值语法检查（本次新增 class 均为标准间距，无 `w-[...]` 类）

## 验证命令

```bash
pnpm test src/components/shell/__tests__/Shell.test.ts   # 局部
pnpm test && pnpm astro check && pnpm build              # 全量门禁
```

## 评审门

- 实现完成后跑全量门禁；UI 需截图/预览确认 lg 断点布局（Header 高 57px 不变）。

## 回滚点

- 单 commit 交付；回滚 revert 该 commit 即可，无数据/状态迁移。

## Spec 更新（Phase 3.3）

- DESIGN.md `### Header` 表补「快捷入口」行（Layout/Class/激活态规则）。
- 顺带记录：DESIGN.md「Don't implement a dark theme」一条与代码现状（`.dark` 令牌组 + 三态切换）不符，属文档滞后，提请用户决定是否另行修订（本次不动该条）。
