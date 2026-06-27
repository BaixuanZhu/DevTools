import type { APIRoute } from 'astro';
import { tools, getToolsByCategory } from '../data/tools';

/**
 * 动态生成 /llms.txt —— 面向大语言模型与 AI 检索引擎的站点纯文本概览。
 *
 * 遵循 llms.txt 标准（https://llmstxt.org）：以 Markdown 纯文本列出站点定位、
 * 工具分类与每个工具的简述及链接，供 ChatGPT / Perplexity / Claude 等 AI 抓取引用，
 * 提升 GEO（生成式引擎优化）可发现性。
 *
 * 内容基于 {@link tools} 单一数据源自动生成，新增工具自动同步，无需手动维护。
 */
export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.toString().replace(/\/$/, '') || 'https://tools.baixuanz.cn';

  const lines: string[] = [
    '# DevTools 开发者工具集',
    '',
    `> 零门槛的浏览器端在线工具集合，即开即用。所有运算在浏览器本地完成，数据绝不上传。共 ${tools.length} 个工具。`,
    '',
    `站点地址：${siteUrl}`,
    '',
    'DevTools 是一个面向开发者的纯前端在线工具箱，覆盖编码转换、加密哈希、格式化、文本处理、正则、网络、颜色、日期时间、CSS、媒体、编辑器与 DevOps 等场景。无需安装、无需注册，打开即用，所有数据均在浏览器端本地处理。',
    '',
    '## 工具分类',
    '',
  ];

  // 按分类分组输出工具清单，链接指向真实工具页（/category/slug）
  const grouped = getToolsByCategory();
  for (const [category, list] of Object.entries(grouped)) {
    lines.push(`### ${category}`);
    lines.push('');
    for (const tool of list) {
      lines.push(`- [${tool.name}](${siteUrl}${tool.path}): ${tool.description}`);
    }
    lines.push('');
  }

  lines.push('## 其他页面');
  lines.push('');
  lines.push(`- [关于 DevTools](${siteUrl}/about): 项目介绍、核心特性与技术栈`);
  lines.push('- [GitHub 仓库](https://github.com/BaixuanZhu/DevTools): 源码与问题反馈');
  lines.push('- [Gitee 仓库](https://gitee.com/baixuanz): 国内镜像');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
