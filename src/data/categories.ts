import type { ToolCategory } from './tools';

/**
 * 分类级元数据。
 * description 用于首页卡片与分类页可见文案（保持精炼），
 * seoDescription 用于分类页 meta description 与 JSON-LD（120-160 字符）。
 */
export interface CategoryMeta {
  /** 中文分类名（与 ToolCategory 一致） */
  name: ToolCategory;
  /** 分类 slug（与 categorySlugMap 值一致） */
  slug: string;
  /** 卡片/分类页可见的一句话描述 */
  description: string;
  /** SEO 专用描述（120-160 字符，用于分类页 meta description 与 JSON-LD） */
  seoDescription: string;
  /** 分类页 <title>（目标 25-45 字符，守卫区间 25-60，与 tools.ts title 守卫同口径） */
  seoTitle: string;
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
    seoDescription: '文本与编码分类收录十余款免费在线小工具：大小写与全半角转换、按行去重去空行、字数与字节统计等文本处理，Base64、JWT、URL 编解码，进制转换、正则表达式测试、UUID 与假数据批量生成，全部纯浏览器端本地运算，即开即用数据绝不上传。',
    seoTitle: '文本与编码工具大全 - Base64、正则、UUID 在线转换 - DevTools',
  },
  {
    name: '加密与安全',
    slug: 'crypto',
    icon: '🔒',
    description: 'MD5/SHA 哈希与 HMAC、BCrypt 密码哈希、AES/RSA/SM 国密对称与非对称加解密',
    seoDescription: '加密与安全分类收录多款免费在线密码学工具：MD5、SHA-2 系列哈希、HMAC 签名与 BCrypt 密码哈希，AES、ChaCha20 对称加密与 RSA、ECDSA、Ed25519 非对称加解密，SM2/SM4 国密算法支持，密钥纯浏览器端运算，联调学习两相宜，数据绝不上传。',
    seoTitle: '加密与安全工具大全 - 哈希签名与对称非对称加解密 - DevTools',
  },
  {
    name: '格式化与转换',
    slug: 'format',
    icon: '📋',
    description: 'JSON 美化压缩、差异对比、TOML/YAML/XML/TypeScript 互转',
    seoDescription: '格式化与转换分类收录多款免费在线工具：JSON 美化压缩与语法校验、JSON 差异对比、JSON 与 XML/YAML/TypeScript/TOML 互转、TOML 格式化校验等，配置格式迁移与接口调试必备，全部纯浏览器端本地运算，即开即用数据绝不上传。',
    seoTitle: '格式化与转换工具大全 - JSON/TOML/YAML 互转与校验 - DevTools',
  },
  {
    name: '网络工具',
    slug: 'network',
    icon: '🌐',
    description: 'URL 解析、HTTP 状态码、IPv4/IPv6 子网计算与设备信息',
    seoDescription: '网络工具分类收录多款免费在线工具：URL 解析编解码、HTTP 状态码中文查询手册、IPv4/IPv6 子网计算与 CIDR 展开、设备信息与 UserAgent 查看，网络配置排查与接口联调必备，全部纯浏览器端本地计算，即开即用数据绝不上传。',
    seoTitle: '网络工具大全 - IP 子网计算、URL 解析与状态码查询 - DevTools',
  },
  {
    name: '日期时间',
    slug: 'datetime',
    icon: '🕐',
    description: '时间戳转换、Cron 表达式解析与时间差计算',
    seoDescription: '日期时间分类收录免费在线时间工具：Unix 时间戳与日期格式互转、秒毫秒自动识别、多时区对比展示，Cron 表达式可视化解析构建与执行时间预览，时间差精确到天时分秒计算，排期与定时任务调试必备，全部纯浏览器端本地运算，即开即用数据绝不上传。',
    seoTitle: '日期时间工具大全 - 时间戳转换、Cron 解析与时间差 - DevTools',
  },
  {
    name: '前端与媒体',
    slug: 'frontend',
    icon: '🎨',
    description: 'CSS 单位换算、渐变与颜色面板、图片转换压缩与二维码',
    seoDescription: '前端与媒体分类收录多款免费在线工具：CSS 单位换算与渐变生成、颜色面板与 WCAG 对比度检查，图片格式转换压缩、ICO 图标制作、二维码生成识别、幻影坦克与图片混淆等图像处理，设计师与前端开发必备，全部纯浏览器端本地处理，图片文件绝不上传。',
    seoTitle: '前端与媒体工具大全 - 图片压缩、颜色与二维码处理 - DevTools',
  },
  {
    name: '开发与运维',
    slug: 'devops',
    icon: '🐳',
    description: 'Docker/Env 配置转换、Meta/robots/sitemap 生成与 Redis/PostgreSQL 配置生成',
    seoDescription: '开发与运维分类收录多款免费在线工具：docker run 与 compose 互转、.env 环境变量转换、Meta/robots/sitemap 一键生成，Redis、MySQL、PostgreSQL 配置文件按硬件画像生成，运维部署与配置调优必备，全部纯浏览器端本地运算，数据绝不上传。',
    seoTitle: '开发与运维工具大全 - Docker 转换、配置生成与 robots - DevTools',
  },
];
