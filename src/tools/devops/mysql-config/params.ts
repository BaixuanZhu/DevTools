/**
 * MySQL 配置参数定义表（数据层核心）。
 *
 * 按"常用项原则"收录 9 组 41 条参数条目（含 5 组改名对/替换对的两侧条目，
 * 默认 8.0 画像下单机约 25 行、主从约 33 行），版本标注以
 * research/mysql-params-version-notes.md 为准（源：MySQL 官方文档与 relnotes，
 * 已于 2026-08-29 实现期逐条复核）。
 *
 * 改名对/替换对建模为两个独立条目（如 tx_isolation 与 transaction_isolation），
 * 通过 introducedIn/deprecatedIn/replacedBy 表达版本覆盖区间——沿用 Redis 引擎
 * 的废弃过滤机制，目标版本命中废弃的条目不写入 conf，面板显示"废弃 → 替代参数"。
 * 轴点安全方向：补丁级引入的新名参数（replica_* / innodb_redo_log_capacity）
 * introducedIn 一律标 '8.4'，禁止映射到 8.0 轴输出（8.0 早期补丁版会启动失败）。
 *
 * 每个参数的 compute 返回该上下文下的推荐值：
 * - null   参数在该上下文不适用（整行隐藏、conf 不输出，如单机模式的复制组）
 * - ''     参数适用但当前值为空（行显示、conf 略过指令，如 bind-address 待填 IP）
 */
import type { MysqlVersion } from './version';
import {
  computeAuthenticationPlugin,
  computeBindAddress,
  computeBufferPoolInstances,
  computeBufferPoolMB,
  computeFlushLogAtTrxCommit,
  computeIoCapacity,
  computeIoCapacityMax,
  computeLogFileSizeMB,
  computeLongQueryTime,
  computeMaxConnections,
  computeRedoCapacityMB,
  computeSyncBinlog,
  computeTransactionIsolation,
} from './compute';

/** 参数控件类型 */
export type ControlKind = 'select' | 'number' | 'switch' | 'text';

/** 参数分组 ID（顺序即 conf 输出顺序，见 PARAM_GROUPS） */
export type ParamGroupId =
  | 'connections'
  | 'memory'
  | 'fulltext'
  | 'redo'
  | 'binlog'
  | 'replication'
  | 'charset'
  | 'auth'
  | 'slowlog';

/** 参数值类型（overrides 与 compute 的统一载荷） */
export type ParamValue = string | number | boolean | string[];

/** 枚举选项（select 用），label 附中文说明 */
export interface ParamOption {
  /** 选项值（写入 conf 的原始值，禁止空串——reka-ui SelectItem 硬约束） */
  value: string;
  /** 显示文本 + 中文说明 */
  label: string;
}

/** 推荐范围（保守/推荐/激进）：数值项派生快捷选项 chips，字符串项显示参考文案 */
export interface ParamRange {
  /** 保守值（数值或描述文案） */
  conservative: number | string;
  /** 推荐值 */
  recommended: number | string;
  /** 激进值 */
  aggressive: number | string;
}

/**
 * 生成上下文：左栏画像输入 + 用户覆盖值。
 * 与 Redis 版的差异：无 cpuCores（精简参数集下无公式消费方）、无 requirepass
 * （my.cnf 不管理账号密码）、端口直接进 ctx 以驱动 port 参数。
 */
export interface GenerateContext {
  /** 部署模式：单机 / 主从（复制组与复制 SQL 提示仅主从模式出现） */
  mode: 'standalone' | 'replica';
  /** 物理内存（GB），驱动 buffer pool / max_connections / redo 公式 */
  memoryGB: number;
  /** 磁盘类型，驱动 io capacity 与 buffer pool 系数 */
  diskType: 'hdd' | 'ssd' | 'nvme';
  /** 使用场景，驱动内存/刷盘/隔离级别/慢查阈值公式 */
  scenario: 'oltp' | 'read-heavy' | 'write-heavy' | 'analytics';
  /** 目标 MySQL 版本（三点轴） */
  version: MysqlVersion;
  /** 并发连接数预估（驱动 max_connections 与内存账单） */
  concurrency: number;
  /** 监听范围：驱动 bind-address 推荐值（快速配置"监听范围"单选） */
  listenScope: 'all' | 'loopback' | 'intranet';
  /** 仅内网监听时的绑定 IP（listenScope 为 'intranet' 时必填） */
  bindIp: string;
  /** 监听端口（快速配置直填，默认 3306） */
  port: number;
  /** 用户覆盖值：key → value；compute 只在无覆盖时生效 */
  overrides: Record<string, ParamValue>;
}

/** conf 指令参数（单个 ConfigParam 的完整定义） */
export interface ConfigParam {
  /** 参数名（写入 conf 的 key，用系统变量下划线拼写） */
  key: string;
  /** 所属分组 */
  group: ParamGroupId;
  /** 引入版本（轴点安全方向：补丁级新名一律标 '8.4'） */
  introducedIn: MysqlVersion;
  /** 废弃/从轴上移除的版本（含改名对旧名的 8.4 移除） */
  deprecatedIn?: MysqlVersion;
  /** 替代参数 key（废弃提示用） */
  replacedBy?: string;
  /** 官方文档链接（dev.mysql.com/doc/refman，取该参数最相关版本的锚点页） */
  docUrl: string;
  /** 控件类型 */
  control: ControlKind;
  /** 枚举选项（select 用） */
  options?: ParamOption[];
  /** 数值输入最小值（失焦 clamp 下界） */
  min?: number;
  /** 数值输入最大值（失焦 clamp 上界） */
  max?: number;
  /** 数值输入步长（透传 input，供方向键增量） */
  step?: number;
  /** 数值写入 conf 时追加的单位后缀（如内存尺寸 'M'） */
  valueSuffix?: string;
  /** 推荐范围（数值参数可选；server_id 等无"档位"语义的参数不设） */
  range?: ParamRange;
  /** 由硬件/场景/模式计算默认值；返回 null 表示该上下文下参数不适用 */
  compute: (ctx: GenerateContext) => ParamValue | null;
  /** 为什么是这个值的中文说明（仅面板展示，不写入 conf） */
  comment: string;
}

/** 参数分组元数据（conf 输出顺序固定） */
export interface ParamGroupMeta {
  /** 分组 ID */
  id: ParamGroupId;
  /** 分组标题（面板标题用中文） */
  label: string;
  /** conf 组标题注释（MySQL 惯例用英文组名） */
  confTitle: string;
  /** 面板 Collapsible 是否默认展开（全部默认收起、按需展开微调） */
  defaultOpen: boolean;
}

/** 官方文档 URL 工厂（统一 refman 路径与锚点格式，防手写漂移） */
function refman(version: MysqlVersion, anchor: string): string {
  return `https://dev.mysql.com/doc/refman/${version}/en/${anchor}`;
}

/** 官方文档 URL 白名单（dev.mysql.com/doc 锚点页，2026-08 实现期建档） */
export const DOC_URLS = {
  port: refman('8.0', 'server-options.html#option_mysqld_port'),
  bindAddress: refman('8.0', 'server-system-variables.html#sysvar_bind_address'),
  maxConnections: refman('8.0', 'server-system-variables.html#sysvar_max_connections'),
  waitTimeout: refman('8.0', 'server-system-variables.html#sysvar_wait_timeout'),
  maxAllowedPacket: refman('8.0', 'server-system-variables.html#sysvar_max_allowed_packet'),
  skipNameResolve: refman('8.0', 'server-system-variables.html#sysvar_skip_name_resolve'),
  transactionIsolation: refman('8.0', 'server-system-variables.html#sysvar_transaction_isolation'),
  txIsolation: refman('5.7', 'server-system-variables.html#sysvar_tx_isolation'),
  bufferPoolSize: refman('8.0', 'innodb-parameters.html#sysvar_innodb_buffer_pool_size'),
  bufferPoolInstances: refman('8.0', 'innodb-parameters.html#sysvar_innodb_buffer_pool_instances'),
  queryCacheSize: refman('5.7', 'server-system-variables.html#sysvar_query_cache_size'),
  queryCacheType: refman('5.7', 'server-system-variables.html#sysvar_query_cache_type'),
  ngramTokenSize: refman('8.0', 'fulltext-search-ngram.html'),
  ftMinTokenSize: refman('8.0', 'innodb-parameters.html#sysvar_innodb_ft_min_token_size'),
  ftEnableStopword: refman('8.0', 'innodb-parameters.html#sysvar_innodb_ft_enable_stopword'),
  logFileSize: refman('8.0', 'innodb-parameters.html#sysvar_innodb_log_file_size'),
  redoLogCapacity: refman('8.4', 'innodb-parameters.html#sysvar_innodb_redo_log_capacity'),
  flushLogAtTrxCommit: refman('8.0', 'innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit'),
  syncBinlog: refman('8.0', 'replication-options-binary-log.html#sysvar_sync_binlog'),
  flushMethod: refman('8.0', 'innodb-parameters.html#sysvar_innodb_flush_method'),
  ioCapacity: refman('8.0', 'innodb-parameters.html#sysvar_innodb_io_capacity'),
  ioCapacityMax: refman('8.0', 'innodb-parameters.html#sysvar_innodb_io_capacity_max'),
  logBin: refman('8.0', 'replication-options-binary-log.html#option_mysqld_log-bin'),
  binlogExpireSeconds: refman('8.0', 'replication-options-binary-log.html#sysvar_binlog_expire_logs_seconds'),
  expireLogsDays: refman('5.7', 'replication-options-binary-log.html#sysvar_expire_logs_days'),
  binlogFormat: refman('8.0', 'replication-options-binary-log.html#sysvar_binlog_format'),
  serverId: refman('8.0', 'replication-options.html#sysvar_server_id'),
  gtidMode: refman('8.0', 'replication-options-gtids.html#sysvar_gtid_mode'),
  enforceGtidConsistency: refman('8.0', 'replication-options-gtids.html#sysvar_enforce_gtid_consistency'),
  relayLogRecovery: refman('8.0', 'replication-options-replica.html#sysvar_relay_log_recovery'),
  readOnly: refman('8.0', 'server-system-variables.html#sysvar_read_only'),
  superReadOnly: refman('8.0', 'server-system-variables.html#sysvar_super_read_only'),
  slaveParallelWorkers: refman('8.0', 'replication-options-replica.html#sysvar_slave_parallel_workers'),
  replicaParallelWorkers: refman('8.4', 'replication-options-replica.html#sysvar_replica_parallel_workers'),
  slavePreserveCommitOrder: refman('8.0', 'replication-options-replica.html#sysvar_slave_preserve_commit_order'),
  replicaPreserveCommitOrder: refman('8.4', 'replication-options-replica.html#sysvar_replica_preserve_commit_order'),
  characterSetServer: refman('8.0', 'server-system-variables.html#sysvar_character_set_server'),
  collationServer: refman('8.0', 'server-system-variables.html#sysvar_collation_server'),
  defaultAuthenticationPlugin: refman('8.0', 'server-system-variables.html#sysvar_default_authentication_plugin'),
  slowQueryLog: refman('8.0', 'server-system-variables.html#sysvar_slow_query_log'),
  longQueryTime: refman('8.0', 'server-system-variables.html#sysvar_long_query_time'),
} as const;

/** 参数分组定义（conf 组顺序固定：连接 → 内存 → 全文 → Redo → binlog → 复制 → 字符集 → 认证 → 慢查） */
export const PARAM_GROUPS: ParamGroupMeta[] = [
  { id: 'connections', label: '连接与事务', confTitle: 'Connections and Transactions', defaultOpen: false },
  { id: 'memory', label: '内存与查询缓存', confTitle: 'Memory and Query Cache', defaultOpen: false },
  { id: 'fulltext', label: '全文检索与分词', confTitle: 'Full-Text Search and Tokenizer', defaultOpen: false },
  { id: 'redo', label: 'Redo 与刷盘', confTitle: 'Redo Log and Flush', defaultOpen: false },
  { id: 'binlog', label: '二进制日志', confTitle: 'Binary Log', defaultOpen: false },
  { id: 'replication', label: '复制（主从）', confTitle: 'Replication', defaultOpen: false },
  { id: 'charset', label: '字符集', confTitle: 'Character Set', defaultOpen: false },
  { id: 'auth', label: '安全与认证', confTitle: 'Authentication', defaultOpen: false },
  { id: 'slowlog', label: '日志与慢查询', confTitle: 'Logging and Slow Queries', defaultOpen: false },
];

/** 全部参数定义（数组顺序即面板与 conf 内的输出顺序） */
export const CONFIG_PARAMS: ConfigParam[] = [
  // ===== 连接与事务 =====
  {
    key: 'port',
    group: 'connections',
    introducedIn: '5.7',
    docUrl: DOC_URLS.port,
    control: 'number',
    min: 1,
    max: 65535,
    step: 1,
    range: { conservative: 3306, recommended: 3306, aggressive: 3307 },
    compute: (ctx) => ctx.port,
    comment: '监听端口（快速配置"监听端口"驱动），默认 3306；同机多实例需错开；改非标端口只减少扫描噪音，不构成安全边界',
  },
  {
    key: 'bind_address',
    group: 'connections',
    introducedIn: '5.7',
    docUrl: DOC_URLS.bindAddress,
    control: 'text',
    compute: computeBindAddress,
    comment: '由快速配置"监听范围"驱动：仅本机绑 127.0.0.1、仅内网绑指定 IP；所有接口时不输出该行——默认值 * 即监听全部接口且含 IPv6，显式 0.0.0.0 反而只绑 IPv4；放开远程监听必须配合账号 HOST 限制（CREATE USER ... @\'10.0.0.%\'）',
  },
  {
    key: 'max_connections',
    group: 'connections',
    introducedIn: '5.7',
    docUrl: DOC_URLS.maxConnections,
    control: 'number',
    min: 1,
    max: 100000,
    step: 10,
    range: { conservative: 100, recommended: 300, aggressive: 1000 },
    compute: computeMaxConnections,
    comment: '并发预估 ×1.2 上取整，且受内存折算上限约束（buffer pool 之外可用内存 ÷ 每连接约 2MB 粗估）防止超卖；内存账单：max_connections × 每连接约 2MB（粗估）+ buffer pool 等全局缓冲 ≈ 物理内存占用，对照 RAM 留 20%~30% 余量——连接级缓冲参数不应全局固化，账单只用常数估算',
  },
  {
    key: 'wait_timeout',
    group: 'connections',
    introducedIn: '5.7',
    docUrl: DOC_URLS.waitTimeout,
    control: 'number',
    min: 1,
    max: 2592000,
    step: 60,
    range: { conservative: 600, recommended: 28800, aggressive: 86400 },
    compute: () => 28800,
    comment: '非交互空闲连接超时（秒），官方默认 28800（8 小时）保持即可；连接池应用无需调整，短连接应用可调小回收资源；交互客户端走 interactive_timeout，不在此固化',
  },
  {
    key: 'max_allowed_packet',
    group: 'connections',
    introducedIn: '5.7',
    docUrl: DOC_URLS.maxAllowedPacket,
    control: 'number',
    min: 1,
    max: 1024,
    step: 1,
    valueSuffix: 'M',
    range: { conservative: 16, recommended: 64, aggressive: 256 },
    compute: () => 64,
    comment: '单包大小上限：5.7 官方默认 4M 常截断大字段导入与大 binlog 事务，8.0 起官方默认已是 64M，统一显式 64M 跨版本一致；主从复制时从库该值不得小于主库，改完需重启',
  },
  {
    key: 'skip_name_resolve',
    group: 'connections',
    introducedIn: '5.7',
    docUrl: DOC_URLS.skipNameResolve,
    control: 'switch',
    compute: () => true,
    comment: '跳过连接时的主机名反查——官方 host-cache 文档明确 DNS 慢时开启可提升连接性能（高频痛点）；警告：开启后账号授权 HOST 必须用 IP/网段，按主机名授权的账号会失效',
  },
  {
    key: 'transaction_isolation',
    group: 'connections',
    introducedIn: '8.0',
    docUrl: DOC_URLS.transactionIsolation,
    control: 'select',
    options: [
      { value: 'READ-UNCOMMITTED', label: 'READ-UNCOMMITTED — 可读未提交（脏读，不用）' },
      { value: 'READ-COMMITTED', label: 'READ-COMMITTED — 已提交读，gap lock 更少' },
      { value: 'REPEATABLE-READ', label: 'REPEATABLE-READ — 可重复读（官方默认）' },
      { value: 'SERIALIZABLE', label: 'SERIALIZABLE — 串行化（吞吐最低，不用）' },
    ],
    compute: computeTransactionIsolation,
    comment: '8.0 起的参数名（5.7 同语义参数为 tx_isolation，本工具按轴分别输出）；分析报表场景降为 READ-COMMITTED 减少 gap lock 阻塞，OLTP 保持官方默认 REPEATABLE-READ',
  },
  {
    key: 'tx_isolation',
    group: 'connections',
    introducedIn: '5.7',
    deprecatedIn: '8.0',
    replacedBy: 'transaction_isolation',
    docUrl: DOC_URLS.txIsolation,
    control: 'select',
    options: [
      { value: 'READ-UNCOMMITTED', label: 'READ-UNCOMMITTED — 可读未提交（脏读，不用）' },
      { value: 'READ-COMMITTED', label: 'READ-COMMITTED — 已提交读，gap lock 更少' },
      { value: 'REPEATABLE-READ', label: 'REPEATABLE-READ — 可重复读（官方默认）' },
      { value: 'SERIALIZABLE', label: 'SERIALIZABLE — 串行化（吞吐最低，不用）' },
    ],
    compute: computeTransactionIsolation,
    comment: '5.7 轴输出旧名（transaction_isolation 别名 5.7.20+ 才可用，为兼容 5.7.19 及更早补丁版仍输出旧名）；8.0 起改名为 transaction_isolation；分析报表场景推荐 READ-COMMITTED 减少 gap lock',
  },

  // ===== 内存与查询缓存 =====
  {
    key: 'innodb_buffer_pool_size',
    group: 'memory',
    introducedIn: '5.7',
    docUrl: DOC_URLS.bufferPoolSize,
    control: 'number',
    min: 128,
    max: 1048576,
    step: 128,
    valueSuffix: 'M',
    range: { conservative: '50% 内存', recommended: '60%~70% 内存', aggressive: '75% 内存' },
    compute: computeBufferPoolMB,
    comment: 'InnoDB 数据与索引页缓存，专用服务器基准给到内存的 60%（读多写少 70%、HDD 封顶 50%），向下取整 GB、下限 128M；内存账单：buffer pool（全局）+ max_connections × 每连接约 2MB（粗估）≈ 物理内存占用——页缓存也要吃内存，别把 buffer pool 拉满',
  },
  {
    key: 'innodb_buffer_pool_instances',
    group: 'memory',
    introducedIn: '5.7',
    deprecatedIn: '8.4',
    docUrl: DOC_URLS.bufferPoolInstances,
    control: 'number',
    min: 1,
    max: 8,
    step: 1,
    range: { conservative: 1, recommended: 8, aggressive: 8 },
    compute: computeBufferPoolInstances,
    comment: '8.0 及以前官方默认规则：pool ≥ 1GB 取 8（降低多线程页访问锁竞争），< 1GB 时该选项不生效；8.4 起默认算法改为按 chunk/CPU 动态自算，故 8.4 轴不输出该参数、交给服务器',
  },
  {
    key: 'query_cache_size',
    group: 'memory',
    introducedIn: '5.7',
    deprecatedIn: '8.0',
    docUrl: DOC_URLS.queryCacheSize,
    control: 'number',
    min: 0,
    max: 1024,
    step: 1,
    valueSuffix: 'M',
    range: { conservative: 0, recommended: 0, aggressive: 64 },
    compute: () => 0,
    comment: '查询缓存在高并发下是全局互斥锁瓶颈，8.0 已整体移除；5.7 官方默认 size=1M（type=OFF 时未生效），显式置 0 可让服务器完全不获取查询缓存互斥锁；仅遗留应用强依赖时再调大',
  },
  {
    key: 'query_cache_type',
    group: 'memory',
    introducedIn: '5.7',
    deprecatedIn: '8.0',
    docUrl: DOC_URLS.queryCacheType,
    control: 'switch',
    compute: () => false,
    comment: '5.7 官方默认 0（OFF）且官方建议不用缓存就显式置 0；查询缓存全局锁瓶颈严重，8.0 已整体移除——本项仅作 5.7 轴展示位，随版本升级整行消失',
  },

  // ===== 全文检索与分词 =====
  {
    key: 'ngram_token_size',
    group: 'fulltext',
    introducedIn: '5.7',
    docUrl: DOC_URLS.ngramTokenSize,
    control: 'number',
    min: 1,
    max: 10,
    step: 1,
    range: { conservative: 1, recommended: 2, aggressive: 10 },
    compute: () => 2,
    comment: '中文全文检索核心：ngram 按该长度切词（官方默认 2 匹配两字词），设为应用最小搜索词长度；改后需重启并重建索引；注意 conf 只设服务器级默认——FULLTEXT 索引必须显式 WITH PARSER ngram 建才走中文分词，否则搜不到结果是索引没用分词器',
  },
  {
    key: 'innodb_ft_min_token_size',
    group: 'fulltext',
    introducedIn: '5.7',
    docUrl: DOC_URLS.ftMinTokenSize,
    control: 'number',
    min: 1,
    max: 16,
    step: 1,
    range: { conservative: 3, recommended: 3, aggressive: 2 },
    compute: () => 3,
    comment: '默认 parser 的最小入索引词长（官方默认 3，改后需重建索引）；仅对默认 parser 生效——ngram 索引的最小 token 由 ngram_token_size 控制；同样要求 FULLTEXT 显式 WITH PARSER ngram 才走中文分词',
  },
  {
    key: 'innodb_ft_enable_stopword',
    group: 'fulltext',
    introducedIn: '5.7',
    docUrl: DOC_URLS.ftEnableStopword,
    control: 'switch',
    compute: () => true,
    comment: '建索引时应用 InnoDB 停用词表（官方默认 ON）；自定义停用词走运行时 innodb_ft_server_stopword_table，不固化在 conf；分词粒度仍由 WITH PARSER ngram 决定',
  },

  // ===== Redo 与刷盘 =====
  {
    key: 'innodb_log_file_size',
    group: 'redo',
    introducedIn: '5.7',
    deprecatedIn: '8.4',
    replacedBy: 'innodb_redo_log_capacity',
    docUrl: DOC_URLS.logFileSize,
    control: 'number',
    min: 128,
    max: 8192,
    step: 128,
    valueSuffix: 'M',
    range: { conservative: 512, recommended: 1024, aggressive: 2048 },
    compute: computeLogFileSizeMB,
    comment: '单个 redo log 文件尺寸（旧模型为固定 2 文件组）：小内存 512M、≥8G 内存 1G，写密集翻倍以减少 checkpoint 高频刷盘，上限 4G；8.0.30 起废弃但 8.0 全系可用，8.4 轴由 innodb_redo_log_capacity 取代',
  },
  {
    key: 'innodb_redo_log_capacity',
    group: 'redo',
    introducedIn: '8.4',
    docUrl: DOC_URLS.redoLogCapacity,
    control: 'number',
    min: 128,
    max: 16384,
    step: 128,
    valueSuffix: 'M',
    range: { conservative: 1024, recommended: 2048, aggressive: 4096 },
    compute: computeRedoCapacityMB,
    comment: '8.4 起以 redo 总容量取代"2 × log_file_size"旧模型（1G/2G/4G 阶梯与旧公式同源等价）；写密集翻倍给高频写留检查点空间；与旧参数同设时此参数优先生效',
  },
  {
    key: 'innodb_flush_log_at_trx_commit',
    group: 'redo',
    introducedIn: '5.7',
    docUrl: DOC_URLS.flushLogAtTrxCommit,
    control: 'select',
    options: [
      { value: '1', label: '1 — 每次提交刷 redo（最安全，"双 1"之一）' },
      { value: '2', label: '2 — 每秒刷（进程崩溃不丢，断电可能丢 1 秒）' },
      { value: '0', label: '0 — 每秒写并刷（最不安全，一般不用）' },
    ],
    compute: computeFlushLogAtTrxCommit,
    comment: '"双 1"的 redo 侧：与 sync_binlog 组合决定崩溃丢失窗口；写密集场景降为 2 换吞吐（崩溃可能丢 1 秒事务的取舍），金融/账务类务必回到 1',
  },
  {
    key: 'sync_binlog',
    group: 'redo',
    introducedIn: '5.7',
    docUrl: DOC_URLS.syncBinlog,
    control: 'select',
    options: [
      { value: '1', label: '1 — 每次提交刷 binlog（最安全，"双 1"之一）' },
      { value: '100', label: '100 — 每 100 次事务批量刷（写密集折中）' },
      { value: '0', label: '0 — 交给 OS（最快，断电可能丢 binlog）' },
    ],
    compute: computeSyncBinlog,
    comment: '"双 1"的 binlog 侧：官方默认 1，与 innodb_flush_log_at_trx_commit 组合——1/1 数据最安全，写密集 2/100（崩溃可能丢约 1 秒事务），可覆盖回 1',
  },
  {
    key: 'innodb_flush_method',
    group: 'redo',
    introducedIn: '5.7',
    docUrl: DOC_URLS.flushMethod,
    control: 'select',
    options: [
      { value: 'O_DIRECT', label: 'O_DIRECT — 数据文件绕过 OS 页缓存（推荐）' },
      { value: 'fsync', label: 'fsync — 交给 OS 缓冲（8.0 及以前 Linux 默认）' },
    ],
    compute: () => 'O_DIRECT',
    comment: 'Linux 下显式 O_DIRECT 避免数据文件在 OS 页缓存与 buffer pool 双重缓存；8.4 官方默认即 O_DIRECT、8.0 及以前默认 fsync——显式输出让跨版本行为一致（Windows 服务器请改回默认）',
  },
  {
    key: 'innodb_io_capacity',
    group: 'redo',
    introducedIn: '5.7',
    docUrl: DOC_URLS.ioCapacity,
    control: 'number',
    min: 100,
    max: 100000,
    step: 100,
    range: { conservative: 200, recommended: 2000, aggressive: 4000 },
    compute: computeIoCapacity,
    comment: '后台刷脏页的 IOPS 基准，按磁盘画像联动：HDD 200 / SSD 2000 / NVMe 4000；8.4 官方默认大幅上调，SSD/NVMe 可酌情调高',
  },
  {
    key: 'innodb_io_capacity_max',
    group: 'redo',
    introducedIn: '5.7',
    docUrl: DOC_URLS.ioCapacityMax,
    control: 'number',
    min: 200,
    max: 200000,
    step: 100,
    range: { conservative: 400, recommended: 4000, aggressive: 8000 },
    compute: computeIoCapacityMax,
    comment: '检查点积压时的刷脏 IOPS 突发上限（约为基准的 2 倍），必须大于 innodb_io_capacity',
  },

  // ===== 二进制日志 =====
  {
    key: 'log_bin',
    group: 'binlog',
    introducedIn: '5.7',
    docUrl: DOC_URLS.logBin,
    control: 'switch',
    compute: () => true,
    comment: 'binlog 是时间点恢复（PITR）与主从复制的前提，恒开；8.0 起官方默认已开启，5.7 默认 OFF——显式写出防止发行版打包配置误关',
  },
  {
    key: 'binlog_expire_logs_seconds',
    group: 'binlog',
    introducedIn: '8.0',
    docUrl: DOC_URLS.binlogExpireSeconds,
    control: 'number',
    min: 0,
    max: 2592000,
    step: 3600,
    range: { conservative: 86400, recommended: 604800, aggressive: 2592000 },
    compute: () => 604800,
    comment: 'binlog 保留 7 天（604800 秒），兼顾 PITR 时间窗与磁盘占用；官方默认 2592000（30 天）偏保守易盘满，0 表示永不清理；与 expire_logs_days 不可同时设置',
  },
  {
    key: 'expire_logs_days',
    group: 'binlog',
    introducedIn: '5.7',
    deprecatedIn: '8.0',
    replacedBy: 'binlog_expire_logs_seconds',
    docUrl: DOC_URLS.expireLogsDays,
    control: 'number',
    min: 0,
    max: 99,
    step: 1,
    range: { conservative: 3, recommended: 7, aggressive: 30 },
    compute: () => 7,
    comment: 'binlog 保留天数（5.7 用此参数，8.0 起改用 binlog_expire_logs_seconds）：官方默认 0 = 不自动清理，存在盘满风险，推荐显式 7 天；与 binlog_expire_logs_seconds 不可同设',
  },
  {
    key: 'binlog_format',
    group: 'binlog',
    introducedIn: '5.7',
    docUrl: DOC_URLS.binlogFormat,
    control: 'select',
    options: [
      { value: 'ROW', label: 'ROW — 记录行变更，主从最安全（5.7.7+ 默认，推荐）' },
      { value: 'STATEMENT', label: 'STATEMENT — 记录 SQL，省空间但非确定语句可能主从不一致' },
      { value: 'MIXED', label: 'MIXED — 遇不安全语句自动切 ROW' },
    ],
    compute: () => 'ROW',
    comment: 'ROW 记录行变更，主从一致性最安全且 5.7.7 起为官方默认；STATEMENT 遇 NOW()/UUID() 等非确定函数会主从不一致；8.0.34 起该参数废弃（默认恒 ROW），显式输出无害',
  },

  // ===== 复制（主从） =====
  {
    key: 'server_id',
    group: 'replication',
    introducedIn: '5.7',
    docUrl: DOC_URLS.serverId,
    control: 'number',
    min: 1,
    max: 4294967295,
    step: 1,
    compute: (ctx) => (ctx.mode === 'replica' ? 1 : null),
    comment: '复制拓扑内必须全局唯一，多副本同为 1 会互踢重连（经典坑）；打开页面已随机生成一个 ID 并自动填入，可在此手动覆盖——数据层占位值恒为 1',
  },
  {
    key: 'gtid_mode',
    group: 'replication',
    introducedIn: '5.7',
    docUrl: DOC_URLS.gtidMode,
    control: 'select',
    options: [
      { value: 'ON', label: 'ON — GTID 复制（推荐，故障切换与幂等重放更简单）' },
      { value: 'OFF', label: 'OFF — 传统 file/position 复制' },
    ],
    compute: (ctx) => (ctx.mode === 'replica' ? 'ON' : null),
    comment: 'GTID 让副本用事务标识自动定位，故障切换不必手找 binlog 位点；ON 需 enforce_gtid_consistency 配套开启；历史遗留环境可用 OFF 走传统模式',
  },
  {
    key: 'enforce_gtid_consistency',
    group: 'replication',
    introducedIn: '5.7',
    docUrl: DOC_URLS.enforceGtidConsistency,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '拒绝破坏 GTID 一致性的语句（CREATE TABLE ... SELECT 等），gtid_mode=ON 的前置配套；切回传统 file/position 模式时记得同步关闭',
  },
  {
    key: 'relay_log_recovery',
    group: 'replication',
    introducedIn: '5.7',
    docUrl: DOC_URLS.relayLogRecovery,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '官方默认 OFF；开启后副本崩溃重启会丢弃未回放的 relay log 并从主库重新拉取，避免 relay log 损坏导致复制中断——崩溃安全实践推荐 ON，是否接受重启重拉由你决策',
  },
  {
    key: 'read_only',
    group: 'replication',
    introducedIn: '5.7',
    docUrl: DOC_URLS.readOnly,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '副本只读，挡住普通账号写入保证数据一致；业务账号本就不应持有 SUPER 权限',
  },
  {
    key: 'super_read_only',
    group: 'replication',
    introducedIn: '5.7',
    docUrl: DOC_URLS.superReadOnly,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '连 SUPER 权限也只读，防止运维误写副本造成主从分叉；开启它会连带强制 read_only=ON，两者显式写出便于核对',
  },
  {
    key: 'slave_parallel_workers',
    group: 'replication',
    introducedIn: '5.7',
    deprecatedIn: '8.4',
    replacedBy: 'replica_parallel_workers',
    docUrl: DOC_URLS.slaveParallelWorkers,
    control: 'number',
    min: 0,
    max: 1024,
    step: 1,
    range: { conservative: 0, recommended: 4, aggressive: 8 },
    compute: (ctx) => (ctx.mode === 'replica' ? 4 : null),
    comment: '并行回放（MTS）线程数：0=单线程回放，4 为常用起步值（可按主库写入并行度上调）；配合 preserve_commit_order 保证提交顺序；8.0.26 起改名为 replica_parallel_workers，8.0 轴为兼容 8.0.25 前的早期补丁版仍输出旧名',
  },
  {
    key: 'replica_parallel_workers',
    group: 'replication',
    introducedIn: '8.4',
    docUrl: DOC_URLS.replicaParallelWorkers,
    control: 'number',
    min: 0,
    max: 1024,
    step: 1,
    range: { conservative: 0, recommended: 4, aggressive: 8 },
    compute: (ctx) => (ctx.mode === 'replica' ? 4 : null),
    comment: '并行回放线程数：0=单线程回放，4 为常用起步值；8.0.26 由 slave_parallel_workers 改名——8.0 轴输出旧名（避免早期补丁版因未知变量启动失败），8.4 轴输出新名',
  },
  {
    key: 'slave_preserve_commit_order',
    group: 'replication',
    introducedIn: '8.0',
    deprecatedIn: '8.4',
    replacedBy: 'replica_preserve_commit_order',
    docUrl: DOC_URLS.slavePreserveCommitOrder,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '开启后并行回放按主库提交顺序落库，避免副本数据"暂时回退"（依赖副本的应用需要它）；5.7.22 已引入但本工具 5.7 轴不输出——并行回放仅在 8.0+ 轴推荐；8.0.26 起改名为 replica_preserve_commit_order',
  },
  {
    key: 'replica_preserve_commit_order',
    group: 'replication',
    introducedIn: '8.4',
    docUrl: DOC_URLS.replicaPreserveCommitOrder,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '并行回放按主库提交顺序落库（8.0.27 起官方默认 ON）；8.0.26 由 slave_preserve_commit_order 改名——8.0 轴输出旧名，8.4 轴输出新名',
  },

  // ===== 字符集 =====
  {
    key: 'character_set_server',
    group: 'charset',
    introducedIn: '5.7',
    docUrl: DOC_URLS.characterSetServer,
    control: 'select',
    options: [
      { value: 'utf8mb4', label: 'utf8mb4 — 完整 Unicode（emoji/生僻字），推荐' },
      { value: 'utf8', label: 'utf8（utf8mb3 别名）— 仅 BMP，遗留兼容' },
      { value: 'latin1', label: 'latin1 — 单字节西欧编码，仅遗留库' },
      { value: 'gbk', label: 'gbk — 中文扩展（非 Unicode）' },
    ],
    compute: () => 'utf8mb4',
    comment: '新库一律 utf8mb4 才能存 emoji 与增补字符；5.7 官方默认仍是 latin1——不显式指定新建库会掉进 latin1 坑；改全局默认不影响已建库/表的字符集',
  },
  {
    key: 'collation_server',
    group: 'charset',
    introducedIn: '5.7',
    docUrl: DOC_URLS.collationServer,
    control: 'select',
    options: [
      { value: 'utf8mb4_0900_ai_ci', label: 'utf8mb4_0900_ai_ci — UCA 9.0，8.0+ 默认（更准更快）' },
      { value: 'utf8mb4_general_ci', label: 'utf8mb4_general_ci — 5.7 默认，跨版本兼容' },
      { value: 'utf8mb4_unicode_ci', label: 'utf8mb4_unicode_ci — UCA 4.0，多语言排序更准' },
      { value: 'utf8mb4_bin', label: 'utf8mb4_bin — 二进制精确比较' },
    ],
    compute: (ctx) => (ctx.version === '5.7' ? 'utf8mb4_general_ci' : 'utf8mb4_0900_ai_ci'),
    comment: '8.0 默认 utf8mb4_0900_ai_ci（基于 UCA 9.0，5.7 无此排序规则），5.7 轴输出 utf8mb4_general_ci；主从混用版本时排序规则不一致会导致比较结果与唯一约束行为差异',
  },

  // ===== 安全与认证 =====
  {
    key: 'default_authentication_plugin',
    group: 'auth',
    introducedIn: '5.7',
    deprecatedIn: '8.4',
    docUrl: DOC_URLS.defaultAuthenticationPlugin,
    control: 'select',
    options: [
      { value: 'caching_sha2_password', label: 'caching_sha2_password — 8.0+ 默认（更安全）' },
      { value: 'mysql_native_password', label: 'mysql_native_password — 5.7 默认（旧驱动兼容）' },
    ],
    compute: computeAuthenticationPlugin,
    comment: '认证插件分版本语义：5.7 默认 mysql_native_password、8.0 默认 caching_sha2_password，旧驱动连 8.0+ 报 2059 多为此因；8.4 已移除该参数且 mysql_native_password 默认停用（如需启用须 mysql_native_password=ON，该开关本身也已废弃）',
  },

  // ===== 日志与慢查询 =====
  {
    key: 'slow_query_log',
    group: 'slowlog',
    introducedIn: '5.7',
    docUrl: DOC_URLS.slowQueryLog,
    control: 'switch',
    compute: () => true,
    comment: '慢查询日志是调优第一手数据，常开开销可忽略；更细粒度采集可运行时 SET GLOBAL log_queries_not_using_indexes=ON，排查完记得关（运行时开关不固化在 conf）',
  },
  {
    key: 'long_query_time',
    group: 'slowlog',
    introducedIn: '5.7',
    docUrl: DOC_URLS.longQueryTime,
    control: 'number',
    min: 0,
    max: 600,
    step: 0.1,
    range: { conservative: 0.5, recommended: 1, aggressive: 3 },
    compute: computeLongQueryTime,
    comment: '慢查询阈值（秒）：官方默认 10 基本等于关掉慢查日志，推荐 1 秒起步；分析报表场景查询天然较慢抬到 3 减少噪音，写密集对延迟敏感压到 0.5',
  },
];

/** 按 key 查找参数定义 */
export function getParam(key: string): ConfigParam | undefined {
  return CONFIG_PARAMS.find((p) => p.key === key);
}

/** 数值参数的单位后缀（NumberField 输入框旁展示用，key → 单位文案；未列出则不带单位） */
export const PARAM_UNITS: Record<string, string> = {
  port: '端口',
  max_connections: '连接',
  wait_timeout: '秒',
  max_allowed_packet: 'MB',
  innodb_buffer_pool_size: 'MB',
  innodb_buffer_pool_instances: '个',
  query_cache_size: 'MB',
  ngram_token_size: '字符',
  innodb_ft_min_token_size: '字符',
  innodb_log_file_size: 'MB',
  innodb_redo_log_capacity: 'MB',
  innodb_io_capacity: 'IOPS',
  innodb_io_capacity_max: 'IOPS',
  binlog_expire_logs_seconds: '秒',
  expire_logs_days: '天',
  slave_parallel_workers: '线程',
  replica_parallel_workers: '线程',
  long_query_time: '秒',
};

/** 场景选项中文标签（conf 头部注释与 ControlPanel 共用） */
export const SCENARIO_LABELS: Record<GenerateContext['scenario'], string> = {
  oltp: '通用 OLTP',
  'read-heavy': '读多写少',
  'write-heavy': '写密集',
  analytics: '分析报表',
};

/** 磁盘类型中文标签（conf 头部注释用） */
export const DISK_LABELS: Record<GenerateContext['diskType'], string> = {
  hdd: 'HDD',
  ssd: 'SSD',
  nvme: 'NVMe',
};

/**
 * 创建默认生成上下文（打开即用的推荐画像：4GB / SSD / 通用 OLTP / 8.0 / 并发 200 / 单机 / 所有接口 / 3306）。
 * 每次调用返回全新对象，供初始渲染与重置使用。
 * @returns 全新的 GenerateContext
 */
export function createDefaultContext(): GenerateContext {
  return {
    mode: 'standalone',
    memoryGB: 4,
    diskType: 'ssd',
    scenario: 'oltp',
    version: '8.0',
    concurrency: 200,
    listenScope: 'all',
    bindIp: '',
    port: 3306,
    overrides: {},
  };
}
