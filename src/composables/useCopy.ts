import { ref, type Ref } from 'vue';
import { copyToClipboard } from '../utils/shared/clipboard';

export interface UseCopyOptions {
  /** 复制成功后状态保持时长，默认 1500ms */
  duration?: number;
  /** 复制失败时的 Toast 文案，默认 '复制失败，请重试' */
  errorMessage?: string;
}

export interface UseCopyResult {
  /** 是否处于"已复制"确认态 */
  copied: Ref<boolean>;
  /** 触发复制 */
  copy: (text: string) => Promise<void>;
}

/**
 * 封装复制到剪贴板的交互状态。
 *
 * 提供成功后的临时确认态、自动复位以及失败 Toast 反馈。
 */
export function useCopy(options?: UseCopyOptions): UseCopyResult {
  const duration = options?.duration ?? 1500;
  const errorMessage = options?.errorMessage ?? '复制失败，请重试';
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string): Promise<void> {
    if (!text) return;

    const success = await copyToClipboard(text);
    if (success) {
      copied.value = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        copied.value = false;
      }, duration);
    } else {
      document.dispatchEvent(new CustomEvent('toast', { detail: { message: errorMessage } }));
    }
  }

  return { copied, copy };
}
