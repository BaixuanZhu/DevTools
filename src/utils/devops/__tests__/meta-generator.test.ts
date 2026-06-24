import { describe, it, expect } from 'vitest';
import {
  escapeHtmlAttr,
  parseKeywords,
  isValidHttpUrl,
  generateBasicMeta,
  generateOpenGraph,
  generateTwitterCard,
  generateJsonLd,
  generateAllMetaTags,
  DEFAULT_META_FORM,
  type MetaFormData,
} from '../meta-generator';

/** 构造一份字段齐全的测试表单数据 */
function fullForm(): MetaFormData {
  return {
    title: '测试标题',
    description: '测试描述',
    keywords: 'meta, 标签, og, twitter',
    canonicalUrl: 'https://example.com/page',
    imageUrl: 'https://example.com/image.png',
    imageAlt: '替代文本',
    siteName: '测试站点',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterSite: '@site',
    twitterCreator: '@author',
    jsonLdType: 'Article',
  };
}

/** 构造一份所有可选字段均为空的测试表单数据 */
function emptyForm(): MetaFormData {
  return {
    title: '',
    description: '',
    keywords: '',
    canonicalUrl: '',
    imageUrl: '',
    imageAlt: '',
    siteName: '',
    ogType: 'website',
    twitterCard: 'summary',
    twitterSite: '',
    twitterCreator: '',
    jsonLdType: 'Article',
  };
}

describe('escapeHtmlAttr', () => {
  it('转义 & < > " 四个危险字符', () => {
    expect(escapeHtmlAttr('a & b < c > d " e')).toBe(
      'a &amp; b &lt; c &gt; d &quot; e',
    );
  });

  it('普通文本保持不变', () => {
    expect(escapeHtmlAttr('hello world 你好')).toBe('hello world 你好');
  });

  it('空字符串保持为空', () => {
    expect(escapeHtmlAttr('')).toBe('');
  });

  it('& 先转义，避免 &lt; 被二次转义', () => {
    // 已转义的片段再次转义应保持幂等语义：&lt; → &amp;lt;（而非 &amp;lt; 的重复）
    expect(escapeHtmlAttr('&lt;')).toBe('&amp;lt;');
    // 直接的 < 转一次得到 &lt;，不会再被转
    expect(escapeHtmlAttr('<')).toBe('&lt;');
  });
});

describe('parseKeywords', () => {
  it('按英文逗号拆分并 trim', () => {
    expect(parseKeywords(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('按中文逗号拆分', () => {
    expect(parseKeywords('meta 标签，open graph，og')).toEqual([
      'meta 标签',
      'open graph',
      'og',
    ]);
  });

  it('混合英文/中文逗号拆分', () => {
    expect(parseKeywords('a, b，c, d，e')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('去除空字符串', () => {
    expect(parseKeywords('a, , b,')).toEqual(['a', 'b']);
  });

  it('去重并保持首次出现顺序', () => {
    expect(parseKeywords('a, b, a, c, b')).toEqual(['a', 'b', 'c']);
  });

  it('空字符串返回空数组', () => {
    expect(parseKeywords('')).toEqual([]);
  });
});

describe('isValidHttpUrl', () => {
  it('合法 https URL 返回 true', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
  });

  it('合法 http URL 返回 true', () => {
    expect(isValidHttpUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('空字符串返回 false', () => {
    expect(isValidHttpUrl('')).toBe(false);
  });

  it('非 URL 文本返回 false', () => {
    expect(isValidHttpUrl('not a url')).toBe(false);
  });

  it('缺少 scheme 返回 false', () => {
    expect(isValidHttpUrl('example.com')).toBe(false);
  });

  it('非 http/https 协议返回 false', () => {
    expect(isValidHttpUrl('ftp://x')).toBe(false);
  });
});

describe('generateBasicMeta', () => {
  it('完整数据生成 title/description/keywords/canonical', () => {
    const out = generateBasicMeta(fullForm());
    expect(out).toContain('<title>测试标题</title>');
    expect(out).toContain(
      '<meta name="description" content="测试描述">',
    );
    expect(out).toContain(
      '<meta name="keywords" content="meta, 标签, og, twitter">',
    );
    expect(out).toContain(
      '<link rel="canonical" href="https://example.com/page">',
    );
  });

  it('keywords 去重后合并', () => {
    const form = fullForm();
    form.keywords = 'a, b, a, c';
    const out = generateBasicMeta(form);
    expect(out).toContain('<meta name="keywords" content="a, b, c">');
  });

  it('空字段被跳过（仅剩空字符串）', () => {
    const out = generateBasicMeta(emptyForm());
    expect(out).toBe('');
  });

  it('keywords 仅有空白时不输出 keywords 标签', () => {
    const form = emptyForm();
    form.title = 'T';
    form.keywords = ' , , ';
    const out = generateBasicMeta(form);
    expect(out).not.toContain('keywords');
    expect(out).toContain('<title>T</title>');
  });

  it('title/description 含特殊字符时输出已转义', () => {
    const form = emptyForm();
    form.title = 'A & B <C> "D"';
    form.description = 'x < y > z & "q"';
    const out = generateBasicMeta(form);
    expect(out).toContain('<title>A &amp; B &lt;C&gt; &quot;D&quot;</title>');
    expect(out).toContain(
      '<meta name="description" content="x &lt; y &gt; z &amp; &quot;q&quot;">',
    );
  });
});

describe('generateOpenGraph', () => {
  it('完整数据输出 og:title / og:image / og:type=website', () => {
    const out = generateOpenGraph(fullForm());
    expect(out).toContain('<meta property="og:title" content="测试标题">');
    expect(out).toContain(
      '<meta property="og:image" content="https://example.com/image.png">',
    );
    expect(out).toContain('<meta property="og:type" content="website">');
  });

  it('其余字段为空时 og:type 仍存在', () => {
    const out = generateOpenGraph(emptyForm());
    expect(out).toBe('<meta property="og:type" content="website">');
  });

  it('article 类型时 og:type 输出 article', () => {
    const form = fullForm();
    form.ogType = 'article';
    const out = generateOpenGraph(form);
    expect(out).toContain('<meta property="og:type" content="article">');
  });
});

describe('generateTwitterCard', () => {
  it('twitter:card 始终存在', () => {
    const out = generateTwitterCard(emptyForm());
    expect(out).toBe('<meta name="twitter:card" content="summary">');
  });

  it('完整数据条件输出其余字段', () => {
    const out = generateTwitterCard(fullForm());
    expect(out).toContain(
      '<meta name="twitter:card" content="summary_large_image">',
    );
    expect(out).toContain('<meta name="twitter:title" content="测试标题">');
    expect(out).toContain(
      '<meta name="twitter:image" content="https://example.com/image.png">',
    );
    expect(out).toContain('<meta name="twitter:site" content="@site">');
    expect(out).toContain('<meta name="twitter:creator" content="@author">');
  });
});

describe('generateJsonLd', () => {
  it('Article 类型输出 @type=Article 且含 headline', () => {
    const out = generateJsonLd(fullForm());
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('"@type": "Article"');
    expect(out).toContain('"headline": "测试标题"');
  });

  it('WebSite 类型输出 @type=WebSite 且含 name', () => {
    const form = fullForm();
    form.jsonLdType = 'WebSite';
    const out = generateJsonLd(form);
    expect(out).toContain('"@type": "WebSite"');
    expect(out).toContain('"name": "测试标题"');
  });

  it('外层包裹 application/ld+json 脚本块', () => {
    const out = generateJsonLd(fullForm());
    expect(out.startsWith('<script type="application/ld+json">\n')).toBe(true);
    expect(out.trim().endsWith('</script>')).toBe(true);
  });

  it('内部 JSON 块可被 JSON.parse 成功解析', () => {
    const out = generateJsonLd(fullForm());
    const start = out.indexOf('\n', out.indexOf('<script'));
    const end = out.lastIndexOf('</script>');
    const jsonText = out.slice(start + 1, end).trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Article');
  });

  it('Article 含 url 与 mainEntityOfPage（canonical 非空）', () => {
    const out = generateJsonLd(fullForm());
    const jsonText = out
      .slice(out.indexOf('\n') + 1, out.lastIndexOf('</script>'))
      .trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    expect(parsed.url).toBe('https://example.com/page');
    expect(parsed.mainEntityOfPage).toBe('https://example.com/page');
  });

  it('Article canonical 为空时不含 url 与 mainEntityOfPage', () => {
    const form = fullForm();
    form.canonicalUrl = '';
    const out = generateJsonLd(form);
    const jsonText = out
      .slice(out.indexOf('\n') + 1, out.lastIndexOf('</script>'))
      .trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    expect(parsed.url).toBeUndefined();
    expect(parsed.mainEntityOfPage).toBeUndefined();
  });

  it('内部含双引号描述可正常序列化（不自预先 escape）', () => {
    const form = fullForm();
    form.description = '含 "引号" 的描述';
    const out = generateJsonLd(form);
    const jsonText = out
      .slice(out.indexOf('\n') + 1, out.lastIndexOf('</script>'))
      .trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    expect(parsed.description).toBe('含 "引号" 的描述');
  });
});

describe('generateAllMetaTags', () => {
  it('包含 Basic + Open Graph + Twitter 标记', () => {
    const out = generateAllMetaTags(fullForm());
    expect(out).toContain('<title>');
    expect(out).toContain('og:title');
    expect(out).toContain('twitter:card');
  });

  it('不包含 JSON-LD 脚本块', () => {
    const out = generateAllMetaTags(fullForm());
    expect(out).not.toContain('application/ld+json');
  });

  it('默认表单可生成完整内容', () => {
    const out = generateAllMetaTags(DEFAULT_META_FORM);
    expect(out).toContain('在线 Meta 标签生成器');
    expect(out).toContain('og:type');
    expect(out).toContain('twitter:card');
  });
});
