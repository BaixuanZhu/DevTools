import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCopy } from '../useCopy';

describe('useCopy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
      },
    });
    vi.stubGlobal('document', {
      dispatchEvent: vi.fn(),
    });
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
    navigator.clipboard.writeText.mockResolvedValue(undefined);
    const { copied, copy } = useCopy();

    await copy('hello');
    expect(copied.value).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(copied.value).toBe(false);
  });

  it('复制失败时 copied 保持 false 并 dispatch toast', async () => {
    const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');
    navigator.clipboard.writeText.mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy();
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const dispatchedEvent = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(dispatchedEvent.type).toBe('toast');
    expect(dispatchedEvent.detail).toEqual({ message: '复制失败，请重试' });
  });

  it('支持自定义失败文案', async () => {
    const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');
    navigator.clipboard.writeText.mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy({ errorMessage: '自定义失败' });
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const dispatchedEvent = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(dispatchedEvent.type).toBe('toast');
    expect(dispatchedEvent.detail).toEqual({ message: '自定义失败' });
  });

  it('多次点击重置计时器', async () => {
    navigator.clipboard.writeText.mockResolvedValue(undefined);
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
