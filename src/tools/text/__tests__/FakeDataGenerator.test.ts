// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FakeDataGenerator from '../FakeDataGenerator.vue';

describe('FakeDataGenerator.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('挂载渲染，字段配置 Dialog 默认关闭（无 DialogTitle 在 body）', () => {
    mount(FakeDataGenerator, { attachTo: document.body });
    expect(document.body.textContent ?? '').not.toContain('编辑「');
  });

  it('点击字段「配置」按钮 → Dialog 打开，DialogTitle 出现在 body', async () => {
    const wrapper = mount(FakeDataGenerator, { attachTo: document.body });
    // 首个字段行的「配置」按钮（带 title 以「配置 」开头）
    const configBtn = wrapper.find('button[title^="配置 "]');
    expect(configBtn.exists()).toBe(true);
    await configBtn.trigger('click');
    await nextTick();
    await nextTick();
    expect(document.body.textContent ?? '').toContain('编辑「');
  });
});
