import type { ToolCategory } from './tools';

/** 分类级元数据（描述用于卡片与分类页 SEO；icon 为 emoji） */
export interface CategoryMeta {
  /** 中文分类名（与 ToolCategory 一致） */
  name: ToolCategory;
  /** 分类 slug（与 categorySlugMap 值一致） */
  slug: string;
  /** 卡片/SEO 用一句话描述 */
  description: string;
  /** 分类代表图标（emoji） */
  icon: string;
}

/** 全部分类元数据（顺序为首页/侧边栏展示顺序） */
export const categories: CategoryMeta[] = [
  {
    name: '文本与编码',
    slug: 'text',
    icon: '🔤',
    description: '文本处理、大小写/去重/字数、Base64/JWT/URL 编解码、正则与随机数据生成',
  },
  {
    name: '加密与安全',
    slug: 'crypto',
    icon: '🔒',
    description: 'MD5/SHA 哈希与 HMAC、AES/RSA/SM 国密对称与非对称加解密',
  },
  {
    name: '格式化与转换',
    slug: 'format',
    icon: '📋',
    description: 'JSON 美化压缩、差异对比、TOML/YAML/XML/TypeScript 互转',
  },
  {
    name: '网络工具',
    slug: 'network',
    icon: '🌐',
    description: 'URL 解析、HTTP 状态码、IPv4/IPv6 子网计算与设备信息',
  },
  {
    name: '日期时间',
    slug: 'datetime',
    icon: '🕐',
    description: '时间戳转换、Cron 表达式解析与时间差计算',
  },
  {
    name: '前端与媒体',
    slug: 'frontend',
    icon: '🎨',
    description: 'CSS 单位换算、渐变与颜色面板、图片转换压缩与二维码',
  },
  {
    name: '开发与运维',
    slug: 'devops',
    icon: '🐳',
    description: 'Docker/Env 配置转换、Meta/robots/sitemap 生成与 Redis/PostgreSQL 配置生成',
  },
];
