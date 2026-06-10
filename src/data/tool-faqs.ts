/** FAQ 条目 */
export interface FaqItem {
  /** 问题 */
  question: string;
  /** 答案（支持简单 HTML 标签如 <code>、<strong>） */
  answer: string;
}

/** 按工具 ID（短 ID，如 'base64'）索引的 FAQ 数据 */
const toolFaqs: Record<string, FaqItem[]> = {
  base64: [
    {
      question: 'Base64 是加密吗？',
      answer: '不是。Base64 是一种<strong>编码方式</strong>，不是加密算法。编码后的数据可以直接解码还原，不提供任何安全保护。如果需要安全传输，请使用加密工具。',
    },
    {
      question: 'Base64 编码后数据会变大多少？',
      answer: 'Base64 编码后数据体积会增加约 <strong>33%</strong>。每 3 个字节的原始数据会被编码为 4 个 Base64 字符，因此编码结果比原始数据大约三分之一。',
    },
    {
      question: 'Base64 支持中文吗？',
      answer: '支持。Base64 可以编码任何二进制数据，包括中文。编码前会先将中文字符转为 UTF-8 字节序列，再将字节序列进行 Base64 编码。',
    },
    {
      question: 'Data URI (Base64 图片) 是什么？',
      answer: 'Data URI 是将文件内容以 Base64 编码后直接嵌入到 HTML/CSS 中的格式，形如 <code>data:image/png;base64,...</code>。适用于小图标等场景，但会增大文件体积，不建议用于大图片。',
    },
  ],
  'url-encode': [
    {
      question: 'encodeURI 和 encodeURIComponent 有什么区别？',
      answer: '<code>encodeURI</code> 用于编码完整 URL，不会编码 <code>:/?#[]@!$&\'()*+,;=</code> 等 URL 保留字符。<code>encodeURIComponent</code> 用于编码 URL 参数值，会编码所有特殊字符。一般规则：编码整体 URL 用前者，编码参数值用后者。',
    },
    {
      question: 'URL 编码是如何处理中文的？',
      answer: '中文字符会先被转换为 UTF-8 字节序列，然后每个字节以 <code>%XX</code> 的形式表示。例如"你好"编码后变为 <code>%E4%BD%A0%E5%A5%BD</code>。',
    },
    {
      question: 'URL 编码和解码有什么用？',
      answer: 'URL 编码确保特殊字符（中文、空格、& 等）在 URL 中安全传输。解码则将 <code>%XX</code> 格式还原为原始字符。常用于处理 URL 参数中的特殊字符。',
    },
  ],
  'jwt-parser': [
    {
      question: 'JWT 的三个部分分别是什么？',
      answer: 'JWT 由三部分组成，用点号分隔：<strong>Header</strong>（令牌类型和签名算法）、<strong>Payload</strong>（声明数据，如用户 ID、过期时间）、<strong>Signature</strong>（对前两部分的签名，用于验证数据未被篡改）。',
    },
    {
      question: 'JWT 安全吗？',
      answer: 'JWT 本身不加密数据，Payload 部分仅做 Base64 编码，<strong>任何人都能读取</strong>。安全性依赖签名验证和 HTTPS 传输。不要在 Payload 中存放敏感信息（如密码）。',
    },
    {
      question: '如何验证 JWT 签名？',
      answer: '本工具支持 <strong>HMAC</strong>（HS256/HS384/HS512）对称签名验证。将 JWT 和密钥粘贴到对应输入框中，工具会自动计算签名并与 JWT 中的签名进行比对，验证数据是否被篡改。',
    },
    {
      question: 'JWT 的过期时间怎么看？',
      answer: 'JWT Payload 中的 <code>exp</code> 字段表示过期时间，值为 Unix 时间戳（秒）。解码后在 Payload 中查看该字段，对比当前时间即可判断是否过期。常见字段还有 <code>iat</code>（签发时间）和 <code>nbf</code>（生效时间）。',
    },
  ],
  'json-to-xml': [
    {
      question: '如何生成 XML 属性？',
      answer: '在 JSON 对象中使用 <code>_attributes</code> 键，其值为属性对象。例如 <code>{ "user": { "_attributes": { "id": "123" }, "name": "Alice" } }</code> 会转换为 <code>&lt;user id="123"&gt;&lt;name&gt;Alice&lt;/name&gt;&lt;/user&gt;</code>。属性值支持字符串、数字和布尔值。',
    },
    {
      question: '支持多大的 JSON 文件？',
      answer: '本工具在浏览器端运行，输入大小限制为 <strong>10MB</strong>。超过 500KB 的文件会通过 Web Worker 异步处理，避免阻塞页面。',
    },
  ],
  'json-formatter': [
    {
      question: '支持多大的 JSON 文件？',
      answer: '本工具在浏览器端运行，一般可以处理 <strong>数 MB</strong> 大小的 JSON 文件。具体限制取决于浏览器可用内存。超大文件建议使用桌面端工具处理。',
    },
    {
      question: 'JSON Path 查询是什么？',
      answer: 'JSON Path 是一种查询语言，用于从 JSON 数据中提取特定节点。例如 <code>$.store.book[0].title</code> 可以提取第一本书的标题。支持过滤、切片等高级语法。',
    },
    {
      question: 'JSON 压缩有什么用？',
      answer: 'JSON 压缩会移除所有空白字符（空格、换行、缩进），将 JSON 压缩为单行。适用于<strong>减小文件体积</strong>和网络传输场景，但可读性较差。配合格式化工具可随时还原。',
    },
  ],
  'hash-generator': [
    {
      question: '哈希值可以反解出原文吗？',
      answer: '<strong>不可以</strong>。哈希是单向函数，从哈希值无法还原出原始数据。验证方式是对比哈希值：对相同输入使用相同算法，如果哈希值一致则说明数据相同。',
    },
    {
      question: 'MD5 还安全吗？',
      answer: 'MD5 已被证明存在<strong>碰撞漏洞</strong>（不同的输入可以产生相同的哈希值），不适合用于安全场景（如密码存储、数字签名）。建议使用 SHA-256 或更强的算法。MD5 目前主要用于文件校验等非安全场景。',
    },
    {
      question: 'SHA-256 和 SHA-512 有什么区别？',
      answer: 'SHA-256 产生 <strong>256 位</strong>（32 字节）哈希值，SHA-512 产生 <strong>512 位</strong>（64 字节）哈希值。SHA-512 安全性更高但运算量更大。对于大多数应用，SHA-256 已经足够安全。',
    },
    {
      question: '哈希和加密有什么区别？',
      answer: '哈希是<strong>单向</strong>的，无法从结果还原原文，常用于数据完整性校验。加密是<strong>双向</strong>的，使用密钥可以还原原文，常用于数据保密传输。',
    },
  ],
  'uuid-generator': [
    {
      question: 'UUID 和 GUID 有什么区别？',
      answer: 'UUID（通用唯一标识符）和 GUID（全局唯一标识符）本质上是<strong>同一个概念</strong>。GUID 是微软对 UUID 的叫法，格式完全相同。UUID 是 RFC 4122 标准术语。',
    },
    {
      question: 'UUID v4 是什么？',
      answer: 'UUID v4 是最常用的版本，通过<strong>随机数</strong>生成。总共 128 位中有 122 位是随机的，碰撞概率极低（约 2³⁶ 之一），适合大多数不需要严格排序的场景。',
    },
    {
      question: 'UUID 会重复吗？',
      answer: '理论上可能，但实际上<strong>几乎不可能</strong>。以 v4 为例，生成 10 亿个 UUID 后出现重复的概率约为 0.00000000006%。日常使用中可以认为 UUID 是唯一的。',
    },
  ],
  'symmetric-crypto': [
    {
      question: 'AES 和 SM4 有什么区别？',
      answer: 'AES 是<strong>国际标准</strong>的对称加密算法，密钥长度支持 128/192/256 位。SM4 是<strong>中国国家标准</strong>（国密），密钥长度固定 128 位。两者安全性相当，AES 在国际场景更通用，SM4 在国内合规场景中使用。',
    },
    {
      question: 'CBC 和 GCM 模式有什么区别？',
      answer: 'CBC 模式只提供<strong>保密性</strong>（加密），需要额外的 HMAC 来验证完整性。GCM 模式同时提供<strong>保密性和完整性</strong>（认证加密），是更现代的推荐方案。新项目建议优先使用 GCM 模式。',
    },
    {
      question: '密钥应该怎么保管？',
      answer: '加密密钥不应硬编码在代码中或提交到版本库。推荐使用环境变量、密钥管理服务（如 AWS KMS、HashiCorp Vault）或安全的配置中心来保管密钥。本工具仅在浏览器本地运算，密钥不会上传到任何服务器。',
    },
  ],
  'qr-code-generator': [
    {
      question: '容错级别怎么选择？',
      answer: 'QR 码有 4 个容错级别：<strong>L（7%）</strong>适合清晰环境，<strong>M（15%）</strong>日常使用推荐，<strong>Q（25%）</strong>适合可能被遮挡的场景，<strong>H（30%）</strong>适合添加 Logo 或恶劣环境。容错级别越高，二维码越密集。',
    },
    {
      question: '二维码最大支持多少字符？',
      answer: 'QR 码最大容量取决于版本和编码模式：数字最多 <strong>7,089</strong> 个字符，字母数字最多 <strong>4,296</strong> 个，汉字最多 <strong>1,817</strong> 个。实际容量会因容错级别而减少。',
    },
    {
      question: 'SVG 和 PNG 格式有什么区别？',
      answer: '<strong>PNG</strong> 是位图格式，固定分辨率，放大后模糊，适合直接使用。<strong>SVG</strong> 是矢量格式，任意缩放都清晰，文件体积通常更小，适合印刷和高分辨率场景。',
    },
  ],
  'cron-parser': [
    {
      question: '五位和七位 Cron 表达式有什么区别？',
      answer: '<strong>五位</strong>格式：分 时 日 月 周（标准 Linux crontab）。<strong>七位</strong>格式在前后各加一位：秒 分 时 日 月 周 年（Spring、Quartz 等框架使用）。本工具支持两种格式。',
    },
    {
      question: 'Cron 表达式中的特殊字符有哪些？',
      answer: '<code>*</code>（任意值）、<code>?</code>（不指定，仅日和周）、<code>-</code>（范围，如 1-5）、<code>,</code>（枚举，如 1,3,5）、<code>/</code>（步长，如 */5 表示每 5 个单位）、<code>L</code>（最后，如月中最后一天）、<code>W</code>（最近工作日）。',
    },
    {
      question: 'Cron 表达式常见的错误有哪些？',
      answer: '常见错误包括：日和周同时指定了非 <code>?</code> 的值（互斥）、月份或星期写错（星期 0-7 中 0 和 7 都代表周日）、步长 <code>/</code> 前缺省起始值。本工具会自动检测并提示错误。',
    },
  ],
  'http-status-codes': [
    {
      question: '301 和 302 重定向有什么区别？',
      answer: '<strong>301</strong> 表示永久重定向，搜索引擎会将权重转移到新地址。<strong>302</strong> 表示临时重定向，搜索引擎仍保留原地址。如果网站永久搬迁，使用 301；如果是临时跳转（如维护页面），使用 302。',
    },
    {
      question: '429 状态码是什么意思？',
      answer: '<strong>429 Too Many Requests</strong> 表示客户端在给定时间内发送了过多请求（触发限流）。通常需要等待一段时间后重试，或根据响应头中的 <code>Retry-After</code> 字段确定重试时间。',
    },
  ],
};

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
