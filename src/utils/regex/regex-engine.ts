/**
 * 正则表达式引擎纯逻辑模块。
 *
 * 职责：
 * - 安全编译正则表达式（捕获语法错误并归集为中文描述）
 * - 用 `String.prototype.matchAll` 提取所有匹配区间（含编号捕获组与命名捕获组）
 * - 把测试文本按匹配区间拆成分段，供 Vue 组件渲染高亮
 * - 生成可粘贴回 JavaScript 代码的正则字面量文本
 *
 * 安全规则（CLAUDE.md §Security Rules）：
 * - 所有 `new RegExp(...)` 调用均包裹 try-catch
 * - 不使用 `eval` / `Function(string)` / `setTimeout(string)` 等动态执行
 * - 命名捕获组结果仅作为只读数据返回，绝不参与代码生成
 *
 * 设计说明：
 * 本模块刻意保持纯函数 + 不可变数据，便于在 Web Worker 中复用同一份逻辑，
 * 主线程与 Worker 共享类型，避免重复实现。
 */

// ---- 类型定义 ----

/** 单个匹配结果（与 matchAll 的迭代项对齐） */
export interface RegexMatch {
  /** 匹配到的完整文本 */
  match: string;
  /** 起始索引（含） */
  index: number;
  /** 结束索引（不含，等于 index + match.length） */
  end: number;
  /** 编号捕获组（数组下标对应 group 序号，未参与为 undefined） */
  groups: (string | undefined)[];
  /** 命名捕获组（键名 → 值） */
  namedGroups: Record<string, string>;
}

/** 编译结果：成功携带 RegExp 实例，失败携带中文错误描述 */
export type CompileResult =
  | { ok: true; re: RegExp }
  | { ok: false; error: string };

/** 文本分段（用于高亮渲染） */
export interface RegexSegment {
  /** 该段文本内容 */
  text: string;
  /** 是否为匹配段（决定是否着色） */
  matched: boolean;
  /** 匹配段对应的捕获组（未匹配段为 null，便于模板区分） */
  match: RegexMatch | null;
}

/** Web Worker 请求消息（与 regex.worker.ts 共享） */
export interface RegexWorkerRequest {
  /** 正则 pattern 字符串（不含分隔符） */
  pattern: string;
  /** 标志位字符串（如 'gim'） */
  flags: string;
  /** 待测试文本 */
  text: string;
  /** 请求序号（主线程自增），响应原样回显，用于丢弃过期响应 */
  seq: number;
}

/** Web Worker 响应消息 */
export interface RegexWorkerResponse {
  /** 编译/匹配是否成功 */
  ok: boolean;
  /** 成功时的匹配列表（失败时为空数组） */
  matches: RegexMatch[];
  /** 失败时的中文错误描述 */
  error: string;
  /** 回显的请求序号 */
  seq: number;
}

// ---- 常量 ----

/**
 * Web Worker 触发阈值（按测试文本 UTF-8 字节大小）。
 *
 * 超过该阈值的文本会转入 Worker 执行匹配，避免灾难性正则（ReDoS）
 * 在主线程长时阻塞 UI。50KB 与 PRODUCT.md 单工具 JS 体积预算同量级，
 * 是「常见粘贴片段」与「明显需要保护」之间的合理切分点。
 */
export const WORKER_THRESHOLD = 50 * 1024;

/**
 * 主线程匹配硬上限（条数）。
 *
 * 即便未走 Worker，主线程匹配也设置上限防止极端输入产生海量匹配
 * 拖死渲染。超出后截断并在 UI 层提示。
 */
export const MAX_MATCHES = 10000;

/** 合法标志位白名单（与 ES2023 一致） */
const VALID_FLAGS = new Set(['g', 'i', 'm', 's', 'u', 'y']);

// ---- 编译 ----

/**
 * 校验标志位是否合法。
 *
 * 合法规则：每个字符必须在 {@link VALID_FLAGS} 白名单内，且不重复。
 *
 * @param flags - 原始标志位字符串
 * @returns 校验结果；失败时返回中文错误描述
 */
function validateFlags(flags: string): { ok: true } | { ok: false; error: string } {
  const seen = new Set<string>();
  for (const ch of flags) {
    if (!VALID_FLAGS.has(ch)) {
      return { ok: false, error: `标志位「${ch}」不被支持，仅支持 g / i / m / s / u / y` };
    }
    if (seen.has(ch)) {
      return { ok: false, error: `标志位「${ch}」重复出现，每个标志位只能出现一次` };
    }
    seen.add(ch);
  }
  return { ok: true };
}

/**
 * 把 V8 等引擎抛出的英文 SyntaxError 翻译成可读中文提示。
 *
 * 仅做关键词匹配，无法翻译的部分回退到「正则表达式语法错误」+ 原始信息。
 *
 * @param message - 引擎抛出的原始错误信息
 * @returns 中文错误描述
 */
function humanizeSyntaxError(message: string): string {
  const m = message || '';
  if (/unterminated/i.test(m)) return '正则表达式未正确闭合（缺少结束分隔符或括号未配对）';
  if (/nothing to repeat/i.test(m)) return '量词（如 * + ?）前面没有可重复的内容';
  if (/unexpected end/i.test(m)) return '正则表达式提前结束，可能存在未闭合的分组或字符类';
  if (/invalid group/i.test(m)) return '分组语法不合法（如缺少分组名或使用了不支持的断言）';
  if (/invalid unicode property|invalid property name/i.test(m)) return 'Unicode 属性名不合法';
  if (/invalid class/i.test(m)) return '字符类（中括号）语法不合法';
  if (/bad escape/i.test(m)) return '反斜杠转义不合法';
  if (/range out of order/i.test(m)) return '字符范围顺序错误（如 z-a），范围起止字符应从小到大';
  if (/Lone quantifier brackets|Nothing to repeat/i.test(m)) return '量词或括号位置不合法';
  // 兜底
  return `正则表达式语法错误：${m || '请检查括号、量词与转义是否正确'}`;
}

/**
 * 安全编译正则表达式。
 *
 * 必须包裹 try-catch（CLAUDE.md §Security Rules），任何非法输入都返回
 * 中文错误描述而非抛出异常，便于在 UI 内联显示。
 *
 * @param pattern - 正则 pattern 字符串（不含分隔符）
 * @param flags - 标志位字符串（如 'gim'）
 * @returns 编译结果
 */
export function compileRegex(pattern: string, flags: string): CompileResult {
  // 先校验标志位（不依赖引擎报错信息，给出更精准的中文提示）
  const flagCheck = validateFlags(flags);
  if (!flagCheck.ok) {
    return { ok: false, error: flagCheck.error };
  }

  try {
    // CLAUDE.md §Security Rules：new RegExp 必须包裹 try-catch
    const re = new RegExp(pattern, flags);
    return { ok: true, re };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeSyntaxError(msg) };
  }
}

// ---- 匹配 ----

/**
 * 把单个 RegExpExecArray 风格的匹配结果转换为 {@link RegexMatch}。
 *
 * @param exec - `RegExp.prototype.exec` 或 `String.prototype.matchAll` 产生的匹配项
 * @returns 规整后的匹配对象
 */
function toRegexMatch(exec: RegExpExecArray | RegExpMatchArray): RegexMatch {
  // matchAll 的迭代项本质上是 RegExpExecArray
  const arr = exec as RegExpExecArray;
  const index = arr.index ?? 0;
  const matched = arr[0] ?? '';
  const end = index + matched.length;

  // 编号捕获组：跳过第 0 项（整体匹配），其余为 group1..groupN
  const groups: (string | undefined)[] = arr.slice(1);

  // 命名捕获组：RegExpExecArray.groups 是 Record<string,string> | undefined
  const namedGroups: Record<string, string> = {};
  if (arr.groups) {
    for (const [k, v] of Object.entries(arr.groups)) {
      namedGroups[k] = v as string;
    }
  }

  return { match: matched, index, end, groups, namedGroups };
}

/**
 * 对文本执行正则匹配，返回所有匹配区间。
 *
 * 使用 `String.prototype.matchAll`，要求传入的正则带 `g` 标志；
 * 若不带 `g` 标志则降级为单次 `exec`。
 *
 * @param re - 已编译的正则实例
 * @param text - 待测试文本
 * @returns 匹配列表（已应用 {@link MAX_MATCHES} 上限）
 */
export function runMatch(re: RegExp, text: string): RegexMatch[] {
  const matches: RegexMatch[] = [];

  // 不带 g 标志时 matchAll 会抛错，这里降级为 exec
  if (!re.global) {
    // 重置 lastIndex 避免外部残留状态
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      matches.push(toRegexMatch(m));
    }
    return matches;
  }

  try {
    for (const m of text.matchAll(re)) {
      matches.push(toRegexMatch(m));
      // 主线程硬上限，防止极端输入产生海量匹配拖死渲染
      if (matches.length >= MAX_MATCHES) break;
    }
  } catch {
    // matchAll 极少抛错（除非正则内部状态异常），吞掉保证 UI 不崩
    return matches;
  }

  return matches;
}

// ---- 分段 ----

/**
 * 把测试文本按匹配区间拆分成有序分段，供组件渲染高亮。
 *
 * 规则：
 * - 未匹配的文本片段标记 `matched: false`
 * - 匹配片段标记 `matched: true` 并携带原始 {@link RegexMatch}
 * - 匹配区间会先按 index 排序，容错乱序输入
 * - 相邻段不产生空文本段
 *
 * @param text - 原始测试文本
 * @param matches - 匹配区间列表
 * @returns 有序分段数组
 */
export function buildSegments(text: string, matches: RegexMatch[]): RegexSegment[] {
  if (matches.length === 0) {
    return [{ text, matched: false, match: null }];
  }

  // 按 index 排序，避免乱序输入导致分段错乱
  const sorted = [...matches].sort((a, b) => a.index - b.index);
  const segments: RegexSegment[] = [];
  let cursor = 0;

  for (const m of sorted) {
    // 跳过完全落在已消费区间内的匹配（重叠保护）
    if (m.index < cursor) continue;

    // 未匹配前缀
    if (m.index > cursor) {
      segments.push({
        text: text.slice(cursor, m.index),
        matched: false,
        match: null,
      });
    }

    // 匹配段
    segments.push({
      text: text.slice(m.index, m.end),
      matched: true,
      match: m,
    });

    cursor = m.end;
  }

  // 尾部未匹配文本
  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      matched: false,
      match: null,
    });
  }

  return segments;
}

// ---- 字面量化 ----

/**
 * 把 pattern + flags 渲染为可粘贴回 JavaScript 代码的正则字面量。
 *
 * 例如 `formatRegexLiteral('\\d+', 'gi')` 返回 `/\d+/gi`。
 * pattern 中的 `/` 会被转义为 `\/` 以保证字面量合法。
 *
 * @param pattern - 正则 pattern 字符串
 * @param flags - 标志位字符串
 * @returns 正则字面量文本
 */
export function formatRegexLiteral(pattern: string, flags: string): string {
  // 字面量分隔符 / 必须转义
  const escaped = pattern.replace(/\//g, '\\/');
  return `/${escaped}/${flags}`;
}
