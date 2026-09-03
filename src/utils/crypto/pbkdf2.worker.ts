/**
 * PBKDF2 Web Worker：承载百万级迭代的 Web Crypto 慢计算。
 *
 * 零第三方依赖（crypto.subtle 在 Worker 内可用）。派生与 Django 校验的
 * 实现复用 ./pbkdf2.ts 的纯函数，保证单测口径与线上路径一致；本文件只做
 * 消息分发与错误转译。消息协议与 reqId 过期丢弃约定见同文件类型定义。
 */
import {
  bytesToHex,
  derivePbkdf2Bytes,
  verifyDjangoPbkdf2,
  type Pbkdf2WorkerRequest,
  type Pbkdf2WorkerResponse,
} from './pbkdf2';

self.onmessage = async (e: MessageEvent<Pbkdf2WorkerRequest>) => {
  const req = e.data;
  try {
    let resp: Pbkdf2WorkerResponse;
    if (req.kind === 'derive') {
      const derived = await derivePbkdf2Bytes(
        req.password,
        req.saltBytes,
        req.iterations,
        req.prf,
        req.dkLen,
      );
      resp = { kind: 'derive', reqId: req.reqId, ok: true, hex: bytesToHex(derived) };
    } else {
      const match = await verifyDjangoPbkdf2(
        req.password,
        req.iterations,
        req.saltBytes,
        req.expectedBytes,
      );
      resp = { kind: 'verify-django', reqId: req.reqId, ok: true, match };
    }
    self.postMessage(resp);
  } catch {
    const resp: Pbkdf2WorkerResponse = {
      kind: req.kind,
      reqId: req.reqId,
      ok: false,
      error: 'PBKDF2 计算出错，请检查参数后重试',
    };
    self.postMessage(resp);
  }
};
