/**
 * 配置生成器系列共享类型（redis / mysql / postgres 等工具的上浮契约）。
 *
 * 采用扩展式契约：此处只定义两工具现有字段的并集基类，工具侧以
 * `interface ConfigParam extends ConfigParamBase` 保留 introducedIn/deprecatedIn
 * 的窄化版本枚举并补齐 group / compute / valueSuffix 等工具专有字段——
 * compute 的上下文类型各工具不同，留在工具侧，本模块零行为逻辑。
 * 字段名与 redis-config / mysql-config 既有代码一致，禁止改名。
 */

/** conf 单行结构（redis 的 comment/directive/blank 与 mysql 额外 section 的四值并集） */
export interface ConfLine {
  /** 行类型：注释 / 指令 / 段头 / 空行 */
  type: 'comment' | 'directive' | 'section' | 'blank';
  /** 行文本（注释行含 '#' 前缀，段头为 '[mysqld]' 等，空行为空串） */
  text: string;
  /** 指令所属参数 key（预览按此高亮变动行） */
  paramKey?: string;
}

/** 参数值类型（overrides 与 compute 的统一载荷，跨工具并集） */
export type ParamValue = string | number | boolean | string[];

/** 枚举选项（select / multi-select 用），label 附中文说明 */
export interface ParamOption {
  /** 选项值（写入 conf 的原始值） */
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
 * 参数定义基类：字段名与两工具现有代码一致。
 * 工具侧 extends 后补 group / compute / valueSuffix 等专有字段，
 * 并可将 introducedIn / deprecatedIn / docUrl 窄化为工具版本枚举与必填。
 */
export interface ConfigParamBase {
  /** 参数名（写入 conf 的 key，如 'maxmemory'） */
  key: string;
  /** 为什么是这个值的中文说明（仅面板展示，不写入 conf） */
  comment: string;
  /** 控件类型 */
  control: 'number' | 'select' | 'multi-select' | 'switch' | 'text';
  /** 引入版本（与 baselineVersion 相同时徽章隐藏） */
  introducedIn: string;
  /** 标记废弃的版本（弃用提示行依据） */
  deprecatedIn?: string;
  /** 替代参数 key（废弃提示用） */
  replacedBy?: string;
  /** 密码类文本参数：控件旁提供"生成"按钮（点击 emit generate-secret，生成逻辑留在页面侧） */
  secret?: boolean;
  /** 数值输入最小值（失焦 clamp 下界） */
  min?: number;
  /** 数值输入最大值（失焦 clamp 上界） */
  max?: number;
  /** 数值输入步长（透传 input，供方向键增量） */
  step?: number;
  /** 枚举选项（select / multi-select 用） */
  options?: ParamOption[];
  /** 推荐范围（连续数值参数可选） */
  range?: ParamRange;
  /** 官方文档链接（取值须在各工具 DOC_URLS 白名单域名内） */
  docUrl?: string;
}

/**
 * 数值参数的单位后缀词汇表（NumberField 输入框旁展示用，key → 单位文案；未列出则不带单位）。
 * redis 连字符小写键与 mysql 下划线小写键全量并存，无同名冲突；新工具新增键自选一种风格保持一致。
 */
export const PARAM_UNITS: Record<string, string> = {
  // redis（连字符小写键）
  'tcp-keepalive': '秒',
  timeout: '秒',
  maxclients: '连接',
  'max-new-connections-per-cycle': '个/周期',
  maxmemory: 'mb',
  'maxmemory-samples': '个',
  'io-threads': '线程',
  'auto-aof-rewrite-percentage': '%',
  'auto-aof-rewrite-min-size': 'mb',
  'hash-max-listpack-entries': '个',
  'hash-max-listpack-value': '字节',
  'zset-max-listpack-entries': '个',
  'zset-max-listpack-value': '字节',
  'set-max-listpack-entries': '个',
  'set-max-listpack-value': '字节',
  'set-max-intset-entries': '个',
  'repl-backlog-size': 'mb',
  'min-replicas-to-write': '个',
  'min-replicas-max-lag': '秒',
  'replica-full-sync-buffer-limit': 'mb',
  'busy-reply-threshold': 'ms',
  'slowlog-log-slower-than': 'µs',
  'slowlog-max-len': '条',
  'latency-monitor-threshold': 'ms',
  'active-expire-effort': '级',
  databases: '个',
  // mysql（下划线小写键）
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
  // postgres（下划线小写键；port/max_connections 复用 mysql 已有键，不重复列出）
  superuser_reserved_connections: '连接',
  shared_buffers: 'MB',
  effective_cache_size: 'MB',
  work_mem: 'MB',
  maintenance_work_mem: 'MB',
  max_wal_size: 'MB',
  min_wal_size: 'MB',
  wal_keep_size: 'MB',
  max_worker_processes: '进程',
  max_parallel_workers: '进程',
  max_parallel_workers_per_gather: '进程',
  autovacuum_max_workers: '进程',
  io_workers: '进程',
};
