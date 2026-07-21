import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind class 名。
 *
 * clsx 处理条件/数组输入，tailwind-merge 消解冲突的 Tailwind utility
 * （如 `px-2 px-4` → `px-4`）。shadcn 组件统一用它拼 class。
 * @param inputs - 任意 class 值（字符串/对象/数组）
 * @returns 合并去重后的 class 字符串
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
