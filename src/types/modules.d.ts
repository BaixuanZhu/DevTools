/**
 * 第三方模块的类型声明补充
 * 用于为没有自带类型声明的依赖提供类型信息
 */

/** des.js — DES / 3DES 加密库 */
declare module 'des.js' {
  interface Cipher {
    update(data: Uint8Array): number[];
    final(): number[];
  }

  interface CipherOptions {
    type: 'encrypt' | 'decrypt';
    key: Uint8Array;
    iv: Uint8Array;
  }

  interface CipherFactory {
    create(options: CipherOptions): Cipher;
  }

  interface Mode {
    instantiate(Algorithm: new (...args: unknown[]) => unknown): CipherFactory;
  }

  class DES {}
  class EDE {}

  export const CBC: Mode;
  export { DES, EDE };
}

/** gifenc — 轻量 GIF 编码器（仅声明本工具用到的 API） */
declare module 'gifenc' {
  /** 调色板颜色，rgba4444 格式下为 [r, g, b, a] 四元组 */
  export type GifPalette = number[][];

  export interface QuantizeOptions {
    /** 颜色量化位深格式，保留透明需用 rgba4444 */
    format?: 'rgb565' | 'rgb444' | 'rgba4444';
    /** 是否将 alpha 二值化（0/255） */
    oneBitAlpha?: boolean | number;
    /** 是否把 alpha 低于阈值的调色板项清为全透明 */
    clearAlpha?: boolean;
    clearAlphaColor?: number;
    clearAlphaThreshold?: number;
    useSqrt?: boolean;
  }

  export interface WriteFrameOptions {
    /** 帧使用的调色板（首帧必填） */
    palette?: GifPalette;
    /** 是否启用透明色标志 */
    transparent?: boolean;
    /** 调色板中被视为全透明的颜色下标 */
    transparentIndex?: number;
    /** 帧延迟（毫秒），静态单帧不关心 */
    delay?: number;
    /** 循环次数，0 = 无限循环 */
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    /** 是否显式作为首帧写文件头 */
    first?: boolean;
  }

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ): void;
    finish(): void;
    /** 返回完整 GIF 字节（内部为独立拷贝，底层为可入 Blob 的 ArrayBuffer） */
    bytes(): Uint8Array<ArrayBuffer>;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(options?: {
    initialCapacity?: number;
    auto?: boolean;
  }): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;
}

/** libheif-js 浏览器 wasm bundle（wasm 二进制以 base64 内嵌，无外部资产请求） */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  /** HEIF 容器内的单张图像句柄 */
  export interface LibheifImage {
    get_width(): number;
    get_height(): number;
    /**
     * 将图像解码为 RGBA 并写入 target（内部经 setTimeout 异步执行）。
     * 回调收到 target 本体表示成功，收到 null 表示失败。
     * 输出像素已含 EXIF 方向旋转，调用方无需再纠偏。
     */
    display(
      target: { data: Uint8ClampedArray; width: number; height: number },
      callback: (data: { data: Uint8ClampedArray } | null) => void,
    ): void;
  }

  export interface LibheifModule {
    HeifDecoder: new () => {
      /** 解析 HEIF/HEIF 容器，失败时返回空数组（不抛异常） */
      decode(buffer: Uint8Array): LibheifImage[];
    };
  }

  /** default 导出为 emscripten MODULARIZE 工厂，调用后得到 libheif 实例 */
  const createLibheif: () => LibheifModule;
  export default createLibheif;
}
