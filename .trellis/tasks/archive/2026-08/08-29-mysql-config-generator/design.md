# 技术设计 — MySQL 配置文件生成器

## 总体结构

```
src/
├── pages/devops/mysql-config-generator.astro    # 路由：ToolLayout 包裹 + client:idle
├── tools/devops/MySQLConfigGenerator.vue        # 工具主组件（页面级）
└── tools/devops/mysql-config/                   # 私有目录（不上浮全局 components/）
    ├── params.ts            # 参数定义表（~55 参数：元数据 + 控件 + 计算公式 + 中文说明）
    ├── version.ts           # 版本序数与过滤逻辑（纯函数）
    ├── compute.ts           # 场景/硬件 → 参数默认值 的公式层（纯函数）
    ├── generate.ts          # my.cnf 模板渲染（纯函数：params + ctx → 行数组）
    ├── advice.ts            # OS 建议 + 复制初始化 SQL 提示数据（非 my.cnf 附加区块）
    ├── serverid.ts          # server_id 随机种子（crypto.getRandomValues → uint32）
    ├── __tests__/           # 单测：compute / version / generate / params 不变量
    └── components/          # 私有子组件（从 redis-config 复制改造，不共享）
        ├── ControlPanel.vue     # 快速配置：模式/硬件/场景/版本按钮组/监听范围/端口/并发
        ├── ParamRow.vue         # 参数行：名称 + 控件 + 推荐快捷选项 + 版本徽章/废弃提示
        ├── NumberField.vue      # 数值输入框 + 推荐快捷选项 chips
        ├── ConfigPreview.vue    # 行号预览 + 变动高亮
        └── AdvicePanel.vue      # OS 建议 + 复制初始化 SQL 提示（可折叠，对齐 SysctlPanel）
```

分层原则与 Redis 版一致：**数据与计算全部是可单测纯函数**，Vue 只做绑定与展示。复用的是"引擎模式"而非代码——私有组件（NumberField/ParamRow/ConfigPreview 等约 700 行形态层）从 redis-config 复制改造而非共享 import，遵守"跨 3+ 工具复用才上浮全局"的形态原则；PG 立项时再评估是否提炼到全局（届时 3 个消费方）。

## 数据模型

```ts
/** 版本轴：三点枚举；补丁级变更（8.0.27/8.0.30）折到 8.0 轴点，补丁版本写进注释文案 */
type MysqlVersion = '5.7' | '8.0' | '8.4';

/** 场景四档（PRD §1） */
type Scenario = 'oltp' | 'read-heavy' | 'write-heavy' | 'analytics';

interface GenerateContext {
  mode: 'standalone' | 'replica';   // 部署模式
  memoryGB: number;
  diskType: 'hdd' | 'ssd' | 'nvme';
  scenario: Scenario;
  version: MysqlVersion;
  concurrency: number;              // 并发连接预估（驱动 max_connections）
  listenScope: 'all' | 'loopback' | 'intranet';  // 画像字段：驱动 bind-address 推荐值
  bindIp: string;                   // 仅内网监听时的绑定 IP
  port: number;                     // 默认 3306
  /** 用户覆盖值：key → value；compute 只在无覆盖时生效（同 Redis 机制） */
  overrides: Record<string, string | number | boolean | string[]>;
}
```

与 Redis 版的差异：**无 cpuCores 画像字段**（精简参数集下无公式消费方，io_threads 已裁剪——PG 版再评估恢复）；无 persistence 字段（MySQL binlog 恒开，注释解释 PITR/复制前提）；无 requirepass（my.cnf 不管账号密码）；新增 port 画像字段（Redis 端口走 overrides，MySQL 直接进 ctx——以实现简洁为准，见 implement 阶段微调自由）。

## 版本与改名建模（version.ts + params.ts）

- `VERSION_ORDER = { '5.7': 0, '8.0': 1, '8.4': 2 }`；`isAvailable(param, version)` 同 Redis 公式。
- **改名对/替换对 = 两个独立参数条目**（`tx_isolation` deprecatedIn '8.0' replacedBy `transaction_isolation`；`transaction_isolation` introducedIn '8.0'），不新增引擎能力，废弃过滤机制原样复用。
- **轴点安全方向（硬规则，官方文档核对后新增）**：轴点只输出该轴**全系补丁版可用**的参数名。补丁级引入的新名（8.0.26 的 `replica_*`、8.0.27 的 `authentication_policy`、8.0.30 的 `innodb_redo_log_capacity`）**禁止映射到 8.0 轴输出**——8.0.0-8.0.25 等早期补丁版会因未知变量**启动失败**；新名仅在 8.4 轴输出。据此：
  - 复制组：5.7/8.0 轴输出 `slave_parallel_workers`（8.0.26+ 仅有废弃警告，不炸旧版）；8.4 轴输出 `replica_parallel_workers`
  - 认证组：5.7/8.0 轴输出 `default_authentication_plugin`（8.0 全系可用，8.0.27 起废弃）；8.4 轴不输出认证参数（注释说明 caching_sha2_password 已是默认、mysql_native_password 需启动参数显式开启）
  - Redo 组：5.7/8.0 轴输出 `innodb_log_file_size`（8.0.30 起废弃但全系可用）；8.4 轴输出 `innodb_redo_log_capacity`
  - Binlog 组：5.7 轴输出 `expire_logs_days`；8.0/8.4 轴输出 `binlog_expire_logs_seconds`（8.0.1+ 全系可用，待复核；`expire_logs_days` 实际 8.2.0 移除）
  - 补丁级精度：徽章只显示三点轴值，补丁版本写在注释文案里（如"8.0.26 起废弃，兼容旧补丁版仍输出旧名"）。
- 全部版本事实以 `research/mysql-params-version-notes.md` 为准（关键项已于 2026-08-29 对照官方文档复核），实现第一步复核存疑项。

## 参数分组（9 组，~30 常用参数，注册表定稿见 research 笔记）

> 常用项原则（用户 2026-08-29 反馈："MySQL 的默认 ini 文件其实都没几行"）：冷门参数一律不收，
> 单机视图约 22-24 行、主从全开约 32 行。裁剪与"已检视并排除"清单见 research 笔记 §覆盖度终检；
> 连接级缓冲、表缓存、performance_schema 等见 PRD §Out of Scope。

| 组 | 参数 |
|---|---|
| 连接与事务 | max_connections（并发×系数）、wait_timeout、max_allowed_packet、skip_name_resolve（ON + 账号 HOST 警告注释）、transaction_isolation（5.7 轴输出 tx_isolation，改名对） |
| 内存与查询缓存 | innodb_buffer_pool_size、innodb_buffer_pool_instances（8.4 轴不输出，交服务器自算）；query_cache_size / query_cache_type（**仅 5.7**，8.0 移除——整组行随版本消失的展示位） |
| 全文检索与分词 | ngram_token_size（中文全文索引核心，默认 2）、innodb_ft_min_token_size（默认 3，仅默认 parser）、innodb_ft_enable_stopword（默认 ON）——注释强调：conf 只设服务器级默认，索引须建 `FULLTEXT ... WITH PARSER ngram` 才走分词 |
| Redo 与刷盘 | innodb_log_file_size（5.7/8.0）/ innodb_redo_log_capacity（8.4，替换对）、innodb_flush_log_at_trx_commit、sync_binlog（"双 1"矩阵）、innodb_flush_method、innodb_io_capacity / innodb_io_capacity_max（磁盘画像联动） |
| 二进制日志 | log_bin、binlog_expire_logs_seconds（8.0+）/ expire_logs_days（5.7，替换对）、binlog_format |
| 复制（主从限定） | server_id（挂载随机种子）、gtid_mode（ON 默认/OFF select）、enforce_gtid_consistency、relay_log_recovery、read_only、super_read_only、slave_parallel_workers（5.7/8.0）/ replica_parallel_workers（8.4，8.0.26 改名对）、slave_preserve_commit_order（8.0）/ replica_preserve_commit_order（8.4，改名对；5.7.22 引入但 5.7 轴不输出——轴点安全方向） |
| 字符集 | character_set_server、collation_server（8.0+ utf8mb4_0900_ai_ci；5.7 utf8mb4_general_ci） |
| 安全与认证 | default_authentication_plugin（5.7/8.0 轴；8.4 轴该行转为面板注释：caching_sha2_password 已默认、mysql_native_password 需显式开启） |
| 日志与慢查询 | slow_query_log、long_query_time（场景联动） |

## 关键公式（compute.ts，浏览器瞬时完成）

- `innodb_buffer_pool_size`：RAM × 系数（专用服务器基准 0.6；read-heavy 0.7；HDD 降到 0.5 给页缓存留量），向下取整 GB，下限 0.125GB；注释解释"页缓存也要吃内存，别把 buffer pool 拉满"。
- `max_connections`：`min(concurrency × 1.2 向上取整, RAM 折算上限)`（折算上限 = buffer pool 之外可用内存 ÷ 每连接基线，防超卖）。
- **内存账单提示**：面板注释按 `max_connections × 每连接基线（常数 ≈2MB，注明粗估）+ 全局缓冲` 与 RAM 占比动态显示——连接级缓冲参数不进注册表（全局设置属反模式），账单只用常数估算。纯注释计算，不输出到 conf。
- `innodb_io_capacity` / `_max`：HDD 200/400，SSD 2000/4000，NVMe 4000/8000（磁盘画像直接联动）。
- `innodb_flush_neighbors`：已裁剪（常用项原则），各版默认值差异不影响产物。
- **"双 1"刷盘矩阵**：`innodb_flush_log_at_trx_commit` 与 `sync_binlog` 默认 1/1（数据安全）；write-heavy 场景 → 2/100（注释写明崩溃可能丢 1 秒事务的取舍），用户可覆盖回 1。
- `innodb_log_file_size`（5.7/8.0）：RAM < 8G → 512M，< 32G → 1G，写密集 ×2，上限 4G；8.4 的 `innodb_redo_log_capacity` = 等价总容量（1G/2G/4G）。
- `binlog_expire_logs_seconds`：**推荐 604800（7 天）**；官方默认 2592000（30 天）、5.7 的 `expire_logs_days` 默认 0 = 不自动清理（注释写官方默认，防盘满）；5.7 轴输出 `expire_logs_days = 7`。
- `character_set_server`/`collation_server`：8.0/8.4 → utf8mb4 + utf8mb4_0900_ai_ci；5.7 → utf8mb4 + utf8mb4_general_ci（注释警告默认 latin1 是坑）。
- `transaction_isolation`：analytics → READ-COMMITTED（减少 gap lock），其余 REPEATABLE-READ；5.7 输出改名对 `tx_isolation`。
- `skip_name_resolve`：ON（DNS 解析延迟高频痛点）；注释警告"账号 HOST 必须为 IP，主机名授权的账号会失效"。
- **全文检索与分词**：`ngram_token_size` 默认 2（范围 1-10，设为最大搜索词长度）；`innodb_ft_min_token_size` 默认 3（仅默认 parser 生效，ngram 索引由 ngram_token_size 控制最小 token）；`innodb_ft_enable_stopword` 默认 ON（自定义停用词表走运行时 `innodb_ft_server_stopword_table`，注释提及即可）。三者注释统一强调：**conf 只设服务器级默认，FULLTEXT 索引必须显式 `WITH PARSER ngram` 建才走中文分词**。
- `bind-address`：loopback → `127.0.0.1`；intranet → `bindIp.trim()`（必填校验兜底）；all → **不输出该行**——默认值 `*` 即监听全部接口且含 IPv6（官方文档核对 2026-08-29，5.6.6 起默认 `*`）；显式 `0.0.0.0` 反而只绑 IPv4。注释提示"须配合账号 HOST 限制"。
- `server_id`：compute 返回确定性占位 1；主组件挂载时若 overrides.server_id 未设置则用 `serverid.ts`（crypto.getRandomValues → uint32 取模合法域）种子一次——复用 Redis requirepass 的"挂载种子 overrides"模式，数据层保持确定性可测。
- UI 默认画像：4GB / SSD / 通用 OLTP / 8.0 / 并发 200 / 单机 / 所有接口 / 3306——打开即生成合法 my.cnf（验收"打开即用"）。

## my.cnf 渲染（generate.ts）

`generateMyCnf(params, ctx): ConfLine[]`，ConfLine 结构同 Redis（comment/directive/blank + paramKey）。首行头部元信息注释，随后 `[mysqld]` 段头，再按组顺序输出：组间空行 + 组标题注释（纯英文组名，如 `# Connections`），每参数仅 `key = value` 行——**MySQL 惯例 `=` 两侧带空格**（与 Redis `key value` 的差异点，渲染函数内处理）。废弃参数整段跳过；`compute` 返回 null 的参数跳过。输出行数组由 ConfigPreview 展示、复制/下载序列化共用（所见即所得）。

## 组件与交互

- `MySQLConfigGenerator.vue`：持有 GenerateContext reactive；布局三区块完全对齐 Redis 版（快速配置 → 产物区 sticky → 分组单卡清单，移动端预览前置，桌面 lg:grid-cols-2 + lg:row-span-2）。
- 私有子组件从 redis-config/components 复制改造：NumberField/ConfigPreview 基本原样；ParamRow 加 MySQL 特性（改名对双徽章文案、内存账单动态注释）；ControlPanel 字段集按 PRD §1 重写（无密码行）；AdvicePanel 对齐 SysctlPanel 形态，内容 = OS 建议 + 主从时的复制初始化 SQL 片段（`CHANGE REPLICATION SOURCE TO SOURCE_HOST='<主库地址>', SOURCE_USER='<复制账号>', SOURCE_PASSWORD='<密码>'...` 占位符，注释解释 5.7 用 CHANGE MASTER TO）。
- 状态组件本地 reactive，不进全局 store；刷新即重置。

## 注册与 SEO

- `tools.ts`：`id: 'mysql-config-generator'`，category devops，path `/devops/mysql-config-generator`，icon emoji 🐬，relatedToolIds 挂 redis-config-generator（系列互推）+ 现有相关工具；seoDescription 覆盖"5.7/8.0/8.4 版本联动"关键词。
- `tool-faqs.ts`：4-5 条（推荐值能直接用吗 / 为什么没有密码配置项 / **为什么没有 sql_mode 与 lower_case_table_names**（改值风险教育）/ 版本徽章与废弃提示含义 / ngram 全文索引为什么要 WITH PARSER / 数据是否上传）。
- 路由 astro：`client:idle`；sitemap 自动收录，无需改 astro.config.mjs。

## Tradeoffs

- **常用项精简 + 终检回补 vs 全覆盖**：注册表从规划初稿的 55 参数 / 11 组先裁到 ~28（用户反馈"MySQL 默认 ini 没几行"），覆盖度终检后回补 3 项高频项——**全文检索与分词组**（ngram 中文分词是中文用户的真实高频需求）、`skip_name_resolve`（DNS 延迟高频痛点）、`preserve_commit_order` 对（并行回放的正确性配套）——定稿 **~30 参数 / 9 组**。启动危险参数（sql_mode、lower_case_table_names）与反模式参数坚持不进产物，走 FAQ 教育；代价是"调优百科"属性弱化，深度调优仍需官方文档。
- **复制改造 vs 上浮共享组件**：NumberField/ConfigPreview 等约 700 行形态层暂复制进 mysql-config/（跨 2 个消费方不上浮），代价是 PG 立项时可能要做一次上浮重构；收益是两个工具完全解耦、MySQL 特有改动（`=` 渲染、改名对徽章）不污染 Redis 版。
- **补丁版本折到轴点**：三点版本轴表达不了 8.0.27/8.0.30 精度，选择"徽章显示 8.0 + 注释写补丁版本"，避免版本轴膨胀成按钮墙。
- **sql_mode 不进注册表**：显式输出 sql_mode 极易破坏既有应用行为（ONLY_FULL_GROUP_BY 等变更引发的报错），风险大于收益，刻意排除并在 FAQ 说明。
- **binlog 无开关**：不提供关闭 binlog 的快捷选项（PITR/复制前提，关掉属于极小众场景），避免误关。

## 兼容与回滚

- 纯新增页面，不改任何既有工具行为；`tools.ts` 追加数组项为唯一共享文件改动。
- 回滚 = 删除 `src/tools/devops/MySQLConfigGenerator.vue` + `mysql-config/` + 路由 + 注册项，无迁移成本。
