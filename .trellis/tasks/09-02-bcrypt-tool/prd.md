# PRD: BCrypt 密码哈希工具

## 背景

加密与安全分类现有 4 个工具（哈希生成器、对称加解密、非对称加解密、SM2 国密加解密），覆盖了通用哈希（MD5/SHA/HMAC）与加解密，但缺少**密码存储场景的慢哈希（自适应 KDF）**。bcrypt 是业界使用最广的密码哈希算法（Node.js bcrypt、Spring Security、Django、Laravel 等框架的常见/默认选项），全栈开发者高频需要：造用户初始密码哈希、核对迁移数据、验证泄漏密码库、理解 cost 因子耗时。站内目前无此能力，属于分类空白。

## 目标用户与场景

- 后端开发者为用户表造初始密码哈希 / 核对登录接口的 bcrypt 校验逻辑
- 排查"为什么 cost 12 登录慢"：直观感受 cost 与耗时的关系
- 安全学习：理解盐内嵌、$2a/$2b/$2y 前缀、72 字节截断等 bcrypt 特性

## 功能需求

> 范围口径（2026-09-02 拍板）：工具全程**单次处理**——一次一个密码的哈希生成、一次一组明文+哈希的校验与解析；明确不做批量加解密/批量哈希。

### P0（本期必做）

1. **哈希生成**：输入密码 + cost 因子（可选 4–15，默认 10）→ 生成标准 60 字符 bcrypt 哈希（`$2b$` 前缀）；每次生成使用新的随机盐；结果可一键复制。
2. **哈希校验**：输入密码 + 已有哈希 → 匹配 / 不匹配三态结果（样式口径同 HashGenerator 的 HMAC 验证区）；哈希格式非法时给中文错误。
3. **哈希解析**：粘贴哈希后即时解析并展示版本前缀（$2a/$2b/$2y/$2x）、cost、盐值（纯字符串操作，输入即显示）。
4. **72 字节截断提示**：密码 UTF-8 编码超过 72 字节时显示警告（bcrypt 静默截断，中文每字 3 字节，用户极易踩坑）。
5. **慢操作交互模式**：生成与校验均为按钮触发（bcrypt 是慢哈希，落入 DESIGN.md "慢操作除外" 条款），不随键入自动计算；输入变化后既有结果标记"已过期"。

### P1（低成本增值，随本期实现）

6. cost 选择项附耗时参考说明（cost 每 +1 耗时翻倍的大致量级提示）。
7. 生成区与校验区结果各自带"清空"按钮。

## 非目标（Out of Scope）

- argon2 / scrypt / PBKDF2（未来独立工具候选，另立任务）
- 批量加解密 / 批量哈希、从文件读取密码列表（用户拍板：仅支持单次生成与单次校验）
- 密码强度评估 / 密码生成（已有「随机字符串生成」工具）
- cost>15 的极端档位（纯 JS 耗时不可用）

## SEO 与注册要求

- 注册 `src/data/tools.ts`：`id: 'bcrypt'`、`path: '/crypto/bcrypt'`、`category: '加密与安全'`，全字段显式配置：
  - `title` 草案：`BCrypt 密码哈希 - 在线生成与校验、cost 耗时对照 - DevTools`（42 字符，区间 25–45 ✓）
  - `seoDescription` 草案：`免费在线 BCrypt 密码哈希工具，输入密码自定义 cost 因子一键生成带随机盐的标准 bcrypt 哈希，支持 $2a$/$2b$/$2y$ 各前缀哈希在线校验比对与版本、盐值解析，自动提示 72 字节截断风险，用户表密码存储与登录接口调试必备，纯浏览器端运算密码绝不上传。`（约 137 字符，实现时以守卫测试实测为准）
  - `keywords` 5–10 个：bcrypt 在线、bcrypt 生成、bcrypt 校验、bcrypt cost、密码哈希、bcrypt hash 等长尾词
- FAQ（`tool-faqs.ts` 加 `'bcrypt'` 键，草案 5 条）：bcrypt 与 SHA-256 存密码的区别 / cost 选多少合适 / $2a$ $2b$ $2y 前缀区别 / 为什么提示 72 字节截断 / 为什么每次生成的哈希都不一样
- 相关工具：`relatedToolIds: ['hash-generator', 'random-string', 'symmetric-crypto']`；`hash-generator` 的 relatedToolIds 追加 `bcrypt`（互链）
- 文档同步：PRODUCT.md 分类表「加密与安全」4→5 并补代表工具；`categories.ts` crypto 的 `description`/`seoDescription` 追加 BCrypt 密码哈希（seoDescription 改动后须重过 120–160 守卫）

## 验收标准

1. 打开 `/crypto/bcrypt` 即有默认示例（示例密码 + cost 10），点击「生成哈希」立即可用；「校验」对生成结果回贴能得 ✓ 匹配。
2. 生成/校验过程 UI 不卡顿（慢计算在 Web Worker 中执行）；连续操作时只认最新请求结果。
3. 密码超 72 字节出现警告文案；非法哈希（前缀错误/长度不对/字符集不对）出现具体中文错误。
4. 工具页硬性要求全满足：中文错误提示、清空与复制按钮、合理默认值、SEO 全字段。
5. `pnpm test` / `pnpm astro check` / `pnpm build` 全绿；注册表守卫测试（title/seoDescription 长度）对新条目通过。
6. 新增 util 单元测试覆盖：盐生成格式与随机性、bcrypt base64 编码、哈希解析合法/非法各分支、72 字节检测（含中文多字节）、固定盐 known-answer 向量、compare 正反例。
7. 主包 gzip 体积不因 bcryptjs 增长（库代码进 worker 独立 chunk）。

## 风险与开放问题

- bcryptjs v3 在浏览器 ESM 下对 Node `crypto` 模块的引用是否被 Vite 构建正确剥离——实现第一步先 spike 验证（详见 design.md 风险节）。
