import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { useCopy } from '../useCopy';
import { toastStore } from '../../stores/toast';

describe('useCopy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
      },
    });
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('空字符串不执行复制', async () => {
    const { copied, copy } = useCopy();
    await copy('');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(copied.value).toBe(false);
  });

  it('复制成功后 copied 为 true，1.5s 后自动恢复', async () => {
    (navigator.clipboard.writeText as Mock).mockResolvedValue(undefined);
    const { copied, copy } = useCopy();

    await copy('hello');
    expect(copied.value).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(copied.value).toBe(false);
  });

  it('复制失败时 copied 保持 false 并 toast error', async () => {
    (navigator.clipboard.writeText as Mock).mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy();
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(
      toastStore.items.value.some((t) => t.type === 'error' && t.message === '复制失败，请重试'),
    ).toBe(true);
  });

  it('支持自定义失败文案', async () => {
    (navigator.clipboard.writeText as Mock).mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy({ errorMessage: '自定义失败' });
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(
      toastStore.items.value.some((t) => t.type === 'error' && t.message === '自定义失败'),
    ).toBe(true);
  });

  it('多次点击重置计时器', async () => {
    (navigator.clipboard.writeText as Mock).mockResolvedValue(undefined);
    const { copied, copy } = useCopy();

    await copy('hello');
    vi.advanceTimersByTime(1000);
    expect(copied.value).toBe(true);

    await copy('hello');
    vi.advanceTimersByTime(1000);
    expect(copied.value).toBe(true);

    vi.advanceTimersByTime(500);
    expect(copied.value).toBe(false);
  });
});
