// src/utils/media/image-scramble.ts

/** 置乱模式 */
export type ScrambleMode = 'scramble' | 'restore';

/** 块大小（像素边长），用户可选；块越大置换表越小、速度越快 */
export type BlockSize = 2 | 4 | 8 | 16 | 32 | 64 | 128;

/** 置乱参数 */
export interface ScrambleParams {
  /** 混淆种子（非空字符串），作为 PRNG 种子决定块重排顺序 */
  seed: string;
  /** 块大小（像素），2/4/8/16/32/64/128 */
  blockSize: BlockSize;
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
 * 合法块大小集合，用于运行时校验（Worker 反序列化后参数无字面量类型保证）。
 *
 * 同时供领域编解码层（`scramble-meta.ts`）校验外部传入的 blockSize 字段是否合法，
 * 因此需对外导出。
 */
export const VALID_BLOCK_SIZES: readonly BlockSize[] = [2, 4, 8, 16, 32, 64, 128];

/**
 * 校验置乱参数是否合法。
 * @param params 待校验参数
 * @throws 参数不合法时抛出中文错误
 */
export function validateParams(params: ScrambleParams): void {
  if (!VALID_BLOCK_SIZES.includes(params.blockSize as BlockSize)) {
    throw new Error('块大小需为 2、4、8、16、32、64 或 128');
  }
  if (params.seed.length === 0) {
    throw new Error('请输入混淆种子');
  }
}

/**
 * 根据字符串种子生成 32 位无符号整数哈希（FNV-1a 变体）。
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
 * 创建确定性伪随机数生成器（mulberry32）。
 *
 * 种子相同则序列相同，置乱与还原复用同一序列即可保证可逆。
 * mulberry32 是广泛使用的标准微型 PRNG，自实现，不引入第三方库。
 *
 * @param seed 32 位无符号种子
 * @returns 返回 [0, 1) 浮点数的生成函数
 */
function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 用给定 rng 生成 [0, count) 的 Fisher-Yates 随机置换表。
 *
 * @param count 待置换元素个数
 * @param rng 伪随机数生成函数
 * @returns perm[i] 表示原位置 i 映射到的目标位置
 */
function buildPermutation(count: number, rng: () => number): Uint32Array {
  const perm = new Uint32Array(count);
  for (let i = 0; i < count; i++) perm[i] = i;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  return perm;
}

/**
 * 在像素缓冲区中按块复制：把源图 (srcPixelX, srcPixelY) 起的 blockSize×blockSize 块
 * 逐行拷贝到目标缓冲区 (dstPixelX, dstPixelY) 位置。
 *
 * @param src 源像素缓冲区
 * @param dst 目标像素缓冲区
 * @param width 图像宽度（像素），用于计算行步长
 * @param blockSize 块边长
 * @param srcPixelX 源块左上角 x
 * @param srcPixelY 源块左上角 y
 * @param dstPixelX 目标块左上角 x
 * @param dstPixelY 目标块左上角 y
 */
function copyBlock(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  blockSize: number,
  srcPixelX: number,
  srcPixelY: number,
  dstPixelX: number,
  dstPixelY: number,
): void {
  const rowBytes = width * 4;
  const blockRowBytes = blockSize * 4;
  for (let by = 0; by < blockSize; by++) {
    const srcOffset = (srcPixelY + by) * rowBytes + srcPixelX * 4;
    const dstOffset = (dstPixelY + by) * rowBytes + dstPixelX * 4;
    dst.set(src.subarray(srcOffset, srcOffset + blockRowBytes), dstOffset);
  }
}

/**
 * 对像素矩阵执行基于种子的块级置乱。
 *
 * 将图像划分为 cols×rows 个 blockSize×blockSize 完整块（cols=floor(W/B)、rows=floor(H/B)），
 * 用 PRNG+种子生成块置换表后整体重排块；右/下边缘不足一个完整块的条带原样保留，
 * 因此图像尺寸不变（契合原位展示），且完全可逆。
 *
 * @param imageData 源像素数据
 * @param seed 种子字符串
 * @param blockSize 块边长
 * @returns 置乱后的像素数据（与源同尺寸）
 */
export function confusionScramble(imageData: ImageData, seed: string, blockSize: number): ImageData {
  const { width, height, data } = imageData;
  // lib.dom 将 ImageDataArray 限定为 Uint8ClampedArray<ArrayBuffer>；
  // 从现有 Uint8ClampedArray 构造时 TypeScript 会推断为 ArrayBufferLike，这里显式收窄。
  const dst = new Uint8ClampedArray(data) as Uint8ClampedArray<ArrayBuffer>;
  const cols = Math.floor(width / blockSize);
  const rows = Math.floor(height / blockSize);
  const blockCount = cols * rows;
  if (blockCount === 0) return new ImageData(dst, width, height); // 无完整块 → 空操作

  const rng = createPrng(hashSeed(seed));
  const perm = buildPermutation(blockCount, rng);

  // 置乱：目标槽 i ← 源槽 perm[i]
  for (let i = 0; i < blockCount; i++) {
    const srcSlot = perm[i];
    copyBlock(
      data,
      dst,
      width,
      blockSize,
      (srcSlot % cols) * blockSize,
      Math.floor(srcSlot / cols) * blockSize,
      (i % cols) * blockSize,
      Math.floor(i / cols) * blockSize,
    );
  }
  return new ImageData(dst, width, height);
}

/**
 * 对像素矩阵执行块级置乱的还原。
 *
 * 与 {@link confusionScramble} 使用相同的种子生成同一置换表，按逆方向取回块。
 *
 * @param imageData 源像素数据
 * @param seed 种子字符串
 * @param blockSize 块边长
 * @returns 还原后的像素数据（与源同尺寸）
 */
export function confusionRestore(imageData: ImageData, seed: string, blockSize: number): ImageData {
  const { width, height, data } = imageData;
  // lib.dom 将 ImageDataArray 限定为 Uint8ClampedArray<ArrayBuffer>；
  // 从现有 Uint8ClampedArray 构造时 TypeScript 会推断为 ArrayBufferLike，这里显式收窄。
  const dst = new Uint8ClampedArray(data) as Uint8ClampedArray<ArrayBuffer>;
  const cols = Math.floor(width / blockSize);
  const rows = Math.floor(height / blockSize);
  const blockCount = cols * rows;
  if (blockCount === 0) return new ImageData(dst, width, height);

  const rng = createPrng(hashSeed(seed));
  const perm = buildPermutation(blockCount, rng);

  // 还原：目标槽 perm[i] ← 源槽 i（数学上等价于逆置换）
  for (let i = 0; i < blockCount; i++) {
    const dstSlot = perm[i];
    copyBlock(
      data,
      dst,
      width,
      blockSize,
      (i % cols) * blockSize,
      Math.floor(i / cols) * blockSize,
      (dstSlot % cols) * blockSize,
      Math.floor(dstSlot / cols) * blockSize,
    );
  }
  return new ImageData(dst, width, height);
}

/**
 * 根据参数执行置乱或还原（统一入口）。
 *
 * 在原始尺寸上直接做块级运算，返回同尺寸结果。任意比例图片均无需正方形预处理。
 *
 * @param options 置乱选项
 * @returns 处理后的像素数据及尺寸
 */
export function scrambleImageData(options: ScrambleOptions): ScrambleResult {
  const { imageData, mode, params } = options;
  validateParams(params);

  if (imageData.width < 1 || imageData.height < 1) {
    throw new Error('图片尺寸无效，无法处理空图像');
  }

  const processed =
    mode === 'scramble'
      ? confusionScramble(imageData, params.seed, params.blockSize)
      : confusionRestore(imageData, params.seed, params.blockSize);
  return { imageData: processed, width: processed.width, height: processed.height };
}
