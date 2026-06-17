/**
 * CSS 长度单位转换工具模块。
 *
 * 以 px 为中间单位，实现 px / rem / em / vw / vh / % / pt 的实时互转。
 * 所有函数均为纯函数，可独立单元测试。
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

/** 将任意单位的值转换为 px */
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
      return value / 0.75;
    default:
      return value;
  }
}

/** 将 px 转换为目标单位 */
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
      return px * 0.75;
    default:
      return px;
  }
}

/** 根据最后编辑的单位，计算所有单位的值 */
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

/** 将数值格式化为最多 4 位有效数字，去掉末尾 0 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toPrecision(4);
  // parseFloat 会自动把科学计数法转为普通数字字符串并去掉末尾 0
  return parseFloat(s).toString();
}

/** 校验输入字符串是否为有效正数 */
export function isValidNumberInput(input: string): boolean {
  if (!input || input.trim() === '') return false;
  const num = Number(input);
  return Number.isFinite(num) && num >= 0;
}

/** 生成「复制全部结果」的文本 */
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
