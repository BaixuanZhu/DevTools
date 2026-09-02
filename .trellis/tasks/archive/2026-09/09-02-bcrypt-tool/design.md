# 技术设计：BCrypt 密码哈希工具

## 依赖选型

**bcryptjs ^3.0.3**（本任务唯一新增依赖）。

- 选型依据（对照 AGENTS.md 依赖规则）：约 13.2M 周下载、零传递依赖、BSD 协议、10+ 年维护，满足"稳定成熟库"；bcrypt 无法用浏览器原生 API 实现（Web Crypto 无 bcrypt/EksBlowfish），属"原生做不了才引库"；站内无同类库，不重复。
- 关键能力：纯 JS 可跑浏览器、原生 TS 类型、Promise API（`hash`/`compare`/`genSalt`）、同步版 `hashSync`/`compareSync`。
- 排除方案：`@noble/hashes` 不提供 bcrypt（不做 EksBlowfish）；wasm 类实现周下载低且增加构建复杂度；自实现算法违反"优先成熟库"。

## 模块边界与数据流

```
src/utils/crypto/bcrypt.ts         # 纯逻辑层（vitest 直接测，无 DOM/Worker 依赖）
src/utils/crypto/bcrypt.worker.ts  # 慢计算 Worker：hash/compare 委派 bcryptjs（库代码被切进 worker chunk）
src/tools/crypto/BcryptTool.vue    # UI 组件（局部状态，不进 stores/）
src/pages/crypto/bcrypt.astro      # 路由（ToolLayout toolId="crypto/bcrypt" + client:idle）
src/utils/crypto/__tests__/bcrypt.test.ts
```

数据流（生成）：

```
用户点「生成哈希」
  → 主线程 generateSalt(cost)（Web Crypto getRandomValues → bcrypt base64 → "$2b$10$<22 chars>"）
  → worker.postMessage({ kind:'hash', reqId, password, salt })
  → worker 内 bcryptjs.hashSync(password, salt)
  → 主线程校验 reqId（过期丢弃）→ 展示 60 字符哈希 + 复制
```

校验同构：`{ kind:'compare', reqId, password, hash }` → `bcryptjs.compareSync` → boolean。

### 纯逻辑层 API（`src/utils/crypto/bcrypt.ts`）

```ts
/** bcrypt 自定义 base64 字母表（"./A-Za-z0-9"，非标准 Base64，含 JSDoc） */
export const BCRYPT_BASE64_ALPHABET: string;
/** 常量：cost 可选范围 4–15（UI 档位）与 bcryptjs 上限 31 的关系注释 */
export const COST_MIN = 4; export const COST_MAX = 15; export const COST_DEFAULT = 10;
/** 字节序列 → bcrypt base64 字符串（盐编码用） */
export function encodeBcryptBase64(bytes: Uint8Array): string;
/** 生成盐：crypto.getRandomValues(16 字节) → `$2b$${cost 补零两位}$${22 字符盐}` */
export function generateSalt(cost: number, prefix = '$2b'): string;
/** 解析哈希：合法返回 { prefix, cost, salt, checksum }，非法返回 null（不 throw） */
export function parseBcryptHash(hash: string): { prefix: string; cost: number; salt: string; checksum: string } | null;
/** 密码 UTF-8 字节数与是否超 72 字节（bcrypt 截断阈值） */
export function getPasswordByteInfo(password: string): { bytes: number; truncated: boolean };
```

### 设计决策与理由

1. **盐自产（安全关键）**：不用 `bcryptjs.genSalt()`，而是本层用 Web Crypto `getRandomValues` 生成 16 字节随机数并按 bcrypt base64 字母表编码。理由：bcryptjs 的随机源依赖运行环境探测（Node 走 `node:crypto`，浏览器行为需逐版本验证）；本站既定随机源策略是 Web Crypto（随机字符串工具同款）。自产盐完全确定性、可单测，且 `bcryptjs.hash(password, salt)` 只接收盐字符串、不接触 RNG。
2. **Worker 承载慢计算**：bcryptjs v3 的 async API 是"分块让出事件循环"，块间仍占主线程，cost ≥ 12 时输入仍有明显卡顿感；放进 Worker 跑 `hashSync/compareSync` 主线程完全流畅，且与站内 `json-diff.worker`/`regex.worker` 模式一致。不做主线程 fallback（构建环境均为静态构建，worker 路径已被既有工具验证）。
3. **reqId 过期丢弃**：组件持递增 `reqId`，worker 回包 `reqId` 不匹配当前值即丢弃，解决连点/改输入后的乱序竞态（worker 内同步计算不可中断，靠结果侧丢弃保证一致性）。
4. **按钮触发 + 过期标记**：不套用站内"watch 输入即算"惯例——DESIGN.md Do's 明示"实时更新，无需提交按钮（**慢操作除外**）。输入变化后置 `stale` 标记，结果区弱化显示并提示"输入已变化"，避免用户复制到与输入不符的旧哈希。
5. **cost 档位 4–15**：bcrypt 规范支持 4–31，但纯 JS 下 cost 15 已是 15–30 秒量级、更高不可用；UI 上限 15，选项旁附"cost 每 +1 耗时翻倍"的量级说明。
6. **生成固定 `$2b$` 前缀**：$2b 是当前标准（OpenBSD 修正后）；校验端正则兼容 `$2a/$2b/$2y/$2x` 全前缀（PHP `password_hash` 产 $2y、旧系统产 $2a，三者算法等价、校验互通）。

### 哈希格式校验（parseBcryptHash）

合法 bcrypt 哈希 = `` `$` + 版本(2a/2b/2y/2x) + `$` + 两位 cost + `$` + 53 个 bcrypt base64 字符 ``，共 60 字符。正则锚定整体，cost 数值额外校验 4–31；解析失败按失败原因给差异化中文文案（前缀不对 / 长度不对 / 字符集含非法字符）。

## UI 结构（标准 720px 单列，`max-w-180`，参照 HashGenerator 的"主功能 + 验证区"两段式）

```
ToolHeader（标题 + 描述，无示例按钮——默认值即示例）
├── 区块一：生成哈希
│   ├── 密码输入（单行 input，font-mono；明文显示——密码本就要输入比对，遮蔽碍事）
│   ├── 72 字节警告（text-warning，条件渲染）
│   ├── cost 选择（SelectListbox，4–15 档）+ 耗时量级说明（muted 小字）
│   ├── [生成哈希]（Primary 主按钮，计算中 disabled + "计算中…"）
│   └── 结果卡片（border 卡片 + font-mono 展示 + CopyButton + ClearButton；stale 时弱化 + 提示）
└── 区块二：校验哈希（border-t 分隔，同 HashGenerator HMAC 区模式）
    ├── 哈希输入（input，粘贴 60 字符）→ 即时解析条（$2b · cost 10 · 盐 xxx…，watch 自动）
    ├── 非法哈希中文错误（text-error）
    ├── 密码输入
    ├── [校验] 按钮 → ✓ 密码匹配（text-success）/ ✗ 密码不匹配（text-error）/ 错误
    └── 清空本区按钮
```

- 组件状态全部局部 `ref`，无跨 island 共享需求，**不新增 store**。
- 错误/警告遵循 PRODUCT.md §Error Handling：内联 `text-error`，不用弹窗；复制反馈走 CopyButton 既有 Toast。

## 测试设计

`src/utils/crypto/__tests__/bcrypt.test.ts`（vitest node 环境，Node ≥22 有 `globalThis.crypto`）：

1. `encodeBcryptBase64`：对已知字节序列断言输出字符集与长度（16 字节 → 22 字符）。
2. `generateSalt`：格式（`$2b$10$` + 22 字符）、字符集落在 bcrypt 字母表内、两次调用盐不同（随机性）、cost 补零（4 → `$04$`）、prefix 参数。
3. `parseBcryptHash`：$2a/$2b/$2y 合法样例解析出 prefix/cost/salt；非法样例（错误前缀、长度 59/61、字符集含 `-`、cost 超 31）返回 null。
4. `getPasswordByteInfo`：ASCII 72/73 字节边界、中文（每字 3 字节）、emoji（4 字节）。
5. known-answer：固定盐下 `bcryptjs.hashSync('password', '$2b$10$…固定盐…')` 与实现期记录的期望常量一致（向量取自 bcryptjs 官方测试集），保证实现/依赖升级不静默改变输出；`compareSync` 正反例（含 $2a 前缀互验）。

Worker 薄层（仅消息转发）不单独测；组件三态以浏览器冒烟验证（agent-browser：生成→复制→回贴校验✓、错密码✗、非法哈希报错、暗色模式）。

## 构建与体积

- bcryptjs 仅被 `bcrypt.worker.ts` import → Vite 切入 worker chunk，主包与工具页主 chunk 不含算法代码；验收口径沿用"主包 gzip 不增长"。
- `vite.worker.format: 'es'` 已配置（avif 先例），无新增构建配置。

## 风险与兜底

| 风险 | 概率 | 兜底 |
|------|------|------|
| bcryptjs 浏览器 ESM 对 Node `crypto` 的裸引用在 Vite 下解析失败 | 低（官方声明 bundler 自动剥离；且本设计不调用 genSalt，hash/compare 不触 RNG） | 实现第 0 步 spike：临时页面跑通 hash/compare；若失败，`vite.config` alias/external 一次性处理并记入 journal |
| worker chunk 内 bcryptjs 体积 | 低 | build 后核对 chunk 清单，验收口径只约束主包 |
| 高 cost 用户等待过久 | 中 | cost 15 档位在 UI 标注量级警告；计算中按钮 disabled 防连点 |

### Spike 结论（2026-09-02 已验证，风险表第一行解除）

- `pnpm add bcryptjs` 落地 **3.0.3**；Node 侧 `import('bcryptjs')` ESM 直接可用，`hashSync`/`compareSync` 正常。
- 包自带 `browser: {"crypto": false}` 字段，bundler 会剥离 `crypto` 引用，无需额外 Vite 配置（生产构建仍以 `pnpm build` 为准复核）。
- known-answer 向量实测：jBCrypt 官方向量 `'a'`（盐 `$2a$06$m0CrhHm10qJ3lXRY.5zDGO`）与 `'abc'`（盐 `$2a$06$If6bvum7DFjUnE9p2uDeDu`，注意大写 I）与 bcryptjs 3.0.3 输出一致，测试用这两条；另两条网传向量（空串/26 字母串）与实测不符，系转抄哈希有误，弃用。

## 回滚

全部改动为新增文件 + 注册表/文档少量行，单 commit 交付，`git revert` 即完整回滚；不涉及 URL 变更与 redirects。
