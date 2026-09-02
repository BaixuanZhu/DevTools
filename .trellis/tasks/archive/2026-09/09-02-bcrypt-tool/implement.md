# 执行计划：BCrypt 密码哈希工具

> 前置：本清单经评审、`task.py start` 激活后执行。实现主体派发 `trellis-implement`，验证派发 `trellis-check`（主会话不内联实现）。

## 顺序清单

### 0. Spike：依赖可行性（gate，最先做）

- [ ] `pnpm add bcryptjs`（^3.0.3）
- [ ] dev 服务器下临时在 BcryptTool.vue 雏形里直接 `import bcrypt from 'bcryptjs'` 跑通 `hashSync('x', '$2b$10$<手写合法盐>')` 与 `compareSync`，确认 Vite 不报 `crypto` 裸引用解析错误
- [ ] 确认 `new Worker(new URL('./bcrypt.worker.ts', import.meta.url), { type: 'module' })` 构建路径可用
- [ ] 失败兜底按 design.md 风险表处理（vite alias/external），并把结论记 journal

### 1. 纯逻辑层 `src/utils/crypto/bcrypt.ts`

- [ ] `BCRYPT_BASE64_ALPHABET` / `encodeBcryptBase64` / `generateSalt`（Web Crypto 随机源，默认 `$2b` 前缀）
- [ ] `parseBcryptHash`（全前缀兼容，非法返回 null）+ 差异化中文错误文案映射（放 UI 层或 util 层返回原因码，实现时定，保持可测）
- [ ] `getPasswordByteInfo`（TextEncoder，72 字节阈值）
- [ ] 常量 `COST_MIN=4` / `COST_MAX=15` / `COST_DEFAULT=10`
- [ ] 全部公共导出带 TSDoc（AGENTS.md 注释规则）

### 2. Worker `src/utils/crypto/bcrypt.worker.ts`

- [ ] 消息协议 `{ kind:'hash'|'compare', reqId, password, salt?|hash? }` → `{ reqId, ok:true, result } | { reqId, ok:false, error }`
- [ ] 内部用 `hashSync`/`compareSync`（worker 内无需 async 分块）

### 3. 组件 `src/tools/crypto/BcryptTool.vue` + 路由 `src/pages/crypto/bcrypt.astro`

- [ ] 两段式布局（生成区 / 校验区 border-t 分隔），`max-w-180` 单列，样式全走语义 token（DESIGN.md）
- [ ] 生成区：密码输入 + 72 字节警告 + cost SelectListbox（4–15 + 量级说明）+ Primary 生成按钮 + 结果卡片（CopyButton/ClearButton、stale 过期弱化）
- [ ] 校验区：哈希输入 + 即时解析条 + 非法格式中文错误 + 密码输入 + 校验按钮 + ✓/✗/错误三态 + 清空
- [ ] reqId 递增丢弃过期响应；计算中按钮 disabled
- [ ] 默认值：示例密码 + cost 10（打开即可体验）

### 4. 注册与数据

- [ ] `src/data/tools.ts` 新增 `bcrypt` 条目（title/seoDescription 按 prd 草案，过守卫区间）
- [ ] `hash-generator` 的 `relatedToolIds` 追加 `bcrypt`
- [ ] `src/data/tool-faqs.ts` 新增 `'bcrypt'` 键 5 条（prd 草案）
- [ ] `src/data/categories.ts` crypto `description`/`seoDescription` 补 BCrypt 密码哈希（重数 120–160）
- [ ] `PRODUCT.md` 分类表 加密与安全 4→5 + 代表工具补「BCrypt 密码哈希」

### 5. 测试

- [ ] `src/utils/crypto/__tests__/bcrypt.test.ts`：design.md 测试设计 5 组用例（含 known-answer 向量，取自 bcryptjs 官方测试集）
- [ ] 全量 `pnpm test`（注册表守卫自动验证新条目 title/seoDescription 长度）

### 6. 验证门禁（最后一轮全量）

```bash
pnpm test          # 全部测试含新用例与守卫
pnpm astro check   # TS strict
pnpm build         # 构建产物 + chunk 清单
```

- [ ] 核对 build 输出：主包 gzip 不因 bcryptjs 增长；bcryptjs 位于 worker chunk
- [ ] agent-browser 冒烟：默认值生成→复制→回贴校验 ✓；错密码 ✗；非法哈希报错；cost 切换；暗色模式无硬编码色

### 7. 收尾

- [ ] `trellis-check` 子代理全量核查
- [ ] `trellis-update-spec`：如产生可沉淀约定（如"慢哈希类工具按钮触发 + stale 标记模式"）写入 spec
- [ ] Phase 3.4 提交（单 commit，feat(crypto)），更新 journal
- [ ] 用户验收后 `/trellis:finish-work` 归档

## 回滚点

- 步骤 0 失败且兜底无效 → 终止任务，不产生任何生产代码改动
- 全量交付单 commit，`git revert` 即完整回滚（无 URL 变更、无 redirects、无共享模块改动）
