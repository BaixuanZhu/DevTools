/**
 * HTTP 状态码静态数据
 * 涵盖 RFC 7231、6585、7538、7725、8297、8470 等规范中定义的常见状态码。
 */

/** 状态码分类键 */
export type StatusCategory = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

/** 分类元数据 */
export interface StatusCategoryMeta {
  /** 分类键 */
  key: StatusCategory;
  /** 中文分类名 */
  label: string;
}

/** 单条状态码数据 */
export interface HttpStatusEntry {
  /** 状态码数值 */
  code: number;
  /** 英文名称 */
  name: string;
  /** 中文描述 */
  description: string;
  /** 所属分类 */
  category: StatusCategory;
  /** 规范来源（可选） */
  spec?: string;
}

/** 状态码分类元数据列表 */
export const STATUS_CATEGORIES: StatusCategoryMeta[] = [
  { key: '1xx', label: '信息响应' },
  { key: '2xx', label: '成功响应' },
  { key: '3xx', label: '重定向' },
  { key: '4xx', label: '客户端错误' },
  { key: '5xx', label: '服务器错误' },
];

/** 全部 HTTP 状态码数据 */
export const HTTP_STATUSES: HttpStatusEntry[] = [
  // ===== 1xx 信息响应 =====
  { code: 100, name: 'Continue', description: '服务器已收到请求的初始部分，客户端应继续发送剩余内容', category: '1xx', spec: 'RFC 7231' },
  { code: 101, name: 'Switching Protocols', description: '服务器同意切换协议，如从 HTTP 升级到 WebSocket', category: '1xx', spec: 'RFC 7231' },
  { code: 102, name: 'Processing', description: '服务器已收到请求并正在处理，但尚未完成（WebDAV）', category: '1xx', spec: 'RFC 2518' },
  { code: 103, name: 'Early Hints', description: '服务器在最终响应前返回一些头信息，用于预加载资源', category: '1xx', spec: 'RFC 8297' },

  // ===== 2xx 成功响应 =====
  { code: 200, name: 'OK', description: '请求成功，响应体包含请求的数据', category: '2xx', spec: 'RFC 7231' },
  { code: 201, name: 'Created', description: '请求成功且服务器创建了新资源，常用于 POST 请求', category: '2xx', spec: 'RFC 7231' },
  { code: 202, name: 'Accepted', description: '请求已接受但尚未处理完成，常用于异步任务', category: '2xx', spec: 'RFC 7231' },
  { code: 203, name: 'Non-Authoritative Information', description: '返回的元信息来自本地或第三方副本，而非原始服务器', category: '2xx', spec: 'RFC 7231' },
  { code: 204, name: 'No Content', description: '请求成功但响应体不包含内容，常用于 DELETE 操作', category: '2xx', spec: 'RFC 7231' },
  { code: 205, name: 'Reset Content', description: '请求成功，要求客户端重置文档视图（清空表单）', category: '2xx', spec: 'RFC 7231' },
  { code: 206, name: 'Partial Content', description: '服务器已成功处理部分 GET 请求，用于断点续传', category: '2xx', spec: 'RFC 7233' },
  { code: 207, name: 'Multi-Status', description: '多个操作的结果以 XML 格式返回（WebDAV）', category: '2xx', spec: 'RFC 4918' },
  { code: 208, name: 'Already Reported', description: 'DAV 绑定已在之前的多状态响应中报告过（WebDAV）', category: '2xx', spec: 'RFC 5842' },
  { code: 226, name: 'IM Used', description: '服务器已对资源应用实例操作并返回结果', category: '2xx', spec: 'RFC 3229' },

  // ===== 3xx 重定向 =====
  { code: 300, name: 'Multiple Choices', description: '请求的资源有多个可选表示形式，需用户或客户端选择', category: '3xx', spec: 'RFC 7231' },
  { code: 301, name: 'Moved Permanently', description: '资源已永久移动到新 URL，浏览器会缓存重定向', category: '3xx', spec: 'RFC 7231' },
  { code: 302, name: 'Found', description: '资源临时从不同 URI 响应，客户端应继续使用原 URI', category: '3xx', spec: 'RFC 7231' },
  { code: 303, name: 'See Other', description: '响应可在另一个 URI 用 GET 方法获取，用于 POST 后重定向', category: '3xx', spec: 'RFC 7231' },
  { code: 304, name: 'Not Modified', description: '资源未修改，客户端应使用缓存副本', category: '3xx', spec: 'RFC 7232' },
  { code: 305, name: 'Use Proxy', description: '请求的资源必须通过代理访问（已被废弃）', category: '3xx', spec: 'RFC 7231' },
  { code: 306, name: 'Unused', description: '保留状态码，当前未使用', category: '3xx', spec: 'RFC 7231' },
  { code: 307, name: 'Temporary Redirect', description: '临时重定向，要求客户端保持原请求方法', category: '3xx', spec: 'RFC 7231' },
  { code: 308, name: 'Permanent Redirect', description: '永久重定向，要求客户端保持原请求方法', category: '3xx', spec: 'RFC 7538' },

  // ===== 4xx 客户端错误 =====
  { code: 400, name: 'Bad Request', description: '请求格式错误或参数无效，服务器无法理解', category: '4xx', spec: 'RFC 7231' },
  { code: 401, name: 'Unauthorized', description: '请求需要身份认证，需提供有效的凭据', category: '4xx', spec: 'RFC 7235' },
  { code: 402, name: 'Payment Required', description: '需要付款后才能访问该资源（保留供将来使用）', category: '4xx', spec: 'RFC 7231' },
  { code: 403, name: 'Forbidden', description: '服务器理解请求但拒绝执行，身份认证也无济于事', category: '4xx', spec: 'RFC 7231' },
  { code: 404, name: 'Not Found', description: '服务器无法找到请求的资源，可能是 URL 错误或资源已删除', category: '4xx', spec: 'RFC 7231' },
  { code: 405, name: 'Method Not Allowed', description: '请求方法不被目标资源支持，如对只读资源使用 POST', category: '4xx', spec: 'RFC 7231' },
  { code: 406, name: 'Not Acceptable', description: '服务器无法返回符合客户端 Accept 头要求的内容格式', category: '4xx', spec: 'RFC 7231' },
  { code: 407, name: 'Proxy Authentication Required', description: '客户端需先通过代理服务器的身份认证', category: '4xx', spec: 'RFC 7235' },
  { code: 408, name: 'Request Timeout', description: '服务器等待请求超时，客户端可重新发送请求', category: '4xx', spec: 'RFC 7231' },
  { code: 409, name: 'Conflict', description: '请求与服务器当前状态冲突，如编辑冲突或重复创建', category: '4xx', spec: 'RFC 7231' },
  { code: 410, name: 'Gone', description: '资源已永久删除且无转发地址，不同于 404', category: '4xx', spec: 'RFC 7231' },
  { code: 411, name: 'Length Required', description: '服务器要求请求包含 Content-Length 头', category: '4xx', spec: 'RFC 7231' },
  { code: 412, name: 'Precondition Failed', description: '客户端的头字段条件验证失败', category: '4xx', spec: 'RFC 7232' },
  { code: 413, name: 'Content Too Large', description: '请求体超过服务器愿意或能够处理的大小', category: '4xx', spec: 'RFC 7231' },
  { code: 414, name: 'URI Too Long', description: '请求的 URL 超过服务器能够处理的长度', category: '4xx', spec: 'RFC 7231' },
  { code: 415, name: 'Unsupported Media Type', description: '请求体的媒体格式不被服务器支持', category: '4xx', spec: 'RFC 7231' },
  { code: 416, name: 'Range Not Satisfiable', description: '请求的 Range 头指定的范围无法满足', category: '4xx', spec: 'RFC 7233' },
  { code: 417, name: 'Expectation Failed', description: '服务器无法满足 Expect 头字段的要求', category: '4xx', spec: 'RFC 7231' },
  { code: 418, name: "I'm a Teapot", description: '服务器拒绝煮咖啡（超文本咖啡壶控制协议，彩蛋）', category: '4xx', spec: 'RFC 2324' },
  { code: 421, name: 'Misdirected Request', description: '请求被发送到无法生成响应的服务器（HTTP/2）', category: '4xx', spec: 'RFC 7540' },
  { code: 422, name: 'Unprocessable Content', description: '请求格式正确但因语义错误无法处理（WebDAV）', category: '4xx', spec: 'RFC 4918' },
  { code: 423, name: 'Locked', description: '请求的资源被锁定，无法操作（WebDAV）', category: '4xx', spec: 'RFC 4918' },
  { code: 424, name: 'Failed Dependency', description: '因前一个请求失败导致当前请求无法完成（WebDAV）', category: '4xx', spec: 'RFC 4918' },
  { code: 425, name: 'Too Early', description: '服务器不愿处理可能被重放的请求（TLS 1.3）', category: '4xx', spec: 'RFC 8470' },
  { code: 426, name: 'Upgrade Required', description: '客户端需切换到服务器指定的协议版本', category: '4xx', spec: 'RFC 7231' },
  { code: 428, name: 'Precondition Required', description: '服务器要求请求包含条件头字段以避免冲突', category: '4xx', spec: 'RFC 6585' },
  { code: 429, name: 'Too Many Requests', description: '客户端在给定时间内发送了过多请求（限流）', category: '4xx', spec: 'RFC 6585' },
  { code: 431, name: 'Request Header Fields Too Large', description: '请求头字段过大，服务器拒绝处理', category: '4xx', spec: 'RFC 6585' },
  { code: 451, name: 'Unavailable For Legal Reasons', description: '因法律原因无法提供该资源，如政府审查', category: '4xx', spec: 'RFC 7725' },

  // ===== 5xx 服务器错误 =====
  { code: 500, name: 'Internal Server Error', description: '服务器内部发生未知错误，无法完成请求', category: '5xx', spec: 'RFC 7231' },
  { code: 501, name: 'Not Implemented', description: '服务器不支持请求的方法，无法处理', category: '5xx', spec: 'RFC 7231' },
  { code: 502, name: 'Bad Gateway', description: '网关或代理服务器从上游收到无效响应', category: '5xx', spec: 'RFC 7231' },
  { code: 503, name: 'Service Unavailable', description: '服务器暂时无法处理请求，通常因过载或维护', category: '5xx', spec: 'RFC 7231' },
  { code: 504, name: 'Gateway Timeout', description: '网关或代理服务器等待上游响应超时', category: '5xx', spec: 'RFC 7231' },
  { code: 505, name: 'HTTP Version Not Supported', description: '服务器不支持请求中使用的 HTTP 版本', category: '5xx', spec: 'RFC 7231' },
  { code: 506, name: 'Variant Also Negotiates', description: '透明内容协商导致循环配置错误', category: '5xx', spec: 'RFC 2295' },
  { code: 507, name: 'Insufficient Storage', description: '服务器存储空间不足，无法完成请求（WebDAV）', category: '5xx', spec: 'RFC 4918' },
  { code: 508, name: 'Loop Detected', description: '服务器检测到处理请求时出现无限循环（WebDAV）', category: '5xx', spec: 'RFC 5842' },
  { code: 510, name: 'Not Extended', description: '服务器需要对请求进行进一步扩展才能处理', category: '5xx', spec: 'RFC 2774' },
  { code: 511, name: 'Network Authentication Required', description: '客户端需进行网络认证才能获得访问权限', category: '5xx', spec: 'RFC 6585' },
];
