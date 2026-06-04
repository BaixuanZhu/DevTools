/**
 * 非对称加密核心逻辑。
 * 基于 Web Crypto API，支持 RSA-OAEP、RSA-PSS、ECDSA、Ed25519。
 * 提供密钥对生成、密钥导入导出、加解密、签名验签功能。
 */

import { encodeBuffer, decodeToBuffer } from '../shared/array-buffer';
import type { OutputFormat } from '../shared/array-buffer';

/** 支持的非对称算法 */
export type AsymmetricAlgorithm = 'RSA-OAEP' | 'RSA-PSS' | 'ECDSA' | 'Ed25519';

/** 支持的哈希算法 */
export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

/** 支持的密钥导出格式 */
export type KeyExportFormat = 'jwk' | 'spki' | 'pkcs8';

/** 支持的密钥编码格式 */
export type KeyEncoding = 'pem' | 'base64' | 'hex' | 'hexUpper';

/** 密钥目标类型 */
export type KeyTarget = 'public' | 'private';

/** RSA 密钥长度选项 */
export const RSA_KEY_SIZES = [2048, 3072, 4096] as const;

/** ECDSA 曲线选项 */
export const ECDSA_CURVES = ['P-256', 'P-384', 'P-521'] as const;

/** 哈希算法选项 */
export const HASH_ALGORITHMS = ['SHA-256', 'SHA-384', 'SHA-512'] as const;

/** 算法元数据配置 */
export interface AlgorithmMeta {
  readonly id: AsymmetricAlgorithm;
  readonly label: string;
  readonly supportsEncrypt: boolean;
  readonly supportsSign: boolean;
  readonly keySizeOptions: readonly number[];
  readonly curveOptions: readonly string[];
  readonly hashOptions: readonly HashAlgorithm[];
  readonly defaultKeySize: number;
  readonly defaultCurve: string;
  readonly defaultHash: HashAlgorithm;
}

/** 算法元数据映射 */
export const ALGORITHM_META: Readonly<Record<AsymmetricAlgorithm, AlgorithmMeta>> = {
  'RSA-OAEP': {
    id: 'RSA-OAEP',
    label: 'RSA-OAEP',
    supportsEncrypt: true,
    supportsSign: false,
    keySizeOptions: RSA_KEY_SIZES,
    curveOptions: [],
    hashOptions: HASH_ALGORITHMS,
    defaultKeySize: 2048,
    defaultHash: 'SHA-256',
    defaultCurve: '',
  },
  'RSA-PSS': {
    id: 'RSA-PSS',
    label: 'RSA-PSS',
    supportsEncrypt: false,
    supportsSign: true,
    keySizeOptions: RSA_KEY_SIZES,
    curveOptions: [],
    hashOptions: HASH_ALGORITHMS,
    defaultKeySize: 2048,
    defaultHash: 'SHA-256',
    defaultCurve: '',
  },
  'ECDSA': {
    id: 'ECDSA',
    label: 'ECDSA',
    supportsEncrypt: false,
    supportsSign: true,
    keySizeOptions: [],
    curveOptions: ECDSA_CURVES,
    hashOptions: HASH_ALGORITHMS,
    defaultKeySize: 0,
    defaultCurve: 'P-256',
    defaultHash: 'SHA-256',
  },
  'Ed25519': {
    id: 'Ed25519',
    label: 'Ed25519',
    supportsEncrypt: false,
    supportsSign: true,
    keySizeOptions: [],
    curveOptions: [],
    hashOptions: [],
    defaultKeySize: 0,
    defaultCurve: '',
    defaultHash: 'SHA-256',
  },
};

/** 所有支持的算法 ID 列表 */
export const ALL_ASYMMETRIC_ALGORITHMS: readonly AsymmetricAlgorithm[] = Object.keys(
  ALGORITHM_META,
) as AsymmetricAlgorithm[];

/**
 * 检测当前浏览器是否支持 Ed25519
 * @returns 是否支持
 */
export async function isEd25519Supported(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey('Ed25519', false, ['sign', 'verify']);
    return true;
  } catch {
    return false;
  }
}

/**
 * 根据哈希算法获取 RSA-PSS 的 salt 长度（字节）
 * @param hash - 哈希算法
 * @returns salt 长度
 */
function getSaltLength(hash: HashAlgorithm): number {
  switch (hash) {
    case 'SHA-256':
      return 32;
    case 'SHA-384':
      return 48;
    case 'SHA-512':
      return 64;
  }
}

/**
 * 将 ArrayBuffer 转换为 PEM 格式字符串
 * @param buffer - DER 编码的二进制数据
 * @param label - PEM 标签（如 'PUBLIC KEY'）
 * @returns PEM 格式字符串
 */
function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const base64 = encodeBuffer(buffer, 'base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/**
 * 将 PEM 格式字符串转换为 ArrayBuffer
 * @param pem - PEM 格式字符串
 * @returns DER 编码的二进制数据
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s/g, '');
  return decodeToBuffer(base64, 'base64');
}

/**
 * 生成非对称密钥对
 * @param algorithm - 算法名称
 * @param options - 算法特定选项
 * @returns 生成的密钥对
 */
export async function generateKeyPair(
  algorithm: AsymmetricAlgorithm,
  options: {
    keySize?: number;
    curve?: string;
    hash?: HashAlgorithm;
  } = {},
): Promise<CryptoKeyPair> {
  const meta = ALGORITHM_META[algorithm];

  try {
    switch (algorithm) {
      case 'RSA-OAEP': {
        const keySize = options.keySize ?? meta.defaultKeySize;
        const hash = options.hash ?? meta.defaultHash;
        return await crypto.subtle.generateKey(
          {
            name: 'RSA-OAEP',
            modulusLength: keySize,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash,
          },
          true,
          ['encrypt', 'decrypt'],
        );
      }
      case 'RSA-PSS': {
        const keySize = options.keySize ?? meta.defaultKeySize;
        const hash = options.hash ?? meta.defaultHash;
        return await crypto.subtle.generateKey(
          {
            name: 'RSA-PSS',
            modulusLength: keySize,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash,
          },
          true,
          ['sign', 'verify'],
        );
      }
      case 'ECDSA': {
        const curve = options.curve ?? meta.defaultCurve;
        return await crypto.subtle.generateKey(
          {
            name: 'ECDSA',
            namedCurve: curve,
          },
          true,
          ['sign', 'verify'],
        );
      }
      case 'Ed25519': {
        return await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Ed25519') || message.includes('not supported')) {
      throw new Error(
        `当前浏览器不支持 ${algorithm} 算法，请使用最新版本的 Chrome、Edge 或 Firefox`,
      );
    }
    throw new Error(`生成密钥对失败: ${message}`);
  }
}

/**
 * 导出密钥为指定格式和编码的字符串
 * @param key - CryptoKey 对象
 * @param format - 导出格式（jwk / spki / pkcs8）
 * @param encoding - 编码格式（pem / base64 / hex / hexUpper）
 * @returns 导出的密钥字符串
 */
export async function exportKeyString(
  key: CryptoKey,
  format: KeyExportFormat,
  encoding: KeyEncoding,
): Promise<string> {
  try {
    if (format === 'jwk') {
      const jwk = await crypto.subtle.exportKey('jwk', key);
      return JSON.stringify(jwk, null, 2);
    }

    // spki 和 pkcs8 导出为 DER 二进制
    const exportFormat = format as 'spki' | 'pkcs8';
    const der = await crypto.subtle.exportKey(exportFormat, key);

    if (encoding === 'pem') {
      const label = format === 'spki' ? 'PUBLIC KEY' : 'PRIVATE KEY';
      return arrayBufferToPem(der, label);
    }

    const outputFormat: OutputFormat = encoding === 'hexUpper' ? 'hexUpper' : (encoding as OutputFormat);
    return encodeBuffer(der, outputFormat);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`导出密钥失败: ${message}`);
  }
}

/**
 * 从字符串导入密钥
 * @param keyData - 密钥字符串
 * @param algorithm - 目标算法
 * @param format - 密钥格式（jwk / spki / pkcs8）
 * @param target - 密钥类型（public / private）
 * @param hash - 哈希算法（RSA 算法需要）
 * @param curve - 曲线名称（ECDSA 需要）
 * @returns 导入的 CryptoKey
 */
export async function importKeyString(
  keyData: string,
  algorithm: AsymmetricAlgorithm,
  format: KeyExportFormat,
  target: KeyTarget,
  hash?: HashAlgorithm,
  curve?: string,
): Promise<CryptoKey> {
  try {
    let key: JsonWebKey | ArrayBuffer;

    if (format === 'jwk') {
      key = JSON.parse(keyData) as JsonWebKey;
    } else {
      // 处理 PEM 格式
      const trimmed = keyData.trim();
      if (trimmed.startsWith('-----BEGIN')) {
        key = pemToArrayBuffer(trimmed);
      } else {
        // Base64 或 Hex
        const cleaned = trimmed.replace(/\s/g, '');
        const isHex = /^[0-9a-fA-F]+$/.test(cleaned);
        const fmt: OutputFormat = isHex ? 'hex' : 'base64';
        key = decodeToBuffer(cleaned, fmt);
      }
    }

    const importFormat = format as 'jwk' | 'spki' | 'pkcs8';

    switch (algorithm) {
      case 'RSA-OAEP': {
        const h = hash ?? 'SHA-256';
        const usages: KeyUsage[] = target === 'public' ? ['encrypt'] : ['decrypt'];
        return await crypto.subtle.importKey(
          importFormat,
          key,
          { name: 'RSA-OAEP', hash: h },
          false,
          usages,
        );
      }
      case 'RSA-PSS': {
        const h = hash ?? 'SHA-256';
        const usages: KeyUsage[] = target === 'public' ? ['verify'] : ['sign'];
        return await crypto.subtle.importKey(
          importFormat,
          key,
          { name: 'RSA-PSS', hash: h },
          false,
          usages,
        );
      }
      case 'ECDSA': {
        const namedCurve = curve ?? 'P-256';
        const usages: KeyUsage[] = target === 'public' ? ['verify'] : ['sign'];
        return await crypto.subtle.importKey(
          importFormat,
          key,
          { name: 'ECDSA', namedCurve },
          false,
          usages,
        );
      }
      case 'Ed25519': {
        const usages: KeyUsage[] = target === 'public' ? ['verify'] : ['sign'];
        return await crypto.subtle.importKey(importFormat, key, 'Ed25519', false, usages);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('JSON')) {
      throw new Error('密钥格式错误：JWK 格式必须是有效的 JSON');
    }
    throw new Error(`导入密钥失败: ${message}`);
  }
}

/**
 * 使用 RSA-OAEP 公钥加密数据
 * @param plaintext - 明文文本
 * @param publicKey - 公钥 CryptoKey
 * @param format - 输出编码格式（默认 Base64）
 * @returns 编码后的密文
 */
export async function encryptRSAOAEP(
  plaintext: string,
  publicKey: CryptoKey,
  format: OutputFormat = 'base64',
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, data);
    return encodeBuffer(encrypted, format);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`加密失败: ${message}`);
  }
}

/**
 * 使用 RSA-OAEP 私钥解密数据
 * @param ciphertext - 编码后的密文
 * @param privateKey - 私钥 CryptoKey
 * @param format - 输入编码格式（默认 Base64）
 * @returns 解密后的明文
 */
export async function decryptRSAOAEP(
  ciphertext: string,
  privateKey: CryptoKey,
  format: OutputFormat = 'base64',
): Promise<string> {
  try {
    const data = decodeToBuffer(ciphertext, format);
    const decrypted = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, data);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`解密失败: ${message}`);
  }
}

/**
 * 使用私钥对数据进行签名
 * @param data - 待签名文本
 * @param privateKey - 私钥 CryptoKey
 * @param algorithm - 签名算法
 * @param hash - 哈希算法（RSA-PSS 和 ECDSA 需要）
 * @param format - 输出编码格式（默认 Base64）
 * @returns 编码后的签名
 */
export async function signData(
  data: string,
  privateKey: CryptoKey,
  algorithm: AsymmetricAlgorithm,
  hash?: HashAlgorithm,
  format: OutputFormat = 'base64',
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);

    let signature: ArrayBuffer;

    switch (algorithm) {
      case 'RSA-PSS': {
        const h = hash ?? 'SHA-256';
        signature = await crypto.subtle.sign(
          { name: 'RSA-PSS', saltLength: getSaltLength(h) },
          privateKey,
          encoded,
        );
        break;
      }
      case 'ECDSA': {
        const h = hash ?? 'SHA-256';
        signature = await crypto.subtle.sign({ name: 'ECDSA', hash: h }, privateKey, encoded);
        break;
      }
      case 'Ed25519': {
        signature = await crypto.subtle.sign('Ed25519', privateKey, encoded);
        break;
      }
      default:
        throw new Error(`算法 ${algorithm} 不支持签名操作`);
    }

    return encodeBuffer(signature, format);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`签名失败: ${message}`);
  }
}

/**
 * 使用公钥验证签名
 * @param data - 原始数据文本
 * @param signature - 编码后的签名
 * @param publicKey - 公钥 CryptoKey
 * @param algorithm - 签名算法
 * @param hash - 哈希算法（RSA-PSS 和 ECDSA 需要）
 * @param format - 输入编码格式（默认 Base64）
 * @returns 签名是否有效
 */
export async function verifySignature(
  data: string,
  signature: string,
  publicKey: CryptoKey,
  algorithm: AsymmetricAlgorithm,
  hash?: HashAlgorithm,
  format: OutputFormat = 'base64',
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const sigBuffer = decodeToBuffer(signature, format);

    switch (algorithm) {
      case 'RSA-PSS': {
        const h = hash ?? 'SHA-256';
        return await crypto.subtle.verify(
          { name: 'RSA-PSS', saltLength: getSaltLength(h) },
          publicKey,
          sigBuffer,
          encoded,
        );
      }
      case 'ECDSA': {
        const h = hash ?? 'SHA-256';
        return await crypto.subtle.verify({ name: 'ECDSA', hash: h }, publicKey, sigBuffer, encoded);
      }
      case 'Ed25519': {
        return await crypto.subtle.verify('Ed25519', publicKey, sigBuffer, encoded);
      }
      default:
        throw new Error(`算法 ${algorithm} 不支持验签操作`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`验签失败: ${message}`);
  }
}
