/**
 * 颜色空间转换纯函数模块。
 *
 * 以 RGB 为枢纽：HEX ⇄ RGB ⇄ HSL/HSV，所有空间互转经 RGB 中转，
 * 避免维护 N×N 转换矩阵。所有函数为纯函数，可独立单测。
 */

/** RGB 颜色，三通道 0–255 整数 */
export interface RGB {
  /** 红色通道 0–255 */
  r: number;
  /** 绿色通道 0–255 */
  g: number;
  /** 蓝色通道 0–255 */
  b: number;
}

/** HSL 颜色，h: 0–360，s/l: 0–100 */
export interface HSL {
  /** 色相 0–360 */
  h: number;
  /** 饱和度 0–100 */
  s: number;
  /** 亮度 0–100 */
  l: number;
}

/** HSV（HSB）颜色，h: 0–360，s/v: 0–100 */
export interface HSV {
  /** 色相 0–360 */
  h: number;
  /** 饱和度 0–100 */
  s: number;
  /** 明度 0–100 */
  v: number;
}

/** HEX 解析正则：3 位或 6 位十六进制，可选 # 前缀，大小写不敏感 */
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * 将单个 RGB 通道值钳制并四舍五入到 0–255 整数。
 * @param n - 原始通道值
 * @returns 0–255 整数
 */
function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * 将 HEX 字符串解析为 RGB。
 *
 * 支持 `#RGB` / `#RRGGBB`（带或不带 `#`、大小写均可）；3 位简写自动展开为 6 位。
 * @param hex - HEX 颜色字符串
 * @returns RGB 对象；非法输入返回 null
 */
export function hexToRgb(hex: string): RGB | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;

  let digits = match[1];
  if (digits.length === 3) {
    // 3 位简写：每字符重复一次展开为 6 位
    digits = digits
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  const num = parseInt(digits, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

/**
 * 将 RGB 转换为 6 位 HEX 字符串（小写，带 #）。
 *
 * 通道值越界时自动钳制到 0–255。
 * @param rgb - RGB 对象
 * @returns 形如 `#rrggbb` 的字符串
 */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 将 0–1 范围外的浮点钳制到 [0,1] */
function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * RGB → HSL。
 * @param rgb - RGB 对象
 * @returns HSL 对象（h:0–360, s/l:0–100）
 */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = (((gn - bn) / delta) % 6) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * HSL → RGB。输入越界（h/s/l 超范围）自动钳制。
 * @param hsl - HSL 对象（h:0–360, s/l:0–100）
 * @returns RGB 对象
 */
export function hslToRgb({ h, s, l }: HSL): RGB {
  const hn = (((h % 360) + 360) % 360); // 归一化到 0–360
  const sn = clampUnit(s / 100);
  const ln = clampUnit(l / 100);

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hn < 60) {
    r1 = c; g1 = x;
  } else if (hn < 120) {
    r1 = x; g1 = c;
  } else if (hn < 180) {
    g1 = c; b1 = x;
  } else if (hn < 240) {
    g1 = x; b1 = c;
  } else if (hn < 300) {
    r1 = x; b1 = c;
  } else {
    r1 = c; b1 = x;
  }

  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}
