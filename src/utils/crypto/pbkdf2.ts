/**
 * PBKDF2 纯逻辑层：Django 哈希解析、差异化格式错误、hex 工具、参数校验、
 * 随机盐、Web Crypto 派生/校验函数与 Worker 协议类型。
 *
 * 派生与 Django 校验基于 Web Crypto subtle（Node ≥ 22 与浏览器均有
 * globalThis.crypto.subtle），本文件不依赖任何第三方库；derivePbkdf2Bytes /
 * verifyDjangoPbkdf2 同时被 pbkdf2.worker.ts 与单测复用，保证测试口径与
 * 线上路径一致。慢计算（百万级迭代）由 worker 调用，不放组件主线程。
 */

/** Django（及 passlib）PBKDF2 哈希的算法段字面量 */
export const DJANGO_ALGO = 'pbkdf2_sha256';

/** 迭代次数下限 */
export const ITER_MIN = 1;

/** 迭代次数上限（防超大迭代卡死页面，约 1-2 秒量级的实用上限） */
export const ITER_MAX = 10_000_000;

/** 默认迭代次数（OWASP 2023 对 PBKDF2-HMAC-SHA256 的推荐档） */
export const ITER_DEFAULT = 600_000;

/** 派生长度下限（字节） */
export const DKLEN_MIN = 1;

/** 派生长度上限（字节） */
export const DKLEN_MAX = 512;

/** 默认派生长度（字节，256 位密钥） */
export const DKLEN_DEFAULT = 32;

/** PRF 哈希算法 */
export type Pbkdf2Prf = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

/** PRF 选项（默认 SHA-256 排首位，供 SelectListbox 直接消费） */
export const PRF_OPTIONS: Pbkdf2Prf[] = ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'];

/** parseDjangoPbkdf2Hash 的解析结果 */
export interface ParsedDjangoHash {
  /** 迭代次数 */
  iterations: number;
  /** 盐（解码后字节） */
  saltBytes: Uint8Array;
  /** 期望哈希（解码后字节） */
  hashBytes: Uint8Array;
}

/**
 * 解码 Base64 段（容忍缺省 padding 自动补齐，容错返回 null）。
 * @param s - Base64 字符串
 * @returns 解码字节；非法返回 null
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
 * 解析 Django `pbkdf2_sha256$迭代$b64盐$b64哈希` 格式哈希（容忍首尾空白，
 * b64 段容忍有/无 padding 两种形态）。
 * @param hash - 待解析的哈希
 * @returns 合法时返回 { iterations, saltBytes, hashBytes }；非法返回 null（不抛错）
 */
export function parseDjangoPbkdf2Hash(hash: string): ParsedDjangoHash | null {
  const value = hash.trim();
  const parts = value.split('$');
  if (parts.length !== 4 || parts[0] !== DJANGO_ALGO) return null;
  if (!/^\d+$/.test(parts[1])) return null;
  const iterations = Number(parts[1]);
  if (iterations <= 0 || iterations > ITER_MAX) return null;
  const saltBytes = decodeBase64Loose(parts[2]);
  const hashBytes = decodeBase64Loose(parts[3]);
  if (!saltBytes || saltBytes.length === 0 || !hashBytes || hashBytes.length === 0) return null;
  return { iterations, saltBytes, hashBytes };
}

/**
 * 给出 Django 哈希的格式错误中文文案（用于校验区即时提示，容忍首尾空白）。
 * 逐段差异化定位：分隔结构 → 字段数 → 算法段 → 迭代段 → 盐/哈希 b64 段。
 * @param hash - 用户输入的哈希
 * @returns 空字符串表示合法（或未输入）；否则为具体差异化错误原因
 */
export function getDjangoHashFormatError(hash: string): string {
  const value = hash.trim();
  if (!value) return '';
  const parts = value.split('$');
  if (parts.length !== 4) {
    return '格式不正确：应为 pbkdf2_sha256$迭代$Base64盐$Base64哈希（用 $ 分隔的 4 段）';
  }
  const [algo, iterSeg, saltSeg, hashSeg] = parts;
  if (algo !== DJANGO_ALGO) {
    if (/^pbkdf2_sha\d+$/.test(algo)) {
      return `暂仅支持 pbkdf2_sha256，不支持 ${algo}`;
    }
    return '算法段不正确：不是 Django PBKDF2 哈希，应以 pbkdf2_sha256 开头';
  }
  if (!/^\d+$/.test(iterSeg) || Number(iterSeg) <= 0) {
    return '迭代段不正确：应为正整数，如 pbkdf2_sha256$600000$…';
  }
  if (Number(iterSeg) > ITER_MAX) {
    return `迭代次数过大（超过 ${ITER_MAX.toLocaleString('en-US')}），为避免页面卡死已拒绝校验`;
  }
  const saltBytes = decodeBase64Loose(saltSeg);
  if (!saltBytes || saltBytes.length === 0) {
    return '盐段不合法：应为非空的 Base64 字符串（字母、数字、+、/，可缺省 = 补位）';
  }
  const hashBytes = decodeBase64Loose(hashSeg);
  if (!hashBytes || hashBytes.length === 0) {
    return '哈希段不合法：应为非空的 Base64 字符串（字母、数字、+、/，可缺省 = 补位）';
  }
  return '';
}

/**
 * 校验派生参数是否在产品口径范围内。
 * @param iterations - 迭代次数
 * @param dkLenBytes - 派生长度（字节）
 * @returns 空字符串表示合法；否则为中文错误
 */
export function validatePbkdf2Params(iterations: number, dkLenBytes: number): string {
  if (!Number.isInteger(iterations) || iterations < ITER_MIN || iterations > ITER_MAX) {
    return `迭代次数超出范围：应为 ${ITER_MIN}-${ITER_MAX.toLocaleString('en-US')}`;
  }
  if (!Number.isInteger(dkLenBytes) || dkLenBytes < DKLEN_MIN || dkLenBytes > DKLEN_MAX) {
    return `派生长度超出范围：应为 ${DKLEN_MIN}-${DKLEN_MAX} 字节`;
  }
  return '';
}

/**
 * 判断是否为合法十六进制字节串（非空、成对、仅 0-9 a-f A-F）。
 * @param s - 待判断字符串
 */
export function isValidHex(s: string): boolean {
  if (!s || s.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(s);
}

/**
 * 十六进制字符串 → 字节序列（调用方须先经 isValidHex 校验）。
 * @param hex - 偶数长度的十六进制字符串
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * 字节序列 → 十六进制字符串（小写）。
 * @param bytes - 原始字节序列
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 字节序列 → 标准 Base64 字符串（带 padding）。
 * @param bytes - 原始字节序列
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * 生成 16 字节密码学随机盐并按指定模式编码。
 * @param mode - 盐编码模式（hex 输出 32 个十六进制字符，text 输出 16 个随机字母数字字符）
 * @returns 当前模式可直接填入输入框的盐字符串
 */
export function generateRandomSalt(mode: 'text' | 'hex'): string {
  if (mode === 'hex') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  // text 模式：16 个随机字母数字字符（UTF-8 下恰为 16 字节且可安全粘贴）
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  return Array.from(rand, (r) => alphabet[r % alphabet.length]).join('');
}

/**
 * PBKDF2 派生密钥（Web Crypto subtle，供 worker 与单测共用同一实现）。
 * @param password - 口令（按 UTF-8 字节参与运算）
 * @param saltBytes - 盐字节
 * @param iterations - 迭代次数
 * @param prf - PRF 哈希算法
 * @param dkLen - 派生长度（字节）
 * @returns 派生密钥字节
 */
export async function derivePbkdf2Bytes(
  password: string,
  saltBytes: Uint8Array,
  iterations: number,
  prf: Pbkdf2Prf,
  dkLen: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes as BufferSource, iterations, hash: prf },
    keyMaterial,
    dkLen * 8,
  );
  return new Uint8Array(bits);
}

/**
 * 校验 Django pbkdf2_sha256 哈希：按解析出的迭代/盐重派生并与期望哈希比对。
 * @param password - 待比对明文口令
 * @param iterations - 哈希中的迭代次数
 * @param saltBytes - 哈希中的盐
 * @param expectedBytes - 哈希中的期望值
 * @returns 是否匹配
 */
export async function verifyDjangoPbkdf2(
  password: string,
  iterations: number,
  saltBytes: Uint8Array,
  expectedBytes: Uint8Array,
): Promise<boolean> {
  const derived = await derivePbkdf2Bytes(
    password,
    saltBytes,
    iterations,
    'SHA-256',
    expectedBytes.length,
  );
  // 定长比较（长度不同即不匹配；本地工具场景下恒时比较仅作习惯性防御）
  if (derived.length !== expectedBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expectedBytes[i];
  return diff === 0;
}

/** Worker 请求：派生密钥 */
export interface Pbkdf2DeriveRequest {
  kind: 'derive';
  /** 请求序号：主线程递增，回包不一致即视为过期丢弃 */
  reqId: number;
  password: string;
  /** 盐（结构化克隆传字节，主线程已按模式编码完成） */
  saltBytes: Uint8Array;
  iterations: number;
  prf: Pbkdf2Prf;
  dkLen: number;
}

/** Worker 请求：Django 哈希校验 */
export interface Pbkdf2VerifyDjangoRequest {
  kind: 'verify-django';
  reqId: number;
  password: string;
  iterations: number;
  saltBytes: Uint8Array;
  expectedBytes: Uint8Array;
}

/** Worker 请求联合类型 */
export type Pbkdf2WorkerRequest = Pbkdf2DeriveRequest | Pbkdf2VerifyDjangoRequest;

/** Worker 成功响应：派生密钥（hex 为单一权威格式，b64 由 UI 层转换） */
export interface Pbkdf2DeriveResponse {
  kind: 'derive';
  reqId: number;
  ok: true;
  hex: string;
}

/** Worker 成功响应：Django 校验结果 */
export interface Pbkdf2VerifyResponse {
  kind: 'verify-django';
  reqId: number;
  ok: true;
  match: boolean;
}

/** Worker 失败响应（kind 用于错误归位到对应区块） */
export interface Pbkdf2ErrorResponse {
  kind: 'derive' | 'verify-django';
  reqId: number;
  ok: false;
  error: string;
}

/** Worker 响应联合类型 */
export type Pbkdf2WorkerResponse =
  | Pbkdf2DeriveResponse
  | Pbkdf2VerifyResponse
  | Pbkdf2ErrorResponse;
