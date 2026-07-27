// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SearchPanel from '../SearchPanel.vue';

describe('SearchPanel.vue（下拉直达模式）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('空输入 → 不展示下拉建议', () => {
    const wrapper = mount(SearchPanel);
    expect(wrapper.find('input').exists()).toBe(true);
    // 下拉容器不存在（v-if="isOpen"）
    expect(wrapper.find('ul').exists()).toBe(false);
  });

  it('输入匹配词 → 下拉列出命中工具，直达链接为 tool.path', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    const items = wrapper.findAll('ul li a');
    expect(items.length).toBeGreaterThan(0);
    // JWT 解析工具应命中，链接指向新路径
    const jwtItem = items.wrappers.find((a) => a.text().includes('JWT'));
    expect(jwtItem).toBeTruthy();
    expect(jwtItem!.attributes('href')).toBe('/text/jwt-parser');
  });

  it('输入无匹配词 → 下拉显示空态文案', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(false);
    expect(wrapper.text()).toContain('没有找到匹配');
  });

  it('清空搜索 → 下拉关闭', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(true);
    await wrapper.find('button[aria-label="清除搜索"]').trigger('click');
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(false);
  });

  it('↓ 键移动高亮项（第一项默认 active，按 ↓ 后第二项 active）', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('json');
    await nextTick();
    const items = wrapper.findAll('ul li a');
    expect(items.length).toBeGreaterThanOrEqual(2);
    // 初始第一项高亮
    expect(items[0].classes()).toContain('bg-accent');
    // 按 ↓ → 第二项高亮
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(wrapper.findAll('ul li a')[1].classes()).toContain('bg-accent');
  });

  it('Esc 关闭下拉', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(true);
    await wrapper.find('input').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(false);
  });
});
