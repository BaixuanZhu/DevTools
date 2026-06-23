/**
 * 幻影坦克合成 Web Worker。
 *
 * 用于大图（>400 万像素）的逐像素合成运算，避免阻塞主线程。接收两张同尺寸图的像素数据，
 * 在独立线程调用 {@link createPhantomTank}，回传结果像素（buffer 转移所有权）或中文错误。
 */
import { createPhantomTank } from './phantom-tank';

/** 可结构化克隆传递的像素数据形态（ImageData 的序列化表示）。 */
interface SerializableImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

interface WorkerInput {
  imageDataA: SerializableImageData;
  imageDataB: SerializableImageData;
}

/**
 * Worker 全局作用域的最小结构类型。
 *
 * Astro 项目的 tsconfig 默认不引入 WebWorker lib，`self` 会被识别为 `Window`，
 * 其 `postMessage` 签名（`(message, targetOrigin, transfer?)`）无法接收 `Transferable[]`。
 * 这里用结构类型约束 `self`，以便正确传递 buffer 所有权。
 */
interface WorkerGlobalScope {
  onmessage: ((this: WorkerGlobalScope, ev: MessageEvent<WorkerInput>) => unknown) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown): void;
}

const workerScope = self as unknown as WorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<WorkerInput>) => {
  try {
    const { imageDataA, imageDataB } = event.data;
    // lib.dom 将 ImageDataArray 限定为 Uint8ClampedArray<ArrayBuffer>；
    // 主线程通过 postMessage 传入的 data 实际为 ArrayBuffer，这里显式收窄。
    const imgA = new ImageData(
      imageDataA.data as Uint8ClampedArray<ArrayBuffer>,
      imageDataA.width,
      imageDataA.height,
    );
    const imgB = new ImageData(
      imageDataB.data as Uint8ClampedArray<ArrayBuffer>,
      imageDataB.width,
      imageDataB.height,
    );
    const result = createPhantomTank({ imageDataA: imgA, imageDataB: imgB });
    workerScope.postMessage(
      { result: { width: result.width, height: result.height, data: result.data } },
      [result.data.buffer],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '幻影坦克合成失败';
    workerScope.postMessage({ error: message });
  }
};
