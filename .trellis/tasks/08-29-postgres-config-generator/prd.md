# PostgreSQL 配置生成器

## Goal

配置生成器系列第三个工具：生成 PostgreSQL `postgresql.conf`，复用 Redis/MySQL 已验证的引擎模式（纯函数数据层 + 表单层组件 + 三块页面布局），并借第 3 消费者契机把共享表单层上浮为系列原语。

## Background

- 前作：Redis（06-27 归档）、MySQL（08-29 归档，merge `8e4ca9a`），均已上线
- 用户既定原则：**常用项原则**——只收录常用配置项；**工具页独特形态**——域相关组件不上浮全局
- 版本轴与组件处置、复制模式三项产品决策均已于 2026-08-29 用户确认（见 Key Decisions）

## Key Decisions（用户确认，2026-08-29）

1. **版本轴 16 / 17 / 18**：14 已进入 EOL 倒计时（2026-11-12）不纳入；15 存量用户在 FAQ/文档提示升级路径
2. **共享表单层上浮**：`NumberField`/`ConfigPreview`/`ParamRow` 上浮到新建 `src/components/config/`（不混入 shadcn ui 目录）；ParamRow 以 MySQL 版为超集收敛；同步改 Redis/MySQL 引用、行为不变；`ControlPanel` 等域相关组件保持私有
3. **单机/主从切换**：主从态输出主库侧参数（max_wal_senders/max_replication_slots/wal_keep_size）+ 备库要点提示块；**不做独立备库 conf 产物**（备库 conf 随 pg_basebackup 继承）

## Confirmed Facts

**代码库证据**（组件重合度 diff）：NumberField 两份仅差 2 行、ConfigPreview 差 7 行（实质相同）；ParamRow 差 80 行（MySQL 版独立长出徽章/弃用能力，复制漂移实证）；ControlPanel 差 202 行（域相关，不上浮）。

**官方文档核对**（`research/postgres-params-version-notes.md`，来源 16.15/17.11/18.6 docs tarball + `guc_tables.c`，postgresql.org 被本机 TLS 阻断）：

- 16/17/18 窗口内 rename/移除仅 3 项（`ssl_ecdh_curve`→`ssl_groups`@18、`old_snapshot_threshold`/`trace_recovery_messages`@17 移除），**均不在本注册表**——无弃用/改名徽章场景；minor 版本依据官方版本策略不引入新参数。不存在 MySQL 的"轴点安全方向"陷阱，版本建模简化为 `availableIn` 布尔
- 默认值跨版本变化仅 `effective_io_concurrency`（16/17=1 → 18=16）与 `maintenance_io_concurrency`（10→16，不进注册表）；PG 17 无任何默认值变化
- 18 独有参数：`io_method`/`io_workers`（进注册表）、`io_max_concurrency`/`autovacuum_worker_slots`/`autovacuum_vacuum_max_threshold`/`idle_replication_slot_timeout`（裁剪）；`log_connections` 18 布尔→列表类型（**回避**）
- 仅 initdb 可设（写进 conf 非法）：`lc_collate`/`lc_ctype`/`server_encoding`/`data_checksums`
- `huge_pages` 三版默认 try（=try 指 hugetlbfs 显式大页，与 THP 无关）；`wal_compression` 枚举 off/pglz/lz4/zstd（on 是 pglz 别名）；`log_autovacuum_min_duration` 15 起默认 10min
- OS 建议：`vm.overcommit_memory=2`、大页分配流程、`fs.file-max` 有官方背书（kernel-resources.html）；**THP 被官方文档明确不推荐**（huge_pages 条目原文 discouraged），关闭取值（never/madvise）与 `vm.swappiness` 标"社区惯例"
- 备库要点官方依据齐全：standby 的 `max_connections`/`max_worker_processes`/`max_wal_senders` 须 ≥ 主库；`hot_standby` 默认 on（10+）；`pg_basebackup -R` 写 standby.signal 与 primary_conninfo/primary_slot_name，`-C -S` 建槽

## Requirements

- **R1 快捷配置**（ControlPanel）：模式（单机/主从）/ 版本（16/17/18）/ 内存 GB / CPU 核数（恢复，并行组公式消费者）/ 磁盘类型 / 场景 / 并发数 / 监听范围+绑定 IP+端口 / 重置；**无密码项**（PG 密码属 pg_hba + ALTER ROLE，不存 conf）
- **R2 注册表 9 组 39 条目**：连接与认证 5 / 内存 5 / WAL 与检查点 7 / 复制 3（仅主从态）/ 并行与优化器 7 / 自动清理 4 / 日志 4 / 异步 IO 2（仅 v18）/ 时区 2——全表见 design §5；常用项原则，裁剪备忘同节
- **R3 版本联动**：版本选择器；异步 IO 组仅 v18 渲染；`effective_io_concurrency` 的 HDD 默认随版本（16/17→1、18→16）；16–18 无弃用徽章场景
- **R4 预算公式**：shared_buffers 25%、effective_cache_size 60%、work_mem/maintenance_work_mem/max_connections/max_wal_size 阶梯、并行三式、按磁盘的 planner 参数——design §6
- **R5 主从态**：复制参数组渲染 + 备库要点提示块（建角色/建槽 SQL、pg_basebackup 命令、standby ≥ 主库三项、hot_standby 无需写）；16–18 语法一致无分支
- **R6 OS 建议分区**：官方背书 vs 社区惯例（明确标注），AdvicePanel 承载 + 免责声明
- **R7 共享层上浮**：契约与回归门见 design §2（types.ts 解耦工具类型；serializeConf 留工具侧；版本可用性判断留工具引擎；ParamRow 密码生成改 emit）
- **R8 注册**：tools.ts（icon 🐘、relatedToolIds 三工具双向）、tool-faqs.ts 5 条、pages/tools 对称、SEO 全字段
- **R9 工具页硬性要求**：输入校验中文提示、清空/复制按钮、打开即用合理默认值（4GB/4 核/SSD/oltp/200 并发）

## Acceptance Criteria

- [ ] `pnpm test` / `pnpm astro check` / `pnpm build` 三绿（已知 9 个历史基线失败除外，零新增失败）
- [ ] PG 新增单测 ≥5 套（params/version/compute/generate/advice）；共享组件测试迁移后 NumberField/ParamRow 覆盖不降
- [ ] 打开即用：默认画像直接生成合理 conf，`^key = value` 格式快照锚定
- [ ] 版本切换联动：v18 显示异步 IO 组、16/17 隐藏；快照与指令断言双锚
- [ ] 主从切换：复制组与备库要点块出现/隐藏正确
- [ ] Redis/MySQL 回归：上浮后既有套件零行为断言变化 + 两页浏览器冒烟（打开即用/改值联动/复制下载）
- [ ] PG 页浏览器冒烟：桌面 + 移动端（纪律见 `.trellis/spec/frontend/quality-guidelines.md`）
- [ ] SEO/FAQ/relatedToolIds 齐全，构建页面数正确

## Out of Scope

- HA 编排（Patroni / repmgr / citus）与扩展（PostGIS 等）推荐清单
- pg_hba.conf 完整生成（仅备库要点中的提示）
- redis.conf/my.cnf 等配置导入解析
- 回避项与裁剪项（design §5 备忘）：`log_connections`、`maintenance_io_concurrency`、`shared_preload_libraries`（FAQ 讲 pg_stat_statements）、`io_max_concurrency` 等 18 独有冷门项、仅 initdb 项
- 内存账单动态插值（静态文案，沿用 MySQL 决定）
