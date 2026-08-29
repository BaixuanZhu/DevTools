/**
 * 版本过滤逻辑单元测试（version.ts + 参数版本标注）。
 * 重点验证轴点安全方向矩阵：补丁级引入的新名参数（replica_*、innodb_redo_log_capacity）
 * 禁止映射到 8.0 轴输出——8.0.0-8.0.25 会因未知变量启动失败。
 * 版本元数据以 research/mysql-params-version-notes.md 为准。
 */
import { describe, it, expect } from 'vitest';
import {
  isAvailable,
  isDeprecatedAt,
  showsDeprecationNotice,
  VERSION_ORDER,
  TARGET_VERSIONS,
  type MysqlVersion,
} from '../version';
import { CONFIG_PARAMS, getParam } from '../params';

describe('VERSION_ORDER 与版本轴', () => {
  it('序数单调递增', () => {
    expect(VERSION_ORDER['5.7']).toBeLessThan(VERSION_ORDER['8.0']);
    expect(VERSION_ORDER['8.0']).toBeLessThan(VERSION_ORDER['8.4']);
  });

  it('按钮组按升序覆盖三轴且含显示文案', () => {
    expect(TARGET_VERSIONS.map((v) => v.value)).toEqual(['5.7', '8.0', '8.4']);
    expect(TARGET_VERSIONS.every((v) => v.label.length > 0)).toBe(true);
  });
});

describe('isAvailable — 轴点安全方向矩阵', () => {
  it('5.7 轴：slave_parallel_workers 可用，preserve_commit_order / replica_* / innodb_redo_log_capacity 不可用', () => {
    const available = ['slave_parallel_workers', 'tx_isolation', 'expire_logs_days', 'query_cache_size', 'query_cache_type', 'innodb_log_file_size', 'default_authentication_plugin'];
    const unavailable = ['slave_preserve_commit_order', 'replica_parallel_workers', 'replica_preserve_commit_order', 'innodb_redo_log_capacity', 'transaction_isolation', 'binlog_expire_logs_seconds'];
    for (const key of available) expect(isAvailable(getParam(key)!, '5.7'), key).toBe(true);
    for (const key of unavailable) expect(isAvailable(getParam(key)!, '5.7'), key).toBe(false);
  });

  it('8.0 轴：slave_* 可用且 replica_* / innodb_redo_log_capacity 不可用（新名 8.0.26/8.0.30 补丁级引入）', () => {
    const available = ['slave_parallel_workers', 'slave_preserve_commit_order', 'transaction_isolation', 'binlog_expire_logs_seconds', 'innodb_log_file_size', 'default_authentication_plugin', 'innodb_buffer_pool_instances'];
    const unavailable = ['replica_parallel_workers', 'replica_preserve_commit_order', 'innodb_redo_log_capacity', 'tx_isolation', 'expire_logs_days', 'query_cache_size', 'query_cache_type'];
    for (const key of available) expect(isAvailable(getParam(key)!, '8.0'), key).toBe(true);
    for (const key of unavailable) expect(isAvailable(getParam(key)!, '8.0'), key).toBe(false);
  });

  it('8.4 轴：replica_* / innodb_redo_log_capacity 可用且 slave_* / default_authentication_plugin 不可用', () => {
    const available = ['replica_parallel_workers', 'replica_preserve_commit_order', 'innodb_redo_log_capacity', 'transaction_isolation', 'binlog_expire_logs_seconds'];
    const unavailable = ['slave_parallel_workers', 'slave_preserve_commit_order', 'default_authentication_plugin', 'innodb_buffer_pool_instances', 'innodb_log_file_size', 'tx_isolation', 'expire_logs_days', 'query_cache_size', 'query_cache_type'];
    for (const key of available) expect(isAvailable(getParam(key)!, '8.4'), key).toBe(true);
    for (const key of unavailable) expect(isAvailable(getParam(key)!, '8.4'), key).toBe(false);
  });

  it('authentication_policy 不进注册表（8.0.27 引入，按轴点安全方向禁映射到 8.0 轴，8.4 由注释说明）', () => {
    expect(getParam('authentication_policy')).toBeUndefined();
  });

  it('query_cache 家族仅 5.7 可用（8.0 整体移除）', () => {
    for (const key of ['query_cache_size', 'query_cache_type']) {
      expect(isAvailable(getParam(key)!, '5.7'), key).toBe(true);
      expect(isAvailable(getParam(key)!, '8.0'), key).toBe(false);
      expect(isAvailable(getParam(key)!, '8.4'), key).toBe(false);
    }
  });

  it('5 组改名对/替换对在每条轴上恰好一侧可用（低版本不出现高版本参数）', () => {
    const pairs: Array<{ oldKey: string; newKey: string; oldAxes: MysqlVersion[]; newAxes: MysqlVersion[] }> = [
      { oldKey: 'tx_isolation', newKey: 'transaction_isolation', oldAxes: ['5.7'], newAxes: ['8.0', '8.4'] },
      { oldKey: 'innodb_log_file_size', newKey: 'innodb_redo_log_capacity', oldAxes: ['5.7', '8.0'], newAxes: ['8.4'] },
      { oldKey: 'expire_logs_days', newKey: 'binlog_expire_logs_seconds', oldAxes: ['5.7'], newAxes: ['8.0', '8.4'] },
      { oldKey: 'slave_parallel_workers', newKey: 'replica_parallel_workers', oldAxes: ['5.7', '8.0'], newAxes: ['8.4'] },
      { oldKey: 'slave_preserve_commit_order', newKey: 'replica_preserve_commit_order', oldAxes: ['8.0'], newAxes: ['8.4'] },
    ];
    for (const pair of pairs) {
      for (const v of TARGET_VERSIONS.map((o) => o.value)) {
        expect(isAvailable(getParam(pair.oldKey)!, v), `${pair.oldKey}@${v}`).toBe(pair.oldAxes.includes(v));
        expect(isAvailable(getParam(pair.newKey)!, v), `${pair.newKey}@${v}`).toBe(pair.newAxes.includes(v));
      }
    }
  });
});

describe('废弃提示判断', () => {
  it('tx_isolation 在 8.0 废弃且指向 transaction_isolation', () => {
    const param = getParam('tx_isolation')!;
    expect(isDeprecatedAt(param, '5.7')).toBe(false);
    expect(isDeprecatedAt(param, '8.0')).toBe(true);
    expect(showsDeprecationNotice(param)).toBe(true);
    expect(param.replacedBy).toBe('transaction_isolation');
  });

  it('innodb_log_file_size 8.0.30 废弃但 8.0 轴仍可用（8.0.30 起的废弃写进注释），8.4 才从轴上移除', () => {
    const param = getParam('innodb_log_file_size')!;
    expect(isAvailable(param, '8.0')).toBe(true);
    expect(isDeprecatedAt(param, '8.4')).toBe(true);
    expect(param.deprecatedIn).toBe('8.4');
    expect(param.replacedBy).toBe('innodb_redo_log_capacity');
  });

  it('default_authentication_plugin 8.4 移除且无注册表内的替代参数（authentication_policy 禁入 8.0 轴）', () => {
    const param = getParam('default_authentication_plugin')!;
    expect(isDeprecatedAt(param, '8.4')).toBe(true);
    expect(param.replacedBy).toBeUndefined();
  });
});

describe('数据完整性', () => {
  it('参数 key 全局唯一', () => {
    const keys = CONFIG_PARAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
