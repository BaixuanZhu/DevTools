/** 工具分类 */
export type ToolCategory =
  | '编码转换'
  | '加密哈希'
  | '格式化'
  | '文本处理'
  | '正则工具'
  | '网络工具'
  | '颜色工具'
  | '日期时间'
  | 'CSS 工具'
  | 'API 工具';

/** 工具元数据 */
export interface ToolMeta {
  /** 工具唯一 ID，同时用作 URL slug */
  id: string;
  /** 显示名称 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** 分类 */
  category: ToolCategory;
  /** 图标（emoji） */
  icon: string;
  /** 路由路径 */
  path: string;
}

/** 所有已注册的工具列表 */
export const tools: ToolMeta[] = [
  {
    id: 'uuid-generator',
    name: 'UUID 生成器',
    description: '生成并解析多种版本的 UUID（v1/v3/v4/v5/v6/v7），支持格式转换与解码分析',
    category: '文本处理',
    icon: '🔑',
    path: '/uuid-generator',
  },
  {
    id: 'hash-generator',
    name: '哈希生成器',
    description: '支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制',
    category: '加密哈希',
    icon: '🔒',
    path: '/hash-generator',
  },
  {
    id: 'random-string',
    name: '随机字符串生成',
    description: '自定义长度和字符集的随机字符串生成器',
    category: '文本处理',
    icon: '🎲',
    path: '/random-string',
  },
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: 'Base64 编码与解码，支持文本和文件',
    category: '编码转换',
    icon: '📄',
    path: '/base64',
  },
  {
    id: 'datetime-converter',
    name: '日期时间转换器',
    description: '时间戳与日期格式互转，支持多种日期格式',
    category: '日期时间',
    icon: '🕐',
    path: '/datetime-converter',
  },
  {
    id: 'url-encode',
    name: 'URL 编解码',
    description: 'URL 编码与解码，支持组件级和完整 URL 编码',
    category: '编码转换',
    icon: '🔗',
    path: '/url-encode',
  },
  {
    id: 'jwt-parser',
    name: 'JWT 解析器',
    description: '解析和验证 JSON Web Token，展示 Header、Payload、Signature',
    category: '编码转换',
    icon: '🎫',
    path: '/jwt-parser',
  },
  {
    id: 'device-info',
    name: '设备信息与 UserAgent',
    description: '查看浏览器、操作系统、屏幕等设备信息',
    category: '网络工具',
    icon: '💻',
    path: '/device-info',
  },
  {
    id: 'symmetric-crypto',
    name: '对称加解密',
    description: '支持 AES、DES 等主流对称加密算法的加解密',
    category: '加密哈希',
    icon: '🛡️',
    path: '/symmetric-crypto',
  },
];

/** 按分类分组工具列表 */
export function getToolsByCategory(): Record<ToolCategory, ToolMeta[]> {
  return tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<ToolCategory, ToolMeta[]>,
  );
}

/** 搜索工具（匹配名称和描述，大小写不敏感） */
export function searchTools(query: string): ToolMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return tools;
  return tools.filter(
    (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}

/** 获取所有分类（去重，保持注册顺序） */
export function getCategories(): ToolCategory[] {
  const seen = new Set<ToolCategory>();
  return tools.filter((t) => {
    if (seen.has(t.category)) return false;
    seen.add(t.category);
    return true;
  }).map((t) => t.category);
}
