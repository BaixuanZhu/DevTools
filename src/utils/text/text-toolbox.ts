/**
 * 文本处理工具箱核心模块。
 *
 * 提供大小写/全半角转换、去重去空行、排序、统计、查找替换等纯函数，
 * 以及撤销/重做历史栈。所有函数无副作用，可独立单元测试。
 */

/** 将文本全部转为大写（无大小写概念的字形如中文原样保留）。 */
export function toUpperCase(input: string): string {
  return input.toUpperCase();
}

/** 将文本全部转为小写。 */
export function toLowerCase(input: string): string {
  return input.toLowerCase();
}

/**
 * 按行做标题化：每行首字符大写、其余小写。
 *
 * 空行原样保留；首字符无大小写概念（如中文）时仅对其后字符做小写处理。
 * @param input - 原始文本
 * @returns 标题化后的文本
 */
export function toTitleCase(input: string): string {
  return input
    .split('\n')
    .map((line) => {
      if (!line) return line;
      return line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
    })
    .join('\n');
}

/**
 * 全角转半角。
 *
 * 将 U+FF01–FF5E 映射为 U+0021–007E（偏移 0xFEE0），全角空格 U+3000 转为普通空格 U+0020。
 * 仅作用于 ASCII 范围，中文字符不受影响。
 * @param input - 原始文本
 * @returns 半角化后的文本
 */
export function toHalfWidth(input: string): string {
  return input.replace(/[！-～　]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code === 0x3000) return ' ';
    return String.fromCharCode(code - 0xfee0);
  });
}

/**
 * 半角转全角。
 *
 * 将 U+0021–007E 映射为 U+FF01–FF5E，普通空格 U+0020 转为全角空格 U+3000。
 * @param input - 原始文本
 * @returns 全角化后的文本
 */
export function toFullWidth(input: string): string {
  return input.replace(/[!-~ ]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code === 0x0020) return String.fromCharCode(0x3000);
    return String.fromCharCode(code + 0xfee0);
  });
}

/**
 * 删除纯空白行（仅含空格/制表符等空白的行），保留有内容的行。
 * @param input - 原始文本
 * @returns 去除空白行后的文本
 */
export function removeBlankLines(input: string): string {
  return input
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}

/**
 * 按行去重，保留首次出现顺序。
 * @param input - 原始文本
 * @returns 去重后的文本
 */
export function dedupeLines(input: string): string {
  const seen = new Set<string>();
  return input
    .split('\n')
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join('\n');
}

/**
 * 去除每一行的首尾空白，不改动行内中间空白。
 * @param input - 原始文本
 * @returns 每行首尾去空白后的文本
 */
export function trimLines(input: string): string {
  return input
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

/**
 * 将每行内部连续空白（空白字符）合并为单个空格，并去除该行首尾空白。
 * 不跨行合并、不删除换行。
 * @param input - 原始文本
 * @returns 合并空白后的文本
 */
export function collapseWhitespace(input: string): string {
  return input
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n');
}

/**
 * 按行排序。
 *
 * 使用默认 UTF-16 码元序（默认排序序）（大写 ASCII 排在小写之前），区分大小写；
 * 空行与纯空白行不参与排序，统一移到结果末尾并以空串输出。
 * @param input - 原始文本
 * @param order - 排序方向，默认升序 `'asc'`
 * @returns 排序后的文本
 */
export function sortLines(input: string, order: 'asc' | 'desc' = 'asc'): string {
  const lines = input.split('\n');
  const nonBlank = lines.filter((line) => line.trim() !== '');
  const blankCount = lines.length - nonBlank.length;
  nonBlank.sort();
  if (order === 'desc') nonBlank.reverse();
  return [...nonBlank, ...Array<string>(blankCount).fill('')].join('\n');
}

/** 文本统计结果。 */
export interface TextStats {
  /** 全部字符数（含空白与换行） */
  chars: number;
  /** 去除所有空白后的字符数 */
  charsNoSpace: number;
  /** UTF-8 编码字节数 */
  bytes: number;
  /** 行数 */
  lines: number;
}

/** 复用的 UTF-8 编码器（计算字节数）。 */
const encoder = new TextEncoder();

/**
 * 计算文本的字符数、去空白字符数、UTF-8 字节数与行数。
 * @param input - 原始文本
 * @returns 统计结果
 */
export function computeStats(input: string): TextStats {
  return {
    chars: input.length,
    charsNoSpace: input.replace(/\s/g, '').length,
    bytes: encoder.encode(input).length,
    lines: input === '' ? 0 : input.split('\n').length,
  };
}

/** 查找替换选项。 */
export interface ReplaceOptions {
  /** 是否区分大小写 */
  caseSensitive: boolean;
  /** 是否将查找内容作为正则表达式 */
  regex: boolean;
}

/** 查找替换结果。 */
export interface ReplaceResult {
  /** 替换后的文本；出错时为原文。 */
  result: string;
  /** 错误信息；成功时为 undefined。 */
  error?: string;
}

/** 转义字符串中的正则元字符，用于字面量匹配。 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 全局查找替换。
 *
 * - 普通模式：按字面量匹配，替换串原样输出（不解释 `$`）。
 * - 正则模式：`new RegExp(find, flags)`，遵循 JS 标准 `replace` 语义（支持 `$1`/`$&` 反向引用）。
 *
 * 正则编译失败或查找内容为空时返回 `error`，不改动原文。
 * @param input - 原始文本
 * @param find - 查找内容
 * @param replace - 替换内容
 * @param options - 替换选项
 * @returns 替换结果（含可能错误）
 */
export function replaceAll(
  input: string,
  find: string,
  replace: string,
  options: ReplaceOptions,
): ReplaceResult {
  if (find === '') {
    return { result: input, error: '查找内容不能为空' };
  }

  const flags = 'g' + (options.caseSensitive ? '' : 'i');

  if (options.regex) {
    let re: RegExp;
    try {
      re = new RegExp(find, flags);
    } catch (e) {
      return {
        result: input,
        error: e instanceof Error ? `正则表达式语法错误：${e.message}` : '正则表达式语法错误',
      };
    }
    return { result: input.replace(re, replace) };
  }

  // 字面量模式：用函数替换避免替换串中的 $ 被解释
  const re = new RegExp(escapeRegExp(find), flags);
  return { result: input.replace(re, () => replace) };
}

/** 撤销/重做历史栈接口。 */
export interface History {
  /** 当前状态值。 */
  current(): string;
  /** 推入新状态；若处于已撤销的中段，先截断后续 redo 分支。 */
  push(value: string): void;
  /** 撤销一步，返回上一状态；无可撤销时返回 null。 */
  undo(): string | null;
  /** 重做一步，返回下一状态；无可重做时返回 null。 */
  redo(): string | null;
  /** 是否可撤销。 */
  canUndo(): boolean;
  /** 是否可重做。 */
  canRedo(): boolean;
  /** 重置为给定初值并清空历史（仅该初值，不可撤销）。 */
  reset(value: string): void;
}

/**
 * 创建一个有上限的撤销/重做历史栈。
 *
 * 采用标准 undo 语义：在中段（已 undo）插入新状态时截断后续分支；
 * 超过 `limit` 时丢弃最早记录。
 * @param limit - 历史记录上限，默认 50
 * @returns 历史栈实例
 */
export function createHistory(limit = 50): History {
  let stack: string[] = [];
  let pointer = -1;

  return {
    current() {
      return pointer >= 0 ? stack[pointer] : '';
    },
    push(value: string) {
      stack = stack.slice(0, pointer + 1);
      stack.push(value);
      if (stack.length > limit) stack.shift();
      pointer = stack.length - 1;
    },
    undo() {
      if (pointer <= 0) return null;
      pointer--;
      return stack[pointer];
    },
    redo() {
      if (pointer >= stack.length - 1) return null;
      pointer++;
      return stack[pointer];
    },
    canUndo() {
      return pointer > 0;
    },
    canRedo() {
      return pointer < stack.length - 1;
    },
    reset(value: string) {
      stack = [value];
      pointer = 0;
    },
  };
}
