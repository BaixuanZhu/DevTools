# PostgreSQL 配置生成器 — 执行计划

前置：`prd.md`（需求与验收）、`design.md`（技术设计，本文只列顺序与验证点）、`research/postgres-params-version-notes.md`（参数核对）。

## 执行顺序

### 步骤 0：共享层上浮（先行独立 commit，回归门隔离风险）

1. 新建 `src/components/config/types.ts`（ConfLine 四值并集 / ParamValue / ParamRange / ConfigParamBase / PARAM_UNITS；**扩展式契约**：工具侧 `interface extends ConfigParamBase`，字段名以两工具现有代码为准禁止改名，见 design §2.1）
2. 平移 `NumberField.vue`（mysql 版为基线，diff 仅 2 行）
3. 合并 `ConfigPreview.vue`（props 增 `label`/`copyText`，serializeConf 留工具侧，design §2.2）
4. 合并 `ParamRow.vue`（MySQL 超集 + redis 的 multi-select 与 `emit('generate-secret')`，`version`/`baselineVersion` prop 化，design §2.3）
5. redis/mysql 两工具改 import + 补 props（label/copyText/baselineVersion/enableSecret），删除私有三组件
6. 测试迁移：mysql `NumberField.test.ts`/`ParamRow.test.ts` → `src/components/config/__tests__/`，redis `ParamRow.test.ts` 用例并入（multi-select/密码走 emit 断言）；adapt props
7. **回归门（design §2.4）**：`pnpm test` / `pnpm astro check` / `pnpm build` 全绿 + redis/mysql 浏览器冒烟（打开即用/改值联动/复制下载）→ 通过后才进入步骤 1

### 步骤 1：引擎数据层（纯函数，无 Vue import）

1. `version.ts`：PgVersion/TARGET_VERSIONS/isAvailable（design §4，无弃用逻辑）
2. `params.ts`：9 组 39 条目 + DOC_URLS 白名单（仅 postgresql.org）+ PARAM_UNITS 扩展 + GenerateContext/createDefaultContext（含 cpuCores）；select 选项值非空
3. `compute.ts`：§6 公式表逐条实现
4. `generate.ts`：header 注释 → 逐组空行+英文标题+`key = value`；serializeConf（等号风格，字符串引号规则见 design §5）
5. `advice.ts`：buildOsAdvice（官方背书/社区惯例分区）+ buildReplicationHint（design §8）
6. 5 套单测（`__tests__/`）：params（select 非空不变量等）、version（18-only 矩阵）、compute（公式阶梯）、generate（快照 + `^key = value` 指令断言）、advice（分区与提示块）

### 步骤 2：UI 层 + 注册

1. `components/ControlPanel.vue`：模式/版本/内存/CPU/磁盘/场景/并发/监听+IP/端口/重置；无密码项
2. `components/AdvicePanel.vue`：OS 建议 + 备库要点（主从态）+ 免责声明
3. `PostgreSQLConfigGenerator.vue`：三块布局照 MySQL 骨架；消费共享 ParamRow/ConfigPreview；无 onMounted 随机种子
4. `pages/devops/postgres-config-generator.astro`：ToolLayout + `client:idle`
5. `data/tools.ts` 注册（icon 🐘，relatedToolIds 双向）+ `data/tool-faqs.ts` 5 条

### 步骤 3：验证

```bash
pnpm test          # 全量（既有 9 个基线失败为已知，见下）
pnpm astro check
pnpm build
```

- 已知基线：theme.test.ts 3 / SearchPanel.test.ts 5 / Shell.test.ts 1 共 9 个历史失败与本任务无关（MySQL 任务已确认基线），零新增失败为通过线
- 浏览器冒烟（纪律见 `.trellis/spec/frontend/quality-guidelines.md`）：AGENT_BROWSER_SESSION 每条命令重导出；PG 页打开即用/版本切换（18 组显隐）/主从切换/移动端；redis/mysql 回归

### 步骤 4：trellis-check 子代理 → 修复 → （用户确认后）finish/archive + merge + push

## 风险文件 / 回滚点

| 文件 | 风险 | 回滚 |
|---|---|---|
| `redis-config/components/*`、`mysql-config/components/*` 删除 | 上线工具行为回归 | 步骤 0 独立 commit，revert 即回滚 |
| `tools.ts` relatedToolIds 双向追加 | 注册表回归 | 既有集成测试覆盖 |
| `PostgreSQLConfigGenerator.vue` 快照测试 | conf 格式漂移 | `^key = value` 正则 + 快照双锚 |

## task.py start 前检查单

- [ ] implement.jsonl / check.jsonl 已策展（≥1 条真实 spec/research 条目）
- [ ] design.md §2 契约与 §6 公式表经用户批准（最终规划摘要）
- [ ] 回归门标准（§2.4）已写明
