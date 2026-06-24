/** 规则类型 */
export type RuleType = 'allow' | 'disallow';

/** 一条 Allow / Disallow 路径规则 */
export interface PathRule {
  id: string;
  type: RuleType;
  /** 路径，如 '/private/'、'/*?$' */
  path: string;
}

/** 一个 User-agent 规则组（v1 每组单个 UA） */
export interface AgentGroup {
  id: string;
  userAgents: string[];
  rules: PathRule[];
  /** 是否由 AI 拦截自动生成（只读，与手动组区分，移除时按 id 精确匹配） */
  isAiBlock?: boolean;
}

/** 完整 robots.txt 数据 */
export interface RobotsData {
  groups: AgentGroup[];
  /** Sitemap: 引用 URL 列表 */
  sitemaps: string[];
}

/**
 * 将 robots 数据生成为标准 robots.txt 文本。
 *
 * 按组顺序输出：每组 User-agent 行在前、Allow/Disallow 规则行在后；
 * 组间以空行分隔；Sitemap 行统一置于文件末尾。
 * @param data - robots 数据
 * @returns 标准 robots.txt 文本
 */
export function generateRobotsTxt(data: RobotsData): string {
  const blocks: string[] = [];

  for (const group of data.groups) {
    if (group.userAgents.length === 0) continue;
    const lines: string[] = group.userAgents.map((ua) => `User-agent: ${ua}`);
    if (group.rules.length === 0) {
      lines.push('Disallow:');
    } else {
      for (const rule of group.rules) {
        const key = rule.type === 'allow' ? 'Allow' : 'Disallow';
        lines.push(`${key}: ${rule.path}`);
      }
    }
    blocks.push(lines.join('\n'));
  }

  const groupText = blocks.join('\n\n');
  if (data.sitemaps.length === 0) return groupText;

  const sitemapText = data.sitemaps.map((s) => `Sitemap: ${s}`).join('\n');
  return groupText ? `${groupText}\n\n${sitemapText}` : sitemapText;
}

/**
 * 根据已勾选的 AI 爬虫列表生成拦截规则组。
 *
 * 每个爬虫一个独立组：`User-agent: <bot>` + `Disallow: /`。
 * 组 id 固定为 `ai:<bot>`，便于取消勾选时按 id 精确移除。
 * @param agents - 已勾选的爬虫 User-agent 列表
 * @returns AI 拦截规则组数组
 */
export function buildAiBlockGroups(agents: string[]): AgentGroup[] {
  return agents.map((ua) => ({
    id: `ai:${ua}`,
    userAgents: [ua],
    rules: [{ id: `ai:${ua}:rule`, type: 'disallow', path: '/' }],
    isAiBlock: true,
  }));
}

/** 新建一个空规则组（运行时交互用，id 随机生成）。 */
export function createAgentGroup(userAgent: string): AgentGroup {
  return { id: crypto.randomUUID(), userAgents: [userAgent], rules: [] };
}

/** 新建一条路径规则（运行时交互用，id 随机生成）。 */
export function createPathRule(type: RuleType, path: string): PathRule {
  return { id: crypto.randomUUID(), type, path };
}
