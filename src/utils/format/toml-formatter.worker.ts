/**
 * TOML 格式化 Web Worker。
 *
 * 用于大文件（>1MB）的异步美化，避免阻塞主线程。
 */
import { formatToml, type TomlStringResult } from './toml-formatter';

/** Worker 请求消息 */
export interface TomlFormatterWorkerRequest {
  /** TOML 文本 */
  text: string;
}

self.onmessage = (e: MessageEvent<TomlFormatterWorkerRequest>) => {
  const { text } = e.data;
  try {
    const result: TomlStringResult = formatToml(text);
    self.postMessage(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure: TomlStringResult = { ok: false, error: `Worker 执行出错：${msg}` };
    self.postMessage(failure);
  }
};
