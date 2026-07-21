// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CronParser from '../CronParser.vue';

describe('CronParser.vue', () => {
  it('挂载并渲染 7 个字段 Tab（role=tab）', () => {
    const wrapper = mount(CronParser);
    expect(wrapper.text()).toContain('Cron 表达式');
    // 秒/分/时/日/月/周/年 共 7 个字段 tab
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(7);
  });

  it('默认激活「秒」字段 tab（aria-selected=true）', () => {
    const wrapper = mount(CronParser);
    const active = wrapper.findAll('[role="tab"]').find((t) => t.attributes('aria-selected') === 'true');
    expect(active?.text()).toContain('秒');
  });
});
