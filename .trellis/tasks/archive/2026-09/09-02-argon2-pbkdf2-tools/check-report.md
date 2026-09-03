# Check Report: Argon2 + PBKDF2 双工具质量核查

核查时间：2026-09-03（check agent 独立复跑，含修复）

## 门禁结果（修复后复跑）

| 门禁 | 结果 |
|---|---|
| `pnpm test` | 101 文件 / **1538 用例全绿**（较上轮 +1，为本次核查新增回归用例） |
| `pnpm astro check` | **0 errors / 0 warnings** / 14 hints（与干净基线一致） |
| `pnpm build` | 成功，76 页 |

## 必修问题（已修复 1 项）

### 1. `getArgon2HashFormatError` 与 `parseArgon2Hash` 对 `=` padding 口径分裂

- 位置：`src/utils/crypto/argon2.ts`（原 158-165 行）
- 现象：PHC 规范盐/哈希段为无 padding b64，`parseArgon2Hash` 正则 `[A-Za-z0-9+/]+` 拒绝 `=`，但格式检查函数用 `decodeBase64Loose`（atob 容忍 padding）判定——粘贴带 `=` 的盐/哈希段时：解析行空白（parse null 且 formatError 空）、点击校验把非法哈希发进 worker 只得到通用兜底错误。design.md 要求「盐/哈希段 b64 非法或解码失败 → 对应提示」，该差异化分支缺失。
- 修复：新增 `PHC_B64_RE = /^[A-Za-z0-9+/]+$/` 字符集校验并入盐/哈希段判定，文案更新为「应为无 = 补位的 Base64 字符串」，修复后 formatError='' ⟹ parse≠null（两函数接受集一致）。
- 回归：`argon2.test.ts` 新增用例（padded 盐段/padded 哈希段双向断言 formatError 与 parse 一致拒绝），1538 全绿。

## 建议项（未修复，附理由）

1. **校验区对哈希内参数无范围拦截**：粘贴 m 超上限（如 262144 KiB 以上）的 argon2 哈希会直接进 worker 长时间计算。与 bcrypt（cost=31 粘贴同理）口径一致，属三工具共享的既有取舍；worker 内 wasm 分配失败可 catch 转 Chinese 兜底，不炸主线程。如需硬化（校验前比对 m ≤ M_MAX_KIB 给中文错误），建议与 bcrypt 一并统一处理，不属本任务回归。
2. **Pbkdf2Tool `paramError` 字段归位的边角**：iterations 为范围内非整数（如 600000.5）时错误文案落在 dkLen 提示行（拆位条件按范围而非校验函数判定）。文案本身明确指向迭代次数，影响极小；彻底修法是拆 `iterError`/`dkLenError` 两个 computed，因涉及模板改动且主会话已冒烟，本轮不动。

## 逐条核查结论（对照 dispatch 10 项）

1. **规格符合** ✓ worker 协议 reqId/kind/ok 判别联合完整；差异化中文错误全覆盖（argon2 前缀/类型/版本含 v=16 专门文案/参数段/b64 段，Django 结构/字段数/算法族/迭代/b64 段）；参数校验 m∈[1024,262144] KiB 且 m≥8p、t∈[1,10]、p∈[1,8]、迭代∈[1,10⁷]、dkLen∈[1,512] 全部落地且常量守卫测试固化。
2. **慢计算四件套** ✓ 两工具照搬 bcrypt 终态：按钮触发 / reqId 递增丢弃乱序 / 回包输入快照逐字段比对（Argon2 全 5 输入、PBKDF2 全 6 输入含 saltMode）/ 清空递增 reqSeq。计算窗口内改输入的竞态兜底存在且覆盖全部参与运算的输入。
3. **UI 硬性四点** ✓ 结果区标签「结果」；复制/清空内嵌 CodePanel 标题栏（copyText 空 `:disabled` + opacity-50，不隐藏）；min-h 预留（内容 min-h-24 / 解析行与各参数提示行 min-h-6 / 结果行 min-h-8）；stale 内联于既有区域不加新行。Tailwind 任意值仅 `text-[0.8125rem]`（设计令牌字号）与 `transition-[...]`（自定义效果），无标准类可表达的违规。
4. **类型安全** ✓ astro check 0 errors；无 any / as 双重断言 / 路径别名；worker 消息为带 kind 的判别联合，主线程/worker 两侧类型对称。
5. **代码复用** ✓ 骨架与 bcrypt 对称是 design 要求；hex/b64 私有辅助与 sm2/sm4 既有惯例一致（各模块私有，不强行上提）；pbkdf2 派生/校验实现放纯函数层供 worker 与单测共用（测试口径=线上路径）；无大段死代码复制。
6. **数据一致性** ✓（脚本核验）argon2/pbkdf2：title 44/42（区间 25-60）、seoDescription 139/128（区间 120-160）、keywords 8/7（区间 5-10）；relatedToolIds 全表引用有效无自引用，argoin2↔pbkdf2↔bcrypt 三方互链与 PRD 一致；crypto 分类 7 工具与 PRODUCT.md 5→7 同步；categories.ts crypto seoDescription 157 过守卫；FAQ 各 5 条且 key 与工具 id 对齐。
7. **安全** ✓ 无 eval/Function(string)/字符串 timer；全部正则为静态字面量（无用户输入构造 pattern 场景）；随机源均 crypto.getRandomValues。
8. **注释** ✓ 新增公共函数/接口/常量全部有 JSDoc/TSDoc 且与实现一致（含本次修复同步补充了「为什么」注释）。
9. **门禁** ✓ 三门全绿（本报告开头数据）。
10. **依赖** ✓ hash-wasm 运行时 import 仅 `argon2.worker.ts`（另 argon2.test.ts 单测直调）；dist 复扫：wasm blob 特征 `AGFzbQ` 仅在 `argon2.worker-*.js`（29.8KB）与既有 libheif；`argon2Verify` 标识在主包/其他 chunk 0 出现（`argon2id` 命中为 UI 文案与 parse 正则字面量，非库代码）；pbkdf2.worker chunk 934 字节零第三方。

## 核查文件清单

新增 10 文件 + 修改 5 文件全部逐行核查；参照对照阅读 `BcryptTool.vue`、`bcrypt.ts`、`CodePanel.vue`、`tools.test.ts`、`crypto.test.ts`。

## 结论

实现质量高，与 bcrypt 基准模式和 PRD/design 约定高度一致。发现并修复 1 项必修（PHC padding 口径分裂 + 回归用例），2 项建议留档。三门复跑全绿，可进入提交流程（主会话冒烟已做过，修复仅改 util 层判定分支与文案，风险面窄）。
