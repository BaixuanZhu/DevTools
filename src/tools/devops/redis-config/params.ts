/**
 * Redis 配置参数定义表（数据层核心）。
 *
 * 收录 11 组约 60 个参数（含 6 个仅在数据中登记溯源的旧名别名条目），
 * 版本标注以 research/redis-params-version-notes.md 为准（源：Redis 官方
 * config.c 注册表 diff 与 00-RELEASENOTES）。redis.io 无逐参数文档页，
 * docUrl 统一指向官方配置总览与主题文档页。
 *
 * 每个参数的 compute 返回该上下文下的推荐值：
 * - null   参数在该上下文不适用（整行隐藏、conf 不输出，如单机模式的复制组）
 * - ''     参数适用但当前值为空（行显示、conf 略过指令，如 requirepass 未生成时）
 */
import type { ConfigParamBase, ParamValue } from '../../../components/config/types';
import type { RedisVersion, TargetVersion } from './version';
import {
  computeAofMinSizeMB,
  computeAppendonly,
  computeBind,
  computeIoThreads,
  computeMaxClients,
  computeMaxMemoryMB,
  computeMaxMemoryPolicy,
  computeNotifyKeyspaceEvents,
  computeReplBacklogMB,
  computeSave,
  computeSlowlogMaxLen,
  computeSlowlogSlowerThanUs,
  computeTcpBacklog,
  computeTimeoutSeconds,
} from './compute';

/** 参数控件类型（字段已由共享 ConfigParamBase 的 control 并集承载，此别名保留为该并集的 redis 形态） */
export type ControlKind = 'select' | 'number' | 'switch' | 'multi-select' | 'text';

/** 参数分组 ID（顺序即 conf 输出顺序，见 PARAM_GROUPS） */
export type ParamGroupId =
  | 'network'
  | 'memory'
  | 'rdb'
  | 'aof'
  | 'encoding'
  | 'replication'
  | 'security'
  | 'buffers'
  | 'observe'
  | 'lazyfree'
  | 'keyspace';

/** 参数值类型与推荐范围：共享定义 re-export（保持既有 import 路径不变） */
export type { ParamValue, ParamRange } from '../../../components/config/types';

/** 枚举选项（select / multi-select 用），label 附中文说明 */
export interface ParamOption {
  /** 选项值（写入 conf 的原始值） */
  value: string;
  /** 显示文本 + 中文说明 */
  label: string;
}

/**
 * 生成上下文：左栏画像输入 + 用户覆盖值。
 */
export interface GenerateContext {
  /** 部署模式：单机 / 主从（复制组仅主从模式出现） */
  mode: 'standalone' | 'replica';
  /** CPU 核数 */
  cpuCores: number;
  /** 物理内存（GB） */
  memoryGB: number;
  /** 磁盘类型 */
  diskType: 'hdd' | 'ssd' | 'nvme';
  /** 使用场景（驱动默认值） */
  scenario: 'cache' | 'session' | 'queue' | 'mixed';
  /** 持久化策略 */
  persistence: 'rdb' | 'aof' | 'both' | 'off';
  /** 目标 Redis 版本 */
  version: TargetVersion;
  /** 并发连接数预估 */
  concurrency: number;
  /** 主库地址（主从模式必填，格式如 '10.0.0.5 6379'） */
  masterAddr: string;
  /** 监听范围：驱动 bind 推荐值（快速配置"监听范围"单选） */
  listenScope: 'all' | 'loopback' | 'intranet';
  /** 仅内网监听时的绑定 IP（listenScope 为 'intranet' 时必填） */
  bindIp: string;
  /** 用户覆盖值：key → value；compute 只在无覆盖时生效 */
  overrides: Record<string, ParamValue>;
}

/**
 * conf 指令参数（单个 ConfigParam 的完整定义）。
 * 基础字段（key/comment/control/options/min/max/step/range/secret 等）继承共享
 * ConfigParamBase（src/components/config/types.ts），此处仅保留工具专有字段
 * 与窄化到 Redis 版本枚举的版本标注。
 */
export interface ConfigParam extends ConfigParamBase {
  /** 所属分组 */
  group: ParamGroupId;
  /** 引入版本（pre-7 的 UI 不显示徽章） */
  introducedIn: RedisVersion;
  /** 标记废弃的版本 */
  deprecatedIn?: RedisVersion;
  /** 官方文档链接（redis.io 无逐参数页，指向配置总览或主题页） */
  docUrl: string;
  /** 数值写入 conf 时追加的单位后缀（如内存尺寸 'mb'） */
  valueSuffix?: string;
  /** 由硬件/场景计算默认值；返回 null 表示该上下文下参数不适用 */
  compute: (ctx: GenerateContext) => ParamValue | null;
}

/** 参数分组元数据（conf 输出顺序固定） */
export interface ParamGroupMeta {
  /** 分组 ID */
  id: ParamGroupId;
  /** 分组标题（conf 组注释与面板标题共用） */
  label: string;
  /** 面板 Collapsible 是否默认展开（推荐值打开即可用，全部默认收起、按需展开微调） */
  defaultOpen: boolean;
}

/** 官方文档 URL 白名单（redis.io 实测可访问的主题页，2026-08 核对） */
export const DOC_URLS = {
  config: 'https://redis.io/docs/latest/operate/oss_and_stack/management/config/',
  persistence: 'https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/',
  replication: 'https://redis.io/docs/latest/operate/oss_and_stack/management/replication/',
  eviction: 'https://redis.io/docs/latest/develop/reference/eviction/',
  keyspace: 'https://redis.io/docs/latest/develop/use/keyspace-notifications/',
  acl: 'https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/',
} as const;

/** maxmemory-policy 完整枚举（7.0-8.0 恒为 8 个值，无增减） */
const MAXMEMORY_POLICY_OPTIONS: ParamOption[] = [
  { value: 'volatile-lru', label: 'volatile-lru — 仅对带过期时间的键 LRU 淘汰' },
  { value: 'volatile-lfu', label: 'volatile-lfu — 仅对带过期时间的键 LFU 淘汰' },
  { value: 'volatile-random', label: 'volatile-random — 仅对带过期时间的键随机淘汰' },
  { value: 'volatile-ttl', label: 'volatile-ttl — 优先淘汰剩余存活时间短的键' },
  { value: 'allkeys-lru', label: 'allkeys-lru — 全部键 LRU 淘汰（缓存推荐）' },
  { value: 'allkeys-lfu', label: 'allkeys-lfu — 全部键 LFU 淘汰（访问频率感知）' },
  { value: 'allkeys-random', label: 'allkeys-random — 全部键随机淘汰' },
  { value: 'noeviction', label: 'noeviction — 内存满后拒绝写入（队列推荐）' },
];

/** enable-debug-command / enable-module-command / enable-protected-configs 共用枚举 */
const PROTECTED_ACTION_OPTIONS: ParamOption[] = [
  { value: 'no', label: 'no — 禁止（默认，推荐）' },
  { value: 'local', label: 'local — 仅本机连接可用' },
  { value: 'yes', label: 'yes — 完全放开（不推荐）' },
];

/** client-output-buffer-limit 预设（三条指令一组，类别 硬限 软限 软限秒数） */
const COBL_DEFAULT = 'normal 0 0 0\nreplica 256mb 64mb 60\npubsub 32mb 8mb 60';
const COBL_RELAXED = 'normal 0 0 0\nreplica 512mb 128mb 120\npubsub 64mb 16mb 60';
const COBL_STRICT = 'normal 256mb 64mb 60\nreplica 256mb 64mb 60\npubsub 32mb 8mb 60';

/** 参数分组定义（conf 组顺序固定：网络 → 内存 → RDB → AOF → 编码 → 复制 → 安全 → 缓冲 → 观测 → Lazy Free → 键空间） */
export const PARAM_GROUPS: ParamGroupMeta[] = [
  { id: 'network', label: '网络连接', defaultOpen: false },
  { id: 'memory', label: '内存策略', defaultOpen: false },
  { id: 'rdb', label: 'RDB 快照', defaultOpen: false },
  { id: 'aof', label: 'AOF 追加日志', defaultOpen: false },
  { id: 'encoding', label: '数据结构编码', defaultOpen: false },
  { id: 'replication', label: '复制（主从）', defaultOpen: false },
  { id: 'security', label: '安全', defaultOpen: false },
  { id: 'buffers', label: '客户端缓冲', defaultOpen: false },
  { id: 'observe', label: '观测', defaultOpen: false },
  { id: 'lazyfree', label: 'Lazy Free（异步释放）', defaultOpen: false },
  { id: 'keyspace', label: '键空间', defaultOpen: false },
];

/** 全部参数定义（含仅登记溯源的旧名别名条目；数组顺序即面板与 conf 内的输出顺序） */
export const CONFIG_PARAMS: ConfigParam[] = [
  // ===== 网络连接 =====
  {
    key: 'bind',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'text',
    compute: computeBind,
    comment: '由快速配置"监听范围"驱动，可在此覆盖；留空=监听所有网卡，远程访问靠 requirepass 把门；不要写 0.0.0.0——显式 bind 行会让 protected-mode 失效',
  },
  {
    key: 'protected-mode',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: () => true,
    comment: '仅在"无 bind 行且未设密码"时拦截外部连接；已设 requirepass 后不参与判断，保留 yes 作为清空密码时的兜底',
  },
  {
    key: 'port',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 1024,
    max: 65535,
    step: 1,
    range: { conservative: 6379, recommended: 6379, aggressive: 16379 },
    compute: () => 6379,
    comment: '监听端口，默认 6379；同机多实例需错开；改非标端口可减少扫描暴露面，但认证安全仍依赖 requirepass',
  },
  {
    key: 'tcp-backlog',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 128,
    max: 4096,
    step: 64,
    range: { conservative: 511, recommended: 2048, aggressive: 4096 },
    compute: computeTcpBacklog,
    comment: 'TCP 全连接队列长度；并发高时增大，且必须同步调大内核 net.core.somaxconn（见系统参数建议）',
  },
  {
    key: 'tcp-keepalive',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 900,
    step: 15,
    range: { conservative: 0, recommended: 300, aggressive: 600 },
    compute: () => 300,
    comment: 'TCP 保活探测间隔（秒），回收死连接防止半开连接堆积；300 为官方推荐值',
  },
  {
    key: 'timeout',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 900,
    step: 30,
    range: { conservative: 0, recommended: 0, aggressive: 300 },
    compute: computeTimeoutSeconds,
    comment: '空闲连接断开秒数，0 表示不断开；会话型建议 300 回收资源',
  },
  {
    key: 'maxclients',
    group: 'network',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 200,
    max: 40000,
    step: 100,
    range: { conservative: 1000, recommended: 10000, aggressive: 30000 },
    compute: computeMaxClients,
    comment: '并发预估 ×1.5 上取整（下限 1000、上限 40000），必须与 ulimit nofile 联动（见系统参数建议）',
  },
  {
    key: 'max-new-connections-per-cycle',
    group: 'network',
    introducedIn: '7.4',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 1,
    max: 100,
    step: 1,
    range: { conservative: 10, recommended: 10, aggressive: 50 },
    compute: () => 10,
    comment: '每个事件循环周期接受的新连接数上限（7.4 引入），防御突发连接风暴，默认 10 一般无需调整',
  },

  // ===== 内存策略 =====
  {
    key: 'maxmemory',
    group: 'memory',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.eviction,
    control: 'number',
    min: 0,
    max: 65536,
    step: 256,
    valueSuffix: 'mb',
    range: { conservative: '50% 内存', recommended: '60%~75% 内存', aggressive: '90% 内存' },
    compute: computeMaxMemoryMB,
    comment: '内存上限按物理内存折算：开启持久化取 60%（预留 fork 写时复制余量），纯缓存关闭持久化可到 75%',
  },
  {
    key: 'maxmemory-policy',
    group: 'memory',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.eviction,
    control: 'select',
    options: MAXMEMORY_POLICY_OPTIONS,
    compute: computeMaxMemoryPolicy,
    comment: '缓存场景用 allkeys-lru 淘汰冷键；队列场景必须 noeviction 防止淘汰丢数据（7.0-8.0 恒为 8 个策略）',
  },
  {
    key: 'maxmemory-samples',
    group: 'memory',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.eviction,
    control: 'number',
    min: 1,
    max: 16,
    step: 1,
    range: { conservative: 3, recommended: 5, aggressive: 10 },
    compute: () => 5,
    comment: '每次淘汰采样的键数量，越大越精确越耗 CPU；5 为官方默认',
  },
  {
    key: 'io-threads',
    group: 'memory',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 1,
    max: 8,
    step: 1,
    range: { conservative: 1, recommended: 2, aggressive: 4 },
    compute: computeIoThreads,
    comment: '网络 I/O 线程数：≥8 核设 4、≥4 核设 2，写多读少的高并发场景收益明显（仅启动时可设）',
  },
  {
    key: 'io-threads-do-reads',
    group: 'memory',
    introducedIn: 'pre-7',
    deprecatedIn: '8.0',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: () => false,
    comment: '读线程化通常无收益，保持 no；8.0 起新 I/O 线程实现读写均线程化，该参数已废弃无效',
  },

  // ===== RDB 快照 =====
  {
    key: 'save',
    group: 'rdb',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'select',
    options: [
      { value: '3600 1 300 100 60 10000', label: '官方默认（6.2+）— 1h/1 次、5min/100 次、1min/1 万次' },
      { value: '900 1 300 10 60 10000', label: '较密集 — 15min/1 次、5min/10 次、1min/1 万次' },
      { value: '300 1 60 10000', label: '稀疏 — 5min/1 次、1min/1 万次（缓存型）' },
      { value: '300 10 60 10000', label: '密集 — 5min/10 次、1min/1 万次（高频写）' },
      { value: '""', label: '关闭自动快照（save ""）' },
    ],
    compute: computeSave,
    comment: 'RDB 触发阈值（秒 内变更次数）；缓存可稀疏，高频写建议密集或以 AOF 为主；关闭持久化时输出 save "" 显式关闭——省略该行时编译期默认快照阈值仍生效',
  },
  {
    key: 'stop-writes-on-bgsave-error',
    group: 'rdb',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'switch',
    compute: () => true,
    comment: '快照失败时拒绝写入，避免在无持久化兜底下继续运行；排查磁盘后再关闭',
  },
  {
    key: 'rdbcompression',
    group: 'rdb',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'switch',
    compute: () => true,
    comment: '字符串用 LZF 压缩，快照更小；CPU 极度紧张时可关闭',
  },
  {
    key: 'rdbchecksum',
    group: 'rdb',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'switch',
    compute: () => true,
    comment: '快照文件 CRC64 校验以发现损坏；关闭可省约 10% 保存耗时（仅启动时可设）',
  },
  {
    key: 'dbfilename',
    group: 'rdb',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'text',
    compute: () => 'dump.rdb',
    comment: 'RDB 文件名，多实例共用目录时需区分',
  },
  {
    key: 'dir',
    group: 'rdb',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'text',
    compute: () => '',
    comment: '持久化文件输出目录，留空使用工作目录；需确保运行用户有写权限',
  },

  // ===== AOF 追加日志 =====
  {
    key: 'appendonly',
    group: 'aof',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'switch',
    compute: computeAppendonly,
    comment: '开启 AOF 追加日志；持久化策略为 AOF 或 RDB+AOF 时必须开启',
  },
  {
    key: 'appendfsync',
    group: 'aof',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'select',
    options: [
      { value: 'always', label: 'always — 每条命令都落盘（最安全，性能最差）' },
      { value: 'everysec', label: 'everysec — 每秒落盘（推荐，最多丢 1 秒）' },
      { value: 'no', label: 'no — 交给操作系统（最快，最不安全）' },
    ],
    compute: () => 'everysec',
    comment: 'everysec 兼顾安全与性能，最多丢失 1 秒数据',
  },
  {
    key: 'no-appendfsync-on-rewrite',
    group: 'aof',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'switch',
    compute: () => false,
    comment: 'yes 可避免 AOF 重写期间 fsync 阻塞主进程，但该窗口可能丢数据；默认 no 保持久化安全',
  },
  {
    key: 'auto-aof-rewrite-percentage',
    group: 'aof',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'number',
    min: 10,
    max: 300,
    step: 10,
    range: { conservative: 50, recommended: 100, aggressive: 200 },
    compute: () => 100,
    comment: 'AOF 体积超过上次重写后的百分比时触发重写，100 即翻倍触发',
  },
  {
    key: 'auto-aof-rewrite-min-size',
    group: 'aof',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'number',
    min: 16,
    max: 1024,
    step: 16,
    valueSuffix: 'mb',
    range: { conservative: 64, recommended: 64, aggressive: 512 },
    compute: computeAofMinSizeMB,
    comment: '触发重写的最小 AOF 体积；≥16GB 内存机器放宽到 512mb 以减少重写频率',
  },
  {
    key: 'aof-use-rdb-preamble',
    group: 'aof',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.persistence,
    control: 'switch',
    compute: () => true,
    comment: '重写时以 RDB 为前缀、增量部分追加日志，恢复更快体积更小；官方推荐保持开启',
  },
  {
    key: 'appenddirname',
    group: 'aof',
    introducedIn: '7.0',
    docUrl: DOC_URLS.persistence,
    control: 'text',
    compute: () => 'appendonlydir',
    comment: '多部分 AOF 的存储目录名（7.0 起 AOF 拆分为 base/incr 多个文件存放于该目录）',
  },

  // ===== 数据结构编码 =====
  {
    key: 'hash-max-listpack-entries',
    group: 'encoding',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 1024,
    step: 32,
    range: { conservative: 128, recommended: 512, aggressive: 1024 },
    compute: () => 512,
    comment: '哈希元素数低于该值用 listpack 紧凑编码省内存，超限转 hashtable（7.0 由 ziplist 名改来）',
  },
  {
    key: 'hash-max-listpack-value',
    group: 'encoding',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 512,
    step: 8,
    range: { conservative: 32, recommended: 64, aggressive: 128 },
    compute: () => 64,
    comment: '哈希单值长度低于该值（字节）保持 listpack，超限转编码',
  },
  {
    key: 'list-max-listpack-size',
    group: 'encoding',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'select',
    options: [
      { value: '-1', label: '-1 — 每节点最多 4KB' },
      { value: '-2', label: '-2 — 每节点最多 8KB（默认）' },
      { value: '-3', label: '-3 — 每节点最多 16KB' },
      { value: '128', label: '128 — 每节点最多 128 个元素' },
      { value: '256', label: '256 — 每节点最多 256 个元素' },
      { value: '512', label: '512 — 每节点最多 512 个元素' },
    ],
    compute: () => '-2',
    comment: 'list 节点 listpack 压缩粒度：负值按字节、正值按元素数；-2（8KB）为官方默认（7.0 由 ziplist 名改来）',
  },
  {
    key: 'zset-max-listpack-entries',
    group: 'encoding',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 512,
    step: 16,
    range: { conservative: 64, recommended: 128, aggressive: 256 },
    compute: () => 128,
    comment: '有序集合元素数低于该值用 listpack，超限转 skiplist（7.0 由 ziplist 名改来）',
  },
  {
    key: 'zset-max-listpack-value',
    group: 'encoding',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 256,
    step: 8,
    range: { conservative: 32, recommended: 64, aggressive: 128 },
    compute: () => 64,
    comment: '有序集合单成员长度阈值（字节）',
  },
  {
    key: 'set-max-listpack-entries',
    group: 'encoding',
    introducedIn: '7.2',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 512,
    step: 16,
    range: { conservative: 64, recommended: 128, aggressive: 256 },
    compute: () => 128,
    comment: '集合元素数低于该值用 listpack 紧凑编码（7.2 引入）',
  },
  {
    key: 'set-max-listpack-value',
    group: 'encoding',
    introducedIn: '7.2',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 256,
    step: 8,
    range: { conservative: 32, recommended: 64, aggressive: 128 },
    compute: () => 64,
    comment: '集合单成员长度阈值（字节，7.2 引入）',
  },
  {
    key: 'set-max-intset-entries',
    group: 'encoding',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 64,
    max: 65536,
    step: 64,
    range: { conservative: 512, recommended: 512, aggressive: 10000 },
    compute: () => 512,
    comment: '全整数集合用 intset 紧凑编码的元素数上限，超限转 hashtable；只管整数集合，与 listpack 阈值并存',
  },

  // ===== 复制（主从） =====
  {
    key: 'replicaof',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'text',
    compute: (ctx) => (ctx.mode === 'replica' ? ctx.masterAddr.trim() : null),
    comment: '主库地址与端口（空格分隔），填写后本实例成为副本；旧版写法为 slaveof',
  },
  {
    key: 'masterauth',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'text',
    secret: true,
    compute: (ctx) => (ctx.mode === 'replica' ? '' : null),
    comment: '主库密码，需与主库 requirepass 一致；未设置密码时留空',
  },
  {
    key: 'replica-read-only',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '副本只读保证数据一致；允许写副本会有双主分叉风险',
  },
  {
    key: 'replica-serve-stale-data',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '主从同步中断时仍用旧数据应答；对一致性敏感可关闭（改为返回错误）',
  },
  {
    key: 'repl-backlog-size',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'number',
    min: 1,
    max: 256,
    step: 1,
    valueSuffix: 'mb',
    range: { conservative: 16, recommended: 64, aggressive: 64 },
    compute: (ctx) => (ctx.mode === 'replica' ? computeReplBacklogMB(ctx) : null),
    comment: '复制积压环形缓冲大小；≥8GB 内存建议 64mb，短暂断线的副本可增量同步',
  },
  {
    key: 'repl-diskless-sync',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'switch',
    compute: (ctx) => (ctx.mode === 'replica' ? true : null),
    comment: '全量同步直接经网络发给副本不落盘；7.0 起官方默认改为 yes，磁盘慢时更优',
  },
  {
    key: 'min-replicas-to-write',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'number',
    min: 0,
    max: 5,
    step: 1,
    range: { conservative: 0, recommended: 0, aggressive: 2 },
    compute: (ctx) => (ctx.mode === 'replica' ? 0 : null),
    comment: '健康副本数低于该值时主库拒绝写入，0 表示不限制；对一致性要求高可设 1',
  },
  {
    key: 'min-replicas-max-lag',
    group: 'replication',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.replication,
    control: 'number',
    min: 0,
    max: 60,
    step: 5,
    range: { conservative: 10, recommended: 10, aggressive: 30 },
    compute: (ctx) => (ctx.mode === 'replica' ? 10 : null),
    comment: '判定副本健康的最大延迟秒数，配合 min-replicas-to-write 使用',
  },
  {
    key: 'replica-full-sync-buffer-limit',
    group: 'replication',
    introducedIn: '8.0',
    docUrl: DOC_URLS.replication,
    control: 'number',
    min: 0,
    max: 2048,
    step: 64,
    valueSuffix: 'mb',
    range: { conservative: 0, recommended: 0, aggressive: 1024 },
    compute: (ctx) => (ctx.mode === 'replica' ? 0 : null),
    comment: '全量同步期间副本端可累积的复制流缓冲上限（8.0 引入），0 表示继承 client-output-buffer-limit 的 replica 硬限',
  },

  // ===== 安全 =====
  {
    key: 'requirepass',
    group: 'security',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.acl,
    control: 'text',
    secret: true,
    compute: () => '',
    comment: '远程访问的准入门槛（等价于为 default 用户设密码），打开页面已自动生成，点"生成"可重新生成；多用户细粒度权限请用 ACL，requirepass 与 aclfile 互斥',
  },
  {
    key: 'enable-debug-command',
    group: 'security',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'select',
    options: PROTECTED_ACTION_OPTIONS,
    compute: () => 'no',
    comment: '放开 DEBUG 命令（7.0 起默认保护）；仅在排查时临时开启，生产保持 no',
  },
  {
    key: 'enable-module-command',
    group: 'security',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'select',
    options: PROTECTED_ACTION_OPTIONS,
    compute: () => 'no',
    comment: '放开 MODULE LOAD/UNLOAD（7.0 起默认保护），生产保持 no 防止任意模块加载',
  },
  {
    key: 'enable-protected-configs',
    group: 'security',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'select',
    options: PROTECTED_ACTION_OPTIONS,
    compute: () => 'no',
    comment: '放开 dir/dbfilename 等敏感参数的运行期修改（7.0 起默认保护），生产保持 no',
  },
  {
    key: 'hide-user-data-from-log',
    group: 'security',
    introducedIn: '7.4',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: () => true,
    comment: '避免日志记录键名等用户数据（PII 防泄漏，7.4 引入）；官方默认 no，建议生产开启',
  },

  // ===== 客户端缓冲 =====
  {
    key: 'client-output-buffer-limit',
    group: 'buffers',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'select',
    options: [
      { value: COBL_DEFAULT, label: '官方默认 — 副本 256mb/64mb/60s，pubsub 32mb/8mb/60s' },
      { value: COBL_RELAXED, label: '放宽 — 大副本全量同步 / 大发布订阅' },
      { value: COBL_STRICT, label: '严格 — 普通客户端也限流，防内存被慢客户端打爆' },
    ],
    compute: () => COBL_DEFAULT,
    comment: '客户端输出缓冲上限（类别 硬限 软限 软限秒数），防止慢副本或慢订阅者把内存打爆',
  },
  {
    key: 'busy-reply-threshold',
    group: 'buffers',
    introducedIn: '7.0',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 100,
    max: 60000,
    step: 100,
    range: { conservative: 1000, recommended: 5000, aggressive: 30000 },
    compute: () => 5000,
    comment: '主线程阻塞超过该毫秒数后对请求回复 BUSY（7.0 由 lua-time-limit 改名而来）',
  },

  // ===== 观测 =====
  {
    key: 'slowlog-log-slower-than',
    group: 'observe',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: -1,
    max: 100000,
    step: 100,
    range: { conservative: 1000, recommended: 10000, aggressive: 100000 },
    compute: computeSlowlogSlowerThanUs,
    comment: '慢查询阈值（微秒），-1 禁用；延迟敏感的队列建议 1ms 起记录',
  },
  {
    key: 'slowlog-max-len',
    group: 'observe',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 64,
    max: 2048,
    step: 64,
    range: { conservative: 128, recommended: 256, aggressive: 1024 },
    compute: computeSlowlogMaxLen,
    comment: '慢查询环形队列长度，队列/混合场景加大便于回溯',
  },
  {
    key: 'latency-monitor-threshold',
    group: 'observe',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 1000,
    step: 10,
    range: { conservative: 0, recommended: 0, aggressive: 100 },
    compute: () => 0,
    comment: '延迟监控采样阈值（毫秒），0 关闭；排查延迟尖刺时设 10~100ms',
  },

  // ===== Lazy Free =====
  {
    key: 'lazyfree-lazy-eviction',
    group: 'lazyfree',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: (ctx) => ctx.scenario === 'cache' || ctx.scenario === 'mixed',
    comment: '内存淘汰时异步释放大对象，避免淘汰阻塞主线程；缓存/混合场景建议开启',
  },
  {
    key: 'lazyfree-lazy-expire',
    group: 'lazyfree',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: () => true,
    comment: '过期键删除异步化，批量过期高峰不卡主线程，通用收益',
  },
  {
    key: 'lazyfree-lazy-server-del',
    group: 'lazyfree',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: (ctx) => ctx.scenario !== 'cache',
    comment: 'RENAME/覆盖等隐式删除目标大键时异步释放；队列与会话场景建议开启',
  },
  {
    key: 'lazyfree-lazy-user-del',
    group: 'lazyfree',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'switch',
    compute: (ctx) => ctx.scenario !== 'cache',
    comment: 'DEL 命令统一为异步释放（语义同 UNLINK），大 key 删除不阻塞',
  },

  // ===== 键空间 =====
  {
    key: 'notify-keyspace-events',
    group: 'keyspace',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.keyspace,
    control: 'multi-select',
    options: [
      { value: 'K', label: 'K — 键空间通知（发布键名）' },
      { value: 'E', label: 'E — 键事件通知（发布事件名）' },
      { value: 'g', label: 'g — 通用命令事件（DEL/EXPIRE/RENAME 等）' },
      { value: '$', label: '$ — 字符串命令' },
      { value: 'l', label: 'l — 列表命令' },
      { value: 's', label: 's — 集合命令' },
      { value: 'h', label: 'h — 哈希命令' },
      { value: 'z', label: 'z — 有序集合命令' },
      { value: 't', label: 't — 流命令' },
      { value: 'x', label: 'x — 过期事件' },
      { value: 'e', label: 'e — 内存驱逐事件' },
      { value: 'A', label: 'A — 除 K 外全部事件的别名' },
    ],
    compute: computeNotifyKeyspaceEvents,
    comment: '键空间通知键位组合；会话场景常开 Ex 监听过期，空串表示关闭',
  },
  {
    key: 'active-expire-effort',
    group: 'keyspace',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 1,
    max: 10,
    step: 1,
    range: { conservative: 1, recommended: 1, aggressive: 5 },
    compute: () => 1,
    comment: '主动过期扫描力度（1~10），越大过期越及时但越耗 CPU；默认 1 足够',
  },
  {
    key: 'databases',
    group: 'keyspace',
    introducedIn: 'pre-7',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 1,
    max: 256,
    step: 1,
    range: { conservative: 16, recommended: 16, aggressive: 64 },
    compute: () => 16,
    comment: '逻辑库数量（SELECT 0~N-1）；默认 16 足够，仅启动时可设',
  },

  // ===== 旧名别名（仅数据登记溯源/测试用：7.0 改名，旧名以 alias 保留兼容，不进面板不写 conf） =====
  {
    key: 'hash-max-ziplist-entries',
    group: 'encoding',
    introducedIn: 'pre-7',
    deprecatedIn: '7.0',
    replacedBy: 'hash-max-listpack-entries',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 1024,
    step: 32,
    compute: () => null,
    comment: '7.0 改名为 hash-max-listpack-entries，旧名以别名保留兼容',
  },
  {
    key: 'hash-max-ziplist-value',
    group: 'encoding',
    introducedIn: 'pre-7',
    deprecatedIn: '7.0',
    replacedBy: 'hash-max-listpack-value',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 512,
    step: 8,
    compute: () => null,
    comment: '7.0 改名为 hash-max-listpack-value，旧名以别名保留兼容',
  },
  {
    key: 'list-max-ziplist-size',
    group: 'encoding',
    introducedIn: 'pre-7',
    deprecatedIn: '7.0',
    replacedBy: 'list-max-listpack-size',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: -5,
    max: 512,
    step: 1,
    compute: () => null,
    comment: '7.0 改名为 list-max-listpack-size，旧名以别名保留兼容',
  },
  {
    key: 'zset-max-ziplist-entries',
    group: 'encoding',
    introducedIn: 'pre-7',
    deprecatedIn: '7.0',
    replacedBy: 'zset-max-listpack-entries',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 512,
    step: 16,
    compute: () => null,
    comment: '7.0 改名为 zset-max-listpack-entries，旧名以别名保留兼容',
  },
  {
    key: 'zset-max-ziplist-value',
    group: 'encoding',
    introducedIn: 'pre-7',
    deprecatedIn: '7.0',
    replacedBy: 'zset-max-listpack-value',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 0,
    max: 256,
    step: 8,
    compute: () => null,
    comment: '7.0 改名为 zset-max-listpack-value，旧名以别名保留兼容',
  },
  {
    key: 'lua-time-limit',
    group: 'buffers',
    introducedIn: 'pre-7',
    deprecatedIn: '7.0',
    replacedBy: 'busy-reply-threshold',
    docUrl: DOC_URLS.config,
    control: 'number',
    min: 100,
    max: 60000,
    step: 100,
    compute: () => null,
    comment: '7.0 改名为 busy-reply-threshold，旧名以别名保留兼容',
  },
];

/** 按 key 查找参数定义 */
export function getParam(key: string): ConfigParam | undefined {
  return CONFIG_PARAMS.find((p) => p.key === key);
}

/** 数值参数的单位后缀词汇表（redis 与 mysql 键全量合并后上浮共享层，此处 re-export 保持既有 import 路径） */
export { PARAM_UNITS } from '../../../components/config/types';

/** 场景选项中文标签（conf 头部注释与 ControlPanel 共用） */
export const SCENARIO_LABELS: Record<GenerateContext['scenario'], string> = {
  cache: '缓存',
  session: '会话',
  queue: '队列',
  mixed: '混合',
};

/** 持久化策略中文标签（conf 头部注释用，短语形式） */
export const PERSISTENCE_LABELS: Record<GenerateContext['persistence'], string> = {
  rdb: 'RDB',
  aof: 'AOF',
  both: 'RDB+AOF',
  off: '关闭',
};

/**
 * 创建默认生成上下文（打开即用的推荐画像：2 核 / 4GB / SSD / 缓存 / RDB+AOF 混合 / 7.4 / 并发 500 / 单机）。
 * 每次调用返回全新对象，供初始渲染与重置使用。
 * @returns 全新的 GenerateContext
 */
export function createDefaultContext(): GenerateContext {
  return {
    mode: 'standalone',
    cpuCores: 2,
    memoryGB: 4,
    diskType: 'ssd',
    scenario: 'cache',
    persistence: 'both',
    version: '7.4',
    concurrency: 500,
    masterAddr: '',
    listenScope: 'all',
    bindIp: '',
    overrides: {},
  };
}
