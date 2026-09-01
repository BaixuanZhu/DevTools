// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Shell from '../Shell.vue';
import { sidebarStore } from '../../../stores/sidebar';
import { themeStore } from '../../../stores/theme';
import type { CategoryMeta } from '../../../data/categories';
import type { QuickLinkTool } from '../../../data/quick-links';

const categories: CategoryMeta[] = [
  { name: '文本与编码', slug: 'text', icon: '🔤', description: '文本处理与编码', seoDescription: '文本处理与编码测试占位描述', seoTitle: '文本与编码工具 - 在线文本处理测试占位标题' },
  { name: '加密与安全', slug: 'crypto', icon: '🔒', description: '加密哈希', seoDescription: '加密哈希测试占位描述', seoTitle: '加密与安全工具 - 在线加密测试占位标题' },
];
const toolsByCategory = {
  '文本与编码': [
    { id: 'uuid-generator', name: 'UUID 生成器', icon: '🔑', path: '/text/uuid-generator' },
  ],
  '加密与安全': [
    { id: 'hash-generator', name: '哈希生成器', icon: '🔒', path: '/crypto/hash-generator' },
  ],
};
const quickLinks: QuickLinkTool[] = [
  { id: 'json-formatter', path: '/format/json-formatter', name: 'JSON 格式化', icon: '{ }' },
  { id: 'base64', path: '/text/base64', name: 'Base64', icon: '🔐' },
  { id: 'tester', path: '/text/tester', name: '正则测试器', icon: '🎯' },
];

describe('Shell.vue', () => {
  beforeEach(() => {
    sidebarStore.isOpen.value = false;
    themeStore.current.value = 'light';
    document.documentElement.classList.remove('dark');
  });

  it('渲染 logo、汉堡按钮、主题切换按钮（默认 system 态显示 Monitor）', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
      slots: { default: '<div class="content">页面内容</div>' },
    });
    expect(wrapper.find('header').exists()).toBe(true);
    expect(wrapper.find('[aria-label="打开导航菜单"]').exists()).toBe(true);
    // 触发按钮 aria-label 包含「当前主题」
    const themeBtn = wrapper.find('header button[aria-label^="当前主题"]');
    expect(themeBtn.exists()).toBe(true);
    expect(wrapper.text()).toContain('页面内容');
  });

  it('点击汉堡按钮 → sidebarStore.isOpen 变 true，移动端 Sheet 抽屉经 portal 打开', async () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    expect(sidebarStore.isOpen.value).toBe(false);
    await wrapper.find('[aria-label="打开导航菜单"]').trigger('click');
    expect(sidebarStore.isOpen.value).toBe(true);
    // shadcn Sheet 重构后桌面 aside 不再有 sidebar-open；抽屉内容经 DialogPortal 渲染到 body
    await nextTick();
    await nextTick();
    expect(document.body.querySelector('nav[aria-label="工具导航（移动端）"]')).not.toBeNull();
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

  it('传入 quickLinks 时 Header 中部 nav 按清单顺序渲染入口（文本与 href 一致）', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/', quickLinks },
    });
    const nav = wrapper.find('nav[aria-label="常用工具"]');
    expect(nav.exists()).toBe(true);
    const links = nav.findAll('a');
    expect(links).toHaveLength(3);
    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/format/json-formatter',
      '/text/base64',
      '/text/tester',
    ]);
    // 名称渲染（图标 aria-hidden，文本可读）
    expect(links[0].text()).toContain('JSON 格式化');
    expect(links[1].text()).toContain('Base64');
    expect(links[2].text()).toContain('正则测试器');
    // <lg 断点隐藏是 CSS 行为，断言类名存在即可
    expect(nav.classes()).toContain('hidden');
    expect(nav.classes()).toContain('lg:flex');
  });

  it('currentPath 命中某入口时仅该项为激活态（text-primary）', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/text/base64', quickLinks },
    });
    // findAll 每次返回新 wrapper 实例，不能按对象身份过滤，按 href 区分
    const links = wrapper.findAll('nav[aria-label="常用工具"] a');
    const active = links.filter((a) => a.attributes('href') === '/text/base64');
    expect(active).toHaveLength(1);
    expect(active[0].classes()).toContain('text-primary');
    for (const a of links) {
      if (a.attributes('href') !== '/text/base64') {
        expect(a.classes()).not.toContain('text-primary');
      }
    }
  });

  it('currentPath 无匹配（首页）时快捷入口无激活项', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/', quickLinks },
    });
    const links = wrapper.findAll('nav[aria-label="常用工具"] a');
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.classes()).not.toContain('text-primary');
    }
  });

  it('quickLinks 缺省时不渲染快捷入口 nav（向后兼容）', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    expect(wrapper.find('nav[aria-label="常用工具"]').exists()).toBe(false);
  });
});
