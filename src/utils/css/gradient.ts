/**
 * CSS 渐变生成工具模块。
 *
 * 负责根据渐变类型、参数和色标数组生成标准 CSS 渐变字符串。
 * 所有函数均为纯函数，可独立单元测试。
 */

/** 渐变类型 */
export type GradientType = 'linear' | 'radial' | 'conic';

/** 色标 */
export interface ColorStop {
  /** 唯一标识 */
  id: string;
  /** 颜色字符串（hex/rgb/hsl） */
  color: string;
  /** 位置 0–100 */
  position: number;
}

/** 径向形状 */
export type RadialShape = 'circle' | 'ellipse';

/** 渐变参数 */
export interface GradientOptions {
  type: GradientType;
  angle: number;
  centerX: number;
  centerY: number;
  shape: RadialShape;
  stops: ColorStop[];
}

/** 预设渐变 */
export interface GradientPreset {
  name: string;
  stops: ColorStop[];
}

/**
 * 生成唯一 ID。
 * @returns 基于时间戳与随机数的唯一字符串
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 钳制位置到 0–100。
 * @param position - 原始位置值
 * @returns 钳制后的 0–100 数值
 */
export function clampPosition(position: number): number {
  return Math.max(0, Math.min(100, position));
}

/**
 * 将角度归一化到 0–360。
 * @param angle - 原始角度值
 * @returns 归一化后的 0–360 整数
 */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  return ((((Math.round(angle) || 0) % 360) + 360) % 360);
}

/**
 * 简单的 HEX / rgb / hsl 颜色正则校验（宽松）。
 * @param color - 待校验的颜色字符串
 * @returns 是否通过校验
 */
export function isValidColor(color: string): boolean {
  if (!color || typeof color !== 'string') return false;
  const trimmed = color.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return true;
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(trimmed)) return true;
  if (/^rgba\(/i.test(trimmed)) return true;
  if (/^hsl\(/i.test(trimmed)) return true;
  return false;
}

/** 兜底颜色 */
export const FALLBACK_COLOR = '#000000';

/**
 * 规范化颜色（无效时返回兜底色）。
 * @param color - 原始颜色字符串
 * @returns 有效颜色或兜底色
 */
export function normalizeColor(color: string): string {
  return isValidColor(color) ? color.trim() : FALLBACK_COLOR;
}

/**
 * 按 position 排序色标，相同位置保持原顺序。
 * @param stops - 色标数组
 * @returns 排序后的新数组
 */
export function sortStops(stops: ColorStop[]): ColorStop[] {
  return [...stops].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return 0;
  });
}

/**
 * 生成色标 CSS 片段。
 * @param stop - 色标对象
 * @returns CSS 色标字符串，如 `#ff0000 50.0%`
 */
export function buildStopString(stop: ColorStop): string {
  const color = normalizeColor(stop.color);
  return `${color} ${stop.position.toFixed(1)}%`;
}

/**
 * 生成完整 CSS 渐变字符串。
 * @param options - 渐变参数
 * @returns CSS `gradient(...)` 字符串
 */
export function buildGradientCss(options: GradientOptions): string {
  const sorted = sortStops(options.stops);
  const stopsString = sorted.map(buildStopString).join(', ');

  switch (options.type) {
    case 'linear':
      return `linear-gradient(${normalizeAngle(options.angle)}deg, ${stopsString})`;
    case 'radial': {
      const shape = options.shape;
      const center = `${options.centerX.toFixed(1)}% ${options.centerY.toFixed(1)}%`;
      return `radial-gradient(${shape} at ${center}, ${stopsString})`;
    }
    case 'conic': {
      const center = `${options.centerX.toFixed(1)}% ${options.centerY.toFixed(1)}%`;
      return `conic-gradient(from ${normalizeAngle(options.angle)}deg at ${center}, ${stopsString})`;
    }
    default:
      return `linear-gradient(90deg, ${stopsString})`;
  }
}

/**
 * 生成默认色标。
 * @returns 包含两个默认色标的数组
 */
export function createDefaultStops(): ColorStop[] {
  return [
    { id: generateId(), color: '#ff7e5f', position: 0 },
    { id: generateId(), color: '#feb47b', position: 100 },
  ];
}

/**
 * 在指定位置插入新色标，新色标颜色使用默认灰 #808080。
 * @param stops - 现有色标数组
 * @param position - 插入位置 0–100
 * @returns 插入新色标后的数组
 */
export function insertStop(stops: ColorStop[], position: number): ColorStop[] {
  const clamped = clampPosition(position);
  const sorted = sortStops(stops);
  const newStop: ColorStop = {
    id: generateId(),
    color: '#808080',
    position: clamped,
  };

  // 找到插入位置
  let insertIndex = sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].position > clamped) {
      insertIndex = i;
      break;
    }
  }

  return [
    ...sorted.slice(0, insertIndex),
    newStop,
    ...sorted.slice(insertIndex),
  ];
}

/**
 * 删除指定 ID 的色标，保留至少 2 个。
 * @param stops - 色标数组
 * @param id - 要删除的色标 ID
 * @returns 删除后的新数组（长度不足 2 时返回原数组）
 */
export function removeStop(stops: ColorStop[], id: string): ColorStop[] {
  if (stops.length <= 2) return stops;
  return stops.filter((s) => s.id !== id);
}

/** 预设渐变 */
export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    name: '日落',
    stops: [
      { id: 'preset-sunset-1', color: '#ff7e5f', position: 0 },
      { id: 'preset-sunset-2', color: '#feb47b', position: 100 },
    ],
  },
  {
    name: '海洋',
    stops: [
      { id: 'preset-ocean-1', color: '#2193b0', position: 0 },
      { id: 'preset-ocean-2', color: '#6dd5ed', position: 100 },
    ],
  },
  {
    name: '霓虹',
    stops: [
      { id: 'preset-neon-1', color: '#f857a6', position: 0 },
      { id: 'preset-neon-2', color: '#ff5858', position: 100 },
    ],
  },
];
