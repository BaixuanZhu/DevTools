/**
 * 二维码生成工具模块。
 *
 * - 提供 PNG DataURL / SVG 字符串两种输出
 * - 提供输入校验（容量超限检测）、颜色对比度警告
 * - 浏览器端运行，无 Node 依赖
 * - 通过 dynamic import 加载 qrcode 库，规避 SSR/测试环境的 canvas 依赖
 */

/** 二维码容错级别（从低到高，可恢复的数据比例逐渐增大） */
export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H';

/** 容错级别选项（供 UI 组件复用） */
export const QR_ERROR_LEVELS: ReadonlyArray<{
  value: QrErrorLevel;
  label: string;
  description: string;
}> = [
  { value: 'L', label: '低 (L)', description: '约 7% 容错，适合清洁环境' },
  { value: 'M', label: '中 (M)', description: '约 15% 容错，推荐默认' },
  { value: 'Q', label: '较高 (Q)', description: '约 25% 容错，可叠加小图标' },
  { value: 'H', label: '高 (H)', description: '约 30% 容错，适合复杂环境' },
];

/** 默认前景色（暗色模块） */
export const QR_DEFAULT_FOREGROUND = '#000000';
/** 默认背景色（亮色模块） */
export const QR_DEFAULT_BACKGROUND = '#FFFFFF';
/** 默认输出尺寸（px），用于预览 */
export const QR_DEFAULT_SIZE = 256;
/** 最小允许尺寸（px） */
export const QR_MIN_SIZE = 64;
/** 最大允许尺寸（px） */
export const QR_MAX_SIZE = 1024;

/** 下载时默认尺寸（px） */
export const QR_DOWNLOAD_DEFAULT_SIZE = 512;
/** 下载时最小允许尺寸（px） */
export const QR_DOWNLOAD_MIN_SIZE = 128;
/** 下载时最大允许尺寸（px） */
export const QR_DOWNLOAD_MAX_SIZE = 2048;

/** 二维码生成配置项 */
export interface QrGenerateOptions {
  /** 输出尺寸（px），默认 256 */
  size?: number;
  /** 容错级别，默认 'M' */
  errorLevel?: QrErrorLevel;
  /** 前景色（暗色模块），默认 #000000 */
  foreground?: string;
  /** 背景色（亮色模块），默认 #FFFFFF */
  background?: string;
  /** 安静区宽度（模块数），默认 2 */
  margin?: number;
}

/**
 * 动态加载 qrcode 库，规避 SSR/测试环境下顶层 import 触发的 canvas native 绑定加载。
 *
 * @returns qrcode 库的主对象（含 toDataURL / toString 等方法）
 */
async function loadQRCode(): Promise<typeof import('qrcode')> {
  const mod = await import('qrcode');
  // qrcode 包的 default export 是主对象；若打包工具未保留 default，则直接返回 mod
  return ((mod as unknown as { default?: typeof import('qrcode') }).default ?? mod);
}

/**
 * 将 qrcode 库抛出的错误信息翻译为中文友好提示。
 *
 * @param e 原始异常对象（通常来自 qrcode 库）
 * @returns 中文错误描述
 */
function translateQrError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (msg.includes('too big')) {
    return '文本过长，无法在当前容错级别下编码。建议：1) 缩短文本；2) 降低容错级别（H → M → L）；3) 标准 QR 码最大约 4296 字符';
  }
  if (msg.includes('Invalid')) {
    return '输入包含无法编码的字符';
  }
  return msg || '生成二维码时出错';
}

/**
 * 将 #RRGGBB 格式的颜色解析为 RGB 三元组。
 *
 * @param hex 形如 `#RRGGBB` 或 `RRGGBB` 的颜色字符串
 * @returns RGB 对象，格式非法时返回 null
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * 按 WCAG 公式计算颜色的相对亮度（0–1）。
 *
 * @param rgb RGB 三元组（0–255）
 * @returns 相对亮度值
 */
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * 生成 PNG 格式的 DataURL。
 *
 * @param text 要编码的文本
 * @param options 配置项（尺寸、容错级别、颜色、安静区）
 * @returns PNG DataURL，形如 `data:image/png;base64,...`
 * @throws 文本为空、超长或包含非法字符时抛出中文错误
 */
export async function generateQrPngDataUrl(
  text: string,
  options: QrGenerateOptions = {},
): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error('输入文本不能为空');
  }
  const QRCode = await loadQRCode();
  try {
    return await QRCode.toDataURL(text, {
      width: options.size ?? QR_DEFAULT_SIZE,
      errorCorrectionLevel: options.errorLevel ?? 'M',
      margin: options.margin ?? 2,
      color: {
        dark: options.foreground ?? QR_DEFAULT_FOREGROUND,
        light: options.background ?? QR_DEFAULT_BACKGROUND,
      },
    });
  } catch (e) {
    throw new Error(translateQrError(e));
  }
}

/**
 * 生成 SVG 字符串。
 *
 * @param text 要编码的文本
 * @param options 配置项（尺寸、容错级别、颜色、安静区）
 * @returns SVG 标记字符串
 * @throws 文本为空、超长或包含非法字符时抛出中文错误
 */
export async function generateQrSvgString(
  text: string,
  options: QrGenerateOptions = {},
): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error('输入文本不能为空');
  }
  const QRCode = await loadQRCode();
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: options.size ?? QR_DEFAULT_SIZE,
      errorCorrectionLevel: options.errorLevel ?? 'M',
      margin: options.margin ?? 2,
      color: {
        dark: options.foreground ?? QR_DEFAULT_FOREGROUND,
        light: options.background ?? QR_DEFAULT_BACKGROUND,
      },
    });
  } catch (e) {
    throw new Error(translateQrError(e));
  }
}

/**
 * 校验输入是否合法（主要用于实时反馈容量超限）。
 * 空白输入视为"待输入"状态，不报错。
 *
 * @param text 输入文本
 * @param errorLevel 容错级别（容错级别越高，可编码字符越少）
 * @returns 错误消息；合法或空白输入时返回空字符串
 */
export async function validateQrInput(
  text: string,
  errorLevel: QrErrorLevel,
): Promise<string> {
  if (!text || !text.trim()) return '';
  try {
    const QRCode = await loadQRCode();
    // 使用 utf8 输出做轻量编码测试，比实际渲染 SVG/PNG 更快
    await QRCode.toString(text, { type: 'utf8', errorCorrectionLevel: errorLevel });
    return '';
  } catch (e) {
    return translateQrError(e);
  }
}

/**
 * 检测前景色和背景色的对比度，过低时给出警告。
 * 使用 WCAG 相对亮度公式，阈值 3.0（对图形元素比正文 4.5 宽松）。
 *
 * @param foreground 前景色 hex（#RRGGBB）
 * @param background 背景色 hex（#RRGGBB）
 * @returns 警告文案；对比度足够或颜色格式非法时返回空字符串
 */
export function getContrastWarning(foreground: string, background: string): string {
  const f = hexToRgb(foreground);
  const b = hexToRgb(background);
  if (!f || !b) return '';
  const lf = relativeLuminance(f);
  const lb = relativeLuminance(b);
  const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
  if (ratio < 3.0) {
    return `颜色对比度过低（${ratio.toFixed(2)}:1），可能导致扫码失败，建议加深前景色或浅化背景色`;
  }
  return '';
}

/**
 * 浏览器端触发文件下载。
 * 接受 DataURL 字符串或 Blob 对象，自动创建临时 <a> 触发点击。
 *
 * @param dataUrlOrBlob DataURL 字符串或 Blob 对象
 * @param filename 下载文件名（含扩展名）
 */
export function downloadFile(dataUrlOrBlob: string | Blob, filename: string): void {
  const isBlob = typeof dataUrlOrBlob !== 'string';
  const url = isBlob ? URL.createObjectURL(dataUrlOrBlob) : dataUrlOrBlob;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (isBlob) {
    // 延迟释放 ObjectURL，确保浏览器已开始下载；setTimeout 接收函数而非字符串，符合安全规则
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * 从 SVG 根标签剥离 `width` / `height` 属性，保留 `viewBox` 与其他属性。
 *
 * 用途：让预览 SVG 自适应父容器宽度（浏览器在只有 viewBox 时默认 width=100% / height=auto），
 * 而原始 SVG 字符串（用于复制、下载文件）保持不变 —— 扫码软件依赖固定 width/height 正确显示。
 *
 * 实现要点：
 * - 只处理第一个 `<svg>` 标签（QR 输出仅有一个根 svg）
 * - 大小写不敏感（兼容 `WIDTH` 等异常输入）
 * - 属性值可带或不带引号
 * - 输入不含 width/height 时原样返回
 *
 * @param svg 完整 SVG 字符串
 * @returns 剥离 width/height 后的 SVG 字符串
 * @example
 * stripSvgSize('<svg width="200" height="200" viewBox="0 0 200 200">...</svg>')
 * // → '<svg viewBox="0 0 200 200">...</svg>'
 */
export function stripSvgSize(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    const cleaned = attrs
      .replace(/\s+width\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '')
      .replace(/\s+height\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return `<svg${cleaned}>`;
  });
}
