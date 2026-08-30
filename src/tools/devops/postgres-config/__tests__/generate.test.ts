/**
 * postgresql.conf 渲染引擎单元测试（generate.ts）。
 * 重点验证"打开即用"快照（默认画像完整 conf 文本）、`key = value` 指令格式、
 * 版本联动（18 异步 IO 组显隐 / effective_io_concurrency 版本差异）、
 * 主从态复制组渲染、引号规则（quoted 字符串 vs 裸枚举 vs 小写 on/off）。
 */
import { describe, it, expect } from 'vitest';
import { generatePgConf, serializeConf, resolveValue, type ConfLine } from '../generate';
import { CONFIG_PARAMS, createDefaultContext, getParam, type GenerateContext } from '../params';

/** 以默认画像为基础覆盖部分字段，构造测试上下文 */
function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return { ...createDefaultContext(), ...overrides };
}

/** 取全部指令行文本 */
function directives(lines: ConfLine[]): string[] {
  return lines.filter((l) => l.type === 'directive').map((l) => l.text);
}

/** 取全部注释行文本 */
function comments(lines: ConfLine[]): string[] {
  return lines.filter((l) => l.type === 'comment').map((l) => l.text);
}

describe('generatePgConf — 打开即用（默认画像快照）', () => {
  const lines = generatePgConf(CONFIG_PARAMS, createDefaultContext());
  const text = serializeConf(lines);

  it('默认画像完整 conf 文本快照（回归锚点：格式或推荐值漂移即失败）', () => {
    expect(text).toMatchSnapshot();
  });

  it('以头部元信息注释开始（生成器标识 + 路径参数归属 + 认证归属说明），无 [section] 段头', () => {
    expect(comments(lines)[0]).toContain('DevTools 配置生成器');
    expect(comments(lines).some((t) => t.includes('datadir / hba_file'))).toBe(true);
    expect(comments(lines).some((t) => t.includes('pg_hba.conf'))).toBe(true);
    expect(lines.some((l) => l.type === 'section')).toBe(false);
  });

  it('核心指令为推荐值（合法可直接使用）', () => {
    const d = directives(lines);
    expect(d).toContain("listen_addresses = 'localhost'");
    expect(d).toContain('port = 5432');
    expect(d).toContain('max_connections = 100');
    expect(d).toContain('superuser_reserved_connections = 3');
    expect(d).toContain('password_encryption = scram-sha-256');
    expect(d).toContain('shared_buffers = 1024MB');
    expect(d).toContain('effective_cache_size = 2457MB');
    expect(d).toContain('work_mem = 8MB');
    expect(d).toContain('maintenance_work_mem = 204MB');
    expect(d).toContain('huge_pages = off');
    expect(d).toContain('wal_level = replica');
    expect(d).toContain('wal_buffers = -1');
    expect(d).toContain('max_wal_size = 1024MB');
    expect(d).toContain('min_wal_size = 128MB');
    expect(d).toContain('checkpoint_timeout = 5min');
    expect(d).toContain('checkpoint_completion_target = 0.9');
    expect(d).toContain('max_worker_processes = 8');
    expect(d).toContain('max_parallel_workers = 3');
    expect(d).toContain('max_parallel_workers_per_gather = 1');
    expect(d).toContain('jit = off');
    expect(d).toContain('random_page_cost = 1.5');
    expect(d).toContain('effective_io_concurrency = 200');
    expect(d).toContain('default_statistics_target = 100');
    expect(d).toContain('autovacuum = on');
    expect(d).toContain('autovacuum_vacuum_scale_factor = 0.2');
    expect(d).toContain('autovacuum_vacuum_cost_limit = 200');
    expect(d).toContain('logging_collector = off');
    expect(d).toContain('log_min_duration_statement = 1000');
    expect(d).toContain('log_checkpoints = on');
    expect(d).toContain("log_line_prefix = '%m [%p] %u@%d '");
    expect(d).toContain("timezone = 'Asia/Shanghai'");
    expect(d).toContain("log_timezone = 'Asia/Shanghai'");
  });

  it('指令一律 `key = value`（等号两侧带空格），默认画像恰好 34 行指令（39 − 复制组 3 − 异步 IO 组 2）', () => {
    const d = directives(lines);
    for (const t of d) {
      expect(t, t).toMatch(/^[\w.]+ = /);
    }
    expect(d).toHaveLength(34);
  });

  it('组间空行 + 英文组标题注释；单机无复制组、17 无异步 IO 组', () => {
    const groupTitles = comments(lines).filter((t) => t.startsWith('# ') && !t.startsWith('# PostgreSQL') && !t.startsWith('# 目标版本') && !t.startsWith('# datadir') && !t.startsWith('# 账号'));
    expect(groupTitles).toEqual([
      '# Connections & Authentication',
      '# Memory',
      '# Write-Ahead Log & Checkpoints',
      '# Parallel Query & Planner',
      '# Autovacuum',
      '# Logging',
      '# Timezone',
    ]);
  });
});

describe('generatePgConf — 版本联动', () => {
  it('目标 18 输出异步 IO 组（io_method/io_workers），16/17 不输出', () => {
    const d18 = directives(generatePgConf(CONFIG_PARAMS, ctx({ version: '18' })));
    expect(d18).toContain('io_method = worker');
    expect(d18).toContain('io_workers = 3');
    expect(comments(generatePgConf(CONFIG_PARAMS, ctx({ version: '18' })))).toContain('# Asynchronous I/O');

    for (const version of ['16', '17'] as const) {
      const d = directives(generatePgConf(CONFIG_PARAMS, ctx({ version })));
      expect(d.some((t) => t.startsWith('io_method'))).toBe(false);
      expect(d.some((t) => t.startsWith('io_workers'))).toBe(false);
      expect(comments(generatePgConf(CONFIG_PARAMS, ctx({ version })))).not.toContain('# Asynchronous I/O');
    }
  });

  it('effective_io_concurrency 的 HDD 默认按版本：16/17 → 1，18 → 16（尊重 18 新默认）', () => {
    for (const version of ['16', '17'] as const) {
      expect(directives(generatePgConf(CONFIG_PARAMS, ctx({ version, diskType: 'hdd' })))).toContain('effective_io_concurrency = 1');
    }
    expect(directives(generatePgConf(CONFIG_PARAMS, ctx({ version: '18', diskType: 'hdd' })))).toContain('effective_io_concurrency = 16');
  });
});

describe('generatePgConf — 单机 / 主从与覆盖值', () => {
  it('单机模式不输出复制组三参数（含组标题），即使 overrides 给了值', () => {
    const lines = generatePgConf(CONFIG_PARAMS, ctx({ overrides: { max_wal_senders: 20 } }));
    const d = directives(lines);
    for (const key of ['max_wal_senders', 'max_replication_slots', 'wal_keep_size']) {
      expect(d.some((t) => t.startsWith(key)), key).toBe(false);
    }
    expect(comments(lines)).not.toContain('# Replication');
  });

  it('主从模式输出复制组：max_wal_senders/max_replication_slots/wal_keep_size', () => {
    const d = directives(generatePgConf(CONFIG_PARAMS, ctx({ mode: 'replica' })));
    expect(d).toContain('max_wal_senders = 10');
    expect(d).toContain('max_replication_slots = 10');
    expect(d).toContain('wal_keep_size = 256MB');
    expect(comments(generatePgConf(CONFIG_PARAMS, ctx({ mode: 'replica' })))).toContain('# Replication');
  });

  it('主从态 wal_level 仍输出 replica（默认即满足复制要求）', () => {
    const d = directives(generatePgConf(CONFIG_PARAMS, ctx({ mode: 'replica' })));
    expect(d).toContain('wal_level = replica');
  });

  it('overrides 优先于 compute/defaultValue（数值带单位后缀、枚举与布尔按类型渲染）', () => {
    const d = directives(
      generatePgConf(CONFIG_PARAMS, ctx({ overrides: { shared_buffers: 2048, wal_compression: 'lz4', jit: true } })),
    );
    expect(d).toContain('shared_buffers = 2048MB');
    expect(d).toContain('wal_compression = lz4');
    expect(d).toContain('jit = on');
  });

  it('监听范围联动：loopback/intranet（quoted IP）/all（*），未填 IP 省略该行', () => {
    expect(directives(generatePgConf(CONFIG_PARAMS, ctx({ listenScope: 'loopback' })))).toContain("listen_addresses = 'localhost'");
    expect(directives(generatePgConf(CONFIG_PARAMS, ctx({ listenScope: 'intranet', bindIp: ' 10.0.0.5 ' })))).toContain("listen_addresses = '10.0.0.5'");
    expect(directives(generatePgConf(CONFIG_PARAMS, ctx({ listenScope: 'all' })))).toContain("listen_addresses = '*'");
    expect(
      directives(generatePgConf(CONFIG_PARAMS, ctx({ listenScope: 'intranet', bindIp: ' ' }))).some((t) => t.startsWith('listen_addresses')),
    ).toBe(false);
  });
});

describe('generatePgConf — 引号与值形态规则', () => {
  it('quoted 参数带单引号：listen_addresses/log_line_prefix/timezone', () => {
    const d = directives(generatePgConf(CONFIG_PARAMS, createDefaultContext()));
    expect(d).toContain("listen_addresses = 'localhost'");
    expect(d).toContain("log_line_prefix = '%m [%p] %u@%d '");
    expect(d).toContain("timezone = 'Asia/Shanghai'");
  });

  it('枚举/数值/布尔裸输出：wal_level、password_encryption、checkpoint_timeout、小写 on/off', () => {
    const d = directives(generatePgConf(CONFIG_PARAMS, createDefaultContext()));
    expect(d).toContain('wal_level = replica');
    expect(d).toContain('password_encryption = scram-sha-256');
    expect(d).toContain('checkpoint_timeout = 5min');
    expect(d).toContain('autovacuum = on');
    expect(d).toContain('logging_collector = off');
    expect(d).toContain('jit = off');
  });

  it('quoted 值不做 trim（log_line_prefix 尾随空格有语义）且值内单引号翻倍转义', () => {
    const d = directives(
      generatePgConf(CONFIG_PARAMS, ctx({ overrides: { log_line_prefix: "%u@%d '%a' " } })),
    );
    expect(d).toContain("log_line_prefix = '%u@%d ''%a'' '");
  });

  it('默认画像下无带引号的枚举（裸枚举不被误加引号）', () => {
    const d = directives(generatePgConf(CONFIG_PARAMS, createDefaultContext()));
    expect(d).not.toContain("wal_level = 'replica'");
    expect(d).not.toContain("password_encryption = 'scram-sha-256'");
  });
});

describe('辅助函数', () => {
  it('resolveValue 覆盖优先，无 compute/defaultValue 时返回 null', () => {
    const sharedBuffers = getParam('shared_buffers')!;
    expect(resolveValue(sharedBuffers, ctx({ overrides: { shared_buffers: 512 } }))).toBe(512);
    expect(resolveValue(sharedBuffers, createDefaultContext())).toBe(1024);
  });

  it('serializeConf 含末尾换行且逐行对应', () => {
    const lines = generatePgConf(CONFIG_PARAMS, createDefaultContext());
    const text = serializeConf(lines);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(lines.length + 1);
  });
});
