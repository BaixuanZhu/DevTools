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
  | 'API 工具'
  | '媒体工具';

/** 分类 slug 映射（中 → 英） */
export const categorySlugMap: Record<ToolCategory, string> = {
  '编码转换': 'encoding',
  '加密哈希': 'crypto',
  '格式化': 'format',
  '文本处理': 'text',
  '正则工具': 'regex',
  '网络工具': 'network',
  '颜色工具': 'color',
  '日期时间': 'datetime',
  'CSS 工具': 'css',
  'API 工具': 'api',
  '媒体工具': 'media',
};

/** 工具元数据 */
export interface ToolMeta {
  /** 工具唯一 ID（即 URL slug，不含分类前缀） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** SEO 专用描述（120-160 字符，用于 meta description） */
  seoDescription: string;
  /** 分类 */
  category: ToolCategory;
  /** 图标（emoji） */
  icon: string;
  /** 路由路径（二级路径格式：/category/id） */
  path: string;
}

/** 所有已注册的工具列表 */
export const tools: ToolMeta[] = [
  {
    id: 'uuid-generator',
    name: 'UUID 生成器',
    description: '生成并解析多种版本的 UUID（v1/v3/v4/v5/v6/v7），支持格式转换与解码分析',
    seoDescription: '在线 UUID 生成器与解析工具，支持 v1/v3/v4/v5/v6/v7 多版本生成、格式转换与解码分析，纯浏览器端运算。',
    category: '文本处理',
    icon: '🔑',
    path: '/text/uuid-generator',
  },
  {
    id: 'hash-generator',
    name: '哈希生成器',
    description: '支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制',
    seoDescription: '在线哈希生成工具，支持 MD5、SHA-1、SHA-256、SHA-512 等多种算法，支持文本与文件哈希、多格式输出，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔒',
    path: '/crypto/hash-generator',
  },
  {
    id: 'random-string',
    name: '随机字符串生成',
    description: '自定义长度和字符集的随机字符串生成器',
    seoDescription: '在线随机字符串生成工具，支持自定义长度、字符集与排除规则，批量生成密码或随机文本，纯浏览器端运算。',
    category: '文本处理',
    icon: '🎲',
    path: '/text/random-string',
  },
  {
    id: 'datetime-converter',
    name: '日期时间转换器',
    description: '时间戳与日期格式互转，支持多种日期格式',
    seoDescription: '在线日期时间转换工具，支持时间戳与日期格式互转、多时区对比、多种日期格式输出，纯浏览器端运算。',
    category: '日期时间',
    icon: '🕐',
    path: '/datetime/datetime-converter',
  },
  {
    id: 'url-encode',
    name: 'URL 编解码',
    description: 'URL 编码与解码，支持组件级和完整 URL 编码',
    seoDescription: '在线 URL 编解码工具，支持 encodeURI 与 encodeURIComponent 两种模式，批量处理 URL 编码与解码，纯浏览器端运算。',
    category: '编码转换',
    icon: '🔗',
    path: '/encoding/url-encode',
  },
  {
    id: 'jwt-parser',
    name: 'JWT 编解码',
    description: '解析和生成 JSON Web Token，支持 HMAC 签名验证与编码',
    seoDescription: '在线 JWT 解析与生成工具，支持 JSON Web Token 解码查看、HMAC 签名验证与编码生成，纯浏览器端运算无需上传。',
    category: '编码转换',
    icon: '🎫',
    path: '/encoding/jwt-parser',
  },
  {
    id: 'device-info',
    name: '设备信息与 UserAgent',
    description: '查看浏览器、操作系统、屏幕等设备信息',
    seoDescription: '在线设备信息查看工具，一键获取浏览器 UserAgent、操作系统、屏幕分辨率、网络连接等设备信息，纯浏览器端检测。',
    category: '网络工具',
    icon: '💻',
    path: '/network/device-info',
  },
  {
    id: 'http-status-codes',
    name: 'HTTP 状态码查询',
    description: '查询 HTTP 状态码含义，支持分类筛选与关键词搜索',
    seoDescription: '在线 HTTP 状态码查询工具，涵盖 1xx-5xx 全部状态码，支持按分类筛选和关键词搜索，显示中文释义与规范来源，纯浏览器端查询。',
    category: '网络工具',
    icon: '📡',
    path: '/network/http-status-codes',
  },
  {
    id: 'ipv4-cidr',
    name: 'IPv4 子网计算器',
    description: '输入 IP 地址和子网掩码，计算网络地址、广播地址、可用主机数等子网信息',
    seoDescription: '在线 IPv4 子网计算工具，输入 IP/子网掩码即可获取网络地址、广播地址、可用主机范围和二进制表示，附带 CIDR 术语说明，纯浏览器端计算。',
    category: '网络工具',
    icon: '🌐',
    path: '/network/ipv4-cidr',
  },
  {
    id: 'ipv4-range-expander',
    name: 'IPv4 范围展开',
    description: '将 IPv4 地址范围转换为最简 CIDR 列表',
    seoDescription: '在线 IPv4 地址范围转换工具，输入起止 IP 地址自动计算覆盖该范围的最少 CIDR 块列表，显示详细信息与 IP 总数，纯浏览器端运算。',
    category: '网络工具',
    icon: '📊',
    path: '/network/ipv4-range-expander',
  },
  {
    id: 'symmetric-crypto',
    name: '对称加解密',
    description: '支持 AES、SM4、ChaCha20、DES 等对称加密算法的加解密',
    seoDescription: '在线对称加解密工具，支持 AES-CBC/GCM、SM4、ChaCha20、DES 等算法，多格式输入输出，纯浏览器端加密无需上传。',
    category: '加密哈希',
    icon: '🛡️',
    path: '/crypto/symmetric-crypto',
  },
  {
    id: 'asymmetric-crypto',
    name: '非对称加解密',
    description: '支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 等非对称加密算法的密钥生成、加解密与签名验签',
    seoDescription: '在线非对称加解密工具，支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 算法的密钥生成、加密解密与签名验签，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔐',
    path: '/crypto/asymmetric-crypto',
  },
  {
    id: 'sm2-crypto',
    name: 'SM2 国密加解密',
    description: 'SM2 国密非对称加密算法，支持密钥对生成、公钥加密与私钥解密',
    seoDescription: '在线 SM2 国密非对称加解密工具，支持密钥对生成、公钥加密与私钥解密，支持 C1C3C2/C1C2C3 密文模式，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔐',
    path: '/crypto/sm2-crypto',
  },
  {
    id: 'qr-code-generator',
    name: '二维码生成器',
    description: '在线生成自定义颜色、尺寸和容错级别的二维码，支持 PNG 与 SVG 下载',
    seoDescription: '在线二维码生成工具，支持自定义前景色/背景色/尺寸/容错级别(L/M/Q/H)，可下载 PNG 与 SVG 两种格式，纯浏览器端生成，数据不上传。',
    category: '媒体工具',
    icon: '🔳',
    path: '/media/qr-code-generator',
  },
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: 'Base64 编码与解码，支持文本和文件',
    seoDescription: '在线 Base64 编解码工具，支持文本与文件的 Base64 编码和解码，纯浏览器运算无需上传数据，即时转换。',
    category: '编码转换',
    icon: '📄',
    path: '/encoding/base64',
  },
  {
    id: 'base64-to-image',
    name: 'Base64 转图片',
    description: '将 Base64 字符串解码为图片，支持预览和下载',
    seoDescription: '在线 Base64 转图片工具，支持 PNG、JPEG、GIF、SVG、WebP 等格式，实时预览图片、显示尺寸大小信息，一键下载。',
    category: '编码转换',
    icon: '🖼️',
    path: '/encoding/base64-to-image',
  },
  {
    id: 'base64-to-file',
    name: 'Base64 转文件',
    description: '将 Base64 字符串解码为文件，支持 Data URI 格式自动识别',
    seoDescription: '在线 Base64 转文件工具，支持 Data URI 格式输入，自动识别 MIME 类型，一键下载还原文件。',
    category: '编码转换',
    icon: '📎',
    path: '/encoding/base64-to-file',
  },
  {
    id: 'cron-parser',
    name: 'Cron 表达式解析器',
    description: '解析 Cron 表达式，预览执行时间，可视化构建',
    seoDescription: '在线 Cron 表达式解析器，支持可视化构建、执行时间预览和常用模板，帮助开发者快速编写和验证定时任务表达式。',
    category: '日期时间',
    icon: '⏰',
    path: '/datetime/cron-parser',
  },
  {
    id: 'json-formatter',
    name: 'JSON 格式化器',
    description: '在线 JSON 格式化、压缩、验证与查询工具',
    seoDescription: '在线 JSON 格式化工具，支持美化、压缩、验证与 JSON Path 查询，实时语法高亮与统计信息，纯浏览器端运算。',
    category: '格式化',
    icon: '📋',
    path: '/format/json-formatter',
  },
];

/** 分类 slug 反向映射（英 → 中） */
export const slugCategoryMap: Record<string, ToolCategory> = Object.fromEntries(
  Object.entries(categorySlugMap).map(([cn, en]) => [en, cn as ToolCategory]),
) as Record<string, ToolCategory>;

/** 通过工具 ID 查找工具元数据 */
export function getToolById(id: string): ToolMeta | undefined {
  return tools.find((t) => t.id === id);
}

/** 通过完整 toolId（如 encoding/base64）查找工具元数据 */
export function getToolBySlug(toolId: string): ToolMeta | undefined {
  const slug = toolId.split('/').pop() || '';
  return getToolById(slug);
}

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
