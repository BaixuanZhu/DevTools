/** sitemap 允许的更新频率（sitemaps.org 协议） */
export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

/** 一条 URL 记录 */
export interface SitemapUrl {
  id: string;
  /** 完整 URL，必填 */
  loc: string;
  /** 最后修改时间 YYYY-MM-DD（Google 唯一真正参考的字段） */
  lastmod?: string;
  /** 预期更新频率（Google 已忽略，仅作参考）；'' 表示未设置 */
  changefreq?: ChangeFreq | '';
  /** 站内相对优先级 0.0-1.0（Google 已忽略）；'' 表示未设置 */
  priority?: number | '';
}

/** 完整 sitemap 数据 */
export interface SitemapData {
  urls: SitemapUrl[];
}

/**
 * 转义 XML 文本中的特殊字符。
 *
 * `&` 必须最先处理，避免二次转义。
 * @param s - 原始字符串
 * @returns 转义后的 XML 安全字符串
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 将 sitemap 数据生成为标准 sitemap.xml 文本。
 *
 * 仅输出 loc 非空的条目；每条仅输出有值的子元素；loc 等文本经 escapeXml 转义。
 * @param data - sitemap 数据
 * @returns 标准 sitemap.xml 文本
 */
export function generateSitemapXml(data: SitemapData): string {
  const entries = data.urls
    .filter((u) => u.loc.trim() !== '')
    .map((u) => {
      const children: string[] = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) children.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
      if (u.changefreq) children.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (typeof u.priority === 'number') {
        children.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${children.join('\n')}\n  </url>`;
    });

  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  if (entries.length === 0) return `${header}\n</urlset>`;
  return `${header}\n${entries.join('\n')}\n</urlset>`;
}

/**
 * 解析批量粘贴文本为 URL 数组。
 *
 * 按行拆分，去除每行首尾空白与空行，按首次出现顺序去重。
 * @param text - 多行 URL 文本
 * @returns 去重保序的 URL 数组
 */
export function parseBulkUrls(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split('\n')) {
    const url = line.trim();
    if (url === '' || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}
