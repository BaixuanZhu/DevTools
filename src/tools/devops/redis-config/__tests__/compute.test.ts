/**
 * Redis 配置生成器公式层单元测试（compute.ts）。
 */
import { describe, it, expect } from 'vitest';
import {
  computeAofMinSizeMB,
  computeAppendonly,
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
} from '../compute';
import { createDefaultContext, type GenerateContext } from '../params';

/** 以默认画像为基础覆盖部分字段，构造测试上下文 */
function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return { ...createDefaultContext(), ...overrides };
}

describe('computeMaxMemoryMB', () => {
  it('开启持久化取物理内存的 60% 并向下取整到 GB', () => {
    expect(computeMaxMemoryMB(ctx({ memoryGB: 4, persistence: 'rdb' }))).toBe(2048);
    expect(computeMaxMemoryMB(ctx({ memoryGB: 16, persistence: 'aof' }))).toBe(9216);
    expect(computeMaxMemoryMB(ctx({ memoryGB: 64, persistence: 'both' }))).toBe(38912);
  });

  it('关闭持久化（纯缓存）取 75%', () => {
    expect(computeMaxMemoryMB(ctx({ memoryGB: 4, persistence: 'off' }))).toBe(3072);
    expect(computeMaxMemoryMB(ctx({ memoryGB: 64, persistence: 'off' }))).toBe(49152);
  });

  it('小内存取整后不足 1GB 时退到 512mb', () => {
    expect(computeMaxMemoryMB(ctx({ memoryGB: 1, persistence: 'rdb' }))).toBe(512);
  });
});

describe('computeMaxMemoryPolicy', () => {
  it('队列场景必须 noeviction 防止淘汰丢数据', () => {
    expect(computeMaxMemoryPolicy(ctx({ scenario: 'queue' }))).toBe('noeviction');
  });

  it('缓存/会话/混合场景用 allkeys-lru', () => {
    expect(computeMaxMemoryPolicy(ctx({ scenario: 'cache' }))).toBe('allkeys-lru');
    expect(computeMaxMemoryPolicy(ctx({ scenario: 'session' }))).toBe('allkeys-lru');
    expect(computeMaxMemoryPolicy(ctx({ scenario: 'mixed' }))).toBe('allkeys-lru');
  });
});

describe('computeMaxClients', () => {
  it('并发 ×1.5 上取整', () => {
    expect(computeMaxClients(ctx({ concurrency: 10000 }))).toBe(15000);
    expect(computeMaxClients(ctx({ concurrency: 1001 }))).toBe(1502);
  });

  it('低于 1000 时取下限', () => {
    expect(computeMaxClients(ctx({ concurrency: 500 }))).toBe(1000);
    expect(computeMaxClients(ctx({ concurrency: 100 }))).toBe(1000);
  });

  it('超过 40000 时封顶', () => {
    expect(computeMaxClients(ctx({ concurrency: 50000 }))).toBe(40000);
  });
});

describe('computeIoThreads', () => {
  it('核数分档：≥8 设 4、≥4 设 2、其余 1', () => {
    expect(computeIoThreads(ctx({ cpuCores: 2 }))).toBe(1);
    expect(computeIoThreads(ctx({ cpuCores: 3 }))).toBe(1);
    expect(computeIoThreads(ctx({ cpuCores: 4 }))).toBe(2);
    expect(computeIoThreads(ctx({ cpuCores: 7 }))).toBe(2);
    expect(computeIoThreads(ctx({ cpuCores: 8 }))).toBe(4);
    expect(computeIoThreads(ctx({ cpuCores: 16 }))).toBe(4);
  });
});

describe('computeAppendonly', () => {
  it('AOF 与混合模式开启，仅 RDB 与关闭时关闭', () => {
    expect(computeAppendonly(ctx({ persistence: 'aof' }))).toBe(true);
    expect(computeAppendonly(ctx({ persistence: 'both' }))).toBe(true);
    expect(computeAppendonly(ctx({ persistence: 'rdb' }))).toBe(false);
    expect(computeAppendonly(ctx({ persistence: 'off' }))).toBe(false);
  });
});

describe('computeSave', () => {
  it('关闭持久化时返回空串（conf 不输出 save）', () => {
    expect(computeSave(ctx({ persistence: 'off' }))).toBe('');
  });

  it('缓存稀疏、会话/队列密集、混合用官方默认', () => {
    expect(computeSave(ctx({ scenario: 'cache', persistence: 'rdb' }))).toBe('300 1 60 10000');
    expect(computeSave(ctx({ scenario: 'session', persistence: 'rdb' }))).toBe('300 10 60 10000');
    expect(computeSave(ctx({ scenario: 'queue', persistence: 'aof' }))).toBe('300 10 60 10000');
    expect(computeSave(ctx({ scenario: 'mixed', persistence: 'rdb' }))).toBe('3600 1 300 100 60 10000');
  });
});

describe('computeAofMinSizeMB', () => {
  it('≥16GB 内存放宽到 512mb，否则 64mb', () => {
    expect(computeAofMinSizeMB(ctx({ memoryGB: 8 }))).toBe(64);
    expect(computeAofMinSizeMB(ctx({ memoryGB: 16 }))).toBe(512);
    expect(computeAofMinSizeMB(ctx({ memoryGB: 32 }))).toBe(512);
  });
});

describe('computeTimeoutSeconds', () => {
  it('会话 300 秒，其余不断开', () => {
    expect(computeTimeoutSeconds(ctx({ scenario: 'session' }))).toBe(300);
    expect(computeTimeoutSeconds(ctx({ scenario: 'cache' }))).toBe(0);
    expect(computeTimeoutSeconds(ctx({ scenario: 'queue' }))).toBe(0);
  });
});

describe('computeTcpBacklog', () => {
  it('并发 ≥2000 提升到 2048，否则官方默认 511', () => {
    expect(computeTcpBacklog(ctx({ concurrency: 1999 }))).toBe(511);
    expect(computeTcpBacklog(ctx({ concurrency: 2000 }))).toBe(2048);
  });
});

describe('computeReplBacklogMB', () => {
  it('≥8GB 内存 64mb，否则 16mb', () => {
    expect(computeReplBacklogMB(ctx({ memoryGB: 7 }))).toBe(16);
    expect(computeReplBacklogMB(ctx({ memoryGB: 8 }))).toBe(64);
  });
});

describe('computeSlowlogSlowerThanUs / computeSlowlogMaxLen', () => {
  it('队列最敏感（1ms）、会话 5ms、其余官方默认 10ms', () => {
    expect(computeSlowlogSlowerThanUs(ctx({ scenario: 'queue' }))).toBe(1000);
    expect(computeSlowlogSlowerThanUs(ctx({ scenario: 'session' }))).toBe(5000);
    expect(computeSlowlogSlowerThanUs(ctx({ scenario: 'cache' }))).toBe(10000);
  });

  it('队列/混合加大慢查询队列长度', () => {
    expect(computeSlowlogMaxLen(ctx({ scenario: 'queue' }))).toBe(512);
    expect(computeSlowlogMaxLen(ctx({ scenario: 'mixed' }))).toBe(512);
    expect(computeSlowlogMaxLen(ctx({ scenario: 'cache' }))).toBe(128);
  });
});

describe('computeNotifyKeyspaceEvents', () => {
  it('会话场景开 Ex，其余关闭', () => {
    expect(computeNotifyKeyspaceEvents(ctx({ scenario: 'session' }))).toEqual(['E', 'x']);
    expect(computeNotifyKeyspaceEvents(ctx({ scenario: 'cache' }))).toEqual([]);
  });
});
