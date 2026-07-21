// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FeedbackForm from '../FeedbackForm.vue';
import { toastStore } from '../../../stores/toast';

describe('FeedbackForm.vue', () => {
  beforeEach(() => {
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  it('内容为空提交 → toastStore 出现 error「请填写反馈内容」', async () => {
    const wrapper = mount(FeedbackForm);
    await wrapper.find('form').trigger('submit');
    await nextTick();
    expect(toastStore.items.value.some((t) => t.type === 'error' && t.message.includes('请填写反馈内容'))).toBe(true);
  });

  it('填入内容提交 → 不报错 toast，且尝试跳转 mailto', async () => {
    const hrefSetter = vi.spyOn(window.location, 'href', 'set');
    const wrapper = mount(FeedbackForm);
    await wrapper.find('textarea').setValue('这个工具很好用');
    await wrapper.find('form').trigger('submit');
    await nextTick();
    expect(toastStore.items.value.some((t) => t.type === 'error')).toBe(false);
    expect(hrefSetter).toHaveBeenCalled();
    expect(hrefSetter.mock.calls[0][0]).toContain('mailto:');
    hrefSetter.mockRestore();
  });
});
