import { ref } from 'vue';
import type { Ref } from 'vue';

/** 一条收藏记录 */
export interface FavoriteItem {
  path: string;
  name: string;
  icon: string;
}

const STORAGE_KEY = 'devtools-favorites';
const list = ref<FavoriteItem[]>([]) as Ref<FavoriteItem[]>;

/** 从 localStorage 加载收藏（客户端调用，SSR 安全） */
function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    list.value = raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    list.value = [];
  }
}

/** 持久化到 localStorage */
function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.value));
  } catch {
    /* 忽略写入失败（隐私模式等） */
  }
}

/** 判断指定路径是否已收藏 */
function isFavorite(path: string): boolean {
  return list.value.some((f) => f.path === path);
}

/**
 * 切换某工具的收藏状态。
 * @param item 工具元数据（path/name/icon）
 */
function toggle(item: FavoriteItem): void {
  if (isFavorite(item.path)) {
    list.value = list.value.filter((f) => f.path !== item.path);
  } else {
    list.value = [...list.value, item];
  }
  save();
}

/** 清空全部收藏 */
function clearAll(): void {
  list.value = [];
  save();
}

/** 收藏全局单例 store（替代 Alpine favorites store） */
export const favoritesStore = { list, load, save, isFavorite, toggle, clearAll };
