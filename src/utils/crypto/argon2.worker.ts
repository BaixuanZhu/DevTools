/**
 * Argon2 Web Worker：承载 hash-wasm 的 WASM 慢计算。
 *
 * Argon2 为内存困难型算法，默认档（64 MiB）即有百毫秒级耗时，256 MiB 档
 * 可达数秒，放进 Worker 保证主线程不卡顿。hash-wasm 仅被本文件 import，
 * 库代码整体被 Vite 切进 worker chunk，不进主包。
 *
 * hash-wasm 的 argon2Verify 对不支持的哈希（如 v=16）会直接 throw 英文错误，
 * 这里统一 catch 转中文兜底（常规格式错误已在派发前被 parse 层拦截，
 * 走到这里的只剩罕见内部错误）。消息协议与 reqId 过期丢弃约定见 ./argon2.ts。
 */
import { argon2id, argon2i, argon2d, argon2Verify } from 'hash-wasm';
import { HASH_LENGTH, type Argon2WorkerRequest, type Argon2WorkerResponse } from './argon2';

self.onmessage = async (e: MessageEvent<Argon2WorkerRequest>) => {
  const req = e.data;
  try {
    let resp: Argon2WorkerResponse;
    if (req.kind === 'hash') {
      const hashFn = req.type === 'argon2i' ? argon2i : req.type === 'argon2d' ? argon2d : argon2id;
      const hash = await hashFn({
        password: req.password,
        salt: req.salt,
        iterations: req.t,
        parallelism: req.p,
        memorySize: req.mKiB,
        hashLength: HASH_LENGTH,
        outputType: 'encoded',
      });
      resp = { kind: 'hash', reqId: req.reqId, ok: true, hash };
    } else {
      const match = await argon2Verify({ password: req.password, hash: req.hash });
      resp = { kind: 'verify', reqId: req.reqId, ok: true, match };
    }
    self.postMessage(resp);
  } catch {
    // 英文内部错误不外泄：格式问题已在主线程拦截，这里给通用中文兜底
    const resp: Argon2WorkerResponse = {
      kind: req.kind,
      reqId: req.reqId,
      ok: false,
      error: 'Argon2 计算出错：哈希不受支持或内部错误，请检查输入',
    };
    self.postMessage(resp);
  }
};
