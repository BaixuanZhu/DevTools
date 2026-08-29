/**
 * my.cnf 渲染引擎单元测试（generate.ts）。
 * 重点验证"打开即用"产物合法性、版本联动（废弃行跳过 / 改名对切换）、
 * `key = value` 空格格式、布尔 ON/OFF、组标题英文注释与单机/主从差异。
 */
import { describe, it, expect } from 'vitest';
import { generateMyCnf, serializeConf, resolveValue, findDirectiveValues, type ConfLine } from '../generate';
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

describe('generateMyCnf — 打开即用（默认画像快照断言）', () => {
  const lines = generateMyCnf(CONFIG_PARAMS, createDefaultContext());

  it('以头部元信息注释 + [mysqld] 段头开始', () => {
    expect(lines[0].type).toBe('comment');
    expect(comments(lines).some((t) => t.includes('目标版本 MySQL 8.0'))).toBe(true);
    expect(comments(lines).some((t) => t.includes('datadir / socket / log-error'))).toBe(true);
    expect(lines.some((l) => l.type === 'section' && l.text === '[mysqld]')).toBe(true);
  });

  it('核心指令为推荐值（合法可直接使用）', () => {
    const d = directives(lines);
    expect(d).toContain('port = 3306');
    expect(d).toContain('max_connections = 240');
    expect(d).toContain('wait_timeout = 28800');
    expect(d).toContain('max_allowed_packet = 64M');
    expect(d).toContain('skip_name_resolve = ON');
    expect(d).toContain('transaction_isolation = REPEATABLE-READ');
    expect(d).toContain('innodb_buffer_pool_size = 2048M');
    expect(d).toContain('innodb_buffer_pool_instances = 8');
    expect(d).toContain('innodb_log_file_size = 512M');
    expect(d).toContain('innodb_flush_log_at_trx_commit = 1');
    expect(d).toContain('sync_binlog = 1');
    expect(d).toContain('innodb_flush_method = O_DIRECT');
    expect(d).toContain('innodb_io_capacity = 2000');
    expect(d).toContain('innodb_io_capacity_max = 4000');
    expect(d).toContain('log_bin = ON');
    expect(d).toContain('binlog_expire_logs_seconds = 604800');
    expect(d).toContain('binlog_format = ROW');
    expect(d).toContain('character_set_server = utf8mb4');
    expect(d).toContain('collation_server = utf8mb4_0900_ai_ci');
    expect(d).toContain('default_authentication_plugin = caching_sha2_password');
    expect(d).toContain('slow_query_log = ON');
    expect(d).toContain('long_query_time = 1');
    expect(d).toContain('ngram_token_size = 2');
  });

  it('指令一律 `key = value`（等号两侧带空格，MySQL 惯例）', () => {
    for (const text of directives(lines)) {
      expect(text, text).toMatch(/^[a-z0-9_]+ = \S/);
    }
  });

  it('布尔值输出大写 ON/OFF（MySQL 惯例）', () => {
    const d = directives(lines);
    expect(d).toContain('skip_name_resolve = ON');
    expect(d).toContain('log_bin = ON');
    for (const text of d) {
      if (/^(skip_name_resolve|log_bin|slow_query_log|innodb_ft_enable_stopword) =/.test(text)) {
        expect(text.endsWith(' ON') || text.endsWith(' OFF'), text).toBe(true);
      }
    }
  });

  it('组间空行 + 英文组标题注释，单机无复制组，无逐参数中文注释', () => {
    const groupTitles = comments(lines).filter(
      (t) =>
        !t.startsWith('# MySQL 配置文件') &&
        !t.startsWith('# 目标版本') &&
        !t.startsWith('# datadir') &&
        !t.startsWith('# 账号'),
    );
    expect(groupTitles).toContain('# Connections and Transactions');
    expect(groupTitles).toContain('# Memory and Query Cache');
    expect(groupTitles).toContain('# Full-Text Search and Tokenizer');
    expect(groupTitles).toContain('# Redo Log and Flush');
    expect(groupTitles).toContain('# Binary Log');
    expect(groupTitles).not.toContain('# Replication');
    expect(groupTitles).toContain('# Character Set');
    expect(groupTitles).toContain('# Authentication');
    expect(groupTitles).toContain('# Logging and Slow Queries');
  });
});

describe('generateMyCnf — 版本联动', () => {
  it('目标 8.0 时 5.7 专属参数不输出', () => {
    const d = directives(generateMyCnf(CONFIG_PARAMS, ctx({ version: '8.0' })));
    expect(d.some((t) => t.startsWith('tx_isolation'))).toBe(false);
    expect(d.some((t) => t.startsWith('query_cache_'))).toBe(false);
    expect(d.some((t) => t.startsWith('expire_logs_days'))).toBe(false);
  });

  it('目标 5.7 时输出改名对旧名与 5.7 默认值（latin1 坑规避）', () => {
    const d = directives(generateMyCnf(CONFIG_PARAMS, ctx({ version: '5.7' })));
    expect(d).toContain('tx_isolation = REPEATABLE-READ');
    expect(d.some((t) => t.startsWith('transaction_isolation'))).toBe(false);
    expect(d).toContain('query_cache_size = 0M');
    expect(d).toContain('query_cache_type = OFF');
    expect(d).toContain('expire_logs_days = 7');
    expect(d).toContain('collation_server = utf8mb4_general_ci');
    expect(d).toContain('default_authentication_plugin = mysql_native_password');
    expect(d.some((t) => t.startsWith('binlog_expire_logs_seconds'))).toBe(false);
  });

  it('目标 8.4 时输出新名参数（redo capacity），废弃/移除参数不写入', () => {
    const d = directives(generateMyCnf(CONFIG_PARAMS, ctx({ version: '8.4' })));
    expect(d).toContain('innodb_redo_log_capacity = 1024M');
    expect(d.some((t) => t.startsWith('innodb_log_file_size'))).toBe(false);
    expect(d.some((t) => t.startsWith('innodb_buffer_pool_instances'))).toBe(false);
    expect(d.some((t) => t.startsWith('default_authentication_plugin'))).toBe(false);
    expect(d.some((t) => t.startsWith('slave_parallel_workers'))).toBe(false);
    expect(d.some((t) => t.startsWith('slave_preserve_commit_order'))).toBe(false);
  });
});

describe('generateMyCnf — 单机 / 主从与覆盖值', () => {
  it('单机模式不输出任何复制参数（含组标题）', () => {
    const lines = generateMyCnf(CONFIG_PARAMS, createDefaultContext());
    const d = directives(lines);
    for (const key of ['server_id', 'gtid_mode', 'read_only', 'super_read_only', 'relay_log_recovery', 'slave_parallel_workers']) {
      expect(d.some((t) => t.startsWith(key)), key).toBe(false);
    }
    expect(comments(lines).some((t) => t === '# Replication')).toBe(false);
  });

  it('主从模式输出复制组：server_id 占位 1、GTID 三件套与并行回放', () => {
    const d = directives(generateMyCnf(CONFIG_PARAMS, ctx({ mode: 'replica' })));
    expect(d).toContain('server_id = 1');
    expect(d).toContain('gtid_mode = ON');
    expect(d).toContain('enforce_gtid_consistency = ON');
    expect(d).toContain('relay_log_recovery = ON');
    expect(d).toContain('read_only = ON');
    expect(d).toContain('super_read_only = ON');
    expect(d).toContain('slave_parallel_workers = 4');
    expect(d).toContain('slave_preserve_commit_order = ON');
  });

  it('主从 8.4 轴输出 replica_* 新名（旧名因轴点安全方向被过滤）', () => {
    const d = directives(generateMyCnf(CONFIG_PARAMS, ctx({ mode: 'replica', version: '8.4' })));
    expect(d).toContain('replica_parallel_workers = 4');
    expect(d).toContain('replica_preserve_commit_order = ON');
    expect(d.some((t) => t.startsWith('slave_parallel_workers'))).toBe(false);
    expect(d.some((t) => t.startsWith('slave_preserve_commit_order'))).toBe(false);
  });

  it('overrides 优先于 compute 推荐值（数值带单位后缀）', () => {
    const d = directives(
      generateMyCnf(CONFIG_PARAMS, ctx({ overrides: { 'innodb_buffer_pool_size': 8192, 'transaction_isolation': 'READ-COMMITTED', 'binlog_format': 'MIXED' } })),
    );
    expect(d).toContain('innodb_buffer_pool_size = 8192M');
    expect(d).toContain('transaction_isolation = READ-COMMITTED');
    expect(d).toContain('binlog_format = MIXED');
  });

  it('对上下文不适用参数的覆盖值被忽略（单机模式覆盖 server_id 无效）', () => {
    const d = directives(generateMyCnf(CONFIG_PARAMS, ctx({ overrides: { server_id: 42 } })));
    expect(d.some((t) => t.startsWith('server_id'))).toBe(false);
  });

  it('监听范围联动 bind_address：仅本机绑回环、仅内网绑 IP（trim、未填省略）、所有接口不输出', () => {
    expect(directives(generateMyCnf(CONFIG_PARAMS, ctx({ listenScope: 'loopback' })))).toContain('bind_address = 127.0.0.1');
    expect(directives(generateMyCnf(CONFIG_PARAMS, ctx({ listenScope: 'intranet', bindIp: ' 10.0.0.5 ' })))).toContain('bind_address = 10.0.0.5');
    expect(
      directives(generateMyCnf(CONFIG_PARAMS, ctx({ listenScope: 'intranet', bindIp: ' ' }))).some((t) => t.startsWith('bind_address')),
    ).toBe(false);
    expect(directives(generateMyCnf(CONFIG_PARAMS, createDefaultContext())).some((t) => t.startsWith('bind_address'))).toBe(false);
  });
});

describe('辅助函数', () => {
  it('resolveValue 覆盖优先且不适用返回 null', () => {
    const serverId = getParam('server_id')!;
    expect(resolveValue(serverId, createDefaultContext())).toBeNull();
    const waitTimeout = getParam('wait_timeout')!;
    expect(resolveValue(waitTimeout, ctx({ overrides: { wait_timeout: 600 } }))).toBe(600);
  });

  it('findDirectiveValues 提取联动值供 OS 建议使用（剥离 key 与等号）', () => {
    const lines = generateMyCnf(CONFIG_PARAMS, ctx({ overrides: { max_connections: 500 } }));
    expect(findDirectiveValues(lines, 'max_connections')).toEqual(['500']);
    expect(findDirectiveValues(lines, 'not-exist')).toEqual([]);
  });

  it('serializeConf 含末尾换行且逐行对应', () => {
    const lines = generateMyCnf(CONFIG_PARAMS, createDefaultContext());
    const text = serializeConf(lines);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(lines.length + 1);
  });
});
