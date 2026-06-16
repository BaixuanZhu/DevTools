# DevTools 曝光度提升 P0 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工具页面的 SEO 数据（title/keywords）和相关工具推荐配置统一收归到 `tools.ts`，并在每个工具页底部渲染相关工具卡片。

**Architecture:** 数据层集中到 `src/data/tools.ts`（新增 `title?`、`keywords`、`relatedToolIds` 字段 + `getRelatedTools()` 函数），UI 层由 `ToolLayout.astro` 自动读取并渲染——页面文件只需传 `toolId`，无需再传 `title`。新增 `RelatedTools.astro` 组件复用现有 `ToolCard.astro` 展示卡片。

**Tech Stack:** Astro 6 + TypeScript，零新增依赖。

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/data/tools.ts` | 修改 | `ToolMeta` 扩展字段 + `getRelatedTools()` + 22 条数据填充 |
| `src/components/seo/SeoHead.astro` | 修改 | 新增 `keywords` prop，渲染 `<meta name="keywords">` |
| `src/layouts/Layout.astro` | 修改 | 透传 `keywords` prop 到 SeoHead |
| `src/layouts/ToolLayout.astro` | 修改 | title 回退逻辑 + 传 keywords + 底部插入 RelatedTools |
| `src/components/layout/RelatedTools.astro` | 新建 | 相关工具卡片容器组件 |
| `src/pages/**/*.astro`（22 个） | 修改 | 移除硬编码 `title` prop |

---

## Task 1: 扩展 ToolMeta 接口与辅助函数

**Files:**
- Modify: `src/data/tools.ts:31-46`（接口）
- Modify: `src/data/tools.ts:256-298`（函数区）

- [ ] **Step 1: 扩展 ToolMeta 接口**

在 `src/data/tools.ts` 中，将现有 `ToolMeta` 接口扩展为：

```typescript
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
  /** 页面 <title> 覆盖（可选，不传则自动拼接 "{name} - DevTools"） */
  title?: string;
  /** 长尾关键词列表，用于 meta keywords 标签及内部选题参考 */
  keywords: string[];
  /** 相关工具 ID 列表，页面最多展示前 4 个 */
  relatedToolIds: string[];
}
```

- [ ] **Step 2: 新增 getRelatedTools 辅助函数**

在 `src/data/tools.ts` 文件末尾（`getCategories` 函数之后）添加：

```typescript
/** 获取指定工具的相关工具列表（最多 4 个，过滤无效 ID） */
export function getRelatedTools(toolId: string): ToolMeta[] {
  const tool = getToolById(toolId);
  if (!tool || !tool.relatedToolIds.length) return [];
  return tool.relatedToolIds
    .map((id) => getToolById(id))
    .filter((t): t is ToolMeta => t !== undefined)
    .slice(0, 4);
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `pnpm exec tsc --noEmit`
Expected: 编译报错，因为 22 条现有工具数据缺少 `keywords` 和 `relatedToolIds` 字段——这是预期行为，Task 2 会修复。

- [ ] **Step 4: Commit**

```bash
git add src/data/tools.ts
git commit -m "feat(tools): 扩展 ToolMeta 接口，新增 title/keywords/relatedToolIds 字段与 getRelatedTools 函数"
```

---

## Task 2: 填充 22 条工具数据

**Files:**
- Modify: `src/data/tools.ts:49-248`（tools 数组）

- [ ] **Step 1: 为全部 22 条工具数据补充 keywords 和 relatedToolIds**

将 `tools` 数组中的每条数据补充 `keywords` 和 `relatedToolIds` 字段。注意：不添加 `title` 字段（使用默认拼接）。完整替换如下：

```typescript
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
    keywords: ['uuid 生成器', 'uuid 在线生成', 'uuid v4', 'guid 生成', '唯一标识符', 'uuid 解析'],
    relatedToolIds: ['random-string', 'hash-generator'],
  },
  {
    id: 'hash-generator',
    name: '哈希生成器',
    description: '支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制',
    seoDescription: '在线哈希生成工具，支持 MD5、SHA-1、SHA-256、SHA-512 等多种算法，支持文本与文件哈希、多格式输出，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔒',
    path: '/crypto/hash-generator',
    keywords: ['哈希生成器', 'md5 在线', 'sha256 计算', 'sha512 在线', 'hash 在线工具', '文本哈希'],
    relatedToolIds: ['symmetric-crypto', 'jwt-parser', 'base64'],
  },
  {
    id: 'random-string',
    name: '随机字符串生成',
    description: '自定义长度和字符集的随机字符串生成器',
    seoDescription: '在线随机字符串生成工具，支持自定义长度、字符集与排除规则，批量生成密码或随机文本，纯浏览器端运算。',
    category: '文本处理',
    icon: '🎲',
    path: '/text/random-string',
    keywords: ['随机字符串生成', '随机密码生成', '在线随机数', '密码生成器', '随机文本'],
    relatedToolIds: ['uuid-generator'],
  },
  {
    id: 'datetime-converter',
    name: '日期时间转换器',
    description: '时间戳与日期格式互转，支持多种日期格式',
    seoDescription: '在线日期时间转换工具，支持时间戳与日期格式互转、多时区对比、多种日期格式输出，纯浏览器端运算。',
    category: '日期时间',
    icon: '🕐',
    path: '/datetime/datetime-converter',
    keywords: ['时间戳转换', '日期转换器', 'unix 时间戳', '时间戳在线', '日期格式转换', '时间戳转日期'],
    relatedToolIds: ['cron-parser'],
  },
  {
    id: 'url-encode',
    name: 'URL 编解码',
    description: 'URL 编码与解码，支持组件级和完整 URL 编码',
    seoDescription: '在线 URL 编解码工具，支持 encodeURI 与 encodeURIComponent 两种模式，批量处理 URL 编码与解码，纯浏览器端运算。',
    category: '编码转换',
    icon: '🔗',
    path: '/encoding/url-encode',
    keywords: ['url 编码', 'url 解码', 'urlencode 在线', 'urldecode 在线', 'uri 编码', '中文 url 编码'],
    relatedToolIds: ['base64', 'jwt-parser'],
  },
  {
    id: 'jwt-parser',
    name: 'JWT 编解码',
    description: '解析和生成 JSON Web Token，支持 HMAC 签名验证与编码',
    seoDescription: '在线 JWT 解析与生成工具，支持 JSON Web Token 解码查看、HMAC 签名验证与编码生成，纯浏览器端运算无需上传。',
    category: '编码转换',
    icon: '🎫',
    path: '/encoding/jwt-parser',
    keywords: ['jwt 解析', 'jwt 解码', 'jwt 在线解析', 'token 解析', 'jwt 验证', 'json web token'],
    relatedToolIds: ['base64', 'url-encode', 'hash-generator'],
  },
  {
    id: 'device-info',
    name: '设备信息与 UserAgent',
    description: '查看浏览器、操作系统、屏幕等设备信息',
    seoDescription: '在线设备信息查看工具，一键获取浏览器 UserAgent、操作系统、屏幕分辨率、网络连接等设备信息，纯浏览器端检测。',
    category: '网络工具',
    icon: '💻',
    path: '/network/device-info',
    keywords: ['useragent 查看', '设备信息', '浏览器信息', 'ua 在线查看', '屏幕分辨率', '浏览器检测'],
    relatedToolIds: ['http-status-codes', 'ipv4-cidr'],
  },
  {
    id: 'http-status-codes',
    name: 'HTTP 状态码查询',
    description: '查询 HTTP 状态码含义，支持分类筛选与关键词搜索',
    seoDescription: '在线 HTTP 状态码查询工具，涵盖 1xx-5xx 全部状态码，支持按分类筛选和关键词搜索，显示中文释义与规范来源，纯浏览器端查询。',
    category: '网络工具',
    icon: '📡',
    path: '/network/http-status-codes',
    keywords: ['http 状态码', '状态码查询', 'http code', '301 重定向', '404 错误', '500 错误'],
    relatedToolIds: ['device-info', 'ipv4-cidr'],
  },
  {
    id: 'ipv4-cidr',
    name: 'IPv4 子网计算器',
    description: '输入 IP 地址和子网掩码，计算网络地址、广播地址、可用主机数等子网信息',
    seoDescription: '在线 IPv4 子网计算工具，输入 IP/子网掩码即可获取网络地址、广播地址、可用主机范围和二进制表示，附带 CIDR 术语说明，纯浏览器端计算。',
    category: '网络工具',
    icon: '🌐',
    path: '/network/ipv4-cidr',
    keywords: ['ipv4 子网计算', 'cidr 计算', '子网掩码计算', 'ip 地址计算器', '网段计算', '子网划分'],
    relatedToolIds: ['ipv4-range-expander', 'device-info'],
  },
  {
    id: 'ipv4-range-expander',
    name: 'IPv4 范围展开',
    description: '将 IPv4 地址范围转换为最简 CIDR 列表',
    seoDescription: '在线 IPv4 地址范围转换工具，输入起止 IP 地址自动计算覆盖该范围的最少 CIDR 块列表，显示详细信息与 IP 总数，纯浏览器端运算。',
    category: '网络工具',
    icon: '📊',
    path: '/network/ipv4-range-expander',
    keywords: ['ip 范围转换', 'ipv4 cidr 转换', 'ip 地址范围', 'cidr 合并', 'ip 段计算'],
    relatedToolIds: ['ipv4-cidr'],
  },
  {
    id: 'symmetric-crypto',
    name: '对称加解密',
    description: '支持 AES、SM4、ChaCha20、DES 等对称加密算法的加解密',
    seoDescription: '在线对称加解密工具，支持 AES-CBC/GCM、SM4、ChaCha20、DES 等算法，多格式输入输出，纯浏览器端加密无需上传。',
    category: '加密哈希',
    icon: '🛡️',
    path: '/crypto/symmetric-crypto',
    keywords: ['aes 加密', '在线加密解密', 'sm4 加密', 'chacha20', '对称加密', 'des 加密'],
    relatedToolIds: ['asymmetric-crypto', 'sm2-crypto', 'hash-generator'],
  },
  {
    id: 'asymmetric-crypto',
    name: '非对称加解密',
    description: '支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 等非对称加密算法的密钥生成、加解密与签名验签',
    seoDescription: '在线非对称加解密工具，支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 算法的密钥生成、加密解密与签名验签，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔐',
    path: '/crypto/asymmetric-crypto',
    keywords: ['rsa 加密', '非对称加密', 'ecdsa 签名', 'ed25519', '公钥加密', '密钥对生成'],
    relatedToolIds: ['symmetric-crypto', 'sm2-crypto', 'hash-generator'],
  },
  {
    id: 'sm2-crypto',
    name: 'SM2 国密加解密',
    description: 'SM2 国密非对称加密算法，支持密钥对生成、公钥加密与私钥解密',
    seoDescription: '在线 SM2 国密非对称加解密工具，支持密钥对生成、公钥加密与私钥解密，支持 C1C3C2/C1C2C3 密文模式，纯浏览器端运算。',
    category: '加密哈希',
    icon: '🔐',
    path: '/crypto/sm2-crypto',
    keywords: ['sm2 加密', '国密 sm2', 'sm2 在线', '国密算法', 'sm2 解密', 'sm2 密钥'],
    relatedToolIds: ['symmetric-crypto', 'asymmetric-crypto'],
  },
  {
    id: 'qr-code-generator',
    name: '二维码生成器',
    description: '在线生成自定义颜色、尺寸和容错级别的二维码，支持 PNG 与 SVG 下载',
    seoDescription: '在线二维码生成工具，支持自定义前景色/背景色/尺寸/容错级别(L/M/Q/H)，可下载 PNG 与 SVG 两种格式，纯浏览器端生成，数据不上传。',
    category: '媒体工具',
    icon: '🔳',
    path: '/media/qr-code-generator',
    keywords: ['二维码生成', 'qr code 生成', '在线二维码', '二维码制作', '二维码下载', 'svg 二维码'],
    relatedToolIds: ['base64-to-image'],
  },
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: 'Base64 编码与解码，支持文本和文件',
    seoDescription: '在线 Base64 编解码工具，支持文本与文件的 Base64 编码和解码，纯浏览器运算无需上传数据，即时转换。',
    category: '编码转换',
    icon: '📄',
    path: '/encoding/base64',
    keywords: ['base64 编码', 'base64 解码', 'base64 在线', 'base64 转换', '文本 base64', 'base64 编解码'],
    relatedToolIds: ['url-encode', 'base64-to-image', 'base64-to-file', 'jwt-parser'],
  },
  {
    id: 'base64-to-image',
    name: 'Base64 转图片',
    description: '将 Base64 字符串解码为图片，支持预览和下载',
    seoDescription: '在线 Base64 转图片工具，支持 PNG、JPEG、GIF、SVG、WebP 等格式，实时预览图片、显示尺寸大小信息，一键下载。',
    category: '编码转换',
    icon: '🖼️',
    path: '/encoding/base64-to-image',
    keywords: ['base64 转图片', 'base64 图片解码', 'base64 image', 'base64 预览', 'data uri 图片'],
    relatedToolIds: ['base64', 'base64-to-file', 'qr-code-generator'],
  },
  {
    id: 'base64-to-file',
    name: 'Base64 转文件',
    description: '将 Base64 字符串解码为文件，支持 Data URI 格式自动识别',
    seoDescription: '在线 Base64 转文件工具，支持 Data URI 格式输入，自动识别 MIME 类型，一键下载还原文件。',
    category: '编码转换',
    icon: '📎',
    path: '/encoding/base64-to-file',
    keywords: ['base64 转文件', 'base64 file', 'base64 下载', 'data uri 转文件', 'base64 还原'],
    relatedToolIds: ['base64', 'base64-to-image'],
  },
  {
    id: 'cron-parser',
    name: 'Cron 表达式解析器',
    description: '解析 Cron 表达式，预览执行时间，可视化构建',
    seoDescription: '在线 Cron 表达式解析器，支持可视化构建、执行时间预览和常用模板，帮助开发者快速编写和验证定时任务表达式。',
    category: '日期时间',
    icon: '⏰',
    path: '/datetime/cron-parser',
    keywords: ['cron 表达式', 'cron 解析', 'crontab 在线', '定时任务表达式', 'cron 验证', 'cron 可视化'],
    relatedToolIds: ['datetime-converter'],
  },
  {
    id: 'json-formatter',
    name: 'JSON 格式化器',
    description: '在线 JSON 格式化、压缩、验证与查询工具',
    seoDescription: '在线 JSON 格式化工具，支持美化、压缩、验证与 JSON Path 查询，实时语法高亮与统计信息，纯浏览器端运算。',
    category: '格式化',
    icon: '📋',
    path: '/format/json-formatter',
    keywords: ['json 格式化', 'json 美化', 'json 在线', 'json 压缩', 'json 验证', 'json 编辑器'],
    relatedToolIds: ['json-diff', 'json-to-yaml', 'json-to-xml'],
  },
  {
    id: 'json-diff',
    name: 'JSON 差异对比',
    description: '可视化对比两份 JSON 的差异，支持语义模式与严格文本模式',
    seoDescription: '在线 JSON 差异对比工具，支持语义对比与严格文本对比，并排可视化展示差异，纯浏览器端运算。',
    category: '格式化',
    icon: '🔍',
    path: '/format/json-diff',
    keywords: ['json 对比', 'json diff', 'json 差异', 'json 比较', '在线 json 对比'],
    relatedToolIds: ['json-formatter', 'json-to-yaml'],
  },
  {
    id: 'json-to-xml',
    name: 'JSON 转 XML',
    description: '将 JSON 数据转换为 XML 格式，支持自定义根元素名',
    seoDescription: '在线 JSON 转 XML 工具，输入 JSON 即可生成标准 XML，支持自定义根元素名，纯浏览器端运算不上传数据。',
    category: '格式化',
    icon: '🌲',
    path: '/format/json-to-xml',
    keywords: ['json 转 xml', 'json to xml', 'json xml 转换', '在线 json 转 xml'],
    relatedToolIds: ['json-formatter', 'json-to-yaml'],
  },
  {
    id: 'json-to-yaml',
    name: 'JSON 转 YAML',
    description: '将 JSON 数据转换为标准 YAML 格式',
    seoDescription: '在线 JSON 转 YAML 工具，输入 JSON 即可生成标准 YAML 配置格式，纯浏览器端运算不上传数据。',
    category: '格式化',
    icon: '📝',
    path: '/format/json-to-yaml',
    keywords: ['json 转 yaml', 'json to yaml', 'yaml 转换', '在线 yaml 工具', 'json yaml'],
    relatedToolIds: ['json-formatter', 'json-to-xml'],
  },
];
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `pnpm exec tsc --noEmit`
Expected: PASS（所有字段已补全）

- [ ] **Step 3: Commit**

```bash
git add src/data/tools.ts
git commit -m "feat(tools): 为全部 22 个工具补全 keywords 和 relatedToolIds 数据"
```

---

## Task 3: SeoHead 扩展 keywords 支持

**Files:**
- Modify: `src/components/seo/SeoHead.astro`

- [ ] **Step 1: 扩展 Props 接口并渲染 keywords meta 标签**

将 `src/components/seo/SeoHead.astro` 修改为：

```astro
---
interface Props {
  /** 页面标题 */
  title?: string;
  /** 页面描述（用于 meta description） */
  description?: string;
  /** 规范链接 */
  canonical?: string;
  /** JSON-LD 结构化数据（单个或多个） */
  jsonLd?: object | object[];
  /** 页面关键词（用于 meta keywords 标签） */
  keywords?: string[];
}

const {
  title = 'DevTools - 开发者工具集',
  description = '零门槛的浏览器端开发者工具集合，开箱即用',
  canonical = Astro.url.href,
  jsonLd,
  keywords,
} = Astro.props;

const siteUrl = Astro.site?.toString().replace(/\/$/, '') || '';
const ogImage = `${siteUrl}/og.png`;

/** 将 JSON-LD 数据序列化为字符串 */
const jsonLdItems = jsonLd
  ? Array.isArray(jsonLd)
    ? jsonLd
    : [jsonLd]
  : [];
---

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content={description} />
{keywords && keywords.length > 0 && (
  <meta name="keywords" content={keywords.join(', ')} />
)}
<meta name="msvalidate.01" content="C615FE8B2856A777991D6342873F34E4" />
<meta name="baidu-site-verification" content="codeva-ADm4YuLoCS" />
<link rel="canonical" href={canonical} />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={ogImage} />
<meta property="og:locale" content="zh_CN" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />

<!-- JSON-LD 结构化数据 -->
{jsonLdItems.map((item) => (
  <script is:inline type="application/ld+json" set:html={JSON.stringify(item)} />
))}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/seo/SeoHead.astro
git commit -m "feat(seo): SeoHead 支持 keywords prop，渲染 meta keywords 标签"
```

---

## Task 4: Layout.astro 透传 keywords

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: 扩展 Props 并透传 keywords 到 SeoHead**

将 `src/layouts/Layout.astro` 的 frontmatter 部分修改为：

```astro
---
import '../styles/global.css';
import SeoHead from '../components/seo/SeoHead.astro';

interface Props {
  title?: string;
  description?: string;
  jsonLd?: object | object[];
  /** 页面关键词（透传到 SeoHead） */
  keywords?: string[];
}

const { title = 'DevTools - 开发者工具集', description, jsonLd, keywords } = Astro.props;

const siteUrl = Astro.site?.toString().replace(/\/$/, '') || 'https://tools.openbong.cloud';

/** 首页 WebSite 结构化数据 */
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'DevTools',
  url: siteUrl,
  description: '零门槛的浏览器端开发者工具集合，即开即用，纯浏览器端运算',
  inLanguage: 'zh-CN',
};

/** 合并 WebSite JSON-LD 与页面自定义 JSON-LD */
const allJsonLd: object[] = [websiteJsonLd];
if (jsonLd) {
  allJsonLd.push(...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]));
}
---
```

同时修改 `<SeoHead>` 调用，添加 `keywords` 透传：

```astro
<SeoHead title={title} description={description} jsonLd={allJsonLd} keywords={keywords} />
```

> `<head>` 中的其余内容（favicon、字体、`<title>`）和 `<body>` 中的内容保持不变。

- [ ] **Step 2: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat(layout): Layout 透传 keywords prop 到 SeoHead"
```

---

## Task 5: 新建 RelatedTools.astro 组件

**Files:**
- Create: `src/components/layout/RelatedTools.astro`

- [ ] **Step 1: 创建 RelatedTools 组件**

创建 `src/components/layout/RelatedTools.astro`：

```astro
---
import type { ToolMeta } from '../../data/tools';
import { getRelatedTools } from '../../data/tools';

interface Props {
  /** 相关工具 ID 列表 */
  toolIds: string[];
}

const { toolIds } = Astro.props;

/** 解析 ID 列表为工具元数据（最多 4 个） */
const relatedTools: ToolMeta[] = getRelatedTools(
  // getRelatedTools 需要当前工具 ID 来找 relatedToolIds，
  // 但这里我们已经有了 toolIds，需要直接解析
  '' // 占位，实际在下方处理
);

// 直接用 toolIds 查找
const tools = toolIds
  .map((id) => {
    const { getToolById } = await import('../../data/tools');
    return getToolById(id);
  })
  .filter((t): t is ToolMeta => t !== undefined)
  .slice(0, 4);
---

{tools.length > 0 && (
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {tools.map((tool) => (
      <div class="relative flex h-full">
        <a
          href={tool.path}
          class="flex items-start gap-4 p-5 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full h-full"
        >
          <span class="text-[1.75rem] leading-none shrink-0 mt-0.5">{tool.icon}</span>
          <div class="flex-1 min-w-0">
            <h3 class="m-0 mb-1 text-[0.9375rem] font-semibold leading-snug">{tool.name}</h3>
            <p class="m-0 text-[0.8125rem] text-muted leading-relaxed">{tool.description}</p>
          </div>
        </a>
      </div>
    ))}
  </div>
)}
```

> **注意**：这里不直接使用 `ToolCard.astro`，因为 `ToolCard` 包含收藏星标按钮（依赖 Alpine.js store），在工具页底部的相关工具推荐中不需要收藏功能。直接渲染简化版卡片，样式与 ToolCard 保持一致。

- [ ] **Step 2: 确认语法正确**

Run: `pnpm exec astro check`
Expected: 无语法错误

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/RelatedTools.astro
git commit -m "feat(components): 新建 RelatedTools 组件，展示相关工具推荐卡片"
```

---

## Task 6: 改造 ToolLayout.astro — title 回退 + keywords 传入 + RelatedTools 渲染

**Files:**
- Modify: `src/layouts/ToolLayout.astro`

- [ ] **Step 1: 修改 ToolLayout frontmatter**

修改 `src/layouts/ToolLayout.astro` 的 frontmatter 部分（第 1-107 行），关键改动：

1. 导入 `RelatedTools` 和 `getToolById`
2. 添加 title 回退逻辑
3. 提取 keywords
4. 获取相关工具列表

将 frontmatter 替换为：

```astro
---
import Layout from './Layout.astro';
import Footer from '../components/layout/Footer.astro';
import Breadcrumb from '../components/layout/Breadcrumb.astro';
import RelatedTools from '../components/layout/RelatedTools.astro';
import { getToolsByCategory, getCategories, getToolBySlug, getToolById, slugCategoryMap } from '../data/tools';

interface Props {
  /** 页面标题（优先级最高，覆盖 toolMeta 中的 title） */
  title?: string;
  /** 页面描述（优先使用传入值，否则从 seoDescription 回退） */
  description?: string;
  /** 工具 ID（格式：categorySlug/toolSlug，如 encoding/base64） */
  toolId?: string;
}

const { title, description, toolId = '' } = Astro.props;
const currentPath = toolId ? `/${toolId}` : Astro.url.pathname;
const categories = getCategories();
const toolsByCategory = getToolsByCategory();

/** 通过 toolId 查找工具元数据 */
const toolMeta = toolId ? getToolBySlug(toolId) : undefined;

/** 确定 title：props.title > toolMeta.title > 自动拼接 "{name} - DevTools" */
const finalTitle = title || toolMeta?.title || (toolMeta ? `${toolMeta.name} - DevTools` : undefined);

/** 确定 description：优先 props → seoDescription → 默认值 */
const finalDescription = description || toolMeta?.seoDescription || undefined;

/** 提取 keywords */
const keywords = toolMeta?.keywords;

/** 获取相关工具列表 */
const relatedTools = toolMeta?.relatedToolIds
  ? toolMeta.relatedToolIds
      .map((id) => getToolById(id))
      .filter((t) => t !== undefined)
      .slice(0, 4)
  : [];

/** 站点基础 URL */
const siteUrl = Astro.site?.toString().replace(/\/$/, '') || 'https://tools.openbong.cloud';

/** 构建 JSON-LD 结构化数据 */
const jsonLdItems: object[] = [];

if (toolId && toolMeta) {
  const [categorySlug] = toolId.split('/');
  const categoryName = slugCategoryMap[categorySlug] || categorySlug;
  const toolPageUrl = `${siteUrl}/${toolId}`;

  // 1. BreadcrumbList — 面包屑结构化数据
  jsonLdItems.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首页',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryName,
        item: `${siteUrl}/${categorySlug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: toolMeta.name,
      },
    ],
  });

  // 2. WebPage — 页面信息
  jsonLdItems.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: toolMeta.name,
    description: toolMeta.seoDescription,
    url: toolPageUrl,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: categoryName },
        { '@type': 'ListItem', position: 3, name: toolMeta.name },
      ],
    },
  });

  // 3. SoftwareApplication — 工具信息
  jsonLdItems.push({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: toolMeta.name,
    description: toolMeta.seoDescription,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
    },
  });
}

/** 构建面包屑导航项 */
const breadcrumbItems = toolId && toolMeta
  ? (() => {
      const [categorySlug] = toolId.split('/');
      const categoryName = slugCategoryMap[categorySlug] || categorySlug;
      return [
        { label: '首页', href: '/' },
        { label: categoryName },
        { label: toolMeta.name },
      ];
    })()
  : [];
---
```

- [ ] **Step 2: 修改 Layout 调用，传入 keywords**

将第 109 行的 `<Layout>` 调用改为：

```astro
<Layout title={finalTitle} description={finalDescription} jsonLd={jsonLdItems} keywords={keywords}>
```

- [ ] **Step 3: 在 main 内容区底部插入相关工具推荐区**

在 `<main>` 标签内，`<slot />` 之后、`</main>` 之前（即原文件第 330 行的 `<slot />` 之后），插入相关工具区块。找到：

```astro
      <main class="flex-1 p-8 overflow-y-auto overflow-x-hidden max-w-full max-md:p-4">
        {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
        <slot />
      </main>
```

替换为：

```astro
      <main class="flex-1 p-8 overflow-y-auto overflow-x-hidden max-w-full max-md:p-4">
        {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
        <slot />
        {relatedTools.length > 0 && (
          <section class="mt-12 pt-8 border-t border-border">
            <h2 class="text-lg font-semibold text-text mb-4">相关工具</h2>
            <RelatedTools toolIds={toolMeta!.relatedToolIds} />
          </section>
        )}
      </main>
```

- [ ] **Step 4: 验证编译**

Run: `pnpm exec astro check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/layouts/ToolLayout.astro
git commit -m "feat(layout): ToolLayout 自动 title 回退、keywords 注入、底部相关工具推荐区"
```

---

## Task 7: 简化 22 个工具页面 — 移除硬编码 title

**Files:**
- Modify: 22 个 `src/pages/**/*.astro` 文件

- [ ] **Step 1: 逐个移除 title prop**

每个文件的改动模式完全相同——将 `<ToolLayout title="xxx - DevTools" toolId="...">` 改为 `<ToolLayout toolId="...">`。

具体改动清单：

| 文件 | 修改前 | 修改后 |
|------|--------|--------|
| `src/pages/text/uuid-generator.astro` | `<ToolLayout title="UUID 生成器 - DevTools" toolId="text/uuid-generator">` | `<ToolLayout toolId="text/uuid-generator">` |
| `src/pages/crypto/hash-generator.astro` | `<ToolLayout title="哈希生成器 - DevTools" toolId="crypto/hash-generator">` | `<ToolLayout toolId="crypto/hash-generator">` |
| `src/pages/text/random-string.astro` | `<ToolLayout title="随机字符串生成 - DevTools" toolId="text/random-string">` | `<ToolLayout toolId="text/random-string">` |
| `src/pages/datetime/datetime-converter.astro` | `<ToolLayout title="日期时间转换器 - DevTools" toolId="datetime/datetime-converter">` | `<ToolLayout toolId="datetime/datetime-converter">` |
| `src/pages/encoding/url-encode.astro` | `<ToolLayout title="URL 编解码 - DevTools" toolId="encoding/url-encode">` | `<ToolLayout toolId="encoding/url-encode">` |
| `src/pages/encoding/jwt-parser.astro` | `<ToolLayout title="JWT 解析器 - DevTools" toolId="encoding/jwt-parser">` | `<ToolLayout toolId="encoding/jwt-parser">` |
| `src/pages/network/device-info.astro` | `<ToolLayout title="设备信息与 UserAgent - DevTools" toolId="network/device-info">` | `<ToolLayout toolId="network/device-info">` |
| `src/pages/network/http-status-codes.astro` | `<ToolLayout title="HTTP 状态码查询 - DevTools" toolId="network/http-status-codes">` | `<ToolLayout toolId="network/http-status-codes">` |
| `src/pages/network/ipv4-cidr.astro` | `<ToolLayout title="IPv4 子网计算器 - DevTools" toolId="network/ipv4-cidr">` | `<ToolLayout toolId="network/ipv4-cidr">` |
| `src/pages/network/ipv4-range-expander.astro` | `<ToolLayout title="IPv4 范围展开 - DevTools" toolId="network/ipv4-range-expander">` | `<ToolLayout toolId="network/ipv4-range-expander">` |
| `src/pages/crypto/symmetric-crypto.astro` | `<ToolLayout title="对称加解密 - DevTools" toolId="crypto/symmetric-crypto">` | `<ToolLayout toolId="crypto/symmetric-crypto">` |
| `src/pages/crypto/asymmetric-crypto.astro` | `<ToolLayout title="非对称加解密 - DevTools" toolId="crypto/asymmetric-crypto">` | `<ToolLayout toolId="crypto/asymmetric-crypto">` |
| `src/pages/crypto/sm2-crypto.astro` | `<ToolLayout title="SM2 国密加解密 - DevTools" toolId="crypto/sm2-crypto">` | `<ToolLayout toolId="crypto/sm2-crypto">` |
| `src/pages/media/qr-code-generator.astro` | `<ToolLayout title="二维码生成器 - DevTools" toolId="media/qr-code-generator">` | `<ToolLayout toolId="media/qr-code-generator">` |
| `src/pages/encoding/base64.astro` | `<ToolLayout title="Base64 编解码 - DevTools" toolId="encoding/base64">` | `<ToolLayout toolId="encoding/base64">` |
| `src/pages/encoding/base64-to-image.astro` | `<ToolLayout title="Base64 转图片 - DevTools" toolId="encoding/base64-to-image">` | `<ToolLayout toolId="encoding/base64-to-image">` |
| `src/pages/encoding/base64-to-file.astro` | `<ToolLayout title="Base64 转文件 - DevTools" toolId="encoding/base64-to-file">` | `<ToolLayout toolId="encoding/base64-to-file">` |
| `src/pages/datetime/cron-parser.astro` | `<ToolLayout title="Cron 表达式解析器 - DevTools" toolId="datetime/cron-parser">` | `<ToolLayout toolId="datetime/cron-parser">` |
| `src/pages/format/json-formatter.astro` | `<ToolLayout title="JSON 格式化器 - DevTools" toolId="format/json-formatter">` | `<ToolLayout toolId="format/json-formatter">` |
| `src/pages/format/json-diff.astro` | `<ToolLayout title="JSON 差异对比 - DevTools" toolId="format/json-diff">` | `<ToolLayout toolId="format/json-diff">` |
| `src/pages/format/json-to-xml.astro` | `<ToolLayout title="JSON 转 XML - DevTools" toolId="format/json-to-xml">` | `<ToolLayout toolId="format/json-to-xml">` |
| `src/pages/format/json-to-yaml.astro` | `<ToolLayout title="JSON 转 YAML - DevTools" toolId="format/json-to-yaml">` | `<ToolLayout toolId="format/json-to-yaml">` |

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/pages/
git commit -m "refactor(pages): 移除 22 个工具页面的硬编码 title prop，统一由 ToolLayout 自动生成"
```

---

## Task 8: 修复 RelatedTools 组件实现

**Files:**
- Modify: `src/components/layout/RelatedTools.astro`

Task 5 中的 RelatedTools 实现使用了 `await import()` 动态导入，这在 Astro 组件的 frontmatter 中是多余的（已经可以静态导入）。将其简化为纯静态导入版本：

- [ ] **Step 1: 重写 RelatedTools.astro**

```astro
---
import type { ToolMeta } from '../../data/tools';
import { getToolById } from '../../data/tools';

interface Props {
  /** 相关工具 ID 列表 */
  toolIds: string[];
}

const { toolIds } = Astro.props;

/** 解析 ID 列表为工具元数据（最多 4 个，过滤无效 ID） */
const relatedTools: ToolMeta[] = toolIds
  .map((id) => getToolById(id))
  .filter((t): t is ToolMeta => t !== undefined)
  .slice(0, 4);
---

{relatedTools.length > 0 && (
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {relatedTools.map((tool) => (
      <div class="relative flex h-full">
        <a
          href={tool.path}
          class="flex items-start gap-4 p-5 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full h-full"
        >
          <span class="text-[1.75rem] leading-none shrink-0 mt-0.5">{tool.icon}</span>
          <div class="flex-1 min-w-0">
            <h3 class="m-0 mb-1 text-[0.9375rem] font-semibold leading-snug">{tool.name}</h3>
            <p class="m-0 text-[0.8125rem] text-muted leading-relaxed">{tool.description}</p>
          </div>
        </a>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/RelatedTools.astro
git commit -m "fix(components): 简化 RelatedTools 为静态导入，移除多余的动态 import"
```

---

## Task 9: 端到端验证

**Files:** 无修改

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`

- [ ] **Step 2: 检查工具页 title**

访问 `http://localhost:4321/encoding/base64`，确认：
- 浏览器标签页标题为 `Base64 编解码 - DevTools`
- 页面源码中 `<title>Base64 编解码 - DevTools</title>`

- [ ] **Step 3: 检查 meta keywords**

查看页面源码，确认存在：
```html
<meta name="keywords" content="base64 编码, base64 解码, base64 在线, base64 转换, 文本 base64, base64 编解码" />
```

- [ ] **Step 4: 检查相关工具推荐区**

确认 Base64 工具页底部（Footer 上方）显示"相关工具"区块，包含 4 张卡片：
- URL 编解码
- Base64 转图片
- Base64 转文件
- JWT 编解码

- [ ] **Step 5: 检查空状态**

访问一个只有 1-2 个相关工具的页面（如 `http://localhost:4321/text/random-string`），确认卡片数量与 `relatedToolIds` 一致，不会补空位。

- [ ] **Step 6: 检查响应式**

在浏览器中：
- 缩小窗口到手机宽度（< 768px），确认卡片变为单列
- 中等宽度（768px-1023px），确认卡片变为 2 列
- 桌面宽度（≥ 1024px），确认卡片为 4 列

- [ ] **Step 7: 运行 Lighthouse**

Run: 在 Chrome DevTools 中运行 Lighthouse（Performance + SEO + Accessibility + Best Practices）
Expected: Performance ≥ 90, SEO ≥ 90

- [ ] **Step 8: 构建生产版本**

Run: `pnpm build`
Expected: 构建成功，无错误
