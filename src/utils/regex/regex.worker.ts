/**
 * 正则表达式测试 Web Worker。
 *
 * 用于大文本（>50KB）的正则匹配，避免灾难性正则（ReDoS）长时间阻塞主线程。
 * 接收 pattern / flags / text / seq，返回匹配列表或中文错误描述，并原样回显序号。
 *
 * Worker 内只复用 {@link compileRegex} 与 {@link runMatch} 的纯逻辑，
 * 与主线程共享同一份实现，避免行为漂移。
 */
import {
  compileRegex,
  runMatch,
  type RegexWorkerRequest,
  type RegexWorkerResponse,
} from './regex-engine';

self.onmessage = (e: MessageEvent<RegexWorkerRequest>) => {
  const { pattern, flags, text, seq } = e.data;

  // 编译正则：失败时立即返回中文错误描述
  const compiled = compileRegex(pattern, flags);
  if (!compiled.ok) {
    const resp: RegexWorkerResponse = {
      ok: false,
      matches: [],
      error: compiled.error,
      seq,
    };
    self.postMessage(resp);
    return;
  }

  // 主线程的 runMatch 自带 10000 条上限，避免极端输入产生海量匹配。
  // ReDoS 场景下 Worker 可能长时间运行，由浏览器自身的 Worker 资源限制
  // 兜底；UI 层若检测到长时间无响应会提示用户简化正则或缩小输入。
  try {
    const matches = runMatch(compiled.re, text);
    const resp: RegexWorkerResponse = {
      ok: true,
      matches,
      error: '',
      seq,
    };
    self.postMessage(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp: RegexWorkerResponse = {
      ok: false,
      matches: [],
      error: `匹配过程中发生错误：${msg}`,
      seq,
    };
    self.postMessage(resp);
  }
};
