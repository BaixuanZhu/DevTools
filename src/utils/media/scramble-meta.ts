// src/utils/media/scramble-meta.ts

/**
 * 图片置乱参数的领域编解码层。
 *
 * 负责把「种子 + 块大小」在 PNG tEXt 块和下载文件名两种载体之间序列化与反序列化。
 * 底层 PNG 字节读写见 {@link './png-metadata'}，像素算法与类型见 {@link './image-scramble'}。
 *
 * 所有反序列化函数（`decodeParams` / `decodeFilename` / `readScrambleMetaFromPng`）
 * 遇到任意非法输入一律返回 `null`，绝不抛错——调用方据此降级为「当新图」处理。
 */
import { readTextChunk } from './png-metadata';
import { VALID_BLOCK_SIZES } from './image-scramble';
import type { BlockSize } from './image-scramble';

/** tEXt 关键字（Latin-1 合法，1–79 字符）。 */
export const PARAMS_KEY = 'ScrambleParams';

/** 载荷格式版本号；当前为 1，预留以便未来扩展。 */
const PARAMS_VERSION = 1;

/** 合法 UUID v4 形态（含 crypto.randomUUID 产出的标准 8-4-4-4-12 格式）。 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 合法块大小集合（只读引用，复用自 image-scramble）。 */
const BLOCK_SIZES: ReadonlySet<number> = new Set(VALID_BLOCK_SIZES);

/**
 * 生成一个新的随机种子。
 *
 * 直接调用 `crypto.randomUUID()`，保证浏览器原生加密强度（项目先例：
 * `src/utils/text/fake-data.ts` 中的 `genUuid`）。同一图重复置乱会得到不同种子，
 * 因此不同次置乱互不干扰。
 *
 * @returns 标准 UUID v4 字符串
 */
export function generateSeed(): string {
  return crypto.randomUUID();
}

/**
 * 把参数编码为 tEXt 载荷字符串。
 *
 * 格式：`v=1;bs=<N>;seed=<uuid>`，纯 ASCII 键值对，便于在 PNG tEXt 块中安全存储。
 *
 * @param seed 种子字符串（预期为 UUID，但不在此强校验）
 * @param blockSize 块大小
 * @returns tEXt 载荷字符串
 */
export function encodeParams(seed: string, blockSize: BlockSize): string {
  return `v=${PARAMS_VERSION};bs=${blockSize};seed=${seed}`;
}

/**
 * 解析 tEXt 载荷字符串为参数对象。
 *
 * 严格校验：版本号必须为 {@link PARAMS_VERSION}；块大小必须在
 * {@link VALID_BLOCK_SIZES}；seed 必须符合 UUID 形态。任一不满足返回 `null`。
 *
 * @param text tEXt 载荷字符串
 * @returns 解析出的参数；非法时返回 null
 */
export function decodeParams(text: string): { seed: string; blockSize: BlockSize } | null {
  // 用分号切分键值对；要求恰好 3 段且每段都含 '='
  const parts = text.split(';');
  if (parts.length !== 3) return null;

  const kv: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) return null;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key) return null;
    kv[key] = value;
  }

  // 版本号校验
  if (kv.v !== String(PARAMS_VERSION)) return null;

  // 块大小校验
  const bsNum = Number(kv.bs);
  if (!Number.isInteger(bsNum) || !BLOCK_SIZES.has(bsNum)) return null;

  // seed 校验（UUID 形态）
  if (!kv.seed || !UUID_PATTERN.test(kv.seed)) return null;

  return { seed: kv.seed, blockSize: bsNum as BlockSize };
}

/**
 * 生成置乱结果下载文件名（不带扩展名）。
 *
 * 格式：`<baseName>-scrambled-bs<N>-<完整uuid>`。
 *
 * ⚠️ uuid 必须完整写入，**不得截短**——文件名是 tEXt 被剥离后的唯一还原兜底，
 * 截短会导致 `decodeFilename` 还原时种子对不上、还原失败。
 *
 * @param baseName 原始文件名（不含扩展名）
 * @param seed 种子字符串
 * @param blockSize 块大小
 * @returns 文件名（不含扩展名）
 */
export function encodeFilename(baseName: string, seed: string, blockSize: BlockSize): string {
  return `${baseName}-scrambled-bs${blockSize}-${seed}`;
}

/** 文件名中 `-bs<数字>-<uuid>` 段的正则，捕获块大小与完整 uuid。 */
const FILENAME_PATTERN = /-bs(\d+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * 从文件名解析还原参数。
 *
 * 正则匹配末尾的 `-bs<数字>-<完整uuid>` 段（要求 uuid 完整，截断不匹配），
 * 校验块大小合法后返回。任何不匹配（缺字段、uuid 截断、blockSize 非法）一律返回 null。
 *
 * 这是 tEXt 元数据被剥离（如社交平台重编码）后的兜底还原路径。
 *
 * @param fileName 文件名（可含或不含扩展名）
 * @returns 解析出的参数；不匹配时返回 null
 */
export function decodeFilename(fileName: string): { seed: string; blockSize: BlockSize } | null {
  // 去掉扩展名，避免 .png 干扰末尾正则
  const base = fileName.replace(/\.[^.]+$/, '');
  const match = base.match(FILENAME_PATTERN);
  if (!match) return null;

  const bsNum = Number(match[1]);
  if (!Number.isInteger(bsNum) || !BLOCK_SIZES.has(bsNum)) return null;

  const seed = match[2];
  if (!UUID_PATTERN.test(seed)) return null;

  return { seed, blockSize: bsNum as BlockSize };
}

/**
 * 从 PNG 字节缓冲区读取置乱参数（仅查 tEXt）。
 *
 * 文件名兜底由组件层用 `File.name` 调用 {@link decodeFilename} 完成，本函数只负责 tEXt。
 * 任意异常（非 PNG / 损坏 / 无 tEXt / tEXt 损坏）一律返回 `null`，不抛错。
 *
 * @param buf PNG 字节缓冲区
 * @returns 解析出的参数；未命中或损坏时返回 null
 */
export function readScrambleMetaFromPng(buf: ArrayBuffer): { seed: string; blockSize: BlockSize } | null {
  let text: string | null;
  try {
    text = readTextChunk(buf, PARAMS_KEY);
  } catch {
    return null;
  }
  if (text == null) return null;
  return decodeParams(text);
}
