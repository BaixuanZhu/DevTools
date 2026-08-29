import { ref } from 'vue';
import type { Ref } from 'vue';

/**
 * 主题模式：
 * - 'light' / 'dark'：显式选择，持久化
 * - 'system'：跟随操作系统 prefers-color-scheme，系统切换时实时响应
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 实际生效的主题（system 解析后的 light/dark，供 UI 图标判断用）*/
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'devtools-theme';

/** 用户选择的模式（三态） */
const mode = ref<ThemeMode>('system') as Ref<ThemeMode>;
/** 实际生效主题（system 模式下由媒体查询解析） */
const current = ref<ResolvedTheme>('light') as Ref<ResolvedTheme>;

/** 媒体查询监听器（仅客户端，load 时注册，卸载时移除） */
let mql: MediaQueryList | null = null;
let mediaHandler: ((e: MediaQueryListEvent) => void) | null = null;

/** 读取系统偏好（带 SSR 守卫） */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 解析当前模式 → 实际主题 */
function resolveTheme(m: ThemeMode): ResolvedTheme {
  if (m === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return m;
}

/**
 * 把 resolved 主题应用到 <html>.dark 与 current ref（内部，不持久化）。
 */
function applyToDom(theme: ResolvedTheme): void {
  current.value = theme;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

/**
 * 应用主题模式：更新 mode、解析实际主题、应用到 DOM、持久化。
 * system 模式下注册媒体查询监听，系统切换时自动跟随。
 * @param target 目标模式（light / dark / system）
 */
function apply(target: ThemeMode): void {
  mode.value = target;

  // system 模式：注册监听（若尚未注册）
  if (target === 'system') {
    setupMediaListener();
  } else {
    teardownMediaListener();
  }

  applyToDom(resolveTheme(target));

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch {
      /* 忽略写入失败 */
    }
  }
}

/** 注册 prefers-color-scheme 媒体查询监听（幂等） */
function setupMediaListener(): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  if (mql && mediaHandler) return; // 已注册
  mql = window.matchMedia('(prefers-color-scheme: dark)');
  mediaHandler = (e: MediaQueryListEvent) => {
    // 仅当用户选择 system 时才响应
    if (mode.value !== 'system') return;
    applyToDom(e.matches ? 'dark' : 'light');
  };
  mql.addEventListener('change', mediaHandler);
}

/** 移除媒体查询监听 */
function teardownMediaListener(): void {
  if (mql && mediaHandler) {
    mql.removeEventListener('change', mediaHandler);
    mql = null;
    mediaHandler = null;
  }
}

/** 在 light/dark 间显式切换（system 模式下回落到当前 resolved 的反面） */
function toggle(): void {
  const next: ResolvedTheme = current.value === 'dark' ? 'light' : 'dark';
  apply(next);
}

/** 从 localStorage 恢复主题（客户端启动时调用） */
function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      apply(saved);
      return;
    }
  } catch {
    /* 忽略读取失败 */
  }
  // 无合法值 → 默认 system（注册监听）
  apply('system');
}

/** 主题全局单例 store */
export const themeStore = { mode, current, apply, toggle, load };
