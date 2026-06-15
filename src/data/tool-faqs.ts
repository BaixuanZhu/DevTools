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
  ],
  'file-to-base64': [
    {
      question: '文件转 Base64 后体积会变大多少？',
      answer: '约增大 <strong>33%</strong>。Base64 按「每 3 字节编码为 4 字符」，因此编码结果比原文件大约三分之一。例如 30MB 的文件编码后约 40MB。',
    },
    {
      question: 'Data URI 前缀什么时候需要开启？',
      answer: '当你要把文件内容直接嵌入 HTML/CSS/JS 时（如 <code>&lt;img src="data:image/png;base64,..."&gt;</code>），需开启以生成 <code>data:&lt;mime&gt;;base64,...</code> 格式。仅需要纯 Base64 字符串（如 API 传输、存储）时关闭即可。',
    },
    {
      question: '为什么有文件大小限制？',
      answer: 'Base64 结果需作为字符串常驻内存供复制与下载，过大字符串会占用大量内存并可能导致页面卡顿。本工具采用<strong>异步分块编码</strong>避免阻塞主线程，但仍设上限以保证体验。',
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
    {
      question: 'HMAC 和普通哈希有什么区别？',
      answer: '普通哈希（如 SHA-256）<strong>不需要密钥</strong>，任何人都能对相同输入算出相同结果，仅用于完整性校验。HMAC 是<strong>带密钥</strong>的哈希，只有持有密钥的一方才能生成或验证签名，常用于 API 签名（如 AWS SigV4）和 Webhook 校验（如 GitHub / Stripe），既能校验完整性又能确认来源。',
    },
    {
      question: '为什么我的 Webhook 签名验证不通过？',
      answer: '常见三大坑：①<strong>密钥编码选错</strong>——若密钥本身是 Hex 或 Base64 字节串，需在「密钥编码」处选对应编码，不能当文本输入；②<strong>消息不是原文</strong>——Webhook 签名是对原始请求体字节算的，复制粘贴时若被格式化、加空格或转码就会对不上，建议从抓包工具取原始 body；③<strong>签名带了前缀</strong>——如 GitHub 的 <code>sha256=</code>，本工具会自动剥离 <code>sha***=</code> 前缀与首尾空白、容忍大小写，无需手动处理。',
    },
    {
      question: '为什么不支持 HMAC-MD5？',
      answer: 'MD5 本身已不安全，HMAC-MD5 在实际工程中几乎不再使用，主流 Webhook 与 API 签名均采用 HMAC-SHA256 及以上。本工具仅支持 HMAC-SHA-1 / SHA-256 / SHA-384 / SHA-512，与 Web Crypto 原生能力一致。',
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
  'markdown-editor': [
    {
      question: '什么是 Markdown？',
      answer: 'Markdown 是一种<strong>轻量级标记语言</strong>，用简洁的纯文本语法编写文档，可转换为 HTML 等格式。广泛用于技术文档、README、博客和笔记等场景。',
    },
    {
      question: '支持哪些 Markdown 扩展语法？',
      answer: '除标准 Markdown 语法外，本工具支持<strong>表格</strong>、<strong>任务列表</strong>（<code>- [ ]</code>）、<strong>删除线</strong>（<code>~~文本~~</code>）和<strong>代码块语法高亮</strong>等 GFM（GitHub Flavored Markdown）扩展。',
    },
    {
      question: '如何导出为 PDF？',
      answer: '点击"导出 PDF"按钮后会调用浏览器的打印功能。在打印对话框中选择"另存为 PDF"即可。导出内容只包含预览区域，不包含编辑器和工具栏。',
    },
    {
      question: '数据安全吗？',
      answer: '所有编辑和渲染在<strong>浏览器本地完成</strong>，Markdown 内容不会上传到任何服务器。关闭页面后数据自动清除。',
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
  'docker-converter': [
    {
      question: 'docker run 的 `--rm` flag 在 compose 中如何表示？',
      answer: 'Compose v2 规范中没有直接等价的字段。转换时会以注释形式保留，提醒你 compose 默认使用 <code>docker compose up/down</code> 管理容器生命周期，不需要 <code>--rm</code>。',
    },
    {
      question: '为什么有些 flag 被注释掉了？',
      answer: '当前工具尚未支持所有 docker run flag，不支持的 flag 会以注释形式保留在输出中，确保信息不丢失。后续版本会逐步扩展支持范围。',
    },
    {
      question: 'compose → run 转换只处理第一个 service 吗？',
      answer: '是的。<code>docker run</code> 命令只能启动单个容器，所以 compose → run 方向会转换第一个 service。如果有多个 service，其余 service 的配置会以注释形式附加在输出末尾供参考。',
    },
    {
      question: '生成的 compose 文件不写 <code>version</code> 字段吗？',
      answer: '不写。自 Docker Compose v2 起，<code>version</code> 字段已弃用，当前推荐做法是不指定 version，使用最新的 Compose 规范格式。',
    },
  ],
  'qr-code-reader': [
    {
      question: '为什么识别失败？',
      answer: '常见原因：图片<strong>模糊</strong>、二维码<strong>残缺或被遮挡</strong>、二维码在图中<strong>占比过小</strong>、或是非标准 QR 码（如某些艺术变形码）。建议截取二维码主体区域、放大后重新识别。本工具会在解码前将图片长边缩放至 1024px，过小的二维码反而可能因缩放丢失细节。',
    },
    {
      question: '支持哪些图片格式？',
      answer: '支持浏览器可解码的所有常见格式：<strong>PNG / JPG / WebP / BMP / GIF（取首帧）</strong>等。可直接拖拽文件、点击选择，或用 <code>Ctrl+V</code> 粘贴截图。单张图片上限 <strong>10MB</strong>。',
    },
  ],
  'ipv6-cidr': [
    {
      question: 'IPv6 为什么没有广播地址？',
      answer: 'IPv6 用<strong>组播（Multicast）</strong>替代了 IPv4 的广播机制，不再需要专门的广播地址字段。需要一对多通信时使用组播地址（<code>ff00::/8</code>），因此 IPv6 子网里没有「广播地址」这一概念。',
    },
    {
      question: 'IPv6 的 /64 是什么意思？',
      answer: '<code>/64</code> 是 IPv6 最常见的子网前缀长度：前 64 位为网络前缀，后 64 位为接口标识符，是终端网段的标准长度。一个 /64 子网包含 <strong>2⁶⁴（约 1.8×10¹⁹）</strong>个地址，远超 IPv4 全部地址空间。',
    },
    {
      question: '为什么同时显示压缩和展开两种格式？',
      answer: '<strong>压缩格式</strong>（如 <code>2001:db8::</code>）省略连续零段，便于阅读和书写；<strong>展开格式</strong>（8 组 4 位十六进制，如 <code>2001:0db8:0000:...</code>）便于程序处理和逐段定位。两者各有用途，工具同时展示并可分别复制。',
    },
    {
      question: 'IPv6 地址有哪些类型？',
      answer: '常见类型：<strong>全球单播</strong>（<code>2000::/3</code>，公网可路由）、<strong>链路本地</strong>（<code>fe80::/10</code>，仅本网段）、<strong>唯一本地 ULA</strong>（<code>fc00::/7</code>，内网）、<strong>组播</strong>（<code>ff00::/8</code>）、<strong>环回</strong>（<code>::1</code>）。输入地址后工具会自动识别类型。',
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
