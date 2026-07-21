import { ref } from 'vue';
import type { Ref } from 'vue';

/** toast 类型 */
export type ToastType = 'success' | 'error';

/** 单条 toast 通知 */
export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

/** 默认显示时长（ms） */
const DEFAULT_DURATION = 3000;

const items = ref<ToastItem[]>([]) as Ref<ToastItem[]>;
/** 自增 id（模块级单例，跨调用累加） */
let counter = 0;

/**
 * 添加一条 toast，到时自动移除。
 * @param message 文案
 * @param type 类型，默认 success
 * @param duration 显示时长 ms，默认 3000
 * @returns 新 toast 的 id（可用于手动 remove）
 */
function show(message: string, type: ToastType = 'success', duration = DEFAULT_DURATION): number {
  const id = ++counter;
  items.value.push({ id, type, message });
  if (duration > 0) setTimeout(() => remove(id), duration);
  return id;
}

/** 添加成功 toast */
function success(message: string): number {
  return show(message, 'success');
}

/** 添加错误 toast */
function error(message: string): number {
  return show(message, 'error');
}

/** 按 id 移除一条 toast */
function remove(id: number): void {
  items.value = items.value.filter((t) => t.id !== id);
}

/** toast 全局单例 store（替代 Alpine toast store） */
export const toastStore = { items, show, success, error, remove };
