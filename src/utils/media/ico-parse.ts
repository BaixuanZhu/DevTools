/**
 * ICO / CUR 文件字节级解析。
 *
 * 只做纯字节操作（node 环境可测）：ICONDIR / ICONDIRENTRY 解析、条目内嵌格式
 * 判定、BMP 条目文件头重建；Blob 下载与 Image 解码等浏览器行为留给组件层。
 *
 * 文件结构：ICONDIR(6B) + N×ICONDIRENTRY(16B) + 各条目图像数据依次排列。
 */

// ==================== 类型 ====================

/** ICO 条目内嵌图像格式：PNG（Vista+ 主流）或 BMP（旧版 Windows 图标） */
export type IcoEntryFormat = 'png' | 'bmp';

/** 解析出的单个 ICO 条目 */
export interface IcoEntry {
  /** 条目在目录表中的序号（从 0 开始） */
  index: number;
  /** 图标宽度（px），目录项 0 按规范表示 256 */
  width: number;
  /** 图标高度（px），目录项 0 按规范表示 256 */
  height: number;
  /** 调色板颜色数（0 表示无调色板） */
  colorCount: number;
  /** 色深（bpp），取目录项声明值 */
  bitCount: number;
  /** 平面数（.ico 规范为 0/1；.cur 中该字段是热点 X 坐标） */
  planes: number;
  /**
   * 条目原始数据（独立副本，不引用源文件缓冲，可直接封装 Blob）。
   * 类型锚定 ArrayBuffer：parseIco 始终通过 slice 复制，满足 BlobPart 要求。
   */
  bytes: Uint8Array<ArrayBuffer>;
  /** 内嵌图像格式 */
  format: IcoEntryFormat;
  /** 是否光标文件（目录 type=2，即 .cur） */
  isCursor: boolean;
}

/** parseIco 的解析结果 */
export interface ParsedIco {
  /** 文件类型：icon=.ico 图标，cursor=.cur 光标 */
  type: 'icon' | 'cursor';
  /** 条目列表（按目录表顺序排列） */
  entries: IcoEntry[];
}

// ==================== 内部常量 ====================

/** BITMAPINFOHEADER 系列头长度（40=INFOHEADER，108=V4HEADER，124=V5HEADER） */
const BMP_HEADER_SIZES = new Set([40, 108, 124]);

/** ICONDIR + 单个 ICONDIRENTRY 的最小合法文件长度 */
const MIN_ICO_BYTES = 6;

// ==================== 解析 ====================

/**
 * 解析 ICO / CUR 文件字节为结构化条目列表。
 *
 * @param bytes 文件完整字节
 * @returns 文件类型与条目列表
 * @throws 文件过小、文件头非法、数据被截断或条目内嵌格式无法识别时抛出中文错误
 */
export function parseIco(bytes: Uint8Array): ParsedIco {
  if (bytes.length < MIN_ICO_BYTES) {
    throw new Error('ICO 解析失败：文件过小，不是有效的 ICO / CUR 文件');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reserved = view.getUint16(0, true);
  const type = view.getUint16(2, true);
  const count = view.getUint16(4, true);

  if (reserved !== 0) {
    throw new Error('ICO 解析失败：文件头校验不通过，文件可能已损坏');
  }
  if (type !== 1 && type !== 2) {
    throw new Error('ICO 解析失败：不支持的文件类型（既非图标也非光标）');
  }
  if (count === 0) {
    throw new Error('ICO 解析失败：文件不含任何图像条目');
  }

  const entries: IcoEntry[] = [];
  for (let i = 0; i < count; i++) {
    const base = 6 + 16 * i;
    if (base + 16 > bytes.length) {
      throw new Error('ICO 解析失败：目录表数据不完整，文件可能被截断');
    }
    const dirWidth = view.getUint8(base);
    const dirHeight = view.getUint8(base + 1);
    const colorCount = view.getUint8(base + 2);
    const planes = view.getUint16(base + 4, true);
    const bitCount = view.getUint16(base + 6, true);
    const bytesInRes = view.getUint32(base + 8, true);
    const imageOffset = view.getUint32(base + 12, true);

    if (imageOffset + bytesInRes > bytes.length) {
      throw new Error(`ICO 解析失败：第 ${i + 1} 个条目的图像数据超出文件范围，文件可能被截断`);
    }
    // slice 复制为独立字节，避免 Blob 长期引用整个源文件缓冲
    const data = bytes.slice(imageOffset, imageOffset + bytesInRes);
    entries.push({
      index: i,
      width: dirWidth === 0 ? 256 : dirWidth,
      height: dirHeight === 0 ? 256 : dirHeight,
      colorCount,
      bitCount,
      planes,
      bytes: data,
      format: detectEntryFormat(data),
      isCursor: type === 2,
    });
  }

  return { type: type === 2 ? 'cursor' : 'icon', entries };
}

/**
 * 判定条目数据的内嵌格式：PNG 魔数（\x89PNG）优先，否则按 BITMAPINFOHEADER
 * 的 biSize（40/108/124）判 BMP。
 *
 * @param data 条目原始字节
 * @returns 内嵌格式
 * @throws 两者都不匹配（数据损坏）时抛出中文错误
 */
function detectEntryFormat(data: Uint8Array): IcoEntryFormat {
  if (
    data.length >= 4 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
  ) {
    return 'png';
  }
  if (data.length >= 4) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (BMP_HEADER_SIZES.has(view.getUint32(0, true))) return 'bmp';
  }
  throw new Error('ICO 解析失败：存在无法识别的内嵌图像数据，文件可能已损坏');
}

// ==================== 条目提取 ====================

/**
 * 将 PNG 内嵌条目直接封装为独立 PNG Blob（同步，零解码零转码）。
 *
 * @param entry PNG 格式条目
 * @returns image/png Blob
 * @throws 条目不是 PNG 格式时抛出（BMP 条目应走 buildBmpFromIcoEntry）
 */
export function icoEntryToPng(entry: IcoEntry): Blob {
  if (entry.format !== 'png') {
    throw new Error('该条目不是 PNG 内嵌数据，请通过 BMP 重建流程提取');
  }
  return new Blob([entry.bytes], { type: 'image/png' });
}

/**
 * 将 BMP 内嵌条目重建为独立 BMP 文件 Blob（同步纯字节运算）。
 *
 * ICO 内的 BMP 没有 BITMAPFILEHEADER，且 biHeight = XOR 像素面 + AND 掩码面
 * （两倍图像高）。本函数补写 14 字节文件头（'BM' + 文件大小 + 像素数据偏移）
 * 并把 biHeight 减半，还原为标准独立 BMP，供浏览器 Image 解码转 PNG。
 *
 * @param entry BMP 格式条目
 * @returns image/bmp Blob
 * @throws 条目不是 BMP 格式或信息头不完整时抛出中文错误
 */
export function buildBmpFromIcoEntry(entry: IcoEntry): Blob {
  if (entry.format !== 'bmp') {
    throw new Error('该条目不是 BMP 内嵌数据，可直接作为 PNG 提取');
  }
  // BITMAPINFOHEADER 最短 40 字节，biClrUsed 位于偏移 32（u32）
  if (entry.bytes.length < 40) {
    throw new Error('ICO 解析失败：BMP 条目信息头不完整，文件可能已损坏');
  }
  const view = new DataView(entry.bytes.buffer, entry.bytes.byteOffset, entry.bytes.byteLength);
  const biSize = view.getUint32(0, true);
  const biHeight = view.getInt32(8, true);
  const biBitCount = view.getUint16(14, true);
  const biClrUsed = view.getUint32(32, true);

  // 调色板字节数：显式 biClrUsed 优先；未声明时按色深推导（≤8bpp 必带调色板，RGBQUAD 每项 4 字节）
  const paletteBytes =
    biClrUsed > 0 ? biClrUsed * 4 : biBitCount <= 8 ? 2 ** biBitCount * 4 : 0;

  // BITMAPFILEHEADER(14B)：'BM' + bfSize + 两个保留字段(0) + bfOffBits
  const header = new Uint8Array(14);
  header[0] = 0x42; // 'B'
  header[1] = 0x4d; // 'M'
  const headerView = new DataView(header.buffer);
  headerView.setUint32(2, 14 + entry.bytes.length, true); // bfSize = 文件头 + 条目数据
  headerView.setUint32(10, 14 + biSize + paletteBytes, true); // bfOffBits 像素数据偏移

  // 复制条目数据并把 biHeight 减半：独立 BMP 不含 AND 掩码面
  const body = entry.bytes.slice();
  new DataView(body.buffer, body.byteOffset, body.byteLength).setInt32(
    8,
    Math.round(biHeight / 2),
    true,
  );

  return new Blob([header, body], { type: 'image/bmp' });
}
