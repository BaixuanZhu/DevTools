// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SearchPanel from '../SearchPanel.vue';

/** 造一个模拟首页网格的 DOM，供 SearchPanel 过滤 */
function seedGrid() {
  const grid = document.createElement('div');
  grid.setAttribute('data-search-grid', '');
  grid.innerHTML = `
    <div data-id="uuid-generator" style="display:"></div>
    <div data-id="hash-generator" style="display:"></div>
  `;
  document.body.appendChild(grid);
  return grid;
}

describe('SearchPanel.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    seedGrid();
  });

  it('输入匹配词 → 仅命中的卡片 display 非 none，其余隐藏', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('uuid');
    // 防抖 150ms
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    const cards = document.querySelectorAll('[data-search-grid] [data-id]') as NodeListOf<HTMLElement>;
    const byId = (id: string) => Array.from(cards).find((c) => c.getAttribute('data-id') === id)!;
    expect(byId('uuid-generator').style.display).not.toBe('none');
    expect(byId('hash-generator').style.display).toBe('none');
  });

  it('输入无匹配词 → 显示空状态', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    expect(wrapper.text()).toContain('没有找到匹配');
  });

  it('清空搜索 → 全部卡片恢复显示，空状态消失', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    await wrapper.find('button[aria-label="清除搜索"]').trigger('click');
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    const cards = document.querySelectorAll('[data-search-grid] [data-id]') as NodeListOf<HTMLElement>;
    expect(Array.from(cards).every((c) => c.style.display !== 'none')).toBe(true);
    expect(wrapper.text()).not.toContain('没有找到匹配');
  });
});
