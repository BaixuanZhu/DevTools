# Research: Redis 配置参数版本元数据核对笔记（7.0 / 7.2 / 7.4 / 8.0）

- Query: 为 Redis 配置生成器核对每个参数的 introducedIn / deprecatedIn / replacedBy（版本轴 7.0/7.2/7.4/8.0，早于 7.0 统一 pre-7）
- Scope: external（Redis 官方源码 src/config.c、各版本 redis.conf、00-RELEASENOTES、redis.io 文档页）
- Date: 2026-08-28

## 0. 数据来源与核对方法（先读）

**redis.io 已没有逐参数配置文档页。** 本次实测（2026-08-28）：
`/docs/latest/operate/oss_and_mgmt/config/`、`/docs/latest/operate/oss_and_stack/management/config/<param>/`、
`.../config/config-details/` 均 404；官方 config 总览页明确说明参数清单"以自文档化的 redis.conf 样例文件为准"。
因此本笔记的 "Available since / Deprecated" 证据链改为官方一手来源：

| 缩写 | 来源 | 说明 |
|---|---|---|
| `[cfg]` | `https://github.com/redis/redis/blob/<tag>/src/config.c` | 参数注册表（注册名、alias、flags、默认值）的**权威来源**；alias 即"改名后旧名仍兼容"的直接证据 |
| `[conf]` | `https://raw.githubusercontent.com/redis/redis/<tag>/redis.conf` | 自文档化样例配置（含默认值说明注释与示例行） |
| `[RN-x]` | `https://github.com/redis/redis/blob/<x>/00-RELEASENOTES` | 官方发布说明，含 "New configuration options" 章节 |
| PR | `https://github.com/redis/redis/pull/<n>` | 发布说明中引用的 PR |

本次核对方法：下载 7.0/7.2/7.4/8.0（另加 5.0/6.0/6.2 交叉验证）四个 `redis.conf` 与 `src/config.c`，
对参数注册行做逐版本 diff，并对 release notes 全文 grep。**结论均为逐条查证，非记忆。**

GA 日期（官方 release notes）：7.0.0 = 2022-04-27；7.2.0 = 2023-08-15；7.4.0 = 2024-07-29；8.0.0 = 2025-05-02。

### 引用页 URL（已验证 HTTP 200）

- 配置总览：https://redis.io/docs/latest/operate/oss_and_stack/management/config/
- 持久化（AOF/RDB）：https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/
- 复制：https://redis.io/docs/latest/operate/oss_and_stack/management/replication/
- 淘汰策略：https://redis.io/docs/latest/develop/reference/eviction/
- 键空间通知：https://redis.io/docs/latest/develop/use/keyspace-notifications/
- ACL：https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/

## 1. 主表格

> 约定：introducedIn=pre-7 表示 7.0 前已存在（未逐一核实精确引入版本，除标注 5.0/6.0/6.2 的行）。
> "deprecatedIn=旧名别名保留" 表示旧名未被移除，7.0-8.0 写旧名仍可用（conf 解析不报错）；
> 生成器面向 7.0+ 目标版本应输出新名，面向 pre-7 目标版本才输出旧名。

### 网络连接

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| bind | pre-7 | — | — | special 多参指令；默认空 = 监听所有接口；8.0 示例 conf 激活行 `bind 127.0.0.1 -::1`（`-` 前缀=该地址族缺失不报错） | [conf-8.0](https://raw.githubusercontent.com/redis/redis/8.0/redis.conf)；[cfg-8.0](https://github.com/redis/redis/blob/8.0/src/config.c) |
| protected-mode | pre-7 | — | — | 默认 `yes`；7.0（#9034）改进了 bind/protected-mode 联动处理 | [cfg] |
| port | pre-7 | — | — | 默认 `6379` | [cfg] |
| timeout | pre-7 | — | — | 默认 `0`（不因空闲断开） | [cfg] |
| tcp-keepalive | pre-7 | — | — | 默认 `300`（秒） | [cfg] |
| tcp-backlog | pre-7 | — | — | 默认 `511`；IMMUTABLE（仅启动时可设） | [cfg] |
| maxclients | pre-7 | — | — | 默认 `10000` | [cfg] |

### 内存策略

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| maxmemory | pre-7 | — | — | 默认 `0` = 不限制 | [cfg]；[eviction](https://redis.io/docs/latest/develop/reference/eviction/) |
| maxmemory-policy | pre-7 | — | — | 默认 `noeviction`；7.0-8.0 枚举恒为 8 个值，无增减（见 Q5） | [cfg]（maxmemory_policy_enum）；[eviction] |
| maxmemory-samples | pre-7 | — | — | 默认 `5`；7.2 起合法上限改为 64（7.0 为 INT_MAX，仅校验边界差异，默认不变） | [cfg] 7.0 vs 7.2 diff |
| io-threads | pre-7（6.0 引入） | — | — | 默认 `1`；IMMUTABLE | [cfg]（6.0 config.c 已注册） |
| io-threads-do-reads | pre-7（6.0 引入） | **8.0.0**（废弃无效） | 无 —— 删除该行即可 | 默认 `no`；7.0-7.4 正常可用；8.0 起新 I/O 线程实现"读写均线程化"，该参数进入 config.c `deprecatedConfig` 表且 conf 注释整段删除；RN-8.0 原文："io-threads-do-reads is no longer effective. The new I/O threading implementation always use threads for both reads and writes" | [cfg-8.0]（deprecated 表 + 7.0/7.4 已注册）；[RN-8.0](https://github.com/redis/redis/blob/8.0/00-RELEASENOTES)（8.0-M04 节） |

### RDB

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| save | pre-7 | — | — | 默认 `save 3600 1 300 100 60 10000`。注意：默认值变更发生在 **6.2.0**（6.2 conf 注释 "Unless specified otherwise, by default Redis will save the DB: 3600s/1, 300s/100, 60s/10000"；6.0 conf 为激活行 `save 900 1`/`save 300 10`/`save 60 10000`）；6.2-8.0 conf 中 save 均为注释行，由编译内默认生效 | [conf-6.0](https://raw.githubusercontent.com/redis/redis/6.0/redis.conf)、[conf-6.2](https://raw.githubusercontent.com/redis/redis/6.2/redis.conf)、[conf-7.0] |
| stop-writes-on-bgsave-error | pre-7 | — | — | 默认 `yes` | [cfg] |
| rdbcompression | pre-7 | — | — | 默认 `yes` | [cfg] |
| rdbchecksum | pre-7 | — | — | 默认 `yes`；IMMUTABLE（仅启动，7.0 与 8.0 一致） | [cfg] |
| dbfilename | pre-7 | — | — | 默认 `dump.rdb`；PROTECTED_CONFIG（受 enable-protected-configs 管控） | [cfg] |
| dir | pre-7 | — | — | 默认 `./`；PROTECTED_CONFIG | [cfg] |

### AOF

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| appendonly | pre-7 | — | — | 默认 `no` | [cfg] |
| appendfsync | pre-7 | — | — | 默认 `everysec` | [cfg] |
| no-appendfsync-on-rewrite | pre-7 | — | — | 默认 `no` | [cfg] |
| auto-aof-rewrite-percentage | pre-7 | — | — | 默认 `100` | [cfg] |
| auto-aof-rewrite-min-size | pre-7 | — | — | 默认 `64mb` | [cfg] |
| aof-use-rdb-preamble | pre-7 | — | — | 默认 `yes` | [cfg] |
| appenddirname | **7.0.0** | — | — | 默认 `"appendonlydir"`；IMMUTABLE；多部分 AOF（Multi-Part AOF）的存储目录名，7.0 起示例 conf 为激活行 | [RN-7.0]："appenddirname, folder where multi-part AOF files are stored (#9788)"；[persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)："Since Redis 7.0.0, AOF files are split into multiple files which reside in a single directory determined by the appenddirname configuration" |

### 数据结构编码

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| list-max-listpack-size | **7.0.0**（改名） | 旧名 `list-max-ziplist-size` 别名保留（7.0-8.0 可用） | ← list-max-ziplist-size | 默认 `-2`；RN-7.0："list-max-listpack-\*, hash-max-listpack-\*, zset-max-listpack-\* as aliases for the old ziplist configs (#8887, #9366, #9740)" | [RN-7.0]；[cfg]：`createIntConfig("list-max-listpack-size", "list-max-ziplist-size", ...)` |
| hash-max-listpack-entries | **7.0.0**（改名） | 旧名 `hash-max-ziplist-entries` 别名保留 | ← hash-max-ziplist-entries | 默认 `512` | 同上 |
| hash-max-listpack-value | **7.0.0**（改名） | 旧名 `hash-max-ziplist-value` 别名保留 | ← hash-max-ziplist-value | 默认 `64` | 同上 |
| zset-max-listpack-entries | **7.0.0**（改名） | 旧名 `zset-max-ziplist-entries` 别名保留 | ← zset-max-ziplist-entries | 默认 `128` | 同上 |
| zset-max-listpack-value | **7.0.0**（改名） | 旧名 `zset-max-ziplist-value` 别名保留 | ← zset-max-ziplist-value | 默认 `64` | 同上 |
| set-max-intset-entries | pre-7 | **未废弃**（8.0 仍有效） | — | 默认 `512`；注意：8.0 config.c 中它是**无别名的独立参数**（`createSizeTConfig("set-max-intset-entries", NULL, ...)`），仅管整数集合（intset 编码），与 set-max-listpack-* 并存；**不要**给它标 replacedBy | [cfg-8.0]；[conf-8.0]（激活行 `set-max-intset-entries 512`） |
| set-max-listpack-entries | **7.2.0** | — | — | 默认 `128`；7.0 conf 无此参数、7.2 conf 起有（diff 证实）；release notes 未单列（见 Q2 存疑注） | [conf-7.0] vs [conf-7.2](https://raw.githubusercontent.com/redis/redis/7.2/redis.conf) diff |
| set-max-listpack-value | **7.2.0** | — | — | 默认 `64` | 同上 |

### 安全

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| requirepass | pre-7 | **未标废弃**（官方定位见 Q7） | — | 默认空；MODIFIABLE & SENSITIVE；6.0 起为 ACL 兼容层（= 为 default 用户设密码），与 `aclfile`/`ACL LOAD` 互斥（互斥时被忽略） | [conf-8.0] 注释；[acl](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)；[cfg-8.0] updateRequirePass |
| enable-debug-command | **7.0.0** | — | — | IMMUTABLE（仅启动）；取值 `no`/`yes`/`local`；默认 `no`；放开 DEBUG 命令 | [RN-7.0]："MODULE and DEBUG commands disabled (protected) by default, for better security (#9920)"；[cfg]（protected_action_enum） |
| enable-module-command | **7.0.0** | — | — | 同上，放开 `MODULE LOAD/UNLOAD` | 同上 |
| enable-protected-configs | **7.0.0** | — | — | 同上，放开 PROTECTED_CONFIG 类敏感参数的运行期修改（dir、dbfilename 等）；RN-7.0："Sensitive configs and commands blocked (protected) by default (#9920)" | 同上 |

### 客户端缓冲

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| client-output-buffer-limit | pre-7 | — | — | special 多参指令；8.0 默认 `normal 0 0 0` / `replica 256mb 64mb 60` / `pubsub 32mb 8mb 60`（conf 三条激活行） | [cfg]；[conf-8.0] |
| busy-reply-threshold | **7.0.0**（新名，#9963） | 旧名 `lua-time-limit` 别名保留（7.0-8.0 可用） | ← lua-time-limit | 默认 `5000`（毫秒）；[cfg]：`createLongLongConfig("busy-reply-threshold", "lua-time-limit", ...)` | [RN-7.0]："busy-reply-threshold, alias for the old lua-time-limit (#9963)" |

### 观测

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| slowlog-log-slower-than | pre-7 | — | — | 默认 `10000`（微秒）；`-1` 禁用 | [cfg] |
| slowlog-max-len | pre-7 | — | — | 默认 `128` | [cfg] |
| latency-monitor-threshold | pre-7 | — | — | 默认 `0`（关闭）；6.0 config.c 已注册 | [cfg] |

### Lazy free

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| lazyfree-lazy-eviction | pre-7 | — | — | 默认 `no` | [cfg] |
| lazyfree-lazy-expire | pre-7 | — | — | 默认 `no` | [cfg] |
| lazyfree-lazy-server-del | pre-7 | — | — | 默认 `no` | [cfg] |
| lazyfree-lazy-user-del | pre-7（6.0 config.c 已注册） | — | — | 默认 `no` | [cfg]；[cfg-6.0](https://github.com/redis/redis/blob/6.0/src/config.c) |

### 键空间

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| notify-keyspace-events | pre-7 | — | — | 默认 `""`（关闭）；special 指令 | [cfg]；[keyspace](https://redis.io/docs/latest/develop/use/keyspace-notifications/) |
| active-expire-effort | pre-7（6.0 config.c 已注册） | — | — | 默认 `1`，合法范围 1-10 | [cfg] |
| databases | pre-7 | — | — | 默认 `16`；IMMUTABLE | [cfg] |

### 复制

| 参数 | introducedIn | deprecatedIn | replacedBy | 备注 / 默认值要点 | 来源 |
|---|---|---|---|---|---|
| replicaof | pre-7（`replicaof` 指令写法 5.0.0 起即被接受；`slaveof` 更早） | 旧名 `slaveof` 保留为 alias（8.0 注册名即 replicaof） | ← slaveof | IMMUTABLE；cluster 模式下禁用（"replicaof directive not allowed in cluster mode"） | [cfg-5.0](https://github.com/redis/redis/blob/5.0/src/config.c)（同时接受 slaveof/replicaof）；[cfg-8.0]：`createSpecialConfig("replicaof", "slaveof", ...)` |
| masterauth | pre-7 | — | — | 默认空；SENSITIVE | [cfg] |
| replica-read-only | pre-7（主名自 **6.0.0** 起，见 Q6） | 旧名 `slave-read-only` 别名保留 | ← slave-read-only | 默认 `yes` | [cfg-6.0]：`createBoolConfig("replica-read-only", "slave-read-only", ...)` |
| replica-serve-stale-data | pre-7（主名自 **6.0.0**） | 旧名 `slave-serve-stale-data` 别名保留 | ← slave-serve-stale-data | 默认 `yes` | 同上 |
| repl-backlog-size | pre-7 | — | — | 默认 `1mb` | [cfg] |
| repl-diskless-sync | pre-7 | — | — | **默认值 7.0.0 起由 no 改为 yes**（RN-7.0："Config: repl-diskless-sync is now set to yes by default (#10092)"；6.2 config.c 默认 0，7.0 config.c 默认 1）；7.0-8.0 示例 conf 激活行 `yes` | [RN-7.0]；[cfg-6.2] vs [cfg-7.0] |
| min-replicas-to-write | pre-7（主名自 **6.0.0**） | 旧名 `min-slaves-to-write` 别名保留 | ← min-slaves-to-write | 默认 `0`（0=不限制） | [cfg-6.0]：`createIntConfig("min-replicas-to-write", "min-slaves-to-write", ...)` |
| min-replicas-max-lag | pre-7（主名自 **6.0.0**） | 旧名 `min-slaves-max-lag` 别名保留 | ← min-slaves-max-lag | 默认 `10`（秒） | 同上 |

### 7.0-8.0 各版本 conf 新增参数总览（生成器"版本特性"数据）

| 版本 | 新增 conf 参数 | 说明 |
|---|---|---|
| 7.0.0 | appenddirname、busy-reply-threshold、enable-debug-command、enable-module-command、enable-protected-configs、list/hash/zset-max-listpack-\*（5 个新名）、repl-diskless-sync-max-replicas、shutdown-timeout、maxmemory-clients、cluster-port、bind-source-addr、latency-tracking、latency-tracking-info-percentiles、cluster-announce-hostname、cluster-preferred-endpoint-type、cluster-allow-pubsubshard-when-down、cluster-link-sendbuf-limit | 后 5+ 个为 cluster/观测向，按需纳入；默认值变更：repl-diskless-sync → yes |
| 7.2.0 | locale-collate、set-max-listpack-entries、set-max-listpack-value、cluster-announce-human-nodename | locale-collate 默认 `""`（空=继承环境变量，影响 Lua/SORT 字符串比较，#11059） |
| 7.4.0 | hide-user-data-from-log、max-new-connections-per-cycle、max-new-tls-connections-per-cycle | 另有 CPU 亲和参数改名（带别名）：server_cpulist→server-cpulist、bio_cpulist→bio-cpulist、aof_rewrite_cpulist→aof-rewrite-cpulist、bgsave_cpulist→bgsave-cpulist（#7351） |
| 8.0.0 | replica-full-sync-buffer-limit、cluster-compatibility-sample-ratio | 另：io-threads-do-reads 废弃；新增 redis-full.conf（含 Query Engine/TimeSeries/Probabilistic 组件参数，如 search-on-timeout）；7.4→8.0 核心参数默认值零变化 |

## 2. 重点问题

### Q1：7.0 引入/改名的参数核对

- **appenddirname**：确为 **7.0.0** 引入（RN-7.0 #9788；6.2 config.c 无、7.0 config.c 注册；配套 Multi-Part AOF）。
- **enable-debug-command / enable-module-command / enable-protected-configs**：**确为 7.0.0 引入**。
  证据：6.0 与 6.2 的 config.c 均 0 命中，7.0 config.c 注册（`protected_action_enum`，IMMUTABLE，默认 no）；
  RN-7.0 原文 "MODULE and DEBUG commands disabled (protected) by default, for better security (#9920)"、
  "Sensitive configs and commands blocked (protected) by default (#9920)"。
  注意：这三个参数不在 RN-7.0 的 "New configuration options" 列表正文里（该列表有遗漏），以 config.c + #9920 为准。
- **busy-reply-threshold**：**7.0.0** 引入新名，旧名 `lua-time-limit` 在 config.c 中注册为 alias，7.0-8.0 写旧名仍可用（RN-7.0 原文 "alias for the old lua-time-limit (#9963)"）。
- **listpack 系改名（5 个）**：`list-max-ziplist-size`→`list-max-listpack-size`、`hash-max-ziplist-entries/value`→`hash-max-listpack-entries/value`、`zset-max-ziplist-entries/value`→`zset-max-listpack-entries/value`，均 **7.0.0**（RN 原文 "as aliases for the old ziplist configs"）。旧名状态 = **alias 保留、静默兼容，未被移除**（8.0 config.c 仍带 alias 注册）。
  另需区分：`list-max-ziplist-entries` 和 `list-max-ziplist-value` 是**另一对更老的废弃参数**（≤3.2 时代遗留，早就被 list-max-ziplist-size 取代），它们在 7.0/8.0 的 config.c `deprecatedConfig` 表里，conf 中写会按弃用告警——生成器不要把这两个名字映射到任何新名。
- `deprecatedConfig` 表（8.0 config.c）：`list-max-ziplist-entries`、`list-max-ziplist-value`、`lua-replicate-commands`、`io-threads-do-reads`。7.0 的该表不含 io-threads-do-reads（8.0 才加入）。

### Q2：Redis 7.2 新增了哪些 conf 参数

- `locale-collate`（#11059，默认 `""`，MODIFIABLE；控制 setlocale，影响 Lua 脚本与 SORT 的字符串比较）
- `set-max-listpack-entries`（默认 128）/ `set-max-listpack-value`（默认 64）—— set 的 listpack 编码阈值。
  ⚠️ 存疑注：这两个参数在 RN-7.2 中**没有**以参数名单列，归属 7.2.0 的证据是 7.0 conf 无 / 7.2 conf 有的文件级 diff（本笔记实测）。如需 PR 号，实现时可用 `git log -S set-max-listpack-entries -- redis.conf` 复核。
- `cluster-announce-human-nodename`（7.2 RC3 起，即 7.2.0；cluster 专属，生成器可不纳入）
- Sentinel 侧允许 CONFIG SET/GET loglevel（#11214，非核心 conf 参数）
- 明确不存在 `dual-channel-replication`：7.2 与 8.0 config.c 均 0 命中（该参数是 Valkey 的，勿混入生成器）。

### Q3：Redis 7.4 新增了哪些 conf 参数

- `hide-user-data-from-log`（#13400，默认 no；避免日志记录 PII）
- `max-new-connections-per-cycle`（默认 10）/ `max-new-tls-connections-per-cycle`（默认 1）（#12178；每事件循环周期接受的新连接数上限；conf 中为注释行）
- CPU 亲和参数改名（带别名保兼容，#7351）：`server_cpulist`→`server-cpulist`、`bio_cpulist`→`bio-cpulist`、`aof_rewrite_cpulist`→`aof-rewrite-cpulist`、`bgsave_cpulist`→`bgsave-cpulist`
- 无其他新增，无默认值变更（7.2→7.4 conf diff 仅上述内容）。

### Q4：Redis 8.0 新增了哪些 conf 参数、哪些默认值变更

- 新增：`replica-full-sync-buffer-limit`（默认 0 = 继承 client-output-buffer-limit replica 硬限；全量同步期间副本端可累积的复制流数据上限）、`cluster-compatibility-sample-ratio`（默认 0；#13846）。
- 废弃：`io-threads-do-reads` **8.0.0 起 no longer effective**（RN-8.0 8.0-M04 节原文见上表；新 I/O 线程实现始终读写均线程化；无替代参数，生成器应从 8.0 模板中移除该行并标注 deprecatedIn=8.0.0）。
- 新增 `redis-full.conf` 配置文件（8.0 GA）：包含 Query Engine 与新数据结构（search/time-series/probabilistic）的组件参数；核心 `redis.conf` 无这些参数。生成器若只针对核心 redis.conf，可不纳入但需在 UI 说明。
- **默认值变更：7.4→8.0 核心参数默认值零变化**（config.c 注册行 diff 仅 4 处：io-threads-do-reads 移除、appendonly 的 DENY_LOADING_CONFIG flag 移除、maxmemory-samples 上限 64、set-max-listpack-* 新增于 7.2——无一涉及默认值）。
- **repl-diskless-sync 默认值从 no 改为 yes 的版本 = 7.0.0**（#10092；6.2 config.c 默认 0、7.0 config.c 默认 1、RN-7.0 原文确认），不是 8.0，也不发生在 7.2/7.4。

### Q5：maxmemory-policy 完整枚举值列表

7.0-8.0 范围内**有且仅有 8 个**，无新增（config.c `maxmemory_policy_enum` 全量引用，四版本一致）：

```
volatile-lru / volatile-lfu / volatile-random / volatile-ttl
allkeys-lru  / allkeys-lfu  / allkeys-random  / noeviction
```

默认 `noeviction`（MAXMEMORY_NO_EVICTION）。LFU 两个值为 4.0 时代引入（早于本版本轴）。

### Q6：slave-* → replica-* 与 min-slaves-* → min-replicas-* 改名版本及旧名状态

- 改名（主名变更）发生在 **Redis 6.0.0**，不是 6.2：6.0 config.c 已以 `replica-serve-stale-data`/`replica-read-only`/`min-replicas-to-write` 等为注册名、`slave-*`/`min-slaves-*` 为 alias；5.0 config.c 中主名仍是 `slave-*`（CONFIG GET 输出 slave 名），但 conf 指令解析同时接受 `replicaof`/`replica-serve-stale-data` 等写法。
- 旧名状态：**deprecated（官方术语层面）但完全兼容**——alias 机制保留，7.0/7.2/7.4/8.0 config.c 中全部带 alias 注册，conf 写旧名不报错。生成器面向 7.0+ 应输出新名；面向 pre-7（尤其 ≤5.0）输出旧名更稳。
- 本清单涉及的 4 对：`slave-read-only`→`replica-read-only`、`slave-serve-stale-data`→`replica-serve-stale-data`、`min-slaves-to-write`→`min-replicas-to-write`、`min-slaves-max-lag`→`min-replicas-max-lag`；另有 `replicaof`↔`slaveof`（`replicaof` 指令写法 5.0 起可用，8.0 注册名 replicaof、alias slaveof）。

### Q7：requirepass 在 7.0+ ACL 语境下的官方状态

- **官方未标 deprecated**（config.c 注册为普通 `MODIFIABLE_CONFIG | SENSITIVE_CONFIG`，无 deprecated 标记；ACL 文档也未用 deprecated 字样）。
- 官方表述（可引用）：
  - ACL 文档页（redis.io/docs/latest/operate/oss_and_stack/management/security/acl/）："In the default configuration, Redis 6 (the first version to have ACLs) works exactly like older versions of Redis. ... Also the old way to configure a password, using the **requirepass** configuration directive, **still works as expected**. However, it now **sets a password for the default user**."
  - 8.0 redis.conf 注释："IMPORTANT NOTE: starting with Redis 6 'requirepass' is just a **compatibility layer on top of the new ACL system**. The option effect will be just setting the password for the default user. ... The requirepass is **not compatible with aclfile option and the ACL LOAD command**, these will cause requirepass to be ignored."
  - config.c updateRequirePass："The old 'requirepass' directive just translates to setting a password to the default user ... for backward compatibility with Redis <= 5."
- 结论：生成器可继续提供 requirepass 输入（简单场景合法有效），但应提示：多用户/细粒度权限需用 ACL（`user` 指令或 `aclfile`），且 requirepass 与 aclfile 互斥。

## Caveats / Not Found / 存疑清单

1. **redis.io 无逐参数配置页**（已实测 404），表中"来源"列用 config.c / redis.conf / release notes 替代；若产品要求站内文档链接，可链到 §0 列出的主题页。
2. **pre-7 参数的精确引入版本未逐一核实**（任务允许统一 pre-7）；表中标注 5.0/6.0/6.2 的行由对应版本 config.c 对比证实，其余 pre-7 行不要写具体版本号。
3. **set-max-listpack-entries/value 的 7.2.0 归属**由 conf diff 证实，RN 未单列、GitHub PR 检索因 API 限流未完成；需要 PR 号时用 `git log -S` 复核。
4. **save 默认值的编译内实现位置**未追查到（6.2/7.0 的 server.c、config.c 中无 3600/900 字面量）；"6.2 起默认 3600 1 300 100 60 10000" 的依据是官方 conf 注释文本（6.2 与 7.0/8.0 conf 相同注释），可信但如需源码级出处可再查 initServerConfig。
5. `appendonly` 在 7.0 有 `DENY_LOADING_CONFIG` flag、7.2 起移除——运行期语义微调，不影响生成器输出，仅备注。
6. 8.0 `redis-full.conf` 的组件参数（search-*、time-series、probabilistic）未纳入本次清单，属独立范围。
7. alias 参数的兼容范围以 7.0-8.0 为准；更早版本（≤6.x）下新名不可用，生成器按目标版本选择名字时注意（见 §1 表头约定）。
