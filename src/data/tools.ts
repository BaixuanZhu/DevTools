/** 工具分类 */
export type ToolCategory =
  | '文本与编码'
  | '加密与安全'
  | '格式化与转换'
  | '网络工具'
  | '日期时间'
  | '前端与媒体'
  | '开发与运维';

/** 分类 slug 映射（中 → 英） */
export const categorySlugMap: Record<ToolCategory, string> = {
  '文本与编码': 'text',
  '加密与安全': 'crypto',
  '格式化与转换': 'format',
  '网络工具': 'network',
  '日期时间': 'datetime',
  '前端与媒体': 'frontend',
  '开发与运维': 'devops',
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
  /** 所属分类（独立工作台形态的工具不归属任何分类，省略此字段并以 standalone 标记） */
  category?: ToolCategory;
  /** 图标（emoji） */
  icon: string;
  /** 路由路径（常规为二级路径格式 /category/id；独立工作台为单段路径，如 /markdown） */
  path: string;
  /**
   * 独立工作台形态标记。
   * 标记后：不进分类页聚合与 Sidebar 徽标、Sidebar 出现独立一级入口、
   * 全站所有指向该工具的链接一律新标签页打开（target="_blank"）。
   */
  standalone?: true;
  /** 页面 <title> 覆盖（可选，不传则自动拼接 "{name} - DevTools"） */
  title?: string;
  /** 长尾关键词列表，用于 meta keywords 标签及内部选题参考 */
  keywords: string[];
  /** 相关工具 ID 列表，页面最多展示前 4 个 */
  relatedToolIds: string[];
}

/** 所有已注册的工具列表 */
export const tools: ToolMeta[] = [
  {
    id: 'number-base-converter',
    name: '进制转换器',
    description: '二进制、八进制、十进制、十六进制批量互转，支持大整数与补码二进制预览',
    seoDescription: '免费在线进制转换工具，支持二进制、八进制、十进制、十六进制任意进制批量互转，基于 BigInt 精确处理超出 Number 安全范围的任意大整数与负数补码，并提供逐位二进制位图预览辅助理解位运算，前端开发与协议调试必备，纯浏览器端运算数据绝不上传。',
    category: '文本与编码',
    icon: '🔢',
    path: '/text/number-base-converter',
    keywords: ['进制转换', '二进制转十六进制', '八进制转十进制', '十进制转二进制', 'BigInt', '补码', 'hex转binary', '进制互转'],
    relatedToolIds: ['random-string', 'uuid-generator'],
  },
  {
    id: 'text-toolbox',
    name: '文本处理工具箱',
    description: '大小写与全半角转换、去重去空行、排序、字数字节统计、查找替换，一站式文本处理',
    seoDescription: '免费在线文本处理工具箱，一站式完成大小写与全半角转换、按行去重去空行、正序倒序排序、字数与字节统计、行号添加删除、正则查找替换等高频文本操作，粘贴即处理无需切换多个工具，文案整理、日志清洗与数据预处理场景即开即用，纯浏览器端本地运算数据绝不上传。',
    category: '文本与编码',
    icon: '🧰',
    path: '/text/text-toolbox',
    keywords: ['文本处理', '大小写转换', '全角半角', '去重', '去空行', '文本排序', '字数统计', '查找替换'],
    relatedToolIds: ['number-base-converter', 'uuid-generator', 'random-string'],
  },
  {
    id: 'uuid-generator',
    name: 'UUID 生成器',
    description: '生成并解析多种版本的 UUID（v1/v3/v4/v5/v6/v7），支持格式转换与解码分析',
    seoDescription: '免费在线 UUID 生成器与解析工具，支持 v1/v3/v4/v5/v6/v7 多版本一键与批量生成，可自定义连字符与大小写格式，粘贴既有 UUID 即可解码出版本号、时间戳与 MAC 地址等字段信息，数据库主键与分布式 ID 造数必备，纯浏览器端运算数据绝不上传。',
    category: '文本与编码',
    icon: '🔑',
    path: '/text/uuid-generator',
    keywords: ['uuid 生成器', 'uuid 在线生成', 'uuid v4', 'guid 生成', '唯一标识符', 'uuid 解析'],
    relatedToolIds: ['random-string', 'hash-generator'],
  },
  {
    id: 'hash-generator',
    name: '哈希生成器',
    description: '支持 MD5、SHA-1、SHA-256 等哈希算法与 HMAC 带密钥签名，结果可转换为不同进制',
    seoDescription: '免费在线哈希生成与 HMAC 工具，支持 MD5、SHA-1、SHA-256、SHA-384、SHA-512 等算法对文本计算哈希值，HMAC-SHA256 带密钥签名生成与验证适用于 API 签名与 Webhook 回调校验，结果可切换十六进制或 Base64 输出，纯浏览器端运算数据绝不上传。',
    category: '加密与安全',
    icon: '🔒',
    path: '/crypto/hash-generator',
    keywords: ['哈希生成器', 'md5 在线', 'sha256 计算', 'sha512 在线', 'hash 在线工具', '文本哈希', 'hmac 在线', 'hmac sha256', 'webhook 签名验证', 'api 签名'],
    relatedToolIds: ['symmetric-crypto', 'jwt-parser', 'base64'],
  },
  {
    id: 'random-string',
    name: '随机字符串生成',
    description: '自定义长度和字符集的随机字符串生成器',
    seoDescription: '免费在线随机字符串生成工具，支持自定义长度与字符集（大小写字母、数字、符号自由组合），可设置排除易混淆字符并批量一次生成多条随机密码、随机昵称或测试用随机文本，结果支持一键复制，注册造数与安全加固等场景即开即用，纯浏览器端运算数据绝不上传。',
    category: '文本与编码',
    icon: '🎲',
    path: '/text/random-string',
    keywords: ['随机字符串生成', '随机密码生成', '在线随机数', '密码生成器', '随机文本'],
    relatedToolIds: ['uuid-generator'],
  },
  {
    id: 'datetime-converter',
    name: '日期时间转换器',
    description: '时间戳与日期格式互转，支持多种日期格式',
    seoDescription: '免费在线日期时间转换工具，支持 Unix 时间戳（秒/毫秒）与日期字符串双向互转，内置北京时间、UTC、纽约、东京等多时区实时对比，ISO 8601 等常见日期格式一键输出，前后端联调排查时区与时间戳问题即开即用，纯浏览器端运算数据绝不上传。',
    category: '日期时间',
    icon: '🕐',
    path: '/datetime/datetime-converter',
    keywords: ['时间戳转换', '日期转换器', 'unix 时间戳', '时间戳在线', '日期格式转换', '时间戳转日期'],
    relatedToolIds: ['cron-parser'],
  },
  {
    id: 'jwt-parser',
    name: 'JWT 编解码',
    description: '解析和生成 JSON Web Token，支持 HMAC 签名验证与编码',
    seoDescription: '免费在线 JWT 解析与生成工具，粘贴 JSON Web Token 即可解码 Header 与 Payload 明文、查看签名算法与过期时间等标准声明，支持 HMAC 密钥在线验证签名合法性，也可自行构造 Token 用于联调测试，登录态排查与接口调试必备，纯浏览器端解码数据绝不上传。',
    category: '文本与编码',
    icon: '🎫',
    path: '/text/jwt-parser',
    keywords: ['jwt 解析', 'jwt 解码', 'jwt 在线解析', 'token 解析', 'jwt 验证', 'json web token'],
    relatedToolIds: ['base64', 'url', 'hash-generator'],
  },
  {
    id: 'device-info',
    name: '设备信息与UA',
    description: '查看浏览器、操作系统、屏幕等设备信息',
    seoDescription: '免费在线设备信息查看工具，一键获取浏览器 UserAgent 完整字符串与解析结果、操作系统与版本、浏览器内核、屏幕分辨率与像素比、CPU 核心数、语言时区与网络连接类型等软硬件信息，可用于环境排查与兼容性测试，支持一键复制，纯浏览器端本地检测不上传数据。',
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
    seoDescription: '免费在线 HTTP 状态码查询手册，完整收录 1xx 信息提示到 5xx 服务器错误的全部状态码，按分类筛选或输入关键词即可快速定位，每个状态码附中文释义、常见触发场景与排查建议，并标注 RFC 规范来源，接口联调排查 404/500 等问题必备，纯浏览器端查询数据不上传。',
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
    seoDescription: '免费在线 IPv4 子网计算工具，输入 IP 地址与子网掩码或 CIDR 前缀即可获取网络地址、广播地址、可用主机范围、掩码反码与二进制表示等完整子网信息，附 CIDR 与子网划分术语中文说明，网络配置与运维排障必备，纯浏览器端计算数据绝不上传。',
    category: '网络工具',
    icon: '🌐',
    path: '/network/ipv4-cidr',
    keywords: ['ipv4 子网计算', 'cidr 计算', '子网掩码计算', 'ip 地址计算器', '网段计算', '子网划分'],
    relatedToolIds: ['ipv4-range-expander', 'ipv6-cidr', 'device-info'],
  },
  {
    id: 'ipv6-cidr',
    name: 'IPv6 子网计算器',
    description: '输入 IPv6 地址和前缀长度，计算网络地址、地址范围、地址总数与地址类型',
    seoDescription: '免费在线 IPv6 子网计算工具，输入 IPv6 地址与 CIDR 前缀长度即可获取网络地址、首末可用地址、地址范围与地址总数，自动识别链路本地、组播等地址类型，支持压缩与展开格式互转，基于 BigInt 精确处理 128 位大数，网络运维与 IPv6 改造必备，纯浏览器端运算数据不上传。',
    category: '网络工具',
    icon: '🛰️',
    path: '/network/ipv6-cidr',
    keywords: ['ipv6 子网计算', 'ipv6 cidr 计算', 'ipv6 地址类型', 'ipv6 前缀计算', 'ipv6 地址范围', 'ipv6 压缩展开'],
    relatedToolIds: ['ipv4-cidr', 'ipv4-range-expander'],
  },
  {
    id: 'ipv4-range-expander',
    name: 'IPv4 范围展开',
    description: '将 IPv4 地址范围转换为最简 CIDR 列表',
    seoDescription: '免费在线 IPv4 地址范围转换工具，输入起始与结束 IP 地址即可自动计算覆盖该区间的最少 CIDR 块列表，逐条展示每个 CIDR 块的网络地址、掩码与可用主机数并统计 IP 总数，防火墙规则整理与网段规划场景必备，纯浏览器端运算数据绝不上传。',
    category: '网络工具',
    icon: '📊',
    path: '/network/ipv4-range-expander',
    keywords: ['ip 范围转换', 'ipv4 cidr 转换', 'ip 地址范围', 'cidr 合并', 'ip 段计算'],
    relatedToolIds: ['ipv4-cidr'],
  },
  {
    id: 'url',
    name: 'URL 解析器',
    description: 'URL 编解码与结构化解析，支持 query 参数表格化编辑与一键重建 URL',
    seoDescription: '免费在线 URL 解析与编解码工具，支持 URL 编码解码、结构化拆解 protocol、host、path、query 与 hash 组成部分，查询参数以表格形式编辑后一键重建完整 URL，自动区分 encodeURIComponent 与 encodeURI 差异，接口联调与参数排查必备，纯浏览器端运算数据不上传。',
    category: '网络工具',
    icon: '🔗',
    path: '/network/url',
    keywords: ['url 解析', 'url 编码', 'url 解码', 'query 参数编辑', 'url 参数解析', 'urlencode', 'urldecode', 'uri 解析'],
    relatedToolIds: ['ipv4-cidr', 'ipv6-cidr', 'http-status-codes', 'device-info'],
  },
  {
    id: 'symmetric-crypto',
    name: '对称加解密',
    description: '支持 AES、SM4、ChaCha20、DES 等对称加密算法的加解密',
    seoDescription: '免费在线对称加密解密工具，支持 AES-128/192/256 的 CBC 与 GCM 模式、国密 SM4、ChaCha20-Poly1305 及 DES/3DES 等主流算法，密钥与初始向量支持多进制格式输入，密文可切换 Base64 与十六进制输出，接口报文加解密联调必备，纯浏览器端运算密钥数据绝不上传。',
    category: '加密与安全',
    icon: '🛡️',
    path: '/crypto/symmetric-crypto',
    keywords: ['aes 加密', '在线加密解密', 'sm4 加密', 'chacha20', '对称加密', 'des 加密'],
    relatedToolIds: ['asymmetric-crypto', 'sm2-crypto', 'hash-generator'],
  },
  {
    id: 'asymmetric-crypto',
    name: '非对称加解密',
    description: '支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 等非对称加密算法的密钥生成、加解密与签名验签',
    seoDescription: '免费在线非对称加密解密工具，支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519 等主流算法的密钥对生成、公钥加密、私钥解密与签名验签，密钥支持 PEM 与 JWK 等格式导入导出，接口签名联调与密码学学习必备，纯浏览器端 WebCrypto 运算数据绝不上传。',
    category: '加密与安全',
    icon: '🔐',
    path: '/crypto/asymmetric-crypto',
    keywords: ['rsa 加密', '非对称加密', 'ecdsa 签名', 'ed25519', '公钥加密', '密钥对生成'],
    relatedToolIds: ['symmetric-crypto', 'sm2-crypto', 'hash-generator'],
  },
  {
    id: 'sm2-crypto',
    name: 'SM2 国密加解密',
    description: 'SM2 国密非对称加密算法，支持密钥对生成、公钥加密与私钥解密',
    seoDescription: '免费在线 SM2 国密加解密工具，支持密钥对一键生成、公钥加密与私钥解密，以及 SM2 签名验签，兼容 C1C3C2 与 C1C2C3 两种密文排列模式并可互转，满足政务、金融等国密改造场景的接口联调与验证需求，纯浏览器端运算密钥数据绝不上传。',
    category: '加密与安全',
    icon: '🔐',
    path: '/crypto/sm2-crypto',
    keywords: ['sm2 加密', '国密 sm2', 'sm2 在线', '国密算法', 'sm2 解密', 'sm2 密钥'],
    relatedToolIds: ['symmetric-crypto', 'asymmetric-crypto'],
  },
  {
    id: 'qr-code-generator',
    name: '二维码生成器',
    description: '在线生成自定义颜色、尺寸和容错级别的二维码，支持 PNG 与 SVG 下载',
    seoDescription: '免费在线二维码生成工具，输入文字或网址实时生成高清二维码，支持自定义前景色与背景色、尺寸大小与容错级别（L/M/Q/H），可下载 PNG 位图与 SVG 矢量图两种格式用于印刷或网页嵌入，名片、海报与产品包装扫码场景即开即用，纯浏览器端生成数据绝不上传。',
    category: '前端与媒体',
    icon: '🔳',
    path: '/frontend/qr-code-generator',
    keywords: ['二维码生成', 'qr code 生成', '在线二维码', '二维码制作', '二维码下载', 'svg 二维码'],
    relatedToolIds: ['base64-to-image', 'qr-code-reader'],
  },
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: 'Base64 编码与解码，支持多字符集与非法字符过滤',
    seoDescription: '免费在线 Base64 编码解码工具，支持 UTF-8、GBK、Big5、Shift_JIS 等多字符集解码并自动过滤非法字符，文本与 Base64 双向即时转换，轻松解决中文乱码问题，附带 Data URI 格式支持，前后端联调与编码排查必备，纯浏览器端运算数据绝不上传。',
    category: '文本与编码',
    icon: '📄',
    path: '/text/base64',
    keywords: ['base64 编码', 'base64 解码', 'base64 在线', 'base64 转换', '文本 base64', 'base64 编解码', 'base64 字符集', 'base64 gbk 解码', 'base64 乱码'],
    relatedToolIds: ['url', 'base64-to-image', 'base64-to-file', 'jwt-parser', 'file-to-base64'],
  },
  {
    id: 'base64-to-image',
    name: 'Base64 转图片',
    description: '将 Base64 字符串解码为图片，支持预览和下载',
    seoDescription: '免费在线 Base64 转图片工具，粘贴 Base64 字符串或 Data URI 即可实时预览 PNG、JPEG、GIF、SVG、WebP、BMP 等格式的图片内容，自动解析显示图片宽高、体积与 MIME 类型，支持一键下载还原图片文件，前端样式与邮件模板调试必备，纯浏览器端解析数据绝不上传。',
    category: '文本与编码',
    icon: '🖼️',
    path: '/text/base64-to-image',
    keywords: ['base64 转图片', 'base64 图片解码', 'base64 image', 'base64 预览', 'data uri 图片'],
    relatedToolIds: ['base64', 'base64-to-file', 'qr-code-generator', 'file-to-base64'],
  },
  {
    id: 'base64-to-file',
    name: 'Base64 转文件',
    description: '将 Base64 字符串解码为文件，支持 Data URI 格式自动识别',
    seoDescription: '免费在线 Base64 转文件工具，粘贴 Base64 字符串或 Data URI 即可自动识别 MIME 类型并还原为原始文件，支持图片、文档、压缩包等任意类型一键下载，显示文件大小便于核对完整性，前后端联调接口导出场景必备，纯浏览器端解析数据绝不上传。',
    category: '文本与编码',
    icon: '📎',
    path: '/text/base64-to-file',
    keywords: ['base64 转文件', 'base64 file', 'base64 下载', 'data uri 转文件', 'base64 还原'],
    relatedToolIds: ['file-to-base64', 'base64', 'base64-to-image'],
  },
  {
    id: 'file-to-base64',
    name: '文件转 Base64',
    description: '将任意文件编码为 Base64 字符串，可选附带 Data URI 前缀',
    seoDescription: '免费在线文件转 Base64 工具，将图片、文档、音视频等任意文件拖拽或点击上传即可编码为 Base64 字符串或 Data URI，可选是否附带格式前缀，大文件采用异步分块编码不卡页面，结果显示字符长度便于核对，前端内联资源与接口传参场景必备，纯浏览器端运算文件绝不上传。',
    category: '文本与编码',
    icon: '📤',
    path: '/text/file-to-base64',
    keywords: ['文件转 base64', 'file to base64', '图片转 base64', '文件编码', 'data uri 生成', 'base64 编码文件'],
    relatedToolIds: ['base64', 'base64-to-file', 'base64-to-image'],
  },
  {
    id: 'cron-parser',
    name: 'Cron 表达式',
    description: '解析 Cron 表达式，预览执行时间，可视化构建',
    seoDescription: '免费在线 Cron 表达式解析工具，输入表达式即时翻译为中文描述并预览未来多轮执行时间，内置可视化构建器点选分/时/日/月/周即可生成表达式，附带每分钟、每天凌晨等常用定时任务模板一键填入，运维配 crontab 与 Spring 定时任务调试必备，纯浏览器端运算。',
    category: '日期时间',
    icon: '⏰',
    path: '/datetime/cron-parser',
    keywords: ['cron 表达式', 'cron 解析', 'crontab 在线', '定时任务表达式', 'cron 验证', 'cron 可视化'],
    relatedToolIds: ['datetime-converter'],
  },
  {
    id: 'time-calculator',
    name: '时间差计算器',
    description: '计算两个时间点的时间差（天/时/分/秒 + 总秒数）',
    seoDescription: '免费在线时间差计算工具，输入两个时间点（支持 Unix 时间戳与日期时间字符串混用）即可计算相差的天、时、分、秒与总秒数，自动标注先后方向并附总分钟与总小时换算结果，项目排期、日志时间差与倒计时核算场景即开即用，纯浏览器端运算数据绝不上传。',
    category: '日期时间',
    icon: '📏',
    path: '/datetime/time-calculator',
    keywords: ['时间差计算', '时间间隔计算', '两个时间差', '时间戳差值', '日期差值'],
    relatedToolIds: ['datetime-converter', 'cron-parser'],
  },
  {
    id: 'json-formatter',
    name: 'JSON 格式化器',
    description: '在线 JSON 格式化、压缩与校验工具',
    seoDescription: '免费在线 JSON 格式化工具，支持一键美化缩进、压缩为单行与语法校验定位错误行列号，实时语法高亮显示键值类型并统计节点数、深度与字节数，结果可一键复制下载，接口调试与配置文件整理必备，大文本粘贴即转无需等待，纯浏览器端运算数据绝不上传服务器。',
    category: '格式化与转换',
    icon: '📋',
    path: '/format/json-formatter',
    keywords: ['json 格式化', 'json 美化', 'json 在线', 'json 压缩', 'json 验证', 'json 编辑器'],
    relatedToolIds: ['json-diff', 'json-to-yaml', 'json-to-xml', 'json-to-ts'],
  },
  {
    id: 'json-diff',
    name: 'JSON 差异对比',
    description: '可视化对比两份 JSON 的差异，支持语义模式与严格文本模式',
    seoDescription: '免费在线 JSON 差异对比工具，支持语义对比模式（忽略键顺序与格式差异）与严格文本对比两种策略，左右并排高亮展示新增、删除与修改的键值差异，适用于接口返回值比对、配置变更审查与测试断言排查，深层大文件经 Web Worker 异步处理不卡界面，纯浏览器端运算数据绝不上传。',
    category: '格式化与转换',
    icon: '🔍',
    path: '/format/json-diff',
    keywords: ['json 对比', 'json diff', 'json 差异', 'json 比较', '在线 json 对比'],
    relatedToolIds: ['json-formatter', 'json-to-yaml'],
  },
  {
    id: 'json-to-xml',
    name: 'JSON 转 XML',
    description: '将 JSON 数据转换为 XML 格式，支持自定义根元素名',
    seoDescription: '免费在线 JSON 转 XML 工具，输入 JSON 即可生成格式规范的标准 XML 文档，支持自定义根元素名称、属性节点与文本节点转换规则，自动处理特殊字符转义并美化缩进输出，接口数据格式迁移与旧系统对接必备，纯浏览器端运算数据绝不上传。',
    category: '格式化与转换',
    icon: '🌲',
    path: '/format/json-to-xml',
    keywords: ['json 转 xml', 'json to xml', 'json xml 转换', '在线 json 转 xml'],
    relatedToolIds: ['json-formatter', 'json-to-yaml', 'json-to-ts'],
  },
  {
    id: 'json-to-yaml',
    name: 'JSON 转 YAML',
    description: '将 JSON 数据转换为标准 YAML 格式',
    seoDescription: '免费在线 JSON 转 YAML 工具，粘贴 JSON 即可实时生成标准 YAML 配置格式，自动处理嵌套缩进、数组列表与多行字符串，支持 YAML 反向转回 JSON 双向互转对照查看，Kubernetes 清单与 CI 配置编写必备，纯浏览器端解析数据绝不上传。',
    category: '格式化与转换',
    icon: '📝',
    path: '/format/json-to-yaml',
    keywords: ['json 转 yaml', 'json to yaml', 'yaml 转换', '在线 yaml 工具', 'json yaml'],
    relatedToolIds: ['json-formatter', 'json-to-xml', 'json-to-ts'],
  },
  {
    id: 'json-to-ts',
    name: 'JSON 转 TS',
    description: '将 JSON 数据智能推断为 TypeScript interface，自动合并数组字段并标注可选类型',
    seoDescription: '免费的在线 JSON 转 TypeScript 工具，粘贴 JSON 即可自动生成 TS interface 类型定义，智能合并数组元素字段并标注可选类型，支持嵌套对象与多类型并集，输出可通过 tsc strict 严格检查，纯浏览器端运算，数据不上传服务器。',
    category: '格式化与转换',
    icon: '🔷',
    path: '/format/json-to-ts',
    keywords: ['json 转 typescript', 'json to interface', 'json 生成类型', 'json to ts', 'ts 类型生成', 'json 接口生成', 'json 转 ts'],
    relatedToolIds: ['json-formatter', 'json-to-yaml', 'json-to-xml'],
  },
  {
    id: 'markdown-editor',
    name: 'Markdown 编辑器',
    description: '独立全屏 Markdown 工作台：多文档草稿箱、编辑/分栏/预览三视图，支持 mermaid 图表、数学公式、图片粘贴与导入导出，纯浏览器端运行',
    seoDescription: '免费在线 Markdown 工作台，独立全屏编辑器支持多文档草稿箱自动保存与刷新恢复、仅编辑/分栏/仅预览三视图切换、mermaid 流程图与 KaTeX 数学公式渲染、图片粘贴拖拽 base64 内联、导入 .md 文件并导出 Markdown/HTML/PDF，纯浏览器端运行数据绝不上传。',
    icon: '✏️',
    path: '/markdown',
    standalone: true,
    keywords: [
      'markdown 编辑器',
      'markdown 工作台',
      'markdown 多文档',
      'markdown 在线',
      'markdown 预览',
      '在线 md 编辑器',
      'markdown 导出',
      'mermaid 编辑器',
      'markdown 转换',
    ],
    relatedToolIds: ['json-formatter', 'json-to-yaml'],
  },
  {
    id: 'docker-converter',
    name: 'Docker 配置转换',
    description: 'docker run 命令与 docker compose 配置实时互转，支持端口、环境变量、挂载卷等常用 flag',
    seoDescription: '免费在线 Docker Run 与 Compose 互转工具，粘贴 docker run 命令即可实时生成等价的 docker-compose.yml，反向粘贴 Compose 配置也能还原为 run 命令，端口映射、环境变量、挂载卷、重启策略等常用参数双向无损转换，容器部署与配置迁移必备，纯浏览器端解析数据绝不上传。',
    category: '开发与运维',
    icon: '🐳',
    path: '/devops/docker-converter',
    keywords: ['docker run 转 compose', 'docker compose 转 run', 'docker 命令转换', 'compose yaml 生成', 'docker run 转换器', 'docker compose 在线'],
    relatedToolIds: ['docker-run-helper', 'env-converter'],
  },
  {
    id: 'docker-run-helper',
    name: 'Docker Run 命令助手',
    description: '通过表单快速生成 docker run 命令，并提供常用 flag 分类速查表',
    seoDescription: '免费在线 Docker Run 命令生成器，通过表单填写镜像名称、端口映射、环境变量、挂载卷、重启策略等选项即可实时生成可直接复制的 docker run 命令，附带常用 flag 分类速查表与 Nginx、MySQL、Redis 等典型示例，容器入门与部署命令编写必备，纯浏览器端生成数据不上传。',
    category: '开发与运维',
    icon: '🐳',
    path: '/devops/docker-run-helper',
    keywords: ['docker run 生成器', 'docker run 命令', 'docker 容器运行', 'docker run 参数', 'docker run 示例', 'docker 命令速查', 'docker run 在线'],
    relatedToolIds: ['docker-converter', 'env-converter'],
  },
  {
    id: 'env-converter',
    name: '环境变量转换器',
    description: '.env 配置与 JSON 双向互转，支持引号、转义与同文件变量插值',
    seoDescription: '免费在线 .env 与 JSON 互转工具，支持环境变量文件与 JSON 双向实时转换，正确处理单双引号、转义字符与布尔数值类型推断，自动剥离注释行并提示数量，同文件变量插值引用也能识别，前后端配置迁移与 dotenv 排查必备，纯浏览器端解析数据绝不上传。',
    category: '开发与运维',
    icon: '⚙️',
    path: '/devops/env-converter',
    keywords: ['env 转 json', 'json 转 env', '环境变量转换', 'dotenv 解析', 'env 在线转换', '.env 配置转换', '环境变量 json 互转', 'env to json'],
    relatedToolIds: ['docker-converter', 'json-formatter'],
  },
  {
    id: 'meta-tag-generator',
    name: 'Meta 标签生成器',
    description: '填写表单实时生成 Basic / Open Graph / Twitter Card / JSON-LD 标签，附社交分享卡片预览',
    seoDescription: '在线 Meta 标签生成器，填写标题、描述、关键词、URL、预览图，实时生成 Basic、Open Graph、Twitter Card 与 Article/WebSite JSON-LD 结构化数据，并提供 Facebook、X、微信等社交分享卡片可视化预览，浏览器端生成可一键复制。',
    category: '开发与运维',
    icon: '🏷️',
    path: '/devops/meta-tag-generator',
    keywords: ['meta 标签生成', 'open graph 生成', 'og 标签', 'twitter card 生成', 'json-ld 生成', '结构化数据生成', 'seo meta 标签', '社交分享卡片预览', 'og image 尺寸'],
    relatedToolIds: ['docker-converter', 'env-converter'],
  },
  {
    id: 'robots-generator',
    name: 'robots.txt 生成器',
    description: '按 User-agent 分组可视化添加 Allow/Disallow 规则，一键拦截 GPTBot、ClaudeBot 等 AI 训练爬虫，生成标准 robots.txt',
    seoDescription: '在线 robots.txt 生成器，按 User-agent 分组可视化添加 Allow/Disallow 规则，一键禁止 GPTBot、ClaudeBot、Google-Extended 等主流 AI 训练爬虫抓取，配通俗规则解释，纯浏览器端生成可复制下载。',
    category: '开发与运维',
    icon: '🤖',
    path: '/devops/robots-generator',
    keywords: ['robots.txt 生成', 'robots 生成器', '屏蔽 ai 爬虫', '拦截 gptbot', '拦截 claudebot', '拦截 google-extended', 'disallow 规则', 'user-agent 规则', '禁止 ai 抓取', 'seo robots'],
    relatedToolIds: ['sitemap-generator', 'meta-tag-generator'],
  },
  {
    id: 'sitemap-generator',
    name: 'sitemap 生成器',
    description: '逐条或批量粘贴录入 URL，设置更新频率、优先级与最后修改时间，生成标准 sitemap.xml，诚实提示字段有效性',
    seoDescription: '在线 sitemap 生成器，逐条添加或批量粘贴 URL 列表，设置 changefreq、priority 与 lastmod，生成标准 sitemap.xml 可复制下载，并诚实提示 priority/changefreq 已被 Google 忽略、仅 lastmod 有效，纯浏览器端生成。',
    category: '开发与运维',
    icon: '🗺️',
    path: '/devops/sitemap-generator',
    keywords: ['sitemap.xml 生成', 'sitemap 生成器', '网站地图生成', 'sitemap 在线', 'url 列表转 sitemap', 'lastmod', 'changefreq', 'priority', '网站地图在线生成'],
    relatedToolIds: ['robots-generator', 'meta-tag-generator'],
  },
  {
    id: 'redis-config-generator',
    name: 'Redis 配置生成器',
    description: '按硬件画像与使用场景生成带版本标注的 redis.conf，支持单机/主从',
    seoDescription: '在线 Redis 配置文件生成器，按 CPU、内存、磁盘与使用场景实时生成可直接使用的 redis.conf，支持 7.0-8.4 版本联动过滤、单机与主从模式、参数中文说明与官方文档溯源，附带内核参数建议，可一键复制下载，纯浏览器端运算数据不上传。',
    category: '开发与运维',
    icon: '🛢️',
    path: '/devops/redis-config-generator',
    keywords: ['redis 配置生成', 'redis.conf 生成器', 'redis 配置文件', 'redis maxmemory 设置', 'redis 淘汰策略', 'redis 主从配置', 'redis 持久化配置', 'redis 参数优化', 'redis 配置在线'],
    relatedToolIds: ['env-converter', 'docker-run-helper', 'mysql-config-generator', 'postgres-config-generator'],
  },
  {
    id: 'mysql-config-generator',
    name: 'MySQL 配置生成器',
    description: '按内存/磁盘/场景/版本生成带版本标注的 my.cnf，支持单机/主从与 OS 参数建议',
    seoDescription: '在线 MySQL 配置文件生成器，按内存、磁盘、使用场景与并发实时生成可直接使用的 my.cnf，支持 5.7/8.0/8.4 版本联动过滤与废弃参数改名提示、单机与主从模式（server_id 随机种子、GTID）、参数中文说明与官方文档溯源，附带 OS 内核参数建议，纯浏览器端运算数据不上传。',
    category: '开发与运维',
    icon: '🐬',
    path: '/devops/mysql-config-generator',
    keywords: ['mysql 配置生成', 'my.cnf 生成器', 'mysql 配置文件', 'my.cnf 在线生成', 'mysql 配置调优', 'mysql 内存调优', 'mysql 主从配置', 'mysql 5.7 配置', 'mysql 8.0 配置', 'mysql 8.4 配置', 'mysql 参数优化', 'innodb_buffer_pool_size 设置'],
    relatedToolIds: ['redis-config-generator', 'env-converter', 'docker-run-helper', 'postgres-config-generator'],
  },
  {
    id: 'postgres-config-generator',
    name: 'PostgreSQL 配置生成器',
    description: '按内存/CPU/磁盘/场景/版本生成带版本标注的 postgresql.conf，支持单机/主从与 OS 参数建议',
    seoDescription: '在线 PostgreSQL 配置文件生成器，按内存、CPU 核数、磁盘、使用场景与并发实时生成可直接使用的 postgresql.conf，支持 16/17/18 版本联动过滤、单机与主从模式（复制组参数与备库要点）、参数中文说明与官方文档溯源，附带 OS 内核参数建议，纯浏览器端运算数据不上传。',
    category: '开发与运维',
    icon: '🐘',
    path: '/devops/postgres-config-generator',
    keywords: ['postgresql 配置生成', 'postgresql.conf 生成器', 'pg 配置文件', 'postgresql 配置调优', 'postgresql 内存调优', 'postgresql 主从配置', 'pg 16 配置', 'pg 17 配置', 'pg 18 配置', 'postgresql 参数优化', 'shared_buffers 设置', 'work_mem 设置'],
    relatedToolIds: ['mysql-config-generator', 'redis-config-generator', 'docker-run-helper'],
  },
  {
    id: 'qr-code-reader',
    name: '二维码识别器',
    description: '上传、拖拽或 Ctrl+V 粘贴二维码图片，纯浏览器端识别解码，支持 URL/邮箱/电话可点击',
    seoDescription: '免费在线二维码识别工具，支持拖拽上传、点击选择或 Ctrl+V 直接粘贴截图三种方式识读二维码，兼容 PNG、JPG、WebP 等常见图片格式，纯浏览器端本地解码数据绝不上传，识别结果自动区分网址、邮箱、电话与纯文本并提供可点击链接，模糊截图场景即开即用。',
    category: '前端与媒体',
    icon: '📷',
    path: '/frontend/qr-code-reader',
    keywords: ['二维码识别', '二维码解码', 'qr code 识别', '在线扫码', '截图识别二维码', '二维码图片读取'],
    relatedToolIds: ['qr-code-generator'],
  },
  {
    id: 'image-converter',
    name: '图片转换与压缩',
    description: 'PNG / JPG / WebP / AVIF / GIF / BMP 等格式互转与质量压缩、尺寸缩放，支持 SVG / HEIC 导入、EXIF 隐私擦除（无损去除 GPS 与设备信息）和逐图裁切，纯浏览器端本地处理',
    seoDescription: '免费在线图片转换与压缩工具，支持一次最多 30 张批量处理，输出 PNG、JPG、WebP、AVIF、TIFF、GIF、BMP，可读取 SVG、HEIC 等格式导入，自定义质量压缩与尺寸缩放，逐图裁切预览后一键打包 ZIP 下载，内置 EXIF 隐私擦除无损去除 GPS 定位等元数据，纯浏览器端本地处理图片绝不上传。',
    category: '前端与媒体',
    icon: '🗜️',
    path: '/frontend/image-converter',
    keywords: ['图片压缩', '图片格式转换', 'png 转 webp', 'jpg 压缩', '在线图片压缩', '图片缩小', 'webp 转换', '图片体积压缩', 'avif 转换', 'tiff 转 png', '图片转 avif', 'gif 转 png', 'svg 转 png', 'heic 转 jpg', 'heic 转 png', '图片转 gif', '图片转 bmp', 'exif 擦除', '去除 exif', '图片去隐私', '去除 gps 信息', '删除拍摄位置', '元数据清除'],
    relatedToolIds: ['ico-maker', 'base64-to-image', 'qr-code-generator'],
  },
  {
    id: 'ico-maker',
    name: 'ICO 图标制作',
    description: '导入图片裁切创作多尺寸 ICO favicon，支持 ICO 解析提取内嵌 PNG，纯浏览器端',
    seoDescription: '免费在线 ICO 图标制作工具，导入图片裁切创作主体后多选 16 至 256 共 7 档尺寸，一键封装多尺寸 favicon .ico 文件并逐尺寸真实像素预览，可单独导出 PNG；支持解析 ICO/CUR 图标文件并提取内嵌 PNG/BMP 图像，网站 favicon 制作必备，纯浏览器端本地处理图片绝不上传。',
    category: '前端与媒体',
    icon: '🧩',
    path: '/frontend/ico-maker',
    keywords: ['ico 制作', 'favicon 生成', 'png 转 ico', 'ico 转换', 'ico 提取', 'ico 解析', '图标裁切', 'ico 在线'],
    relatedToolIds: ['image-converter', 'base64-to-image'],
  },
  {
    id: 'tester',
    name: '正则表达式',
    description: '实时高亮匹配、查看捕获组，内置邮箱 / 手机号 / URL 等常用正则速查表',
    seoDescription: '免费的在线正则表达式测试工具，支持 g/i/m/s/u/y 六大标志位与命名捕获组，输入即实时高亮全部匹配、显示每个匹配的区间与捕获组内容，内置邮箱 / 手机号 / URL / IPv4 / 身份证号等常用正则速查表一键填入，大文本通过 Web Worker 异步匹配避免 ReDoS，纯浏览器端运算数据不上传。',
    category: '文本与编码',
    icon: '🔬',
    path: '/text/tester',
    keywords: ['正则表达式', '正则表达式测试', '正则在线测试', 'regex 在线', '正则匹配', '正则高亮', '捕获组', '命名捕获组', '正则速查表', 'regex tester', '正则调试', '贪婪匹配', '零宽断言'],
    relatedToolIds: ['json-formatter', 'json-to-ts', 'url', 'base64'],
  },
  {
    id: 'panel',
    name: '颜色面板',
    description: 'HEX/RGB/HSL/HSV 实时互转、WCAG 对比度检查、互补/类似/三角配色板',
    seoDescription: '免费在线颜色面板工具，支持 HEX、RGB、HSL、HSV 多色彩空间数值实时互转并提供直观取色器，内置 WCAG 无障碍对比度检查自动判定 AA/AAA 达标情况，一键生成互补色、类似色与三角配色方案辅助界面配色，前端开发与设计还原必备，纯浏览器端运算数据不上传。',
    category: '前端与媒体',
    icon: '🎨',
    path: '/frontend/panel',
    keywords: ['颜色转换', 'hex rgb 转换', 'hsl hsv', '颜色对照表', 'wcag 对比度', '无障碍颜色检查', '配色方案', '互补色', '调色板', '颜色搭配', 'color picker'],
    relatedToolIds: ['qr-code-generator'],
  },
  {
    id: 'unit-converter',
    name: 'CSS 单位转换器',
    description: 'px / rem / em / vw / vh / % / pt 等 CSS 长度单位实时互转',
    seoDescription: '免费在线 CSS 单位转换工具，支持 px、rem、em、vw、vh、百分比、pt 七种前端常用长度单位实时互转，可自定义根字号、设计稿宽度与视口高度等基准参数，输入即自动联动换算，前端开发与设计稿还原必备助手，纯浏览器端运算数据绝不上传。',
    category: '前端与媒体',
    icon: '📐',
    path: '/frontend/unit-converter',
    keywords: ['px转rem', 'rem转px', 'vw换算', 'vh换算', 'css单位转换', 'em换算', 'pt换算', '前端单位转换'],
    relatedToolIds: ['gradient'],
  },
  {
    id: 'gradient',
    name: 'CSS 渐变生成器',
    description: '可视化创建线性/径向/圆锥渐变并复制 CSS 代码',
    seoDescription: '免费在线 CSS 渐变生成器，支持线性、径向、圆锥三种渐变类型的可视化调色与色标拖动编辑，实时预览效果并一键复制标准 CSS 代码，内置日落、海洋、霓虹等多组精美预设渐变可直接套用，角度与位置参数精确可调，前端界面与海报设计必备，纯浏览器端运算数据绝不上传。',
    category: '前端与媒体',
    icon: '🌈',
    path: '/frontend/gradient',
    keywords: ['css渐变生成器', 'linear-gradient', 'radial-gradient', 'conic-gradient', '渐变代码', 'css渐变工具'],
    relatedToolIds: ['unit-converter'],
  },
  {
    id: 'fake-data-generator',
    name: '假数据生成器',
    description: '按字段配置批量生成姓名、邮箱、手机号、UUID、Lorem 占位文等结构化假数据，输出 JSON 或 CSV',
    seoDescription: '免费在线假数据生成器，可自定义字段类型与列名，批量生成中英文姓名、邮箱、手机号、UUID、IPv4、Lorem 占位文、日期等 15 类结构化测试数据，一键导出 JSON 或 CSV 格式直接用于数据库灌库与接口 Mock，前后端开发测试必备，纯浏览器端生成数据绝不上传。',
    category: '文本与编码',
    icon: '🧪',
    path: '/text/fake-data-generator',
    keywords: ['假数据生成', '测试数据生成', 'mock 数据', '随机姓名生成', '随机邮箱', 'faker', '生成 JSON 测试数据', '生成 CSV 测试数据', 'Lorem ipsum', '造数据'],
    relatedToolIds: ['random-string', 'uuid-generator', 'text-toolbox'],
  },
  {
    id: 'image-scrambler',
    name: '图片混淆',
    description: '可逆块级像素混淆，将图片分块重排为抽象效果并一键还原；还原参数自动写入图片元数据，重新上传即可还原',
    seoDescription: '免费在线图片混淆工具，通过可调块大小（2/4/8/16/32/64/128）对图片进行可逆块级像素重排，可将图片打乱为抽象拼图噪点效果并一键还原；还原参数自动写入 PNG 元数据与文件名，重新上传即可自动还原，输出无损 PNG，纯浏览器端本地处理图片绝不上传。',
    category: '前端与媒体',
    icon: '🔀',
    path: '/frontend/image-scrambler',
    keywords: ['图片混淆', '图片置乱', '图片加密', '像素混淆', '块级置乱', '分块重排', '图片打乱', '图片还原', '图像置乱', 'image scrambling'],
    relatedToolIds: ['image-converter', 'base64-to-image', 'qr-code-generator'],
  },
  {
    id: 'phantom-tank',
    name: '幻影坦克',
    description: '将两张图合成为透明PNG：白底显示表图、黑底显示里图；也支持只上传里图、自动生成反相表图',
    seoDescription: '免费在线幻影坦克生成器，把两张图片合成一张带透明通道的PNG，纯白背景下呈现表图、纯黑背景下呈现里图；也可只上传里图，自动生成反相表图并通过暗化滑块调节黑底清晰度，逐像素计算透明度实现双重显示效果，纯浏览器端本地处理图片绝不上传，社交头像封面趣味图片制作必备。',
    category: '前端与媒体',
    icon: '👻',
    path: '/frontend/phantom-tank',
    keywords: ['幻影坦克', 'phantom tank', 'mirage tank', '双重图片', '透明背景图片', '白底黑底图片', '图片合成', '隐藏图片', '一图双义', '自动生成表图', '单图幻影坦克'],
    relatedToolIds: ['image-converter', 'image-scrambler', 'qr-code-generator'],
  },
  {
    id: 'toml-json-converter',
    name: 'TOML 与 JSON 互转',
    description: 'TOML 与 JSON 双向实时互转，支持美化与紧凑输出，纯浏览器端运算',
    seoDescription: '在线 TOML 与 JSON 双向互转工具，输入 TOML 实时生成 JSON、输入 JSON 实时生成 TOML，支持美化与紧凑输出，Rust Cargo.toml 与 pyproject.toml 配置转换必备，纯浏览器端运算数据不上传。',
    category: '格式化与转换',
    icon: '🧩',
    path: '/format/toml-json-converter',
    keywords: ['toml 转 json', 'json 转 toml', 'toml json 互转', 'toml to json', 'cargo.toml 转 json', 'pyproject.toml 转 json', '在线 toml 转换'],
    relatedToolIds: ['toml-yaml-converter', 'toml-formatter', 'json-formatter', 'json-to-yaml'],
  },
  {
    id: 'toml-yaml-converter',
    name: 'TOML 与 YAML 互转',
    description: 'TOML 与 YAML 双向实时互转，支持 2/4 空格缩进，纯浏览器端运算',
    seoDescription: '免费在线 TOML 与 YAML 双向互转工具，输入 TOML 实时生成 YAML、输入 YAML 实时还原 TOML，支持 2/4 空格缩进风格切换与嵌套结构自动对齐，转换结果可并排对照查看，GitHub Actions 与 Cargo/pyproject 配置迁移必备，纯浏览器端解析数据绝不上传。',
    category: '格式化与转换',
    icon: '🧬',
    path: '/format/toml-yaml-converter',
    keywords: ['toml 转 yaml', 'yaml 转 toml', 'toml yaml 互转', 'toml to yaml', 'cargo.toml 转 yaml', '配置格式转换', '在线 toml yaml'],
    relatedToolIds: ['toml-json-converter', 'toml-formatter', 'json-to-yaml'],
  },
  {
    id: 'toml-formatter',
    name: 'TOML 格式化器',
    description: '在线 TOML 语法校验与格式美化工具，统一缩进与键值格式',
    seoDescription: '免费在线 TOML 格式化与校验工具，一键美化 TOML 配置的缩进空格与键值等号对齐，同时进行语法校验并精确定位错误行列号，支持表格、数组与内联表等全部语法元素，Rust Cargo.toml 与 Python pyproject.toml 编写维护必备，纯浏览器端解析数据绝不上传。',
    category: '格式化与转换',
    icon: '🧹',
    path: '/format/toml-formatter',
    keywords: ['toml 格式化', 'toml 美化', 'toml 校验', 'toml 格式', 'toml formatter', 'cargo.toml 格式化', 'pyproject.toml 校验'],
    relatedToolIds: ['toml-json-converter', 'toml-yaml-converter', 'json-formatter'],
  },
  {
    id: 'wheel-picker',
    name: '转盘抽奖',
    description: '自定义选项的在线转盘抽奖与随机抽签工具，支持批量导入、权重、不重复抽取与配置分享',
    seoDescription: '免费在线转盘抽奖与随机抽签工具，自定义选项并批量粘贴导入，Canvas 彩色转盘配合缓动动画旋转指向结果，支持为选项设置权重调整中奖概率、不重复抽取（中奖自动移出可恢复），并可将转盘配置编码到链接一键分享，他人打开即用同款转盘，纯浏览器端运算数据不上传。',
    category: '文本与编码',
    icon: '🎡',
    path: '/text/wheel-picker',
    keywords: ['转盘抽奖', '在线抽签', '随机抽签', '随机选择器', '幸运转盘', '决策转盘', '随机点名', '抽奖转盘', 'wheel picker', 'random picker'],
    relatedToolIds: ['random-string', 'uuid-generator', 'fake-data-generator'],
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

/** 按分类分组工具列表（独立工作台工具不归属分类，不参与分组） */
export function getToolsByCategory(): Record<ToolCategory, ToolMeta[]> {
  return tools.reduce(
    (acc, tool) => {
      if (!tool.category) return acc;
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<ToolCategory, ToolMeta[]>,
  );
}

/** 获取独立工作台形态的工具（Sidebar 一级菜单入口来源，按注册顺序） */
export function getStandaloneTools(): ToolMeta[] {
  return tools.filter((t) => t.standalone);
}

/** 获取所有分类（去重，保持注册顺序；独立工作台工具无分类，不参与） */
export function getCategories(): ToolCategory[] {
  const seen = new Set<ToolCategory>();
  return tools.reduce<ToolCategory[]>((acc, t) => {
    if (t.category && !seen.has(t.category)) {
      seen.add(t.category);
      acc.push(t.category);
    }
    return acc;
  }, []);
}

/** 获取指定工具的相关工具列表（最多 4 个，过滤无效 ID） */
export function getRelatedTools(toolId: string): ToolMeta[] {
  const tool = getToolById(toolId);
  if (!tool || !tool.relatedToolIds.length) return [];
  return tool.relatedToolIds
    .map((id) => getToolById(id))
    .filter((t): t is ToolMeta => t !== undefined)
    .slice(0, 4);
}
