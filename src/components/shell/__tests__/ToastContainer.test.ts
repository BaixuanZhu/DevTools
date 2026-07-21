// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ToastContainer from '../ToastContainer.vue';
import { toastStore } from '../../../stores/toast';

// 自动卸载 wrapper，避免 document 级监听跨用例污染
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

  it('兼容 shim：document CustomEvent("toast") → toastStore.show()', async () => {
    const wrapper = mount(ToastContainer);
    await nextTick();
    document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: ' shim 兼容' } }));
    await nextTick();
    expect(wrapper.text()).toContain('shim 兼容');
    expect(toastStore.items.value.some((t) => t.type === 'error')).toBe(true);
    wrapper.unmount();
  });

  it('卸载后移除 shim 监听', async () => {
    const wrapper = mount(ToastContainer);
    await nextTick();
    wrapper.unmount();
    const before = toastStore.items.value.length;
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '卸载后不应出现' } }));
    expect(toastStore.items.value.length).toBe(before);
  });
});
