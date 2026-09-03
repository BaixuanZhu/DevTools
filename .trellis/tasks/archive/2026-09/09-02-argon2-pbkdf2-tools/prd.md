# PRD: Argon2 与 PBKDF2 密码哈希工具

## 背景

bcrypt（09-02 已上线）补齐了密码存储慢哈希的第一块，但「密码哈希」板块仍未闭环：

- **Argon2** 是 OWASP 密码存储指引现行首推（PHC 竞赛冠军，内存困难型，抗 GPU/ASIC 暴破），新项目选型越来越多直接用 argon2id。bcrypt 工具的 FAQ 已在讲"更现代的选择是 argon2"，站内却没有对应工具，故事讲不圆。
- **PBKDF2** 是兼容性最广的 KDF：Web Crypto 原生支持、Django 默认 `pbkdf2_sha256`、WPA2 / 加密 ZIP 等场景大量使用。开发者高频需要：核对 Django 迁移数据里的密码哈希、复现派生密钥排查。

两个工具上线后，加密分类形成 bcrypt / argon2 / PBKDF2 三件套闭环，互链引流。

## 目标用户与场景

- 后端开发者为新项目选 argon2id：造用户初始密码哈希、调 m/t/p 参数直观感受耗时
- 校验迁移数据：粘贴 PHC 串核对密码是否匹配、解析参数
- Django 全栈开发：核对 `pbkdf2_sha256$<迭代>$<b64盐>$<b64哈希>` 哈希与明文是否匹配
- 复现 PBKDF2 派生密钥（WPA2、加密 ZIP、跨语言对接联调）

## 功能需求

> 范围口径（2026-09-02 拍板，同 bcrypt）：工具全程**单次处理**——一次一个密码；不做批量。

### 工具 A：Argon2（/crypto/argon2）

P0：

1. **哈希生成**：密码 + 参数面板 → 标准 PHC 编码哈希（`$argon2id$v=19$m=65536,t=3,p=4$<b64盐>$<b64哈希>`）；每次生成用新的随机盐（16 字节）。
   - 参数：类型（argon2id 默认 / argon2i / argon2d）、内存 m（KiB，默认 65536 = 64 MiB，RFC 9106 第二推荐档）、迭代 t（默认 3）、并行度 p（默认 4）。
   - 参数上限防浏览器 OOM：m ∈ [1024, 262144]（即 1–256 MiB）、t ∈ [1, 10]、p ∈ [1, 8]，且 m ≥ 8×p（argon2 最小内存约束）；超限给中文错误。
2. **哈希校验**：密码 + PHC 哈希 → 匹配 / 不匹配；`$argon2` 家族（argon2i/d/id、v=16/19）识别；格式非法给差异化中文错误。
3. **哈希解析**：粘贴哈希后即时解析类型 / 版本 / m / t / p / 盐长度（纯字符串操作，输入即显示，不打日志）。
4. **慢操作交互模式**（同 bcrypt 四件套）：按钮触发 + reqId 丢弃乱序 + 输入快照 stale 标记 + 清空使在途响应失效。

P1（低成本增值）：

5. 参数区附耗时参考说明（m/t 与耗时的大致关系，一句话量级提示）。
6. 盐输入不暴露（与 bcrypt 一致：盐自动随机内嵌，无手填项）。

### 工具 B：PBKDF2（/crypto/pbkdf2）

P0：

1. **密钥派生（生成）**：密码 + 盐 + 迭代次数（默认 600000，OWASP 2023 对 PBKDF2-HMAC-SHA256 的推荐档）+ PRF（SHA-1 / SHA-256 / SHA-384 / SHA-512）+ 派生长度 dkLen（字节，默认 32）→ 派生密钥，hex / base64 双格式输出（可切换）。
   - 盐支持 text（UTF-8 字节）/ hex 两种输入模式；hex 模式非法字符给中文错误。
   - 参数上限：迭代次数 ∈ [1, 10000000]、dkLen ∈ [1, 512] 字节；超限中文错误。
2. **Django 哈希校验**：粘贴 `pbkdf2_sha256$<迭代>$<b64盐>$<b64哈希>` 格式哈希 + 密码 → 匹配 / 不匹配；解析行即时显示迭代次数 / 盐 / 哈希长度；格式非法（算法不是 pbkdf2_sha256 / 字段数不对 / b64 非法 / 迭代非数字）给差异化中文错误。
   - 兼容 passlib 同款格式；b64 容忍缺省 padding（自动补齐）。
3. **慢操作交互模式**（同上四件套）。

P1：

4. 盐输入框附「随机盐」按钮（生成 16 字节随机盐，按当前盐模式填入 hex/text）。
5. 迭代档位快捷选择（10万 / 30万 / 60万 / 100万）+ 手动输入并存。

### UI 硬性要求（2026-09-02 用户拍板四点，照搬 bcrypt 终态，两工具一致）

- 结果区标签用「结果」这类简短中性词。
- 复制 / 清空按钮内嵌结果框标题栏（复用 `CodePanel.vue`，copyText 为空时禁用而非隐藏）。
- 任何状态切换（占位→结果→错误→过期）不引起布局跳动；内容区 / 解析行 / 结果行按最大状态 min-h 预留。
- 校验结果区首屏即预留固定高度，点击校验不得整页闪动。

## 非目标（Out of Scope）

- scrypt（等真实需求，另立任务；hash-wasm 顺手支持，未来成本低）
- 批量加解密 / 批量哈希（用户拍板：仅单次）
- argon2 高级参数：secret / 关联数据（data）、手填盐、lanes>threads 之类底层细节
- PBKDF2 raw 期望值比对模式（Django 格式已覆盖主校验场景；派生结果肉眼可比对）
- 非安全上下文（http 非 localhost）降级提示：EdgeOne https + 本地 localhost 均为安全上下文，与站内其他 Web Crypto 工具口径一致，不特殊处理

## 依赖与选型

- **argon2：hash-wasm 4.12.0**。周下载 ~135 万；最后发布 2024-11（零依赖 WASM 包装、API 稳定冻结，可接受）；WASM 以 base64 内嵌 JS、无独立 .wasm 资产，天然适配 worker 懒加载 chunk。spike 验证项：argon2id/i/d + `argon2verify` 在 node 与浏览器 worker 均可用、参考实现向量核对、实际 chunk 体积。
- **PBKDF2：Web Crypto `crypto.subtle.deriveBits` 原生**，零新依赖（worker 内可用）。

## SEO 与注册要求

- `src/data/tools.ts` 新增两条（全字段显式配置，长度以守卫测试实测为准）：
  - `id: 'argon2'`、`path: '/crypto/argon2'`；title 草案 `Argon2 密码哈希 - 在线生成与校验、argon2id 调参 - DevTools`；keywords：argon2 在线、argon2 生成、argon2 校验、argon2id、密码哈希、PHC 格式等 5–10 个。
  - `id: 'pbkdf2'`、`path: '/crypto/pbkdf2'`；title 草案 `PBKDF2 密钥派生 - 在线生成与 Django 哈希校验 - DevTools`；keywords：pbkdf2 在线、pbkdf2 生成、django 密码哈希、pbkdf2_sha256、密钥派生等 5–10 个。
- FAQ（`tool-faqs.ts` 各加 5 条）：argon2（与 bcrypt 怎么选 / m·t·p 参数怎么调 / PHC 串怎么读 / 为什么浏览器里能算 / argon2i 与 argon2id 区别）；pbkdf2（迭代次数选多少 / Django 哈希怎么核对 / 盐用 text 还是 hex / 和 argon2 比怎么选 / 派生长度怎么定）。
- 相关工具互链：argon2 `['bcrypt','pbkdf2','hash-generator']`；pbkdf2 `['argon2','bcrypt','hash-generator']`；bcrypt 的 relatedToolIds 更新纳入 argon2、pbkdf2（保持总数 ≤5）。
- 文档同步：PRODUCT.md 分类表「加密与安全」5→7；`categories.ts` crypto 的 `description`/`seoDescription` 补 Argon2 / PBKDF2（重过 120–160 守卫）。

## 验收标准

1. 打开 `/crypto/argon2` 默认示例即可生成，生成结果回贴校验区得 ✓ 匹配；参数超限（如 m=524288）出现中文错误。
2. 打开 `/crypto/pbkdf2` 默认参数派生结果与 known-answer 向量一致（测试固化）；Django 格式哈希（测试内用 node crypto 生成固化向量）校验 ✓/✗ 均正确。
3. 两工具生成/校验在 Web Worker 执行，UI 不卡顿；乱序响应丢弃、输入变化 stale 标记、清空使在途响应失效。
4. 格式错误的差异化中文提示全覆盖（argon2 PHC 前缀/字段/参数范围、Django 算法/字段数/b64/迭代、hex 盐非法字符等）。
5. 工具页硬性要求全满足：中文错误、清空与复制、合理默认值、SEO 全字段；UI 四点（结果标签 / 按钮内嵌 / 零跳动 / 校验区预留）全满足。
6. `pnpm test` / `pnpm astro check` / `pnpm build` 全绿；注册表守卫测试对新条目通过。
7. 单元测试覆盖：PHC 解析合法/非法各分支、argon2 参数校验（含 m≥8p）、Django 格式解析各错误分支、hex/b64 转换、argon2 参考向量（hash/verify 正反例）、PBKDF2 RFC 向量（SHA-1 + SHA-256）。
8. 主包 gzip 体积不因 hash-wasm 增长（库代码只进 argon2 worker 独立 chunk）；PBKDF2 零新依赖。

## 风险与开放问题

- **默认参数耗时**：argon2 默认 m=65536/t=3/p=4 在低端机可能偏慢——spike 实测浏览器 worker 耗时，若明显超过 bcrypt cost 10 的体验（约数百 ms），降档为 OWASP 最低推荐 m=19436/t=2/p=1 并在 FAQ 说明。
- **hash-wasm 维护停更（2024-11）**：API 冻结 + 135 万周下载，社区事实标准，接受；spike 复核 argon2verify API 存在性与行为。
- **argon2 参考向量**：网上转抄向量错误率高（bcrypt 的 jBCrypt 向量踩过坑）——spike 必须以 hash-wasm 实算 + node 独立实现（或官方测试向量源）双源核对后才固化进测试。
