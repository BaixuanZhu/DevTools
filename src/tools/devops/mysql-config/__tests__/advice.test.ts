/**
 * 附加建议区块单元测试（advice.ts）。
 * 重点验证复制初始化 SQL 的版本语法分支（8.0+ 新语法 / 5.7 旧语法）
 * 与占位符形态——SQL 直接面向用户复制执行，语法错误即为产品缺陷。
 */
import { describe, it, expect } from 'vitest';
import { buildOsAdvice, buildReplicationHint } from '../advice';

describe('buildOsAdvice', () => {
  it('覆盖 nofile / vm.swappiness / IO 调度 / 文件系统四类建议', () => {
    const advice = buildOsAdvice({ maxConnections: 240 });
    expect(advice).toHaveLength(4);
    expect(advice.map((a) => a.title)).toEqual([
      'ulimit nofile ≥ 65535',
      'vm.swappiness = 1',
      'I/O 调度器：NVMe/SSD 用 none',
      '文件系统：XFS / ext4 + noatime',
    ]);
  });

  it('nofile 说明联动 conf 的 max_connections 取值', () => {
    const advice = buildOsAdvice({ maxConnections: 1024 });
    expect(advice[0].reason).toContain('1024');
    expect(advice[0].command).toContain('65535');
  });
});

describe('buildReplicationHint', () => {
  it('8.0/8.4 输出 CHANGE REPLICATION SOURCE TO 新语法并提示 5.7 用 CHANGE MASTER TO', () => {
    const hint = buildReplicationHint({ version: '8.0', port: 3306 });
    expect(hint.sql).toContain('CHANGE REPLICATION SOURCE TO');
    expect(hint.sql).toContain("SOURCE_HOST = '<主库地址>'");
    expect(hint.sql).toContain('SOURCE_PORT = 3306');
    expect(hint.sql).toContain('SOURCE_AUTO_POSITION = 1');
    expect(hint.sql).toContain('START REPLICA;');
    expect(hint.sql).not.toContain('CHANGE MASTER TO');
    expect(hint.note).toContain('CHANGE MASTER TO');
  });

  it('8.4 保留 GET_MASTER_PUBLIC_KEY（caching_sha2_password 认证取公钥）', () => {
    const hint = buildReplicationHint({ version: '8.4', port: 3307 });
    expect(hint.sql).toContain('GET_MASTER_PUBLIC_KEY = 1');
    expect(hint.sql).toContain('SOURCE_PORT = 3307');
  });

  it('5.7 输出 CHANGE MASTER TO 旧语法（新语法在 5.7 无法执行）', () => {
    const hint = buildReplicationHint({ version: '5.7', port: 3306 });
    expect(hint.sql).toContain('CHANGE MASTER TO');
    expect(hint.sql).toContain("MASTER_HOST = '<主库地址>'");
    expect(hint.sql).toContain('MASTER_AUTO_POSITION = 1');
    expect(hint.sql).toContain('START SLAVE;');
    expect(hint.sql).not.toContain('CHANGE REPLICATION SOURCE TO');
    expect(hint.note).toContain('CHANGE REPLICATION SOURCE TO');
  });

  it('占位符齐全：主库地址/复制账号/复制密码均以尖括号占位，不要求用户提前准备真值', () => {
    const hint = buildReplicationHint({ version: '8.0', port: 3306 });
    expect(hint.sql).toContain('<主库地址>');
    expect(hint.sql).toContain('<复制账号>');
    expect(hint.sql).toContain('<复制密码>');
  });
});
