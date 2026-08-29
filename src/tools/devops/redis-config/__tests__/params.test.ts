/**
 * 参数定义表完整性单元测试（params.ts）。
 * 保证每条参数元数据结构自洽：控件必填字段、文档链接白名单、默认画像可生成。
 */
import { describe, it, expect } from 'vitest';
import {
  CONFIG_PARAMS,
  DOC_URLS,
  PARAM_GROUPS,
  createDefaultContext,
  getParam,
} from '../params';
import { resolveValue } from '../generate';
import { TARGET_VERSIONS, isAvailable } from '../version';

describe('参数定义完整性', () => {
  it('select / multi-select 参数必须提供选项', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.control === 'select' || param.control === 'multi-select') {
        expect(param.options?.length, param.key).toBeGreaterThan(0);
      }
    }
  });

  it('slider 参数必须提供 min < max 与正步长', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.control === 'slider') {
        expect(param.min, param.key).toBeDefined();
        expect(param.max, param.key).toBeDefined();
        expect(param.step, param.key).toBeGreaterThan(0);
        expect(param.min!, param.key).toBeLessThan(param.max!);
      }
    }
  });

  it('docUrl 必须来自官方文档白名单（redis.io 无逐参数页，禁编 URL）', () => {
    const whitelist = new Set<string>(Object.values(DOC_URLS));
    for (const param of CONFIG_PARAMS) {
      expect(whitelist.has(param.docUrl), `${param.key} → ${param.docUrl}`).toBe(true);
    }
  });

  it('引入版本不是 pre-7 的参数都落在目标轴内', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.introducedIn !== 'pre-7') {
        expect(TARGET_VERSIONS).toContain(param.introducedIn);
      }
    }
  });

  it('每个参数都挂在一个已定义分组上', () => {
    const groupIds = new Set(PARAM_GROUPS.map((g) => g.id));
    for (const param of CONFIG_PARAMS) expect(groupIds.has(param.group), param.key).toBe(true);
  });
});

describe('打开即用：默认画像下的参数适用性', () => {
  it('单机默认画像下：复制组不适用（null），凭据/绑定类为空（""）', () => {
    const ctx = createDefaultContext();
    const nullKeys = new Set(
      CONFIG_PARAMS.filter((p) => isAvailable(p, ctx.version))
        .filter((p) => resolveValue(p, ctx) === null)
        .map((p) => p.key),
    );
    expect([...nullKeys].sort()).toEqual([
      'masterauth',
      'min-replicas-max-lag',
      'min-replicas-to-write',
      'repl-backlog-size',
      'repl-diskless-sync',
      'replica-read-only',
      'replica-serve-stale-data',
      'replicaof',
    ]);
    const emptyKeys = new Set(
      CONFIG_PARAMS.filter((p) => isAvailable(p, ctx.version))
        .filter((p) => resolveValue(p, ctx) === '')
        .map((p) => p.key),
    );
    expect([...emptyKeys].sort()).toEqual(['bind', 'dir', 'requirepass']);
  });

  it('默认画像下所有生效值都为合法原始类型', () => {
    const ctx = createDefaultContext();
    for (const param of CONFIG_PARAMS) {
      const value = resolveValue(param, ctx);
      if (value === null) continue;
      expect(['string', 'number', 'boolean'].includes(typeof value) || Array.isArray(value), param.key).toBe(true);
    }
  });

  it('按 key 查找参数', () => {
    expect(getParam('maxmemory')?.group).toBe('memory');
    expect(getParam('no-such-param')).toBeUndefined();
  });
});
