# Implement: Argon2 与 PBKDF2 密码哈希工具

## 做了什么

与 bcrypt 完全对称的两组「纯逻辑层 + Worker + 工具组件 + 路由页」：

| 文件 | 职责 |
|---|---|
| `src/utils/crypto/argon2.ts` | PHC 正则解析（容忍首尾空白、v≠19 拒绝）、差异化中文格式错误（前缀/类型/版本 v=16 专门文案/参数段/盐哈希 b64 段逐段定位）、`validateArgon2Params`（m 1-256 MiB、t 1-10、p 1-8、m≥8×p）、16 字节随机盐、Worker 协议类型 |
| `src/utils/crypto/argon2.worker.ts` | 唯一 import hash-wasm 的文件（argon2id/i/d + argon2Verify）；英文 throw 统一 catch 转中文兜底 |
| `src/utils/crypto/pbkdf2.ts` | Django `pbkdf2_sha256$iter$b64盐$b64哈希` 解析（b64 容忍缺省 padding）、差异化中文错误（结构/算法族/迭代/b64 段）、`isValidHex`/`hexToBytes`/`bytesToHex`/`bytesToBase64`、`generateRandomSalt`（text/hex 双模式）、`derivePbkdf2Bytes`/`verifyDjangoPbkdf2`（Web Crypto subtle，worker 与单测共用同一实现）、参数校验（迭代 1-1000 万、dkLen 1-512）、Worker 协议类型 |
| `src/utils/crypto/pbkdf2.worker.ts` | 零第三方 import，只做消息分发，复用 pbkdf2.ts 纯函数 |
| `src/utils/crypto/__tests__/argon2.test.ts` | 22 用例：PHC 解析合法/非法各分支、差异化文案、参数边界 + m≥8p、外部 argon2i 向量直算比对、三类型 roundtrip 正反例、篡改哈希→false、v=16 throw 行为固化、随机盐 |
| `src/utils/crypto/__tests__/pbkdf2.test.ts` | 22 用例：Django 解析（有/无 padding）与错误分支、hex 工具往返、RFC 6070 SHA-1×2 + SHA-256×2 known-answer、Django 固化向量 verify 正反例、参数边界 |
| `src/tools/crypto/Argon2Tool.vue` | 生成区（类型 SelectListbox + 内存 MiB/t/p 数字输入 + 耗时提示行）+ 校验区（解析行 + 结果行四态） |
| `src/tools/crypto/Pbkdf2Tool.vue` | 派生区（盐 text/hex 切换 + 随机盐按钮 + 迭代快捷档 + PRF + dkLen + hex/Base64 输出切换）+ Django 校验区 |
| `src/pages/crypto/argon2.astro`、`pbkdf2.astro` | ToolLayout 包裹 + `client:idle` |

注册与文档同步：`tools.ts` 新增 argon2/pbkdf2 全字段条目 + bcrypt relatedToolIds 更新为 `['argon2','pbkdf2','hash-generator']`；`tool-faqs.ts` 各 5 条；`categories.ts` crypto description/seoDescription 补两工具；`PRODUCT.md` 分类表 5→7。

## 关键决策（沿用 design.md spike 结论）

1. **内存 UI 用 MiB**：输入 1-256、默认 64，派发前 ×1024 转 KiB，比 KiB 直输友好。
2. **pbkdf2 派生 hex 为单一权威格式**：worker 只回 hex，Base64 由 UI 层从 hex 纯前端转换（切换不重算），避免双格式漂移。
3. **派生/校验实现放 pbkdf2.ts 纯函数层**，worker 与单测共用同一条代码路径（测试口径 = 线上路径）。
4. **v=16 老哈希在 parse 层拦截**（专门中文文案），不进 worker；worker 内 argon2Verify 英文 throw 一律 catch 转中文兜底。
5. **m≥8p 守卫紧跟 m 范围判定**：当前 M_MIN(1024) ≥ 8×P_MAX(64)，UI 域内天然满足，守卫防御程序化调用与未来下修下限。
6. **Argon2Tool 校验区默认哈希**为 node 直调 hash-wasm 实算固化的真实向量（argon2id, m=1024,t=1,p=1, 盐 `devtools-salt-16`, 密码 `DevTools@2026`），毫秒级秒回；本轮实现时已用 node 重算核对一致且 verify 正反例均正确。
7. **迭代提示行拆两处防抖动**：迭代超限错误显示在迭代框下、dkLen 错误显示在长度框下（同一 `paramError` computed 按字段归位），均 min-h-6 预留零跳动。
8. **盐模式切换做无损转换**：text→hex 按 UTF-8 字节转；hex→text 仅在合法 hex 且可无损 UTF-8 解码时转换，否则保留原值由用户改。

## 自检结果（2026-09-03）

- `pnpm test`：**101 文件 / 1537 用例全绿**（含 argon2.test.ts 22 + pbkdf2.test.ts 22 + tools.test.ts 注册守卫 11）。
- `pnpm astro check`：**0 errors / 0 warnings**（14 hints 与干净 HEAD 基线完全一致，均为存量）。
- `pnpm build`：成功，76 页。
- **hash-wasm 隔离扫描（dist/）**：wasm blob 特征 `AGFzbQ` 仅出现于 `dist/_astro/argon2.worker-BWMjSBIp.js`（29.8KB）与存量的 `libheif-bundle`（图片工具既有依赖，与本任务无关）；主包与其他 chunk 零出现。`argon2.worker` 仅被 Argon2Tool 岛 chunk 引用；`pbkdf2.worker` chunk 仅 934 字节（零第三方）。
- 工具页四件套：中文差异化错误 / 清空与复制（CodePanel 标题栏内嵌，空态禁用）/ 打开即用默认值（密码 `DevTools@2026` + 固化默认哈希）/ SEO 全字段（title/seoDescription/keywords/FAQ 齐备，守卫测试通过）。

## 遗留问题

- 无功能遗留。建议主会话在浏览器做一次冒烟（生成→回贴校验→参数超限报错→Django 校验正反例），与 spec 的「三门全绿后浏览器冒烟」惯例对齐；本轮按任务验收清单执行，未含该项。
