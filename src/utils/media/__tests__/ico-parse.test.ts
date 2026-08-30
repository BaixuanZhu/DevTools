import { describe, it, expect } from 'vitest';
import {
  parseIco,
  icoEntryToPng,
  buildBmpFromIcoEntry,
  type IcoEntry,
} from '../ico-parse';

/**
 * 构造 16×16、32bpp 的 BMP 条目字节（BITMAPINFOHEADER + XOR/AND 数据）。
 * biHeight 按 ICO 约定写两倍图像高（32）。
 */
function buildBmpEntry(): Uint8Array<ArrayBuffer> {
  const xorBytes = 16 * 16 * 4; // 32bpp XOR 像素面
  const andBytes = 16 * 4; // AND 掩码面（每行 16bit → 4 字节对齐）
  const data = new Uint8Array(40 + xorBytes + andBytes);
  const view = new DataView(data.buffer);
  view.setUint32(0, 40, true); // biSize = BITMAPINFOHEADER
  view.setInt32(4, 16, true); // biWidth
  view.setInt32(8, 32, true); // biHeight = XOR + AND 两倍高
  view.setUint16(12, 1, true); // biPlanes
  view.setUint16(14, 32, true); // biBitCount
  view.setUint32(32, 0, true); // biClrUsed
  data[44] = 0xaa; // 像素区首字节标记，验证复制完整性
  return data;
}

/** 构造带 PNG 魔数的伪 PNG 条目字节 */
function buildPngEntry(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
}

/** 组装 ICO 文件字节 */
function buildIco(
  type: number,
  entries: { width: number; height: number; bitCount: number; data: Uint8Array }[],
): Uint8Array {
  const total =
    6 + 16 * entries.length + entries.reduce((sum, e) => sum + e.data.length, 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint16(2, type, true);
  view.setUint16(4, entries.length, true);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const base = 6 + 16 * i;
    view.setUint8(base, e.width);
    view.setUint8(base + 1, e.height);
    view.setUint8(base + 2, 0); // colorCount
    view.setUint8(base + 3, 0); // reserved
    view.setUint16(base + 4, 1, true); // planes
    view.setUint16(base + 6, e.bitCount, true);
    view.setUint32(base + 8, e.data.length, true);
    view.setUint32(base + 12, offset, true);
    bytes.set(e.data, offset);
    offset += e.data.length;
  });
  return bytes;
}

describe('parseIco', () => {
  it('2 条目 crafted ICO：条目数、尺寸、类型正确', () => {
    const bytes = buildIco(1, [
      { width: 16, height: 16, bitCount: 32, data: buildBmpEntry() },
      { width: 32, height: 32, bitCount: 32, data: buildPngEntry() },
    ]);
    const r = parseIco(bytes);
    expect(r.type).toBe('icon');
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({
      index: 0,
      width: 16,
      height: 16,
      format: 'bmp',
      bitCount: 32,
      isCursor: false,
    });
    expect(r.entries[1]).toMatchObject({
      index: 1,
      width: 32,
      height: 32,
      format: 'png',
      isCursor: false,
    });
  });

  it('目录项 0 表示 256 尺寸', () => {
    const bytes = buildIco(1, [
      { width: 0, height: 0, bitCount: 32, data: buildPngEntry() },
    ]);
    const r = parseIco(bytes);
    expect(r.entries[0]!.width).toBe(256);
    expect(r.entries[0]!.height).toBe(256);
  });

  it('type=2 识别为光标文件（isCursor）', () => {
    const bytes = buildIco(2, [
      { width: 32, height: 32, bitCount: 32, data: buildPngEntry() },
    ]);
    const r = parseIco(bytes);
    expect(r.type).toBe('cursor');
    expect(r.entries.every((e) => e.isCursor)).toBe(true);
  });

  it('坏 magic（reserved 非 0）抛中文错误', () => {
    const bytes = buildIco(1, [
      { width: 16, height: 16, bitCount: 32, data: buildPngEntry() },
    ]);
    bytes[0] = 0xff;
    expect(() => parseIco(bytes)).toThrow(/文件头校验不通过/);
  });

  it('不支持的目录类型抛中文错误', () => {
    const bytes = buildIco(3, [
      { width: 16, height: 16, bitCount: 32, data: buildPngEntry() },
    ]);
    expect(() => parseIco(bytes)).toThrow(/不支持的文件类型/);
  });

  it('文件过小抛中文错误', () => {
    expect(() => parseIco(new Uint8Array(4))).toThrow(/文件过小/);
  });

  it('条目数 0 抛中文错误', () => {
    const bytes = new Uint8Array(6);
    const view = new DataView(bytes.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, 0, true);
    expect(() => parseIco(bytes)).toThrow(/不含任何图像条目/);
  });

  it('目录表被截断抛中文错误', () => {
    const bytes = buildIco(1, [
      { width: 16, height: 16, bitCount: 32, data: buildPngEntry() },
    ]);
    // 谎报条目数为 2：第 2 个条目的目录项实际不存在
    new DataView(bytes.buffer).setUint16(4, 2, true);
    expect(() => parseIco(bytes)).toThrow(/目录表数据不完整/);
  });

  it('条目数据超出文件范围（截断）抛中文错误', () => {
    const bytes = buildIco(1, [
      { width: 16, height: 16, bitCount: 32, data: buildBmpEntry() },
    ]);
    expect(() => parseIco(bytes.slice(0, bytes.length - 10))).toThrow(/超出文件范围/);
  });

  it('无法识别的内嵌数据抛中文错误', () => {
    const bytes = buildIco(1, [
      { width: 16, height: 16, bitCount: 32, data: new Uint8Array(64) },
    ]);
    expect(() => parseIco(bytes)).toThrow(/无法识别的内嵌图像数据/);
  });

  it('条目字节为独立副本，不共享源缓冲', () => {
    const bytes = buildIco(1, [
      { width: 32, height: 32, bitCount: 32, data: buildPngEntry() },
    ]);
    const r = parseIco(bytes);
    r.entries[0]!.bytes[0] = 0x00;
    expect(bytes[6 + 16 * 1]).toBe(0x89);
  });
});

describe('icoEntryToPng', () => {
  it('PNG 条目直封装为 image/png Blob（同步）', () => {
    const data = buildPngEntry();
    const entry: IcoEntry = {
      index: 0,
      width: 32,
      height: 32,
      colorCount: 0,
      bitCount: 32,
      planes: 1,
      bytes: data,
      format: 'png',
      isCursor: false,
    };
    const blob = icoEntryToPng(entry);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(data.length);
  });

  it('BMP 条目调用抛错', () => {
    const entry: IcoEntry = {
      index: 0,
      width: 16,
      height: 16,
      colorCount: 0,
      bitCount: 32,
      planes: 1,
      bytes: buildBmpEntry(),
      format: 'bmp',
      isCursor: false,
    };
    expect(() => icoEntryToPng(entry)).toThrow(/不是 PNG 内嵌数据/);
  });
});

describe('buildBmpFromIcoEntry', () => {
  /** 从 Blob 读全部字节 */
  async function blobBytes(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer());
  }

  it('重建 BITMAPFILEHEADER：BM / bfSize / bfOffBits / biHeight 减半', async () => {
    const entryData = buildBmpEntry(); // 40 + 1024 + 64 = 1128 字节
    const entry: IcoEntry = {
      index: 0,
      width: 16,
      height: 16,
      colorCount: 0,
      bitCount: 32,
      planes: 1,
      bytes: entryData,
      format: 'bmp',
      isCursor: false,
    };
    const blob = buildBmpFromIcoEntry(entry);
    expect(blob.type).toBe('image/bmp');

    const bytes = await blobBytes(blob);
    expect(bytes.length).toBe(14 + entryData.length);
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('BM');

    const view = new DataView(bytes.buffer);
    expect(view.getUint32(2, true)).toBe(14 + entryData.length); // bfSize
    expect(view.getUint16(6, true)).toBe(0); // 保留字段
    expect(view.getUint32(10, true)).toBe(14 + 40); // bfOffBits = 文件头 + INFOHEADER（无调色板）

    // 条目内 biHeight=32（XOR+AND），重建后减半为 16（偏移 14+8）
    expect(view.getInt32(22, true)).toBe(16);
    // 像素数据被完整复制（buildBmpEntry 在条目偏移 44 处的标记，重建后位于 14+44）
    expect(bytes[14 + 44]).toBe(0xaa);
  });

  it('带调色板的 8bpp 条目：bfOffBits 计入调色板字节数', async () => {
    const data = new Uint8Array(40 + 256 * 4 + 16 * 4); // INFOHEADER + 256 色调色板 + 像素
    const view = new DataView(data.buffer);
    view.setUint32(0, 40, true);
    view.setInt32(8, 32, true); // 两倍高
    view.setUint16(14, 8, true); // 8bpp
    view.setUint32(32, 0, true); // biClrUsed 未声明 → 按色深推导 256
    const entry: IcoEntry = {
      index: 0,
      width: 16,
      height: 16,
      colorCount: 0,
      bitCount: 8,
      planes: 1,
      bytes: data,
      format: 'bmp',
      isCursor: false,
    };
    const bytes = await blobBytes(buildBmpFromIcoEntry(entry));
    const headerView = new DataView(bytes.buffer);
    // bfOffBits = 14 + 40 + 256*4
    expect(headerView.getUint32(10, true)).toBe(14 + 40 + 256 * 4);
    expect(headerView.getInt32(22, true)).toBe(16); // biHeight 减半
  });

  it('显式 biClrUsed 优先于色深推导', async () => {
    const data = new Uint8Array(40 + 4 * 4 + 16 * 4);
    const view = new DataView(data.buffer);
    view.setUint32(0, 40, true);
    view.setInt32(8, 16, true);
    view.setUint16(14, 8, true); // 8bpp 推导应为 256 项，但显式只用 4 项
    view.setUint32(32, 4, true);
    const entry: IcoEntry = {
      index: 0,
      width: 16,
      height: 16,
      colorCount: 4,
      bitCount: 8,
      planes: 1,
      bytes: data,
      format: 'bmp',
      isCursor: false,
    };
    const bytes = await blobBytes(buildBmpFromIcoEntry(entry));
    expect(new DataView(bytes.buffer).getUint32(10, true)).toBe(14 + 40 + 4 * 4);
  });

  it('PNG 条目调用抛错', () => {
    const entry: IcoEntry = {
      index: 0,
      width: 32,
      height: 32,
      colorCount: 0,
      bitCount: 32,
      planes: 1,
      bytes: buildPngEntry(),
      format: 'png',
      isCursor: false,
    };
    expect(() => buildBmpFromIcoEntry(entry)).toThrow(/不是 BMP 内嵌数据/);
  });

  it('信息头不完整抛中文错误', () => {
    const entry: IcoEntry = {
      index: 0,
      width: 16,
      height: 16,
      colorCount: 0,
      bitCount: 32,
      planes: 1,
      bytes: new Uint8Array(20),
      format: 'bmp',
      isCursor: false,
    };
    expect(() => buildBmpFromIcoEntry(entry)).toThrow(/信息头不完整/);
  });
});
