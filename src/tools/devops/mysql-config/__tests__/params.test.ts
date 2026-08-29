/**
 * 参数定义表完整性单元测试（params.ts）。
 * 保证每条参数元数据结构自洽：控件必填字段、文档链接白名单、分组归属、
 * 打开即用默认画像可生成，以及 reka-ui 硬约束（select 选项值非空串）。
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
import { isAvailable, TARGET_VERSIONS } from '../version';

/** 版本轴取值数组（isAvailable 断言用） */
const AXES = TARGET_VERSIONS.map((v) => v.value);

describe('参数定义完整性', () => {
  it('分组数定稿为 9，参数条目数定稿为 41（含 5 组改名对/替换对的两侧条目）', () => {
    expect(PARAM_GROUPS).toHaveLength(9);
    expect(CONFIG_PARAMS).toHaveLength(41);
  });

  it('select 参数必须提供选项', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.control === 'select') {
        expect(param.options?.length, param.key).toBeGreaterThan(0);
      }
    }
  });

  it('所有选项值禁止空串（reka-ui SelectItem 对空串 value 抛错，Redis 侧曾有面板不可交互的回归）', () => {
    for (const param of CONFIG_PARAMS) {
      for (const option of param.options ?? []) {
        expect(option.value, `${param.key} 选项 "${option.label}"`).not.toBe('');
      }
    }
  });

  it('number 参数必须提供 min < max 与正步长', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.control === 'number') {
        expect(param.min, param.key).toBeDefined();
        expect(param.max, param.key).toBeDefined();
        expect(param.step, param.key).toBeGreaterThan(0);
        expect(param.min!, param.key).toBeLessThan(param.max!);
      }
    }
  });

  it('docUrl 必须来自官方文档白名单（dev.mysql.com/doc/refman 锚点页，禁编 URL）', () => {
    const whitelist = new Set<string>(Object.values(DOC_URLS));
    for (const param of CONFIG_PARAMS) {
      expect(whitelist.has(param.docUrl), `${param.key} → ${param.docUrl}`).toBe(true);
    }
  });

  it('引入/废弃版本都落在三点版本轴内（补丁级精度写进注释，不进枚举）', () => {
    for (const param of CONFIG_PARAMS) {
      expect(AXES, `${param.key} introducedIn`).toContain(param.introducedIn);
      if (param.deprecatedIn) expect(AXES, `${param.key} deprecatedIn`).toContain(param.deprecatedIn);
    }
  });

  it('每个参数都挂在一个已定义分组上', () => {
    const groupIds = new Set(PARAM_GROUPS.map((g) => g.id));
    for (const param of CONFIG_PARAMS) expect(groupIds.has(param.group), param.key).toBe(true);
  });

  it('参数 key 全局唯一', () => {
    const keys = CONFIG_PARAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('replacedBy 指向的替代参数必须存在', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.replacedBy) expect(getParam(param.replacedBy), param.key).toBeDefined();
    }
  });

  it('query_cache 家族整体移除，不得声明替代参数', () => {
    expect(getParam('query_cache_size')?.replacedBy).toBeUndefined();
    expect(getParam('query_cache_type')?.replacedBy).toBeUndefined();
  });
});

describe('打开即用：默认画像下的参数适用性', () => {
  it('默认画像为 4GB / SSD / 通用 OLTP / 8.0 / 并发 200 / 单机 / 所有接口 / 3306', () => {
    const ctx = createDefaultContext();
    expect(ctx).toMatchObject({
      mode: 'standalone',
      memoryGB: 4,
      diskType: 'ssd',
      scenario: 'oltp',
      version: '8.0',
      concurrency: 200,
      listenScope: 'all',
      port: 3306,
    });
  });

  it('单机默认画像下：复制组全部不适用（null）、bind-address 不输出（null）', () => {
    const ctx = createDefaultContext();
    const nullKeys = new Set(
      CONFIG_PARAMS.filter((p) => isAvailable(p, ctx.version))
        .filter((p) => resolveValue(p, ctx) === null)
        .map((p) => p.key),
    );
    expect([...nullKeys].sort()).toEqual([
      'bind_address',
      'enforce_gtid_consistency',
      'gtid_mode',
      'read_only',
      'relay_log_recovery',
      'server_id',
      'slave_parallel_workers',
      'slave_preserve_commit_order',
      'super_read_only',
    ]);
  });

  it('主从默认画像（8.0 轴、填了内网绑定 IP）下：全部可用参数都有推荐值（无空值遗漏）', () => {
    const ctx = {
      ...createDefaultContext(),
      mode: 'replica' as const,
      listenScope: 'intranet' as const,
      bindIp: '10.0.0.5',
    };
    for (const param of CONFIG_PARAMS) {
      if (!isAvailable(param, ctx.version)) continue;
      const value = resolveValue(param, ctx);
      expect(value !== null, param.key).toBe(true);
    }
  });

  it('按 key 查找参数', () => {
    expect(getParam('innodb_buffer_pool_size')?.group).toBe('memory');
    expect(getParam('no-such-param')).toBeUndefined();
  });
});
