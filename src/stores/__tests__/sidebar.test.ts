import { describe, it, expect, beforeEach } from 'vitest';
import { sidebarStore } from '../sidebar';

describe('sidebarStore', () => {
  beforeEach(() => {
    sidebarStore.isOpen.value = false;
  });

  it('open / close / toggle', () => {
    expect(sidebarStore.isOpen.value).toBe(false);
    sidebarStore.open();
    expect(sidebarStore.isOpen.value).toBe(true);
    sidebarStore.close();
    expect(sidebarStore.isOpen.value).toBe(false);
    sidebarStore.toggle();
    expect(sidebarStore.isOpen.value).toBe(true);
    sidebarStore.toggle();
    expect(sidebarStore.isOpen.value).toBe(false);
  });
});
