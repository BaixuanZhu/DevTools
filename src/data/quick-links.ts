/**
 * PC 端 Header 快捷入口精选清单。
 *
 * 职责：维护 Header 中部（≥lg 断点）常驻展示的高频工具有序 id 列表，
 * 数据与组件解耦——调整入口只需改本文件，无需动 Shell.vue。
 * 调整指引：保持 ≤ 6 个（lg=1024px 下 Header 中部宽度预算约 720px，超出有溢出风险），
 * 顺序按使用频次从高到低排列；id 必须已在 tools.ts 注册，下线工具时同步移除。
 */
import { getToolById, type ToolMeta } from './tools';

/** Header 快捷入口展示所需的工具元数据子集（图标 + 名称 + 路径 + 独立形态标记） */
export type QuickLinkTool = Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon' | 'standalone'>;

/** 快捷入口精选工具 id（有序，按使用频次预估降序） */
export const QUICK_LINK_TOOL_IDS: string[] = [
  'json-formatter',
  'base64',
  'image-converter',
  'datetime-converter',
  'tester',
  'markdown-editor',
];

/**
 * 解析快捷入口清单为完整工具元数据。
 *
 * 按 QUICK_LINK_TOOL_IDS 顺序查工具注册表；id 已下线（注册表查不到）时
 * 跳过该条以避免渲染白链接，并在开发环境 console.warn 提示维护者清理清单。
 *
 * @returns 快捷入口工具元数据数组（由 layouts 服务端解析后经 props 传给 Shell.vue）
 */
export function getQuickLinkTools(): QuickLinkTool[] {
  const result: QuickLinkTool[] = [];
  for (const id of QUICK_LINK_TOOL_IDS) {
    const tool = getToolById(id);
    if (!tool) {
      if (import.meta.env.DEV) {
        console.warn(`[quick-links] QUICK_LINK_TOOL_IDS 中的 "${id}" 未在 tools.ts 注册，已跳过`);
      }
      continue;
    }
    result.push({ id: tool.id, path: tool.path, name: tool.name, icon: tool.icon, standalone: tool.standalone });
  }
  return result;
}
