/**
 * BCrypt Web Worker：承载 bcryptjs 慢计算（hashSync/compareSync）。
 *
 * bcryptjs 的异步 API 只是"分块让出事件循环"，块间仍占主线程，cost ≥ 12
 * 时输入仍有卡顿感；放进 Worker 用同步版 API，主线程完全流畅。
 * bcryptjs 仅被本文件 import，库代码整体被 Vite 切进 worker chunk，
 * 不进主包。消息协议与 reqId 过期丢弃约定见 ./bcrypt.ts 的类型定义。
 */
import bcrypt from 'bcryptjs';
import type { WorkerRequest, WorkerResponse } from './bcrypt';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    let resp: WorkerResponse;
    if (req.kind === 'hash') {
      resp = { kind: 'hash', reqId: req.reqId, ok: true, hash: bcrypt.hashSync(req.password, req.salt) };
    } else {
      resp = { kind: 'compare', reqId: req.reqId, ok: true, match: bcrypt.compareSync(req.password, req.hash) };
    }
    self.postMessage(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: WorkerResponse = { kind: req.kind, reqId: req.reqId, ok: false, error: `BCrypt 计算出错：${msg}` };
    self.postMessage(resp);
  }
};
