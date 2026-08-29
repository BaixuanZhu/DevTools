/**
 * Redis 版本过滤逻辑单元测试（version.ts + 参数版本标注）。
 * 版本元数据以 research/redis-params-version-notes.md 为准。
 */
import { describe, it, expect } from 'vitest';
import {
  isAvailable,
  isDeprecatedAt,
  showsDeprecationNotice,
  VERSION_ORDER,
  TARGET_VERSIONS,
  type TargetVersion,
} from '../version';
import { CONFIG_PARAMS, getParam } from '../params';

describe('VERSION_ORDER', () => {
  it('序数单调递增，pre-7 恒早于所有目标版本', () => {
    expect(VERSION_ORDER['pre-7']).toBeLessThan(VERSION_ORDER['7.0']);
    expect(VERSION_ORDER['7.0']).toBeLessThan(VERSION_ORDER['7.2']);
    expect(VERSION_ORDER['7.2']).toBeLessThan(VERSION_ORDER['7.4']);
    expect(VERSION_ORDER['7.4']).toBeLessThan(VERSION_ORDER['8.0']);
    expect(VERSION_ORDER['8.0']).toBeLessThan(VERSION_ORDER['8.2']);
    expect(VERSION_ORDER['8.2']).toBeLessThan(VERSION_ORDER['8.4']);
  });

  it('目标版本轴不含 pre-7，且覆盖 8.2/8.4（2026-08-29 扩容，行为同 8.0）', () => {
    expect(TARGET_VERSIONS).toEqual(['7.0', '7.2', '7.4', '8.0', '8.2', '8.4']);
    expect(TARGET_VERSIONS).not.toContain('pre-7');
  });
});

describe('isAvailable — 按引入版本过滤', () => {
  it('pre-7 参数在全部目标版本可用', () => {
    const param = getParam('protected-mode')!;
    for (const v of TARGET_VERSIONS) expect(isAvailable(param, v)).toBe(true);
  });

  it('7.0 引入的参数（appenddirname）自 7.0 起可用', () => {
    const param = getParam('appenddirname')!;
    expect(isAvailable(param, '7.0')).toBe(true);
    expect(isAvailable(param, '8.0')).toBe(true);
  });

  it('7.2 引入的 set-max-listpack-entries 在 7.0 不可用', () => {
    const param = getParam('set-max-listpack-entries')!;
    expect(isAvailable(param, '7.0')).toBe(false);
    expect(isAvailable(param, '7.2')).toBe(true);
    expect(isAvailable(param, '8.0')).toBe(true);
  });

  it('7.2 引入的 set-max-listpack-entries 在 8.2/8.4 仍可用（无新增废弃）', () => {
    const param = getParam('set-max-listpack-entries')!;
    expect(isAvailable(param, '8.2')).toBe(true);
    expect(isAvailable(param, '8.4')).toBe(true);
  });

  it('7.4 引入的 hide-user-data-from-log 在 7.2 不可用', () => {
    const param = getParam('hide-user-data-from-log')!;
    expect(isAvailable(param, '7.2')).toBe(false);
    expect(isAvailable(param, '7.4')).toBe(true);
  });

  it('8.0 引入的 replica-full-sync-buffer-limit 在 7.4 不可用', () => {
    const param = getParam('replica-full-sync-buffer-limit')!;
    expect(isAvailable(param, '7.4')).toBe(false);
    expect(isAvailable(param, '8.0')).toBe(true);
  });
});

describe('isAvailable — 废弃参数排除', () => {
  it('io-threads-do-reads 在 7.4 可用、8.0 废弃且无替代参数', () => {
    const param = getParam('io-threads-do-reads')!;
    expect(isAvailable(param, '7.4')).toBe(true);
    expect(isAvailable(param, '8.0')).toBe(false);
    expect(param.deprecatedIn).toBe('8.0');
    expect(param.replacedBy).toBeUndefined();
  });

  it('io-threads-do-reads 在 8.2/8.4 仍不可用（8.0 废弃沿用至轴末）', () => {
    const param = getParam('io-threads-do-reads')!;
    expect(isAvailable(param, '8.2')).toBe(false);
    expect(isAvailable(param, '8.4')).toBe(false);
  });

  it('旧名别名 lua-time-limit 在整个目标轴均不可用，登记 replacedBy 溯源', () => {
    const param = getParam('lua-time-limit')!;
    for (const v of TARGET_VERSIONS) expect(isAvailable(param, v)).toBe(false);
    expect(param.deprecatedIn).toBe('7.0');
    expect(param.replacedBy).toBe('busy-reply-threshold');
  });

  it('ziplist 系旧名别名在全部目标版本不可用，且指向 listpack 新名', () => {
    const aliases: Array<[string, string]> = [
      ['hash-max-ziplist-entries', 'hash-max-listpack-entries'],
      ['hash-max-ziplist-value', 'hash-max-listpack-value'],
      ['list-max-ziplist-size', 'list-max-listpack-size'],
      ['zset-max-ziplist-entries', 'zset-max-listpack-entries'],
      ['zset-max-ziplist-value', 'zset-max-listpack-value'],
    ];
    for (const [oldKey, newKey] of aliases) {
      const param = getParam(oldKey)!;
      for (const v of TARGET_VERSIONS) expect(isAvailable(param, v as TargetVersion)).toBe(false);
      expect(param.replacedBy).toBe(newKey);
    }
  });

  it('新名 listpack 参数在 7.0 起可用（与旧名相反）', () => {
    const param = getParam('list-max-listpack-size')!;
    expect(isAvailable(param, '7.0')).toBe(true);
  });
});

describe('废弃提示行判断', () => {
  it('io-threads-do-reads（轴内可用过、8.0 才废弃）保留废弃提示行', () => {
    const param = getParam('io-threads-do-reads')!;
    expect(showsDeprecationNotice(param)).toBe(true);
    expect(isDeprecatedAt(param, '8.0')).toBe(true);
    expect(isDeprecatedAt(param, '7.4')).toBe(false);
  });

  it('自 7.0 起就废弃的旧名别名不进面板', () => {
    expect(showsDeprecationNotice(getParam('lua-time-limit')!)).toBe(false);
    expect(showsDeprecationNotice(getParam('hash-max-ziplist-entries')!)).toBe(false);
  });
});

describe('数据完整性', () => {
  it('参数 key 全局唯一', () => {
    const keys = CONFIG_PARAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('replacedBy 指向的替代参数必须存在', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.replacedBy) expect(getParam(param.replacedBy), param.key).toBeDefined();
    }
  });
});
