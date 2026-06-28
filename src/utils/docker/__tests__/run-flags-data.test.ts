/**
 * docker run flag 速查数据单元测试。
 */
import { describe, it, expect } from 'vitest';
import { RUN_FLAGS, RUN_FLAG_CATEGORIES } from '../run-flags-data';

describe('run-flags-data', () => {
  it('包含至少 30 条 flag 数据', () => {
    expect(RUN_FLAGS.length).toBeGreaterThanOrEqual(30);
  });

  it('每条数据都有 flag、category、description、example', () => {
    RUN_FLAGS.forEach((entry) => {
      expect(entry.flag).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.example).toBeTruthy();
      expect(RUN_FLAG_CATEGORIES).toContain(entry.category);
    });
  });

  it('没有重复的 flag 名称', () => {
    const flags = RUN_FLAGS.map((e) => e.flag);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it('包含核心 flag', () => {
    const flags = RUN_FLAGS.map((e) => e.flag);
    expect(flags).toContain('-d, --detach');
    expect(flags).toContain('-p, --publish');
    expect(flags).toContain('-e, --env');
    expect(flags).toContain('-v, --volume');
  });
});
