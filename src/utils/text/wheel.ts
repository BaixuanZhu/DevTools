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

/** 扇区角度（度），从 0 起顺时针 */
export interface SectorAngle {
  /** 起始角度 */
  startDeg: number;
  /** 结束角度 */
  endDeg: number;
  /** 中线角度，用于动画落点与文字绘制 */
  midDeg: number;
}

/**
 * 计算每个选项的扇区起止角度，面积正比于权重，总和为 360 度。
 * @param items 选项列表
 * @returns 与 items 等长的扇区角度数组；空输入返回空数组
 */
export function computeSectors(items: WheelItem[]): SectorAngle[] {
  if (items.length === 0) return [];
  const total = items.reduce((s, it) => s + it.weight, 0);
  const sectors: SectorAngle[] = [];
  let acc = 0;
  for (const it of items) {
    const startDeg = (acc / total) * 360;
    acc += it.weight;
    const endDeg = (acc / total) * 360;
    sectors.push({ startDeg, endDeg, midDeg: (startDeg + endDeg) / 2 });
  }
  return sectors;
}

/** 指针固定角度：正上方（12 点方向）对应 270 度 */
export const POINTER_DEG = 270;

/**
 * 计算让中奖扇区中线停在指针处所需的最终旋转角（度）。
 * 约定屏幕角度 = 扇区角度 + rotation；结果在当前角基础上单调向前并叠加整圈。
 * @param current 当前旋转角（度）
 * @param winnerMidDeg 中奖扇区中线角度（度）
 * @param extraTurns 额外整圈数，增强视觉效果
 * @returns 最终旋转角（度），> current
 */
export function computeTargetRotation(
  current: number,
  winnerMidDeg: number,
  extraTurns: number,
): number {
  const desiredMod = (((POINTER_DEG - winnerMidDeg) % 360) + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  const delta = (((desiredMod - currentMod) % 360) + 360) % 360;
  return current + delta + extraTurns * 360;
}
