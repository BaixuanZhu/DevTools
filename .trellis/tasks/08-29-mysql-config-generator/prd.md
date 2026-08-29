# MySQL 配置文件生成器

## Goal

devops 分类新增 MySQL 配置文件可视化生成器工具页（`/devops/mysql-config-generator`）：硬件/场景/版本输入 → 实时生成带版本标注的 my.cnf，支持复制/下载；配置生成器系列（Redis ✅ → MySQL → PG）第二步，复用 redis-config 沉淀的 engine 模式。

## Background / Motivation

- 承接 2026-08-28 立项（devops 配置生成器系列）：PGTune 只覆盖 PostgreSQL，MySQL 无权威在线生成器；AI 问答无法直接产出可下载的配置文件——可视化生成器是差异化卖点。
- Redis 版（`/devops/redis-config-generator`）已上线并经六轮反馈打磨：engine 模式（纯函数数据层 + 私有 Vue 组件）与交互形态（快速配置 + 分组默认收起 + 实时预览 + 附加建议区块）均获用户验收。MySQL 版沿用同一形态，**数据层全部重写**（参数注册表、内存/连接公式、版本废弃矩阵均为 MySQL 领域知识）。

## Confirmed Facts（仓库证据）

- **引擎模式可复用**：`src/tools/devops/redis-config/`（params.ts 1078 行、compute/generate/version/sysctl/secret 纯函数、5 个私有子组件，合计约 2600 行）；页面级 `RedisConfigGenerator.vue` 187 行。分层原则：数据与计算全部是可单测纯函数，Vue 只做绑定与展示。
- **交互形态既定**（用户验收）：左栏快速配置 + 分组参数单卡 `divide-y` 清单默认全收起 + 右栏 sticky 实时预览（行号/高亮/复制/下载/重置）+ 底部附加建议区块 + 免责声明；移动端预览紧随快速配置。
- **注册/SEO 流程既定**：`tools.ts` 全字段 + `tool-faqs.ts` FAQ + `pages/devops/*.astro`（`client:idle`）+ ToolLayout（JSON-LD/FAQ/相关工具自动产出）。
- **站点强制约束**：Security Rules（禁 eval；随机数用 Web Crypto 本地生成）；无路径别名（相对 import）；不新增依赖；UI 原语 reka-ui/shadcn-vue；toast 通知走 toastStore；私有组件放 `mysql-config/` 不上浮全局（跨 3+ 工具复用才上浮）；Tailwind v4 间距 4px 规则；新增公共 API 必须 JSDoc。
- **已知坑**（spec 已沉淀）：reka-ui SelectItem 空串 value 抛错——select 选项值禁止空串；Vue 绑定名避开 `valueOf` 等 Object.prototype 同名。

## Requirements

### 功能需求（沿用 Redis 版形态，数据层 MySQL 化）

1. **左栏快速配置**：
   - 部署模式单选（单机 / 主从）；主从模式展开复制参数组
   - 硬件画像：内存（GB）、磁盘类型（HDD / SSD / NVMe）——CPU 核数不收集（精简参数集下无公式消费方，PG 版再评估）
   - 使用场景四档：通用 OLTP（默认）/ 读多写少 / 写密集 / 分析报表——驱动内存/刷盘/隔离级别公式
   - 版本按钮组：5.7 / 8.0 / 8.4（用户选定，2026-08-29）
   - 并发连接数预估（驱动 max_connections 与内存账单）
   - 监听范围：所有接口（默认）/ 仅本机 / 仅内网网卡（填绑定 IP，必填校验）——联动 `bind-address` 推荐值
   - 监听端口：默认 3306
   - **与 Redis 的差异：无密码输入**——my.cnf 不管理账号密码（`CREATE USER` / `GRANT` 属 SQL 层），面板注释与 FAQ 说明
2. **参数注册表（常用项原则 + 覆盖度终检）**：约 30 参数、9 组（连接与事务 / 内存与查询缓存 / **全文检索与分词（ngram）** / Redo 与刷盘 / 二进制日志 / 复制（主从限定）/ 字符集 / 安全与认证 / 日志慢查，见 design.md）——冷门参数不进注册表（用户 2026-08-29 反馈："包含常用项即可，MySQL 的默认 ini 文件其实都没几行"）；终检回补中文全文分词（ngram）、skip_name_resolve、preserve_commit_order 三项高频需求。面板每个参数带"为什么是这个值"中文说明 + 官方文档链接；conf 产物保持纯净（头部元信息 + `[mysqld]` 段 + 组标题注释，无逐参数中文注释；头部注释提示"datadir/socket/log-error 等安装路径参数保留安装器生成的值"）。
3. **版本标注与废弃/改名过滤**（MySQL 版核心差异，废弃矩阵远比 Redis 丰富）：
   - 5.7 → 8.0：`query_cache_*` 移除、`tx_isolation`/`tx_read_only` 改名 `transaction_isolation`/`transaction_read_only`、默认字符集 latin1 → utf8mb4
   - 8.0 → 8.4：`expire_logs_days` 8.2 移除（→ `binlog_expire_logs_seconds`）、`innodb_log_file_size(_in_group)` 8.0.30 废弃（8.4 仍可用，轴上由 `innodb_redo_log_capacity` 取代）、`default_authentication_plugin` 8.4 移除、`mysql_native_password` 8.4 默认停用
   - **轴点安全方向**（官方文档核对 2026-08-29）：补丁级引入的新名参数（8.0.26+ `replica_*`、8.0.27+ `authentication_policy`、8.0.30+ `innodb_redo_log_capacity`）禁止在 8.0 轴输出——8.0.0-8.0.25 会因未知变量启动失败；8.0 轴输出该轴全系可用的旧名，新名仅 8.4 轴输出
   - 改名对/替换对用 `deprecatedIn`/`replacedBy` 建模（复用 Redis 引擎机制，目标版本命中废弃的参数不写入 conf、面板显示"废弃 → 替代参数"提示）
   - 补丁级精度：徽章显示就近轴点（如 8.0），补丁版本写在注释文案里；输出安全遵循轴点安全方向（新名参数不在引入补丁版之前的轴输出）
   - 版本事实以 research/mysql-params-version-notes.md 为准（源：MySQL 官方文档），实现时人工复核
4. **内存模型公式**（MySQL 核心差异）：`innodb_buffer_pool_size` 按专用服务器 RAM × 50%-70% 派生（场景/磁盘调系数）；内存账单提示用保守每连接基线常数（≈2MB，注释注明粗估）× max_connections + 全局缓冲估算占比，防内存超卖——连接级缓冲参数本身不进注册表（冷门且全局设置属反模式）。
5. **主从模式**：复制组含 `server_id`（挂载时本地随机种子一次，避免重复经典坑）、`gtid_mode`（默认 ON，可切 OFF 传统 file/position 模式，选项值非空串）、`enforce_gtid_consistency`、`relay_log_recovery`、`read_only`/`super_read_only`、并行回放参数（5.7/8.0 轴输出 `slave_parallel_workers`，8.4 轴输出 `replica_parallel_workers`，见轴点安全方向）；附加"复制初始化 SQL 提示"区块输出 `CHANGE REPLICATION SOURCE TO` 片段（占位符形式，形态对齐 Redis 的 sysctl 附加区块）。
6. **OS 附加建议区块**：`nofile` ulimit、`vm.swappiness`、IO 调度/文件系统提示——不属于 my.cnf，预览底部单独折叠输出。
7. **打开即用 + 免责声明**：合理默认画像（4GB / SSD / 通用 OLTP / 8.0 / 并发 200 / 单机）生成合法 my.cnf；页面标注"输出为参考值，需结合 SHOW STATUS / 慢查询 / 监控调整"。

### 约束

- 同 Confirmed Facts 中站点强制约束；产物文件名 `my.cnf`；下载/复制/重置按钮齐备。
- 测试沿用分类单测布局：`src/tools/devops/mysql-config/__tests__/` 覆盖 compute/version/generate/params 不变量（select 选项值非空串）。

## Out of Scope

- MGR / InnoDB Cluster / Group Replication、半同步插件细节（面板提示即可）
- my.cnf 导入/解析（反向功能）
- PostgreSQL 版本（独立立项）
- MariaDB（参数体系已分叉，不混入）
- `sql_mode` 显式输出（易踩坑，不进注册表）；`SET PERSIST` 机制相关输出
- **冷门/反模式参数族**（常用项原则，2026-08-29 用户反馈裁剪）：连接级缓冲（sort/join/read/binlog_cache_size）、thread_cache_size、table_open_cache(_definition)、performance_schema、innodb_flush_neighbors、innodb_read/write_io_threads、innodb_log_buffer_size、tmp_table_size/max_heap_table_size、max_binlog_size、binlog_row_image、max_connect_errors、local_infile、require_secure_transport、innodb_lock_wait_timeout
- **启动危险参数**（只进 FAQ 教育，不进产物）：`sql_mode`（覆盖默认行为易破坏既有 SQL）、`lower_case_table_names`（8.0 初始化后改值服务器直接拒绝启动）
- **运行时开关类**（SET GLOBAL 按需，不固化）：event_scheduler、general_log、log_queries_not_using_indexes（慢查面板注释提及）
- **环境路径类**（安装器/运维专属）：datadir、socket、log-error、pid-file、basedir、tmpdir——产物头部注释提示保留现有值
- **网络/会话微调类**（已检视，影响小或有更优修法）：back_log（OS 建议区块的 somaxconn 覆盖）、net_read/write_timeout、connect_timeout、interactive_timeout（wait_timeout 注释提及）、group_concat_max_len（正确修法是会话级 SET，全局固化影响内存）、event_scheduler

## Acceptance Criteria

- [ ] 注册表完整：`tools.ts` 全字段（id/category/path/name/description/seoDescription/keywords/icon/relatedToolIds）+ FAQ（`tool-faqs.ts`）+ 路由 `/devops/mysql-config-generator` + sitemap 含该页
- [ ] 打开即用：不改任何输入生成合法、可直接使用的 my.cnf（含 `[mysqld]` 段头）
- [ ] 版本联动：版本轴 5.7/8.0/8.4 按钮组；低版本不出现高版本参数；目标版本已废弃/改名参数不写入 conf 且面板显示替代提示（5.7 输出 `tx_isolation`、8.4 输出 `innodb_redo_log_capacity` 等矩阵以 research 笔记为准）
- [ ] 场景联动：四档场景驱动内存/刷盘/隔离级别等公式，切档后预览即时更新
- [ ] 内存账单：面板可见"每连接缓冲 × max_connections + 全局缓冲"与 RAM 的关系提示
- [ ] 主从联动：单机模式 conf 无复制组与 SQL 提示区块；主从模式展开复制组，`server_id` 打开页面即随机种子一次且可覆盖，SQL 提示区块出现
- [ ] 所有 select 选项值非空串（reka-ui 硬约束，防回归单测）
- [ ] 复制按钮给 toast 反馈；下载产出文件名 `my.cnf`；重置恢复推荐值
- [ ] 面板每个参数可见中文说明，数值参数附推荐快捷选项；conf 产物无逐参数注释；含免责声明
- [ ] 单元测试覆盖：compute 公式（buffer pool/内存账单/双 1 刷盘）、版本过滤与改名替换、conf 模板渲染
- [ ] `pnpm build` / `pnpm test` / `pnpm astro check` 全绿；暗色模式与移动端（基础响应式）可用
