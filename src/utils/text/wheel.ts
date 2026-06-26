/**
 * 转盘抽奖纯逻辑：加权随机、扇区角度、目标旋转角、批量解析、分享编解码、调色板。
 * 本模块不依赖 DOM，全部为可单测纯函数（createCryptoRng 除外，依赖 Web Crypto）。
 */

/** 单个转盘选项 */
export interface WheelItem {
  /** 选项名称（去首尾空白，非空） */
  text: string;
  /** 权重，正有限数；面积与中奖概率正比于权重 */
  weight: number;
}

/** 选项数量上限，保证扇区可读 */
export const MAX_ITEMS = 50;

/**
 * 归一化权重：非正数或非有限值回退为 1，否则保留原值。
 * @param w 原始权重
 * @returns 合法权重
 */
export function normalizeWeight(w: number): number {
  return Number.isFinite(w) && w > 0 ? w : 1;
}

/**
 * 按权重随机选中一个下标（前缀和落点法）。
 * @param weights 各选项权重，应为正数
 * @param rng 返回 [0,1) 均匀随机数的函数，便于测试注入
 * @returns 命中下标；weights 为空时返回 -1
 */
export function pickWeightedIndex(weights: number[], rng: () => number): number {
  if (weights.length === 0) return -1;
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return Math.floor(rng() * weights.length);
  let target = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i];
    if (target < 0) return i;
  }
  return weights.length - 1;
}

/**
 * 创建基于 Web Crypto 的均匀随机数生成器。
 * @returns 每次调用返回 [0,1) 的均匀随机数
 */
export function createCryptoRng(): () => number {
  return () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  };
}
