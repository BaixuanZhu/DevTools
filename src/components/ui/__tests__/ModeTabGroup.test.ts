// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ModeTabGroup from '../ModeTabGroup.vue';

const options = [
  { key: 'encrypt', label: '加密' },
  { key: 'decrypt', label: '解密' },
];

describe('ModeTabGroup.vue', () => {
  it('渲染 options 为 tab，激活项 role=tab + aria-selected=true', () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'encrypt', options },
      slots: { encrypt: '<div>加密面板</div>', decrypt: '<div>解密面板</div>' },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    const active = tabs.find((t) => t.attributes('aria-selected') === 'true')!;
    expect(active.text()).toBe('加密');
  });

  it('激活面板可见、非激活面板 force-mount 在 DOM 且 data-state=inactive', () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'encrypt', options },
      slots: { encrypt: '<div>加密面板</div>', decrypt: '<div>解密面板</div>' },
    });
    expect(wrapper.text()).toContain('加密面板');
    // 非激活面板仍在 DOM（force-mount），Reka 标 data-state=inactive（Tailwind 变体类 data-[state=inactive]:hidden 由其触发）
    const panels = wrapper.findAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    const decryptPanel = panels.find((p) => p.text().includes('解密面板'));
    expect(decryptPanel?.attributes('data-state')).toBe('inactive');
  });

  it('点击未激活 tab → emit update:modelValue 为其 key', async () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'encrypt', options },
      slots: { encrypt: '<div></div>', decrypt: '<div></div>' },
    });
    // reka-ui TabsTrigger 由 mousedown(left) 触发 changeModelValue（真实浏览器点击序列：mousedown→mouseup→click）
    await wrapper.findAll('[role="tab"]')[1].trigger('mousedown', { button: 0 });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['decrypt']);
  });

  it('modelValue 未命中任何 key → 回落激活首项', () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'nope', options },
      slots: { encrypt: '<div></div>', decrypt: '<div></div>' },
    });
    const active = wrapper.findAll('[role="tab"]').find((t) => t.attributes('aria-selected') === 'true')!;
    expect(active.text()).toBe('加密');
  });
});
