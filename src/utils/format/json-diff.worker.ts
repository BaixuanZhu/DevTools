/**
 * JSON Diff Web Worker。
 *
 * 用于大文件（>2MB）的异步 diff 计算，避免阻塞主线程。
 * 接收两侧 JSON 文本和对比选项，返回差异结果。
 */
import {
  parseJsonSafe,
  semanticDiff,
  strictDiff,
  type WorkerRequest,
  type WorkerResponse,
} from './json-diff';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { leftJson, rightJson, mode, options } = e.data;

  try {
    const leftParsed = parseJsonSafe(leftJson);
    if (!leftParsed.ok) {
      const resp: WorkerResponse = { ok: false, error: `左侧 JSON：${leftParsed.error}` };
      self.postMessage(resp);
      return;
    }

    const rightParsed = parseJsonSafe(rightJson);
    if (!rightParsed.ok) {
      const resp: WorkerResponse = { ok: false, error: `右侧 JSON：${rightParsed.error}` };
      self.postMessage(resp);
      return;
    }

    let result: import('./json-diff').WorkerSuccessResponse['result'];

    if (mode === 'semantic') {
      result = semanticDiff(leftParsed.data, rightParsed.data, {
        ignoreArrayOrder: options.ignoreArrayOrder,
      });
    } else {
      result = strictDiff(leftJson, rightJson, options.indentSize);
    }

    const resp: WorkerResponse = { ok: true, result };
    self.postMessage(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: WorkerResponse = { ok: false, error: `对比过程中发生错误：${msg}` };
    self.postMessage(resp);
  }
};
