// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import OptionRadioGroup from '../OptionRadioGroup.vue';

describe('OptionRadioGroup.vue', () => {
  it('渲染全部选项，选中项 role=radio + aria-checked=true + data-state=checked', () => {
    const wrapper = mount(OptionRadioGroup, {
      props: {
        modelValue: 'b',
        options: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ],
      },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios).toHaveLength(2);
    const checked = radios.find((r) => r.attributes('aria-checked') === 'true')!;
    expect(checked.text()).toBe('乙');
    expect(checked.attributes('data-state')).toBe('checked');
  });

  it('点击未选项 → emit update:modelValue 为该值（string）', async () => {
    const wrapper = mount(OptionRadioGroup, {
      props: {
        modelValue: 'a',
        options: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ],
      },
    });
    await wrapper.findAll('[role="radio"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b']);
  });

  it('泛型支持 number 值', async () => {
    const wrapper = mount(OptionRadioGroup, {
      props: {
        modelValue: 1,
        options: [
          { value: 1, label: '一' },
          { value: 2, label: '二' },
        ],
      },
    });
    await wrapper.findAll('[role="radio"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([2]);
  });
});
