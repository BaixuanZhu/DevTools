/**
 * Argon2 纯逻辑层：PHC 哈希解析、差异化格式错误、参数校验、随机盐与 Worker 协议类型。
 *
 * 全部为无 Worker 依赖的纯函数（generateArgon2Salt 依赖 Web Crypto 随机源，
 * Node ≥ 22 与浏览器均有 globalThis.crypto），供 Argon2Tool.vue 与
 * argon2.worker.ts 复用，可直接被 vitest 覆盖。
 *
 * 慢计算（WASM 哈希/校验）不放本层——见 argon2.worker.ts（hash-wasm 只允许
 * 被 worker import，保证库代码不进主包）。
 */

/** 支持的 Argon2 类型（argon2id 为新项目默认推荐） */
export const ARGON2_TYPES = ['argon2id', 'argon2i', 'argon2d'] as const;

/** Argon2 类型 */
export type Argon2Type = (typeof ARGON2_TYPES)[number];

/** 内存参数下限（KiB，即 1 MiB） */
export const M_MIN_KIB = 1024;

/** 内存参数上限（KiB，即 256 MiB；防浏览器标签页 OOM） */
export const M_MAX_KIB = 262144;

/** 迭代次数下限 */
export const T_MIN = 1;

/** 迭代次数上限 */
export const T_MAX = 10;

/** 并行度下限 */
export const P_MIN = 1;

/** 并行度上限 */
export const P_MAX = 8;

/** 唯一支持的 PHC 版本（v=16 为老版本，hash-wasm 会直接抛错） */
export const ARGON2_VERSION = 19;

/** 随机盐长度（字节，RFC 9106 推荐档） */
export const SALT_BYTES = 16;

/** 哈希输出长度（字节，业界通行默认） */
export const HASH_LENGTH = 32;

/** PHC 整体正则：$类型$v=版本$m=内存,t=迭代,p=并行$盐$哈希 */
const ARGON2_HASH_RE =
  /^\$(argon2id|argon2i|argon2d)\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/** PHC 盐/哈希段的 Base64 字符集（规范为无 padding 形态，含 = 即不合法） */
const PHC_B64_RE = /^[A-Za-z0-9+/]+$/;

/** parseArgon2Hash 的解析结果 */
export interface ParsedArgon2Hash {
  /** 类型，如 argon2id */
  type: Argon2Type;
  /** PHC 版本号（本工具仅接受 19） */
  version: number;
  /** 内存参数（KiB） */
  m: number;
  /** 迭代次数 */
  t: number;
  /** 并行度 */
  p: number;
  /** 盐的 Base64 段（PHC 无 padding 形态） */
  saltB64: string;
  /** 哈希的 Base64 段 */
  hashB64: string;
  /** 盐字节数（由 Base64 段解得） */
  saltLength: number;
  /** 哈希字节数 */
  hashLength: number;
}

/**
 * 解码 PHC 风格的无 padding Base64 段（自动补齐 padding，容错返回 null）。
 * @param s - Base64 字符串
 * @returns 解码字节；非法（含长度 % 4 === 1 等）返回 null
 */
function decodeBase64Loose(s: string): Uint8Array | null {
  try {
    const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * 解析 Argon2 PHC 哈希字符串（容忍首尾空白）。
 * 仅当结构与 b64 段全部合法且 v=19（本工具唯一支持版本）时返回结果。
 * @param hash - 待解析的哈希
 * @returns 合法时返回结构化字段；非法返回 null（不抛错）
 */
export function parseArgon2Hash(hash: string): ParsedArgon2Hash | null {
  const m = ARGON2_HASH_RE.exec(hash.trim());
  if (!m) return null;
  const version = Number(m[2]);
  if (version !== ARGON2_VERSION) return null;
  const salt = decodeBase64Loose(m[6]);
  const digest = decodeBase64Loose(m[7]);
  if (!salt || !digest || salt.length === 0 || digest.length === 0) return null;
  return {
    type: m[1] as Argon2Type,
    version,
    m: Number(m[3]),
    t: Number(m[4]),
    p: Number(m[5]),
    saltB64: m[6],
    hashB64: m[7],
    saltLength: salt.length,
    hashLength: digest.length,
  };
}

/**
 * 给出 PHC 哈希的格式错误中文文案（用于校验区即时提示，容忍首尾空白）。
 * 逐段差异化定位：前缀 → 类型 → 版本（v=16 专门文案）→ 参数段 → 盐/哈希 b64 段。
 * @param hash - 用户输入的哈希
 * @returns 空字符串表示合法（或未输入）；否则为具体差异化错误原因
 */
export function getArgon2HashFormatError(hash: string): string {
  const value = hash.trim();
  if (!value) return '';
  if (!value.startsWith('$argon2')) {
    return '格式不正确：Argon2 哈希应以 $argon2id$ / $argon2i$ / $argon2d$ 开头';
  }
  const typeMatch = /^\$(argon2id|argon2i|argon2d)\$/.exec(value);
  if (!typeMatch) {
    return '类型段不正确：应为 argon2id、argon2i 或 argon2d';
  }
  const versionMatch = /v=(\d+)\$/.exec(value.slice(typeMatch[0].length));
  if (!versionMatch) {
    return '版本段格式不正确：类型后应为 v=19，如 $argon2id$v=19$';
  }
  if (versionMatch[1] === '16') {
    return 'v=16 为老版本哈希，暂不支持校验，请使用 v=19';
  }
  if (versionMatch[1] !== String(ARGON2_VERSION)) {
    return `版本不支持：仅支持 v=${ARGON2_VERSION}`;
  }
  const afterVersion = value.slice(typeMatch[0].length + versionMatch[0].length);
  const paramsMatch = /^m=(\d+),t=(\d+),p=(\d+)\$/.exec(afterVersion);
  if (!paramsMatch) {
    return '参数段格式不正确：应为 m=数字,t=数字,p=数字，如 m=65536,t=3,p=4';
  }
  const rest = afterVersion.slice(paramsMatch[0].length);
  const segments = rest.split('$');
  if (segments.length !== 2) {
    return '字段缺失：参数段之后应依次为 Base64 盐与 Base64 哈希两段';
  }
  const [saltB64, hashB64] = segments;
  if (!saltB64) {
    return '字段缺失：盐段为空';
  }
  if (!hashB64) {
    return '字段缺失：哈希段为空';
  }
  // 字符集校验须先于解码结论：atob 容忍 = padding，而 PHC 段为无 padding 形态，
  // 不拦会导致「格式检查放行、parse 拒绝、worker 收到非法哈希」的口径分裂
  const salt = decodeBase64Loose(saltB64);
  if (!salt || !PHC_B64_RE.test(saltB64)) {
    return '盐段不合法：应为无 = 补位的 Base64 字符串（字母、数字、+、/）';
  }
  const digest = decodeBase64Loose(hashB64);
  if (!digest || digest.length === 0 || !PHC_B64_RE.test(hashB64)) {
    return '哈希段不合法：应为无 = 补位的 Base64 字符串（字母、数字、+、/）';
  }
  return '';
}

/**
 * 校验生成参数是否在产品口径范围内（防 OOM 与滥用）。
 * @param mKiB - 内存（KiB）
 * @param t - 迭代次数
 * @param p - 并行度
 * @returns 空字符串表示合法；否则为中文错误
 */
export function validateArgon2Params(mKiB: number, t: number, p: number): string {
  if (!Number.isInteger(mKiB) || mKiB < M_MIN_KIB || mKiB > M_MAX_KIB) {
    return `内存参数超出范围：应为 ${M_MIN_KIB}-${M_MAX_KIB} KiB（1-256 MiB）`;
  }
  // 跨字段约束紧跟 m 范围之后判定（当前 M_MIN_KIB(1024) ≥ 8×P_MAX(64)，
  // UI 参数域内天然满足，此守卫防御未来下修下限或程序化调用）
  if (mKiB < 8 * p) {
    return `内存不足：Argon2 要求内存至少为并行度的 8 倍（m ≥ 8×p = ${8 * p} KiB）`;
  }
  if (!Number.isInteger(t) || t < T_MIN || t > T_MAX) {
    return `迭代次数超出范围：应为 ${T_MIN}-${T_MAX}`;
  }
  if (!Number.isInteger(p) || p < P_MIN || p > P_MAX) {
    return `并行度超出范围：应为 ${P_MIN}-${P_MAX}`;
  }
  return '';
}

/**
 * 生成 16 字节密码学随机盐（Web Crypto 自产，不依赖库内随机源）。
 * @returns 16 字节随机盐
 */
export function generateArgon2Salt(): Uint8Array {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Worker 请求：生成哈希（主线程自产盐后下发） */
export interface Argon2HashRequest {
  kind: 'hash';
  /** 请求序号：主线程递增，回包不一致即视为过期丢弃 */
  reqId: number;
  password: string;
  /** 随机盐（结构化克隆传字节） */
  salt: Uint8Array;
  /** Argon2 类型 */
  type: Argon2Type;
  /** 内存（KiB） */
  mKiB: number;
  /** 迭代次数 */
  t: number;
  /** 并行度 */
  p: number;
}

/** Worker 请求：校验密码与 PHC 哈希是否匹配 */
export interface Argon2VerifyRequest {
  kind: 'verify';
  reqId: number;
  password: string;
  hash: string;
}

/** Worker 请求联合类型 */
export type Argon2WorkerRequest = Argon2HashRequest | Argon2VerifyRequest;

/** Worker 成功响应：生成哈希 */
export interface Argon2HashResponse {
  kind: 'hash';
  reqId: number;
  ok: true;
  hash: string;
}

/** Worker 成功响应：校验结果 */
export interface Argon2VerifyResponse {
  kind: 'verify';
  reqId: number;
  ok: true;
  match: boolean;
}

/** Worker 失败响应（kind 用于错误归位到对应区块） */
export interface Argon2ErrorResponse {
  kind: 'hash' | 'verify';
  reqId: number;
  ok: false;
  error: string;
}

/** Worker 响应联合类型 */
export type Argon2WorkerResponse = Argon2HashResponse | Argon2VerifyResponse | Argon2ErrorResponse;
