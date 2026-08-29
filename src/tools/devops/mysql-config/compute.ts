/**
 * 场景/硬件画像 → 参数默认值的公式层（纯函数）。
 *
 * 所有函数只依赖 GenerateContext，不感知 UI 与 Vue，便于单测。
 * 数值单位约定：内存尺寸一律 MB（渲染层带 'M' 后缀写入 conf），
 * buffer pool / redo 按整 GB 向下取整（MySQL 尺寸字面量不接受小数 G，
 * 小于 1GB 时退到 128M 下限）。
 */
import type { GenerateContext } from './params';

/** 专用服务器基准：buffer pool 占物理内存比例（给页缓存与连接缓冲留余量） */
const BASE_POOL_FACTOR = 0.6;
/** 读多写少场景系数：读路径更依赖 buffer pool，可再抬高一档 */
const READ_HEAVY_POOL_FACTOR = 0.7;
/** HDD 上限系数：机械盘读放大依赖 OS 页缓存，buffer pool 最多占一半 */
const HDD_POOL_FACTOR_CAP = 0.5;
/** buffer pool 下限（mb）：对应 0.125GB，避免小内存机器出现 0 */
const BUFFER_POOL_FLOOR_MB = 128;
/** 每连接内存基线（mb，粗估常数）：连接级缓冲参数不进注册表，max_connections 折算与内存账单均用它 */
const CONNECTION_BASELINE_MB = 2;
/** redo log 单文件上限（mb）：旧版 log file size 与 8.4 等价总容量共用 */
const REDO_SIZE_CAP_MB = 4096;

/**
 * 计算 buffer pool 占物理内存的系数：专用服务器基准 0.6，读多写少抬到 0.7，
 * HDD 封顶 0.5（给 OS 页缓存留读前读空间）。
 * @param ctx - 生成上下文
 * @returns 内存占用系数
 */
export function computeBufferPoolFactor(ctx: GenerateContext): number {
  const base = ctx.scenario === 'read-heavy' ? READ_HEAVY_POOL_FACTOR : BASE_POOL_FACTOR;
  return ctx.diskType === 'hdd' ? Math.min(base, HDD_POOL_FACTOR_CAP) : base;
}

/**
 * 计算 innodb_buffer_pool_size 默认值（mb）：物理内存 × 系数向下取整 GB，
 * 取整后不足 1GB 时退到 128M 下限。
 * @param ctx - 生成上下文
 * @returns buffer pool 尺寸（mb）
 */
export function computeBufferPoolMB(ctx: GenerateContext): number {
  const gb = Math.floor(ctx.memoryGB * computeBufferPoolFactor(ctx));
  return gb >= 1 ? gb * 1024 : BUFFER_POOL_FLOOR_MB;
}

/**
 * 计算 innodb_buffer_pool_instances 默认值：8.0 及以前沿用官方默认规则——
 * pool ≥ 1GB 取 8（降低多线程页竞争），< 1GB 时该选项不生效（服务器按 1 处理）。
 * @param ctx - 生成上下文
 * @returns buffer pool 实例数
 */
export function computeBufferPoolInstances(ctx: GenerateContext): number {
  return computeBufferPoolMB(ctx) >= 1024 ? 8 : 1;
}

/**
 * 计算 max_connections 默认值：并发预估 ×1.2 上取整，同时受内存折算上限约束
 * （buffer pool 之外可用内存 ÷ 每连接基线约 2MB，防止内存超卖）。
 * @param ctx - 生成上下文
 * @returns max_connections 值
 */
export function computeMaxConnections(ctx: GenerateContext): number {
  const poolMB = computeBufferPoolMB(ctx);
  const availableMB = Math.max(ctx.memoryGB * 1024 - poolMB, 0);
  const connectionCap = Math.floor(availableMB / CONNECTION_BASELINE_MB);
  return Math.min(Math.ceil(ctx.concurrency * 1.2), connectionCap);
}

/**
 * 计算 innodb_flush_log_at_trx_commit 默认值："双 1"矩阵的 redo 侧。
 * 通用场景 1（每次提交刷盘，数据安全）；写密集降为 2（每秒刷，崩溃可能丢 1 秒事务）。
 * @param ctx - 生成上下文
 * @returns 枚举值（'1' / '2'）
 */
export function computeFlushLogAtTrxCommit(ctx: GenerateContext): '1' | '2' {
  return ctx.scenario === 'write-heavy' ? '2' : '1';
}

/**
 * 计算 sync_binlog 默认值："双 1"矩阵的 binlog 侧。通用场景 1（每次提交刷 binlog）；
 * 写密集降为 100（批量刷盘换吞吐，与 redo 侧 2 配套）。
 * @param ctx - 生成上下文
 * @returns 枚举值（'1' / '100'）
 */
export function computeSyncBinlog(ctx: GenerateContext): '1' | '100' {
  return ctx.scenario === 'write-heavy' ? '100' : '1';
}

/**
 * 计算 innodb_log_file_size 默认值（mb，5.7/8.0 轴）：< 8G 内存 512M、8-32G 1G、
 * ≥ 32G 2G，写密集场景翻倍给高频写留检查点空间，上限 4G。
 * @param ctx - 生成上下文
 * @returns 单个 redo log 文件尺寸（mb）
 */
export function computeLogFileSizeMB(ctx: GenerateContext): number {
  const base = ctx.memoryGB < 8 ? 512 : ctx.memoryGB < 32 ? 1024 : 2048;
  const scaled = ctx.scenario === 'write-heavy' ? base * 2 : base;
  return Math.min(scaled, REDO_SIZE_CAP_MB);
}

/**
 * 计算 innodb_redo_log_capacity 默认值（mb，8.4 轴）：8.4 起以总容量取代
 * "文件数 × 单文件"模型，取等价总容量（≈2 × log_file_size 的 1G/2G/4G 阶梯，
 * 内存档位与 computeLogFileSizeMB 对齐）。
 * @param ctx - 生成上下文
 * @returns redo log 总容量（mb）
 */
export function computeRedoCapacityMB(ctx: GenerateContext): number {
  const base = ctx.memoryGB < 8 ? 1024 : ctx.memoryGB < 32 ? 2048 : 4096;
  const scaled = ctx.scenario === 'write-heavy' ? base * 2 : base;
  return Math.min(scaled, REDO_SIZE_CAP_MB);
}

/** 磁盘画像 → innodb_io_capacity / _max 映射（保守值，8.4 官方默认大幅上调但保守值跨版本安全） */
const IO_CAPACITY_BY_DISK: Record<GenerateContext['diskType'], { base: number; max: number }> = {
  hdd: { base: 200, max: 400 },
  ssd: { base: 2000, max: 4000 },
  nvme: { base: 4000, max: 8000 },
};

/**
 * 计算 innodb_io_capacity 默认值：按磁盘类型的后台刷脏 IOPS 基准。
 * @param ctx - 生成上下文
 * @returns io capacity 基准值
 */
export function computeIoCapacity(ctx: GenerateContext): number {
  return IO_CAPACITY_BY_DISK[ctx.diskType].base;
}

/**
 * 计算 innodb_io_capacity_max 默认值：检查点积压时的 IOPS 突发上限（基准 ×2）。
 * @param ctx - 生成上下文
 * @returns io capacity 上限值
 */
export function computeIoCapacityMax(ctx: GenerateContext): number {
  return IO_CAPACITY_BY_DISK[ctx.diskType].max;
}

/**
 * 计算 transaction_isolation 默认值：分析报表场景降为 READ-COMMITTED
 * （减少 gap lock，长分析查询不易互相阻塞），其余保持官方默认 REPEATABLE-READ。
 * @param ctx - 生成上下文
 * @returns 隔离级别枚举值
 */
export function computeTransactionIsolation(ctx: GenerateContext): string {
  return ctx.scenario === 'analytics' ? 'READ-COMMITTED' : 'REPEATABLE-READ';
}

/**
 * 计算 bind-address 推荐值：仅本机绑回环、仅内网绑指定 IP（未填时返回空串，
 * 由 UI 校验兜底）；所有接口不输出该行——默认值 * 即监听全部接口且含 IPv6，
 * 显式 0.0.0.0 反而只绑 IPv4。
 * @param ctx - 生成上下文
 * @returns IP 串；null 表示该行不输出；空串表示待填
 */
export function computeBindAddress(ctx: GenerateContext): string | null {
  if (ctx.listenScope === 'loopback') return '127.0.0.1';
  if (ctx.listenScope === 'intranet') return ctx.bindIp.trim();
  return null;
}

/**
 * 计算 default_authentication_plugin 默认值：5.7 默认 mysql_native_password、
 * 8.0 默认 caching_sha2_password（8.4 轴参数整体移除，由 isAvailable 过滤）。
 * @param ctx - 生成上下文
 * @returns 认证插件枚举值
 */
export function computeAuthenticationPlugin(ctx: GenerateContext): string {
  return ctx.version === '5.7' ? 'mysql_native_password' : 'caching_sha2_password';
}

/**
 * 计算 long_query_time 默认值（秒）：官方默认 10 在生产基本等于关掉慢查日志。
 * 分析报表查询天然较慢抬到 3 减少噪音，写密集对延迟最敏感压到 0.5，其余 1。
 * @param ctx - 生成上下文
 * @returns 慢查询阈值（秒）
 */
export function computeLongQueryTime(ctx: GenerateContext): number {
  switch (ctx.scenario) {
    case 'analytics':
      return 3;
    case 'write-heavy':
      return 0.5;
    default:
      return 1;
  }
}
