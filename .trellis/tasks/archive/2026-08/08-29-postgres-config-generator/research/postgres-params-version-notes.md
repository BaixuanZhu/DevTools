# Research: PostgreSQL 配置生成器 —— 16/17/18 参数与版本差异核对

- Query: 逐参数核对 PostgreSQL 16/17/18 默认值、可设置性、版本差异、OS 建议、备库要点（postgresql.org 官方文档）
- Scope: external（官方文档核对）
- Date: 2026-08-29

## 方法与可信度说明

本机直连 `www.postgresql.org` 被网络层阻断（TLS 握手被重置，curl 与 WebFetch 均失败），故采用以下方式获取**与官网完全一致**的官方文本，引用时一律给出 postgresql.org 对应页面 URL：

- **HTML 文档**：官方源码 tarball `postgresql-16.15.tar.gz`（ftp.postgresql.org，内含 doc/src/sgml）与 docs tarball `postgresql-17.11-docs.tar.gz`、`postgresql-18.6-docs.tar.gz`。文档由官方 SGML 构建而成，内容即官网 `/docs/16/`、`/docs/17/`、`/docs/18/` 页面文本。注意：依据官方 versioning policy，minor 版本仅为 bug/安全修复、不引入新参数不改默认值，因此 16.15/17.11/18.6 的文本可代表 16/17/18。
- **参数默认值与上下文（可设置性）**：直接解析三个版本源码中的 `src/backend/utils/misc/guc_tables.c`（这是 `pg_settings.context` 与默认值的唯一权威来源，16.15/17.11/18.6 均已解析），并与 HTML 文档逐项交叉验证。
- **版本差异**：直接 grep 官方 release notes（`release-17.html`、`release-18.html`，即官网 `/docs/17/release-17.html`、`/docs/18/release-18.html`）。
- 个别不在版本轴内的历史问题（PG15 改默认）用官网 release-15.0 页面（服务器端抓取）确认。

## 1. 版本与 EOL 表

来源：https://www.postgresql.org/support/versioning/（Versioning Policy 表）

| 主版本 | 首发日期 | 最终发布（EOL） | 备注 |
|---|---|---|---|
| 18 | 2025-09-25 | **2030-11-14** | 当前最新主版本（现役 minor 18.6） |
| 17 | 2024-09-26 | **2029-11-08** | 现役 minor 17.11 |
| 16 | 2023-09-14 | **2028-11-09** | 现役 minor 16.15 |
| 15 | 2022-10-13 | 2027-11-11 | 不纳入版本轴；PRD 中"提示升级路径"目标 |
| 14 | 2021-09-30 | 2026-11-12 | 约 2.5 个月后 EOL，不纳入（与 PRD 判断一致） |

PRD 中的 EOL 初判（16→2028-11、17→2029-11、18→2030-11）与官方一致。

## 2. 逐参数核对表（核心交付物）

可设置性图例（按 `guc_tables.c` 的 PGC 上下文；全部可用于 postgresql.conf）：

- **reload** = SIGHUP，改 conf 后 `pg_ctl reload`/`pg_reload_conf()` 生效，无需重启
- **restart** = POSTMASTER，仅能在 conf/命令行设置且需重启
- **session** = USERSET，conf 可设，会话内可 `SET`
- **superuser-session** = SUSET，conf 可设，仅超级用户可会话级 `SET`

单位说明：内存参数无单位时按文档规定解释（多数 kB，shared_buffers/effective_cache_size 为 8kB 块，wal_buffers 为 WAL 块，max_wal_size/min_wal_size 为 MB）；conf 推荐显式带单位（kB/MB/GB、ms/s/min/h/d），单位后缀表见 https://www.postgresql.org/docs/16/config-setting.html

| 参数名 | 默认@16 | 默认@17 | 默认@18 | 可设置性 | 单位/枚举 | docUrl（16） | 备注 |
|---|---|---|---|---|---|---|---|
| listen_addresses | `localhost` | 同 | 同 | restart | 字符串 | [conn#GUC-LISTEN-ADDRESSES](https://www.postgresql.org/docs/16/runtime-config-connection.html#GUC-LISTEN-ADDRESSES) | 主从/远程必须改 `*` 或内网地址 |
| port | `5432` | 同 | 同 | restart | 整数 | [conn#GUC-PORT](https://www.postgresql.org/docs/16/runtime-config-connection.html#GUC-PORT) | initdb 实际写入 5432 |
| max_connections | `100`（"typically 100, but might be less if your kernel settings will not support it (as determined during initdb)"） | 同 | 同 | restart | 整数 | [conn#GUC-MAX-CONNECTIONS](https://www.postgresql.org/docs/16/runtime-config-connection.html#GUC-MAX-CONNECTIONS) | 16 起另有 `reserved_connections`（默认 0）排在 superuser 槽之前；备库必须 ≥ 主库（原文见备注列） |
| superuser_reserved_connections | `3` | 同 | 同 | restart | 整数 | [conn#GUC-SUPERUSER-RESERVED-CONNECTIONS](https://www.postgresql.org/docs/16/runtime-config-connection.html#GUC-SUPERUSER-RESERVED-CONNECTIONS) | 假设值正确 |
| password_encryption | `scram-sha-256` | 同 | 同 | session | 枚举：scram-sha-256 / md5 | [conn#GUC-PASSWORD-ENCRYPTION](https://www.postgresql.org/docs/16/runtime-config-connection.html#GUC-PASSWORD-ENCRYPTION) | PG14 起默认 scram-sha-256（轴内三版一致） |
| shared_buffers | `128MB`（"typically 128 megabytes … might be less … (as determined during initdb)"） | 同 | 同 | restart | 内存（无单位=8kB 块） | [resource#GUC-SHARED-BUFFERS](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-SHARED-BUFFERS) | 文档推荐起始值 = 专机内存 25%（不是 40%）；>1GB 机器 |
| huge_pages | `try` | 同 | 同 | restart | 枚举：try/on/off（兼容 true/false/yes/no/1/0） | [resource#GUC-HUGE-PAGES](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-HUGE-PAGES) | 三版文档原文 "Valid values are try (the default), on, and off"；guc_tables 三版均为 `HUGE_PAGES_TRY`。指显式大页（hugetlbfs），与 THP 无关 |
| work_mem | `4MB` | 同 | 同 | session | 内存（无单位=kB） | [resource#GUC-WORK-MEM](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-WORK-MEM) | 每个排序/哈希操作各自可占用（见 FAQ） |
| maintenance_work_mem | `64MB` | 同 | 同 | session | 内存（无单位=kB） | [resource#GUC-MAINTENANCE-WORK-MEM](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAINTENANCE-WORK-MEM) | 文档提醒：autovacuum 时最多 autovacuum_max_workers 倍 |
| autovacuum_work_mem | `-1`（沿用 maintenance_work_mem） | 同 | 同 | reload | 内存（无单位=kB） | [resource#GUC-AUTOVACUUM-WORK-MEM](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-AUTOVACUUM-WORK-MEM) | 仅 conf/命令行（reload） |
| effective_cache_size | `4GB` | 同 | 同 | session | 内存（无单位=8kB 块） | [query#GUC-EFFECTIVE-CACHE-SIZE](https://www.postgresql.org/docs/16/runtime-config-query.html#GUC-EFFECTIVE-CACHE-SIZE) | 优化器假设值，不分配内存 |
| max_worker_processes | `8` | 同 | 同 | restart | 整数 | [resource#GUC-MAX-WORKER-PROCESSES](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAX-WORKER-PROCESSES) | 备库必须 ≥ 主库 |
| max_parallel_workers | `8` | 同 | 同 | session | 整数 | [resource#GUC-MAX-PARALLEL-WORKERS](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS) | ≤ max_worker_processes |
| max_parallel_workers_per_gather | `2` | 同 | 同 | session | 整数 | [resource#GUC-MAX-PARALLEL-WORKERS-PER-GATHER](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS-PER-GATHER) | |
| effective_io_concurrency | `1`（supported systems；否则 0） | 同 16（1/0） | **`16`** | session | 整数 | [resource#GUC-EFFECTIVE-IO-CONCURRENCY](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-EFFECTIVE-IO-CONCURRENCY) | **18 默认 1→16**（release-18 明示）；生成器按版本给不同默认/建议 |
| maintenance_io_concurrency | `10`（supported systems；否则 0） | 同 16（10/0） | **`16`** | session | 整数 | [resource#GUC-MAINTENANCE-IO-CONCURRENCY](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAINTENANCE-IO-CONCURRENCY) | **18 默认 10→16** |
| io_method | —（不存在） | —（不存在） | `worker` | restart | 枚举：worker / io_uring / sync | [18 resource#GUC-IO-METHOD](https://www.postgresql.org/docs/18/runtime-config-resource.html#GUC-IO-METHOD) | **18 新增**；io_uring 需编译期 `--with-liburing`；sync 为 18 前的传统行为 |
| io_workers | —（不存在） | —（不存在） | `3` | reload | 整数 | [18 resource#GUC-IO-WORKERS](https://www.postgresql.org/docs/18/runtime-config-resource.html#GUC-IO-WORKERS) | **18 新增**；仅 io_method=worker 时有效 |
| io_max_concurrency | —（不存在） | —（不存在） | `-1` | restart | 整数 | [18 resource#GUC-IO-MAX-CONCURRENCY](https://www.postgresql.org/docs/18/runtime-config-resource.html#GUC-IO-MAX-CONCURRENCY) | **18 新增**；-1=按 shared_buffers 与 max_connections/autovacuum_worker_slots/max_worker_processes/max_wal_senders 自动推导，上限 64 |
| wal_level | `replica` | 同 | 同 | restart | 枚举：minimal / replica / logical | [wal#GUC-WAL-LEVEL](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-WAL-LEVEL) | 主从必须 ≥ replica（默认即满足） |
| wal_buffers | `-1`（= shared_buffers/32，下限 64kB，上限一个 WAL 段通常 16MB） | 同 | 同 | restart | WAL 块（无单位） | [wal#GUC-WAL-BUFFERS](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-WAL-BUFFERS) | 文档：-1 自适应"most cases 合理"；高并发提交可手动给几 MB |
| max_wal_size | `1GB` | 同 | 同 | reload | 内存（无单位=MB） | [wal#GUC-MAX-WAL-SIZE](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-MAX-WAL-SIZE) | 软上限；64 段 × 16MB |
| min_wal_size | `80MB` | 同 | 同 | reload | 内存（无单位=MB） | [wal#GUC-MIN-WAL-SIZE](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-MIN-WAL-SIZE) | 5 段 × 16MB |
| checkpoint_timeout | `5min` | 同 | 同 | reload | 时间（无单位=s） | [wal#GUC-CHECKPOINT-TIMEOUT](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-CHECKPOINT-TIMEOUT) | |
| checkpoint_completion_target | `0.9` | 同 | 同 | reload | 浮点 0~1 | [wal#GUC-CHECKPOINT-COMPLETION-TARGET](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-CHECKPOINT-COMPLETION-TARGET) | 文档明言"Reducing this parameter is not recommended" |
| wal_compression | `off` | 同 | 同 | superuser-session | 枚举：off / pglz / lz4 / zstd；**on 是 pglz 的历史别名**（兼容 true/false/yes/no/1/0） | [wal#GUC-WAL-COMPRESSION](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-WAL-COMPRESSION) | 16/17/18 文档原文："The supported methods are pglz, lz4 (…--with-lz4) and zstd (…--with-zstd). The value on is a historical spelling of pglz. The default value is off."（lz4/zstd 需编译期支持） |
| wal_keep_size | `0` | 同 | 同 | reload | 内存（无单位=MB） | [replication#GUC-WAL-KEEP-SIZE](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-WAL-KEEP-SIZE) | 主从场景建议 >0；有槽时可依赖槽保留 |
| max_wal_senders | `10` | 同 | 同 | restart | 整数 | [replication#GUC-MAX-WAL-SENDERS](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-MAX-WAL-SENDERS) | 备库必须 ≥ 主库 |
| max_replication_slots | `10` | 同 | 同 | restart | 整数 | [replication#GUC-MAX-REPLICATION-SLOTS](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-MAX-REPLICATION-SLOTS) | 物理槽 + 逻辑槽共用 |
| hot_standby | `on` | 同 | 同 | restart | 布尔 | [replication#GUC-HOT-STANDBY](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-HOT-STANDBY) | 备库默认已可读，无需显式覆盖 |
| random_page_cost | `4.0` | 同 | 同 | session | 浮点 | [query#GUC-RANDOM-PAGE-COST](https://www.postgresql.org/docs/16/runtime-config-query.html#GUC-RANDOM-PAGE-COST) | SSD 场景社区常调 1.1（文档仅建议按实际缓存率上调，未给 SSD 值） |
| default_statistics_target | `100` | 同 | 同 | session | 整数 | [query#GUC-DEFAULT-STATISTICS-TARGET](https://www.postgresql.org/docs/16/runtime-config-query.html#GUC-DEFAULT-STATISTICS-TARGET) | |
| jit | `on` | 同 | 同 | session | 布尔 | [query#GUC-JIT](https://www.postgresql.org/docs/16/runtime-config-query.html#GUC-JIT) | OLTP 短查询建议 off（见 FAQ） |
| autovacuum | `on` | 同 | 同 | reload | 布尔 | [16 autovacuum#GUC-AUTOVACUUM](https://www.postgresql.org/docs/16/runtime-config-autovacuum.html#GUC-AUTOVACUUM) / [18 vacuum#GUC-AUTOVACUUM](https://www.postgresql.org/docs/18/runtime-config-vacuum.html#GUC-AUTOVACUUM) | 需 track_counts 同时开启 |
| autovacuum_max_workers | `3` | 同 | 同 | 16/17:**restart**；18:**reload** | 整数 | [16 autovacuum#GUC-AUTOVACUUM-MAX-WORKERS](https://www.postgresql.org/docs/16/runtime-config-autovacuum.html#GUC-AUTOVACUUM-MAX-WORKERS) / [18 vacuum](https://www.postgresql.org/docs/18/runtime-config-vacuum.html#GUC-AUTOVACUUM-MAX-WORKERS) | 18 语义变化：受 autovacuum_worker_slots 上限保护，可运行时调整 |
| autovacuum_naptime | `1min` | 同 | 同 | reload | 时间（无单位=s） | [16 autovacuum#GUC-AUTOVACUUM-NAPTIME](https://www.postgresql.org/docs/16/runtime-config-autovacuum.html#GUC-AUTOVACUUM-NAPTIME) | |
| autovacuum_vacuum_scale_factor | `0.2` | 同 | 同 | reload | 浮点 | [16 autovacuum#GUC-AUTOVACUUM-VACUUM-SCALE-FACTOR](https://www.postgresql.org/docs/16/runtime-config-autovacuum.html#GUC-AUTOVACUUM-VACUUM-SCALE-FACTOR) | 表级可覆盖 |
| autovacuum_vacuum_cost_limit | `-1`（= 用 vacuum_cost_limit，即 200） | 同 | 同 | reload | 整数 | [16 autovacuum#GUC-AUTOVACUUM-VACUUM-COST-LIMIT](https://www.postgresql.org/docs/16/runtime-config-autovacuum.html#GUC-AUTOVACUUM-VACUUM-COST-LIMIT) | -1→200 的假设正确 |
| autovacuum_vacuum_cost_delay | `2ms` | 同 | 同 | reload | 时间（无单位=ms；0=禁用延迟） | [16 autovacuum#GUC-AUTOVACUUM-VACUUM-COST-DELAY](https://www.postgresql.org/docs/16/runtime-config-autovacuum.html#GUC-AUTOVACUUM-VACUUM-COST-DELAY) | 轴内三版 2ms 已核；"PG12 起 2ms"为历史沿革（未复核 release-12，不在注册表，无落地影响） |
| log_autovacuum_min_duration | **`10min`** | 同 | 同（18 未改） | reload | 时间（无单位=ms；-1=关闭，0=全记） | [16 logging#GUC-LOG-AUTOVACUUM-MIN-DURATION](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-AUTOVACUUM-MIN-DURATION) | **不是 -1**：PG15 起即 10min（见 §3）；guc_tables 三版均 600000ms |
| logging_collector | `off` | 同 | 同 | restart | 布尔 | [logging#GUC-LOGGING-COLLECTOR](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOGGING-COLLECTOR) | 开 CSV/JSON 日志或文件轮转必须 on |
| log_destination | `stderr` | 同 | 同 | reload | 列表：stderr/csvlog/jsonlog/syslog(/eventlog) | [logging#GUC-LOG-DESTINATION](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-DESTINATION) | csvlog/jsonlog 需 logging_collector=on |
| log_min_duration_statement | `-1` | 同 | 同 | superuser-session | 时间（无单位=ms；0=全记） | [logging#GUC-LOG-MIN-DURATION-STATEMENT](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-MIN-DURATION-STATEMENT) | |
| log_checkpoints | `on` | 同 | 同 | reload | 布尔 | [logging#GUC-LOG-CHECKPOINTS](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-CHECKPOINTS) | PG15 起默认 on（轴内三版均 on） |
| log_connections | `off`（布尔） | 同 16（off） | **`''`（空串=不记录）**，变为列表型：receipt/authentication/authorization/setup_durations/all；兼容 on/off/true/false/yes/no/1/0（on ≡ receipt+authentication+authorization） | 16/17: superuser-backend；18 同（superuser-backend） | 布尔（16/17）/ 列表（18） | [16 logging#GUC-LOG-CONNECTIONS](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-CONNECTIONS) / [18 logging](https://www.postgresql.org/docs/18/runtime-config-logging.html#GUC-LOG-CONNECTIONS) | **18 类型变化**；生成器按版本轴渲染：16/17 出 `off`，18 仍可出 `off`（兼容写法）或省略 |
| log_line_prefix | `'%m [%p] '` | 同 | 同 | reload | 字符串（% 转义） | [logging#GUC-LOG-LINE-PREFIX](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-LINE-PREFIX) | 假设问号已解：默认值即 `%m [%p] ` |
| shared_preload_libraries | `''`（空） | 同 | 同 | restart | 逗号分隔库名 | [client#GUC-SHARED-PRELOAD-LIBRARIES](https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-SHARED-PRELOAD-LIBRARIES) | 库不存在则启动失败 |
| timezone | initdb 写入系统时区（"built-in default is GMT, but … initdb will install a setting there corresponding to its system environment"） | 同 | 同 | session | 时区名 | [client#GUC-TIMEZONE](https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-TIMEZONE) | 在 conf 显式设置**合法**（普通 USERSET GUC）；生成器显式输出可消除对 initdb 环境的依赖 |
| log_timezone | 同上（initdb 写入） | 同 | 同 | reload | 时区名 | [logging#GUC-LOG-TIMEZONE](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-LOG-TIMEZONE) | cluster 级一致时间戳 |

## 3. 版本差异清单（16 → 17 → 18）

### 对生成器参数集有影响的变化

| 变化 | 版本 | 来源 |
|---|---|---|
| `effective_io_concurrency` 默认 1→16；`maintenance_io_concurrency` 默认 10→16（"more accurately reflects modern hardware"） | 18 | [release-18](https://www.postgresql.org/docs/18/release-18.html)（原文："Increase server variables effective_io_concurrency's and maintenance_io_concurrency's default values to 16"） |
| `log_connections` 由布尔改为列表（receipt/authentication/authorization/setup_durations/all），默认 `''`；旧布尔写法仍兼容 | 18 | [release-18](https://www.postgresql.org/docs/18/release-18.html)（"Increase the logging granularity of server variable log_connections … previously only boolean, which is still supported"）+ 18 文档 |
| 新增 AIO 家族 `io_method`（默认 worker）、`io_workers`（默认 3）、`io_max_concurrency`（默认 -1，上限 64），以及 `io_combine_limit`/`io_max_combine_limit` | **18-only**（16/17 的 guc_tables.c 与文档均无） | [release-18](https://www.postgresql.org/docs/18/release-18.html) |
| 新增 `autovacuum_worker_slots`（默认"typically 16"，restart；为 worker 预留槽位）——使 `autovacuum_max_workers`（默认 3）在 18 可 reload 调整（不再需重启） | 18 | [release-18](https://www.postgresql.org/docs/18/release-18.html)（"With this variable set, autovacuum_max_workers can be adjusted at runtime up to this maximum without a server restart"）+ 18 文档 |
| 新增 `autovacuum_vacuum_max_threshold`（默认 100,000,000 tuples：死元组绝对数上限，与百分比触发并存） | 18 | [release-18](https://www.postgresql.org/docs/18/release-18.html) |
| 新增 `idle_replication_slot_timeout`（默认 0=禁用，reload；非活跃槽自动失效） | 18 | [release-18](https://www.postgresql.org/docs/18/release-18.html) |
| 新增 `reserved_connections`（默认 0，restart；max_connections 槽位三层预留语义） | 16 | 16/17/18 文档 conn 页 + guc_tables 三版均存在 |
| `ssl_ecdh_curve` 更名 `ssl_groups`（旧名仍可用）；`ssl_groups` 默认加入 X25519 | 18 | [release-18](https://www.postgresql.org/docs/18/release-18.html) |

### 17 的核对结论（对常用项集）

- release-17.html 中**没有任何 "default value" 类条目**：上述 30 余个常用参数在 16→17 默认值全部不变（已用 17.11 guc_tables.c + 17.11 文档逐项复核）。
- 17 新增 GUC（与常用项集无关但可作版本差异备注）：`synchronized_standby_slots`（failover slot 同步）、`summarize_wal`/`wal_summary_keep_time`（增量备份 WAL 摘要）、`vacuum_buffer_usage_limit` 等。来源：[release-17](https://www.postgresql.org/docs/17/release-17.html)。
- **窗口内移除（均不在本注册表）**：`old_snapshot_threshold`、`trace_recovery_messages` 于 17 移除。来源：[release-17](https://www.postgresql.org/docs/17/release-17.html)。加上 18 的 `ssl_ecdh_curve`→`ssl_groups` 更名（旧名仍可用，见上表），**窗口内 rename/移除共 3 项，均不涉及 39 条目注册表**。

### 假设纠错（历史默认问题，轴外背景）

- `log_autovacuum_min_duration` **不是 18 改的**：PG15 release notes（Monitoring 节）"Enable default logging of checkpoints and slow autovacuum operations. This changes the default of log_checkpoints to on and that of log_autovacuum_min_duration to 10min"。来源：[PostgreSQL 15.0 release notes](https://www.postgresql.org/docs/release/15.0/)。轴内 16/17/18 均为 10min。
- `log_checkpoints` 默认 on 同为 PG15 起 → 用户假设"15 起 on"正确。
- `wal_compression` 的枚举化（pglz/lz4/zstd，on=pglz 别名）在 PG15 引入；轴内 16/17/18 语义一致、默认 off（已逐版核对原文）。
- `huge_pages` 默认 try：**16/17/18 三版均确认 try**；"16 起默认 try" 的"16 起"表述在轴内文档中无法证实（更早版本不在本轴），但至少 16 起连续三版都是 try。

## 4. 仅 initdb / 建库时固定项（生成器禁止输出到 postgresql.conf）

| 项 | 依据（原文要点） | 来源 |
|---|---|---|
| `lc_collate` | "Some locale categories must have their values fixed when the database is created … LC_COLLATE and LC_CTYPE are these categories. They affect the sort order of indexes, so they must be kept fixed, or indexes on text columns would become corrupt." | [16 locale](https://www.postgresql.org/docs/16/locale.html) |
| `lc_ctype` | 同上 | [16 locale](https://www.postgresql.org/docs/16/locale.html) |
| `server_encoding` | preset 只读报告（每库固定，initdb/建库决定） | [16 preset#GUC-SERVER-ENCODING](https://www.postgresql.org/docs/16/runtime-config-preset.html#GUC-SERVER-ENCODING) |
| `data_checksums` | preset 只读报告（initdb `--data-checksums` 决定） | [16 preset#GUC-DATA-CHECKSUMS](https://www.postgresql.org/docs/16/runtime-config-preset.html#GUC-DATA-CHECKSUMS) |
| 其余 preset 只读项（block_size、wal_segment_size 报告值、max_identifier_length 等） | "Preset Options" 页均为只读报告 | [16 preset](https://www.postgresql.org/docs/16/runtime-config-preset.html) |

机制补充：16 起 `lc_collate`/`lc_ctype` 已从 GUC 表移除（三版 guc_tables.c 均无条目），写入 postgresql.conf 会报 "unrecognized configuration parameter"——禁写结论比 locale.html 的表述更强。注：`lc_messages`/`lc_monetary`/`lc_numeric`/`lc_time` **可以**放 conf（默认 `''`=继承服务器环境，[16 client](https://www.postgresql.org/docs/16/runtime-config-client.html)），不属于禁写项。initdb 的 locale/timezone 选择只决定它写进 postgresql.conf 的初始值（`initdb will install a setting there corresponding to its system environment`），用户随后在 conf 里显式设置完全合法。

## 5. OS 建议核对（AdvicePanel 素材）

来源页：https://www.postgresql.org/docs/16/kernel-resources.html（17/18 同页无相关差异；16/17/18 三版均已本地核对）

| 建议项 | 官方文档结论 | 状态/来源 |
|---|---|---|
| vm.overcommit_memory | **推荐 2**（strict overcommit）：原文 "It is possible to modify the kernel's behavior so that it will not 'overcommit' memory … This is done by selecting strict overcommit mode via sysctl: `sysctl -w vm.overcommit_memory=2`"，可配合 `vm.overcommit_ratio`（文档未给具体数值，指向内核文档）。另一手段：postmaster 进程 `oom_score_adj=-1000`（配合 `PG_OOM_ADJUST_FILE/PG_OOM_ADJUST_VALUE` 让子进程保持 0）。文档也指出更根本解法是降低内存参数/降低 max_connections 用连接池 | 文档已覆盖（kernel-resources §19.4.4） |
| 透明大页（THP） | **官方明确不推荐**：huge_pages 条目结尾原文 "On Linux, this is called 'transparent huge pages' (THP). That feature has been known to cause performance degradation with PostgreSQL for some users on some Linux versions, so its use is currently discouraged (unlike explicit use of huge_pages)."（16/17/18 三版一致；kernel-resources 章节本身未提及 THP）。该段同时佐证 `huge_pages=try/on` 指显式大页 hugetlbfs（`vm.nr_hugepages`），与 THP 是两回事。具体关闭方式（`never`/`madvise`）属社区惯例 | **官方背书**（[16 resource#GUC-HUGE-PAGES](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-HUGE-PAGES)）；关闭取值社区来源：[PostgreSQL Wiki Operations cheat sheet](https://wiki.postgresql.org/wiki/Operations_cheat_sheet)、[Tuning Your PostgreSQL Server](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server) |
| vm.swappiness | **官方文档未提及**（16/17/18 kernel-resources grep 0 命中）。文档在 overcommit 一节仅提"内存紧张时增大 swap 可推迟 OOM"。swappiness 数值建议属社区惯例 | **文档未覆盖**，标注社区惯例（同上 Wiki） |
| 大页（huge_pages） | 文档给完整流程：`shared_memory_size_in_huge_pages` 预估（`postgres -D $PGDATA -C shared_memory_size_in_huge_pages`）、`sysctl -w vm.nr_hugepages=N`、`vm.hugetlb_shm_group`、`ulimit -l`（memlock）授权；默认行为即 try："use them when possible … fall back to normal pages on failure" | 文档已覆盖（kernel-resources §19.4.5） |
| ulimit nofile / 文件描述符 | 文档覆盖：系统级 `fs.file-max`（Linux，sysctl 持久化）；进程级默认见 `max_files_per_process`（默认 1000，restart）："The factory default limit on open files is often set to 'socially friendly' values … on dedicated servers you might want to raise this limit"。未给具体 nofile 数字 | 文档已覆盖（kernel-resources §19.4.3）+ [16 resource#GUC-MAX-FILES-PER-PROCESS](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAX-FILES-PER-PROCESS) |
| shmmax / System V 共享内存 | 现代 PG（≥9.3）主共享内存用**匿名 mmap**，SysV 只占极少量（"typically 48 bytes, on 64-bit…"）；文档对 SHMMAX 的要求仅为 "at least 1kB, but the default is usually much higher"，且 Linux "The default shared memory settings are usually good enough"（除非 shared_memory_type=sysv）。即：**不需要老式 shmmax 调优**，生成器不建议输出该类建议，或仅说明 | 文档已覆盖（kernel-resources §19.4.1 表 19.1 及各平台小节） |

## 6. 备库要点 SQL 核对

### pg_basebackup（[16 app-pgbasebackup](https://www.postgresql.org/docs/16/app-pgbasebackup.html)，17/18 同页已核对一致）

| 项 | 官方原文要点 |
|---|---|
| `-R` / `--write-recovery-conf` | "Creates a standby.signal file and appends connection settings to the postgresql.auto.conf file in the target directory … The postgresql.auto.conf file will record the connection settings and, if specified, the replication slot that pg_basebackup is using, so that streaming replication will use the same settings later on." → **是的，自动写 standby.signal + primary_conninfo（及 -S 指定的槽名 → primary_slot_name）到 postgresql.auto.conf** |
| `-C` / `--create-slot` | "Specifies that the replication slot named by the --slot option should be created before starting the backup. An error is raised if the slot already exists." → **配合 -S 即创建物理槽** |
| `-S slotname` / `--slot=slotname` | "This option can only be used together with -X stream … If the base backup is intended to be used as a streaming-replication standby using a replication slot, the standby should then use the same replication slot name … ensures that the primary server does not remove any necessary WAL data in the time between the end of the base backup and the start of streaming replication on the new standby." |
| `-X stream` | "-X method / --wal-method=method … stream: Stream write-ahead log data while the backup is being taken. This method will open a second connection to the server and start streaming the write-ahead log in parallel … it will require two replication connections not just one … This value is the default." → stream 是 `-X` 的默认值 |

### 物理复制槽（[16 functions-admin](https://www.postgresql.org/docs/16/functions-admin.html)，18 页已核对签名一致）

```sql
SELECT * FROM pg_create_physical_replication_slot('node_a_slot');
```

- 签名：`pg_create_physical_replication_slot ( slot_name name [, immediately_reserve boolean, temporary boolean ] ) → record ( slot_name name, lsn pg_lsn )`
- `immediately_reserve`：true 时**立即保留 LSN**，否则"the LSN is reserved on first connection from a streaming replication client"。给备库预建槽建议 true（避免备份结束到流复制启动之间 WAL 被回收；与 -S 语义一致）。
- 官方配置示例（[16 warm-standby](https://www.postgresql.org/docs/16/warm-standby.html)）：建槽后 "To configure the standby to use this slot, primary_slot_name should be configured on the standby"，示例即备库 conf 中 `primary_conninfo = 'host=… port=5432 user=foo password=foopass'` + `primary_slot_name = 'node_a_slot'`。**primary_slot_name 写在备库侧**（-R 时由 pg_basebackup 自动写入备库 postgresql.auto.conf）。

### standby 侧需覆盖的少数项（全部出自官方参数页原文，16/17/18 一致）

| 项 | 结论 |
|---|---|
| hot_standby | 默认已是 `on`（[replication#GUC-HOT-STANDBY](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-HOT-STANDBY)："The default value is on"），备库无需显式覆盖 |
| max_connections | "When running a standby server, you must set this parameter to the same or higher value than on the primary server. Otherwise, queries will not be allowed in the standby server."（[conn#GUC-MAX-CONNECTIONS](https://www.postgresql.org/docs/16/runtime-config-connection.html#GUC-MAX-CONNECTIONS)）→ **备库 ≥ 主库的官方依据** |
| max_worker_processes | 同样原文要求"same or higher value than on the primary"（[resource#GUC-MAX-WORKER-PROCESSES](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-MAX-WORKER-PROCESSES)） |
| max_wal_senders | 同样原文要求"same or higher value than on the primary"（[replication#GUC-MAX-WAL-SENDERS](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-MAX-WAL-SENDERS)） |
| max_prepared_transactions | 官方同句亦要求备库 ≥ 主库（不在本注册表；备库要点提示块可一笔带过） |
| primary_conninfo / primary_slot_name | 备库侧设置（reload 可改，[replication#GUC-PRIMARY-CONNINFO](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-PRIMARY-CONNINFO)、[#GUC-PRIMARY-SLOT-NAME](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-PRIMARY-SLOT-NAME)）；standby 模式由 **standby.signal** 文件进入（[16 warm-standby](https://www.postgresql.org/docs/16/warm-standby.html)："A server enters standby mode if a standby.signal file exists in the data directory when the server is started"） |
| 槽的 WAL 保留上限（防 pg_wal 撑爆） | `max_slot_wal_keep_size`（默认 -1=不限制，reload），可作主库侧提示（[replication#GUC-MAX-SLOT-WAL-KEEP-SIZE](https://www.postgresql.org/docs/16/runtime-config-replication.html#GUC-MAX-SLOT-WAL-KEEP-SIZE)） |

## 7. FAQ 素材（均可在工具页直接引用官方表述）

1. **work_mem 不是全实例配额**：官方原文 "a complex query might perform several sort and hash operations at the same time, with each operation generally being allowed to use as much memory as this value specifies … Also, several running sessions could be doing such operations concurrently. Therefore, the total memory used could be many times the value of work_mem"（[16 resource#GUC-WORK-MEM](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-WORK-MEM)）。
2. **shared_buffers 官方建议从 25% 起步，而非 40%**："If you have a dedicated database server with 1GB or more of RAM, a reasonable starting value for shared_buffers is 25% of the memory in your system"（[16 resource#GUC-SHARED-BUFFERS](https://www.postgresql.org/docs/16/runtime-config-resource.html#GUC-SHARED-BUFFERS)）。"不超过 RAM 40%" 是社区经验（Wiki），不是官方文档口径——工具页若写 40% 需标注社区惯例。
3. **huge_pages=try 与透明大页（THP）是两回事**：try 指显式预留的 hugetlbfs 大页（失败回退普通页，文档原文 "try … will try to request huge pages, but fall back to the default if that fails"）；THP 是内核自动合并机制，**官方文档明确不推荐**（huge_pages 条目原文 discouraged），具体关闭取值（never/madvise）属社区惯例（见 §5）。
4. **lc_collate / lc_ctype 为什么不能在 conf 里改**：影响索引排序序，"must be kept fixed, or indexes on text columns would become corrupt"，建库即固定（[16 locale](https://www.postgresql.org/docs/16/locale.html)）；改排序规则需 COLLATE 列级/表达式级方案。
5. **jit 对 OLTP 短查询是负担**："JIT compilation is beneficial primarily for long-running CPU-bound queries … For short queries the added overhead of performing JIT compilation will often be higher than the time it can save."（[16 jit-decision](https://www.postgresql.org/docs/16/jit-decision.html)）；由 `jit_above_cost`（默认 100000）自动决策，OLTP 场景常直接 `jit=off`。
6. **max_wal_size 是软上限**：检查点间隔相关，不是硬性 WAL 磁盘配额；配合 `max_slot_wal_keep_size`/复制槽管理 pg_wal 增长（[16 wal](https://www.postgresql.org/docs/16/runtime-config-wal.html)）。
7. **checkpoint_completion_target 默认 0.9 且不建议调低**：官方原文 "Reducing this parameter is not recommended"（[16 wal#GUC-CHECKPOINT-COMPLETION-TARGET](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-CHECKPOINT-COMPLETION-TARGET)）。
8. **备库参数下限**：max_connections / max_worker_processes / max_wal_senders 必须 ≥ 主库，否则备库拒绝查询/复制（§6 引文）；hot_standby 默认已 on。
9. **wal_compression 的 on 是 pglz 别名**：现代写法直接用 `pglz`/`lz4`/`zstd`（lz4/zstd 需编译期启用），默认 off（§2 引文）。

## 8. Sources

- 版本策略/EOL：https://www.postgresql.org/support/versioning/
- 16 文档（默认值/上下文/OS/复制）：https://www.postgresql.org/docs/16/runtime-config-connection.html 、https://www.postgresql.org/docs/16/runtime-config-resource.html 、https://www.postgresql.org/docs/16/runtime-config-wal.html 、https://www.postgresql.org/docs/16/runtime-config-replication.html 、https://www.postgresql.org/docs/16/runtime-config-query.html 、https://www.postgresql.org/docs/16/runtime-config-autovacuum.html 、https://www.postgresql.org/docs/16/runtime-config-logging.html 、https://www.postgresql.org/docs/16/runtime-config-client.html 、https://www.postgresql.org/docs/16/runtime-config-preset.html 、https://www.postgresql.org/docs/16/kernel-resources.html 、https://www.postgresql.org/docs/16/config-setting.html 、https://www.postgresql.org/docs/16/locale.html
- 17 文档（逐项复核）：https://www.postgresql.org/docs/17/release-17.html 及同路径各 runtime-config 分节页
- 18 文档（逐项复核）：https://www.postgresql.org/docs/18/release-18.html 及同路径各 runtime-config 分节页（autovacuum 位于 https://www.postgresql.org/docs/18/runtime-config-vacuum.html ）
- pg_basebackup：https://www.postgresql.org/docs/16/app-pgbasebackup.html
- 复制槽/standby：https://www.postgresql.org/docs/16/functions-admin.html 、https://www.postgresql.org/docs/16/warm-standby.html
- JIT FAQ：https://www.postgresql.org/docs/16/jit-decision.html
- 历史（轴外）：https://www.postgresql.org/docs/release/15.0/ （log_checkpoints→on、log_autovacuum_min_duration→10min）
- 社区（文档未覆盖项标注用）：https://wiki.postgresql.org/wiki/Operations_cheat_sheet 、https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server

## Caveats / Not Found

- `standby_slot_names`/`synced_standby_slots` 这两个名字在 17/18 文档与源码中**均不存在**（17 实际新增的是 `synchronized_standby_slots`），若此前计划引用请以 release-17 页面名称为准。
- vm.swappiness 在 16/17/18 文档均**未提及**，工具页建议标注"社区惯例"；透明大页（THP）则被 huge_pages 条目**明确不推荐**（官方背书，见 §5），仅关闭取值标社区惯例。
- `random_page_cost` 官方文档未给 SSD 推荐值（1.1 系社区惯例）；`vm.overcommit_ratio` 官方文档未给数值（指向内核文档）。
- 文档文本取自官方发布 tarball（16.15/17.11/18.6），与官网 docs 站文本一致；官网页 URL 为引用口径。
