// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ToggleSwitch from '../ToggleSwitch.vue';

describe('ToggleSwitch.vue', () => {
  it('渲染 label 与状态文字，root 为 role=switch', () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: '自动', description: '关' },
    });
    const switchEl = wrapper.find('[role="switch"]');
    expect(switchEl.exists()).toBe(true);
    expect(wrapper.text()).toContain('自动');
    expect(wrapper.text()).toContain('关');
  });

  it('点击切换 → emit update:modelValue 为 true', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false } });
    await wrapper.get('[role="switch"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
  });

  it('modelValue=true 时 thumb 带 translate-x-4', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: true } });
    expect(wrapper.get('[role="switch"]').html()).toContain('translate-x-4');
  });
});
