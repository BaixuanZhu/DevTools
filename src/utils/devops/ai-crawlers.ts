/** AI 训练爬虫条目 */
export interface AiCrawler {
  /** robots.txt 中的 User-agent 标识 */
  userAgent: string;
  /** 中文归属说明（展示用） */
  vendor: string;
}

/**
 * 主流 AI 训练爬虫清单。
 *
 * 全部经开源权威清单 ai-robots-txt/ai.robots.txt（源自 Dark Visitors）
 * 逐项核验，无编造；对中文用户额外收录智谱、深度求索。
 * 清单独立存放，便于后续按最新公开清单更新。
 */
export const AI_CRAWLERS: readonly AiCrawler[] = [
  { userAgent: 'GPTBot', vendor: 'OpenAI / ChatGPT' },
  { userAgent: 'OAI-SearchBot', vendor: 'OpenAI 搜索' },
  { userAgent: 'ChatGPT-User', vendor: 'ChatGPT 用户触发抓取' },
  { userAgent: 'ClaudeBot', vendor: 'Anthropic / Claude' },
  { userAgent: 'Claude-Web', vendor: 'Anthropic' },
  { userAgent: 'anthropic-ai', vendor: 'Anthropic' },
  { userAgent: 'Google-Extended', vendor: 'Google / Gemini 训练' },
  { userAgent: 'PerplexityBot', vendor: 'Perplexity' },
  { userAgent: 'CCBot', vendor: 'Common Crawl（众多模型训练数据源）' },
  { userAgent: 'Amazonbot', vendor: 'Amazon' },
  { userAgent: 'Bytespider', vendor: '字节跳动 / 豆包' },
  { userAgent: 'Applebot-Extended', vendor: 'Apple 训练' },
  { userAgent: 'Meta-ExternalAgent', vendor: 'Meta' },
  { userAgent: 'cohere-ai', vendor: 'Cohere' },
  { userAgent: 'Diffbot', vendor: 'Diffbot' },
  { userAgent: 'ChatGLM-Spider', vendor: '智谱 AI / ChatGLM' },
  { userAgent: 'DeepSeekBot', vendor: '深度求索 / DeepSeek' },
];
