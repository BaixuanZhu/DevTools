/**
 * 场景/硬件画像 → 参数默认值的公式层（纯函数）。
 *
 * 所有函数只依赖 GenerateContext，不感知 UI 与 Vue，便于单测，
 * 也让后续 MySQL/PG 生成器复用"公式 + 参数表"的引擎模式。
 * 数值单位约定：内存尺寸一律 MB，慢查询阈值 µs，busy 阈值 ms。
 */
import type { GenerateContext } from './params';

/** 开启持久化（RDB/AOF）时 maxmemory 占物理内存系数——预留 fork 写时复制余量 */
const PERSISTENCE_FACTOR = 0.6;
/** 关闭持久化（纯缓存）时 maxmemory 占物理内存系数 */
const CACHE_ONLY_FACTOR = 0.75;
/** maxclients 下限：低于该值的容量预估无生产意义，直接取下限 */
const MAXCLIENTS_FLOOR = 1000;
/** maxclients 上限（"系统提示值"）：与 nofile 65535 及单实例承载上限对齐 */
const MAXCLIENTS_CAP = 40000;
/** 小内存机器 AOF 重写阈值（mb） */
const AOF_MIN_SIZE_SMALL = 64;
/** 大内存（≥16GB）机器 AOF 重写阈值（mb），减少重写频率 */
const AOF_MIN_SIZE_LARGE = 512;

/**
 * 计算 bind 推荐值：按监听范围映射——仅本机绑回环、仅内网绑指定 IP（未填时暂不输出）、
 * 所有接口不输出 bind 行（等价监听所有网卡，须配 requirepass 才能安全远程）。
 * @param ctx - 生成上下文
 * @returns bind 指令参数串；空串表示不输出该行
 */
export function computeBind(ctx: GenerateContext): string {
  if (ctx.listenScope === 'loopback') return '127.0.0.1 -::1';
  if (ctx.listenScope === 'intranet') return ctx.bindIp.trim();
  return '';
}

/**
 * 计算 maxmemory 默认值（mb）：物理内存 × 系数后向下取整到 GB。
 * 小内存机器取整后不足 1GB 时退到 512mb，避免出现 0。
 * @param ctx - 生成上下文
 * @returns maxmemory 值（mb）
 */
export function computeMaxMemoryMB(ctx: GenerateContext): number {
  const factor = ctx.persistence === 'off' ? CACHE_ONLY_FACTOR : PERSISTENCE_FACTOR;
  const floorGB = Math.floor(ctx.memoryGB * factor);
  return floorGB >= 1 ? floorGB * 1024 : 512;
}

/**
 * 计算 maxmemory-policy 默认值：按使用场景映射。
 * 缓存可容忍淘汰，队列绝不淘汰（noeviction 防写丢失）。
 * @param ctx - 生成上下文
 * @returns 淘汰策略枚举值
 */
export function computeMaxMemoryPolicy(ctx: GenerateContext): string {
  return ctx.scenario === 'queue' ? 'noeviction' : 'allkeys-lru';
}

/**
 * 计算 maxclients 默认值：并发预估 ×1.5 上取整，夹在 [1000, 40000] 区间。
 * 需与系统 nofile 联动（见 sysctl.ts 建议）。
 * @param ctx - 生成上下文
 * @returns maxclients 值
 */
export function computeMaxClients(ctx: GenerateContext): number {
  return Math.max(MAXCLIENTS_FLOOR, Math.min(Math.ceil(ctx.concurrency * 1.5), MAXCLIENTS_CAP));
}

/**
 * 计算 io-threads 默认值：CPU 核数 ≥8 设 4，≥4 设 2，否则 1。
 * I/O 线程化在写多读少、高并发场景才有收益。
 * @param ctx - 生成上下文
 * @returns io-threads 值
 */
export function computeIoThreads(ctx: GenerateContext): number {
  if (ctx.cpuCores >= 8) return 4;
  if (ctx.cpuCores >= 4) return 2;
  return 1;
}

/**
 * 计算 appendonly 默认值：持久化策略为 AOF 或 RDB+AOF 时开启。
 * @param ctx - 生成上下文
 * @returns 是否开启 AOF
 */
export function computeAppendonly(ctx: GenerateContext): boolean {
  return ctx.persistence === 'aof' || ctx.persistence === 'both';
}

/**
 * 计算 RDB save 阈值：关闭持久化时返回字面值 '""'（conf 输出 save "" 显式关闭
 * 快照——省略该行时编译期默认阈值仍生效），否则按场景映射——缓存稀疏、
 * 高频写（会话/队列）密集、混合用官方默认。
 * @param ctx - 生成上下文
 * @returns save 指令参数串（如 '3600 1 300 100 60 10000'），'""' 表示显式关闭快照
 */
export function computeSave(ctx: GenerateContext): string {
  if (ctx.persistence === 'off') return '""';
  switch (ctx.scenario) {
    case 'cache':
      return '300 1 60 10000';
    case 'session':
    case 'queue':
      return '300 10 60 10000';
    case 'mixed':
      return '3600 1 300 100 60 10000';
  }
}

/**
 * 计算 auto-aof-rewrite-min-size 默认值（mb）：大内存机器放宽到 512mb，
 * 减少重写频率；小内存保持 64mb 控制重写时长。
 * @param ctx - 生成上下文
 * @returns 最小重写体积（mb）
 */
export function computeAofMinSizeMB(ctx: GenerateContext): number {
  return ctx.memoryGB >= 16 ? AOF_MIN_SIZE_LARGE : AOF_MIN_SIZE_SMALL;
}

/**
 * 计算 timeout 默认值（秒）：会话型 300 秒回收空闲连接，其余不断开。
 * @param ctx - 生成上下文
 * @returns timeout 秒数
 */
export function computeTimeoutSeconds(ctx: GenerateContext): number {
  return ctx.scenario === 'session' ? 300 : 0;
}

/**
 * 计算 tcp-backlog 默认值：并发 ≥2000 提升到 2048，
 * 需同步调大内核 net.core.somaxconn（见 sysctl.ts）。
 * @param ctx - 生成上下文
 * @returns backlog 值
 */
export function computeTcpBacklog(ctx: GenerateContext): number {
  return ctx.concurrency >= 2000 ? 2048 : 511;
}

/**
 * 计算 repl-backlog-size 默认值（mb）：≥8GB 内存建议 64mb，
 * 短暂断线的副本可走增量同步而不必全量重传。
 * @param ctx - 生成上下文
 * @returns 积压缓冲大小（mb）
 */
export function computeReplBacklogMB(ctx: GenerateContext): number {
  return ctx.memoryGB >= 8 ? 64 : 16;
}

/**
 * 计算 slowlog-log-slower-than 默认值（µs）：队列对延迟最敏感（1ms），
 * 会话次之（5ms），缓存/混合用官方默认 10ms。
 * @param ctx - 生成上下文
 * @returns 慢查询阈值（微秒）
 */
export function computeSlowlogSlowerThanUs(ctx: GenerateContext): number {
  switch (ctx.scenario) {
    case 'queue':
      return 1000;
    case 'session':
      return 5000;
    default:
      return 10000;
  }
}

/**
 * 计算 slowlog-max-len 默认值：队列/混合场景加大环形队列便于回溯。
 * @param ctx - 生成上下文
 * @returns 慢查询记录条数
 */
export function computeSlowlogMaxLen(ctx: GenerateContext): number {
  return ctx.scenario === 'queue' || ctx.scenario === 'mixed' ? 512 : 128;
}

/**
 * 计算 notify-keyspace-events 默认键位：会话场景开 Ex（键事件 + 过期事件）
 * 用于监听会话过期；其余场景默认关闭。
 * @param ctx - 生成上下文
 * @returns 通知键位数组（空数组表示关闭）
 */
export function computeNotifyKeyspaceEvents(ctx: GenerateContext): string[] {
  return ctx.scenario === 'session' ? ['E', 'x'] : [];
}
