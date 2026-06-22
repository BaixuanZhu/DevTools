/**
 * 图像置乱/还原 Web Worker。
 *
 * 用于大图（>400 万像素）的像素置乱运算，避免阻塞主线程。接收像素数据、模式与参数，
 * 在独立线程调用 {@link scrambleImageData}，回传结果像素（buffer 转移所有权）或中文错误。
 */
import { scrambleImageData } from './image-scramble';

interface WorkerInput {
  imageData: { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };
  mode: 'scramble' | 'restore';
  params: import('./image-scramble').ScrambleParams;
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
    const { imageData, mode, params } = event.data;
    const img = new ImageData(imageData.data, imageData.width, imageData.height);
    const result = scrambleImageData({ imageData: img, mode, params });
    workerScope.postMessage(
      { result: { width: result.width, height: result.height, data: result.imageData.data } },
      [result.imageData.data.buffer],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '图像处理失败';
    workerScope.postMessage({ error: message });
  }
};
