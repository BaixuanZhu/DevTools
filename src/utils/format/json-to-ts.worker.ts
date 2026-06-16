/**
 * JSON 转 TypeScript Web Worker。
 *
 * 用于大文件（>500KB）的异步 JSON 到 TypeScript 类型推断，避免阻塞主线程。
 * 接收 JSON 文本和顶层类型名，返回类型定义文本或错误信息。
 */
import {
  jsonToTs,
  type JsonToTsWorkerRequest,
  type JsonToTsWorkerResponse,
} from './json-to-ts';

self.onmessage = (e: MessageEvent<JsonToTsWorkerRequest>) => {
  const { json, rootName } = e.data;

  try {
    const result = jsonToTs(json, rootName);
    if (!result.ok) {
      self.postMessage(result);
      return;
    }
    const resp: JsonToTsWorkerResponse = { ok: true, result: result.result };
    self.postMessage(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: JsonToTsWorkerResponse = {
      ok: false,
      error: `转换过程中发生错误：${msg}`,
    };
    self.postMessage(resp);
  }
};
