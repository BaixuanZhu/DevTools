# 全站 title 拉齐 Bing 标题长度规范

## Goal

为全站 56 个页面手写 25-45 字符 SEO 标题（tools.ts 补 52 个工具 title 字段、categories.ts 新增 seoTitle、首页/about/feedback/404/markdown 单独改），升级 ToolLayout 回退公式，并仿 seoDescription 守卫新增 title 长度守卫测试，消除 Bing Webmasters『标题过短』告警。

## 背景与诊断（2026-09-01 探明）

- Bing Webmasters 报告"许多页面标题过短"，附 8 个受影响 URL（FailingUrls CSV，2026-8-31 导出）。
- 工具页标题逻辑 `src/layouts/ToolLayout.astro:44`：`props.title > toolMeta.title > "{name} - DevTools"` 回退。`src/data/tools.ts:45` 已定义 `title?` 字段但 **47 个工具全部未填**，全站工具页标题实际 15~27 字符。
- 其余标题来源：分类页 `${分类名} - DevTools`（`src/pages/[category]/index.astro:68`，15-16 字符）；首页 `"DevTools - 在线工具箱"`（`src/pages/index.astro:42`，15 字符）；`/markdown` 硬编码同公式（`src/pages/markdown.astro:20`，23 字符）；`/feedback` 12 字符（全站最短）；`/about` 16 字符且含「DevTools | DevTools」品牌重复。
- 8 个 CSV URL 判定：`/media/qr-code-generator/` 为分类合并前旧 URL，已 301（`astro.config.mjs:29`），重抓自然消退，**无需改代码**；其余 7 个（frontend/qr-code-generator、datetime/datetime-converter、frontend/image-converter、datetime/time-calculator、text/uuid-generator、frontend/panel、network/device-info）为真实页，恰是站内最短标题样本。只修 8 个治标不治本，全站统一拉齐。
- 用户已拍板：逐工具手写文案；长度目标 25-45 字符；创建 Trellis 任务跟踪。

## Requirements

1. **文案规范（工具页 title，52 条）**：格式 `{工具名} - {1-2 个搜索长尾词或使用场景} - DevTools`；长尾词从该工具现有 `keywords` / `seoDescription` 提炼；长度 25-45 字符（中文按 1 字符计，与 seoDescription 守卫同口径）；禁关键词堆砌、禁首尾空白；同步更新 `ToolMeta.title` 字段 JSDoc 注释（补长度口径说明）。
2. **分类页（7 条）**：`categories.ts` 新增 `seoTitle` 字段并手写，如 `文本与编码工具大全 - Base64、正则、UUID 等在线工具 - DevTools`；更新 `CategoryMeta` JSDoc。
3. **单页改造**：
   - 首页 `index.astro:42` 手写标题（约 35-45 字符，实际落地 `DevTools 在线工具箱 - JSON、时间戳、图片压缩等 50+ 免费开发工具`）；
   - `[category]/index.astro:68` title 与 CollectionPage JSON-LD name 改用 `category.seoTitle`；
   - `markdown.astro:20` 改读 `tool.title` 单源（保留回退）；
   - `about.astro` / `feedback.astro` / `404.astro` 拉长标题，about 去除品牌词重复。
4. **回退公式升级（防线）**：`ToolLayout.astro:44` 无 title 时改为 `{name} - {分类名}在线工具 - DevTools`（无分类的 standalone 工具用合理加长变体），保证未来新工具漏配时不低于 25 字符。
5. **守卫测试**（仿 `src/data/__tests__/tools.test.ts:77` seoDescription 守卫写法）：
   - tools.test.ts：每个工具必须显式配置 `title`、长度 25-60、无首尾空白；
   - categories.test.ts：`seoTitle` 同口径守卫。

## 明确不做

- `/media/qr-code-generator/` 不改代码（301 已存在）。
- 不动 trailingSlash / canonical（canonical 已输出，斜杠变体无害）。
- og:title / twitter:title 随 title 自动同步，不单独处理。

## Acceptance Criteria

- [x] 52 个工具 + 7 个分类 + 首页 + about/feedback/404/markdown 的标题均 25-60 字符，目标带 25-45（dist 审计 63 页 0 越界，28-45）。
- [x] Bing CSV 中 7 个真实页标题重写完成且含各自核心长尾词。- [x] 守卫测试落地：漏配 title、长度越界、首尾空白均使 `pnpm test` 失败。
- [x] `pnpm build` 后扫描 `dist/**/*.html` 的 `<title>`，全量页面长度达标（输出留存 title-audit.txt：63 正文页 28-45，26 重定向 stub 豁免，0 越界）。
- [x] `pnpm test`、`pnpm astro check`、`pnpm build` 全绿（1454 测试 / 0 类型错误 / 73 页构建）。
- [ ] 上线后 Bing Webmasters 重新提交 7 个 URL 与 /media/ 旧 URL 重抓，观察 recommendation 消退（与 09-01 description 修复同一观察周期）。
