// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SearchPanel from '../SearchPanel.vue';
import { tools } from '../../../data/tools';

/**
 * 组件基于 reka-ui Command（Listbox）：选项为 role="option" 元素（无 ul li a），
 * 列表常驻挂载、显隐与高亮由 reka-ui 管理——高亮项带 data-highlighted 属性，
 * 选中直达通过 @select → window.location.href 赋值（MPA 跳转）。
 */
const options = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="option"]');
const highlightMarks = (wrapper: ReturnType<typeof mount>) =>
  options(wrapper)
    .map((o) => (o.attributes()['data-highlighted'] !== undefined ? 'H' : '-'))
    .join('');

describe('SearchPanel.vue（reka-ui Command 架构）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('空输入 → 列出注册表全量工具选项', async () => {
    const wrapper = mount(SearchPanel);
    await nextTick();
    expect(options(wrapper).length).toBe(tools.length);
  });

  it('输入匹配词 → 过滤命中工具（含 JWT 编解码）', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    await nextTick();
    const opts = options(wrapper);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.some((o) => o.text().includes('JWT'))).toBe(true);
  });

  it('输入无匹配词 → CommandEmpty 显示空态文案', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await nextTick();
    await nextTick();
    expect(options(wrapper).length).toBe(0);
    expect(wrapper.text()).toContain('没有匹配的工具');
  });

  it('清空搜索 → 恢复全量列表', async () => {
    const wrapper = mount(SearchPanel);
    const input = wrapper.find('input');
    await input.setValue('jwt');
    await nextTick();
    await nextTick();
    expect(options(wrapper).length).toBeLessThan(tools.length);
    await input.setValue('');
    await nextTick();
    await nextTick();
    expect(options(wrapper).length).toBe(tools.length);
  });

  it('↓ 键移动高亮项（首项默认高亮，按 ↓ 后第二项高亮）', async () => {
    const wrapper = mount(SearchPanel);
    const input = wrapper.find('input');
    await input.setValue('json');
    await nextTick();
    await nextTick();
    expect(options(wrapper).length).toBeGreaterThanOrEqual(2);
    expect(highlightMarks(wrapper)).toMatch(/^H-+$/);
    await input.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(highlightMarks(wrapper)).toMatch(/^-H-+$/);
  });

  it('点击选项 → 直达对应工具页（window.location.href 赋值）', async () => {
    const wrapper = mount(SearchPanel);
    const input = wrapper.find('input');
    await input.setValue('json');
    await nextTick();
    await nextTick();
    const locSet = vi.spyOn(window.location, 'href', 'set');
    await options(wrapper)[0]!.trigger('click');
    await nextTick();
    expect(locSet).toHaveBeenCalledWith('/format/json-formatter');
    locSet.mockRestore();
  });
});
