/**
 * Markdown 导出功能模块。
 *
 * 支持 .md 文件下载、.html 文件下载和 .pdf（浏览器打印）三种导出方式。
 */

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
 * @param renderedHtml - marked 渲染后的 HTML 内容
 * @param filename - 文件名（默认 'document.html'）
 */
export function exportHtml(renderedHtml: string, filename = 'document.html'): void {
  const htmlContent = buildHtmlDocument(renderedHtml);
  downloadBlob(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }), filename);
}

/**
 * 导出为 PDF（调用浏览器打印）。
 * 通过在预览区上触发 window.print()，配合 @media print 样式隐藏非打印内容。
 */
export function exportPdf(): void {
  window.print();
}

/**
 * 构建完整的独立 HTML 文档，内联预览区排版样式。
 * @param bodyHtml - 渲染后的 HTML body 内容
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
      color: #1a1a1a;
      line-height: 1.7;
    }
    h1 { font-size: 1.75rem; margin: 1.5rem 0 0.75rem; }
    h2 { font-size: 1.5rem; margin: 1.25rem 0 0.625rem; }
    h3 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
    h4, h5, h6 { font-size: 1rem; margin: 0.75rem 0 0.375rem; }
    p { margin: 0.5rem 0; }
    a { color: #e8590c; }
    code {
      background: #f3f1ee;
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      font-size: 0.875rem;
      font-family: 'JetBrains Mono', monospace;
    }
    pre {
      background: #f3f1ee;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 3px solid #e8590c;
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      background: #f3f1ee;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
    th, td { border: 1px solid #e5e2dd; padding: 0.5rem 0.75rem; text-align: left; }
    tr:nth-child(even) { background: #faf9f7; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #e5e2dd; margin: 1rem 0; }
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
