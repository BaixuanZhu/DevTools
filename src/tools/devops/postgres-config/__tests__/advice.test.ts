/**
 * 附加建议区块单元测试（advice.ts）。
 * 重点验证 OS 建议的来源两分区（官方文档背书 vs 社区惯例，后者明确标注
 * "官方文档未覆盖"）、大页条目按 huge_pages 联动、fs.file-max 联动 max_connections，
 * 以及备库提示块的命令完整性与口令占位（不得出现明文密码生成物）。
 */
import { describe, it, expect } from 'vitest';
import { buildOsAdvice, buildReplicationHint } from '../advice';
import { createDefaultContext, type GenerateContext } from '../params';

/** 以默认画像为基础覆盖部分字段，构造测试上下文 */
function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return { ...createDefaultContext(), ...overrides };
}

describe('buildOsAdvice — 两分区结构', () => {
  it('恒为官方背书 + 社区惯例两区，社区区标注"官方文档未覆盖"', () => {
    const sections = buildOsAdvice(ctx());
    expect(sections.map((s) => s.source)).toEqual(['official', 'community']);
    expect(sections[0].label).toBe('官方文档背书');
    expect(sections[0].note).toContain('postgresql.org');
    expect(sections[1].label).toBe('社区惯例');
    expect(sections[1].note).toContain('官方文档未覆盖');
  });

  it('官方区含 THP（官方 discouraged 原文依据 + never 命令）、overcommit=2 + ratio=90、fs.file-max', () => {
    const items = buildOsAdvice(ctx())[0].items;
    const thp = items.find((i) => i.title.includes('透明大页'));
    expect(thp?.command).toContain('transparent_hugepage');
    expect(thp?.command).toContain('never');
    expect(thp?.reason).toContain('discouraged');

    const overcommit = items.find((i) => i.title.includes('overcommit'));
    expect(overcommit?.command).toContain('vm.overcommit_memory=2');
    expect(overcommit?.command).toContain('vm.overcommit_ratio=90');
    expect(overcommit?.reason).toContain('postmaster');

    expect(items.some((i) => i.title.includes('fs.file-max'))).toBe(true);
  });

  it('社区区含 vm.swappiness=1 与 ulimit -n 65535，说明均标注官方未覆盖', () => {
    const items = buildOsAdvice(ctx())[1].items;
    expect(items.map((i) => i.title)).toEqual(['vm.swappiness = 1', 'ulimit -n 65535']);
    for (const item of items) {
      expect(item.reason, item.title).toContain('官方文档未覆盖');
      expect(item.reason, item.title).toContain('社区');
    }
  });

  it('vm.nr_hugepages 条目按 huge_pages 联动：<16GB（off）不出现，≥16GB（try）出现', () => {
    const small = buildOsAdvice(ctx({ memoryGB: 4 }))[0].items;
    expect(small.some((i) => i.title.includes('vm.nr_hugepages'))).toBe(false);

    const large = buildOsAdvice(ctx({ memoryGB: 16 }))[0].items;
    const hugePages = large.find((i) => i.title.includes('vm.nr_hugepages'));
    expect(hugePages).toBeDefined();
    expect(hugePages?.command).toContain('vm.nr_hugepages=');
    expect(hugePages?.command).toContain('shared_memory_size_in_huge_pages');
    expect(hugePages?.reason).toContain('/proc/meminfo');
  });

  it('fs.file-max 说明联动当前画像的 max_connections 推荐值', () => {
    const fileMax = buildOsAdvice(ctx({ memoryGB: 16 }))[0].items.find((i) => i.title.includes('fs.file-max'));
    expect(fileMax?.reason).toContain('max_connections = 240');
  });
});

describe('buildReplicationHint — 备库初始化提示', () => {
  it('命令块含建复制角色、预建物理槽（immediately_reserve）、pg_basebackup', () => {
    const hint = buildReplicationHint(ctx({ mode: 'replica', version: '18' }));
    expect(hint.commands).toContain("CREATE ROLE replicator WITH LOGIN REPLICATION PASSWORD '...'");
    expect(hint.commands).toContain("pg_create_physical_replication_slot('standby1', true)");
    expect(hint.commands).toContain('pg_basebackup -h <主库IP> -U replicator');
    expect(hint.commands).toContain('-X stream -S standby1 -R');
  });

  it('pg_basebackup -D 数据目录按版本插值（16/17/18 仅路径差异，无语法分支）', () => {
    const texts = (['16', '17', '18'] as const).map(
      (version) => buildReplicationHint(ctx({ mode: 'replica', version })).commands,
    );
    expect(texts[0]).toContain('-D /var/lib/postgresql/16/main');
    expect(texts[1]).toContain('-D /var/lib/postgresql/17/main');
    expect(texts[2]).toContain('-D /var/lib/postgresql/18/main');
    // 除 -D 路径外命令完全一致（16–18 语法一致）
    const normalize = (t: string) => t.replace(/\/var\/lib\/postgresql\/\d+\//g, '<PGDATA>');
    expect(normalize(texts[0])).toBe(normalize(texts[1]));
    expect(normalize(texts[1])).toBe(normalize(texts[2]));
  });

  it('备库要点覆盖官方三项 ≥ 主库、hot_standby 默认 on、-R 自动写 standby.signal 与 primary_conninfo/primary_slot_name', () => {
    const points = buildReplicationHint(ctx({ mode: 'replica' })).points.join('\n');
    for (const key of ['max_connections', 'max_worker_processes', 'max_wal_senders']) {
      expect(points, key).toContain(key);
    }
    expect(points).toContain('大于等于主库');
    expect(points).toContain('hot_standby');
    expect(points).toContain('standby.signal');
    expect(points).toContain('primary_conninfo');
    expect(points).toContain('primary_slot_name');
    expect(points).toContain('max_slot_wal_keep_size');
  });

  it('口令只出现占位符 "..."，不输出任何明文密码生成物', () => {
    const { commands, points } = buildReplicationHint(ctx({ mode: 'replica' }));
    const passwords = commands.match(/PASSWORD '[^']*'/g) ?? [];
    expect(passwords).toEqual(["PASSWORD '...'"]);
    expect(points.join('\n')).not.toMatch(/PASSWORD/);
  });
});
