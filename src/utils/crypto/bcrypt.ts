/**
 * BCrypt 纯逻辑层：盐生成、bcrypt base64 编码、哈希解析与格式校验。
 *
 * 全部为无 DOM / Worker 依赖的纯函数（generateSalt 依赖 Web Crypto 随机源，
 * Node ≥ 22 与浏览器均有 globalThis.crypto），供 BcryptTool.vue 与
 * bcrypt.worker.ts 复用，可直接被 vitest 覆盖。
 *
 * 慢计算（hashSync/compareSync）不放本层——见 bcrypt.worker.ts。
 */

/** bcrypt 自定义 base64 字母表（crypt 风格 "./A-Za-z0-9"，非标准 Base64） */
export const BCRYPT_BASE64_ALPHABET =
  './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * UI 可选 cost 档位下限。
 *
 * bcrypt 规范允许 4–31，但纯 JS 实现下 cost 每加 1 耗时翻倍，
 * 15 已是数十秒量级，更高档位浏览器端不可用，故 UI 上限取 15（COST_MAX）。
 */
export const COST_MIN = 4;

/** UI 可选 cost 档位上限（规范上限 31，浏览器纯 JS 实用上限） */
export const COST_MAX = 15;

/** 默认 cost 因子（业界存储口令的常用默认值） */
export const COST_DEFAULT = 10;

/** 合法 bcrypt 哈希总长度：`$2a$10$`（7 字符）+ 22 字符盐 + 31 字符校验和 */
export const BCRYPT_HASH_LENGTH = 60;

/** bcrypt 密码截断阈值（字节）：超出部分参与运算前被静默丢弃 */
export const PASSWORD_MAX_BYTES = 72;

/** 合法 bcrypt 哈希整体正则：$2x$ + 两位 cost + $ + 53 个 bcrypt base64 字符 */
const BCRYPT_HASH_RE = /^\$(2[abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;

/** parseBcryptHash 的解析结果 */
export interface ParsedBcryptHash {
  /** 版本前缀，如 `$2b` */
  prefix: string;
  /** cost 因子（两位数字的数值） */
  cost: number;
  /** 盐（22 个 bcrypt base64 字符） */
  salt: string;
  /** 校验和（31 个 bcrypt base64 字符） */
  checksum: string;
}

/**
 * 字节序列 → bcrypt base64 字符串（crypt 风格：6 位一组、高位在前，不足补零，
 * 与标准 Base64 字母表不同）。16 字节编码为 22 字符，恰好构成一个完整 bcrypt 盐。
 * @param bytes - 原始字节序列
 * @returns bcrypt base64 字符串
 */
export function encodeBcryptBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  let c1: number;
  let c2: number;
  let off = 0;
  const len = bytes.length;

  while (off < len) {
    c1 = bytes[off++];
    out.push(BCRYPT_BASE64_ALPHABET[c1 >> 2]);
    c1 = (c1 & 0x03) << 4;
    if (off >= len) {
      out.push(BCRYPT_BASE64_ALPHABET[c1]);
      break;
    }
    c2 = bytes[off++];
    c1 |= c2 >> 4;
    out.push(BCRYPT_BASE64_ALPHABET[c1]);
    c1 = (c2 & 0x0f) << 2;
    if (off >= len) {
      out.push(BCRYPT_BASE64_ALPHABET[c1]);
      break;
    }
    c2 = bytes[off++];
    c1 |= c2 >> 6;
    out.push(BCRYPT_BASE64_ALPHABET[c1]);
    out.push(BCRYPT_BASE64_ALPHABET[c2 & 0x3f]);
  }

  return out.join('');
}

/**
 * 生成 bcrypt 盐字符串：`$2b$10$` + 22 个 bcrypt base64 字符。
 *
 * 随机源用 Web Crypto 的 crypto.getRandomValues（不依赖 bcryptjs 的
 * genSalt 运行时随机源探测），16 字节熵经 encodeBcryptBase64 编码。
 * @param cost - cost 因子（两位补零，如 4 → `$04$`）
 * @param prefix - 版本前缀，默认 `$2b`（可选 `$2a`/`$2y`/`$2x`）
 * @returns 形如 `$2b$10$xxxxxxxxxxxxxxxxxxxxxx` 的盐（29 字符）
 */
export function generateSalt(cost: number, prefix = '$2b'): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const costStr = String(cost).padStart(2, '0');
  return `${prefix}$${costStr}$${encodeBcryptBase64(bytes)}`;
}

/**
 * 解析 bcrypt 哈希字符串（容忍首尾空白）。
 * @param hash - 待解析的哈希
 * @returns 合法时返回 { prefix, cost, salt, checksum }；非法返回 null（不抛错）
 */
export function parseBcryptHash(hash: string): ParsedBcryptHash | null {
  const m = BCRYPT_HASH_RE.exec(hash.trim());
  if (!m) return null;
  const cost = Number(m[2]);
  // 正则已限定两位数字，仍需排除 00-03：规范 cost 下限为 4
  if (cost < 4 || cost > 31) return null;
  return { prefix: `$${m[1]}`, cost, salt: m[3], checksum: m[4] };
}

/**
 * 给出哈希字符串的格式错误中文文案（用于校验区内联提示，容忍首尾空白）。
 * @param hash - 用户输入的哈希
 * @returns 空字符串表示合法（或未输入）；否则为具体差异化错误原因
 */
export function getBcryptHashFormatError(hash: string): string {
  const value = hash.trim();
  if (!value) return '';
  if (!/^\$2[abxy]\$/.test(value)) {
    if (!value.startsWith('$')) {
      return '格式不正确：bcrypt 哈希应以 $2a$、$2b$、$2y$ 或 $2x$ 开头';
    }
    return '版本前缀不正确：应为 $2a$、$2b$、$2y$ 或 $2x$';
  }
  if (!/^\$2[abxy]\$\d{2}\$/.test(value)) {
    return 'cost 字段不正确：版本前缀后应为两位数字，如 $2b$10$';
  }
  const cost = Number(value.slice(4, 6));
  if (cost < 4 || cost > 31) {
    return 'cost 因子超出范围：bcrypt 仅支持 4-31';
  }
  if (value.length !== BCRYPT_HASH_LENGTH) {
    return `长度不正确：标准 bcrypt 哈希共 60 个字符，当前为 ${value.length} 个`;
  }
  if (!/^[./A-Za-z0-9]{53}$/.test(value.slice(7))) {
    return '包含非法字符：盐与校验和部分只能是 . / 与大小写字母、数字（bcrypt base64 字符集）';
  }
  return '';
}

/**
 * 归一化哈希前缀用于比对计算：`$2x` 是 crypt_blowfish 的历史兼容标记，
 * 与 `$2a` 算法等价，但 bcryptjs 不识别该前缀（compareSync 直接抛
 * Invalid salt revision），比对前需统一替换为 `$2a`，否则 "$2x 全前缀兼容"
 * 的产品口径不成立。
 * @param hash - 已通过格式校验的哈希
 * @returns 可安全交给 bcryptjs 的等价哈希（`$2x$` 开头替换为 `$2a$`，其余原样返回）
 */
export function normalizeHashForCompare(hash: string): string {
  return hash.startsWith('$2x$') ? `$2a$${hash.slice(4)}` : hash;
}

/**
 * 计算密码的 UTF-8 字节数并判断是否会被 bcrypt 截断。
 * bcrypt 只取密码前 72 字节（中文每字 3 字节、emoji 4 字节，极易超出）。
 * @param password - 原始密码字符串
 * @returns 字节数与是否超限（bytes > 72）
 */
export function getPasswordByteInfo(password: string): { bytes: number; truncated: boolean } {
  const bytes = new TextEncoder().encode(password).length;
  return { bytes, truncated: bytes > PASSWORD_MAX_BYTES };
}

/** Worker 请求：生成哈希（主线程自产盐后下发） */
export interface WorkerHashRequest {
  kind: 'hash';
  /** 请求序号：主线程递增，回包不一致即视为过期丢弃 */
  reqId: number;
  password: string;
  salt: string;
}

/** Worker 请求：校验密码与哈希是否匹配 */
export interface WorkerCompareRequest {
  kind: 'compare';
  reqId: number;
  password: string;
  hash: string;
}

/** Worker 请求联合类型 */
export type WorkerRequest = WorkerHashRequest | WorkerCompareRequest;

/** Worker 成功响应：生成哈希 */
export interface WorkerHashResponse {
  kind: 'hash';
  reqId: number;
  ok: true;
  hash: string;
}

/** Worker 成功响应：校验结果 */
export interface WorkerCompareResponse {
  kind: 'compare';
  reqId: number;
  ok: true;
  match: boolean;
}

/** Worker 失败响应（kind 用于错误归位到对应区块） */
export interface WorkerErrorResponse {
  kind: 'hash' | 'compare';
  reqId: number;
  ok: false;
  error: string;
}

/** Worker 响应联合类型 */
export type WorkerResponse = WorkerHashResponse | WorkerCompareResponse | WorkerErrorResponse;
