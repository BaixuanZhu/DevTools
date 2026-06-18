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
