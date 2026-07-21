// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TextToolbox from '../TextToolbox.vue';

describe('TextToolbox.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('挂载渲染，查找替换面板默认隐藏', () => {
    const wrapper = mount(TextToolbox);
    expect(wrapper.find('textarea').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('查找内容');
  });

  it('点击查找替换按钮 → 面板展开（含「查找内容」输入框）', async () => {
    const wrapper = mount(TextToolbox, { attachTo: document.body });
    // reka-ui CollapsibleTrigger 使用原生 onClick（与 SelectTrigger/TabsTrigger 的 pointerdown 不同），click 即可触发
    await wrapper.get('button[aria-label="查找替换"]').trigger('click');
    await nextTick();
    expect(wrapper.find('input[aria-label="查找内容"]').exists()).toBe(true);
  });

  it('再次点击 → 面板收起', async () => {
    const wrapper = mount(TextToolbox, { attachTo: document.body });
    await wrapper.get('button[aria-label="查找替换"]').trigger('click');
    await nextTick();
    await wrapper.get('button[aria-label="查找替换"]').trigger('click');
    await nextTick();
    expect(wrapper.find('input[aria-label="查找内容"]').exists()).toBe(false);
  });
});
