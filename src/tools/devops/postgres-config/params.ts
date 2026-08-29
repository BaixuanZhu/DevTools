/**
 * PostgreSQL 配置参数定义表（数据层核心）。
 *
 * 按"常用项原则"收录 9 组 39 条参数条目（连接认证 5 / 内存 5 / WAL 与检查点 7 /
 * 复制 3 / 并行与优化器 7 / 自动清理 4 / 日志 4 / 异步 IO 2 / 时区 2），
 * 全部默认值、docUrl、版本差异以 research/postgres-params-version-notes.md
 * 为准（源：16.15/17.11/18.6 官方 docs tarball + guc_tables.c 逐项核对）。
 *
 * 版本建模与 MySQL 版不同：16→17→18 窗口内 rename/移除项均不在本注册表
 * （仅 18 新增异步 IO 组两参数），因此没有 deprecatedIn/改名对建模，改用
 * availableIn 白名单逐条目标注可用版本，isAvailable 按集合判断。
 *
 * 每个条目要么带 compute（由画像计算推荐值），要么带 defaultValue（静态项），
 * 二者互斥；复制组（replication）条目保持静态值，渲染时机由 generate.ts 与
 * 页面层按 ctx.mode === 'replica' 过滤（引擎仅保留 group 归属）。
 *
 * 裁剪备忘（不进注册表，FAQ 或注释说明）：log_connections（18 布尔→列表
 * 类型变化，回避）、maintenance_io_concurrency（冷门且 18 改默认）、
 * shared_preload_libraries（空串无输出价值）、lc_collate/lc_ctype/
 * server_encoding/data_checksums（仅 initdb 可设，写进 conf 非法）、
 * io_max_concurrency/autovacuum_worker_slots 等 18 独有冷门项。
 */
import type { ConfigParamBase, ParamValue } from '../../../components/config/types';
import type { PgVersion } from './version';
import {
  computeAutovacuumCostLimit,
  computeAutovacuumScaleFactor,
  computeCheckpointTimeout,
  computeEffectiveCacheSizeMB,
  computeHugePages,
  computeIoConcurrency,
  computeJit,
  computeListenAddresses,
  computeMaintenanceWorkMemMB,
  computeMaxConnections,
  computeMaxWalSizeMB,
  computeMinWalSizeMB,
  computeParallelPerGather,
  computeParallelWorkers,
  computeRandomPageCost,
  computeSharedBuffersMB,
  computeStatisticsTarget,
  computeWalCompression,
  computeWorkerProcesses,
  computeWorkMemMB,
} from './compute';

/**
 * 生成上下文：快捷配置画像输入 + 用户覆盖值。
 * 与 MySQL 版的差异：恢复 cpuCores（并行组三项公式的消费方）、mode 为
 * 'single'/'replica'、默认监听回环（PG 的 localhost 默认语义）。
 */
export interface GenerateContext {
  /** 目标 PostgreSQL 版本（三点轴，驱动异步 IO 组显隐与 effective_io_concurrency 默认） */
  version: PgVersion;
  /** 部署模式：单机 / 主从（复制组与备库要点提示仅主从模式出现） */
  mode: 'single' | 'replica';
  /** 物理内存（GB，1–512），驱动 shared_buffers / work_mem / max_connections / WAL 公式 */
  memoryGB: number;
  /** CPU 核数（1–128），驱动并行组三项公式 */
  cpuCores: number;
  /** 磁盘类型，驱动 random_page_cost 与 effective_io_concurrency */
  diskType: 'hdd' | 'ssd' | 'nvme';
  /** 使用场景，驱动 work_mem / jit / WAL / autovacuum / 统计目标公式 */
  scenario: 'oltp' | 'read-heavy' | 'write-heavy' | 'analytics';
  /** 并发连接数预估（驱动 max_connections） */
  concurrency: number;
  /** 监听范围：驱动 listen_addresses 推荐值（快捷配置"监听范围"单选） */
  listenScope: 'loopback' | 'intranet' | 'all';
  /** 仅内网监听时的绑定 IP（listenScope 为 'intranet' 时必填） */
  bindIp: string;
  /** 监听端口（快捷配置直填，默认 5432） */
  port: number;
  /** 用户覆盖值：key → value；compute/defaultValue 只在无覆盖时生效 */
  overrides: Record<string, ParamValue>;
}

/** 参数分组 ID（顺序即 conf 输出顺序，见 PARAM_GROUPS） */
export type PgGroup =
  | 'connections'
  | 'memory'
  | 'wal'
  | 'replication'
  | 'parallel'
  | 'autovacuum'
  | 'logging'
  | 'async-io'
  | 'timezone';

/** 参数值类型与推荐范围：共享定义 re-export（保持与 redis/mysql 相同的 import 形态） */
export type { ParamValue, ParamRange } from '../../../components/config/types';

/**
 * conf 指令参数（单个参数的完整定义）。
 * 基础字段（key/comment/control/options/min/max/step/range 等）继承共享
 * ConfigParamBase（src/components/config/types.ts），此处补工具专有字段。
 * 与 MySQL 版的差异：无 deprecatedIn/replacedBy 建模（窗口内无弃用参数），
 * 版本可用性用 availableIn 白名单；静态项以 defaultValue 表达、不带 compute。
 */
export interface PgParam extends ConfigParamBase {
  /** 所属分组 */
  group: PgGroup;
  /** 引入版本（徽章基线 '16'；窗口内仅异步 IO 组两参数标 '18'） */
  introducedIn: PgVersion;
  /** 可用版本白名单（isAvailable 按此判断；仅 io_method/io_workers 收窄到 ['18']） */
  availableIn: readonly PgVersion[];
  /** 官方文档链接（postgresql.org/docs/18 锚点页，DOC_URLS 白名单） */
  docUrl: string;
  /** 数值写入 conf 时追加的单位后缀（如内存尺寸 'MB'） */
  valueSuffix?: string;
  /** 值写入 conf 时加单引号（自由文本参数）；枚举/数值/布尔不加 */
  quoted?: boolean;
  /** 由硬件/场景/模式计算推荐值；静态项不带 compute、改用 defaultValue */
  compute?: (ctx: GenerateContext) => ParamValue;
  /** 静态项默认值（与 compute 互斥） */
  defaultValue?: ParamValue;
}

/** 参数分组元数据（conf 输出顺序固定） */
export interface ParamGroupMeta {
  /** 分组 ID */
  id: PgGroup;
  /** 分组标题（面板标题用中文） */
  label: string;
  /** conf 组标题注释（PG 无 [section] 概念，组标题用英文注释行） */
  confTitle: string;
  /** 面板 Collapsible 是否默认展开（全部默认收起、按需展开微调） */
  defaultOpen: boolean;
}

/** 官方文档 URL 工厂（统一 18 文档路径与锚点格式，防手写漂移；design §5 定为指向 18 锚点） */
function pgdoc(page: string, anchor: string): string {
  return `https://www.postgresql.org/docs/18/${page}#${anchor}`;
}

/** 官方文档 URL 白名单（postgresql.org/docs/18 锚点页，取自 research 核对表，2026-08 实现期建档） */
export const DOC_URLS = {
  listenAddresses: pgdoc('runtime-config-connection.html', 'GUC-LISTEN-ADDRESSES'),
  port: pgdoc('runtime-config-connection.html', 'GUC-PORT'),
  maxConnections: pgdoc('runtime-config-connection.html', 'GUC-MAX-CONNECTIONS'),
  superuserReservedConnections: pgdoc('runtime-config-connection.html', 'GUC-SUPERUSER-RESERVED-CONNECTIONS'),
  passwordEncryption: pgdoc('runtime-config-connection.html', 'GUC-PASSWORD-ENCRYPTION'),
  sharedBuffers: pgdoc('runtime-config-resource.html', 'GUC-SHARED-BUFFERS'),
  hugePages: pgdoc('runtime-config-resource.html', 'GUC-HUGE-PAGES'),
  workMem: pgdoc('runtime-config-resource.html', 'GUC-WORK-MEM'),
  maintenanceWorkMem: pgdoc('runtime-config-resource.html', 'GUC-MAINTENANCE-WORK-MEM'),
  maxWorkerProcesses: pgdoc('runtime-config-resource.html', 'GUC-MAX-WORKER-PROCESSES'),
  maxParallelWorkers: pgdoc('runtime-config-resource.html', 'GUC-MAX-PARALLEL-WORKERS'),
  maxParallelWorkersPerGather: pgdoc('runtime-config-resource.html', 'GUC-MAX-PARALLEL-WORKERS-PER-GATHER'),
  effectiveIoConcurrency: pgdoc('runtime-config-resource.html', 'GUC-EFFECTIVE-IO-CONCURRENCY'),
  ioMethod: pgdoc('runtime-config-resource.html', 'GUC-IO-METHOD'),
  ioWorkers: pgdoc('runtime-config-resource.html', 'GUC-IO-WORKERS'),
  effectiveCacheSize: pgdoc('runtime-config-query.html', 'GUC-EFFECTIVE-CACHE-SIZE'),
  randomPageCost: pgdoc('runtime-config-query.html', 'GUC-RANDOM-PAGE-COST'),
  defaultStatisticsTarget: pgdoc('runtime-config-query.html', 'GUC-DEFAULT-STATISTICS-TARGET'),
  jit: pgdoc('runtime-config-query.html', 'GUC-JIT'),
  walLevel: pgdoc('runtime-config-wal.html', 'GUC-WAL-LEVEL'),
  walBuffers: pgdoc('runtime-config-wal.html', 'GUC-WAL-BUFFERS'),
  walCompression: pgdoc('runtime-config-wal.html', 'GUC-WAL-COMPRESSION'),
  maxWalSize: pgdoc('runtime-config-wal.html', 'GUC-MAX-WAL-SIZE'),
  minWalSize: pgdoc('runtime-config-wal.html', 'GUC-MIN-WAL-SIZE'),
  checkpointTimeout: pgdoc('runtime-config-wal.html', 'GUC-CHECKPOINT-TIMEOUT'),
  checkpointCompletionTarget: pgdoc('runtime-config-wal.html', 'GUC-CHECKPOINT-COMPLETION-TARGET'),
  walKeepSize: pgdoc('runtime-config-replication.html', 'GUC-WAL-KEEP-SIZE'),
  maxWalSenders: pgdoc('runtime-config-replication.html', 'GUC-MAX-WAL-SENDERS'),
  maxReplicationSlots: pgdoc('runtime-config-replication.html', 'GUC-MAX-REPLICATION-SLOTS'),
  autovacuum: pgdoc('runtime-config-vacuum.html', 'GUC-AUTOVACUUM'),
  autovacuumMaxWorkers: pgdoc('runtime-config-vacuum.html', 'GUC-AUTOVACUUM-MAX-WORKERS'),
  autovacuumVacuumScaleFactor: pgdoc('runtime-config-vacuum.html', 'GUC-AUTOVACUUM-VACUUM-SCALE-FACTOR'),
  autovacuumVacuumCostLimit: pgdoc('runtime-config-vacuum.html', 'GUC-AUTOVACUUM-VACUUM-COST-LIMIT'),
  loggingCollector: pgdoc('runtime-config-logging.html', 'GUC-LOGGING-COLLECTOR'),
  logMinDurationStatement: pgdoc('runtime-config-logging.html', 'GUC-LOG-MIN-DURATION-STATEMENT'),
  logCheckpoints: pgdoc('runtime-config-logging.html', 'GUC-LOG-CHECKPOINTS'),
  logLinePrefix: pgdoc('runtime-config-logging.html', 'GUC-LOG-LINE-PREFIX'),
  logTimezone: pgdoc('runtime-config-logging.html', 'GUC-LOG-TIMEZONE'),
  timezone: pgdoc('runtime-config-client.html', 'GUC-TIMEZONE'),
} as const;

/** 参数分组定义（conf 组顺序固定：连接认证 → 内存 → WAL → 复制 → 并行 → 自动清理 → 日志 → 异步 IO → 时区） */
export const PARAM_GROUPS: ParamGroupMeta[] = [
  { id: 'connections', label: '连接与认证', confTitle: 'Connections & Authentication', defaultOpen: false },
  { id: 'memory', label: '内存', confTitle: 'Memory', defaultOpen: false },
  { id: 'wal', label: 'WAL 与检查点', confTitle: 'Write-Ahead Log & Checkpoints', defaultOpen: false },
  { id: 'replication', label: '复制（主从）', confTitle: 'Replication', defaultOpen: false },
  { id: 'parallel', label: '并行查询与优化器', confTitle: 'Parallel Query & Planner', defaultOpen: false },
  { id: 'autovacuum', label: '自动清理', confTitle: 'Autovacuum', defaultOpen: false },
  { id: 'logging', label: '日志', confTitle: 'Logging', defaultOpen: false },
  { id: 'async-io', label: '异步 I/O（仅 v18）', confTitle: 'Asynchronous I/O', defaultOpen: false },
  { id: 'timezone', label: '时区', confTitle: 'Timezone', defaultOpen: false },
];

/** 全部参数定义（数组顺序即面板与 conf 内的输出顺序） */
export const CONFIG_PARAMS: PgParam[] = [
  // ===== 连接与认证 =====
  {
    key: 'listen_addresses',
    group: 'connections',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.listenAddresses,
    control: 'select',
    quoted: true,
    options: [
      { value: 'localhost', label: 'localhost — 仅本机（官方默认）' },
      { value: '*', label: '* — 所有接口（含 IPv6，必须配合 pg_hba 白名单）' },
    ],
    compute: computeListenAddresses,
    comment: '由快速配置"监听范围"驱动：仅本机 localhost、仅内网绑指定 IP、所有接口 *；只改本参数不会放行客户端——远程可连还需 pg_hba.conf 地址白名单 + scram-sha-256 口令，并在防火墙放行',
  },
  {
    key: 'port',
    group: 'connections',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.port,
    control: 'number',
    min: 1,
    max: 65535,
    step: 1,
    compute: (ctx) => ctx.port,
    comment: '监听端口（快捷配置"监听端口"驱动），默认 5432；同机多实例需错开，改后注意防火墙与客户端连接串同步',
  },
  {
    key: 'max_connections',
    group: 'connections',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxConnections,
    control: 'number',
    min: 10,
    max: 100000,
    step: 10,
    range: { conservative: 100, recommended: 200, aggressive: 500 },
    compute: computeMaxConnections,
    comment: '并发预估 ×1.2 上取整到 10 的倍数，且受内存封顶（内存 GB × 25，4GB 恰好 100 即官方默认）防超卖；每连接连同其 work_mem 多操作聚合的内存开销可观，扩连接前优先考虑连接池（PgBouncer 等）；备库该值必须 ≥ 主库',
  },
  {
    key: 'superuser_reserved_connections',
    group: 'connections',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.superuserReservedConnections,
    control: 'number',
    min: 0,
    max: 1000,
    step: 1,
    defaultValue: 3,
    comment: '为超级用户预留的连接槽（官方默认 3），普通连接耗尽 max_connections 后仍可登录排查；16 起另有 reserved_connections（默认 0）排在 superuser 槽之前，两者都从 max_connections 中扣除',
  },
  {
    key: 'password_encryption',
    group: 'connections',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.passwordEncryption,
    control: 'select',
    options: [
      { value: 'scram-sha-256', label: 'scram-sha-256 — 挑战响应式哈希（PG14+ 默认，推荐）' },
      { value: 'md5', label: 'md5 — 遗留兼容（口令等价于凭据，不新增使用）' },
    ],
    defaultValue: 'scram-sha-256',
    comment: 'CREATE ROLE / ALTER ROLE 设置口令时的哈希算法：PG14 起官方默认 scram-sha-256，轴内三版一致；md5 仅为遗留客户端兼容，不新增使用',
  },

  // ===== 内存 =====
  {
    key: 'shared_buffers',
    group: 'memory',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.sharedBuffers,
    control: 'number',
    min: 128,
    max: 131072,
    step: 128,
    valueSuffix: 'MB',
    range: { conservative: '15% 内存', recommended: '25% 内存（官方起步口径）', aggressive: '40% 内存（社区上限）' },
    compute: computeSharedBuffersMB,
    comment: 'PostgreSQL 共享缓冲区，官方文档建议专用服务器从内存 25% 起步（"40% 封顶"是社区口径而非官方文档）；其余内存交给 OS 页缓存（优化器经 effective_cache_size 感知）；配合 huge_pages 减少页表开销，改后需重启',
  },
  {
    key: 'effective_cache_size',
    group: 'memory',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.effectiveCacheSize,
    control: 'number',
    min: 128,
    max: 393216,
    step: 128,
    valueSuffix: 'MB',
    compute: computeEffectiveCacheSizeMB,
    comment: '优化器对"一个查询可用的索引页缓存"（shared_buffers + OS 页缓存）的估算，不实际分配内存；官方口径为内存的 50%~75%，取中 60%；设得过低会系统性低估索引扫描收益',
  },
  {
    key: 'work_mem',
    group: 'memory',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.workMem,
    control: 'number',
    min: 1,
    max: 1024,
    step: 1,
    valueSuffix: 'MB',
    range: { conservative: 4, recommended: 8, aggressive: 64 },
    compute: computeWorkMemMB,
    comment: '单个排序/哈希操作的内存配额（每操作、每会话各自计），官方文档明确提示总占用可达该值的数倍——内存 ≥ 16GB 翻一档、分析场景再 ×4，封顶 64MB；调大前先看 EXPLAIN ANALYZE 里是否有溢出到磁盘的 Sort/Hash',
  },
  {
    key: 'maintenance_work_mem',
    group: 'memory',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maintenanceWorkMem,
    control: 'number',
    min: 1,
    max: 4096,
    step: 1,
    valueSuffix: 'MB',
    range: { conservative: 128, recommended: 512, aggressive: 2048 },
    compute: computeMaintenanceWorkMemMB,
    comment: 'VACUUM / CREATE INDEX / ALTER TABLE 等维护操作的内存配额；autovacuum 工作进程各持一份（官方文档提醒总量可达 autovacuum_max_workers 倍），故 clamp 到 2GB 封顶',
  },
  {
    key: 'huge_pages',
    group: 'memory',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.hugePages,
    control: 'select',
    options: [
      { value: 'off', label: 'off — 不使用大页（<16GB 收紧值）' },
      { value: 'try', label: 'try — 尽量用显式大页，失败回退（官方默认，≥16GB 推荐）' },
      { value: 'on', label: 'on — 强制显式大页，失败拒绝启动' },
    ],
    compute: computeHugePages,
    comment: '显式 hugetlbfs 大页：官方默认 try（失败自动回退普通页），内存 ≥ 16GB 保持 try 并按 OS 建议预分配 vm.nr_hugepages，<16GB 有意收紧为 off；注意 try/on 与内核透明大页 THP 是两回事（官方文档明确不推荐 THP），改后需重启',
  },

  // ===== WAL 与检查点 =====
  {
    key: 'wal_level',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.walLevel,
    control: 'select',
    options: [
      { value: 'replica', label: 'replica — 支持流复制与 PITR（官方默认）' },
      { value: 'minimal', label: 'minimal — 最小 WAL，不支持复制/时间点恢复' },
      { value: 'logical', label: 'logical — 逻辑复制/订阅所需，开销更高' },
    ],
    defaultValue: 'replica',
    comment: 'WAL 信息量档位：replica 支持流复制与基于时间点恢复（官方默认，主从态同样输出 replica 即满足）；minimal 仅限单机且仍需 archive_mode 才能备份；logical 供逻辑复制/订阅',
  },
  {
    key: 'wal_buffers',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.walBuffers,
    control: 'number',
    min: -1,
    max: 4096,
    step: 1,
    defaultValue: -1,
    comment: 'WAL 写缓冲：-1 自动取 shared_buffers/32（下限 64kB、上限一个 WAL 段约 16MB），官方文档认为多数情况合理，保持 -1 交给服务器自适应；高并发提交场景才需要手动给几 MB，改后需重启',
  },
  {
    key: 'wal_compression',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.walCompression,
    control: 'select',
    options: [
      { value: 'off', label: 'off — 不压缩（官方默认）' },
      { value: 'pglz', label: 'pglz — 内置压缩，写密集推荐（on 的现代写法）' },
      { value: 'lz4', label: 'lz4 — 更快，需编译期 --with-lz4' },
      { value: 'zstd', label: 'zstd — 压缩比更好，需编译期 --with-zstd' },
    ],
    compute: computeWalCompression,
    comment: '满页写（full_page_writes）的 WAL 压缩算法：写密集场景 pglz 以少量 CPU 换 WAL 体积与复制传输量；lz4/zstd 更快但需编译期支持；历史别名 on（≡pglz）不输出',
  },
  {
    key: 'max_wal_size',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxWalSize,
    control: 'number',
    min: 256,
    max: 16384,
    step: 128,
    valueSuffix: 'MB',
    range: { conservative: 1024, recommended: 2048, aggressive: 8192 },
    compute: computeMaxWalSizeMB,
    comment: '检查点触发的软上限（非磁盘配额）：调大拉长检查点间隔、减少刷盘抖动，代价是崩溃恢复时间与 pg_wal 磁盘占用；按内存分档，写密集翻倍封顶 8GB，reload 生效',
  },
  {
    key: 'min_wal_size',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.minWalSize,
    control: 'number',
    min: 32,
    max: 8192,
    step: 16,
    valueSuffix: 'MB',
    range: { conservative: 80, recommended: 256, aggressive: 1024 },
    compute: computeMinWalSizeMB,
    comment: 'pg_wal 复用文件的保留下限（取 max_wal_size 的 1/8，官方默认 80MB）：高峰过后文件不删除留给下次复用，避免反复创建/删除段文件，reload 生效',
  },
  {
    key: 'checkpoint_timeout',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.checkpointTimeout,
    control: 'select',
    options: [
      { value: '5min', label: '5min — 官方默认' },
      { value: '15min', label: '15min — 写密集推荐' },
      { value: '30min', label: '30min — 极端写密集（崩溃恢复更久）' },
    ],
    compute: computeCheckpointTimeout,
    comment: '强制检查点间隔：写密集拉长到 15min 减少全量刷脏频率（需配合 max_wal_size 放大才生效）；更长间隔意味着崩溃恢复更慢，reload 生效',
  },
  {
    key: 'checkpoint_completion_target',
    group: 'wal',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.checkpointCompletionTarget,
    control: 'number',
    min: 0.1,
    max: 1,
    step: 0.05,
    defaultValue: 0.9,
    comment: '检查点在超时周期多大比例内匀速完成（14+ 官方默认 0.9）；官方文档明言不建议调低——越接近 1 平均写放大越小、IO 越平滑',
  },

  // ===== 复制（仅主从态渲染，条目保持静态值） =====
  {
    key: 'max_wal_senders',
    group: 'replication',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxWalSenders,
    control: 'number',
    min: 0,
    max: 1024,
    step: 1,
    defaultValue: 10,
    comment: '流复制与 pg_basebackup 的并发 WAL 发送进程数（官方默认 10，够 1 主 2 从 + 在线备份）；备库该值必须 ≥ 主库，改后需重启',
  },
  {
    key: 'max_replication_slots',
    group: 'replication',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxReplicationSlots,
    control: 'number',
    min: 0,
    max: 1024,
    step: 1,
    defaultValue: 10,
    comment: '物理 + 逻辑复制槽总数（官方默认 10）：槽会持有 WAL 防覆盖，弃用槽及时删除；主库侧可配 max_slot_wal_keep_size 限制槽保留上限防盘满，改后需重启',
  },
  {
    key: 'wal_keep_size',
    group: 'replication',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.walKeepSize,
    control: 'number',
    min: 0,
    max: 10240,
    step: 32,
    valueSuffix: 'MB',
    defaultValue: 256,
    comment: 'pg_wal 中为 standby 保留的旧段体积（256MB）：槽位之外再留兜底，主从短暂断连窗口内不丢 WAL；有槽时主要靠槽保留，此值是双保险之一，reload 生效',
  },

  // ===== 并行查询与优化器 =====
  {
    key: 'max_worker_processes',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxWorkerProcesses,
    control: 'number',
    min: 1,
    max: 1024,
    step: 1,
    range: { conservative: 8, recommended: 16, aggressive: 32 },
    compute: computeWorkerProcesses,
    comment: '后台工作进程总数上限（官方默认 8）：并行查询、逻辑复制等所有 worker 的总池子，按 CPU 核数抬升；备库该值必须 ≥ 主库，改后需重启',
  },
  {
    key: 'max_parallel_workers',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxParallelWorkers,
    control: 'number',
    min: 0,
    max: 1024,
    step: 1,
    range: { conservative: 2, recommended: 4, aggressive: 8 },
    compute: computeParallelWorkers,
    comment: '并行查询可用的 worker 数（从 max_worker_processes 池中分配，恒不大于它）：按核数 −1 给主进程留余量',
  },
  {
    key: 'max_parallel_workers_per_gather',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.maxParallelWorkersPerGather,
    control: 'number',
    min: 0,
    max: 64,
    step: 1,
    range: { conservative: 1, recommended: 2, aggressive: 4 },
    compute: computeParallelPerGather,
    comment: '单个 Gather 节点最多可借的并行 worker 数（官方默认 2）：并行过多会挤占 OLTP 小查询的 worker 配额，上限 4',
  },
  {
    key: 'jit',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.jit,
    control: 'switch',
    compute: computeJit,
    comment: '表达式/查询 JIT 编译：长查询受益，OLTP 短查询的编译开销常超收益（官方 jit-decision 文档），oltp 场景显式关闭；分析/长查询场景保持 on',
  },
  {
    key: 'random_page_cost',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.randomPageCost,
    control: 'number',
    min: 0,
    max: 100,
    step: 0.1,
    range: { conservative: 4, recommended: 1.5, aggressive: 1.1 },
    compute: computeRandomPageCost,
    comment: '优化器的随机读代价系数（官方默认 4.0 按 HDD 估）：SSD 1.5、NVMe 1.1 让优化器更倾向索引扫描；官方文档未给 SSD 推荐值，数值属社区常见建议',
  },
  {
    key: 'effective_io_concurrency',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.effectiveIoConcurrency,
    control: 'number',
    min: 0,
    max: 1000,
    step: 1,
    range: { conservative: 1, recommended: 200, aggressive: 1000 },
    compute: computeIoConcurrency,
    comment: '预读并发数的执行器提示（位图堆扫描等）：SSD/NVMe 200 为社区常用建议；HDD 保持低值——16/17 官方默认 1、18 上调默认至 16，本工具按目标版本跟随',
  },
  {
    key: 'default_statistics_target',
    group: 'parallel',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.defaultStatisticsTarget,
    control: 'number',
    min: 1,
    max: 10000,
    step: 10,
    range: { conservative: 50, recommended: 100, aggressive: 500 },
    compute: computeStatisticsTarget,
    comment: 'ANALYZE 每列统计样本目标（官方默认 100）：分析报表的复杂查询提升到 200 改善计划质量，代价是 ANALYZE 更慢、pg_statistic 更大',
  },

  // ===== 自动清理 =====
  {
    key: 'autovacuum',
    group: 'autovacuum',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.autovacuum,
    control: 'switch',
    defaultValue: true,
    comment: '自动清理总开关（官方默认 on）：负责回收死元组与冻结事务 ID，生产库保持开启；依赖 track_counts 同时开启（默认即开），关闭后必须自行调度 VACUUM',
  },
  {
    key: 'autovacuum_max_workers',
    group: 'autovacuum',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.autovacuumMaxWorkers,
    control: 'number',
    min: 1,
    max: 64,
    step: 1,
    defaultValue: 3,
    comment: '并发 autovacuum 进程数（官方默认 3）：表多且写入大的实例可上调，每个进程最多占一份 maintenance_work_mem；18 起受 autovacuum_worker_slots 保护可运行时调整，16/17 改后需重启',
  },
  {
    key: 'autovacuum_vacuum_scale_factor',
    group: 'autovacuum',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.autovacuumVacuumScaleFactor,
    control: 'select',
    options: [
      { value: '0.2', label: '0.2 — 死元组 20% 触发（官方默认）' },
      { value: '0.1', label: '0.1 — 中等写入' },
      { value: '0.05', label: '0.05 — 写密集推荐' },
      { value: '0.01', label: '0.01 — 超大表激进（配合绝对上限）' },
    ],
    compute: computeAutovacuumScaleFactor,
    comment: '触发表 VACUUM 的死元组比例阈值（官方默认 0.2）：大表 20% 积压太多，写密集收紧到 5%；超大表可另配表级存储参数或 18 的 autovacuum_vacuum_max_threshold 绝对上限',
  },
  {
    key: 'autovacuum_vacuum_cost_limit',
    group: 'autovacuum',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.autovacuumVacuumCostLimit,
    control: 'number',
    min: -1,
    max: 10000,
    step: 100,
    range: { conservative: 200, recommended: 200, aggressive: 2000 },
    compute: computeAutovacuumCostLimit,
    comment: 'autovacuum 每轮成本配额（-1 沿用 vacuum_cost_limit 即 200）：官方默认过于保守会导致清理跟不上写入，写密集提到 2000 加速死元组回收，代价是清理期 IO 占用上升，reload 生效',
  },

  // ===== 日志 =====
  {
    key: 'logging_collector',
    group: 'logging',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.loggingCollector,
    control: 'switch',
    defaultValue: false,
    comment: 'stderr 日志采集器（官方默认 off）：日志交给 systemd/journald 时保持 off；需要 CSV/JSON 日志、文件轮转或 log_destination 非 stderr 时才开（改后需重启）',
  },
  {
    key: 'log_min_duration_statement',
    group: 'logging',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.logMinDurationStatement,
    control: 'select',
    options: [
      { value: '-1', label: '-1 — 关闭（官方默认）' },
      { value: '300', label: '300ms — 严格排查' },
      { value: '1000', label: '1000ms — 1 秒起步观察（推荐）' },
      { value: '3000', label: '3000ms — 只抓慢查询' },
    ],
    defaultValue: '1000',
    comment: '慢查询记录阈值（毫秒）：官方默认 -1 等于关闭，推荐 1000ms 起步观察；0 记录全部语句（日志量大，仅排查用）；superuser 级参数，reload 生效',
  },
  {
    key: 'log_checkpoints',
    group: 'logging',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.logCheckpoints,
    control: 'switch',
    defaultValue: true,
    comment: '记录检查点起止与刷盘统计（15+ 官方默认 on）：判断 checkpoint 是否成为瓶颈的第一手数据，保持 on',
  },
  {
    key: 'log_line_prefix',
    group: 'logging',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.logLinePrefix,
    control: 'text',
    quoted: true,
    defaultValue: '%m [%p] %u@%d ',
    comment: '每行日志前缀（% 转义）：官方默认 %m [%p] 只有时间与进程号，补上 %u@%d 便于定位问题用户与库；值尾的空格是有意保留的分隔符',
  },

  // ===== 异步 IO（仅 v18） =====
  {
    key: 'io_method',
    group: 'async-io',
    introducedIn: '18',
    availableIn: ['18'],
    docUrl: DOC_URLS.ioMethod,
    control: 'select',
    options: [
      { value: 'worker', label: 'worker — AIO 工作进程池（默认）' },
      { value: 'io_uring', label: 'io_uring — 内核原生异步 IO，需编译期 --with-liburing' },
      { value: 'sync', label: 'sync — 18 前的传统同步行为' },
    ],
    defaultValue: 'worker',
    comment: '18 起的异步 I/O 框架（默认 worker 进程池）：io_uring 性能更好但需编译期 --with-liburing，sync 为 18 前传统行为；16/17 无此参数，整组隐藏，改后需重启',
  },
  {
    key: 'io_workers',
    group: 'async-io',
    introducedIn: '18',
    availableIn: ['18'],
    docUrl: DOC_URLS.ioWorkers,
    control: 'number',
    min: 1,
    max: 32,
    step: 1,
    defaultValue: 3,
    comment: 'io_method = worker 时的 AIO 工作进程数（默认 3）：按存储队列深度适度上调，仅 worker 模式生效，reload 可改',
  },

  // ===== 时区 =====
  {
    key: 'timezone',
    group: 'timezone',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.timezone,
    control: 'text',
    quoted: true,
    defaultValue: 'Asia/Shanghai',
    comment: '会话默认时区：initdb 会按系统环境写入初始值，这里显式固定为 Asia/Shanghai，消除对安装环境的依赖（集群节点应保持一致，按需修改）',
  },
  {
    key: 'log_timezone',
    group: 'timezone',
    introducedIn: '16',
    availableIn: ['16', '17', '18'],
    docUrl: DOC_URLS.logTimezone,
    control: 'text',
    quoted: true,
    defaultValue: 'Asia/Shanghai',
    comment: '日志时间戳时区：与 timezone 保持一致便于日志对账；改后 reload 生效',
  },
];

/** 按 key 查找参数定义 */
export function getParam(key: string): PgParam | undefined {
  return CONFIG_PARAMS.find((p) => p.key === key);
}

/** 数值参数的单位后缀词汇表（redis/mysql/PG 键全量合并后上浮共享层，此处 re-export 保持既有 import 形态） */
export { PARAM_UNITS } from '../../../components/config/types';

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
 * 创建默认生成上下文（打开即用的推荐画像：4GB / 4 核 / SSD / 通用 OLTP /
 * 并发 200 / 单机 / 仅本机 / 5432 / 目标版本 17——三点轴的中间部署最广版本）。
 * 每次调用返回全新对象，供初始渲染与重置使用。
 * @returns 全新的 GenerateContext
 */
export function createDefaultContext(): GenerateContext {
  return {
    version: '17',
    mode: 'single',
    memoryGB: 4,
    cpuCores: 4,
    diskType: 'ssd',
    scenario: 'oltp',
    concurrency: 200,
    listenScope: 'loopback',
    bindIp: '',
    port: 5432,
    overrides: {},
  };
}
