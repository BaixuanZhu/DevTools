/**
 * 图片裁切产出层。
 *
 * 提供把裁切后的 canvas 导出为 blob / file / dataURL 的纯函数，
 * 以及可独立单测的 MIME→扩展名推导逻辑。
 */

// ==================== 类型 ====================

/** 裁切产出的多形态结果 */
export interface CropOutputs {
  blob: Blob;
  file: File;
  dataURL: string;
}

/** canvas 编码类型（裁切产出仅支持这三种浏览器原生可编码格式） */
export type CropOutputType = 'image/png' | 'image/jpeg' | 'image/webp';

/** canvasToCropOutputs 的选项 */
export interface CropOutputOptions {
  /** 输出 MIME，默认 'image/png' */
  type?: CropOutputType;
  /** 有损格式质量 0-1，默认 0.92（png 忽略） */
  quality?: number;
  /** 产出 File 的基础名（不含扩展名），默认 'cropped' */
  fileName?: string;
}

// ==================== 纯函数 ====================

/**
 * 裁切输出 MIME 映射到文件扩展名。
 *
 * - image/jpeg → '.jpg'（jpeg 统一用 .jpg）
 * - image/png  → '.png'
 * - image/webp → '.webp'
 *
 * @param type 输出 MIME 类型
 */
export function cropOutputExtension(type: CropOutputType): string {
  switch (type) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
  }
}

/**
 * 拼接完整文件名（基础名 + 扩展名）。
 * @param baseName 基础名（不含扩展名）
 * @param ext 扩展名（含点）
 */
export function buildCropFileName(baseName: string, ext: string): string {
  return `${baseName}${ext}`;
}

/**
 * 判断格式是否为有损压缩（jpeg / webp），需要传递 quality 参数。
 * @param type 输出 MIME 类型
 */
export function isCropLossy(type: CropOutputType): boolean {
  return type === 'image/jpeg' || type === 'image/webp';
}

// ==================== 浏览器 API（组件层验证，不做单测） ====================

/**
 * 把裁切后的 canvas 产出为 blob / file / dataURL 三种形态。
 *
 * - 使用 `canvas.toBlob()` 获取 blob，失败时抛出中文错误；
 * - 使用 `canvas.toDataURL()` 获取 dataURL；
 * - png 格式忽略 quality 参数。
 *
 * @param canvas 裁切结果画布
 * @param opts 输出选项
 * @returns 包含 blob、file、dataURL 的对象
 * @throws 当 canvas 编码失败时抛出
 */
export async function canvasToCropOutputs(
  canvas: HTMLCanvasElement,
  opts: CropOutputOptions = {},
): Promise<CropOutputs> {
  const type: CropOutputType = opts.type ?? 'image/png';
  const quality: number = opts.quality ?? 0.92;
  const fileName: string = opts.fileName ?? 'cropped';

  const ext = cropOutputExtension(type);
  const fullName = buildCropFileName(fileName, ext);
  const qualityArg = isCropLossy(type) ? quality : undefined;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, qualityArg),
  );
  if (!blob) {
    throw new Error('图片编码失败，请重试');
  }

  const file = new File([blob], fullName, { type });
  const dataURL = canvas.toDataURL(type, qualityArg);

  return { blob, file, dataURL };
}
