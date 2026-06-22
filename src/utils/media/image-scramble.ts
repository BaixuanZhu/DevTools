// src/utils/media/image-scramble.ts

/** 置乱模式 */
export type ScrambleMode = 'scramble' | 'restore';

/** 置乱算法 */
export type ScrambleAlgorithm = 'arnold' | 'logistic' | 'confusion';

/** Arnold 变换对非正方形图片的处理策略 */
export type ArnoldPadding = 'expand' | 'crop';

/** 置乱参数 */
export interface ScrambleParams {
  /** 算法类型 */
  algorithm: ScrambleAlgorithm;
  /** 迭代次数 1-50 */
  iterations: number;
  /** Logistic 控制参数 r，范围 3.57-4.0 */
  r: number;
  /** Logistic 初始值 x0，范围 0-1 */
  x0: number;
  /** 快速混淆种子 */
  seed: string;
  /** Arnold 正方形处理策略 */
  padding: ArnoldPadding;
}

/** 置乱操作选项 */
export interface ScrambleOptions {
  /** 源像素数据 */
  imageData: ImageData;
  /** 模式 */
  mode: ScrambleMode;
  /** 参数 */
  params: ScrambleParams;
}

/** 置乱结果 */
export interface ScrambleResult {
  /** 结果像素数据 */
  imageData: ImageData;
  /** 结果宽度 */
  width: number;
  /** 结果高度 */
  height: number;
}

/**
 * 校验置乱参数是否合法。
 * @param params 待校验参数
 * @throws 参数不合法时抛出中文错误
 */
export function validateParams(params: ScrambleParams): void {
  if (!Number.isInteger(params.iterations) || params.iterations < 1 || params.iterations > 50) {
    throw new Error('迭代次数需在 1 到 50 之间');
  }
  if (params.r < 3.57 || params.r > 4.0) {
    throw new Error('Logistic 控制参数需在 3.57 到 4.0 之间');
  }
  if (params.x0 <= 0 || params.x0 >= 1) {
    throw new Error('初始值需在 0 到 1 之间');
  }
  if (params.seed.length === 0) {
    throw new Error('请输入混淆种子');
  }
}
