import { describe, it, expect } from 'vitest';
import { tools, categorySlugMap, type ToolCategory } from '../tools';

const validSlugs = new Set(Object.values(categorySlugMap));
const validCategories = new Set(Object.keys(categorySlugMap) as ToolCategory[]);

/**
 * 单段路径例外（旗舰工作台页）：路径不携带分类前缀，不在 categorySlugMap 内。
 * 该例外须与 astro.config.mjs 的 CATEGORY_SLUGS 单段 sitemap 白名单保持人工同步；
 * 新增单段路径时必须同时更新两处并补 301 重定向，防止随意产生单段工具 URL。
 */
const FLAGSHIP_SINGLE_SEGMENT_PATHS = new Set(['/markdown']);

describe('tools.ts 分类与路径一致性', () => {
  it('每个 tool.path 第一段 ∈ categorySlugMap 的 slug 集合（旗舰单段页除外）', () => {
    for (const t of tools) {
      if (FLAGSHIP_SINGLE_SEGMENT_PATHS.has(t.path)) continue;
      const seg = t.path.split('/')[1];
      expect(validSlugs.has(seg), `${t.id} path 首段 ${seg} 非法`).toBe(true);
    }
  });

  it('单段路径工具必须显式登记在旗舰例外清单中', () => {
    const singleSegmentPaths = tools
      .filter((t) => t.path.split('/').length === 2)
      .map((t) => t.path);
    expect(new Set(singleSegmentPaths)).toEqual(FLAGSHIP_SINGLE_SEGMENT_PATHS);
  });

  it('每个 tool.category ∈ 7 个新分类', () => {
    for (const t of tools) {
      expect(validCategories.has(t.category), `${t.id} category ${t.category} 非法`).toBe(true);
    }
  });

  it('tool.path 首段与 category 经 categorySlugMap 一致（旗舰单段页除外）', () => {
    for (const t of tools) {
      if (FLAGSHIP_SINGLE_SEGMENT_PATHS.has(t.path)) continue;
      const prefix = `/${categorySlugMap[t.category]}/`;
      expect(t.path.startsWith(prefix), `${t.id} path 与 category 不一致`).toBe(true);
    }
  });

  it('tool.id === tool.path 末段（旗舰单段页按例外豁免）', () => {
    for (const t of tools) {
      if (FLAGSHIP_SINGLE_SEGMENT_PATHS.has(t.path)) continue;
      expect(t.path.endsWith(`/${t.id}`), `${t.id} path 末段不符`).toBe(true);
    }
  });

  it('旗舰工作台例外：markdown-editor 独占 /markdown 且保留分类归属', () => {
    const tool = tools.find((t) => t.id === 'markdown-editor');
    expect(tool?.path).toBe('/markdown');
    // 分类保留用于分类页卡片 / Sidebar 徽标 / 搜索分组等入口归组
    expect(tool?.category).toBe('开发与运维');
  });
});
