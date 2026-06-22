/**
 * Vitest 测试在 node 环境运行，没有浏览器的 ImageData 全局。
 * 本文件为单元测试注入一个最小的 ImageData 占位实现，仅满足像素算法对
 * `new ImageData(data, w, h)` 与只读 `.data / .width / .height` 的访问需求。
 * 运行时（浏览器与 Web Worker）仍使用原生 ImageData，本文件不进入产物。
 */

/**
 * 最小 ImageData 测试桩：支持 `new ImageData(data, width, height)` 构造形式。
 * 类型签名已由 lib.dom 提供，此处仅补齐运行时缺失的值。
 */
class TestImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: 'srgb' | 'display-p3' = 'srgb';

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as unknown as { ImageData: typeof TestImageData }).ImageData = TestImageData;
}
