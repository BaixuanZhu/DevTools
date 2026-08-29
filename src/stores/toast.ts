import { ref } from 'vue';
import type { Ref } from 'vue';
import { toast as sonnerToast } from 'vue-sonner';

/**
 * Toast 全局适配器（基于 vue-sonner）。
 *
 * 重构历史：原版 toastStore 自管 items 数组 + ToastContainer.vue 消费；
 * shadcn-vue 重构后改为 Sonner Toaster 渲染（在 Shell.vue 全局挂载一次）。
 *
 * 为零侵入兼容 30+ 调用方（tools/* 与 composables/* 都用 toastStore.show/error/success）
 * 与既有测试断言（useCopy/FeedbackForm 直接读 items.value），本 store：
 *  1. 保留 items 镜像 ref，对外 API 形态不变
 *  2. 同时委派给 Sonner 的 toast.success/error，由 <Toaster /> 统一渲染
 *  3. items 镜像仍按原 DEFAULT_DURATION 自动出列，保证断言时序一致
 */

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
 * 添加一条 toast，到时自动从镜像移除。
 *
 * Sonner 内部也按自身 duration 自动消失，二者计时保持一致以避免镜像与 UI 错位。
 * @param message 文案
 * @param type 类型，默认 success
 * @param duration 镜像出列时长 ms，默认 3000
 * @returns 新 toast 的 id（可用于手动 remove）
 */
function show(message: string, type: ToastType = 'success', duration = DEFAULT_DURATION): number {
  const id = ++counter;
  // 1. 镜像入队（兼容历史测试与外部 items 断言）
  items.value.push({ id, type, message });
  // 2. 委派 Sonner 渲染（Shell.vue 中的 <Toaster /> 接收）
  if (type === 'success') sonnerToast.success(message);
  else sonnerToast.error(message);
  // 3. 镜像自动出列
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

/** 按 id 移除一条 toast（仅镜像，Sonner 自行管理其队列） */
function remove(id: number): void {
  items.value = items.value.filter((t) => t.id !== id);
}

/** toast 全局单例 store（对外 API 形态保持不变，内部委派 Sonner） */
export const toastStore = { items, show, success, error, remove };
