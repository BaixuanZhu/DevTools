// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FavoritesList from '../FavoritesList.vue';
import { favoritesStore } from '../../../stores/favorites';

describe('FavoritesList.vue', () => {
  beforeEach(() => {
    vi.spyOn(favoritesStore, 'load').mockImplementation(() => {});
    favoritesStore.list.value = [];
  });

  it('收藏为空 → 显示空状态', () => {
    const wrapper = mount(FavoritesList);
    expect(wrapper.text()).toContain('还没有收藏任何工具');
  });

  it('有收藏 → 渲染对应工具卡片（按 path 匹配 tools 注册表）', async () => {
    favoritesStore.list.value = [
      { path: '/text/uuid-generator', name: 'UUID 生成器', icon: '🔑' },
    ];
    const wrapper = mount(FavoritesList);
    await nextTick();
    expect(wrapper.text()).toContain('UUID 生成器');
    expect(wrapper.find('a[href="/text/uuid-generator"]').exists()).toBe(true);
  });

  it('点击取消收藏 → 从列表移除', async () => {
    favoritesStore.list.value = [
      { path: '/text/uuid-generator', name: 'UUID 生成器', icon: '🔑' },
    ];
    const wrapper = mount(FavoritesList);
    await nextTick();
    await wrapper.find('button[aria-label="取消收藏 UUID 生成器"]').trigger('click');
    expect(favoritesStore.isFavorite('/text/uuid-generator')).toBe(false);
  });
});
