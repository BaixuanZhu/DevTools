/**
 * markdown-export 单元测试：HTML 导出主题注册表完整性与独立文档产物结构。
 * 只测纯函数 buildHtmlDocument（下载/打印函数依赖 DOM，不在 node 环境覆盖）。
 */
import { describe, it, expect } from 'vitest';
import {
  buildHtmlDocument,
  DEFAULT_HTML_THEME_ID,
  HTML_EXPORT_THEMES,
} from '../markdown-export';

/** 每个主题必须提供的变量集（排版消费面，缺一即出现无样式回退） */
const REQUIRED_VARIABLES = [
  '--mdc-bg',
  '--mdc-fg',
  '--mdc-muted',
  '--mdc-border',
  '--mdc-code-bg',
  '--mdc-code-fg',
  '--mdc-pre-bg',
  '--mdc-pre-fg',
  '--mdc-quote-bg',
  '--mdc-quote-border',
  '--mdc-link',
  '--mdc-font-body',
  '--mdc-font-code',
  '--mdc-font-size',
  '--mdc-line-height',
  '--mdc-content-width',
];

describe('HTML_EXPORT_THEMES', () => {
  it('内置 5 套主题且 id 唯一、kebab-case', () => {
    expect(HTML_EXPORT_THEMES).toHaveLength(5);
    const ids = HTML_EXPORT_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('缺省主题 ID 指向注册表内的经典浅色', () => {
    expect(DEFAULT_HTML_THEME_ID).toBe('classic-light');
    expect(HTML_EXPORT_THEMES.map((t) => t.id)).toContain(DEFAULT_HTML_THEME_ID);
  });

  it('每套主题变量集齐全且均有展示名', () => {
    for (const theme of HTML_EXPORT_THEMES) {
      for (const key of REQUIRED_VARIABLES) {
        expect(theme.variables[key], `${theme.id} 缺少 ${key}`).toBeTruthy();
      }
      expect(theme.name.trim()).not.toBe('');
    }
  });
});

describe('buildHtmlDocument', () => {
  const SAMPLE = '# 标题\n\n正文 **加粗** 与 `行内代码`。';

  it('渲染 Markdown 正文并烘入缺省主题', () => {
    const doc = buildHtmlDocument(SAMPLE);
    expect(doc).toContain('<h1>标题</h1>');
    expect(doc).toContain(`<html lang="zh-CN" data-theme="${DEFAULT_HTML_THEME_ID}">`);
  });

  it('themeId 指定主题，未知 id 回退缺省主题', () => {
    expect(buildHtmlDocument(SAMPLE, { themeId: 'dark' })).toContain('data-theme="dark"');
    expect(buildHtmlDocument(SAMPLE, { themeId: 'not-exist' })).toContain(
      `data-theme="${DEFAULT_HTML_THEME_ID}"`,
    );
  });

  it('内嵌全部主题变量段与主题切换器', () => {
    const doc = buildHtmlDocument(SAMPLE);
    for (const theme of HTML_EXPORT_THEMES) {
      expect(doc).toContain(`:root[data-theme="${theme.id}"]`);
    }
    expect(doc).toContain('id="mdoc-theme-select"');
    expect(doc).toContain('<script>');
    expect(doc).toContain('mdoc-theme');
  });

  it('产物零外部资源引用（不依赖任何网络请求）', () => {
    const doc = buildHtmlDocument(SAMPLE);
    expect(doc).not.toMatch(/<link\s/i);
    expect(doc).not.toMatch(/src=["']https?:/i);
    expect(doc).not.toMatch(/url\(\s*["']?https?:/i);
    expect(doc).not.toMatch(/<script[^>]+src=/i);
  });

  it('title 注入 <title> 并做 HTML 转义', () => {
    expect(buildHtmlDocument(SAMPLE, { title: '我的文档' })).toContain('<title>我的文档</title>');
    expect(buildHtmlDocument(SAMPLE, { title: 'A <b>"c" & d' })).toContain(
      '<title>A &lt;b&gt;&quot;c&quot; &amp; d</title>',
    );
  });

  it('空白标题回退缺省标题', () => {
    expect(buildHtmlDocument(SAMPLE, { title: '   ' })).toContain('<title>Markdown Export</title>');
  });
});
