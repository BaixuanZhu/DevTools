/**
 * JSON 转 YAML Web Worker。
 *
 * 用于大文件（>500KB）的异步 JSON 到 YAML 转换，避免阻塞主线程。
 * 接收 JSON 文本，返回转换后的 YAML 字符串或错误信息。
 */
import {
  convertJsonToYaml,
  type JsonToYamlWorkerRequest,
  type JsonToYamlWorkerResponse,
} from './json-to-yaml';

self.onmessage = (e: MessageEvent<JsonToYamlWorkerRequest>) => {
  const { json } = e.data;

  try {
    const result = convertJsonToYaml(json);
    if (!result.ok) {
      self.postMessage(result);
      return;
    }
    const resp: JsonToYamlWorkerResponse = { ok: true, result: result.result };
    self.postMessage(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: JsonToYamlWorkerResponse = { ok: false, error: `转换过程中发生错误：${msg}` };
    self.postMessage(resp);
  }
};
