import { describe, it, expect } from 'vitest';
import { categories } from '../categories';
import { categorySlugMap, type ToolCategory } from '../tools';

describe('categories.ts', () => {
  it('恰好 7 个分类', () => {
    expect(categories).toHaveLength(7);
  });

  it('slug 唯一且每条与 categorySlugMap 值一致', () => {
    const slugs = categories.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const validSlugs = Object.values(categorySlugMap);
    for (const c of categories) {
      expect(validSlugs).toContain(c.slug);
    }
  });

  it('每条 name 是合法 ToolCategory 且 description/icon 非空', () => {
    const validNames = Object.keys(categorySlugMap) as ToolCategory[];
    for (const c of categories) {
      expect(validNames).toContain(c.name);
      expect(c.description.trim().length).toBeGreaterThan(0);
      expect(c.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('每条 seoDescription 长度都在 120-160 字符区间且无首尾空白', () => {
    // 与 tools.ts seoDescription 守卫口径一致：Bing 判定下限 120、搜索结果截断上限 160
    for (const c of categories) {
      const len = [...c.seoDescription].length;
      expect(
        len,
        `${c.slug} 的 seoDescription 长度为 ${len}，要求 120-160`,
      ).toBeGreaterThanOrEqual(120);
      expect(len, `${c.slug} 的 seoDescription 长度为 ${len}，要求 120-160`).toBeLessThanOrEqual(160);
      expect(c.seoDescription.trim(), `${c.slug} 的 seoDescription 含首尾空白`).toBe(c.seoDescription);
    }
  });
});
