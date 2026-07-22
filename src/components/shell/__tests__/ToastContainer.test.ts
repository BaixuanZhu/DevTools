// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ToastContainer from '../ToastContainer.vue';
import { toastStore } from '../../../stores/toast';

// 自动卸载 wrapper，避免跨用例污染
enableAutoUnmount(afterEach);

describe('ToastContainer.vue', () => {
  beforeEach(() => {
    // 清空队列（remove 所有）
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  it('渲染 toastStore.items 中的通知', async () => {
    toastStore.show('保存成功', 'success');
    const wrapper = mount(ToastContainer);
    await nextTick();
    expect(wrapper.text()).toContain('保存成功');
  });

  it('error 类型通知渲染错误样式', async () => {
    toastStore.show('操作失败', 'error');
    const wrapper = mount(ToastContainer);
    await nextTick();
    expect(wrapper.text()).toContain('操作失败');
    expect(wrapper.html()).toContain('border-error/20');
  });
});
