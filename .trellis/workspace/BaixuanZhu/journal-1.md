# Journal - BaixuanZhu (Part 1)

> AI development session journal
> Started: 2026-08-28

---

## 2026-08-31 markdown 工作台收尾（无任务小修）

- feat/markdown-workstation 最后一修：PDF 导出跨页（旧 `position:fixed` 打印不分页只能出一页）→ 打印宿主方案（克隆 `.md-editor-preview` 到 body 下，canvas 转 toDataURL、打印期摘除 html.dark），45226d2。
- 验证：astro check 0 错误 / 1447 测试全过 / build 成功；浏览器实测 25 章长文导出 24 页，浅/暗模式与 mermaid/katex/表格渲染正常。
- 84868d8 --no-ff 合并进 main（含 08-30 任务归档目录），删除 feat 分支，推送双远端。


## 2026-09-01 IndexNow 集成（09-01-indexnow-integration）

- 引入 astro-indexnow 2.3.10（构建期 `astro:build:done` hook，零运行时代码），构建后 diff HTML 哈希只提交新增/变更页到 api.indexnow.org。首跑全量提交 88 URL（含 15 个旧扁平重定向存根，无害）。
- 双部署适配：GH workflow build 步骤 `INDEXNOW_DISABLED=1`（--base=/DevTools 产出 URL 非真实站点）；缓存 `.astro-indexnow-cache.json` 提交入库（EdgeOne 全新容器否则全量重提）。a76bffe 推双远端。
- 坑：Windows 本机构建真实发生提交时，进程在提交完成后退出阶段触发 libuv 断言崩溃（src\win\async.c，exit 0xC0000409）——undici 退出竞态，仅本地且仅提交时出现；Linux CI 不受影响，无变更/禁用构建均 EXIT=0。
