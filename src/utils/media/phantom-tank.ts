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
