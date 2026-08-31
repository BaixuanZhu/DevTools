/**
 * Markdown 导出功能模块（Markdown 工作台消费）。
 *
 * 支持 .md 文件下载、.html 文件下载和 .pdf（浏览器打印）三种导出方式。
 * HTML 导出内部用 marked 渲染（不再依赖外部传入渲染结果），
 * 套最小 HTML 文档模板产出可直接打开/分享的独立文件。
 */
import { Marked } from 'marked';

/** HTML 导出用的 marked 实例：GFM（表格/任务列表/删除线），换行不强制转 <br> */
const marked = new Marked({ gfm: true, breaks: false });

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
 * 内部用 marked 渲染 Markdown 源文本并套最小 HTML 文档模板（内联排版样式），
 * 调用方只需传源文本，无需先拿到渲染结果。
 *
 * @param markdown - Markdown 源文本
 * @param filename - 文件名（默认 'document.html'）
 */
export function exportHtml(markdown: string, filename = 'document.html'): void {
  const bodyHtml = marked.parse(markdown) as string;
  const htmlContent = buildHtmlDocument(bodyHtml);
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
 * 构建完整的独立 HTML 文档，内联预览区排版样式（中性 zinc 配色，不依赖外部资源）。
 * @param bodyHtml - marked 渲染后的 HTML body 内容
 * @returns 完整 HTML 文档字符串
 */
function buildHtmlDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Export</title>
  <style>
    body {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #09090b;
      line-height: 1.7;
    }
    h1 { font-size: 1.75rem; margin: 1.5rem 0 0.75rem; }
    h2 { font-size: 1.5rem; margin: 1.25rem 0 0.625rem; }
    h3 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
    h4, h5, h6 { font-size: 1rem; margin: 0.75rem 0 0.375rem; }
    p { margin: 0.5rem 0; }
    a { color: #18181b; }
    code {
      background: #f4f4f5;
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      font-size: 0.875rem;
      font-family: 'JetBrains Mono', monospace;
    }
    pre {
      background: #f4f4f5;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 3px solid #e4e4e7;
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      background: #f4f4f5;
      color: #71717a;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
    th, td { border: 1px solid #e4e4e7; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f4f4f5; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #e4e4e7; margin: 1rem 0; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
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
