/**
 * 参数定义表完整性单元测试（params.ts）。
 * 保证每条参数元数据结构自洽：控件必填字段、文档链接白名单（仅 postgresql.org）、
 * 分组归属与条目计数（9 组 39 条）、打开即用默认画像可生成，
 * 以及 reka-ui 硬约束（select 选项值非空串）。
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
import { TARGET_VERSIONS, type PgVersion } from '../version';

/** 版本轴取值数组（availableIn 白名单断言用） */
const AXES: readonly PgVersion[] = TARGET_VERSIONS.map((v) => v.value);

describe('参数定义完整性', () => {
  it('分组数定稿为 9，参数条目数定稿为 39', () => {
    expect(PARAM_GROUPS).toHaveLength(9);
    expect(CONFIG_PARAMS).toHaveLength(39);
  });

  it('各组条目数：连接认证 5 / 内存 5 / WAL 7 / 复制 3 / 并行 7 / 自动清理 4 / 日志 4 / 异步 IO 2 / 时区 2', () => {
    const counts = Object.fromEntries(PARAM_GROUPS.map((g) => [g.id, CONFIG_PARAMS.filter((p) => p.group === g.id).length]));
    expect(counts).toEqual({
      connections: 5,
      memory: 5,
      wal: 7,
      replication: 3,
      parallel: 7,
      autovacuum: 4,
      logging: 4,
      'async-io': 2,
      timezone: 2,
    });
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

  it('docUrl 必填且来自官方文档白名单（仅 postgresql.org/docs 域，禁编 URL）', () => {
    const whitelist = new Set<string>(Object.values(DOC_URLS));
    for (const param of CONFIG_PARAMS) {
      expect(param.docUrl, param.key).toBeTruthy();
      expect(param.docUrl.startsWith('https://www.postgresql.org/docs/'), `${param.key} → ${param.docUrl}`).toBe(true);
      expect(whitelist.has(param.docUrl), `${param.key} → ${param.docUrl}`).toBe(true);
    }
  });

  it('introducedIn 落在三点版本轴内；availableIn 为轴的非空子集', () => {
    for (const param of CONFIG_PARAMS) {
      expect(AXES, `${param.key} introducedIn`).toContain(param.introducedIn);
      expect(param.availableIn.length, `${param.key} availableIn`).toBeGreaterThan(0);
      for (const v of param.availableIn) {
        expect(AXES, `${param.key} availableIn 项 ${v}`).toContain(v);
      }
    }
  });

  it('窗口内无弃用参数：任何条目不得声明 deprecatedIn/replacedBy（设计 §4：无弃用徽章场景）', () => {
    for (const param of CONFIG_PARAMS) {
      expect(param.deprecatedIn, param.key).toBeUndefined();
      expect(param.replacedBy, param.key).toBeUndefined();
    }
  });

  it('compute 与 defaultValue 互斥完备：静态项必有 defaultValue，动态项必无 defaultValue', () => {
    for (const param of CONFIG_PARAMS) {
      if (param.compute) {
        expect(param.defaultValue, `${param.key} 不应带 defaultValue`).toBeUndefined();
      } else {
        expect(param.defaultValue, `${param.key} 缺 defaultValue`).toBeDefined();
      }
    }
  });

  it('每个参数都挂在一个已定义分组上，且数组顺序按组排列', () => {
    const groupOrder = PARAM_GROUPS.map((g) => g.id);
    let last = -1;
    for (const param of CONFIG_PARAMS) {
      const idx = groupOrder.indexOf(param.group);
      expect(idx, param.key).toBeGreaterThanOrEqual(0);
      expect(idx, `${param.key} 的组顺序应单调`).toBeGreaterThanOrEqual(last);
      last = idx;
    }
  });

  it('参数 key 全局唯一', () => {
    const keys = CONFIG_PARAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('quoted 标记仅用于自由文本参数（listen_addresses/log_line_prefix/timezone/log_timezone）', () => {
    const expected = new Set(['listen_addresses', 'log_line_prefix', 'timezone', 'log_timezone']);
    for (const param of CONFIG_PARAMS) {
      if (param.quoted) expect(expected.has(param.key), param.key).toBe(true);
      else expect(expected.has(param.key), `${param.key} 不应带 quoted`).toBe(false);
    }
  });
});

describe('打开即用：默认画像下的参数适用性', () => {
  it('默认画像为 4GB / 4 核 / SSD / 通用 OLTP / 并发 200 / 单机 / 仅本机 / 5432 / 版本 17', () => {
    const ctx = createDefaultContext();
    expect(ctx).toMatchObject({
      version: '17',
      mode: 'single',
      memoryGB: 4,
      cpuCores: 4,
      diskType: 'ssd',
      scenario: 'oltp',
      concurrency: 200,
      listenScope: 'loopback',
      bindIp: '',
      port: 5432,
      overrides: {},
    });
  });

  it('默认画像下所有参数都有生效值（无 null 遗漏——PG 无"上下文不适用"返回 null 的建模）', () => {
    const ctx = createDefaultContext();
    for (const param of CONFIG_PARAMS) {
      expect(resolveValue(param, ctx) !== null, param.key).toBe(true);
    }
  });

  it('主从默认画像（填了内网绑定 IP）下同样全部有生效值', () => {
    const ctx = {
      ...createDefaultContext(),
      mode: 'replica' as const,
      listenScope: 'intranet' as const,
      bindIp: '10.0.0.5',
    };
    for (const param of CONFIG_PARAMS) {
      expect(resolveValue(param, ctx) !== null, param.key).toBe(true);
    }
  });

  it('按 key 查找参数', () => {
    expect(getParam('shared_buffers')?.group).toBe('memory');
    expect(getParam('io_method')?.availableIn).toEqual(['18']);
    expect(getParam('no-such-param')).toBeUndefined();
  });
});
