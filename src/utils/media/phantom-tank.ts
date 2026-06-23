// src/utils/media/phantom-tank.ts

/**
 * 幻影坦克（Phantom Tank）合成算法。
 *
 * 输入两张同尺寸图片：
 * - 图A（表图）：在纯白背景上呈现
 * - 图B（里图）：在纯黑背景上呈现
 *
 * 输出一张带透明通道的像素数据，通过逐像素控制 Alpha 与 RGB 值实现「一图双义」。
 *
 * 算法（经典幻影坦克公式）：
 * - 灰度：Gray = 0.299·R + 0.587·G + 0.114·B
 * - 透明度：α = clamp(Gray_B − Gray_A + 255, 0, 255)
 * - 颜色重构：α = 0 → (0,0,0,0)；α > 0 → R_new = R_B·255/α（G、B 同理），A = α
 *
 * 数学验证：
 * - 黑底（背景 0）：合成色 = R_new·α/255 = R_B，精确显示图B。
 * - 白底（背景 255）：合成色 = 255 − α + R_B；当图B为灰度（R_B = Gray_B）时等于 Gray_A，
 *   精确显示图A；图B为彩色时灰度分量仍正确，色彩分量有可控偏差。
 *
 * 取材建议：图A偏亮、图B偏暗时双重显示效果最清晰（α 偏小，白底更易透出图A）。
 */

/** 幻影坦克合成输入 */
export interface PhantomTankInput {
  /** 图A（表图，白底显示）的像素数据，须与 imageDataB 同尺寸 */
  imageDataA: ImageData;
  /** 图B（里图，黑底显示）的像素数据，须与 imageDataA 同尺寸 */
  imageDataB: ImageData;
}

/**
 * 校验两张图尺寸是否一致。
 * @param a 图A 像素数据
 * @param b 图B 像素数据
 * @throws 尺寸不一致时抛出中文错误
 */
export function validateSameSize(a: ImageData, b: ImageData): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `两张图片尺寸不一致（${a.width}×${a.height} 与 ${b.width}×${b.height}），请先裁剪对齐`,
    );
  }
}

/**
 * 将单个像素的 RGB 值按 ITU-R BT.601 权重转换为亮度灰度。
 * @param r 红色通道 0-255
 * @param g 绿色通道 0-255
 * @param b 蓝色通道 0-255
 * @returns 亮度灰度值（浮点，未取整）
 */
function toGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 合成幻影坦克像素：图A（白底）+ 图B（黑底）→ 透明 PNG。
 *
 * 约定入参两张图已裁剪为同尺寸（裁剪逻辑由调用方负责）。
 *
 * @param input 两张同尺寸图的像素数据
 * @returns 合成后的透明 PNG 像素数据（与输入同尺寸）
 */
export function createPhantomTank(input: PhantomTankInput): ImageData {
  const { imageDataA, imageDataB } = input;
  validateSameSize(imageDataA, imageDataB);

  const { width, height } = imageDataA;
  const dataA = imageDataA.data;
  const dataB = imageDataB.data;
  // 显式创建输出缓冲，兼容测试桩仅支持 new ImageData(data, w, h) 的构造形式
  const out = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < dataA.length; i += 4) {
    const grayA = toGray(dataA[i], dataA[i + 1], dataA[i + 2]);
    const grayB = toGray(dataB[i], dataB[i + 1], dataB[i + 2]);

    // α = clamp(Gray_B − Gray_A + 255, 0, 255)，取整为 0-255 整数
    let alpha = grayB - grayA + 255;
    if (alpha < 0) alpha = 0;
    else if (alpha > 255) alpha = 255;
    const a = Math.round(alpha);

    if (a === 0) {
      // α 为 0：完全透明，同时避免下方除零
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else {
      // R_new = R_B·255/α，赋给 Uint8ClampedArray 自动 clamp 到 [0,255] 并取整
      out[i] = (dataB[i] * 255) / a;
      out[i + 1] = (dataB[i + 1] * 255) / a;
      out[i + 2] = (dataB[i + 2] * 255) / a;
      out[i + 3] = a;
    }
  }

  return new ImageData(out, width, height);
}

/** 自动表图生成输入：里图原图 + 暗化强度。 */
export interface AutoSurfaceInput {
  /** 里图原图（彩色）的像素数据 */
  imageData: ImageData;
  /** 暗化强度 d ∈ [0, 0.8]，滑块百分比 / 100；0 不暗化 */
  darken: number;
}

/** 自动表图生成输出：表图 + 暗化里图，同尺寸、同一 d 计算。 */
export interface AutoSurfaceOutput {
  /** 灰度反相表图（R=G=B=La），白底显示 */
  surface: ImageData;
  /** 等比压暗的彩色里图（保色相），黑底显示 */
  hidden: ImageData;
}

/**
 * 从里图自动生成配套表图：里图各通道等比压暗 → 算灰度 → 自适应反相得表图。
 *
 * 自适应反相 La = max(255 − L, L)：L ≤ 127 走真反相（白底清晰负片）；
 * L > 127 时 La = L，该处 alpha=255，但里图本就偏亮、白底合成也接近白，视觉无穿帮。
 *
 * 同时返回暗化里图，保证表图与里图用同一 d、尺寸天然一致，供 {@link createPhantomTank} 合成。
 *
 * @param input 里图原图与暗化强度
 * @returns surface 灰度反相表图、hidden 暗化彩色里图（均与输入同尺寸）
 */
export function generateSurfaceFromHidden(input: AutoSurfaceInput): AutoSurfaceOutput {
  const { imageData, darken } = input;
  const { width, height, data } = imageData;
  const surfaceData = new Uint8ClampedArray(data.length);
  const hiddenData = new Uint8ClampedArray(data.length);
  const keep = Math.max(0, 1 - darken); // 暗化后保留比例；clamp 防御越界 darken

  for (let i = 0; i < data.length; i += 4) {
    // 1. 等比压暗里图（保色相），赋 Uint8ClampedArray 自动取整
    const rd = data[i] * keep;
    const gd = data[i + 1] * keep;
    const bd = data[i + 2] * keep;
    hiddenData[i] = rd;
    hiddenData[i + 1] = gd;
    hiddenData[i + 2] = bd;
    hiddenData[i + 3] = 255;

    // 2. 暗化里图灰度 → 3. 自适应反相表图（灰度）
    const l = toGray(rd, gd, bd);
    const la = Math.max(255 - l, l);
    surfaceData[i] = la;
    surfaceData[i + 1] = la;
    surfaceData[i + 2] = la;
    surfaceData[i + 3] = 255;
  }

  return {
    surface: new ImageData(surfaceData, width, height),
    hidden: new ImageData(hiddenData, width, height),
  };
}
