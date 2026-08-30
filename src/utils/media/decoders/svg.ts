/**
 * SVG 解码器：浏览器原生光栅化。
 *
 * 通过 blob URL + <img>.decode() 让浏览器解析 SVG 并光栅化到 canvas，
 * 再统一回 ImageBitmap，对齐 LoadedImage 契约（与 decoders/tiff.ts 对称）。
 *
 * 安全边界：<img> 加载 SVG 处于 secure static mode，脚本/外链等动态行为
 * 不会执行；blob URL 与页面同源，不污染 canvas（可安全 getImageData）。
 */
import type { LoadedImage } from '../image-convert';
import { checkCanvasLimits } from '../image-convert';

/** 无固有尺寸 SVG 的兜底边长 */
const SVG_FALLBACK_SIZE = 512;

/**
 * 从 SVG 文本中解析 viewBox 的宽高（纯函数，容许多余空白与单双引号）。
 * @param text SVG 文本
 * @returns 宽高（向上取整，最小 1px）；无有效 viewBox 或宽高非正时返回 null
 */
export function readSvgViewBox(text: string): { width: number; height: number } | null {
  // 静态字面量正则（非用户输入构造），无需 try-catch 包裹
  const match = /<svg[^>]*?\bviewBox\s*=\s*(["'])([^"']*)\1/i.exec(text);
  if (!match) return null;
  const nums = match[2].trim().split(/[\s,]+/).map(Number);
  if (nums.length < 4) return null;
  const [width, height] = [Math.ceil(nums[2]), Math.ceil(nums[3])];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

/**
 * 解码 SVG 文件为 LoadedImage。
 *
 * 无固有尺寸（width/height）的 SVG 走回退链：
 * naturalWidth/naturalHeight → 文本解析 viewBox → 512×512 兜底，
 * 避免直接解码失败。
 *
 * @param file 用户上传的 SVG 文件
 * @returns 加载后的位图与解析出的尺寸
 * @throws 非 SVG 内容、渲染失败或尺寸超浏览器上限时抛出
 */
export async function decodeSvg(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    // 回退链：固有尺寸 → viewBox → 兜底尺寸
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (!width || !height) {
      const viewBox = readSvgViewBox(await file.text());
      width = viewBox?.width ?? SVG_FALLBACK_SIZE;
      height = viewBox?.height ?? SVG_FALLBACK_SIZE;
    }

    // 在创建超大 canvas 前拒绝（错误信息会经 loadImage 归一化为通用提示，
    // 精确的尺寸信息仍由调用方 useImageBatch 的同名校验兜底展示）
    const limit = checkCanvasLimits(width, height);
    if (!limit.ok) throw new Error(limit.error);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.drawImage(img, 0, 0, width, height);
    const bitmap = await createImageBitmap(canvas);
    return { bitmap, width, height };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('图片尺寸过大')) throw e;
    throw new Error('SVG 解码失败：文件可能不是有效的 SVG 内容');
  } finally {
    URL.revokeObjectURL(url);
  }
}
