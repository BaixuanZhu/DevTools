import { describe, it, expect } from 'vitest';
import {
  generateSitemapXml,
  escapeXml,
  parseBulkUrls,
  type SitemapData,
} from '../sitemap-generator';

describe('escapeXml', () => {
  it('转义 & < > " 五个 XML 特殊字符', () => {
    expect(escapeXml('a&b<c>"d\'e')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e');
  });
});

describe('generateSitemapXml', () => {
  it('生成标准 urlset，仅输出有值字段', () => {
    const data: SitemapData = {
      urls: [
        { id: 'u1', loc: 'https://example.com/', lastmod: '2026-06-24', changefreq: 'weekly', priority: 1 },
      ],
    };
    expect(generateSitemapXml(data)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url>\n' +
      '    <loc>https://example.com/</loc>\n' +
      '    <lastmod>2026-06-24</lastmod>\n' +
      '    <changefreq>weekly</changefreq>\n' +
      '    <priority>1.0</priority>\n' +
      '  </url>\n' +
      '</urlset>',
    );
  });

  it('对 loc 中的 & < > 做 XML 转义', () => {
    const data: SitemapData = {
      urls: [{ id: 'u1', loc: 'https://example.com/?a=1&b=2' }],
    };
    const xml = generateSitemapXml(data);
    expect(xml).toContain('<loc>https://example.com/?a=1&amp;b=2</loc>');
  });

  it('过滤空 loc 的条目', () => {
    const data: SitemapData = {
      urls: [
        { id: 'u1', loc: '' },
        { id: 'u2', loc: 'https://example.com/' },
      ],
    };
    expect(generateSitemapXml(data)).toContain('<loc>https://example.com/</loc>');
    expect(generateSitemapXml(data)).not.toContain('<loc></loc>');
  });

  it('无有效条目时输出空 urlset', () => {
    const xml = generateSitemapXml({ urls: [] });
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>',
    );
  });

  it('changefreq 与 priority 为空字符串时不输出对应节点', () => {
    const xml = generateSitemapXml({
      urls: [{ id: 'u1', loc: 'https://example.com/', changefreq: '', priority: '' }],
    });
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });
});

describe('parseBulkUrls', () => {
  it('按行拆分、去空白、去重、保序', () => {
    const text = 'https://a.com/\n  https://b.com/  \nhttps://a.com/\n\nhttps://c.com/';
    expect(parseBulkUrls(text)).toEqual([
      'https://a.com/',
      'https://b.com/',
      'https://c.com/',
    ]);
  });

  it('空文本返回空数组', () => {
    expect(parseBulkUrls('')).toEqual([]);
    expect(parseBulkUrls('\n  \n')).toEqual([]);
  });
});
