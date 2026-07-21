// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Shell from '../Shell.vue';
import { sidebarStore } from '../../../stores/sidebar';
import { themeStore } from '../../../stores/theme';

const categories = ['文本处理'];
const toolsByCategory = {
  '文本处理': [
    { id: 'uuid-generator', name: 'UUID 生成器', icon: '🔑', path: '/text/uuid-generator' },
  ],
};

describe('Shell.vue', () => {
  beforeEach(() => {
    sidebarStore.isOpen.value = false;
    themeStore.current.value = 'light';
    document.documentElement.classList.remove('dark');
  });

  it('渲染 logo、汉堡按钮、暗色按钮（默认 light 态）', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
      slots: { default: '<div class="content">页面内容</div>' },
    });
    expect(wrapper.find('header').exists()).toBe(true);
    expect(wrapper.find('[aria-label="打开导航菜单"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="切换到暗色模式"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('页面内容');
  });

  it('点击汉堡按钮 → sidebarStore.isOpen 变 true，aside 获得 sidebar-open', async () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    expect(sidebarStore.isOpen.value).toBe(false);
    await wrapper.find('[aria-label="打开导航菜单"]').trigger('click');
    expect(sidebarStore.isOpen.value).toBe(true);
    expect(wrapper.find('aside').classes()).toContain('sidebar-open');
  });

  it('点击暗色按钮 → themeStore.current 变 dark，<html> 加 .dark', async () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    await wrapper.find('[aria-label="切换到暗色模式"]').trigger('click');
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('侧栏渲染传入的分类与工具链接', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/text/uuid-generator' },
    });
    expect(wrapper.find('aside').text()).toContain('文本处理');
    expect(wrapper.find('aside').text()).toContain('UUID 生成器');
    // 当前路径高亮
    const activeLink = wrapper.find('aside a[href="/text/uuid-generator"]');
    expect(activeLink.classes()).toContain('bg-accent');
  });
});
