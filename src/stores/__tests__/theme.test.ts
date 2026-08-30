import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeStore } from '../theme';

/** mock document.documentElement.classList + localStorage + matchMedia */
function mockDom(prefersDark = false) {
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
  // matchMedia mock。store 经 window.matchMedia + SSR 守卫读取系统偏好
  // （node 环境无全局 window），因此必须挂在 window 对象内而非全局裸名。
  const mql = {
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', { matchMedia: () => mql });
  vi.stubGlobal('matchMedia', () => mql);
  return { classSet, store, mql };
}

describe('themeStore', () => {
  beforeEach(() => {
    themeStore.mode.value = 'system';
    themeStore.current.value = 'light';
    vi.unstubAllGlobals();
    mockDom(false);
    // store 的媒体查询监听器是模块级单例：显式走一次 apply('light') 让上一条
    // 用例注册的监听器（挂在旧 mock 的 mql 上）被 teardown，避免「已注册」
    // 早退导致本条用例的新 mql spy 收不到 addEventListener。
    themeStore.apply('light');
  });

  it('apply(dark) 切换 html.dark 并持久化 dark', () => {
    themeStore.apply('dark');
    expect(themeStore.mode.value).toBe('dark');
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

  it('apply(system) 在系统暗色下解析为 dark', () => {
    mockDom(true);
    themeStore.apply('system');
    expect(themeStore.mode.value).toBe('system');
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('devtools-theme')).toBe('system');
  });

  it('apply(system) 注册 matchMedia 监听器', () => {
    const { mql } = mockDom(false);
    themeStore.apply('system');
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
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
    expect(themeStore.mode.value).toBe('dark');
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('load 恢复 system 并解析系统偏好', () => {
    mockDom(true);
    localStorage.setItem('devtools-theme', 'system');
    themeStore.load();
    expect(themeStore.mode.value).toBe('system');
    expect(themeStore.current.value).toBe('dark');
  });

  it('load 忽略非法值，回落到 system', () => {
    localStorage.setItem('devtools-theme', 'purple');
    themeStore.load();
    expect(themeStore.mode.value).toBe('system');
  });
});
