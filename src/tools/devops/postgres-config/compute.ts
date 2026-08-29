/**
 * 场景/硬件画像 → 参数推荐值的公式层（纯函数）。
 *
 * 逐条实现 design §6 计算公式表；所有函数只依赖 GenerateContext，
 * 不感知 UI 与 Vue，便于单测。数值单位约定：内存尺寸一律 MB
 * （渲染层带 'MB' 后缀写入 conf），PL/优化器浮点参数返回 number
 * （如 random_page_cost 的 4 渲染为 `random_page_cost = 4`，与 4.0 等价），
 * 枚举/时间档位返回字符串字面量（如 '15min'、'pglz'）。
 */
import type { GenerateContext } from './params';

/** shared_buffers 占物理内存比例：官方文档"专用服务器从 25% 起步"口径 */
const SHARED_BUFFERS_FACTOR = 0.25;
/** shared_buffers 下限（mb）：官方默认 128MB，避免小内存机器出现异常小值 */
const SHARED_BUFFERS_FLOOR_MB = 128;
/** shared_buffers 取整粒度（mb）：128MB 整数倍向下取整 */
const SHARED_BUFFERS_STEP_MB = 128;
/** effective_cache_size 占物理内存比例：官方口径 50%~75%，取中 60% */
const EFFECTIVE_CACHE_FACTOR = 0.6;
/** work_mem 上限（mb）：每操作配额语义下防高并发聚合放大，封顶 64 */
const WORK_MEM_CAP_MB = 64;
/** maintenance_work_mem 下限（mb）：VACUUM/建索引低于 128MB 没有实用意义 */
const MAINTENANCE_WORK_MEM_FLOOR_MB = 128;
/** maintenance_work_mem 上限（mb）：autovacuum 每 worker 各持一份，防聚合超卖 */
const MAINTENANCE_WORK_MEM_CAP_MB = 2048;
/** 内存折算的 max_connections 封顶系数：每 GB 内存承载 25 连接（4GB → 100 即官方默认） */
const CONNECTIONS_PER_GB = 25;
/** max_connections 下限：并发预估再小也保留 20 连接可用 */
const CONNECTIONS_FLOOR = 20;
/** max_wal_size 上限（mb）：写密集翻倍后的封顶，防 pg_wal 无限膨胀 */
const MAX_WAL_SIZE_CAP_MB = 8192;
/** min_wal_size 下限（mb）：官方默认 80MB（5 个 WAL 段） */
const MIN_WAL_SIZE_FLOOR_MB = 80;

/**
 * 计算 shared_buffers 默认值（mb）：物理内存 × 25%，按 128MB 整数倍向下取整，
 * 下限 128MB。官方文档明确建议专用服务器从 25% 起步（"不超过 40%"是社区口径），
 * 其余内存留给 OS 页缓存。
 * @param ctx - 生成上下文
 * @returns shared_buffers 尺寸（mb）
 */
export function computeSharedBuffersMB(ctx: GenerateContext): number {
  const raw = ctx.memoryGB * 1024 * SHARED_BUFFERS_FACTOR;
  return Math.max(
    SHARED_BUFFERS_FLOOR_MB,
    Math.floor(raw / SHARED_BUFFERS_STEP_MB) * SHARED_BUFFERS_STEP_MB,
  );
}

/**
 * 计算 effective_cache_size 默认值（mb）：物理内存 × 60%，向下取整。
 * 该值是优化器对"索引页可用缓存"（shared_buffers + OS 页缓存）的估算，
 * 不实际分配内存。
 * @param ctx - 生成上下文
 * @returns effective_cache_size 估算值（mb）
 */
export function computeEffectiveCacheSizeMB(ctx: GenerateContext): number {
  return Math.floor(ctx.memoryGB * 1024 * EFFECTIVE_CACHE_FACTOR);
}

/**
 * 计算 work_mem 默认值（mb）：内存 < 16G 取 8、≥ 16G 取 16；分析报表场景 ×4
 * （复杂排序/哈希更多）；上限 64MB。work_mem 是"每个排序/哈希操作"的配额，
 * 官方文档明确提示总占用可达该值的数倍，故保守起步防 OOM。
 * @param ctx - 生成上下文
 * @returns work_mem 配额（mb）
 */
export function computeWorkMemMB(ctx: GenerateContext): number {
  const base = ctx.memoryGB < 16 ? 8 : 16;
  const scaled = ctx.scenario === 'analytics' ? base * 4 : base;
  return Math.min(scaled, WORK_MEM_CAP_MB);
}

/**
 * 计算 maintenance_work_mem 默认值（mb）：物理内存 × 5% 向下取整后
 * clamp 到 [128, 2048]。VACUUM/CREATE INDEX 等维护操作使用；autovacuum
 * 工作进程各持一份（官方文档提醒总量可达 autovacuum_max_workers 倍），故封顶 2GB。
 * @param ctx - 生成上下文
 * @returns maintenance_work_mem 配额（mb）
 */
export function computeMaintenanceWorkMemMB(ctx: GenerateContext): number {
  const raw = Math.floor(ctx.memoryGB * 1024 * 0.05);
  return Math.min(Math.max(raw, MAINTENANCE_WORK_MEM_FLOOR_MB), MAINTENANCE_WORK_MEM_CAP_MB);
}

/**
 * 计算 max_connections 默认值：并发预估 ×1.2 后向上取整到 10 的倍数，
 * 同时受内存折算封顶（内存 GB × 25，4GB 恰好 100 即官方默认），
 * 下限 20。封顶防连接内存超卖——扩连接前应优先考虑连接池。
 * @param ctx - 生成上下文
 * @returns max_connections 值
 */
export function computeMaxConnections(ctx: GenerateContext): number {
  const byConcurrency = Math.ceil((ctx.concurrency * 1.2) / 10) * 10;
  const byMemory = ctx.memoryGB * CONNECTIONS_PER_GB;
  return Math.max(CONNECTIONS_FLOOR, Math.min(byConcurrency, byMemory));
}

/**
 * 计算 max_wal_size 默认值（mb）：< 8G 内存 1024、8–32G 2048、≥ 32G 4096；
 * 写密集场景 ×2 给高频写留检查点空间，上限 8192。该值是检查点触发的软上限，
 * 调大以拉长检查点间隔、减少刷盘抖动。
 * @param ctx - 生成上下文
 * @returns max_wal_size 尺寸（mb）
 */
export function computeMaxWalSizeMB(ctx: GenerateContext): number {
  const base = ctx.memoryGB < 8 ? 1024 : ctx.memoryGB < 32 ? 2048 : 4096;
  const scaled = ctx.scenario === 'write-heavy' ? base * 2 : base;
  return Math.min(scaled, MAX_WAL_SIZE_CAP_MB);
}

/**
 * 计算 min_wal_size 默认值（mb）：max_wal_size 的 1/8，下限 80MB（官方默认）。
 * 保持与 max_wal_size 的比例，避免高峰期反复创建/删除 WAL 段文件。
 * @param ctx - 生成上下文
 * @returns min_wal_size 尺寸（mb）
 */
export function computeMinWalSizeMB(ctx: GenerateContext): number {
  return Math.max(MIN_WAL_SIZE_FLOOR_MB, Math.floor(computeMaxWalSizeMB(ctx) / 8));
}

/**
 * 计算 max_worker_processes 默认值：max(8, CPU 核数)。官方默认 8 起步，
 * 它是并行查询、逻辑复制等所有后台 worker 的总池子；备库该值必须 ≥ 主库。
 * @param ctx - 生成上下文
 * @returns max_worker_processes 值
 */
export function computeWorkerProcesses(ctx: GenerateContext): number {
  return Math.max(8, ctx.cpuCores);
}

/**
 * 计算 max_parallel_workers 默认值：max(2, CPU 核数 − 1)，为主进程留一个核的余量。
 * 恒不大于 computeWorkerProcesses（并行 worker 从 max_worker_processes 池中分配）。
 * @param ctx - 生成上下文
 * @returns max_parallel_workers 值
 */
export function computeParallelWorkers(ctx: GenerateContext): number {
  return Math.max(2, ctx.cpuCores - 1);
}

/**
 * 计算 max_parallel_workers_per_gather 默认值：min(4, max(1, ⌊并行 worker 数 / 2⌋))。
 * 单个 Gather 节点并行过多会挤占 OLTP 小查询的 worker 配额，上限 4。
 * @param ctx - 生成上下文
 * @returns max_parallel_workers_per_gather 值
 */
export function computeParallelPerGather(ctx: GenerateContext): number {
  return Math.min(4, Math.max(1, Math.floor(computeParallelWorkers(ctx) / 2)));
}

/**
 * 计算 jit 推荐值：OLTP 短查询的 JIT 编译开销常超收益（官方 jit-decision 文档）
 * 显式关闭；读多写少/写密集/分析场景存在长查询，保持官方默认 on。
 * @param ctx - 生成上下文
 * @returns jit 开关（on/off 由渲染层转写）
 */
export function computeJit(ctx: GenerateContext): boolean {
  return ctx.scenario !== 'oltp';
}

/** 磁盘画像 → random_page_cost 映射：官方默认 4.0 按 HDD 估，SSD/NVMe 取社区常见建议值 */
const RANDOM_PAGE_COST_BY_DISK: Record<GenerateContext['diskType'], number> = {
  hdd: 4,
  ssd: 1.5,
  nvme: 1.1,
};

/**
 * 计算 random_page_cost 默认值：HDD 4.0（官方默认）、SSD 1.5、NVMe 1.1。
 * 调低会让优化器更倾向索引扫描；官方文档未给 SSD 推荐值，数值属社区惯例。
 * @param ctx - 生成上下文
 * @returns random_page_cost 系数
 */
export function computeRandomPageCost(ctx: GenerateContext): number {
  return RANDOM_PAGE_COST_BY_DISK[ctx.diskType];
}

/**
 * 计算 effective_io_concurrency 默认值：SSD/NVMe → 200（预读并发提示，
 * 社区常用建议值）；HDD 保持低值——16/17 默认 1、18 官方上调默认至 16，
 * 按目标版本跟随，尊重 18 新默认。
 * @param ctx - 生成上下文
 * @returns effective_io_concurrency 值
 */
export function computeIoConcurrency(ctx: GenerateContext): number {
  if (ctx.diskType !== 'hdd') return 200;
  return ctx.version === '18' ? 16 : 1;
}

/**
 * 计算 default_statistics_target 默认值：分析报表场景 200（复杂查询的
 * 计划质量收益），其余保持官方默认 100。
 * @param ctx - 生成上下文
 * @returns default_statistics_target 值
 */
export function computeStatisticsTarget(ctx: GenerateContext): number {
  return ctx.scenario === 'analytics' ? 200 : 100;
}

/**
 * 计算 huge_pages 推荐值：内存 < 16G → 'off'（有意收紧，避免小内存机器
 * 预留大页失败或浪费；官方默认 try），≥ 16G → 'try'（尽力使用显式 hugetlbfs
 * 大页，失败自动回退普通页）。try/on 指显式大页，与透明大页 THP 无关。
 * @param ctx - 生成上下文
 * @returns huge_pages 枚举值（off/try）
 */
export function computeHugePages(ctx: GenerateContext): 'off' | 'try' {
  return ctx.memoryGB < 16 ? 'off' : 'try';
}

/**
 * 计算 wal_compression 推荐值：写密集 → 'pglz'（压缩满页写，CPU 换 WAL 体积
 * 与网络传输），其余保持官方默认 'off'。'on' 是 pglz 的历史别名，不输出。
 * @param ctx - 生成上下文
 * @returns wal_compression 枚举值（off/pglz）
 */
export function computeWalCompression(ctx: GenerateContext): 'off' | 'pglz' {
  return ctx.scenario === 'write-heavy' ? 'pglz' : 'off';
}

/**
 * 计算 checkpoint_timeout 推荐值：写密集 → '15min'（拉长检查点间隔减少
 * 全量刷脏频率），其余保持官方默认 '5min'。更长间隔意味着崩溃恢复更慢。
 * @param ctx - 生成上下文
 * @returns checkpoint_timeout 时间档位
 */
export function computeCheckpointTimeout(ctx: GenerateContext): '5min' | '15min' {
  return ctx.scenario === 'write-heavy' ? '15min' : '5min';
}

/**
 * 计算 autovacuum_vacuum_scale_factor 推荐值：写密集 → '0.05'（死元组 5%
 * 即触发，避免大表 20% 积压），其余保持官方默认 '0.2'。
 * @param ctx - 生成上下文
 * @returns scale_factor 档位
 */
export function computeAutovacuumScaleFactor(ctx: GenerateContext): '0.05' | '0.2' {
  return ctx.scenario === 'write-heavy' ? '0.05' : '0.2';
}

/**
 * 计算 autovacuum_vacuum_cost_limit 推荐值：写密集 → 2000（官方默认 200
 * 过于保守会导致清理跟不上写入），其余保持 200。
 * @param ctx - 生成上下文
 * @returns cost_limit 值
 */
export function computeAutovacuumCostLimit(ctx: GenerateContext): number {
  return ctx.scenario === 'write-heavy' ? 2000 : 200;
}

/**
 * 计算 listen_addresses 推荐值：仅本机 → 'localhost'、仅内网 → 绑定 IP
 * （trim 后为空返回空串，由渲染层省略该行）、所有接口 → '*'。
 * 放开远程监听必须配合 pg_hba.conf 地址白名单与口令认证。
 * @param ctx - 生成上下文
 * @returns listen_addresses 值；空串表示待填（渲染层跳过）
 */
export function computeListenAddresses(ctx: GenerateContext): string {
  if (ctx.listenScope === 'loopback') return 'localhost';
  if (ctx.listenScope === 'intranet') return ctx.bindIp.trim();
  return '*';
}
