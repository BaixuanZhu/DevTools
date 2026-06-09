/**
 * JSON 转 XML Web Worker。
 *
 * 用于大文件（>500KB）的异步 JSON 到 XML 转换，避免阻塞主线程。
 * 接收 JSON 文本和根元素名称，返回转换后的 XML 字符串或错误信息。
 */
import {
  convertJsonToXml,
  type JsonToXmlWorkerRequest,
  type JsonToXmlWorkerResponse,
} from './json-to-xml';

self.onmessage = (e: MessageEvent<JsonToXmlWorkerRequest>) => {
  const { json, rootName } = e.data;

  try {
    const result = convertJsonToXml(json, rootName);
    self.postMessage(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: JsonToXmlWorkerResponse = { ok: false, error: `转换过程中发生错误：${msg}` };
    self.postMessage(resp);
  }
};
