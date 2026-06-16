/**
 * JSON 转 TypeScript Web Worker。
 *
 * 用于大文件（>500KB）的异步 JSON 到 TypeScript 类型推断，避免阻塞主线程。
 * 接收 JSON 文本、顶层类型名与请求序号，返回类型定义文本或错误信息，并原样回显序号。
 */
import {
  jsonToTs,
  type JsonToTsWorkerRequest,
  type JsonToTsWorkerResponse,
} from './json-to-ts';

self.onmessage = (e: MessageEvent<JsonToTsWorkerRequest>) => {
  const { json, rootName, seq } = e.data;

  try {
    const result = jsonToTs(json, rootName);
    if (!result.ok) {
      self.postMessage({ ok: false, error: result.error, seq });
      return;
    }
    const resp: JsonToTsWorkerResponse = { ok: true, result: result.result, seq };
    self.postMessage(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: JsonToTsWorkerResponse = {
      ok: false,
      error: `转换过程中发生错误：${msg}`,
      seq,
    };
    self.postMessage(resp);
  }
};
