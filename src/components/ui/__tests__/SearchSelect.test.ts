// @vitest-environment happy-dom
/**
 * SearchSelect 组件级测试（新增共享 ui 组件，范式照 SelectListbox.test.ts）：
 * 覆盖触发器展示、portal 打开、关键词过滤（大小写不敏感）、选中 emit 并关闭、
 * 重开重置过滤词与空态文案。
 * reka-ui PopoverTrigger 由 click 触发打开；CommandItem（ListboxItem）由 click 触发 select。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import SearchSelect from '../SearchSelect.vue';

const options = [
  { value: 'Asia/Shanghai', label: '中国标准时间', keywords: ['上海', 'UTC+8'] },
  { value: 'UTC', label: '协调世界时（UTC）', keywords: ['GMT', 'UTC+0'] },
  { value: 'America/New_York', label: '美国东部时间', keywords: ['纽约', 'UTC-5'] },
];

/** 已挂载实例登记表：afterEach 统一卸载，防 portal/异步更新残留引发崩溃 */
const mounted: VueWrapper[] = [];

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount();
  mounted.length = 0;
});

/** 点击触发器打开弹层并等待 portal 渲染完成 */
async function openPopover(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('button').trigger('click');
  await nextTick();
  await nextTick();
}

/** portal 内的选项元素（reka-ui ListboxItem → role=option） */
function portalItems(): DOMWrapper<HTMLElement>[] {
  return Array.from(document.body.querySelectorAll('[role="option"]')).map(
    (el) => new DOMWrapper(el as HTMLElement),
  );
}

describe('SearchSelect.vue', () => {
  it('触发器展示当前选中项 label；值不在列表时回显原值；空值显示占位文案', () => {
    const wrapper = mount(SearchSelect, {
      props: { modelValue: 'Asia/Shanghai', options },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    expect(wrapper.get('button').text()).toContain('中国标准时间');

    const fallback = mount(SearchSelect, {
      props: { modelValue: 'Mars/Olympus', options, placeholder: '请选择时区' },
      attachTo: document.body,
    });
    mounted.push(fallback);
    expect(fallback.get('button').text()).toContain('Mars/Olympus');

    const empty = mount(SearchSelect, {
      props: { modelValue: '', options, placeholder: '请选择时区' },
      attachTo: document.body,
    });
    mounted.push(empty);
    expect(empty.get('button').text()).toContain('请选择时区');
  });

  it('点击触发器打开弹层（portal 到 body），渲染全部选项', async () => {
    const wrapper = mount(SearchSelect, {
      props: { modelValue: 'UTC', options },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await openPopover(wrapper);
    const items = portalItems();
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('中国标准时间'), expect.stringContaining('UTC')]),
    );
  });

  it('点击选项 emit update:modelValue 并关闭弹层', async () => {
    const wrapper = mount(SearchSelect, {
      props: { modelValue: 'Asia/Shanghai', options },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await openPopover(wrapper);
    const target = portalItems().find((i) => i.text().includes('美国东部时间'));
    expect(target).toBeDefined();
    await target!.trigger('click');
    await nextTick();
    await nextTick();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['America/New_York']);
    expect(portalItems()).toHaveLength(0);
  });

  it('关键词过滤命中 IANA 名 / 中文 / 偏移（大小写不敏感）；无匹配显示空态文案', async () => {
    const wrapper = mount(SearchSelect, {
      props: { modelValue: 'UTC', options },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await openPopover(wrapper);
    const input = new DOMWrapper(document.body.querySelector('input') as HTMLInputElement);

    await input.setValue('america');
    expect(portalItems()).toHaveLength(1);
    expect(portalItems()[0]!.text()).toContain('美国东部时间');

    await input.setValue('纽约');
    expect(portalItems()).toHaveLength(1);

    await input.setValue('UTC-5');
    expect(portalItems()).toHaveLength(1);

    await input.setValue('不存在的时区');
    expect(portalItems()).toHaveLength(0);
    expect(document.body.textContent).toContain('无匹配选项');
  });

  it('重新打开弹层时过滤词重置，恢复全量列表', async () => {
    const wrapper = mount(SearchSelect, {
      props: { modelValue: 'UTC', options },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await openPopover(wrapper);
    const input = new DOMWrapper(document.body.querySelector('input') as HTMLInputElement);
    await input.setValue('shanghai');
    expect(portalItems()).toHaveLength(1);

    // 选中收起弹层（关闭后 body 里的 input 一并卸载）
    await portalItems()[0]!.trigger('click');
    await nextTick();
    await nextTick();
    expect(portalItems()).toHaveLength(0);

    // 重开：过滤词已重置，全量展示
    await openPopover(wrapper);
    expect(portalItems()).toHaveLength(3);
  });

  it('自定义空态文案透传（ParamRow 传"无匹配时区"）', async () => {
    const wrapper = mount(SearchSelect, {
      props: { modelValue: 'UTC', options, emptyText: '无匹配时区' },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    await openPopover(wrapper);
    const input = new DOMWrapper(document.body.querySelector('input') as HTMLInputElement);
    await input.setValue('??');
    expect(document.body.textContent).toContain('无匹配时区');
  });
});
