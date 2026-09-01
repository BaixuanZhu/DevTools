# 执行清单：全站 title 拉齐 Bing 标题长度规范

按序执行；每步末尾的验证命令通过后再进入下一步。

## 1. 数据层文案（核心工作量）

- [x] 1.1 `src/data/tools.ts`：按 prd 文案规范为 52 个工具逐条补 `title` 字段（格式 `{工具名} - {长尾词/场景} - DevTools`，25-45 字符，从各工具 `keywords`/`seoDescription` 提炼）。落地长度分布 31-45，越界 0。分类批量：text(12) → crypto(4) → format(8) → network(6) → datetime(3) → frontend(9) → devops(9) → standalone(1)。
- [x] 1.2 `src/data/tools.ts`：`title` 字段 JSDoc 补长度口径（25-45 目标 / 25-60 守卫）。
- [x] 1.3 `src/data/categories.ts`：`CategoryMeta` 新增 `seoTitle` 字段 + 7 条手写 + JSDoc 注释。
- 验证：`pnpm test src/data` 通过

## 2. 消费端

- [x] 2.1 `src/pages/[category]/index.astro`：title 与 CollectionPage JSON-LD name 改用 `category.seoTitle`。
- [x] 2.2 `src/pages/index.astro:42`：首页标题手写（`DevTools 在线工具箱 - JSON、时间戳、图片压缩等 50+ 免费开发工具`）。
- [x] 2.3 `src/pages/markdown.astro`：`pageTitle` 改读 `tool.title`，回退值同步加长。
- [x] 2.4 `src/layouts/ToolLayout.astro`：回退公式升级（有分类 `{name} - {分类名}在线工具 - DevTools`；standalone `{name} - DevTools 在线工具箱`）；Layout.astro / SeoHead.astro 兜底默认 title 同步加长。
- [x] 2.5 `src/pages/about.astro`、`src/pages/feedback.astro`、`src/pages/404.astro`：标题拉长，about 去品牌重复。
- 验证：`pnpm astro check` 0 错误（Shell.test.ts 分类夹具补 seoTitle 后）

## 3. 守卫测试

- [x] 3.1 `src/data/__tests__/tools.test.ts`：新增 describe「tools.ts title 长度守卫」——必须显式配置、长度 25-60、无首尾空白（仿 seoDescription 守卫）。
- [x] 3.2 `src/data/__tests__/categories.test.ts`：seoTitle 同口径守卫。
- 验证：`pnpm test` 全量 1454 通过；守卫有效性由 dist 产物全量扫描独立交叉验证。

## 4. 全量验收

- [x] 4.1 `pnpm build` 后扫描 `dist/**/*.html` 的 `<title>`：63 正文页全部达标（28-45），26 个 301 重定向 stub 豁免，7 个 Bing CSV 真实页全部达标。输出：title-audit.txt。
- [x] 4.2 `pnpm test` + `pnpm astro check` + `pnpm build` 全绿。

## 5. 收尾（Trellis Phase 3）

- [ ] 5.1 评估是否将标题长度规范补进 PRODUCT.md（3.3 spec update）。
- [ ] 5.2 commit（中文 conventional，如 `fix(seo): 全站标题拉齐 25-45 字符，修复 Bing 标题过短告警`）。
- [ ] 5.3 推双远端；Bing Webmasters 重新提交 7 个 URL + /media/ 旧 URL；与 description 修复同周期复查。

## 回滚点

纯文案 + 测试改动，任一步失败可 `git checkout -- <file>` 单文件回滚；无数据迁移、无依赖变更。
