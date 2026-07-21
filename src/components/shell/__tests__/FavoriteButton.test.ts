// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FavoriteButton from '../FavoriteButton.vue';
import { favoritesStore } from '../../../stores/favorites';
import { toastStore } from '../../../stores/toast';

const tool = { path: '/text/uuid-generator', name: 'UUID 生成器', icon: '🔑' };

describe('FavoriteButton.vue', () => {
  beforeEach(() => {
    // 组件 onMounted 会调 favoritesStore.load() 读 localStorage 覆盖预设状态，
    // 这里 mock 为空操作，让测试直接控制 list（load 的集成由 favorites.test.ts 覆盖）
    vi.spyOn(favoritesStore, 'load').mockImplementation(() => {});
    favoritesStore.list.value = [];
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  it('未收藏态：aria-label 为「收藏 …」，点击后加入收藏 + success toast', async () => {
    const wrapper = mount(FavoriteButton, { props: { tool } });
    expect(wrapper.attributes('aria-label')).toBe('收藏 UUID 生成器');
    await wrapper.trigger('click');
    expect(favoritesStore.isFavorite(tool.path)).toBe(true);
    expect(toastStore.items.value.some((t) => t.message.includes('已收藏'))).toBe(true);
  });

  it('已收藏态：再次点击 → 取消收藏 + 「已取消收藏」toast', async () => {
    favoritesStore.list.value = [tool];
    const wrapper = mount(FavoriteButton, { props: { tool } });
    expect(wrapper.attributes('aria-label')).toBe('取消收藏 UUID 生成器');
    await wrapper.trigger('click');
    expect(favoritesStore.isFavorite(tool.path)).toBe(false);
    expect(toastStore.items.value.some((t) => t.message.includes('已取消收藏'))).toBe(true);
  });
});
