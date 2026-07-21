import { ref } from 'vue';
import type { Ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'devtools-theme';
const current = ref<Theme>('light') as Ref<Theme>;

/**
 * 应用主题：更新状态、切换 <html>.dark、持久化。
 * 所有副作用均带 SSR 守卫（document/localStorage 仅客户端存在）。
 * @param theme 目标主题
 */
function apply(theme: Theme): void {
  current.value = theme;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* 忽略写入失败 */
    }
  }
}

/** 在 light/dark 间切换 */
function toggle(): void {
  apply(current.value === 'dark' ? 'light' : 'dark');
}

/** 从 localStorage 恢复主题（客户端启动时调用） */
function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') apply(saved);
  } catch {
    /* 忽略读取失败 */
  }
}

/** 主题全局单例 store（替代 Header 暗色按钮的占位逻辑） */
export const themeStore = { current, apply, toggle, load };
