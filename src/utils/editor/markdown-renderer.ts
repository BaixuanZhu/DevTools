/**
 * Markdown 渲染封装模块。
 *
 * 配置 marked 解析器并集成 Prism.js 代码块高亮，
 * 提供 `renderMarkdown` 函数供主组件调用。
 */
import { Marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-sql';

/** 配置并创建 Marked 实例 */
const marked = new Marked({
  gfm: true,
  breaks: false,
});

/** 自定义 renderer：代码块使用 Prism.js 高亮 */
const renderer = {
  code({ text, lang }: { text: string; lang?: string }): string {
    const language = lang && Prism.languages[lang] ? lang : 'plaintext';
    const highlighted = lang && Prism.languages[lang]
      ? Prism.highlight(text, Prism.languages[lang], language)
      : escapeHtml(text);
    return `<pre class="md-code-block"><code class="language-${language}">${highlighted}</code></pre>`;
  },
};

marked.use({ renderer });

/**
 * 将 Markdown 文本渲染为 HTML。
 * @param markdown - Markdown 源文本
 * @returns 渲染后的 HTML 字符串
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}

/**
 * HTML 转义工具函数。
 * @param str - 需要转义的字符串
 * @returns 转义后的字符串
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
