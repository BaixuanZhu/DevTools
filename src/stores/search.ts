import { ref } from 'vue';
import type { Ref } from 'vue';
import type { ToolMeta } from '../data/tools';

const query = ref('') as Ref<string>;

/**
 * 按关键词过滤工具列表（纯函数，便于单测）。
 *
 * 在 name / description / keywords 三处做大小写无关子串匹配。
 * @param tools 全量工具
 * @param q 搜索词
 * @returns 匹配工具的 id 集合；q 为空时返回 null 表示不筛选
 */
export function filterTools(tools: ToolMeta[], q: string): Set<string> | null {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  return new Set(
    tools
      .filter((t) => {
        const haystack = [t.name, t.description, ...t.keywords].join(' ').toLowerCase();
        return haystack.includes(needle);
      })
      .map((t) => t.id),
  );
}

/** 设置搜索词 */
function setQuery(v: string): void {
  query.value = v;
}

/** 清空搜索词 */
function clear(): void {
  query.value = '';
}

/** 搜索全局单例 store（替代 index.astro 的 Alpine 搜索状态） */
export const searchStore = { query, filterTools, setQuery, clear };
