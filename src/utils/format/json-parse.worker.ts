/**
 * JSON 解析 Web Worker。
 *
 * 用于大文件（>1MB）的异步 JSON 解析，避免阻塞主线程。
 * 接收原始 JSON 字符串，返回解析结果和统计信息。
 */
import { computeStats, type WorkerRequest, type WorkerResponse } from './json-formatter';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { json } = e.data;
  try {
    const parsed = JSON.parse(json);
    const stats = computeStats(json, parsed);
    const response: WorkerResponse = { ok: true, parsed, stats };
    self.postMessage(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const response: WorkerResponse = { ok: false, error: msg };
    self.postMessage(response);
  }
};
