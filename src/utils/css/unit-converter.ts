/**
 * CSS 长度单位转换工具模块。
 *
 * 以 px 为中间单位，实现 px / rem / em / vw / vh / % / pt 的实时互转。
 * 所有函数均为纯函数，可独立单元测试。
 *
 * 语义说明：
 * - `%`（pct）被解释为「相对于根字体大小的百分比」，即 100% = rootFontSize px。
 */

/** 支持的单位键 */
export type UnitKey = 'px' | 'rem' | 'em' | 'vw' | 'vh' | 'pct' | 'pt';

/** 单位显示标签 */
export const UNIT_LABELS: Record<UnitKey, string> = {
  px: 'px',
  rem: 'rem',
  em: 'em',
  vw: 'vw',
  vh: 'vh',
  pct: '%',
  pt: 'pt',
};

/** 单位顺序（页面展示用） */
export const UNIT_ORDER: UnitKey[] = ['px', 'rem', 'em', 'vw', 'vh', 'pct', 'pt'];

/** 1 px = 0.75 pt（物理单位换算系数） */
const PX_PER_PT = 0.75;

/**
 * 将任意单位的值转换为 px。
 *
 * `%`（pct）被解释为「相对于 rootFontSize 的百分比」，即 100% = rootFontSize px。
 * @param value - 原始数值
 * @param unit - 原始单位
 * @param context - 转换上下文（根字体大小、设计稿宽度、视口高度）
 * @returns 对应的 px 值
 */
export function toPx(
  value: number,
  unit: UnitKey,
  context: {
    rootFontSize: number;
    designWidth: number;
    viewportHeight: number;
  }
): number {
  switch (unit) {
    case 'px':
      return value;
    case 'rem':
    case 'em':
      return value * context.rootFontSize;
    case 'vw':
      return (value * context.designWidth) / 100;
    case 'vh':
      return (value * context.viewportHeight) / 100;
    case 'pct':
      return (value * context.rootFontSize) / 100;
    case 'pt':
      return value / PX_PER_PT;
    default:
      return value;
  }
}

/**
 * 将 px 转换为目标单位。
 *
 * `%`（pct）被解释为「相对于 rootFontSize 的百分比」，即 100% = rootFontSize px。
 * @param px - px 数值
 * @param unit - 目标单位
 * @param context - 转换上下文（根字体大小、设计稿宽度、视口高度）
 * @returns 对应目标单位的值
 */
export function fromPx(
  px: number,
  unit: UnitKey,
  context: {
    rootFontSize: number;
    designWidth: number;
    viewportHeight: number;
  }
): number {
  switch (unit) {
    case 'px':
      return px;
    case 'rem':
    case 'em':
      return px / context.rootFontSize;
    case 'vw':
      return (px / context.designWidth) * 100;
    case 'vh':
      return (px / context.viewportHeight) * 100;
    case 'pct':
      return (px / context.rootFontSize) * 100;
    case 'pt':
      return px * PX_PER_PT;
    default:
      return px;
  }
}

/**
 * 根据最后编辑的单位，计算所有单位的值。
 * @param sourceValue - 源数值
 * @param sourceUnit - 源单位
 * @param context - 转换上下文
 * @returns 各单位的转换结果
 */
export function convertAll(
  sourceValue: number,
  sourceUnit: UnitKey,
  context: {
    rootFontSize: number;
    designWidth: number;
    viewportHeight: number;
  }
): Record<UnitKey, number> {
  const px = toPx(sourceValue, sourceUnit, context);
  const result = {} as Record<UnitKey, number>;
  for (const unit of UNIT_ORDER) {
    result[unit] = fromPx(px, unit, context);
  }
  return result;
}

/**
 * 将数值格式化为最多 4 位小数，去掉末尾多余的 0。
 * @param n - 待格式化的数值
 * @returns 格式化后的字符串；非有限值返回 —
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  // 将 -0 归一化为 0，避免 UI 显示 "-0"
  const normalized = Object.is(n, -0) ? 0 : n;
  return parseFloat(normalized.toFixed(4)).toString();
}

/**
 * 校验输入字符串是否为有效非负数。
 * @param input - 用户输入字符串
 * @returns 是否为有效非负数
 */
export function isValidNumberInput(input: string): boolean {
  if (!input || input.trim() === '') return false;
  const num = Number(input);
  return Number.isFinite(num) && num >= 0;
}

/**
 * 生成「复制全部结果」的文本。
 * @param values - 各单位格式化后的值
 * @param sourceUnit - 当前源单位
 * @returns 多行转换等式文本
 */
export function buildCopyText(
  values: Record<UnitKey, string>,
  sourceUnit: UnitKey
): string {
  const sourceValue = values[sourceUnit];
  const lines: string[] = [];
  for (const unit of UNIT_ORDER) {
    if (unit === sourceUnit) continue;
    const value = values[unit];
    if (value === '' || value === '—') continue;
    lines.push(`${sourceValue}${UNIT_LABELS[sourceUnit]} = ${value}${UNIT_LABELS[unit]}`);
  }
  return lines.join('\n');
}
