/**
 * PostgreSQL 配置生成器公式层单元测试（compute.ts）。
 * design §6 公式表逐条验证：内存阶梯边界、write-heavy 翻倍与封顶、
 * cpuCores=1 / memoryGB=1 下限、16/17 与 18 的 effective_io_concurrency 版本差异，
 * 以及并行组"恒 ≤ worker_processes"不变量。
 */
import { describe, it, expect } from 'vitest';
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
} from '../compute';
import { createDefaultContext, getParam, type GenerateContext } from '../params';
import { resolveValue } from '../generate';

/** 以默认画像为基础覆盖部分字段，构造测试上下文 */
function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return { ...createDefaultContext(), ...overrides };
}

describe('computeSharedBuffersMB（RAM × 25%，128MB 整数倍向下，下限 128）', () => {
  it('按内存分档：4G→1024、16G→4096、64G→16384', () => {
    expect(computeSharedBuffersMB(ctx({ memoryGB: 4 }))).toBe(1024);
    expect(computeSharedBuffersMB(ctx({ memoryGB: 16 }))).toBe(4096);
    expect(computeSharedBuffersMB(ctx({ memoryGB: 64 }))).toBe(16384);
  });

  it('下限 128 与 128MB 整数倍取整（小内存与奇数内存档）', () => {
    expect(computeSharedBuffersMB(ctx({ memoryGB: 1 }))).toBe(256); // 0.25GB ≥ 128MB
    expect(computeSharedBuffersMB(ctx({ memoryGB: 3 }))).toBe(768); // 0.75G → 768（128 的 6 倍）
  });
});

describe('computeEffectiveCacheSizeMB（RAM × 60% 向下取整）', () => {
  it('4G→2457、16G→9830、64G→39321', () => {
    expect(computeEffectiveCacheSizeMB(ctx({ memoryGB: 4 }))).toBe(2457); // 2457.6 → 2457
    expect(computeEffectiveCacheSizeMB(ctx({ memoryGB: 16 }))).toBe(9830); // 9830.4 → 9830
    expect(computeEffectiveCacheSizeMB(ctx({ memoryGB: 64 }))).toBe(39321); // 39321.6 → 39321
  });
});

describe('computeWorkMemMB（<16G→8、≥16G→16；analytics ×4；上限 64）', () => {
  it('内存档位：4G→8、16G→16、64G→16', () => {
    expect(computeWorkMemMB(ctx({ memoryGB: 4 }))).toBe(8);
    expect(computeWorkMemMB(ctx({ memoryGB: 16 }))).toBe(16);
    expect(computeWorkMemMB(ctx({ memoryGB: 64 }))).toBe(16);
  });

  it('analytics ×4 且封顶 64：4G→32、16G→64、64G→64', () => {
    expect(computeWorkMemMB(ctx({ memoryGB: 4, scenario: 'analytics' }))).toBe(32);
    expect(computeWorkMemMB(ctx({ memoryGB: 16, scenario: 'analytics' }))).toBe(64);
    expect(computeWorkMemMB(ctx({ memoryGB: 64, scenario: 'analytics' }))).toBe(64);
  });
});

describe('computeMaintenanceWorkMemMB（clamp(RAM × 5%, 128, 2048)）', () => {
  it('下限 128（memoryGB=1）、中段 4G→204、16G→819', () => {
    expect(computeMaintenanceWorkMemMB(ctx({ memoryGB: 1 }))).toBe(128); // 51.2 → 下限
    expect(computeMaintenanceWorkMemMB(ctx({ memoryGB: 4 }))).toBe(204); // 204.8 → 204
    expect(computeMaintenanceWorkMemMB(ctx({ memoryGB: 16 }))).toBe(819); // 819.2 → 819
  });

  it('上限 2048（64G→3276.8 → 封顶）', () => {
    expect(computeMaintenanceWorkMemMB(ctx({ memoryGB: 64 }))).toBe(2048);
  });
});

describe('computeMaxConnections（min(ceil(并发×1.2/10)×10, 内存×25)，下限 20）', () => {
  it('默认画像 4G/200 并发恰好 100（官方默认）', () => {
    expect(computeMaxConnections(ctx())).toBe(100);
  });

  it('并发驱动上取整到 10 的倍数：16G 下 200→240、500→500', () => {
    expect(computeMaxConnections(ctx({ memoryGB: 16, concurrency: 200 }))).toBe(240);
    expect(computeMaxConnections(ctx({ memoryGB: 32, concurrency: 500 }))).toBe(600);
  });

  it('内存封顶防超卖：1G 上限 25，并发再大也封顶', () => {
    expect(computeMaxConnections(ctx({ memoryGB: 1, concurrency: 200 }))).toBe(25);
    expect(computeMaxConnections(ctx({ memoryGB: 1, concurrency: 1000 }))).toBe(25);
  });

  it('下限 20：并发与内存都极小时兜底', () => {
    expect(computeMaxConnections(ctx({ memoryGB: 1, concurrency: 1 }))).toBe(20);
  });
});

describe('computeMaxWalSizeMB（<8G→1024、8–32G→2048、≥32G→4096；write-heavy ×2 上限 8192）', () => {
  it('内存阶梯边界：4G→1024、8G→2048、31G→2048、32G→4096', () => {
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 4 }))).toBe(1024);
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 8 }))).toBe(2048);
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 31 }))).toBe(2048);
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 32 }))).toBe(4096);
  });

  it('write-heavy 翻倍与 8192 封顶：4G→2048、16G→4096、64G→8192', () => {
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 4, scenario: 'write-heavy' }))).toBe(2048);
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 16, scenario: 'write-heavy' }))).toBe(4096);
    expect(computeMaxWalSizeMB(ctx({ memoryGB: 64, scenario: 'write-heavy' }))).toBe(8192);
  });
});

describe('computeMinWalSizeMB（max(80, maxWalSize/8)）', () => {
  it('与 max_wal_size 保持 1/8 比例：4G→128、16G→256、write-heavy 64G→1024', () => {
    expect(computeMinWalSizeMB(ctx({ memoryGB: 4 }))).toBe(128);
    expect(computeMinWalSizeMB(ctx({ memoryGB: 16 }))).toBe(256);
    expect(computeMinWalSizeMB(ctx({ memoryGB: 64, scenario: 'write-heavy' }))).toBe(1024);
  });

  it('下限 80 恒不小于（最小档 1024/8=128 已高于 80，公式保守保底）', () => {
    expect(computeMinWalSizeMB(ctx({ memoryGB: 1 }))).toBeGreaterThanOrEqual(80);
  });
});

describe('并行组（cpuCores 驱动，恢复的 CPU 输入是公式消费方）', () => {
  it('computeWorkerProcesses = max(8, 核数)：1 核→8、4 核→8、16 核→16', () => {
    expect(computeWorkerProcesses(ctx({ cpuCores: 1 }))).toBe(8);
    expect(computeWorkerProcesses(ctx({ cpuCores: 4 }))).toBe(8);
    expect(computeWorkerProcesses(ctx({ cpuCores: 16 }))).toBe(16);
  });

  it('computeParallelWorkers = max(2, 核数−1)：1 核→2、4 核→3、16 核→15', () => {
    expect(computeParallelWorkers(ctx({ cpuCores: 1 }))).toBe(2);
    expect(computeParallelWorkers(ctx({ cpuCores: 4 }))).toBe(3);
    expect(computeParallelWorkers(ctx({ cpuCores: 16 }))).toBe(15);
  });

  it('computeParallelPerGather = min(4, max(1, ⌊并行/2⌋))：1 核→1、4 核→1、9 核→4、128 核→4', () => {
    expect(computeParallelPerGather(ctx({ cpuCores: 1 }))).toBe(1);
    expect(computeParallelPerGather(ctx({ cpuCores: 4 }))).toBe(1);
    expect(computeParallelPerGather(ctx({ cpuCores: 9 }))).toBe(4);
    expect(computeParallelPerGather(ctx({ cpuCores: 128 }))).toBe(4);
  });

  it('不变量：任意核数下 parallel ≤ worker_processes 且 per_gather ≤ parallel', () => {
    for (let cores = 1; cores <= 128; cores++) {
      const workers = computeWorkerProcesses(ctx({ cpuCores: cores }));
      const parallel = computeParallelWorkers(ctx({ cpuCores: cores }));
      const perGather = computeParallelPerGather(ctx({ cpuCores: cores }));
      expect(parallel, `cores=${cores}`).toBeLessThanOrEqual(workers);
      expect(perGather, `cores=${cores}`).toBeLessThanOrEqual(parallel);
    }
  });
});

describe('computeJit / computeStatisticsTarget（场景联动）', () => {
  it('jit：oltp 关（短查询编译开销超收益），其余三场景 on', () => {
    expect(computeJit(ctx({ scenario: 'oltp' }))).toBe(false);
    expect(computeJit(ctx({ scenario: 'read-heavy' }))).toBe(true);
    expect(computeJit(ctx({ scenario: 'write-heavy' }))).toBe(true);
    expect(computeJit(ctx({ scenario: 'analytics' }))).toBe(true);
  });

  it('default_statistics_target：analytics 200，其余 100', () => {
    expect(computeStatisticsTarget(ctx({ scenario: 'analytics' }))).toBe(200);
    expect(computeStatisticsTarget(ctx({ scenario: 'oltp' }))).toBe(100);
    expect(computeStatisticsTarget(ctx({ scenario: 'read-heavy' }))).toBe(100);
  });
});

describe('computeRandomPageCost / computeIoConcurrency（磁盘 + 版本联动）', () => {
  it('random_page_cost：HDD 4（官方默认）、SSD 1.5、NVMe 1.1', () => {
    expect(computeRandomPageCost(ctx({ diskType: 'hdd' }))).toBe(4);
    expect(computeRandomPageCost(ctx({ diskType: 'ssd' }))).toBe(1.5);
    expect(computeRandomPageCost(ctx({ diskType: 'nvme' }))).toBe(1.1);
  });

  it('effective_io_concurrency：SSD/NVMe 恒 200，HDD 按版本 16/17→1、18→16', () => {
    expect(computeIoConcurrency(ctx({ diskType: 'ssd' }))).toBe(200);
    expect(computeIoConcurrency(ctx({ diskType: 'nvme' }))).toBe(200);
    expect(computeIoConcurrency(ctx({ diskType: 'hdd', version: '16' }))).toBe(1);
    expect(computeIoConcurrency(ctx({ diskType: 'hdd', version: '17' }))).toBe(1);
    expect(computeIoConcurrency(ctx({ diskType: 'hdd', version: '18' }))).toBe(16);
  });
});

describe('computeHugePages（<16G off 收紧、≥16G try）', () => {
  it('内存边界：4G→off、15G→off、16G→try、64G→try', () => {
    expect(computeHugePages(ctx({ memoryGB: 4 }))).toBe('off');
    expect(computeHugePages(ctx({ memoryGB: 15 }))).toBe('off');
    expect(computeHugePages(ctx({ memoryGB: 16 }))).toBe('try');
    expect(computeHugePages(ctx({ memoryGB: 64 }))).toBe('try');
  });
});

describe('WAL 与 autovacuum 的 write-heavy 联动', () => {
  it('wal_compression：write-heavy→pglz，其余 off（on 是 pglz 别名不输出）', () => {
    expect(computeWalCompression(ctx({ scenario: 'write-heavy' }))).toBe('pglz');
    expect(computeWalCompression(ctx({ scenario: 'oltp' }))).toBe('off');
    expect(computeWalCompression(ctx({ scenario: 'analytics' }))).toBe('off');
  });

  it('checkpoint_timeout：write-heavy→15min，其余 5min', () => {
    expect(computeCheckpointTimeout(ctx({ scenario: 'write-heavy' }))).toBe('15min');
    expect(computeCheckpointTimeout(ctx({ scenario: 'oltp' }))).toBe('5min');
    expect(computeCheckpointTimeout(ctx({ scenario: 'read-heavy' }))).toBe('5min');
  });

  it('autovacuum_vacuum_scale_factor：write-heavy→0.05，其余 0.2', () => {
    expect(computeAutovacuumScaleFactor(ctx({ scenario: 'write-heavy' }))).toBe('0.05');
    expect(computeAutovacuumScaleFactor(ctx({ scenario: 'oltp' }))).toBe('0.2');
    expect(computeAutovacuumScaleFactor(ctx({ scenario: 'analytics' }))).toBe('0.2');
  });

  it('autovacuum_vacuum_cost_limit：write-heavy→2000，其余 200', () => {
    expect(computeAutovacuumCostLimit(ctx({ scenario: 'write-heavy' }))).toBe(2000);
    expect(computeAutovacuumCostLimit(ctx({ scenario: 'oltp' }))).toBe(200);
    expect(computeAutovacuumCostLimit(ctx({ scenario: 'read-heavy' }))).toBe(200);
  });
});

describe('computeListenAddresses（监听范围三档）', () => {
  it('仅本机 localhost、所有接口 *', () => {
    expect(computeListenAddresses(ctx({ listenScope: 'loopback' }))).toBe('localhost');
    expect(computeListenAddresses(ctx({ listenScope: 'all' }))).toBe('*');
  });

  it('仅内网绑指定 IP（trim；未填时返回空串待渲染层省略）', () => {
    expect(computeListenAddresses(ctx({ listenScope: 'intranet', bindIp: ' 10.0.0.5 ' }))).toBe('10.0.0.5');
    expect(computeListenAddresses(ctx({ listenScope: 'intranet', bindIp: ' ' }))).toBe('');
  });
});

describe('静态项与覆盖值（resolveValue 联动）', () => {
  it('静态项返回 defaultValue：wal_buffers -1、superuser_reserved_connections 3、log_line_prefix 尾随空格保留', () => {
    expect(resolveValue(getParam('wal_buffers')!, ctx())).toBe(-1);
    expect(resolveValue(getParam('superuser_reserved_connections')!, ctx())).toBe(3);
    expect(resolveValue(getParam('log_line_prefix')!, ctx())).toBe('%m [%p] %u@%d ');
  });

  it('覆盖值优先于 compute 与 defaultValue', () => {
    expect(
      resolveValue(getParam('shared_buffers')!, ctx({ overrides: { shared_buffers: 2048 } })),
    ).toBe(2048);
    expect(
      resolveValue(getParam('superuser_reserved_connections')!, ctx({ overrides: { superuser_reserved_connections: 5 } })),
    ).toBe(5);
  });
});
