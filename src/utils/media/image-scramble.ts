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

/**
 * 对正方形像素矩阵执行 Arnold 变换（位置置乱）。
 *
 * 公式：[x'] = [2 1][x] (mod N)
 *       [y']   [1 1][y]
 *
 * @param imageData 正方形像素数据
 * @param iterations 迭代次数
 * @returns 置乱后的像素数据
 * @throws 宽高不相等时抛出错误
 */
export function arnoldScramble(imageData: ImageData, iterations: number): ImageData {
  const { width, height, data } = imageData;
  if (width !== height) {
    throw new Error('Arnold 变换要求宽高相等的正方形图像');
  }
  const n = width;
  const src = new Uint8ClampedArray(data);
  const dst = new Uint8ClampedArray(data.length);

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const xNew = (2 * x + y) % n;
        const yNew = (x + y) % n;
        const srcIdx = (y * n + x) * 4;
        const dstIdx = (yNew * n + xNew) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    src.set(dst);
  }

  return new ImageData(dst, n, n);
}

/**
 * 对正方形像素矩阵执行 Arnold 逆变换（还原）。
 *
 * 公式：[x'] = [ 1 -1][x] (mod N)
 *       [y']   [-1  2][y]
 *
 * @param imageData 正方形像素数据
 * @param iterations 迭代次数
 * @returns 还原后的像素数据
 * @throws 宽高不相等时抛出错误
 */
export function arnoldRestore(imageData: ImageData, iterations: number): ImageData {
  const { width, height, data } = imageData;
  if (width !== height) {
    throw new Error('Arnold 变换要求宽高相等的正方形图像');
  }
  const n = width;
  const src = new Uint8ClampedArray(data);
  const dst = new Uint8ClampedArray(data.length);

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const xNew = (x - y + n) % n;
        const yNew = (-x + 2 * y + n) % n;
        const srcIdx = (y * n + x) * 4;
        const dstIdx = (yNew * n + xNew) * 4;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }
    src.set(dst);
  }

  return new ImageData(dst, n, n);
}

/**
 * 生成 Logistic 混沌序列。
 *
 * @param r 控制参数，范围 3.57-4.0
 * @param x0 初始值，范围 0-1
 * @param count 需要生成的序列长度
 * @param warmUp 预热次数，用于跳过瞬态
 * @returns 混沌序列
 */
function generateLogisticSequence(r: number, x0: number, count: number, warmUp = 1000): Float64Array {
  const sequence = new Float64Array(count);
  let x = x0;
  for (let i = 0; i < warmUp; i++) {
    x = r * x * (1 - x);
  }
  for (let i = 0; i < count; i++) {
    x = r * x * (1 - x);
    sequence[i] = x;
  }
  return sequence;
}

/**
 * 根据混沌序列生成像素位置置换表。
 *
 * @param sequence 混沌序列
 * @param length 像素总数
 * @returns 置换表（scramble[i] 表示原第 i 个像素的新位置）
 */
function buildPermutation(sequence: Float64Array, length: number): Uint32Array {
  const indices = new Uint32Array(length);
  for (let i = 0; i < length; i++) {
    indices[i] = i;
  }
  // 使用序列值作为排序键
  indices.sort((a, b) => sequence[a] - sequence[b]);
  return indices;
}

/**
 * 对像素矩阵执行 Logistic 混沌位置置乱。
 *
 * @param imageData 源像素数据
 * @param r 控制参数
 * @param x0 初始值
 * @param iterations 迭代次数
 * @returns 置乱后的像素数据
 */
export function logisticScramble(imageData: ImageData, r: number, x0: number, iterations: number): ImageData {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  let current = new Uint8ClampedArray(data);

  for (let iter = 0; iter < iterations; iter++) {
    const sequence = generateLogisticSequence(r, x0, pixelCount, 1000 + iter * 100);
    const permutation = buildPermutation(sequence, pixelCount);
    const next = new Uint8ClampedArray(data.length);
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * 4;
      const dstIdx = permutation[i] * 4;
      next[dstIdx] = current[srcIdx];
      next[dstIdx + 1] = current[srcIdx + 1];
      next[dstIdx + 2] = current[srcIdx + 2];
      next[dstIdx + 3] = current[srcIdx + 3];
    }
    current = next;
  }

  return new ImageData(current, width, height);
}

/**
 * 对像素矩阵执行 Logistic 混沌位置还原。
 *
 * @param imageData 源像素数据
 * @param r 控制参数
 * @param x0 初始值
 * @param iterations 迭代次数
 * @returns 还原后的像素数据
 */
export function logisticRestore(imageData: ImageData, r: number, x0: number, iterations: number): ImageData {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  let current = new Uint8ClampedArray(data);

  for (let iter = iterations - 1; iter >= 0; iter--) {
    const sequence = generateLogisticSequence(r, x0, pixelCount, 1000 + iter * 100);
    const permutation = buildPermutation(sequence, pixelCount);
    const next = new Uint8ClampedArray(data.length);
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = permutation[i] * 4;
      const dstIdx = i * 4;
      next[dstIdx] = current[srcIdx];
      next[dstIdx + 1] = current[srcIdx + 1];
      next[dstIdx + 2] = current[srcIdx + 2];
      next[dstIdx + 3] = current[srcIdx + 3];
    }
    current = next;
  }

  return new ImageData(current, width, height);
}

/**
 * 根据字符串种子生成 32 位无符号整数哈希。
 *
 * @param seed 种子字符串
 * @returns 哈希值
 */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * 线性同余生成器（LCG），根据种子产生伪随机序列。
 *
 * @param seed 种子
 * @param length 序列长度
 * @returns 伪随机字节序列
 */
function generateLcgSequence(seed: number, length: number): Uint8Array {
  const sequence = new Uint8Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (1103515245 * state + 12345) >>> 0;
    sequence[i] = state & 0xff;
  }
  return sequence;
}

/**
 * 对像素矩阵执行基于种子的快速混淆。
 *
 * 使用 XOR 自逆特性，再次用相同参数处理即可还原。
 *
 * @param imageData 源像素数据
 * @param seed 种子字符串
 * @param iterations 迭代次数
 * @returns 混淆后的像素数据
 */
export function confusionScramble(imageData: ImageData, seed: string, iterations: number): ImageData {
  const { width, height, data } = imageData;
  const totalBytes = data.length;
  const seedHash = hashSeed(seed);
  let current = new Uint8ClampedArray(data);

  for (let iter = 0; iter < iterations; iter++) {
    const sequence = generateLcgSequence(seedHash + iter, totalBytes);
    const next = new Uint8ClampedArray(totalBytes);
    const rowBytes = width * 4;

    // 第一步：简单行交错（奇数行左移 1 像素）
    for (let y = 1; y < height; y += 2) {
      const rowStart = y * rowBytes;
      for (let x = 0; x < width; x++) {
        const srcX = (x + 1) % width;
        const srcIdx = rowStart + srcX * 4;
        const dstIdx = rowStart + x * 4;
        next[dstIdx] = current[srcIdx];
        next[dstIdx + 1] = current[srcIdx + 1];
        next[dstIdx + 2] = current[srcIdx + 2];
        next[dstIdx + 3] = current[srcIdx + 3];
      }
    }
    // 非交错行直接复制
    for (let y = 0; y < height; y += 2) {
      const rowStart = y * rowBytes;
      for (let i = rowStart; i < rowStart + rowBytes; i++) {
        next[i] = current[i];
      }
    }
    // 第二步：XOR 混淆
    for (let i = 0; i < totalBytes; i++) {
      next[i] ^= sequence[i];
    }
    current = next;
  }

  return new ImageData(current, width, height);
}

/**
 * 对像素矩阵执行快速混淆还原。
 *
 * @param imageData 源像素数据
 * @param seed 种子字符串
 * @param iterations 迭代次数
 * @returns 还原后的像素数据
 */
export function confusionRestore(imageData: ImageData, seed: string, iterations: number): ImageData {
  const { width, height, data } = imageData;
  const totalBytes = data.length;
  const seedHash = hashSeed(seed);
  let current = new Uint8ClampedArray(data);

  for (let iter = iterations - 1; iter >= 0; iter--) {
    const sequence = generateLcgSequence(seedHash + iter, totalBytes);
    const rowBytes = width * 4;
    const next = new Uint8ClampedArray(totalBytes);

    // 先还原 XOR
    for (let i = 0; i < totalBytes; i++) {
      next[i] = current[i] ^ sequence[i];
    }

    // 再还原行交错（奇数行右移 1 像素）
    const temp = new Uint8ClampedArray(next);
    for (let y = 1; y < height; y += 2) {
      const rowStart = y * rowBytes;
      for (let x = 0; x < width; x++) {
        const dstX = (x + 1) % width;
        const srcIdx = rowStart + x * 4;
        const dstIdx = rowStart + dstX * 4;
        next[dstIdx] = temp[srcIdx];
        next[dstIdx + 1] = temp[srcIdx + 1];
        next[dstIdx + 2] = temp[srcIdx + 2];
        next[dstIdx + 3] = temp[srcIdx + 3];
      }
    }
    current = next;
  }

  return new ImageData(current, width, height);
}
