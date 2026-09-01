import { describe, it, expect } from 'vitest';
import { tools, categorySlugMap, getToolsByCategory, type ToolCategory } from '../tools';

const validSlugs = new Set(Object.values(categorySlugMap));
const validCategories = new Set(Object.keys(categorySlugMap) as ToolCategory[]);

/**
 * 单段路径例外（独立工作台页）：路径不携带分类前缀，不在 categorySlugMap 内。
 * 该例外须与 astro.config.mjs 的 CATEGORY_SLUGS 单段 sitemap 白名单保持人工同步；
 * 新增单段路径时必须同时更新两处并补 301 重定向，防止随意产生单段工具 URL。
 */
const FLAGSHIP_SINGLE_SEGMENT_PATHS = new Set(['/markdown']);

describe('tools.ts 分类与路径一致性', () => {
  it('每个 tool.path 第一段 ∈ categorySlugMap 的 slug 集合（独立工作台除外）', () => {
    for (const t of tools) {
      if (t.standalone) continue;
      const seg = t.path.split('/')[1];
      expect(validSlugs.has(seg), `${t.id} path 首段 ${seg} 非法`).toBe(true);
    }
  });

  it('standalone ⇔ 单段路径，且单段路径必须显式登记在旗舰例外清单中', () => {
    const singleSegmentPaths = tools
      .filter((t) => t.path.split('/').length === 2)
      .map((t) => t.path);
    expect(new Set(singleSegmentPaths)).toEqual(FLAGSHIP_SINGLE_SEGMENT_PATHS);

    for (const t of tools) {
      const isSingle = t.path.split('/').length === 2;
      expect(!!t.standalone, `${t.id} standalone 标记与单段路径不一致`).toBe(isSingle);
      if (t.standalone) {
        expect(FLAGSHIP_SINGLE_SEGMENT_PATHS.has(t.path), `${t.id} 未登记进旗舰例外清单`).toBe(true);
      }
    }
  });

  it('每个有分类的 tool.category ∈ 7 个新分类，且 standalone 工具必须省略 category', () => {
    for (const t of tools) {
      if (t.standalone) {
        expect(t.category, `${t.id} 为独立工作台，不应归属分类`).toBeUndefined();
        continue;
      }
      expect(t.category, `${t.id} 非独立工作台必须声明分类`).toBeDefined();
      expect(validCategories.has(t.category!), `${t.id} category ${t.category} 非法`).toBe(true);
    }
  });

  it('tool.path 首段与 category 经 categorySlugMap 一致（独立工作台除外）', () => {
    for (const t of tools) {
      if (t.standalone) continue;
      const prefix = `/${categorySlugMap[t.category!]}/`;
      expect(t.path.startsWith(prefix), `${t.id} path 与 category 不一致`).toBe(true);
    }
  });

  it('tool.id === tool.path 末段（独立工作台按例外豁免）', () => {
    for (const t of tools) {
      if (t.standalone) continue;
      expect(t.path.endsWith(`/${t.id}`), `${t.id} path 末段不符`).toBe(true);
    }
  });

  it('独立工作台锚定：markdown-editor 独占 /markdown，不归属分类且不出现在分类聚合', () => {
    const tool = tools.find((t) => t.id === 'markdown-editor');
    expect(tool?.path).toBe('/markdown');
    expect(tool?.standalone).toBe(true);
    expect(tool?.category).toBeUndefined();

    // 分类聚合排除独立工作台：devops 分组不得再含 markdown-editor
    const grouped = Object.values(getToolsByCategory()).flat();
    expect(grouped.some((t) => t.id === 'markdown-editor')).toBe(false);
    expect(grouped.every((t) => !t.standalone)).toBe(true);
  });
});

describe('tools.ts seoDescription 长度守卫', () => {
  /**
   * meta description 合规区间（按 JS 字符数，中文每字计 1）。
   * 下限 120：低于该值会被 Bing Webmaster Tools SEO 分析判定为"描述过短"；
   * 上限 160：超过该值在搜索结果中会被截断。与 tools.ts 字段注释口径一致。
   */
  const MIN = 120;
  const MAX = 160;

  it('每个工具的 seoDescription 长度都在 120-160 字符区间', () => {
    for (const t of tools) {
      const len = [...t.seoDescription].length;
      expect(
        len,
        `${t.id} 的 seoDescription 长度为 ${len}，要求 ${MIN}-${MAX}`,
      ).toBeGreaterThanOrEqual(MIN);
      expect(len, `${t.id} 的 seoDescription 长度为 ${len}，要求 ${MIN}-${MAX}`).toBeLessThanOrEqual(MAX);
    }
  });

  it('每个工具的 seoDescription 无首尾空白', () => {
    for (const t of tools) {
      expect(t.seoDescription.trim(), `${t.id} 的 seoDescription 含首尾空白`).toBe(t.seoDescription);
    }
  });
});

describe('tools.ts title 长度守卫', () => {
  /**
   * 页面 <title> 合规区间（按 JS 字符数，中文每字计 1）。
   * 下限 25：显著高于 Bing Webmaster Tools「标题过短」判定线，避免整站 SEO 告警；
   * 上限 60：超过该值在搜索结果中会被截断，目标带 25-45。与 tools.ts title 字段注释口径一致。
   */
  const MIN = 25;
  const MAX = 60;

  it('每个工具都显式配置 title，不依赖 ToolLayout 回退拼接', () => {
    for (const t of tools) {
      expect(t.title, `${t.id} 未配置 title 字段`).toBeDefined();
    }
  });

  it('每个工具的 title 长度都在 25-60 字符区间', () => {
    for (const t of tools) {
      const len = [...(t.title ?? '')].length;
      expect(
        len,
        `${t.id} 的 title 长度为 ${len}，要求 ${MIN}-${MAX}`,
      ).toBeGreaterThanOrEqual(MIN);
      expect(len, `${t.id} 的 title 长度为 ${len}，要求 ${MIN}-${MAX}`).toBeLessThanOrEqual(MAX);
    }
  });

  it('每个工具的 title 无首尾空白', () => {
    for (const t of tools) {
      expect(t.title?.trim(), `${t.id} 的 title 含首尾空白`).toBe(t.title);
    }
  });
});
