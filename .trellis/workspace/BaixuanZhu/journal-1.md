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

## 2026-09-01 Markdown 导出 HTML 预览与多主题（09-01-md-html-export-preview-themes）

- markdown-export.ts 重构：`HTML_EXPORT_THEMES` 5 套主题（经典浅色/暗色/微信公众号/极简衬线/科技蓝）= CSS 变量集挂 `:root[data-theme]`；`buildHtmlDocument` 公开化为预览/下载单一产物路径；产物内嵌全主题 + 右下角切换器（localStorage try/catch 降级），零外部资源；`<title>` 注入文档标题（HTML 转义）。
- 新增 HtmlExportDialog.vue（radiogroup 主题胶囊 + `sandbox="allow-scripts"` iframe 预览，无 allow-same-origin 隔离不透明源）；工作台导出菜单 HTML 项改为开对话框。
- 坑：从 DropdownMenuItem select 同步开 Dialog 会被 reka-ui 菜单收起的焦点还原秒关（MutationObserver 实测挂载 ~20ms 即被移除）→ `setTimeout 100ms` 再置开；已录 component-guidelines spec。
- 验证：单测 9 例（1463 全绿）/ astro check 0 错误 / build 成功；浏览器冒烟 5 主题切换、iframe 内嵌切换器、下载产物（文件名/默认主题烘入）与独立打开后切换记忆全过。经验收报"已导出 HTML 文件"即旧直下路径，已由对话框替代。

## 2026-09-02 BCrypt 密码哈希工具（09-02-bcrypt-tool）

- crypto 分类第 5 个工具 `/crypto/bcrypt`：单次哈希生成（cost 4-15 + Web Crypto 自产盐）、单次校验三态、哈希即时解析、72 字节截断警告。bcryptjs 3.0.3 唯一新依赖，只进 `bcrypt.worker-*.js` chunk（gzip 9.4KB），主包字节级零增长。
- 关键设计：慢哈希按钮触发（DESIGN.md 慢操作例外）+ reqId 丢弃乱序 + 输入快照 stale 兜底 + 清空递增 reqSeq 防回填——已沉淀 component-guidelines「慢计算类工具交互」Pattern。盐自产（getRandomValues + bcrypt base64）不依赖库随机源探测；`$2x$` 前缀 compareSync 会 throw，比对前归一化 `$2a`（check 阶段抓出并修复）。
- 验证：单测 29 例（1493 全绿）/ astro check 0 错 / build 74 页；dev + preview 生产冒烟（生成→回贴校验 ✓/✗、非法哈希错误、暗色截图目检）全过。
- agent-browser 冒烟坑（已录记忆）：双引号 `$` 展开、client:idle 水合延迟需探针、旧 ref 点到备案链接导航走、主题是三选菜单。
- 09-02 用户验收反馈迭代（931115d）：结果区改名「结果」并改用 CodePanel（复制/清空图标按钮入标题栏、禁用而非隐藏），生成/校验内容区固定高度预留——绝对坐标实测点击前后零位移；错误与按钮同行、过期提示内联化，消灭全部布局跳动源。

## 2026-09-03 Argon2 与 PBKDF2 密码哈希工具（09-02-argon2-pbkdf2-tools）

- crypto 分类第 6/7 个工具：`/crypto/argon2`（argon2id/i/d 生成 + PHC 校验 + 解析，参数 m MiB/t/p 带范围与 m≥8p 校验）与 `/crypto/pbkdf2`（Web Crypto 派生：盐 text/hex + 随机盐 + 快捷档 + PRF 四选 + hex/Base64 输出；Django pbkdf2_sha256 哈希校验）。密码哈希三件套（bcrypt/argon2/PBKDF2）闭环互链。
- 选型：hash-wasm 4.12.0（135 万周下载、2024-11 停更但 API 冻结；ESM 平铺 + sideEffects:false 可摇树、wasm base64 内嵌无独立资产）只进 argon2.worker chunk（29.8KB raw）；pbkdf2 走 crypto.subtle 零依赖（worker 934 字节）。spike 先行：外部 argon2i 向量命中、RFC 6070/SHA-256 全中、Django 固化向量生成，均双源核对后才进测试。
- check 抓出口径分裂必修：`parseArgon2Hash` 正则拒 `=` 而 formatError 用宽松 atob 放行（解析行空白 + 校验落 worker 兜底）→ 抽共享 PHC_B64_RE 双向一致；沉淀「三件套同构 + 接受集一致不变式 + hash-wasm 特性」Pattern。
- 验证：单测 44 例（1538 全绿）/ astro check 0 错 / build 76 页；dev+preview 双环境冒烟全过（生成→回贴 ✓/✗、参数超限/v=16/b64/hex/Django 算法段差异化中文错误、stale、快捷档、Base64 切换与 node pbkdf2Sync 逐字节一致、布局锚点间距全程恒定零位移、暗色目检）。dev 首次点击延迟系 Vite dev 编译 worker，生产即点即得。
