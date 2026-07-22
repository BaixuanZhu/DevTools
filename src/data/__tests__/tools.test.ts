import { describe, it, expect } from 'vitest';
import { tools, categorySlugMap, type ToolCategory } from '../tools';

const validSlugs = new Set(Object.values(categorySlugMap));
const validCategories = new Set(Object.keys(categorySlugMap) as ToolCategory[]);

describe('tools.ts 分类与路径一致性', () => {
  it('每个 tool.path 第一段 ∈ categorySlugMap 的 slug 集合', () => {
    for (const t of tools) {
      const seg = t.path.split('/')[1];
      expect(validSlugs.has(seg), `${t.id} path 首段 ${seg} 非法`).toBe(true);
    }
  });

  it('每个 tool.category ∈ 7 个新分类', () => {
    for (const t of tools) {
      expect(validCategories.has(t.category), `${t.id} category ${t.category} 非法`).toBe(true);
    }
  });

  it('tool.path 首段与 category 经 categorySlugMap 一致', () => {
    for (const t of tools) {
      const prefix = `/${categorySlugMap[t.category]}/`;
      expect(t.path.startsWith(prefix), `${t.id} path 与 category 不一致`).toBe(true);
    }
  });

  it('tool.id === tool.path 末段', () => {
    for (const t of tools) {
      expect(t.path.endsWith(`/${t.id}`), `${t.id} path 末段不符`).toBe(true);
    }
  });
});
