// @vitest-environment happy-dom
/**
 * NumberField 组件回归测试（迁移自 mysql-config，组件上浮共享层）：输入 emit、
 * 失焦 clamp、快捷选项与外部值回写。NumberField 是快速配置与参数行的共用形态组件，
 * 保证输入契约稳定。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import NumberField from '../NumberField.vue';

/** 已挂载实例登记表：afterEach 统一卸载，防异步更新残留 */
const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount();
  mounted.length = 0;
});

/** 挂载带快捷选项的 NumberField */
function mountField(props: Record<string, unknown> = {}) {
  const wrapper = mount(NumberField, {
    props: {
      modelValue: 3306,
      min: 1,
      max: 65535,
      quickOptions: [
        { value: 3306, label: '默认' },
        { value: 3307 },
      ],
      ...props,
    },
  });
  mounted.push(wrapper);
  return wrapper;
}

describe('NumberField 输入契约', () => {
  it('输入可解析数值即 emit update:modelValue', async () => {
    const wrapper = mountField();
    const input = wrapper.find('input');
    await input.setValue('8080');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([8080]);
  });

  it('空串/非法输入不 emit（避免清空过程误写值）', async () => {
    const wrapper = mountField();
    const input = wrapper.find('input');
    await input.setValue('');
    await input.setValue('abc');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('失焦时 clamp 到 [min, max] 并 emit 夹取后的值', async () => {
    const wrapper = mountField();
    const input = wrapper.find('input');
    await input.setValue('99999');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([65535]);
    // 草稿同步为夹取后的值
    expect((input.element as HTMLInputElement).value).toBe('65535');
  });

  it('失焦时空值/非法恢复为当前绑定值', async () => {
    const wrapper = mountField();
    const input = wrapper.find('input');
    await input.setValue('');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect((input.element as HTMLInputElement).value).toBe('3306');
  });

  it('点击快捷选项 emit clamp 后的值，命中项高亮', async () => {
    const wrapper = mountField();
    const buttons = wrapper.findAll('button');
    expect(buttons[0].text()).toContain('默认 3306');
    expect(buttons[0].classes()).toContain('border-primary');
    await buttons[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([3307]);
  });

  it('外部 modelValue 变更时草稿同步（重置/快捷选项回写）', async () => {
    const wrapper = mountField();
    await wrapper.setProps({ modelValue: 3307 });
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('3307');
  });
});
