import { describe, it, expect, beforeEach, vi } from 'vitest';
import { favoritesStore } from '../favorites';

/** 内存 localStorage mock（node 环境无 localStorage） */
function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  return store;
}

describe('favoritesStore', () => {
  beforeEach(() => {
    favoritesStore.list.value = [];
    mockLocalStorage();
  });

  it('toggle 添加/移除收藏', () => {
    const item = { path: '/encoding/base64', name: 'Base64', icon: '🔐' };
    expect(favoritesStore.isFavorite(item.path)).toBe(false);
    favoritesStore.toggle(item);
    expect(favoritesStore.isFavorite(item.path)).toBe(true);
    expect(favoritesStore.list.value).toHaveLength(1);
    favoritesStore.toggle(item);
    expect(favoritesStore.isFavorite(item.path)).toBe(false);
    expect(favoritesStore.list.value).toHaveLength(0);
  });

  it('toggle 持久化到 localStorage', () => {
    favoritesStore.toggle({ path: '/x', name: 'X', icon: '❓' });
    const raw = localStorage.getItem('devtools-favorites');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it('load 从 localStorage 恢复', () => {
    localStorage.setItem(
      'devtools-favorites',
      JSON.stringify([{ path: '/y', name: 'Y', icon: '❓' }]),
    );
    favoritesStore.load();
    expect(favoritesStore.list.value).toHaveLength(1);
    expect(favoritesStore.isFavorite('/y')).toBe(true);
  });

  it('load 容错损坏数据（返回空数组）', () => {
    localStorage.setItem('devtools-favorites', '{不是合法 json');
    favoritesStore.load();
    expect(favoritesStore.list.value).toHaveLength(0);
  });

  it('clearAll 清空并持久化', () => {
    favoritesStore.toggle({ path: '/a', name: 'A', icon: '❓' });
    favoritesStore.toggle({ path: '/b', name: 'B', icon: '❓' });
    favoritesStore.clearAll();
    expect(favoritesStore.list.value).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('devtools-favorites')!)).toHaveLength(0);
  });
});
