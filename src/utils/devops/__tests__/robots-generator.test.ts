import { describe, it, expect } from 'vitest';
import {
  generateRobotsTxt,
  buildAiBlockGroups,
  type RobotsData,
} from '../robots-generator';
import { AI_CRAWLERS } from '../ai-crawlers';

describe('generateRobotsTxt', () => {
  it('按组顺序输出 User-agent 与规则，组间空行分隔', () => {
    const data: RobotsData = {
      groups: [
        {
          id: 'g1',
          userAgents: ['*'],
          rules: [
            { id: 'r1', type: 'disallow', path: '/admin/' },
            { id: 'r2', type: 'allow', path: '/admin/login/' },
          ],
        },
      ],
      sitemaps: [],
    };
    expect(generateRobotsTxt(data)).toBe(
      'User-agent: *\nDisallow: /admin/\nAllow: /admin/login/',
    );
  });

  it('空规则组保留 Disallow: 兜底（表示允许全部）', () => {
    const data: RobotsData = {
      groups: [{ id: 'g1', userAgents: ['*'], rules: [] }],
      sitemaps: [],
    };
    expect(generateRobotsTxt(data)).toBe('User-agent: *\nDisallow:');
  });

  it('多组之间空行分隔，Sitemap 置于文件末尾', () => {
    const data: RobotsData = {
      groups: [
        { id: 'g1', userAgents: ['*'], rules: [{ id: 'r1', type: 'disallow', path: '/private/' }] },
        { id: 'g2', userAgents: ['BadBot'], rules: [{ id: 'r2', type: 'disallow', path: '/' }] },
      ],
      sitemaps: ['https://example.com/sitemap.xml'],
    };
    expect(generateRobotsTxt(data)).toBe(
      'User-agent: *\nDisallow: /private/\n\n' +
      'User-agent: BadBot\nDisallow: /\n\n' +
      'Sitemap: https://example.com/sitemap.xml',
    );
  });

  it('无任何组时仅输出 Sitemap 行', () => {
    const data: RobotsData = { groups: [], sitemaps: ['https://x.com/s.xml'] };
    expect(generateRobotsTxt(data)).toBe('Sitemap: https://x.com/s.xml');
  });

  it('完全空数据返回空串', () => {
    expect(generateRobotsTxt({ groups: [], sitemaps: [] })).toBe('');
  });
});

describe('buildAiBlockGroups', () => {
  it('为每个爬虫生成独立的 Disallow: / 拦截组，id 以 ai: 前缀标记', () => {
    const groups = buildAiBlockGroups(['GPTBot', 'ClaudeBot']);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      id: 'ai:GPTBot',
      userAgents: ['GPTBot'],
      rules: [{ id: 'ai:GPTBot:rule', type: 'disallow', path: '/' }],
      isAiBlock: true,
    });
    expect(groups[1].userAgents).toEqual(['ClaudeBot']);
  });

  it('空列表返回空数组', () => {
    expect(buildAiBlockGroups([])).toEqual([]);
  });
});

describe('AI_CRAWLERS 清单', () => {
  it('每项含 userAgent 与 vendor，且 userAgent 唯一', () => {
    const uas = AI_CRAWLERS.map((c) => c.userAgent);
    expect(new Set(uas).size).toBe(uas.length);
    for (const c of AI_CRAWLERS) {
      expect(typeof c.vendor).toBe('string');
      expect(c.vendor.length).toBeGreaterThan(0);
    }
  });
});
