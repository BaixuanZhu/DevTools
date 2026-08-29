// @vitest-environment happy-dom
/**
 * ParamRow 组件回归测试：四类控件的变更必须向父层 emit update。
 * 回归背景（Redis 版同款缺陷）：select/switch/数值输入曾只绑 :model-value 而
 * 漏绑 update 事件监听，导致枚举/布尔/数值参数无法被用户覆盖。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ParamRow from '../components/ParamRow.vue';
import { getParam, type ParamValue } from '../params';
import type { MysqlVersion } from '../version';

/** 已挂载实例登记表：afterEach 统一卸载，防 portal/异步更新残留引发崩溃 */
const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount();
  mounted.length = 0;
});

/** 挂载默认 props 的 ParamRow */
function mountRow(key: string, value: ParamValue | null, extra: { deprecated?: boolean } = {}) {
  const wrapper = mount(ParamRow, {
    props: {
      param: getParam(key)!,
      value,
      recommended: value,
      version: '8.0' as MysqlVersion,
      hasOverride: false,
      ...extra,
    },
  });
  mounted.push(wrapper);
  return wrapper;
}

describe('ParamRow 控件 → update 事件联动', () => {
  it('select 变更时 emit update（枚举参数可覆盖）', async () => {
    const wrapper = mountRow('transaction_isolation', 'REPEATABLE-READ');
    const select = wrapper.findComponent({ name: 'SelectListbox' });
    expect(select.exists()).toBe(true);
    select.vm.$emit('update:modelValue', 'READ-COMMITTED');
    await nextTick();
    expect(wrapper.emitted('update')?.[0]).toEqual(['READ-COMMITTED']);
  });

  it('switch 点击时 emit update（布尔参数可覆盖）', async () => {
    const wrapper = mountRow('skip_name_resolve', true);
    const switchButton = wrapper.find('[role="switch"]');
    expect(switchButton.exists()).toBe(true);
    await switchButton.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([false]);
  });

  it('数字输入框输入时 emit update（数值参数可覆盖）', async () => {
    const wrapper = mountRow('max_connections', 240);
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);
    await input.setValue('300');
    expect(wrapper.emitted('update')?.[0]).toEqual([300]);
  });

  it('quickOptions 由 range 数值项派生，同值档位名合并，点击 emit 值', async () => {
    const wrapper = mountRow('port', 3306);
    // port 的保守/推荐均为 3306，label 合并为 "保守/推荐"；激进为 3307
    expect(wrapper.text()).toContain('保守/推荐 3306');
    expect(wrapper.text()).toContain('激进 3307');
    const aggressive = wrapper.findAll('button').find((b) => b.text().includes('3307'));
    expect(aggressive).toBeDefined();
    await aggressive!.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([3307]);
  });

  it('range 含字符串项时显示参考文案且不渲染快捷按钮', () => {
    const wrapper = mountRow('innodb_buffer_pool_size', 2048);
    expect(wrapper.text()).toContain('参考：保守 50% 内存 · 推荐 60%~70% 内存 · 激进 75% 内存');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('文本输入 emit update（bind_address 可覆盖）', async () => {
    const wrapper = mountRow('bind_address', '');
    const input = wrapper.find('input[type="text"]');
    await input.setValue('10.0.0.5');
    expect(wrapper.emitted('update')?.[0]).toEqual(['10.0.0.5']);
  });
});

describe('ParamRow 版本徽章与废弃提示行', () => {
  it('5.7 引入的参数不显示徽章，8.0 引入的显示 8.0+', () => {
    const baseline = mountRow('max_connections', 240);
    expect(baseline.text()).not.toContain('5.7+');
    const newer = mountRow('transaction_isolation', 'REPEATABLE-READ');
    expect(newer.text()).toContain('8.0+');
  });

  it('deprecated=true 渲染废弃说明与替代参数，不渲染任何控件', () => {
    const wrapper = mountRow('tx_isolation', 'REPEATABLE-READ', { deprecated: true });
    expect(wrapper.text()).toContain('已废弃 8.0+');
    expect(wrapper.text()).toContain('transaction_isolation');
    expect(wrapper.findComponent({ name: 'SelectListbox' }).exists()).toBe(false);
  });

  it('deprecated=true 且无替代参数时提示移除该行', () => {
    const wrapper = mountRow('query_cache_type', false, { deprecated: true });
    expect(wrapper.text()).toContain('请从配置中移除该行');
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });
});
