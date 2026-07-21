import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toastStore } from '../toast';

describe('toastStore', () => {
  beforeEach(() => {
    toastStore.items.value = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('show 添加一条 toast，默认 type=success', () => {
    toastStore.show('已复制');
    expect(toastStore.items.value).toHaveLength(1);
    expect(toastStore.items.value[0]).toMatchObject({ message: '已复制', type: 'success' });
  });

  it('duration 后自动移除', () => {
    toastStore.show('临时', 'success', 3000);
    expect(toastStore.items.value).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(toastStore.items.value).toHaveLength(0);
  });

  it('success / error 设置正确 type', () => {
    toastStore.success('ok');
    toastStore.error('bad');
    expect(toastStore.items.value[0]!.type).toBe('success');
    expect(toastStore.items.value[1]!.type).toBe('error');
  });

  it('remove 按 id 精确移除', () => {
    const id = toastStore.show('a');
    toastStore.show('b');
    toastStore.remove(id);
    expect(toastStore.items.value).toHaveLength(1);
    expect(toastStore.items.value[0]!.message).toBe('b');
  });

  it('多条 toast 共存（队列）', () => {
    toastStore.success('a');
    toastStore.success('b');
    toastStore.success('c');
    expect(toastStore.items.value).toHaveLength(3);
  });
});
