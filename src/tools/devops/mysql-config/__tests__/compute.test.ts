/**
 * MySQL 配置生成器公式层单元测试（compute.ts）。
 */
import { describe, it, expect } from 'vitest';
import {
  computeAuthenticationPlugin,
  computeBindAddress,
  computeBufferPoolFactor,
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
} from '../compute';
import { CONFIG_PARAMS, createDefaultContext, getParam, type GenerateContext } from '../params';
import { resolveValue } from '../generate';
import { isAvailable } from '../version';

/** 以默认画像为基础覆盖部分字段，构造测试上下文 */
function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return { ...createDefaultContext(), ...overrides };
}

describe('computeBufferPoolFactor / computeBufferPoolMB', () => {
  it('系数：oltp 0.6 / read-heavy 0.7 / HDD 封顶 0.5（优先于场景抬升）', () => {
    expect(computeBufferPoolFactor(ctx())).toBe(0.6);
    expect(computeBufferPoolFactor(ctx({ scenario: 'read-heavy' }))).toBe(0.7);
    expect(computeBufferPoolFactor(ctx({ diskType: 'hdd' }))).toBe(0.5);
    expect(computeBufferPoolFactor(ctx({ scenario: 'read-heavy', diskType: 'hdd' }))).toBe(0.5);
  });

  it('向下取整 GB（×1024 转 mb），不足 1GB 退到 128M 下限', () => {
    expect(computeBufferPoolMB(ctx({ memoryGB: 4 }))).toBe(2048); // 2.4G → 2G
    expect(computeBufferPoolMB(ctx({ memoryGB: 16, scenario: 'read-heavy' }))).toBe(11264); // 11.2G → 11G
    expect(computeBufferPoolMB(ctx({ memoryGB: 64 }))).toBe(38912); // 38.4G → 38G
    expect(computeBufferPoolMB(ctx({ memoryGB: 2, diskType: 'hdd' }))).toBe(1024); // 1.0G
    expect(computeBufferPoolMB(ctx({ memoryGB: 1 }))).toBe(128); // 0.6G → 下限 0.125GB
  });
});

describe('computeBufferPoolInstances', () => {
  it('8.0 及以前官方规则：pool ≥ 1GB 取 8，< 1GB 选项不生效（按 1 处理）', () => {
    expect(computeBufferPoolInstances(ctx({ memoryGB: 4 }))).toBe(8);
    expect(computeBufferPoolInstances(ctx({ memoryGB: 2 }))).toBe(8); // 1.2G → 1G ≥ 1GB
    expect(computeBufferPoolInstances(ctx({ memoryGB: 1 }))).toBe(1);
  });
});

describe('computeMaxConnections', () => {
  it('并发 ×1.2 上取整', () => {
    expect(computeMaxConnections(ctx({ concurrency: 200 }))).toBe(240);
    expect(computeMaxConnections(ctx({ concurrency: 201 }))).toBe(242);
    expect(computeMaxConnections(ctx({ concurrency: 80 }))).toBe(96);
  });

  it('受内存折算上限约束（buffer pool 之外 ÷ 每连接约 2MB），防止超卖', () => {
    // 4GB：pool 2048，可用 2048 ÷ 2 = 1024 上限
    expect(computeMaxConnections(ctx({ concurrency: 1000 }))).toBe(1024);
    // 1GB：pool 128，可用 896 ÷ 2 = 448 上限
    expect(computeMaxConnections(ctx({ memoryGB: 1, concurrency: 500 }))).toBe(448);
  });
});

describe('"双 1"刷盘矩阵', () => {
  it('通用场景 1/1（数据安全）', () => {
    expect(computeFlushLogAtTrxCommit(ctx())).toBe('1');
    expect(computeSyncBinlog(ctx())).toBe('1');
    expect(computeFlushLogAtTrxCommit(ctx({ scenario: 'analytics' }))).toBe('1');
  });

  it('write-heavy 场景 2/100（崩溃可能丢约 1 秒事务的取舍）', () => {
    expect(computeFlushLogAtTrxCommit(ctx({ scenario: 'write-heavy' }))).toBe('2');
    expect(computeSyncBinlog(ctx({ scenario: 'write-heavy' }))).toBe('100');
  });
});

describe('computeLogFileSizeMB（5.7/8.0 轴阶梯）', () => {
  it('< 8G 内存 512M、8-32G 1G、≥ 32G 2G', () => {
    expect(computeLogFileSizeMB(ctx({ memoryGB: 4 }))).toBe(512);
    expect(computeLogFileSizeMB(ctx({ memoryGB: 8 }))).toBe(1024);
    expect(computeLogFileSizeMB(ctx({ memoryGB: 32 }))).toBe(2048);
    expect(computeLogFileSizeMB(ctx({ memoryGB: 64 }))).toBe(2048);
  });

  it('写密集 ×2，上限 4G', () => {
    expect(computeLogFileSizeMB(ctx({ memoryGB: 4, scenario: 'write-heavy' }))).toBe(1024);
    expect(computeLogFileSizeMB(ctx({ memoryGB: 16, scenario: 'write-heavy' }))).toBe(2048);
    expect(computeLogFileSizeMB(ctx({ memoryGB: 32, scenario: 'write-heavy' }))).toBe(4096);
    expect(computeLogFileSizeMB(ctx({ memoryGB: 64, scenario: 'write-heavy' }))).toBe(4096);
  });
});

describe('computeRedoCapacityMB（8.4 轴等价总容量 1G/2G/4G）', () => {
  it('< 8G 内存 1G、8-32G 2G、≥ 32G 4G，写密集翻倍（封顶 4G）', () => {
    expect(computeRedoCapacityMB(ctx({ version: '8.4', memoryGB: 4 }))).toBe(1024);
    expect(computeRedoCapacityMB(ctx({ version: '8.4', memoryGB: 16 }))).toBe(2048);
    expect(computeRedoCapacityMB(ctx({ version: '8.4', memoryGB: 32 }))).toBe(4096);
    expect(computeRedoCapacityMB(ctx({ version: '8.4', memoryGB: 4, scenario: 'write-heavy' }))).toBe(2048);
    expect(computeRedoCapacityMB(ctx({ version: '8.4', memoryGB: 16, scenario: 'write-heavy' }))).toBe(4096);
    expect(computeRedoCapacityMB(ctx({ version: '8.4', memoryGB: 32, scenario: 'write-heavy' }))).toBe(4096);
  });
});

describe('computeIoCapacity / computeIoCapacityMax（磁盘画像联动）', () => {
  it('HDD 200/400、SSD 2000/4000、NVMe 4000/8000', () => {
    expect(computeIoCapacity(ctx({ diskType: 'hdd' }))).toBe(200);
    expect(computeIoCapacityMax(ctx({ diskType: 'hdd' }))).toBe(400);
    expect(computeIoCapacity(ctx({ diskType: 'ssd' }))).toBe(2000);
    expect(computeIoCapacityMax(ctx({ diskType: 'ssd' }))).toBe(4000);
    expect(computeIoCapacity(ctx({ diskType: 'nvme' }))).toBe(4000);
    expect(computeIoCapacityMax(ctx({ diskType: 'nvme' }))).toBe(8000);
  });
});

describe('computeTransactionIsolation（场景联动）', () => {
  it('analytics 降为 READ-COMMITTED 减少 gap lock，其余保持官方默认', () => {
    expect(computeTransactionIsolation(ctx({ scenario: 'analytics' }))).toBe('READ-COMMITTED');
    expect(computeTransactionIsolation(ctx({ scenario: 'oltp' }))).toBe('REPEATABLE-READ');
    expect(computeTransactionIsolation(ctx({ scenario: 'read-heavy' }))).toBe('REPEATABLE-READ');
    expect(computeTransactionIsolation(ctx({ scenario: 'write-heavy' }))).toBe('REPEATABLE-READ');
  });
});

describe('字符集分版本', () => {
  it('character_set_server 恒 utf8mb4（5.7 默认 latin1 是坑，显式指定）', () => {
    for (const version of ['5.7', '8.0', '8.4'] as const) {
      expect(resolveValue(getParam('character_set_server')!, ctx({ version }))).toBe('utf8mb4');
    }
  });

  it('collation_server：5.7 用 utf8mb4_general_ci，8.0/8.4 用 utf8mb4_0900_ai_ci', () => {
    expect(resolveValue(getParam('collation_server')!, ctx({ version: '5.7' }))).toBe('utf8mb4_general_ci');
    expect(resolveValue(getParam('collation_server')!, ctx({ version: '8.0' }))).toBe('utf8mb4_0900_ai_ci');
    expect(resolveValue(getParam('collation_server')!, ctx({ version: '8.4' }))).toBe('utf8mb4_0900_ai_ci');
  });
});

describe('binlog 过期分版本', () => {
  it('5.7 轴 expire_logs_days 推荐显式 7 天（官方默认 0 = 不清理）', () => {
    const param = getParam('expire_logs_days')!;
    expect(isAvailable(param, '5.7')).toBe(true);
    expect(resolveValue(param, ctx({ version: '5.7' }))).toBe(7);
  });

  it('8.0/8.4 轴 binlog_expire_logs_seconds 推荐 604800（7 天；官方默认 30 天）', () => {
    const param = getParam('binlog_expire_logs_seconds')!;
    expect(resolveValue(param, ctx({ version: '8.0' }))).toBe(604800);
    expect(resolveValue(param, ctx({ version: '8.4' }))).toBe(604800);
  });
});

describe('computeBindAddress（监听范围三档）', () => {
  it('仅本机绑回环', () => {
    expect(computeBindAddress(ctx({ listenScope: 'loopback' }))).toBe('127.0.0.1');
  });

  it('仅内网绑指定 IP（trim；未填时返回空串待 UI 校验兜底）', () => {
    expect(computeBindAddress(ctx({ listenScope: 'intranet', bindIp: ' 10.0.0.5 ' }))).toBe('10.0.0.5');
    expect(computeBindAddress(ctx({ listenScope: 'intranet', bindIp: ' ' }))).toBe('');
  });

  it('所有接口返回 null 不输出该行（默认 * 含 IPv6，显式 0.0.0.0 反而只绑 IPv4）', () => {
    expect(computeBindAddress(ctx({ listenScope: 'all' }))).toBeNull();
  });
});

describe('computeAuthenticationPlugin（认证插件版本语义）', () => {
  it('5.7 默认 mysql_native_password、8.0/8.4 默认 caching_sha2_password', () => {
    expect(computeAuthenticationPlugin(ctx({ version: '5.7' }))).toBe('mysql_native_password');
    expect(computeAuthenticationPlugin(ctx({ version: '8.0' }))).toBe('caching_sha2_password');
    expect(computeAuthenticationPlugin(ctx({ version: '8.4' }))).toBe('caching_sha2_password');
  });
});

describe('computeLongQueryTime（场景联动）', () => {
  it('官方默认 10 等于关掉慢查日志：oltp/read-heavy 1、write-heavy 0.5、analytics 3', () => {
    expect(computeLongQueryTime(ctx({ scenario: 'oltp' }))).toBe(1);
    expect(computeLongQueryTime(ctx({ scenario: 'read-heavy' }))).toBe(1);
    expect(computeLongQueryTime(ctx({ scenario: 'write-heavy' }))).toBe(0.5);
    expect(computeLongQueryTime(ctx({ scenario: 'analytics' }))).toBe(3);
  });
});

describe('复制组仅主从模式给出推荐值', () => {
  const replicationParams = CONFIG_PARAMS.filter((p) => p.group === 'replication');

  it('单机模式下复制组全部返回 null', () => {
    for (const param of replicationParams) {
      expect(resolveValue(param, ctx()), param.key).toBeNull();
    }
  });

  it('主从模式下该轴可用的复制参数全部非 null（replica_* 按轴点安全方向在 8.0 不可用）', () => {
    const replicaCtx = ctx({ mode: 'replica' });
    for (const param of replicationParams) {
      if (!isAvailable(param, replicaCtx.version)) continue;
      expect(resolveValue(param, replicaCtx) !== null, param.key).toBe(true);
    }
  });

  it('server_id 为占位值 1（UI 挂载时以随机种子覆盖）', () => {
    expect(resolveValue(getParam('server_id')!, ctx({ mode: 'replica' }))).toBe(1);
  });
});
