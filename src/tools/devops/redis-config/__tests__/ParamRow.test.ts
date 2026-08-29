// @vitest-environment happy-dom
/**
 * ParamRow 组件回归测试：五类控件的变更必须向父层 emit update。
 * 回归背景：曾出现 select/switch/数值输入只绑 :model-value 而漏绑
 * update 事件监听的缺陷，导致枚举/布尔/数值参数无法被用户覆盖。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ParamRow from '../components/ParamRow.vue';
import { getParam, type ParamValue } from '../params';
import type { TargetVersion } from '../version';

/** 挂载默认 props 的 ParamRow */
function mountRow(key: string, value: ParamValue | null, extra: { deprecated?: boolean } = {}) {
  return mount(ParamRow, {
    props: {
      param: getParam(key)!,
      value,
      recommended: value,
      version: '7.4' as TargetVersion,
      hasOverride: false,
      ...extra,
    },
  });
}

describe('ParamRow 控件 → update 事件联动', () => {
  it('select 变更时 emit update（枚举参数可覆盖）', async () => {
    const wrapper = mountRow('maxmemory-policy', 'allkeys-lru');
    const select = wrapper.findComponent({ name: 'SelectListbox' });
    expect(select.exists()).toBe(true);
    select.vm.$emit('update:modelValue', 'noeviction');
    await nextTick();
    expect(wrapper.emitted('update')?.[0]).toEqual(['noeviction']);
  });

  it('switch 点击时 emit update（布尔参数可覆盖）', async () => {
    const wrapper = mountRow('appendonly', false);
    const switchButton = wrapper.find('[role="switch"]');
    expect(switchButton.exists()).toBe(true);
    await switchButton.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([true]);
  });

  it('数字输入框输入时 emit update（数值参数可覆盖）', async () => {
    const wrapper = mountRow('timeout', 0);
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);
    await input.setValue('300');
    expect(wrapper.emitted('update')?.[0]).toEqual([300]);
  });

  it('quickOptions 由 range 数值项派生，同值档位名合并，点击 emit 值', async () => {
    const wrapper = mountRow('port', 6379);
    // port 的保守/推荐均为 6379，label 合并为 "保守/推荐"；激进为 16379
    expect(wrapper.text()).toContain('保守/推荐 6379');
    expect(wrapper.text()).toContain('激进 16379');
    const aggressive = wrapper.findAll('button').find((b) => b.text().includes('16379'));
    expect(aggressive).toBeDefined();
    await aggressive!.trigger('click');
    expect(wrapper.emitted('update')?.[0]).toEqual([16379]);
  });

  it('range 含字符串项时显示参考文案且不渲染快捷按钮', () => {
    const wrapper = mountRow('maxmemory', 2048);
    expect(wrapper.text()).toContain('参考：保守 50% 内存 · 推荐 60%~75% 内存 · 激进 90% 内存');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('文本输入 emit update（文本参数可覆盖）', async () => {
    const wrapper = mountRow('dbfilename', 'dump.rdb');
    const input = wrapper.find('input[type="text"]');
    await input.setValue('dump-prod.rdb');
    expect(wrapper.emitted('update')?.[0]).toEqual(['dump-prod.rdb']);
  });

  it('multi-select 勾选键位 emit update（数组形态）', async () => {
    const wrapper = mountRow('notify-keyspace-events', []);
    const checkbox = wrapper.find('input[type="checkbox"]');
    await checkbox.setValue(true);
    expect(wrapper.emitted('update')?.[0]).toEqual([['K']]);
  });
});

describe('ParamRow 废弃提示行', () => {
  it('deprecated=true 渲染废弃说明与替代参数，不渲染任何控件', () => {
    const wrapper = mountRow('io-threads-do-reads', false, { deprecated: true });
    expect(wrapper.text()).toContain('已废弃 8.0+');
    expect(wrapper.text()).toContain('请从配置中移除该行');
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });

  it('replacedBy 存在时展示替代参数名', () => {
    const wrapper = mountRow('lua-time-limit', null, { deprecated: true });
    expect(wrapper.text()).toContain('busy-reply-threshold');
  });
});
