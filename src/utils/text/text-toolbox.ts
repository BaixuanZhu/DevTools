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
 * 将每行内部连续空白（空格/制表符）合并为单个空格，并去除该行首尾空白。
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
