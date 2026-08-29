// @vitest-environment happy-dom
/**
 * ParamRow 组件回归测试（合并自 mysql-config 与 redis-config 两套用例，组件上浮共享层）：
 * 五类控件的变更必须向父层 emit update。
 * 回归背景（两工具同款缺陷）：select/switch/数值输入曾只绑 :model-value 而漏绑
 * update 事件监听，导致枚举/布尔/数值参数无法被用户覆盖。
 * fixture 以 ConfigParamBase 形态构造，不依赖各工具 params.ts（共享层与工具解耦）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ParamRow from '../ParamRow.vue';
import type { ConfigParamBase, ParamValue } from '../types';

/** 已挂载实例登记表：afterEach 统一卸载，防 portal/异步更新残留引发崩溃 */
const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount();
  mounted.length = 0;
});

/** mountRow 可按用例覆盖的次要 props */
type RowExtraProps = Partial<{
  version: string;
  baselineVersion: string;
  hasOverride: boolean;
  deprecated: boolean;
  enableSecret: boolean;
  productLabel: string;
  placeholder: string;
}>;

/**
 * 构造最小参数定义（ConfigParamBase 形态，仅含被测控件所需字段）。
 * @param overrides - 必填的 key/control 之外的覆盖字段
 */
function makeParam(
  overrides: Partial<ConfigParamBase> & Pick<ConfigParamBase, 'key' | 'control'>,
): ConfigParamBase {
  return { comment: '测试参数说明', introducedIn: '5.7', ...overrides };
}

/** 挂载默认 props 的 ParamRow（extra 覆盖版本基线/密码开关等次要 props） */
function mountRow(param: ConfigParamBase, value: ParamValue | null, extra: RowExtraProps = {}) {
  const wrapper = mount(ParamRow, {
    props: {
      param,
      value,
      recommended: value,
      version: '8.0',
      baselineVersion: '5.7',
      hasOverride: false,
      ...extra,
    },
  });
  mounted.push(wrapper);
  return wrapper;
}

describe('ParamRow 控件 → update 事件联动', () => {
  it('select 变更时 emit update（枚举参数可覆盖，MySQL 形态）', async () => {
    const wrapper = mountRow(
      makeParam({
        key: 'transaction_isolation',
        control: 'select',
        introducedIn: '8.0',
        options: [
          { value: 'REPEATABLE-READ', label: 'REPEATABLE-READ — 可重复读' },
          { value: 'READ-COMMITTED', label: 'READ-COMMITTED — 读已提交' },
        ],
      }),
      'REPEATABLE-READ',
    );
    const select = wrapper.findComponent({ name: 'SelectListbox' });
    expect(select.exists()).toBe(true);
    select.vm.$emit('update:modelValue', 'READ-COMMITTED');
    await nextTick();
    expect(wrapper.emitted('update')?.[0]).toEqual(['READ-COMMITTED']);
  });

  it('select 变更时 emit update（枚举参数可覆盖，Redis 形态）', async () => {
    const wrapper = mountRow(
      makeParam({
        key: 'maxmemory-policy',
        control: 'select',
        introducedIn: 'pre-7',
        options: [
          { value: 'allkeys-lru', label: 'allkeys-lru — 全部键 LRU 淘汰' },
          { value: 'noeviction', label: 'noeviction — 内存满后拒绝写入' },
        ],
      }),
      'allkeys-lru',
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    const select = wrapper.findComponent({ name: 'SelectListbox' });
    expect(select.exists()).toBe(true);
    select.vm.$emit('update:modelValue', 'noeviction');
    await nextTick();
    expect(wrapper.emitted('update')?.[0]).toEqual(['noeviction']);
  });

  it('switch 点击时 emit update（布尔参数可覆盖，MySQL 形态）', async () => {
    const wrapper = mountRow(makeParam({ key: 'skip_name_resolve', control: 'switch' }), true);
    const switchButton = wrapper.find('[role="switch"]');
    expect(switchButton.exists()).toBe(true);
    await switchButton.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([false]);
  });

  it('switch 点击时 emit update（布尔参数可覆盖，Redis 形态）', async () => {
    const wrapper = mountRow(
      makeParam({ key: 'appendonly', control: 'switch', introducedIn: 'pre-7' }),
      false,
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    const switchButton = wrapper.find('[role="switch"]');
    expect(switchButton.exists()).toBe(true);
    await switchButton.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([true]);
  });

  it('数字输入框输入时 emit update（数值参数可覆盖，MySQL 形态）', async () => {
    const wrapper = mountRow(makeParam({ key: 'max_connections', control: 'number' }), 240);
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);
    await input.setValue('300');
    expect(wrapper.emitted('update')?.[0]).toEqual([300]);
  });

  it('数字输入框输入时 emit update（数值参数可覆盖，Redis 形态）', async () => {
    const wrapper = mountRow(
      makeParam({ key: 'timeout', control: 'number', introducedIn: 'pre-7' }),
      0,
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);
    await input.setValue('300');
    expect(wrapper.emitted('update')?.[0]).toEqual([300]);
  });

  it('quickOptions 由 range 数值项派生，同值档位名合并，点击 emit 值（MySQL 形态）', async () => {
    const wrapper = mountRow(
      makeParam({
        key: 'port',
        control: 'number',
        range: { conservative: 3306, recommended: 3306, aggressive: 3307 },
      }),
      3306,
    );
    // port 的保守/推荐均为 3306，label 合并为 "保守/推荐"；激进为 3307
    expect(wrapper.text()).toContain('保守/推荐 3306');
    expect(wrapper.text()).toContain('激进 3307');
    const aggressive = wrapper.findAll('button').find((b) => b.text().includes('3307'));
    expect(aggressive).toBeDefined();
    await aggressive!.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([3307]);
  });

  it('quickOptions 由 range 数值项派生，同值档位名合并，点击 emit 值（Redis 形态）', async () => {
    const wrapper = mountRow(
      makeParam({
        key: 'port',
        control: 'number',
        introducedIn: 'pre-7',
        range: { conservative: 6379, recommended: 6379, aggressive: 16379 },
      }),
      6379,
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    // port 的保守/推荐均为 6379，label 合并为 "保守/推荐"；激进为 16379
    expect(wrapper.text()).toContain('保守/推荐 6379');
    expect(wrapper.text()).toContain('激进 16379');
    const aggressive = wrapper.findAll('button').find((b) => b.text().includes('16379'));
    expect(aggressive).toBeDefined();
    await aggressive!.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([16379]);
  });

  it('range 含字符串项时显示参考文案且不渲染快捷按钮（MySQL 形态）', () => {
    const wrapper = mountRow(
      makeParam({
        key: 'innodb_buffer_pool_size',
        control: 'number',
        range: { conservative: '50% 内存', recommended: '60%~70% 内存', aggressive: '75% 内存' },
      }),
      2048,
    );
    expect(wrapper.text()).toContain('参考：保守 50% 内存 · 推荐 60%~70% 内存 · 激进 75% 内存');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('range 含字符串项时显示参考文案且不渲染快捷按钮（Redis 形态）', () => {
    const wrapper = mountRow(
      makeParam({
        key: 'maxmemory',
        control: 'number',
        introducedIn: 'pre-7',
        range: { conservative: '50% 内存', recommended: '60%~75% 内存', aggressive: '90% 内存' },
      }),
      2048,
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    expect(wrapper.text()).toContain('参考：保守 50% 内存 · 推荐 60%~75% 内存 · 激进 90% 内存');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('文本输入 emit update（MySQL 形态，bind_address 可覆盖）', async () => {
    const wrapper = mountRow(makeParam({ key: 'bind_address', control: 'text' }), '');
    const input = wrapper.find('input[type="text"]');
    await input.setValue('10.0.0.5');
    expect(wrapper.emitted('update')?.[0]).toEqual(['10.0.0.5']);
  });

  it('文本输入 emit update（Redis 形态，dbfilename 可覆盖）', async () => {
    const wrapper = mountRow(
      makeParam({ key: 'dbfilename', control: 'text', introducedIn: 'pre-7' }),
      'dump.rdb',
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    const input = wrapper.find('input[type="text"]');
    await input.setValue('dump-prod.rdb');
    expect(wrapper.emitted('update')?.[0]).toEqual(['dump-prod.rdb']);
  });

  it('multi-select 勾选键位 emit update（数组形态）', async () => {
    const wrapper = mountRow(
      makeParam({
        key: 'notify-keyspace-events',
        control: 'multi-select',
        introducedIn: 'pre-7',
        options: [
          { value: 'K', label: 'K — 键空间通知' },
          { value: 'E', label: 'E — 键事件通知' },
        ],
      }),
      [],
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setValue(true);
    expect(wrapper.emitted('update')?.[0]).toEqual([['K']]);
  });
});

describe('ParamRow 版本徽章与废弃提示行', () => {
  it('基线版本引入的参数不显示徽章，新版本引入的显示徽章（MySQL 5.7 基线）', () => {
    const baseline = mountRow(makeParam({ key: 'max_connections', control: 'number' }), 240);
    expect(baseline.text()).not.toContain('5.7+');
    const newer = mountRow(
      makeParam({
        key: 'transaction_isolation',
        control: 'select',
        introducedIn: '8.0',
        options: [{ value: 'REPEATABLE-READ', label: 'REPEATABLE-READ — 可重复读' }],
      }),
      'REPEATABLE-READ',
    );
    expect(newer.text()).toContain('8.0+');
  });

  it('deprecated=true 渲染废弃说明与替代参数，不渲染任何控件（MySQL 形态）', () => {
    const wrapper = mountRow(
      makeParam({
        key: 'tx_isolation',
        control: 'select',
        deprecatedIn: '8.0',
        replacedBy: 'transaction_isolation',
        options: [{ value: 'REPEATABLE-READ', label: 'REPEATABLE-READ — 可重复读' }],
      }),
      'REPEATABLE-READ',
      { deprecated: true },
    );
    expect(wrapper.text()).toContain('已废弃 8.0+');
    expect(wrapper.text()).toContain('transaction_isolation');
    expect(wrapper.findComponent({ name: 'SelectListbox' }).exists()).toBe(false);
  });

  it('deprecated=true 且无替代参数时提示移除该行（MySQL 形态）', () => {
    const wrapper = mountRow(
      makeParam({ key: 'query_cache_type', control: 'switch', deprecatedIn: '8.0' }),
      false,
      { deprecated: true },
    );
    expect(wrapper.text()).toContain('请从配置中移除该行');
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });

  it('deprecated=true 且无替代参数时提示移除该行（Redis 形态）', () => {
    const wrapper = mountRow(
      makeParam({
        key: 'io-threads-do-reads',
        control: 'switch',
        introducedIn: 'pre-7',
        deprecatedIn: '8.0',
      }),
      false,
      { version: '7.4', baselineVersion: 'pre-7', deprecated: true },
    );
    expect(wrapper.text()).toContain('已废弃 8.0+');
    expect(wrapper.text()).toContain('请从配置中移除该行');
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });

  it('replacedBy 存在时展示替代参数名（Redis 形态）', () => {
    const wrapper = mountRow(
      makeParam({
        key: 'lua-time-limit',
        control: 'number',
        introducedIn: 'pre-7',
        deprecatedIn: '8.0',
        replacedBy: 'busy-reply-threshold',
      }),
      null,
      { version: '7.4', baselineVersion: 'pre-7', deprecated: true },
    );
    expect(wrapper.text()).toContain('busy-reply-threshold');
  });
});

describe('ParamRow 密码生成按钮（generate-secret 事件）', () => {
  it('param.secret + enableSecret 时显示"生成"按钮，点击 emit generate-secret 且不改值', async () => {
    const wrapper = mountRow(
      makeParam({ key: 'requirepass', control: 'text', secret: true, introducedIn: 'pre-7' }),
      '',
      { version: '7.4', baselineVersion: 'pre-7', enableSecret: true },
    );
    const button = wrapper.findAll('button').find((b) => b.text() === '生成');
    expect(button).toBeDefined();
    expect(button!.attributes('title')).toContain('crypto.getRandomValues');
    await button!.trigger('click');
    expect(wrapper.emitted('generate-secret')?.length).toBe(1);
    // 密码生成逻辑已上移页面侧：组件内不再直接 emit update 写值
    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('未启用 enableSecret 时不渲染"生成"按钮', () => {
    const wrapper = mountRow(
      makeParam({ key: 'requirepass', control: 'text', secret: true, introducedIn: 'pre-7' }),
      '',
      { version: '7.4', baselineVersion: 'pre-7' },
    );
    expect(wrapper.findAll('button').find((b) => b.text() === '生成')).toBeUndefined();
  });
});
