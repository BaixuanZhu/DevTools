// @ts-expect-error vue-sonner 无类型导出声明，运行时存在
import { toast as sonnerToast } from 'vue-sonner';

/**
 * 项目内统一 toast 入口（基于 vue-sonner）。
 * 兼容原项目 toastStore 的调用形态：toast.success / toast.error / toast 直接调用。
 */
export const toast = sonnerToast as unknown as {
  (message: string, options?: Record<string, unknown>): void;
  success: (message: string, options?: Record<string, unknown>) => void;
  error: (message: string, options?: Record<string, unknown>) => void;
  warning: (message: string, options?: Record<string, unknown>) => void;
  info: (message: string, options?: Record<string, unknown>) => void;
};
