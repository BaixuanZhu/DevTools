# Design: Argon2 与 PBKDF2 密码哈希工具

## Spike 结论（2026-09-02 实测，脚本 `spike-main.mjs` 留存于本任务目录）

- **hash-wasm 4.12.0 选型成立**：零依赖、无 browser field（无 Vite 剥离问题）、`sideEffects: false`（ESM 平铺文件可 tree-shake，未用算法的 wasm blob 会被摇掉；argon2 单算法体积参照 `argon2.umd.min.js` ≈ 29.5KB raw）。
- **API**：`argon2id / argon2i / argon2d({ password, salt, iterations, parallelism, memorySize, hashLength, outputType: 'encoded' })` 返回 PHC 串；`argon2Verify({ password, hash })` 返回 boolean。salt 直接传 `Uint8Array`。
- **独立公开向量命中**（不信任转抄的双源验证）：`argon2i(password='password', salt='somesalt', m=65536, t=2, p=1)` 实算 = `$argon2i$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$wWKIMhR9lyDFvRz9YTZweHKfbftvj+qf+YFY4NeBbtA`，与多库公开测试向量一致。
- **行为边界**：三类型 roundtrip verify 正反例正确；篡改哈希尾部 → 返回 `false` 不抛错；`v=16` 老版本哈希 → **throw `Unsupported version: 16`**（英文，worker 侧 catch 转中文；parse 层对 v≠19 提前给差异化中文错误，v=16 专门文案）。
- **耗时（node WASM，浏览器同量级）**：默认档 m=65536/t=3/p=4 = **147ms**（不降档，维持 RFC 9106 二档默认）；OWASP 最低档 m=19456/t=2/p=1 = 28ms；PBKDF2-HMAC-SHA256 60 万迭代 = 72ms。p=4 与 p=1 耗时相同（单线程 lane 交错）。
- **PBKDF2 向量**：RFC 6070 SHA-1 两条（c=1/c=4096）、SHA-256 两条（c=1/c=2）全中；subtle 与 node `pbkdf2Sync` 双实现交叉一致（SHA-1/256/512）。
- **Django 固化测试向量**（密码 `DevTools@2026`，盐 `some-salt-16byte`，迭代 100）：
  `pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=`
  注意盐 b64 带 `==` padding——解析器必须容忍有/无 padding 两种形态。

## 文件结构（与 bcrypt 完全对称）

```
src/utils/crypto/argon2.ts          # 纯逻辑层：PHC 解析/差异化错误/参数校验/随机盐/worker 协议类型
src/utils/crypto/argon2.worker.ts   # import hash-wasm（argon2id/i/d + argon2Verify），self.onmessage 分发
src/utils/crypto/pbkdf2.ts          # 纯逻辑层：Django 解析/差异化错误/hex 校验/随机盐/worker 协议类型
src/utils/crypto/pbkdf2.worker.ts   # crypto.subtle.deriveBits，零第三方依赖
src/utils/crypto/__tests__/argon2.test.ts
src/utils/crypto/__tests__/pbkdf2.test.ts
src/tools/crypto/Argon2Tool.vue     # client:idle
src/tools/crypto/Pbkdf2Tool.vue     # client:idle
src/pages/crypto/argon2.astro       # ToolLayout toolId="crypto/argon2"
src/pages/crypto/pbkdf2.astro       # ToolLayout toolId="crypto/pbkdf2"
```

## util 层设计

### argon2.ts

- 常量：`ARGON2_TYPES = ['argon2id', 'argon2i', 'argon2d']`、`M_MIN_KIB = 1024`、`M_MAX_KIB = 262144`、`T_MIN = 1 / T_MAX = 10`、`P_MIN = 1 / P_MAX = 8`、盐 16 字节。
- `parseArgon2Hash(hash): ParsedArgon2Hash | null`：正则
  `/^\$(argon2id|argon2i|argon2d)\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/`，
  容忍首尾空白；返回 `{ type, version, m, t, p, saltB64, hashB64 }` 并对盐/哈希做 b64 解码校验（长度 >0）。
- `getArgon2HashFormatError(hash): string | null` 差异化中文错误：
  - 不以 `$argon2` 开头 →「哈希应以 $argon2id$ / $argon2i$ / $argon2d$ 开头」
  - 类型段不合法 / 版本段非 v=数字 → 格式提示；`v=16` →「v=16 老版本哈希暂不支持，请使用 v=19」；其他版本值 →「仅支持 v=19」
  - m,t,p 段格式不对 →「参数段格式应为 m=数字,t=数字,p=数字」
  - 盐/哈希段 b64 非法或解码失败 → 对应提示
- `validateArgon2Params(mKiB, t, p): string | null`：三范围 + `m ≥ 8×p`（「内存至少需要 8×并行度 KiB」）。
- `generateArgon2Salt(): Uint8Array`：`crypto.getRandomValues` 16 字节。
- Worker 协议（消息带 `kind` 便于错误归位，同 bcrypt）：
  - 请求 `{ kind:'hash', reqId, password, salt: Uint8Array, type, mKiB, t, p }` → 响应 `{ kind:'hash', reqId, ok:true, hash } | { kind:'hash', reqId, ok:false, error }`
  - 请求 `{ kind:'verify', reqId, password, hash }` → 响应 `{ kind:'verify', reqId, ok:true, match } | { kind:'verify', reqId, ok:false, error }`
  - worker 内 `argon2Verify` 包 try-catch，throw 一律转 `{ ok:false }` 中文兜底（正常格式错误已被派发前 parse 拦截，这里只剩罕见内部错误）。

### pbkdf2.ts

- `DJANGO_ALGO = 'pbkdf2_sha256'`。
- `parseDjangoPbkdf2Hash(hash): ParsedDjangoHash | null`：按 `$` 切 4 段（algo/iter/b64salt/b64hash）；b64 自动补 padding 容忍；返回 `{ iterations, saltBytes, hashBytes }`。
- `getDjangoHashFormatError(hash): string | null` 差异化中文错误：
  - 非 `$` 分段结构 →「格式应为 pbkdf2_sha256$迭代$盐$哈希」
  - 算法段是 `pbkdf2_sha1`/`pbkdf2_sha512` 等 →「暂仅支持 pbkdf2_sha256，不支持 {algo}」；非 pbkdf2 家族 →「不是 Django PBKDF2 哈希」
  - 迭代段非正整数 / 盐或哈希 b64 非法 → 对应提示
- `validatePbkdf2Params(iterations, dkLenBytes): string | null`（1–10,000,000 / 1–512）。
- `isValidHex(s)` / `hexToBytes` / `bytesToHex` / `generateRandomSaltHex(n = 16)`；b64 输出转换参考 `src/utils/crypto/sm2.ts`、`algorithms/sm4.ts` 既有辅助（有则提取复用，无则在本文件实现，不引新依赖）。
- Worker 协议：
  - `{ kind:'derive', reqId, password, saltBytes: Uint8Array, iterations, prf: 'SHA-1'|'SHA-256'|'SHA-384'|'SHA-512', dkLen }` → `{ kind:'derive', reqId, ok:true, hex } | { kind:'derive', reqId, ok:false, error }`（hex 单一权威格式；b64 由 UI 层从 hex 转换，避免双格式漂移）
  - `{ kind:'verify-django', reqId, password, iterations, saltBytes, expectedBytes }` → `{ kind:'verify-django', reqId, ok:true, match } | ...error`

## 组件层设计（两工具同构，照 `BcryptTool.vue` 终态模式）

通用（bcrypt 已验证的骨架，全部保留）：

- 慢计算四件套：按钮触发（不随键入计算）+ reqId 递增丢弃乱序 + 输入快照（派发时存 password/参数，回包比对不一致置 stale）+ 清空递增 reqSeq 使在途响应失效。
- 结果区：`CodePanel` label=「结果」show-copy show-clear，内容区 `min-h-24`；空态占位文案；stale 时内容 opacity-60 + 内联 warning（不新增行）。
- 校验区：解析行 `min-h-6`（粘贴即解析/报格式错，纯字符串操作）+ 校验按钮 + 结果行 `min-h-8` 四态（错误 / ✓ 匹配 text-success / ✗ 不匹配 text-error / 待校验 muted 占位）+ 内联 stale。
- 错误提示与按钮同行内联；主按钮无 hover 变色、`active:brightness-90`（DESIGN.md 矩阵）。

Argon2Tool 生成区参数面板：

- 类型：SelectListbox（argon2id 默认 / argon2i / argon2d）。
- 内存 m：数字输入，**单位 MiB（1–256，默认 64）**，内部 ×1024 转 KiB（比 KiB 直输友好）；t（1–10，默认 3）、p（1–8，默认 4）数字输入。
- 参数下方一句话耗时提示（「内存与迭代越大越安全也越慢，默认档约 0.1–0.5s」量级）。
- 默认密码示例 `DevTools@2026`（打开即可生成）。
- 校验区默认哈希用实现时生成的真实 argon2id 向量固化（低参数档如 m=1024,t=1,p=1 保证测试与首屏快）。

Pbkdf2Tool 生成区：

- 密码 + 盐（text/hex 模式切换；hex 模式实时校验非法字符给中文错误；「随机盐」按钮按当前模式填 16 字节）。
- 迭代次数：数字输入默认 600000 + 快捷档小按钮组（10万/30万/60万/100万，点击填入）；下方提示「OWASP 2023 对 SHA-256 推荐 60 万次」。
- PRF：SelectListbox（SHA-256 默认 / SHA-1 / SHA-384 / SHA-512）。
- dkLen：数字输入（1–512 字节，默认 32）。
- 结果区 hex/base64 切换（切换纯前端转换，不重算）。
- 校验区默认 Django 哈希用 spike 固化向量（密码 DevTools@2026 / 迭代 100，秒回）。

## 测试口径

`src/utils/crypto/__tests__/argon2.test.ts`（模式照 bcrypt.test.ts）：

1. PHC 解析：合法（三种类型、v=19、容忍首尾空白）+ 非法（前缀错 / v=16 / v=99 / m,t,p 段坏 / b64 非法 / 字段缺失）各分支 + 差异化错误文案断言。
2. 参数校验：范围边界（m=1024/262144 合法，两端外非法）、t/p 边界、`m < 8×p` 拦截。
3. **外部向量**：`argon2i` 固化串直算比对（spike 已验证的 somesalt 向量）。
4. roundtrip：三类型 hash → `argon2Verify` 正反例（node 直调 hash-wasm，vitest node 环境可用）；篡改哈希 → false。
5. 随机盐：长度 16、两次不同。

`src/utils/crypto/__tests__/pbkdf2.test.ts`：

1. Django 解析：合法（带/无 padding 两种 b64）+ 非法各分支（结构/算法 pbkdf2_sha1 提示/迭代非数字/b64 坏）+ 差异化文案。
2. hex 工具：合法/非法/往返。
3. **RFC 向量**：SHA-1 c=1/c=4096（RFC 6070）、SHA-256 c=1/c=2 四条固化 hex 断言（用 subtle 实算比对）。
4. **Django 固化向量**：spike 向量 verify 正反例（node subtle 复算 expectedBytes 比对）。
5. 参数校验边界。

## 体积与性能验收口径

- `pnpm build` 后在 `dist/` 全量搜 hash-wasm 特征字符串（如其 wasm blob 头 `AGFzbQ` 或 `argon2Verify` 标识），只允许出现在 argon2 worker chunk，**主包与其他 chunk 零出现**；主包 gzip 与构建基线比对零增长。
- pbkdf2.worker 零第三方 import。
- 两 worker 均 `{ type: 'module' }` 实例化，postMessage 结构化克隆传 Uint8Array。

## 风险与对策

| 风险 | 对策 |
|---|---|
| hash-wasm 停更（2024-11） | API 冻结 + 135 万周下载，接受；测试固化外部向量防行为漂移 |
| argon2Verify throw（英文内部错误） | worker try-catch 转中文兜底；派发前 parse 已拦截绝大多数格式错误 |
| v=16 老哈希 | parse 层差异化中文提示「暂不支持」，不进 worker |
| 低端机 256MiB 上限档耗时数秒 | 按钮 loading + worker 不卡 UI，可接受；上限值已防 OOM |
| hash-wasm 全量进 chunk（tree-shake 失效） | 构建后特征字符串扫描验收；若失效改用动态 import 仅引 argon2 命名导出重测 |
