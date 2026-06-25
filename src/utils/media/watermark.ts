// src/utils/media/watermark.ts
/**
 * 文字水印：位置计算（纯函数，可单测）+ Canvas 绘制。
 *
 * 位置模型为「九宫格 + 平铺」：单点模式取 9 个锚位之一，平铺模式按网格密度铺满。
 * 绘制依赖浏览器 Canvas 2D API（同 `image-convert.ts` 的约定，不做单测）。
 */

/** 水印锚位：九宫格 9 个位置 + 平铺。 */
export type WatermarkSlot =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'tile';

/** 文本水平对齐（Canvas textAlign 的子集）。 */
export type WatermarkAlign = 'left' | 'center' | 'right';
/** 文本垂直基线（Canvas textBaseline 的子集）。 */
export type WatermarkBaseline = 'top' | 'middle' | 'bottom';

/** 计算出的单个水印锚点：坐标 + 对齐方式。 */
export interface WatermarkAnchor {
  /** 锚点 x 坐标（像素） */
  x: number;
  /** 锚点 y 坐标（像素） */
  y: number;
  /** 水平对齐 */
  align: WatermarkAlign;
  /** 垂直基线 */
  baseline: WatermarkBaseline;
}

/** 决定水印位置布局的选项（与文本外观解耦，便于纯函数计算与单测）。 */
export interface WatermarkLayoutOptions {
  /** 锚位或平铺 */
  slot: WatermarkSlot;
  /** 单点模式下距画布边缘的边距（像素） */
  padding: number;
  /** 平铺模式下网格间距（像素） */
  tileGap: number;
}

/** 完整水印选项（外观 + 布局），供 {@link drawWatermark} 使用。 */
export interface WatermarkOptions extends WatermarkLayoutOptions {
  /** 水印文本（空串则不绘制） */
  text: string;
  /** 字号（像素） */
  fontSize: number;
  /** CSS 颜色值，如 `#ffffff` */
  color: string;
  /** 不透明度 0-1 */
  opacity: number;
  /** 旋转角度（度，顺时针） */
  rotation: number;
}

/** 默认水印参数（组件初始化用）。 */
export const DEFAULT_WATERMARK: WatermarkOptions = {
  text: '© 你的名字',
  fontSize: 28,
  color: '#ffffff',
  opacity: 0.5,
  rotation: -30,
  slot: 'bottom-right',
  padding: 24,
  tileGap: 180,
};

/** 九宫格锚位的对齐方式（列决定 align，行决定 baseline）。 */
const SLOT_ALIGN: Record<Exclude<WatermarkSlot, 'tile'>, WatermarkAlign> = {
  'top-left': 'left',
  'top-center': 'center',
  'top-right': 'right',
  'middle-left': 'left',
  center: 'center',
  'middle-right': 'right',
  'bottom-left': 'left',
  'bottom-center': 'center',
  'bottom-right': 'right',
};

/** 九宫格锚位的基线（行决定 baseline）。 */
const SLOT_BASELINE: Record<Exclude<WatermarkSlot, 'tile'>, WatermarkBaseline> = {
  'top-left': 'top',
  'top-center': 'top',
  'top-right': 'top',
  'middle-left': 'middle',
  center: 'middle',
  'middle-right': 'middle',
  'bottom-left': 'bottom',
  'bottom-center': 'bottom',
  'bottom-right': 'bottom',
};

/**
 * 按布局选项计算水印锚点列表。
 *
 * 单点模式返回 1 个锚点（九宫格位置 + 对应对齐）；
 * 平铺模式按 `tileGap` 网格铺满画布，所有点统一居中对齐，
 * 网格列数为 `ceil(width/tileGap)+1`、行数为 `ceil(height/tileGap)+1`，确保覆盖到边界。
 *
 * @param width 画布宽度
 * @param height 画布高度
 * @param opts 布局选项
 * @returns 锚点数组
 */
export function computeWatermarkPositions(
  width: number,
  height: number,
  opts: WatermarkLayoutOptions,
): WatermarkAnchor[] {
  const { slot, padding, tileGap } = opts;

  if (slot === 'tile') {
    const cols = Math.ceil(width / tileGap) + 1;
    const rows = Math.ceil(height / tileGap) + 1;
    const anchors: WatermarkAnchor[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        anchors.push({ x: c * tileGap, y: r * tileGap, align: 'center', baseline: 'middle' });
      }
    }
    return anchors;
  }

  const align = SLOT_ALIGN[slot];
  const baseline = SLOT_BASELINE[slot];
  let x: number;
  let y: number;
  if (align === 'left') x = padding;
  else if (align === 'right') x = width - padding;
  else x = width / 2;
  if (baseline === 'top') y = padding;
  else if (baseline === 'bottom') y = height - padding;
  else y = height / 2;
  return [{ x, y, align, baseline }];
}

/**
 * 在 Canvas 2D 上下文上绘制文字水印。
 *
 * 设置字号/颜色/不透明度后，对每个锚点平移并旋转，按对齐方式绘制文本。
 * 文本为空白时不绘制。依赖浏览器 Canvas API，不做单测。
 *
 * @param ctx Canvas 2D 上下文（已绘制完图像内容）
 * @param width 画布宽度
 * @param height 画布高度
 * @param opts 完整水印选项
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: WatermarkOptions,
): void {
  if (!opts.text.trim()) return;
  const anchors = computeWatermarkPositions(width, height, opts);
  const opacity = Math.max(0, Math.min(1, opts.opacity));

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = opts.color;
  ctx.font = `${opts.fontSize}px sans-serif`;
  for (const a of anchors) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate((opts.rotation * Math.PI) / 180);
    ctx.textAlign = a.align;
    ctx.textBaseline = a.baseline;
    ctx.fillText(opts.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
