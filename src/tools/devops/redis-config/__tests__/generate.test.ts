/**
 * conf 渲染引擎单元测试（generate.ts）。
 * 重点验证"打开即用"产物合法性、版本联动过滤、覆盖值与单机/主从差异。
 */
import { describe, it, expect } from 'vitest';
import { generateConf, serializeConf, resolveValue, findDirectiveValues, type ConfLine } from '../generate';
import { createDefaultContext, getParam, type GenerateContext } from '../params';

/** 以默认画像为基础覆盖部分字段，构造测试上下文 */
function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return { ...createDefaultContext(), ...overrides };
}

/** 取全部指令行文本 */
function directives(lines: ConfLine[]): string[] {
  return lines.filter((l) => l.type === 'directive').map((l) => l.text);
}

describe('generateConf — 打开即用（默认画像快照断言）', () => {
  const lines = generateConf(createDefaultContext());

  it('头部含版本/模式/场景/持久化注释', () => {
    const comments = lines.filter((l) => l.type === 'comment').map((l) => l.text);
    expect(comments.some((t) => t.includes('目标版本 Redis 7.4'))).toBe(true);
    expect(comments.some((t) => t.includes('单机'))).toBe(true);
    expect(comments.some((t) => t.includes('缓存'))).toBe(true);
  });

  it('核心指令为推荐值（合法可直接使用）', () => {
    const d = directives(lines);
    expect(d).toContain('maxmemory 2048mb');
    expect(d).toContain('maxmemory-policy allkeys-lru');
    expect(d).toContain('maxclients 1000');
    expect(d).toContain('save 300 1 60 10000');
    expect(d).toContain('appendonly no');
    expect(d).toContain('appendfsync everysec');
    expect(d).toContain('databases 16');
    expect(d).toContain('io-threads 1');
    expect(d).toContain('tcp-backlog 511');
  });

  it('默认（7.4）包含 7.0+ 参数且含每个参数的中文注释行', () => {
    const d = directives(lines);
    expect(d).toContain('appenddirname appendonlydir');
    expect(d).toContain('busy-reply-threshold 5000');
    const comments = lines.filter((l) => l.type === 'comment').map((l) => l.text);
    expect(comments.some((t) => t.startsWith('# 内存上限按物理内存折算'))).toBe(true);
  });

  it('单机模式不输出任何复制参数', () => {
    const d = directives(lines);
    expect(d.some((t) => t.startsWith('replicaof'))).toBe(false);
    expect(d.some((t) => t.startsWith('masterauth'))).toBe(false);
    expect(d.some((t) => t.startsWith('repl-backlog-size'))).toBe(false);
    expect(d.some((t) => t.startsWith('replica-read-only'))).toBe(false);
  });

  it('组间空行 + 组标题注释', () => {
    const groupTitles = lines
      .filter((l) => l.type === 'comment' && l.text.startsWith('# ============'))
      .map((l) => l.text);
    expect(groupTitles.length).toBeGreaterThanOrEqual(6);
    expect(groupTitles.some((t) => t.includes('网络连接'))).toBe(true);
    expect(lines[0].type).toBe('comment');
  });

  it('序列化含末尾换行且逐行对应', () => {
    const text = serializeConf(lines);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(lines.length + 1);
  });
});

describe('generateConf — 版本联动', () => {
  it('目标 7.0 时不输出 7.2+/7.4+/8.0+ 引入的参数', () => {
    const d = directives(generateConf(ctx({ version: '7.0' })));
    expect(d.some((t) => t.startsWith('set-max-listpack-entries'))).toBe(false);
    expect(d.some((t) => t.startsWith('set-max-listpack-value'))).toBe(false);
    expect(d.some((t) => t.startsWith('hide-user-data-from-log'))).toBe(false);
    expect(d.some((t) => t.startsWith('max-new-connections-per-cycle'))).toBe(false);
    expect(d.some((t) => t.startsWith('replica-full-sync-buffer-limit'))).toBe(false);
  });

  it('目标 7.2 时输出 set-max-listpack-*，仍无 7.4/8.0 参数', () => {
    const d = directives(generateConf(ctx({ version: '7.2' })));
    expect(d).toContain('set-max-listpack-entries 128');
    expect(d).toContain('set-max-listpack-value 64');
    expect(d.some((t) => t.startsWith('hide-user-data-from-log'))).toBe(false);
  });

  it('目标 8.0 时废弃参数 io-threads-do-reads 不写入 conf', () => {
    expect(directives(generateConf(ctx({ version: '7.4' })))).toContain('io-threads-do-reads no');
    expect(directives(generateConf(ctx({ version: '8.0' })))).not.toContain('io-threads-do-reads no');
  });

  it('旧名别名（lua-time-limit / ziplist 系）任何版本都不写入 conf', () => {
    for (const version of ['7.0', '7.2', '7.4', '8.0'] as const) {
      const d = directives(generateConf(ctx({ version })));
      expect(d.some((t) => t.startsWith('lua-time-limit'))).toBe(false);
      expect(d.some((t) => t.startsWith('hash-max-ziplist'))).toBe(false);
    }
  });
});

describe('generateConf — 覆盖值与上下文联动', () => {
  it('overrides 优先于 compute 推荐值', () => {
    const lines = generateConf(ctx({ overrides: { 'maxmemory-policy': 'noeviction', timeout: 120 } }));
    const d = directives(lines);
    expect(d).toContain('maxmemory-policy noeviction');
    expect(d).toContain('timeout 120');
  });

  it('对上下文不适用参数的覆盖值被忽略（单机模式覆盖复制参数无效）', () => {
    const d = directives(generateConf(ctx({ overrides: { replicaof: '10.0.0.5 6379' } })));
    expect(d.some((t) => t.startsWith('replicaof'))).toBe(false);
  });

  it('主从模式输出复制组且 masterauth 为空时省略', () => {
    const d = directives(generateConf(ctx({ mode: 'replica', masterAddr: '10.0.0.5 6379' })));
    expect(d).toContain('replicaof 10.0.0.5 6379');
    expect(d).toContain('replica-read-only yes');
    expect(d).toContain('repl-backlog-size 16mb');
    expect(d.some((t) => t.startsWith('masterauth'))).toBe(false);
  });

  it('主从模式 8GB 内存 repl-backlog 为 64mb，masterauth 覆盖后写入', () => {
    const d = directives(
      generateConf(ctx({ mode: 'replica', masterAddr: '10.0.0.5 6379', memoryGB: 8, overrides: { masterauth: 's3cret' } })),
    );
    expect(d).toContain('repl-backlog-size 64mb');
    expect(d).toContain('masterauth s3cret');
  });

  it('主从模式未填主库地址时省略 replicaof（由面板校验兜底）', () => {
    const d = directives(generateConf(ctx({ mode: 'replica', masterAddr: '' })));
    expect(d.some((t) => t.startsWith('replicaof'))).toBe(false);
    expect(d.some((t) => t.startsWith('replica-read-only'))).toBe(true);
  });

  it('关闭持久化时不输出 save 指令且 appendonly 为 no', () => {
    const d = directives(generateConf(ctx({ persistence: 'off' })));
    expect(d.some((t) => t.startsWith('save'))).toBe(false);
    expect(d).toContain('appendonly no');
  });

  it('AOF 模式输出 appendonly yes 且 save 仍按场景输出', () => {
    const d = directives(generateConf(ctx({ persistence: 'aof' })));
    expect(d).toContain('appendonly yes');
    expect(d).toContain('save 300 1 60 10000');
  });

  it('client-output-buffer-limit 预设拆为三条指令', () => {
    const d = directives(generateConf(createDefaultContext()));
    expect(d.filter((t) => t.startsWith('client-output-buffer-limit '))).toHaveLength(3);
  });

  it('notify-keyspace-events 非会话场景输出空串，会话场景输出 Ex', () => {
    expect(directives(generateConf(createDefaultContext()))).toContain('notify-keyspace-events ""');
    expect(directives(generateConf(ctx({ scenario: 'session' })))).toContain('notify-keyspace-events "Ex"');
  });

  it('值为空的文本参数（bind/dir/requirepass）不写入 conf', () => {
    const d = directives(generateConf(createDefaultContext()));
    expect(d.some((t) => t.startsWith('bind'))).toBe(false);
    expect(d.some((t) => t.startsWith('dir '))).toBe(false);
    expect(d.some((t) => t.startsWith('requirepass'))).toBe(false);
  });
});

describe('resolveValue / findDirectiveValues 辅助函数', () => {
  it('resolveValue 覆盖优先且不适用返回 null', () => {
    const replicaof = getParam('replicaof')!;
    expect(resolveValue(replicaof, createDefaultContext())).toBeNull();
    const timeout = getParam('timeout')!;
    expect(resolveValue(timeout, ctx({ overrides: { timeout: 60 } }))).toBe(60);
  });

  it('findDirectiveValues 提取联动值供系统参数建议使用', () => {
    const lines = generateConf(ctx({ overrides: { 'tcp-backlog': 2048, maxclients: 4000 } }));
    expect(findDirectiveValues(lines, 'tcp-backlog')).toEqual(['2048']);
    expect(findDirectiveValues(lines, 'maxclients')).toEqual(['4000']);
    expect(findDirectiveValues(lines, 'not-exist')).toEqual([]);
  });
});
