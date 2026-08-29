# PostgreSQL 配置生成器 — 技术设计

前置阅读：`prd.md`、`research/postgres-params-version-notes.md`（全部默认值已逐参数核对官方文档，三版 16.15/17.11/18.6 docs tarball + `guc_tables.c`）。

## 1. 文件结构

```
src/components/config/            ← 新建：配置生成器系列共享表单层（第 3 消费者触发上浮，用户已批准）
├── types.ts                      ← ConfLine / ParamValue / ConfigParam / PARAM_UNITS（从两工具收敛）
├── NumberField.vue               ← 平移自 mysql-config（两份仅差 2 行，实质相同）
├── ConfigPreview.vue             ← 合并两份（差 7 行：label 文案 + serializeConf 来源）
├── ParamRow.vue                  ← 超集合并（Redis 版多 multi-select/密码生成；MySQL 版多废弃行）
└── __tests__/
    ├── NumberField.test.ts       ← 迁移自 mysql-config
    └── ParamRow.test.ts          ← 合并迁移 mysql + redis 两套用例

src/tools/devops/postgres-config/
├── version.ts                    ← PgVersion = '16'|'17'|'18'，TARGET_VERSIONS，isAvailable
├── params.ts                     ← 9 组 39 条目 + DOC_URLS 白名单 + PARAM_UNITS 扩展 + GenerateContext
├── compute.ts                    ← 预算公式（纯函数）
├── generate.ts                   ← 生成 postgresql.conf 行数组 + serializeConf
├── advice.ts                     ← buildOsAdvice（官方背书/社区惯例分区）+ buildReplicationHint
├── components/
│   ├── ControlPanel.vue          ← 私有：快捷画像（模式/版本/内存/CPU/磁盘/场景/并发/监听/端口/重置）
│   └── AdvicePanel.vue           ← 私有：OS 建议 + 备库要点提示块
└── __tests__/                    ← params/version/compute/generate/advice 5 套

src/tools/devops/PostgreSQLConfigGenerator.vue    ← 页面级组件（三块布局，照抄 MySQL 版骨架）
src/pages/devops/postgres-config-generator.astro  ← ToolLayout + client:idle
```

**删除**：`redis-config/components/{NumberField,ConfigPreview,ParamRow}.vue`、`mysql-config/components/{NumberField,ConfigPreview,ParamRow}.vue` 及对应测试文件（迁移后）。两工具保留各自的 `ControlPanel`/`SysctlPanel`/`AdvicePanel`（域相关）。

## 2. 共享层抽取（上浮契约）

### 2.1 types.ts（解耦工具类型的关键——扩展式契约）

两个 ParamRow 的 props 契约一致，但耦合各自工具的类型。**实测字段形状（独立核查员以两工具现有代码为准核对，实现时禁止改字段名）：**

- `ConfLine`：redis 为 `type: 'comment' | 'directive' | 'blank'`（redis-config/generate.ts:19-25），mysql 多一个 `'section'`（mysql-config/generate.ts:23-29）→ 共享层取**四值并集**
- `ConfigParam`：实际字段为 `key`（非 name）、`comment`（非 description）、`group` 与 `introducedIn` **必填**、`valueSuffix?`、`deprecatedIn?`/`replacedBy?`（mysql ParamRow 渲染弃用行直接读 `param.deprecatedIn`，mysql-config/components/ParamRow.vue:150-159）、`min/max/step?`、`compute(ctx)`（消费工具各自的上下文类型）、`secret?`（redis）；单位经 `PARAM_UNITS[param.key]` 查表（`unit` 是 NumberField 的展示 prop，**不是**参数定义字段）

因此共享层只抽**基类与并集类型**，工具侧以 `extends` 扩展各自字段，compute 留在工具侧（上下文类型不同），共享层零行为逻辑：

```ts
// src/components/config/types.ts
/** 单条 conf 产物行（redis/mysql 现有 type 并集） */
export interface ConfLine {
  text: string;
  type: 'comment' | 'directive' | 'section' | 'blank';
  paramKey?: string;
}
/** 参数值（跨工具并集） */
export type ParamValue = string | number | boolean | string[];
/** 档位区间（number 型参数的快捷 chips 依据） */
export interface ParamRange { conservative: number; recommended: number; aggressive: number; }
/** 参数定义基类：字段名与两工具现有代码一致，工具侧 interface extends 补 group/compute 等 */
export interface ConfigParamBase {
  key: string;                        // conf 指令名
  comment: string;                    // 中文说明
  control: 'number' | 'select' | 'multi-select' | 'switch' | 'text';
  introducedIn: string;               // 引入版本（=== baselineVersion 时徽章隐藏）
  deprecatedIn?: string;              // mysql 弃用行依据
  replacedBy?: string;
  secret?: boolean;                   // redis"生成随机密码"按钮开关（并入 base 便于共享 ParamRow 读取；mysql/PG 不设）
  min?: number;                       // NumberField clamp 下界（共享 ParamRow 透传）
  max?: number;                       // clamp 上界
  step?: number;                      // 原生步长
  options?: { value: string; label: string }[];
  range?: ParamRange;
  docUrl?: string;                    // 仅允许 DOC_URLS 白名单域名
}
/** 单位词汇表（两工具现有键全量并入；redis 连字符小写键与 mysql 下划线大写键并存不冲突，PG 新增键自选一种风格保持一致） */
export const PARAM_UNITS: Record<string, string> = { /* redis + mysql 现有键合并 */ };
```

工具侧保持现有 interface 名与全部字段（如 redis 的 `secret?`、两工具的 `compute(ctx)`/`group`/`valueSuffix`/`min/max/step` 仅把与 base 重复的字段声明换成 `extends ConfigParamBase`）；`generate.ts` 的 `ConfLine` 改从 types.ts 导入再 re-export（保持既有测试 import 路径可用）。**这样两工具 params.ts 除类型继承外零改动，满足 §2.4 回归门。**

### 2.2 ConfigPreview（序列化留在工具侧）

redis `key value`（无等号）与 mysql/PG `key = value` 序列化格式不同，`serializeConf` 必须留在各工具 `generate.ts`。共享版 props：

```ts
defineProps<{ lines: ConfLine[]; label: string; copyText: string }>()
defineEmits<{ download: []; reset: [] }>()
```

父层传 `label="postgresql.conf"`、`:copy-text="serializeConf(lines)"`。redis/mysql 页面各加一个 prop 传参，行为不变。行号/变动高亮/CodePanel 复用逻辑照抄现实现。

### 2.3 ParamRow（超集）

以 MySQL 版为基线，合入 Redis 版的 multi-select 控件与密码生成（密码生成从"组件内调 `generatePassword`"改为 `emit('generate-secret')`，由 redis 页面处理，解耦 `secret.ts`）。徽章基线改为 prop：

```ts
defineProps<{
  param: ConfigParam; value: ParamValue | null; recommended: ParamValue | null;
  version: string;                    // 徽章 title 用（PgVersion 等枚举的字符串形态）
  baselineVersion: string;            // introducedIn === baseline 时隐藏徽章（redis 'pre-7' / mysql '5.7' / pg '16'）
  hasOverride: boolean; deprecated?: boolean;
  enableSecret?: boolean;             // redis 传 true
}>()
defineEmits<{ update: [ParamValue]; reset: []; 'generate-secret': [] }>()
```

废弃行逻辑（deprecated → 不渲染控件不写 conf）与"（推荐）"下拉标记照 MySQL 版。**版本可用性判断不进共享组件**——父层据引擎 `isAvailable` 决定渲染还是传 `deprecated`，数据层逻辑留在工具。

### 2.4 回归门（重构完成的判定）

- `pnpm test` 全绿（redis/mysql 既有套件仅允许改 import 与新增 props 断言，禁止断言行为变化）
- `pnpm astro check` 零新增错误
- `pnpm build` 成功
- 浏览器冒烟：redis/mysql 两页打开即用、改值联动、复制/下载正常（冒烟纪律见 `.trellis/spec/frontend/quality-guidelines.md`）

## 3. 数据模型

```ts
export type PgVersion = '16' | '17' | '18';
export type Scenario = 'oltp' | 'read-heavy' | 'write-heavy' | 'analytics';

export interface GenerateContext {
  version: PgVersion;
  mode: 'single' | 'replica';        // 单机 / 主从
  memoryGB: number;                  // 1–512
  cpuCores: number;                  // 1–128（MySQL 版裁掉的 CPU 输入在此恢复：并行组公式的消费者）
  diskType: 'hdd' | 'ssd' | 'nvme';
  scenario: Scenario;
  concurrency: number;               // 期望并发连接
  listenScope: 'loopback' | 'intranet' | 'all';
  bindIp: string;                    // intranet 时用
  port: number;                      // 5432
  overrides: Record<string, string>; // 用户覆盖（画像字段驱动 compute，覆盖值优先）
}
```

`createDefaultContext()`：4GB / 4 核 / SSD / oltp / 200 并发 / single / loopback / 5432。画像字段改动只重算 compute，不清除 overrides（与 MySQL 版 `resetAll` 联动一致）；重置按钮重算并保留联动。

## 4. 版本建模（PG 比 MySQL 简单）

研究结论（research 文档 §版本差异清单）：PG minor 版本依据官方 versioning policy 不引入新参数、不改默认值（bug/安全修复为主），不存在 MySQL 的"轴点安全方向"陷阱；16→17→18 窗口内：

- **rename/移除仅 3 项且均不在本注册表**：`ssl_ecdh_curve`→`ssl_groups`（18，旧名仍可用）；`old_snapshot_threshold`、`trace_recovery_messages`（17 移除）
- **默认值变化仅 2 项**：`effective_io_concurrency`（16/17=1 → 18=16）、`maintenance_io_concurrency`（不在注册表）
- **类型变化 1 项**：`log_connections`（布尔→列表，18）——**不进注册表**，回避
- **18 独有参数**：`io_method`/`io_workers`（进注册表，组 8 仅 version=18 渲染）、`io_max_concurrency`/`autovacuum_worker_slots`/`autovacuum_vacuum_max_threshold`/`idle_replication_slot_timeout`（冷门，裁剪）

因此 `version.ts` 只需 `isAvailable(param, version)`（按注册表 `availableIn: PgVersion[]` 判断）+ `TARGET_VERSIONS` 标签；**无弃用徽章场景**（窗口内无 deprecated 参数），ParamRow 的 `deprecated` prop 保留但 PG 页恒传 false。

## 5. 参数注册表（9 组 39 条目）

组标题注释用英文（面板纯净产物原则，照 MySQL）。控制列：N=number，S=select，B=switch（on/off），T=text。

| # | 组（conf 注释标题） | 参数 | 默认/计算 | 控制 | 备注 |
|---|---|---|---|---|---|
| 1 | Connections & Authentication | listen_addresses | 按 listenScope：loopback→`'localhost'`、intranet→`'{bindIp}'`、all→`'*'` | S | 引号包裹 |
| | | port | 5432（快捷面板联动） | N | |
| | | max_connections | compute（§6） | N | |
| | | superuser_reserved_connections | 3 | N | 静态 |
| | | password_encryption | scram-sha-256 | S | 枚举 md5 备选；静态 |
| 2 | Memory | shared_buffers | compute：RAM×25% | N | 单位 MB 显示 |
| | | effective_cache_size | compute：RAM×60% | N | |
| | | work_mem | compute（§6） | N | |
| | | maintenance_work_mem | compute（§6） | N | |
| | | huge_pages | compute：<16G→off、≥16G→try | S | try/on/off；=try 指 hugetlbfs 显式大页，与 THP 无关（FAQ）；<16G 收紧为 off 是有意偏离官方默认 try，FAQ 注明 |
| 3 | Write-Ahead Log & Checkpoints | wal_level | replica | S | replica/minimal/logical；主从态同样输出 replica |
| | | wal_buffers | -1 | N | 静态（-1 自动取 shared_buffers/32） |
| | | wal_compression | compute：write-heavy→pglz、否则 off | S | 枚举 off/pglz/lz4/zstd，`on` 是 pglz 历史别名，不输出 on |
| | | max_wal_size | compute（§6） | N | |
| | | min_wal_size | compute：max_wal_size/8（下限 80MB） | N | |
| | | checkpoint_timeout | compute：write-heavy→15min、否则 5min | S | 5/15/30min |
| | | checkpoint_completion_target | 0.9 | N | 静态（14+ 默认 0.9） |
| 4 | Replication（仅主从态渲染） | max_wal_senders | 10 | N | 静态 |
| | | max_replication_slots | 10 | N | 静态 |
| | | wal_keep_size | 256MB | N | 静态（槽 + keep 双保险） |
| 5 | Parallel Query & Planner | max_worker_processes | compute：max(8, cpuCores) | N | |
| | | max_parallel_workers | compute：max(2, cpuCores−1) | N | 恒 ≤ max_worker_processes |
| | | max_parallel_workers_per_gather | compute：min(4, max(1, ⌊max_parallel_workers/2⌋)) | N | |
| | | jit | compute：oltp→off、否则 on | B | 短查询开销 > 收益（FAQ） |
| | | random_page_cost | compute：hdd→4.0、ssd→1.5、nvme→1.1 | N | |
| | | effective_io_concurrency | compute：ssd/nvme→200；hdd→16/17 版 1、18 版 16 | N | 18 默认 16（研究核对） |
| | | default_statistics_target | compute：analytics→200、否则 100 | N | |
| 6 | Autovacuum | autovacuum | on | B | 静态 |
| | | autovacuum_max_workers | 3 | N | 静态 |
| | | autovacuum_vacuum_scale_factor | compute：write-heavy→0.05、否则 0.2 | S | |
| | | autovacuum_vacuum_cost_limit | compute：write-heavy→2000、否则 200 | N | |
| 7 | Logging | logging_collector | off | B | 静态（stderr 交 systemd） |
| | | log_min_duration_statement | 1000（ms） | S | -1(关)/300/1000(推荐)/3000 |
| | | log_checkpoints | on | B | 静态（15+ 默认 on） |
| | | log_line_prefix | `'%m [%p] %u@%d '` | T | 引号包裹 |
| 8 | Asynchronous I/O（仅 v18） | io_method | worker | S | worker/sync/io_uring；16/17 下整组隐藏 |
| | | io_workers | 3 | N | |
| 9 | Timezone | timezone | 'Asia/Shanghai' | T | 引号包裹；UI 可改 |
| | | log_timezone | 'Asia/Shanghai' | T | 引号包裹；UI 可改 |

计数：5+5+7+3+7+4+4+2+2 = **39 条目 / 9 组**（符合常用项原则）。

**裁剪备忘**（写入 FAQ 或注释）：`shared_preload_libraries`（空串无输出价值 → FAQ 讲 pg_stat_statements 启用）、`log_connections`（18 类型变化，回避）、`maintenance_io_concurrency`（冷门且 18 改默认，陷阱项）、`lc_collate`/`lc_ctype`/`server_encoding`/`data_checksums`（**仅 initdb 可设**，写进 conf 非法）、`io_max_concurrency`/`autovacuum_worker_slots` 等（18 独有冷门项）、连接级缓冲区无 PG 对应物（PG 无 per-connection buffer 概念）。

**DOC_URLS 白名单**：仅 `postgresql.org`。每条目 docUrl 指向 18 文档锚点（如 `https://www.postgresql.org/docs/18/runtime-config-resource.html#GUC-SHARED-BUFFERS`），来自 research 核对表。

**渲染语法**：`key = value`（等号两侧空格，同 my.cnf 风格）；布尔 on/off；内存 `4GB`/`512MB`、时间 `15min`、`1s` 等带单位字面量；自由文本字符串加单引号（listen_addresses/log_line_prefix/timezone），枚举不加引号（wal_level = replica、password_encryption = scram-sha-256）。文件头注释：生成器标识 + "datadir/hba_file/外部配置由 initdb 与服务管理器管理，本文件为最小化常用配置，未列出参数使用内置默认值"。

## 6. 计算公式（compute.ts）

| 函数 | 公式 | 依据 |
|---|---|---|
| computeSharedBuffersMB | `max(128, RAM_MB × 0.25)`，取 128MB 整数倍向下 | 官方 25% 起步口径 |
| computeEffectiveCacheSizeMB | `RAM_MB × 0.60` | 官方"估算 OS 缓存"，50–75% 取中 |
| computeWorkMemMB | 基础 `<16G→8`、`≥16G→16`；analytics ×4；上限 64 | work_mem 为每操作配额（FAQ），保守起步 |
| computeMaintenanceWorkMemMB | `clamp(RAM_MB×0.05, 128, 2048)` | VACUUM/索引构建用 |
| computeMaxConnections | `min(ceil(concurrency×1.2/10)×10, memoryGB×25)`，下限 20 | 4G 内存恰好 100（官方默认），内存封顶防 OOM |
| computeMaxWalSizeMB | `<8G→1024`、`8–32G→2048`、`≥32G→4096`；write-heavy ×2，上限 8192 | 照 MySQL redo 阶梯形制 |
| computeMinWalSizeMB | `max(80, maxWalSize/8)` | 与 max 保持比例 |
| computeWorkerProcesses | `max(8, cpuCores)` | 官方默认 8 起步 |
| computeParallelWorkers | `max(2, cpuCores−1)` | 恒 ≤ max_worker_processes |
| computeParallelPerGather | `min(4, max(1, ⌊parallelWorkers/2⌋))` | gather 过多拖慢小查询 |
| computeJit | oltp→off、其余 on | 短查询 JIT 不划算 |
| computeRandomPageCost | hdd 4.0 / ssd 1.5 / nvme 1.1 | SSD 常见建议 |
| computeIoConcurrency | ssd/nvme→200；hdd→(16/17: 1，18: 16) | 尊重 18 新默认 |
| computeStatisticsTarget | analytics→200、否则 100 | 复杂分析查询收益 |
| 其余静态项 | 直接注册表默认值 | — |

## 7. 组件与页面

**PostgreSQLConfigGenerator.vue**（照抄 MySQLConfigGenerator.vue 三块骨架）：

- 顶部快捷配置 ControlPanel：模式（单机/主从）/ 版本 / 内存 GB / **CPU 核数（恢复）** / 磁盘 / 场景 / 并发 / 监听范围+绑定 IP+端口 / 重置。**无密码项**（PG 密码不存 conf，属 pg_hba + ALTER ROLE，FAQ 提示）
- 右侧粘性 ConfigPreview（共享）：label `postgresql.conf`，复制/下载/清空（重置推荐值）
- 下方分组折叠列表：共享 ParamRow 渲染，组 4 仅主从态、组 8 仅 v18；单参重置；弃用行不出现
- 底部 AdvicePanel：OS 建议（§8）+ 备库要点（仅主从态）+ 免责声明

**onMounted**：PG 无 server_id/requirepass 类实例级随机值 → **无随机种子逻辑**（比两前作少一处）。

## 8. advice.ts

`buildOsAdvice(ctx)`（来源分区，研究文档 §5）：

- **官方文档背书**（kernel-resources.html + huge_pages 参数页）：禁用透明大页 THP（huge_pages 条目原文 "known to cause performance degradation … currently discouraged"；具体取值 never/madvise 属社区惯例）；`vm.overcommit_memory=2`（配 `vm.overcommit_ratio=90`，防 OOM killer 误杀 postmaster）；`huge_pages = try/on` 时按官方流程分配 `vm.nr_hugepages`（`/proc/meminfo` 核对 HugePages_Total）；`fs.file-max` 按连接规模上调
- **社区惯例**（明确标注"官方文档未覆盖"）：`vm.swappiness=1`、`ulimit -n 65535`

`buildReplicationHint(ctx)`（仅主从态；16–18 语法一致无分支）：

```
-- 1. 主库建复制角色与物理槽
CREATE ROLE replicator WITH LOGIN REPLICATION PASSWORD '...';
SELECT pg_create_physical_replication_slot('standby1');
-- 2. 备库初始化（-R 写 standby.signal 与 primary_conninfo/primary_slot_name 到 postgresql.auto.conf）
pg_basebackup -h <主库IP> -U replicator -D <PGDATA，按所选版本插值如 /var/lib/postgresql/18/main> -X stream -C -S standby1 -R
```

加备库要点列表：standby 的 max_connections / max_worker_processes / max_wal_senders 必须 ≥ 主库（官方原文依据）；hot_standby 默认已 on（PG 10+）无需写；standby conf 随 basebackup 继承，差异项写 postgresql.auto.conf。

## 9. 注册

- `tools.ts`：`id 'postgres-config-generator'`，category `开发与运维`，path `/devops/postgres-config-generator`，name `PostgreSQL 配置生成器`，icon `🐘`，relatedToolIds `['mysql-config-generator','redis-config-generator','docker-run-helper']`；mysql/redis 两处 relatedToolIds 反向追加
- `tool-faqs.ts`：key `postgres-config-generator`，5 条 FAQ（①直接可用性与 pg_hba/重载方式 ②work_mem 每操作语义 ③shared_buffers 为何只 25% ④lc_collate/lc_ctype 为何不能出现在 conf ⑤v18 的 io_method 与 io_* 组为何只在 18 显示）
- SEO 全字段；FAQ 同步

## 10. 取舍与风险

| 取舍 | 理由 |
|---|---|
| 上浮 3 组件到 `src/components/config/` | 用户已批准；第 3 消费者，消除 ~460 行三重漂移；契约用扩展式（extends 基类），两工具 params.ts 零字段改动 |
| serializeConf/copyText 留在工具侧 | redis 与 mysql/PG 序列化格式本质不同 |
| 版本可用性判断留在工具引擎 | ParamRow 保持纯展示，PG 无弃用场景 |
| 无弃用徽章 | 16–18 窗口内无 deprecated 参数（研究核对） |
| 回避 log_connections | 18 布尔→列表类型变化，渲染分叉不值得 |
| CPU 输入恢复 | 并行组 3 项公式的消费者；MySQL 裁它只因 io_threads 被裁 |

**风险**：① ParamRow 超集合并动 redis/mysql 已上线行为——以回归门（§2.4）兜底，重构与 PG 开发分步 commit；② `postgresql.conf` 快照测试锚点（`^key = value` 正则断言区分注释）；③ redis ConfigPreview 的 `reset` emit 语义（CodePanel clear）须在共享版保留。

**Deferred**：内存账单动态插值（静态文案）；my.cnf/redis.conf 导入解析；pg_hba.conf 生成（仅提示）。
