import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeStore } from '../theme';

/** mock document.documentElement.classList + localStorage */
function mockDom() {
  const classSet = new Set<string>();
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (cls: string, force?: boolean) => {
          const on = force ?? !classSet.has(cls);
          if (on) classSet.add(cls);
          else classSet.delete(cls);
          return on;
        },
        contains: (cls: string) => classSet.has(cls),
      },
    },
  });
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
  return { classSet, store };
}

describe('themeStore', () => {
  beforeEach(() => {
    themeStore.current.value = 'light';
    mockDom();
  });

  it('apply(dark) 切换 html.dark 并持久化', () => {
    themeStore.apply('dark');
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('devtools-theme')).toBe('dark');
  });

  it('apply(light) 移除 html.dark', () => {
    themeStore.apply('dark');
    themeStore.apply('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('devtools-theme')).toBe('light');
  });

  it('toggle 在 light/dark 间切换', () => {
    expect(themeStore.current.value).toBe('light');
    themeStore.toggle();
    expect(themeStore.current.value).toBe('dark');
    themeStore.toggle();
    expect(themeStore.current.value).toBe('light');
  });

  it('load 恢复已保存的 dark', () => {
    localStorage.setItem('devtools-theme', 'dark');
    themeStore.load();
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('load 忽略非法值', () => {
    localStorage.setItem('devtools-theme', 'purple');
    themeStore.load();
    expect(themeStore.current.value).toBe('light');
  });
});
