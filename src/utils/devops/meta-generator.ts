/**
 * Meta 标签生成器核心模块。
 *
 * 提供 HTML <title>、meta description/keywords、canonical、Open Graph、
 * Twitter Card 与 JSON-LD 结构化数据的纯函数生成。
 * 所有插入 HTML 属性值/文本的内容均经 `escapeHtmlAttr` 转义，
 * 不依赖第三方库，不使用 eval / Function(string)。
 */

/** Open Graph 资源类型 */
export type OgType = 'website' | 'article' | 'profile' | 'book';

/** Twitter Card 类型 */
export type TwitterCard = 'summary' | 'summary_large_image' | 'player' | 'app';

/** JSON-LD 结构化数据类型（schema.org 子集） */
export type JsonLdType = 'Article' | 'WebSite';

/** 社交平台标识（用于预览展示） */
export type SocialPlatform =
  | 'facebook'
  | 'x'
  | 'wechat'
  | 'linkedin'
  | 'telegram'
  | 'slack';

/** Meta 标签生成器表单数据 */
export interface MetaFormData {
  /** 页面标题（<title> / og:title / twitter:title） */
  title: string;
  /** 页面描述（meta description / og:description） */
  description: string;
  /** 关键词原文，逗号分隔（英文 `,` 或中文 `，`），运行时解析 */
  keywords: string;
  /** 规范链接（canonical / og:url） */
  canonicalUrl: string;
  /** 分享配图 URL（og:image / twitter:image） */
  imageUrl: string;
  /** 配图替代文本（og:image:alt） */
  imageAlt: string;
  /** 站点名称（og:site_name） */
  siteName: string;
  /** Open Graph 资源类型 */
  ogType: OgType;
  /** Twitter Card 类型 */
  twitterCard: TwitterCard;
  /** Twitter 站点账号（如 @example） */
  twitterSite: string;
  /** Twitter 作者账号（如 @author） */
  twitterCreator: string;
  /** JSON-LD 结构化数据类型 */
  jsonLdType: JsonLdType;
}

/** 默认表单数据（真实示例，打开页面即可见预览/代码） */
export const DEFAULT_META_FORM: MetaFormData = {
  title: '在线 Meta 标签生成器',
  description:
    '一行填写，实时生成 Basic、Open Graph、Twitter Card 与 JSON-LD 标签，附社交分享卡片预览。',
  keywords: 'meta 标签,open graph,og 标签,twitter card,json-ld,结构化数据',
  canonicalUrl: 'https://example.com/article/meta-tags',
  imageUrl: 'https://placehold.co/1200x630?text=OG+Image+Example',
  imageAlt: '示例 OG 预览图',
  siteName: '示例站点',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterSite: '@example',
  twitterCreator: '@author',
  jsonLdType: 'Article',
};

/**
 * 转义 HTML 属性值/文本中危险字符。
 *
 * 依次转义 `&` `<` `>` `"`（`&` 必须最先处理，避免二次转义，
 * 例如 `&lt;` 中的 `&` 先变成 `&amp;lt;` 而非 `&amp;lt;` 的重复）。
 * @param s - 原始字符串
 * @returns 转义后的安全字符串
 */
export function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 解析关键词字符串为关键词数组。
 *
 * 按英文 `,` 与中文 `，` 拆分，trim 每一项，去除空字符串，
 * 并按首次出现顺序去重。
 * @param s - 关键词原文
 * @returns 去重保序的关键词数组
 */
export function parseKeywords(s: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of s.split(/,|，/)) {
    const kw = raw.trim();
    if (kw === '' || seen.has(kw)) continue;
    seen.add(kw);
    result.push(kw);
  }
  return result;
}

/**
 * 判断字符串是否为合法的 http/https URL。
 *
 * 仅当非空且能被 `new URL` 解析、协议为 `http:` 或 `https:` 时返回 true。
 * 用于表单内联提示，**不阻断生成**。
 * @param s - 待校验字符串
 * @returns 合法 http/https URL 返回 true，否则 false
 */
export function isValidHttpUrl(s: string): boolean {
  if (s.trim() === '') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 生成基础 Meta 标签（<title>、description、keywords、canonical）。
 *
 * 按固定顺序、非空才输出对应标签；keywords 先经 `parseKeywords` 解析，
 * 解析结果非空才输出合并后的 meta keywords。
 * 每个插入属性/文本的值均经 `escapeHtmlAttr` 转义。
 * @param d - 表单数据
 * @returns 基础 Meta 标签文本，行间以 `\n` 连接
 */
export function generateBasicMeta(d: MetaFormData): string {
  const lines: string[] = [];

  if (d.title !== '') {
    lines.push(`<title>${escapeHtmlAttr(d.title)}</title>`);
  }
  if (d.description !== '') {
    lines.push(
      `<meta name="description" content="${escapeHtmlAttr(d.description)}">`,
    );
  }
  const kws = parseKeywords(d.keywords);
  if (kws.length > 0) {
    lines.push(
      `<meta name="keywords" content="${escapeHtmlAttr(kws.join(', '))}">`,
    );
  }
  if (d.canonicalUrl !== '') {
    lines.push(
      `<link rel="canonical" href="${escapeHtmlAttr(d.canonicalUrl)}">`,
    );
  }

  return lines.join('\n');
}

/**
 * 生成 Open Graph 标签。
 *
 * `og:type` 始终输出（使用 d.ogType）；其余字段非空才输出：
 * og:title / og:description / og:image / og:image:alt / og:url / og:site_name。
 * @param d - 表单数据
 * @returns Open Graph 标签文本，行间以 `\n` 连接
 */
export function generateOpenGraph(d: MetaFormData): string {
  const lines: string[] = [];

  if (d.title !== '') {
    lines.push(
      `<meta property="og:title" content="${escapeHtmlAttr(d.title)}">`,
    );
  }
  if (d.description !== '') {
    lines.push(
      `<meta property="og:description" content="${escapeHtmlAttr(d.description)}">`,
    );
  }
  if (d.imageUrl !== '') {
    lines.push(
      `<meta property="og:image" content="${escapeHtmlAttr(d.imageUrl)}">`,
    );
  }
  if (d.imageAlt !== '') {
    lines.push(
      `<meta property="og:image:alt" content="${escapeHtmlAttr(d.imageAlt)}">`,
    );
  }
  if (d.canonicalUrl !== '') {
    lines.push(
      `<meta property="og:url" content="${escapeHtmlAttr(d.canonicalUrl)}">`,
    );
  }
  if (d.siteName !== '') {
    lines.push(
      `<meta property="og:site_name" content="${escapeHtmlAttr(d.siteName)}">`,
    );
  }
  // og:type 始终输出
  lines.push(`<meta property="og:type" content="${escapeHtmlAttr(d.ogType)}">`);

  return lines.join('\n');
}

/**
 * 生成 Twitter Card 标签。
 *
 * `twitter:card` 始终输出（使用 d.twitterCard）；其余字段非空才输出：
 * twitter:title / twitter:description / twitter:image / twitter:url /
 * twitter:site / twitter:creator。
 * @param d - 表单数据
 * @returns Twitter Card 标签文本，行间以 `\n` 连接
 */
export function generateTwitterCard(d: MetaFormData): string {
  const lines: string[] = [];

  // twitter:card 始终输出
  lines.push(
    `<meta name="twitter:card" content="${escapeHtmlAttr(d.twitterCard)}">`,
  );
  if (d.title !== '') {
    lines.push(
      `<meta name="twitter:title" content="${escapeHtmlAttr(d.title)}">`,
    );
  }
  if (d.description !== '') {
    lines.push(
      `<meta name="twitter:description" content="${escapeHtmlAttr(d.description)}">`,
    );
  }
  if (d.imageUrl !== '') {
    lines.push(
      `<meta name="twitter:image" content="${escapeHtmlAttr(d.imageUrl)}">`,
    );
  }
  if (d.canonicalUrl !== '') {
    lines.push(
      `<meta name="twitter:url" content="${escapeHtmlAttr(d.canonicalUrl)}">`,
    );
  }
  if (d.twitterSite !== '') {
    lines.push(
      `<meta name="twitter:site" content="${escapeHtmlAttr(d.twitterSite)}">`,
    );
  }
  if (d.twitterCreator !== '') {
    lines.push(
      `<meta name="twitter:creator" content="${escapeHtmlAttr(d.twitterCreator)}">`,
    );
  }

  return lines.join('\n');
}

/**
 * 生成 JSON-LD 结构化数据脚本块。
 *
 * 根据类型构造 schema.org 对象：
 * - Article：headline / description / image / url / mainEntityOfPage / keywords
 * - WebSite：name / description / url / image
 *
 * 使用 `JSON.stringify(obj, null, 2)` 美化输出（JSON.stringify 自带转义，
 * 不对 JSON 内字符串预先 escape），外层包裹
 * `<script type="application/ld+json">...</script>`。
 * @param d - 表单数据
 * @returns 可直接粘贴的 JSON-LD 脚本块
 */
export function generateJsonLd(d: MetaFormData): string {
  const kws = parseKeywords(d.keywords).join(', ');

  if (d.jsonLdType === 'Article') {
    const obj: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: d.title,
    };
    if (d.description !== '') obj.description = d.description;
    if (d.imageUrl !== '') obj.image = d.imageUrl;
    if (d.canonicalUrl !== '') {
      obj.url = d.canonicalUrl;
      obj.mainEntityOfPage = d.canonicalUrl;
    }
    if (kws !== '') obj.keywords = kws;
    return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
  }

  // WebSite
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: d.title,
  };
  if (d.description !== '') obj.description = d.description;
  if (d.canonicalUrl !== '') obj.url = d.canonicalUrl;
  if (d.imageUrl !== '') obj.image = d.imageUrl;
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

/**
 * 生成基础 + Open Graph + Twitter Card 组合标签（不含 JSON-LD）。
 *
 * 三段标签之间以空行分隔，便于直接粘贴到 <head>。
 * @param d - 表单数据
 * @returns 组合 Meta 标签文本
 */
export function generateAllMetaTags(d: MetaFormData): string {
  return (
    generateBasicMeta(d) +
    '\n\n' +
    generateOpenGraph(d) +
    '\n\n' +
    generateTwitterCard(d)
  );
}
