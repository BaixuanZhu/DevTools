/**
 * Markdown 导出功能模块（Markdown 工作台消费）。
 *
 * 支持 .md 文件下载、.html 文件下载和 .pdf（浏览器打印）三种导出方式。
 * HTML 导出内部用 marked 渲染（不再依赖外部传入渲染结果），套内嵌多主题的
 * 独立文档模板：全部主题以 CSS 变量集内嵌进单文件，文件自带主题切换器，
 * 零外部资源；预览（HtmlExportDialog）与下载共用 buildHtmlDocument，保证所见即所得。
 */
import { Marked } from 'marked';

/** HTML 导出用的 marked 实例：GFM（表格/任务列表/删除线），换行不强制转 <br> */
const marked = new Marked({ gfm: true, breaks: false });

/** 导出 HTML 主题：variables 挂到 `:root[data-theme="{id}"]` 上，基础排版只消费这些声明 */
export interface HtmlExportTheme {
  /** 主题 ID（产物 data-theme 值与切换记忆键值），kebab-case */
  id: string;
  /** 展示名（切换器选项文案） */
  name: string;
  /** CSS 声明集：键为 `--mdc-*` 自定义属性，可夹带 color-scheme 等根声明 */
  variables: Record<string, string>;
}

/** buildHtmlDocument / exportHtml 的可选项 */
export interface HtmlExportOptions {
  /** 打开文件时的默认主题 ID，未知值回退 DEFAULT_HTML_THEME_ID */
  themeId?: string;
  /** 文档 <title>（调用方传入用户可见标题），缺省 'Markdown Export' */
  title?: string;
}

/** 缺省主题 ID：经典浅色（迁移自旧版单模板观感） */
export const DEFAULT_HTML_THEME_ID = 'classic-light';

/** 通用字体栈（各主题按需复用） */
const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const FONT_MONO = "'JetBrains Mono', Consolas, 'Courier New', monospace";

/**
 * 内嵌导出文件的全部主题（数组顺序即切换器选项顺序）。
 * 变量语义见各键名；行内代码与代码块分设前景/背景，支持「浅底行内码 + 深底代码块」类主题。
 */
export const HTML_EXPORT_THEMES: HtmlExportTheme[] = [
  {
    id: 'classic-light',
    name: '经典浅色',
    variables: {
      '--mdc-bg': '#ffffff',
      '--mdc-fg': '#09090b',
      '--mdc-muted': '#71717a',
      '--mdc-border': '#e4e4e7',
      '--mdc-code-bg': '#f4f4f5',
      '--mdc-code-fg': '#09090b',
      '--mdc-pre-bg': '#f4f4f5',
      '--mdc-pre-fg': '#09090b',
      '--mdc-quote-bg': '#f4f4f5',
      '--mdc-quote-border': '#e4e4e7',
      '--mdc-link': '#18181b',
      '--mdc-font-body': FONT_SANS,
      '--mdc-font-code': FONT_MONO,
      '--mdc-font-size': '16px',
      '--mdc-line-height': '1.7',
      '--mdc-content-width': '800px',
    },
  },
  {
    id: 'dark',
    name: '暗色',
    variables: {
      '--mdc-bg': '#18181b',
      '--mdc-fg': '#e4e4e7',
      '--mdc-muted': '#a1a1aa',
      '--mdc-border': '#3f3f46',
      '--mdc-code-bg': '#27272a',
      '--mdc-code-fg': '#e4e4e7',
      '--mdc-pre-bg': '#27272a',
      '--mdc-pre-fg': '#e4e4e7',
      '--mdc-quote-bg': '#27272a',
      '--mdc-quote-border': '#52525b',
      '--mdc-link': '#93c5fd',
      '--mdc-font-body': FONT_SANS,
      '--mdc-font-code': FONT_MONO,
      '--mdc-font-size': '16px',
      '--mdc-line-height': '1.7',
      '--mdc-content-width': '800px',
      'color-scheme': 'dark',
    },
  },
  {
    id: 'wechat',
    name: '微信公众号',
    variables: {
      '--mdc-bg': '#ffffff',
      '--mdc-fg': '#333333',
      '--mdc-muted': '#888888',
      '--mdc-border': '#eeeeee',
      '--mdc-code-bg': '#f7f7f7',
      '--mdc-code-fg': '#c7254e',
      '--mdc-pre-bg': '#f7f7f7',
      '--mdc-pre-fg': '#333333',
      '--mdc-quote-bg': '#f7f7f7',
      '--mdc-quote-border': '#07c160',
      '--mdc-link': '#576b95',
      '--mdc-font-body':
        "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      '--mdc-font-code': FONT_MONO,
      '--mdc-font-size': '17px',
      '--mdc-line-height': '1.8',
      '--mdc-content-width': '680px',
    },
  },
  {
    id: 'serif',
    name: '极简衬线',
    variables: {
      '--mdc-bg': '#faf9f6',
      '--mdc-fg': '#2f2b26',
      '--mdc-muted': '#8c8577',
      '--mdc-border': '#e6e1d6',
      '--mdc-code-bg': '#f1eee7',
      '--mdc-code-fg': '#2f2b26',
      '--mdc-pre-bg': '#f1eee7',
      '--mdc-pre-fg': '#2f2b26',
      '--mdc-quote-bg': '#f1eee7',
      '--mdc-quote-border': '#b5a887',
      '--mdc-link': '#7c5c3e',
      '--mdc-font-body': "Georgia, 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', SimSun, serif",
      '--mdc-font-code': FONT_MONO,
      '--mdc-font-size': '17px',
      '--mdc-line-height': '1.9',
      '--mdc-content-width': '720px',
    },
  },
  {
    id: 'tech-blue',
    name: '科技蓝',
    variables: {
      '--mdc-bg': '#ffffff',
      '--mdc-fg': '#1e293b',
      '--mdc-muted': '#64748b',
      '--mdc-border': '#e2e8f0',
      '--mdc-code-bg': '#eff6ff',
      '--mdc-code-fg': '#1d4ed8',
      '--mdc-pre-bg': '#0f172a',
      '--mdc-pre-fg': '#e2e8f0',
      '--mdc-quote-bg': '#eff6ff',
      '--mdc-quote-border': '#2563eb',
      '--mdc-link': '#2563eb',
      '--mdc-font-body': FONT_SANS,
      '--mdc-font-code': FONT_MONO,
      '--mdc-font-size': '16px',
      '--mdc-line-height': '1.75',
      '--mdc-content-width': '820px',
    },
  },
];

/**
 * 导出为 Markdown 文件。
 * @param content - Markdown 源文本
 * @param filename - 文件名（默认 'document.md'）
 */
export function exportMarkdown(content: string, filename = 'document.md'): void {
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), filename);
}

/**
 * 导出为独立 HTML 文件。
 *
 * 内部经 buildHtmlDocument 渲染并套多主题独立模板，调用方只需传源文本与可选项。
 *
 * @param markdown - Markdown 源文本
 * @param filename - 文件名（默认 'document.html'）
 * @param options - 主题与文档标题等选项
 */
export function exportHtml(
  markdown: string,
  filename = 'document.html',
  options: HtmlExportOptions = {},
): void {
  const htmlContent = buildHtmlDocument(markdown, options);
  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }), filename);
}

/**
 * 导出为 PDF（调用浏览器打印）。
 *
 * 应用页面是固定视口布局（h-dvh + overflow 裁剪），直接 window.print 会被截成单页；
 * 因此把预览区 DOM 克隆到 body 下的打印宿主（.md-print-host）参与正常文档流，
 * 由文档流分页天然支持跨页。宿主挂 md-editor 类以命中预览排版主题的
 * `.md-editor .md-editor-preview` 变量作用域；打印期间暂时摘除 html.dark，
 * 避免暗色令牌把打印内容染成浅字白纸（afterprint 后恢复）。
 *
 * @param previewEl - 编辑器预览区元素（.md-editor-preview，分栏与仅预览视图均有）
 */
export function exportPdf(previewEl: HTMLElement): void {
  document.querySelector('.md-print-host')?.remove();

  const host = document.createElement('div');
  host.className = 'md-editor md-print-host';
  host.appendChild(cloneForPrint(previewEl));
  document.body.appendChild(host);

  const wasDark = document.documentElement.classList.contains('dark');
  if (wasDark) document.documentElement.classList.remove('dark');

  const cleanup = (): void => {
    window.removeEventListener('afterprint', cleanup);
    host.remove();
    if (wasDark) document.documentElement.classList.add('dark');
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/**
 * 构建完整的独立 HTML 文档（预览与下载共用的唯一产物路径）。
 *
 * 内联基础排版样式（只消费 `--mdc-*` 变量）+ 全部主题变量段 + 右下角主题切换器
 * （localStorage 记忆，不可用时静默降级为仅会话内切换），不依赖任何外部资源。
 *
 * @param markdown - Markdown 源文本
 * @param options - themeId 烘为 `<html data-theme>` 默认值；title 注入 `<title>`（HTML 转义）
 * @returns 完整 HTML 文档字符串
 */
export function buildHtmlDocument(markdown: string, options: HtmlExportOptions = {}): string {
  const bodyHtml = marked.parse(markdown) as string;
  const theme =
    HTML_EXPORT_THEMES.find((t) => t.id === options.themeId) ??
    HTML_EXPORT_THEMES.find((t) => t.id === DEFAULT_HTML_THEME_ID)!;
  const themeBlocks = HTML_EXPORT_THEMES.map(renderThemeBlock).join('\n');
  const switcherOptions = HTML_EXPORT_THEMES.map(
    (t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`,
  ).join('');
  const title = options.title?.trim() ? options.title.trim() : 'Markdown Export';

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme.id}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${BASE_STYLES}
${themeBlocks}
${SWITCHER_STYLES}
  </style>
</head>
<body>
${bodyHtml}
<div class="mdoc-theme-switch">
  <label for="mdoc-theme-select">主题</label>
  <select id="mdoc-theme-select">${switcherOptions}</select>
</div>
<script>
${SWITCHER_SCRIPT}
</script>
</body>
</html>`;
}

/** 基础排版样式：只消费主题变量，新增主题不需要新增排版规则 */
const BASE_STYLES = `    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      max-width: var(--mdc-content-width);
      margin: 2rem auto;
      padding: 0 1rem;
      background: var(--mdc-bg);
      color: var(--mdc-fg);
      font-family: var(--mdc-font-body);
      font-size: var(--mdc-font-size);
      line-height: var(--mdc-line-height);
    }
    h1 { font-size: 1.75rem; margin: 1.5rem 0 0.75rem; }
    h2 { font-size: 1.5rem; margin: 1.25rem 0 0.625rem; }
    h3 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
    h4, h5, h6 { font-size: 1rem; margin: 0.75rem 0 0.375rem; }
    p { margin: 0.5rem 0; }
    a { color: var(--mdc-link); }
    code {
      background: var(--mdc-code-bg);
      color: var(--mdc-code-fg);
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      font-size: 0.875em;
      font-family: var(--mdc-font-code);
    }
    pre {
      background: var(--mdc-pre-bg);
      color: var(--mdc-pre-fg);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; color: inherit; }
    blockquote {
      border-left: 3px solid var(--mdc-quote-border);
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      background: var(--mdc-quote-bg);
      color: var(--mdc-muted);
    }
    table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
    th, td { border: 1px solid var(--mdc-border); padding: 0.5rem 0.75rem; text-align: left; }
    th { background: var(--mdc-code-bg); }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid var(--mdc-border); margin: 1rem 0; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }`;

/** 主题切换器控件样式：右下角悬浮胶囊，配色随主题变量走 */
const SWITCHER_STYLES = `    .mdoc-theme-switch {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.6rem;
      border: 1px solid var(--mdc-border);
      border-radius: 999px;
      background: var(--mdc-code-bg);
      color: var(--mdc-muted);
      font-size: 0.75rem;
    }
    .mdoc-theme-switch select {
      border: none;
      background: transparent;
      color: var(--mdc-fg);
      font: inherit;
      cursor: pointer;
      outline: none;
    }
    @media print {
      .mdoc-theme-switch { display: none; }
    }`;

/**
 * 主题切换器脚本（静态常量，无任何用户输入拼接）。
 * localStorage 沙箱/隐私环境会抛 SecurityError，全部 try/catch 降级为仅会话内切换。
 */
const SWITCHER_SCRIPT = `(function () {
  var KEY = 'mdoc-theme';
  var root = document.documentElement;
  var select = document.getElementById('mdoc-theme-select');
  if (!select) return;
  try {
    var saved = localStorage.getItem(KEY);
    var known = false;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === saved) { known = true; break; }
    }
    if (saved && known) root.setAttribute('data-theme', saved);
  } catch (e) { /* 无存储环境：保持烘入的默认主题 */ }
  var current = root.getAttribute('data-theme');
  for (var j = 0; j < select.options.length; j++) {
    if (select.options[j].value === current) { select.value = current; break; }
  }
  select.addEventListener('change', function () {
    root.setAttribute('data-theme', select.value);
    try { localStorage.setItem(KEY, select.value); } catch (e) { /* 同上 */ }
  });
})();`;

/**
 * 渲染单个主题的 CSS 变量段。
 * @param theme - 主题定义
 * @returns 形如 `:root[data-theme="id"] { ... }` 的样式块
 */
function renderThemeBlock(theme: HtmlExportTheme): string {
  const declarations = Object.entries(theme.variables)
    .map(([key, value]) => `      ${key}: ${value};`)
    .join('\n');
  return `    :root[data-theme="${theme.id}"] {\n${declarations}\n    }`;
}

/**
 * HTML 文本转义（用于注入 <title> 与切换器选项的调用方数据）。
 * @param text - 原始文本
 * @returns 转义后可安全嵌入 HTML 的文本
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 克隆预览区 DOM 用于打印。
 * canvas 位图不随 cloneNode 携带（echarts 图表克隆后是空白），
 * 逐个经 toDataURL 转为等尺寸图片替换。
 * @param source - 预览区元素
 * @returns 可直接挂载的深克隆节点
 */
function cloneForPrint(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const canvases = source.querySelectorAll('canvas');
  const clonedCanvases = clone.querySelectorAll('canvas');
  canvases.forEach((canvas, index) => {
    const target = clonedCanvases[index];
    if (!target) return;
    try {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.width = canvas.width;
      img.height = canvas.height;
      // 优先沿用画布内联尺寸（echarts 按容器设置），缺省回退位图像素
      img.style.width = canvas.style.width || `${canvas.width}px`;
      img.style.height = canvas.style.height || `${canvas.height}px`;
      target.replaceWith(img);
    } catch {
      target.remove();
    }
  });
  return clone;
}

/**
 * 通过 Blob 触发文件下载。
 * @param blob - 文件 Blob 数据
 * @param filename - 下载文件名
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
