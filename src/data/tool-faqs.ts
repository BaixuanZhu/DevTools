/** FAQ 条目 */
export interface FaqItem {
  /** 问题 */
  question: string;
  /** 答案（支持简单 HTML 标签如 <code>、<strong>） */
  answer: string;
}

/** 按工具 ID（短 ID，如 'base64'）索引的 FAQ 数据 */
const toolFaqs: Record<string, FaqItem[]> = {};

/**
 * 获取指定工具的 FAQ 列表。
 * @param toolId - 完整工具 ID（如 'encoding/base64'）或短 ID（如 'base64'）
 * @returns FAQ 列表，未配置时返回空数组
 */
export function getToolFaqs(toolId: string): FaqItem[] {
  const slug = toolId.includes('/') ? (toolId.split('/').pop() || '') : toolId;
  return toolFaqs[slug] || [];
}

export { toolFaqs };
