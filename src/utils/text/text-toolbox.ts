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
