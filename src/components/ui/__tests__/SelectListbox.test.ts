// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SelectListbox from '../SelectListbox.vue';

const options = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
];

describe('SelectListbox.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('渲染 label 与触发器中的选中项文案', () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '2', options, label: '数量' },
      attachTo: document.body,
    });
    expect(wrapper.text()).toContain('数量');
    expect(wrapper.get('button').text()).toContain('二');
  });

  it('v-model 转发：改 modelValue → 触发器文案更新', async () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '1', options },
      attachTo: document.body,
    });
    await wrapper.setProps({ modelValue: '2' });
    expect(wrapper.get('button').text()).toContain('二');
  });

  it('点击触发器 → 打开内容（portal 到 body），含全部选项；选中项 data-state=checked', async () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '2', options },
      attachTo: document.body,
    });
    // reka-ui SelectTrigger 在 @vue/test-utils/happy-dom 下由 pointerdown 触发打开（真实浏览器 click 一定生效）
    await wrapper.get('button').trigger('pointerdown', { button: 0 });
    await nextTick();
    await nextTick();
    const opts = Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[];
    expect(opts.map((o) => o.textContent)).toEqual(expect.arrayContaining(['一', '二']));
    // 选中项（二）被 Reka 标 data-state=checked（驱动 text-primary + 对勾 indicator）
    const checked = opts.find((o) => o.getAttribute('data-state') === 'checked');
    expect(checked?.textContent).toContain('二');
  });

  it('点击某选项 → emit update:modelValue', async () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '1', options },
      attachTo: document.body,
    });
    await wrapper.get('button').trigger('pointerdown', { button: 0 });
    await nextTick();
    await nextTick();
    // 选项 role=option
    const opt = Array.from(document.body.querySelectorAll('[role="option"]')).find((el) => el.textContent === '二') as HTMLElement;
    expect(opt).toBeTruthy();
    // reka-ui SelectItem 在 pointerup 时触发 select（真实浏览器点击序列会派发 pointerup）
    opt.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2']);
  });
});
