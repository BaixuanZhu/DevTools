// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Shell from '../Shell.vue';
import { sidebarStore } from '../../../stores/sidebar';
import { themeStore } from '../../../stores/theme';
import type { CategoryMeta } from '../../../data/categories';

const categories: CategoryMeta[] = [
  { name: '文本与编码', slug: 'text', icon: '🔤', description: '文本处理与编码' },
  { name: '加密与安全', slug: 'crypto', icon: '🔒', description: '加密哈希' },
];
const toolsByCategory = {
  '文本与编码': [
    { id: 'uuid-generator', name: 'UUID 生成器', icon: '🔑', path: '/text/uuid-generator' },
  ],
  '加密与安全': [
    { id: 'hash-generator', name: '哈希生成器', icon: '🔒', path: '/crypto/hash-generator' },
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

  it('Header 不再包含收藏入口', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    expect(wrapper.find('[aria-label="我的收藏"]').exists()).toBe(false);
  });

  it('侧栏仅渲染分类入口（含工具数徽标），不再渲染工具链接', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/crypto/hash-generator' },
    });
    const asideText = wrapper.find('aside').text();
    // 分类名与图标存在
    expect(asideText).toContain('文本与编码');
    expect(asideText).toContain('加密与安全');
    // 工具数徽标
    expect(asideText).toContain('1');
    // 分类链接指向分类页
    expect(wrapper.find('aside a[href="/text"]').exists()).toBe(true);
    expect(wrapper.find('aside a[href="/crypto"]').exists()).toBe(true);
    // 不再渲染具体工具链接
    expect(wrapper.find('aside a[href="/text/uuid-generator"]').exists()).toBe(false);
  });

  it('当前路径前缀匹配时对应分类高亮', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/crypto/hash-generator' },
    });
    const cryptoLink = wrapper.find('aside a[href="/crypto"]');
    const textLink = wrapper.find('aside a[href="/text"]');
    expect(cryptoLink.classes()).toContain('bg-accent');
    expect(cryptoLink.classes()).toContain('text-primary');
    expect(textLink.classes()).not.toContain('bg-accent');
  });

  it('当前路径恰好为分类页时该分类高亮', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/text' },
    });
    expect(wrapper.find('aside a[href="/text"]').classes()).toContain('bg-accent');
  });
});
