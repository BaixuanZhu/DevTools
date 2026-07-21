// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MarkdownEditor from '../MarkdownEditor.vue';

describe('MarkdownEditor.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('渲染导出触发器（aria-label=导出）', () => {
    const wrapper = mount(MarkdownEditor, { attachTo: document.body });
    expect(wrapper.find('button[aria-label="导出"]').exists()).toBe(true);
  });

  it('点击导出 → 菜单打开，HTML/PDF 项出现（PDF 打开前不在 body）', async () => {
    const wrapper = mount(MarkdownEditor, { attachTo: document.body });
    // 示例 Markdown 文本里本身含 "Markdown" 字样，故用 PDF 作为打开前后差异信号
    expect(document.body.textContent ?? '').not.toContain('PDF');
    await wrapper.get('button[aria-label="导出"]').trigger('click');
    await nextTick();
    await nextTick();
    const body = document.body.textContent ?? '';
    expect(body).toContain('Markdown');
    expect(body).toContain('HTML');
    expect(body).toContain('PDF');
  });
});
