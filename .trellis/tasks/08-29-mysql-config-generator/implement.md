# 实施计划 — MySQL 配置文件生成器

## 执行顺序

1. **research/mysql-params-version-notes.md**：核对并记录版本矩阵（官方 MySQL 文档为准）
   - 5.7 → 8.0 移除/改名：query_cache_*、tx_isolation/tx_read_only、默认字符集
   - 8.0 → 8.4 移除/替换：expire_logs_days（8.2 实移）、innodb_log_file_size（8.0.30 废弃未移除）、default_authentication_plugin（8.4 移除）、mysql_native_password 默认停用
   - 补丁级精度项：8.0.26（replica_* 改名）、8.0.27（authentication_policy 引入）、8.0.30（innodb_redo_log_capacity 引入）——轴点安全方向
   - 逐参数标注 introducedIn / deprecatedIn / replacedBy / docUrl，**定稿 ~30 参数 × 9 组清单（常用项原则 + 覆盖度终检，含全文检索 ngram 组；裁剪与排除清单见 research 笔记）**
2. **引擎数据层**（按依赖序）：`version.ts` → `params.ts`（参数注册表 + 分组 + 中文注释 + 推荐范围）→ `compute.ts`（公式层，见 design.md §关键公式）→ `generate.ts`（`[mysqld]` 段头 + `key = value` 渲染）→ `advice.ts`（OS 建议 + 复制 SQL 提示）→ `serverid.ts`
3. **私有组件**（从 redis-config/components 复制改造）：NumberField → ConfigPreview → ParamRow（改名对徽章 + 内存账单注释）→ AdvicePanel → ControlPanel（PRD §1 字段集，无密码行）
4. **页面级组件**：`MySQLConfigGenerator.vue`（布局三区块对齐 Redis 版；onMounted 种子 overrides.server_id）
5. **路由**：`src/pages/devops/mysql-config-generator.astro`（ToolLayout + client:idle）
6. **注册**：`src/data/tools.ts` 全字段 + `src/data/tool-faqs.ts` FAQ
7. **测试**：`mysql-config/__tests__/`——compute（buffer pool/内存账单/双 1/改名对输出）、version（5.7/8.0/8.4 过滤与替换提示）、generate（`=` 渲染、段头、废弃跳过）、params 不变量（select 选项值非空串）；组件测试按需（ParamRow）
8. **验证门**：`pnpm build` / `pnpm test` / `pnpm astro check` 全绿 → dev server 浏览器冒烟（agent-browser：打开即用、版本切换、主从联动、移动端宽度、暗色模式）→ sitemap 收录确认

## 验证命令

```bash
pnpm test src/tools/devops/mysql-config   # 引擎单测
pnpm test                                  # 全量回归（redis-config 不得回归）
pnpm astro check                           # TS 严格检查
pnpm build                                 # 生产构建 + sitemap
```

## 风险文件与回滚点

- **唯一共享文件改动**：`src/data/tools.ts`（追加数组项）、`src/data/tool-faqs.ts`（追加 key）——改动前 grep 确认注册表结构未变
- **版本矩阵准确性**是最大领域风险：research 笔记逐条对照官方文档，存疑参数宁可不进注册表
- 回滚 = 删 `MySQLConfigGenerator.vue` + `mysql-config/` + 路由文件 + 注册项；无迁移成本

## task.py start 前检查

- [ ] prd.md / design.md / implement.md 三件套齐备并经用户批准（评审门）
- [ ] implement.jsonl / check.jsonl 各含至少一条真实 spec/research 条目
- [ ] research/mysql-params-version-notes.md 骨架已建（实现第 1 步填充）
