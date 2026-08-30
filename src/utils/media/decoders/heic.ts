/**
 * HEIC/HEIF 解码器（libheif-js，懒加载）。
 *
 * 浏览器原生 createImageBitmap 不支持 HEIC/HEIF，故用 libheif 的
 * Emscripten 构建解码：HeifDecoder 解析容器 → 首图 display 回调
 * 读出 RGBA → createImageBitmap 统一回 LoadedImage 契约。
 *
 * 懒加载：仅在用户导入 HEIC 时才会动态 import 本模块，libheif-js
 * 体积为 MB 级，必须保持独立 chunk 不进主包。
 */
import type { LoadedImage } from '../image-convert';
import type { LibheifModule } from 'libheif-js/libheif-wasm/libheif-bundle.mjs';

/** libheif 实例的模块级缓存：多文件批量导入时只加载/实例化一次 */
let libheifPromise: Promise<LibheifModule> | null = null;

/**
 * 加载并实例化 libheif（进程内单例）。
 *
 * bundle 的 default 导出是 emscripten MODULARIZE 工厂（wasm 以 base64
 * 内嵌于 JS，无外部 .wasm 请求，无 locateFile 问题），调用后才得到
 * 含 HeifDecoder 的实例。default 兜底命名空间，与 encoders/tiff.ts
 * 的 CJS interop 先例同口径。
 */
function loadLibheif(): Promise<LibheifModule> {
  libheifPromise ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then(
    (mod) => {
      const factory = mod.default ?? (mod as unknown as LibheifModule);
      return typeof factory === 'function' ? factory() : factory;
    },
  );
  return libheifPromise;
}

/**
 * 解码 HEIC/HEIF 文件为 LoadedImage。
 *
 * 取容器内首张图像；EXIF 方向旋转已包含在 display 输出的像素中，
 * 无需再纠偏。libheif 解析失败时不抛异常而是返回空数组，此处
 * 归一化为中文错误。
 *
 * @param file 用户上传的 HEIC/HEIF 图片文件
 * @returns 加载后的位图与原始尺寸
 * @throws 文件损坏、无图像数据或像素回读失败时抛出
 */
export async function decodeHeic(file: File): Promise<LoadedImage> {
  const libheif = await loadLibheif();
  const buffer = new Uint8Array(await file.arrayBuffer());
  // 每次解码新建 HeifDecoder：其内部 context 复用时会 free 上一次的
  // context，并发解码多文件时可能释放仍在使用的句柄
  const decoded = new libheif.HeifDecoder().decode(buffer);
  if (decoded.length === 0) {
    throw new Error('HEIC 文件解析失败：未找到图像数据');
  }
  const image = decoded[0];
  const width = image.get_width();
  const height = image.get_height();
  if (!width || !height) {
    throw new Error('HEIC 文件解析失败：图像尺寸无效');
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  await new Promise<void>((resolve, reject) => {
    image.display({ data: rgba, width, height }, (result) =>
      result ? resolve() : reject(new Error('HEIC 像素数据读取失败')),
    );
  });

  // lib.dom 将 ImageDataArray 限定为 Uint8ClampedArray<ArrayBuffer>，
  // new Uint8ClampedArray(len) 恰好满足，无需显式收窄（同 decoders/tiff.ts 口径）
  const bitmap = await createImageBitmap(new ImageData(rgba, width, height));
  return { bitmap, width, height };
}
