# PRD: 集成 astro-indexnow 构建后自动提交 IndexNow

## Goal

引入 astro-indexnow 集成，构建后自动将新增/变更页面提交到 IndexNow（api.indexnow.org），
并适配双部署：GitHub Pages 构建通过 `INDEXNOW_DISABLED` 关闭提交，缓存文件
`.astro-indexnow-cache.json` 提交入库保证 EdgeOne 增量提交。

背景：站点目前依赖 sitemap 被动等 Bing 抓取，重抓周期长。IndexNow 协议允许站点在内容
变更时主动推送 URL，加快 Bing/Yandex 等引擎的收录速度。

## 方案选型

采用 `astro-indexnow`（v2.3.10，官方 Astro 集成目录在列）：

- 纯 `astro:build:done` hook，零运行时代码注入，不影响主包体积
- 扫描 dist 全部 HTML 做哈希，与缓存文件比对后**只提交新增/变更 URL**到 api.indexnow.org
  （端点自动分发给 Bing/Yandex/Seznam 等），失败指数退避重试
- peer dep 支持 Astro `^4||^5||^6||^7`、Node ≥22.12.0，与本项目（Astro 6、Node ≥22.12.0）匹配
- 27KB、零运行时依赖，2026-07 仍在活跃维护

备选（不采用）：手写 ~50 行 integration（walk dist + hash + POST）；功能重复，无必要。

## 前置条件（已满足）

- 密钥文件 `public/c90a69ccaca440b18dd4aff0cb43801c.txt` 已存在，内容 = 文件名（IndexNow 标准），
  线上 `https://tools.baixuanz.cn/c90a69ccaca440b18dd4aff0cb43801c.txt` 返回 200 且内容正确
- `astro.config.mjs` 已配置 `site: 'https://tools.baixuanz.cn'`

## Requirements

### R1: 集成注册（astro.config.mjs）

- 注册 `astro-indexnow`，`key` 使用内联常量（密钥按协议设计是公开的，必须能通过
  `https://tools.baixuanz.cn/<key>.txt` 公开访问验证站点所有权，不构成泄露；
  内联可免去 EdgeOne 控制台配置环境变量的步骤）
- `enabled` 由环境变量门控：`INDEXNOW_DISABLED=1` 时关闭，默认开启

### R2: GitHub Pages 构建必须排除提交（强制）

GH workflow 以 `--base=/DevTools` 构建，产出 URL（`https://tools.baixuanz.cn/DevTools/...`）
在真实站点不存在，密钥校验路径也对不上，若提交等同向 IndexNow 发垃圾请求。
workflow 的 build 步骤必须设置 `env: INDEXNOW_DISABLED: '1'`。

### R3: 缓存文件提交入库（强制）

EdgeOne Pages 每次构建都是全新容器，`.astro-indexnow-cache.json` 若不入库则每次部署都被视为
首次构建而全量重提全部 URL（IndexNow 对重复提交有频率限制）。该文件须被 git 跟踪，
不得加入 .gitignore。

### R4: 不破坏现有构建/测试

`pnpm build`、`pnpm test`、`pnpm astro check` 全部通过；GH workflow 其余步骤不变。

## Acceptance Criteria

- [x] `pnpm build` 日志出现 astro-indexnow 的提交记录（首次运行提交全量 URL 属预期，
      即引导收录），api.indexnow.org 返回 2xx
      （实测：submitting 88 URL(s) in 1 batch(es)，summary: scanned=88, submitted=88，
      "IndexNow submission complete"）
- [x] 提交的 URL 均为 `https://tools.baixuanz.cn/...` 真实站点地址，无 `/DevTools` 前缀
      （缓存文件逐条核对通过）
- [x] `.astro-indexnow-cache.json` 生成且被 git 跟踪
- [x] 模拟 GH 场景：`INDEXNOW_DISABLED=1 pnpm build` 不发起提交
      （实测：日志输出 "[astro-indexnow] disabled"，EXIT=0）
- [x] `pnpm test`（97 文件 1454 用例全过）与 `pnpm astro check`（0 错误 0 警告）通过

## 已知边界（验证中确认）

- Windows 本机构建若真实发生提交（缓存有差异），进程在提交完成、产物完整后于 Node 退出阶段
  触发 libuv 断言崩溃（`src\win\async.c`，exit 0xC0000409）——Node on Windows 的 undici 退出
  竞态，仅影响退出码；提交与构建产物均已完成。生产 CI（EdgeOne/GH Actions 均为 Linux，
  win/async.c 为 Windows 专属代码路径）不受影响；无变更构建（`no changed URLs detected,
  skipping submission`）与禁用模式均 EXIT=0 正常退出。上游 issue 区无同类报告。
- 首次全量提交包含 15 个旧扁平重定向页（/base64 等 meta-refresh 存根），无害：页面真实存在，
  Bing 会按 canonical 处理。

## 明确不做

- 不做 IndexNow 提交结果的监控/告警（后续 Bing 站长平台观察收录变化即可）
- 不引入运行时提交（如用户访问触发），只做构建期提交
- 不改动 sitemap 配置（两者互补：sitemap 全量罗列，IndexNow 变更推送）
