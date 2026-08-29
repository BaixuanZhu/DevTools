# MySQL 参数版本矩阵研究笔记

> 实现期复核已完成（2026-08-29 第三轮，逐条对照官方文档，原"待复核"清单全部闭环，标记 ✅ 含来源）。
> 其中 query_cache 5.7 默认值一项经官方原文**纠正**：原假设 type=ON / size=0 有误，实际默认 type=0(OFF) / size=1M
> （查询缓存默认关闭），详见下方逐参数复核结果。注册表按 ~30 参数 × 9 组定稿（常用项原则 + 覆盖度终检回补全文检索组）。
> 来源基准：dev.mysql.com/doc（5.7/8.0/8.4 三版对照）。存疑参数宁可不进注册表。

## GA 版本结构事实（简化版本可用性判断）

- **5.7 GA = 5.7.9**（2015-10）、**8.0 GA = 8.0.11**（2018-04）。引入版本早于 GA 补丁号的参数，全轴自动安全。
- 据此结构安全：gtid_mode 四态（5.7.6 ✅ 官方 GTID 文档）、super_read_only（5.7.8）、require_secure_transport（5.7.5）、log_error_verbosity（5.7.2）、binlog_expire_logs_seconds（**8.0.1** ✅ MySQL Server Team 博客"Replication Features in MySQL 8.0.1"）。
- 轴点安全方向只对**引入晚于 GA** 的补丁级新名生效（8.0.26/8.0.27/8.0.30 均 > 8.0.11）。

## 轴点安全方向（硬规则，✅ 已核对确认）

**轴点只输出该轴全系补丁版可用的参数名。** 补丁级引入的新名参数不得映射到 8.0 轴输出——
8.0.0-8.0.25 会因未知变量**启动失败**（比废弃警告严重得多）。新名仅在 8.4 轴输出。

| 参数 | 5.7 轴 | 8.0 轴 | 8.4 轴 | 依据 |
|---|---|---|---|---|
| 并行回放 | slave_parallel_workers | slave_parallel_workers | replica_parallel_workers | slave→replica 改名 8.0.26 ✅（replication-options-replica.html 原文"From MySQL 8.0.26"；log_slave_updates→log_replica_updates 同批 ✅） |
| 认证插件 | default_authentication_plugin | default_authentication_plugin | 不输出（注释说明） | 8.0.27 废弃 ✅（8.0.27 release notes）；8.4 移除 ✅ |
| Redo 容量 | innodb_log_file_size | innodb_log_file_size | innodb_redo_log_capacity | 8.0.30 废弃、8.4 **未移除** ✅（8.4 removed 清单无此项） |
| Binlog 过期 | expire_logs_days | binlog_expire_logs_seconds | binlog_expire_logs_seconds | expire_logs_days **8.2.0 移除** ✅；binlog_expire_logs_seconds **8.0.1 引入** ✅（< 8.0 GA，全轴安全）；两者不可同设（官方文档） |
| 顺序提交 | （不输出） | slave_preserve_commit_order | replica_preserve_commit_order | **5.7.22 引入** ✅（> 5.7 GA → 5.7 轴不输出）；8.0.26 改名 ✅；8.0.27 起默认 ON ✅。8.0 轴输出 slave_*（8.0 全系可用，早期 DMR 引入） |

## 5.7 → 8.0 移除 / 改名

| 参数 | 变化 | 状态 |
|---|---|---|
| query_cache_size / query_cache_type / query_cache_limit 等 | **8.0 全家移除**（5.7.20 起废弃） | 版本徽章最佳展示位：deprecatedIn '8.0' ✅（5.7 query-cache.html 原文 "The query cache is deprecated as of MySQL 5.7.20, and is removed in MySQL 8.0."） |
| tx_isolation → transaction_isolation | 8.0 改名；**transaction_isolation 别名 5.7.20+ 已可用**（5.7 server-options 原文 ✅），但为兼容 5.7.0-5.7.19，5.7 轴输出 tx_isolation（轴点安全方向） | ✅ 建模已定 |
| tx_read_only → transaction_read_only | 8.0 改名，同上处理 | 同上 |
| character_set_server 默认值 | latin1 → **utf8mb4** | ✅（8.0 nutshell 原文 "The default character set has changed from latin1 to utf8mb4."——反向锚定 5.7 默认 latin1） |
| master_host 等 my.cnf 复制连接项 | 8.0 移除（凭据走 SQL） | 决策已定：不出连接项，只出 SQL 提示区块 |
| local_infile 默认值 | **5.7 默认 ON → 8.0 默认 OFF** ✅（官方 LOAD DATA 安全文档两版对照） | 参数已裁（常用项原则）；留作安全组注释/FAQ 素材 |

## 8.0 → 8.4 移除 / 替换

| 参数 | 变化 | 状态 |
|---|---|---|
| expire_logs_days | **8.2.0 移除** ✅（added-deprecated-removed 8.4 页原文） | 替代 binlog_expire_logs_seconds；**注意默认值**：8.0 默认 2592000（30 天）✅、5.7/8.0 的 expire_logs_days 默认 0 = 不自动清理 ✅——工具推荐显式 7 天，注释写官方默认 |
| innodb_log_file_size / innodb_log_files_in_group | 8.0.30 废弃，**8.4 未移除**（被 innodb_redo_log_capacity 取代；两者同设时后者生效） | ✅ 已核对；按轴点安全方向建模（见上表） |
| default_authentication_plugin | **8.4.0 移除** ✅；替代 authentication_policy（8.0.27+ 引入，✅ release notes 核对）——但 8.0 轴禁输出（轴点安全方向） | ✅ 已核对 |
| mysql_native_password | 8.4 **默认停用**（开启需 `[mysqld]` 加 `mysql_native_password=ON`，该选项 8.4.0 同时标记废弃）✅（8.4 nutshell 原文） | 注册表是否出独立参数待定；至少注释覆盖 |
| binlog_format | **8.0.34 起废弃** ✅（binary-log 页原文），8.4 仍可用 | ROW 为 5.7.7+ 默认 ✅（5.7.7 relnotes 复制默认值修改清单原文 "binlog-format=ROW"）；实现期定：全轴显式输出 ROW（无害且自文档化） |
| log_bin 默认值 | **8.0 默认 ON**（二进制日志默认开启）、更早版本默认 OFF ✅（binary-log 页原文） | 显式输出 log_bin 无害 |
| sync_binlog | 8.0 默认 1 ✅；binlog_cache_size 默认 32K ✅；max_binlog_size 默认 1G ✅（binary-log 页） | "双 1"公式基准正确 |
| gtid_mode 四态枚举（OFF/OFF_PERMISSIVE/ON_PERMISSIVE/ON） | 5.7.6+ 可用 ✅ | 引入 < 5.7 GA，全轴安全 |

## 8.4 InnoDB 默认值变化（仅涉及保留参数，✅ 8.4 nutshell 已核对）

- `innodb_io_capacity` 默认 200 → **10000**（8.4）：生成器仍按磁盘类型显式输出保守值（HDD 200 / SSD 2000 / NVMe 4000），注释可提"8.4 官方默认大幅上调，SSD 可酌情调高"
- `innodb_flush_method` Linux 默认 fsync → **O_DIRECT**（8.4）：显式输出 O_DIRECT 跨版本一致，注释注明 8.4 默认即此
- `innodb_buffer_pool_instances` 默认算法改为按 chunk/CPU 动态计算（不再是 pool≥1G→8）：8.0 轴沿用旧启发式，**8.4 轴不输出该参数**（交服务器自算）
- （已裁参数的默认变化——innodb_log_buffer_size 16M→64M、flush_neighbors——不再影响产物，仅备忘）

## 已裁剪参数备忘（不要加回注册表，除非用户要求）

连接级缓冲（sort/join/read_buffer）、binlog_cache_size、thread_cache_size、
table_open_cache / table_definition_cache、performance_schema、innodb_flush_neighbors、
innodb_read_io_threads / innodb_write_io_threads、innodb_log_buffer_size、tmp_table_size /
max_heap_table_size、max_binlog_size、binlog_row_image、general_log、log_error_verbosity、
max_connect_errors、local_infile（8.0 默认 OFF，5.7 注释素材）、require_secure_transport、
innodb_lock_wait_timeout。CPU 核数画像输入一并移除（无公式消费方）。
（skip_name_resolve 曾在裁剪清单，覆盖度终检回补——DNS 延迟高频痛点。）

## 覆盖度终检（2026-08-29，对齐主流调优指南/模板后的排除记录）

**结论：~30 参数 / 9 组已覆盖绝大多数常见配置与调优场景**；以下家族经检视后有意排除：

| 家族 | 代表参数 | 排除理由 |
|---|---|---|
| 环境路径类 | datadir / socket / log-error / pid-file / basedir / tmpdir | 安装器与运维环境专属，工具不猜路径；产物头部注释提示保留现有值 |
| 启动危险类 | sql_mode、lower_case_table_names | 覆盖既有行为 / 8.0 初始化后改值拒绝启动——只进 FAQ 教育 |
| 反模式类 | sort/join/read_buffer、tmp_table_size、max_heap_table_size、innodb_lock_wait_timeout | 全局固化连接级缓冲属反模式；默认值已合理 |
| 版本已定局类 | key_buffer_size（MyISAM 遗产）、innodb_file_per_table（5.7+ 默认 ON）、default_storage_engine | 输出无信息量 |
| 运行时开关类 | event_scheduler、general_log、log_queries_not_using_indexes | SET GLOBAL 按需开，固化易忘关（慢查注释提及） |
| 进阶/小众类 | innodb_max_dirty_pages_pct(_low)、innodb_lru_scan_depth、innodb_page_size（初始化后不可改）、binlog_row_image、change buffer 相关 | 收益/风险比低，留给官方文档 |
| 网络微调类 | back_log（OS somaxconn 在建议区块）、net_read/write_timeout、connect_timeout、interactive_timeout（wait_timeout 注释提及）、group_concat_max_len（会话级修法） | 已检视，影响小或有更优修法 |
| 高可用扩展 | 半同步、MGR、复制过滤（replicate-do-db 等） | Out of Scope（PRD），半同步/MGR 是独立场景 |

## 已裁剪参数备忘之外的高频痛点（FAQ 素材）

- group_concat_max_len 默认 1024 截断——正确修法是会话级 `SET SESSION group_concat_max_len`
- Host is blocked（max_connect_errors）——运营问题非配置问题，FLUSH HOSTS / 调大即可
- 中文全文搜索没结果——索引没用 `WITH PARSER ngram`，或 ngram_token_size 与搜索词长不匹配

## 逐参数复核结果（2026-08-29 实现期建档，官方文档逐条对照后闭环）

- [x] 连接与事务组：max_connections 上限折算 = 公式约定（design.md §关键公式 决定，非文档事实）；wait_timeout 默认 28800 ✅（Server System Variables 页 Default Value 28800，非交互连接 8 小时）；max_allowed_packet 5.7 默认 4M(4194304) / 8.0 默认 64M(67108864) ✅（server-system-variables 页，多源交叉一致）；skip_name_resolve 默认 OFF ✅，推荐 ON 的官方依据 = host-cache.html 原文 "if you have a very slow DNS and many hosts, you can improve performance by enabling skip_name_resolve"（开启后账号授权 HOST 必须用 IP，主机名授权账号失效）
- [x] 内存组：buffer_pool_instances 8.0 默认规则 = pool ≥ 1GB → 8，< 1GB → 1（option 在 pool < 1GB 时不生效）✅（innodb-multiple-buffer-pools 页 + innodb-parameters 默认值行多源交叉；8.4 起改为服务器按 chunk 自算 → 支撑 8.4 轴不输出该参数）
- [x] 全文检索组：ngram_token_size 默认 2 / 范围 1-10 ✅（沿用规划期核对）；innodb_ft_min_token_size 默认 3（范围 0-16）、innodb_ft_enable_stopword 默认 ON，5.7-8.x 各版一致 ✅（5.7 innodb-parameters 官方镜像 Default Value 行 + 8.2 innodb-parameters 交叉）；ngram 索引不受 min_token_size 约束 ✅（fulltext-fine-tuning 页原文 "Minimum and maximum word length full-text parameters do not apply to FULLTEXT indexes created using the ngram parser. ngram token size is defined by the ngram_token_size option."——conf 只设服务器级默认、索引须 WITH PARSER ngram 的注释依据）
- [x] Binlog 组：binlog_format 5.7.7+ 默认 ROW ✅（5.7.7 relnotes 复制默认值修改清单原文 "binlog-format=ROW"）
- [x] 复制组：relay_log_recovery 默认 OFF ✅（replication-options-replica 页 Default Value OFF；启用后副本启动丢弃未回放 relay log 并从源重新拉取——崩溃安全实践推荐 ON，注释写明官方默认 OFF 由用户决策）；preserve_commit_order 8.0 DMR 引入版本：8.0.3 RC relnotes 已含该变量的修复记录（< 8.0.11 GA）✅ → 8.0 轴全系可用；精确 DMR 补丁号未定位，不影响轴点安全性
- [x] 字符集组：utf8mb4_0900_ai_ci 仅 8.0+ ✅（8.0 charset-unicode-sets 页：0900 系 collation 基于 UCA 9.0.0、仅见于 8.0 手册，utf8mb4_0900_bin "as of MySQL 8.0.17"；5.7 utf8mb4 默认排序规则为 utf8mb4_general_ci——collation_server 分版本 compute 的依据）
- [x] 慢查组：long_query_time 默认 10 ✅（8.0 slow-query-log.html 原文 "The minimum and default values of long_query_time are 0 and 10, respectively."）
- [x] query_cache 组：**纠正原假设** —— 官方原文（5.7 query-cache-configuration.html）："By default, the query cache is disabled. This is achieved using a default size of 1M, with a default for query_cache_type of 0."，即 5.7 默认 **query_cache_type=0(OFF) / query_cache_size=1M**（非此前假设的 type=ON/size=0）；推荐显式 size=0 + type=OFF 的官方依据："start the server with query_cache_type=0 if you do not intend to use the query cache"（两者均 0 时服务器完全不获取查询缓存互斥锁）

## docUrl 锚点模式

统一用 `https://dev.mysql.com/doc/refman/{5.7|8.0|8.4}/en/{anchor}.html`（实现期逐参数补 anchor）。

## 已核对来源（2026-08-29）

### 实现期第三轮复核新增来源

- wait_timeout 默认 28800 / max_allowed_packet 跨版默认（5.7=4M、8.0=64M）：dev.mysql.com/doc/refman/{5.7,8.0}/en/server-system-variables.html（Default Value 行，多源交叉）
- query_cache 废弃 5.7.20 + 5.7 默认 type=0/size=1M：dev.mysql.com/doc/refman/5.7/en/query-cache.html + dev.mysql.com/doc/refman/5.7/en/query-cache-configuration.html（"By default, the query cache is disabled. This is achieved using a default size of 1M, with a default for query_cache_type of 0."）
- binlog_format 5.7.7 默认 ROW：dev.mysql.com/doc/relnotes/mysql/5.7/en/news-5-7-7.html
- 5.7 默认 latin1 → 8.0 默认 utf8mb4：dev.mysql.com/doc/refman/8.0/en/mysql-nutshell.html（"The default character set has changed from latin1 to utf8mb4."）
- utf8mb4_0900_ai_ci 基于 UCA 9.0.0、仅 8.0+：dev.mysql.com/doc/refman/8.0/en/charset-unicode-sets.html
- long_query_time 默认 10：dev.mysql.com/doc/refman/8.0/en/slow-query-log.html（"The minimum and default values of long_query_time are 0 and 10, respectively."）
- relay_log_recovery 默认 OFF：dev.mysql.com/doc/refman/8.3/en/replication-options-replica.html（Default Value OFF）
- skip_name_resolve 默认 OFF + 官方推荐依据：dev.mysql.com/doc/refman/{8.0,9.x}/en/host-cache.html
- innodb_buffer_pool_instances 默认 8（pool < 1GB 取 1）：dev.mysql.com/doc/refman/8.0/en/innodb-multiple-buffer-pools.html + innodb-parameters.html；8.4 改自算：lefred.be MySQL 8.4 LTS InnoDB defaults
- innodb_ft_min_token_size 默认 3 / innodb_ft_enable_stopword 默认 ON：InnoDB parameters 页（5.7 官方镜像 docs.oracle.com/cd/E17952_01/mysql-5.7-en/innodb-parameters.html + 8.2 dev.mysql.com/doc/refman/8.2/en/innodb-parameters.html）
- preserve_commit_order 8.0 DMR 期已存在：dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-3.html（8.0.3 RC 已含该变量修复记录）

### 规划期来源（2026-08-29 前两轮）

- 8.4 移除/废弃清单：dev.mysql.com/doc/refman/8.4/en/added-deprecated-removed.html
- 8.4 新特性（mysql_native_password 默认停用 + InnoDB 默认值变化）：dev.mysql.com/doc/refman/8.4/en/mysql-nutshell.html
- slave→replica 改名原文：dev.mysql.com/doc/refman/8.0/en/replication-options-replica.html
- default_authentication_plugin 8.0.27 废弃：dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-27.html
- 5.7 transaction_isolation 别名（5.7.20+）：dev.mysql.com/doc/refman/5.7/en/server-options.html
- bind_address 默认 `*`：dev.mysql.com/doc/refman/8.0/en/server-system-variable-reference.html + 多源交叉
- Binlog 参数族（binlog_expire_logs_seconds 默认 30 天/8.0.1 引入、log_bin 8.0 默认 ON、sync_binlog 默认 1、binlog_format 8.0.34 废弃）：dev.mysql.com/doc/refman/8.0/en/replication-options-binary-log.html + dev.mysql.com/blog-archive/replication-features-in-mysql-8-0-1/
- gtid_mode 四态 5.7.6：dev.mysql.com/doc/refman/5.7/en/replication-options-gtids.html + Server Team 博客
- local_infile 默认值跨版（5.7 ON / 8.0 OFF）：dev.mysql.com/doc/mysql-security-excerpt/5.7/en/load-data-local-security.html + 8.x 对应页
- ngram 全文分词器（5.7.6 引入、ngram_token_size 默认 2 / 范围 1-10）：dev.mysql.com/doc/refman/5.7/en/fulltext-search-ngram.html
- preserve_commit_order（5.7.22 引入 slave_preserve_commit_order、8.0.26 改名、8.0.27 默认 ON）：dev.mysql.com/blog-archive/preserve-masters-commit-order-on-slave/ + 8.0 replica options 页
