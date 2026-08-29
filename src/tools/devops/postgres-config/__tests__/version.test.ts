/**
 * 版本过滤逻辑单元测试（version.ts + 参数版本标注）。
 * 重点验证 18-only 矩阵：异步 IO 组两参数（io_method/io_workers）在 16/17 不可用、
 * 18 可用，其余 37 条三版全可用；窗口内无弃用场景。
 * 版本元数据以 research/postgres-params-version-notes.md 为准。
 */
import { describe, it, expect } from 'vitest';
import {
  isAvailable,
  TARGET_VERSIONS,
  VERSION_ORDER,
  type PgVersion,
} from '../version';
import { CONFIG_PARAMS, getParam } from '../params';

describe('VERSION_ORDER 与版本轴', () => {
  it('序数单调递增', () => {
    expect(VERSION_ORDER['16']).toBeLessThan(VERSION_ORDER['17']);
    expect(VERSION_ORDER['17']).toBeLessThan(VERSION_ORDER['18']);
  });

  it('按钮组按升序覆盖三轴且含中文维护期标签', () => {
    expect(TARGET_VERSIONS.map((v) => v.value)).toEqual(['16', '17', '18']);
    expect(TARGET_VERSIONS.every((v) => /16|17|18/.test(v.label) && v.label.length > 2)).toBe(true);
  });
});

describe('isAvailable — 18-only 矩阵', () => {
  const IO_KEYS = ['io_method', 'io_workers'];

  it('异步 IO 组两项在 16/17 不可用、18 可用（18 新增 AIO 家族，16/17 无此参数）', () => {
    for (const key of IO_KEYS) {
      const param = getParam(key)!;
      expect(isAvailable(param, '16'), `${key}@16`).toBe(false);
      expect(isAvailable(param, '17'), `${key}@17`).toBe(false);
      expect(isAvailable(param, '18'), `${key}@18`).toBe(true);
      expect(param.introducedIn).toBe('18');
    }
  });

  it('其余 37 条三版全可用（窗口内无 rename/移除/默认值漂移落在本注册表）', () => {
    const others = CONFIG_PARAMS.filter((p) => !IO_KEYS.includes(p.key));
    expect(others).toHaveLength(37);
    for (const param of others) {
      for (const version of ['16', '17', '18'] as const) {
        expect(isAvailable(param, version), `${param.key}@${version}`).toBe(true);
      }
    }
  });

  it('isAvailable 与 availableIn 数据一致（全参数 × 三版本矩阵）', () => {
    const versions: PgVersion[] = ['16', '17', '18'];
    for (const param of CONFIG_PARAMS) {
      for (const version of versions) {
        expect(isAvailable(param, version), `${param.key}@${version}`).toBe(param.availableIn.includes(version));
      }
    }
  });

  it('16/17 轴不输出任何 18 独有参数（整组异步 IO 隐藏，generate 侧跳过后无残留）', () => {
    for (const version of ['16', '17'] as const) {
      const hidden = CONFIG_PARAMS.filter((p) => !isAvailable(p, version)).map((p) => p.key);
      expect(hidden.sort()).toEqual(['io_method', 'io_workers']);
    }
  });
});
