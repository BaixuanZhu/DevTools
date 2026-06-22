// src/utils/media/png-metadata.ts

/**
 * PNG 元数据（tEXt 块）底层读写工具。
 *
 * 本模块只关心 PNG 字节格式：CRC32、chunk 遍历、tEXt 块的解析与插入，
 * 不包含任何置乱领域知识（领域编解码见 `scramble-meta.ts`）。
 * 所有函数均在纯 `ArrayBuffer`/`Uint8Array` 上操作，不依赖 DOM / canvas。
 */

/** PNG 文件 8 字节签名（固定 magic number）。 */
const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** CRC32 反射多项式（标准 zlib/PNG 多项式）。 */
const CRC_POLYNOMIAL = 0xedb88320;

/** CRC32 预计算表（反射形式），首次使用时按需生成。 */
let crcTable: Uint32Array | null = null;

/**
 * 懒加载生成 CRC32 反射表。
 *
 * 使用反射多项式 `0xEDB88320`，逐字节填充 256 项表，是 zlib/PNG 标准实现。
 *
 * @returns 256 项 CRC32 表
 */
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (CRC_POLYNOMIAL ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/**
 * 计算字节数组的 CRC32（标准 PNG/zlib 算法）。
 *
 * 使用反射多项式 `0xEDB88320`，初始值与最终值均异或 `0xFFFFFFFF`，表驱动。
 * 已知校验向量：`crc32(new TextEncoder().encode("123456789")) === 0xCBF43926`。
 *
 * @param bytes 待校验字节
 * @returns 32 位无符号 CRC 值
 */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 判断缓冲区是否以合法 PNG 签名开头。
 *
 * @param buf 任意字节缓冲区
 * @returns 是否为 PNG
 */
export function isPng(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  const view = new Uint8Array(buf, 0, 8);
  for (let i = 0; i < 8; i++) {
    if (view[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/** PNG chunk 在文件中的固定头部宽度：4B 长度 + 4B 类型。 */
const CHUNK_HEADER_BYTES = 4 + 4;
/** PNG chunk 尾部 CRC 宽度（4B）。 */
const CHUNK_CRC_BYTES = 4;
/** 4 字节无符号整数（大端）的位数。 */
const U32_BYTES = 4;

/**
 * 以大端序读取 4 字节无符号整数。
 *
 * @param view 字节视图
 * @param offset 起始偏移
 * @returns 32 位无符号整数
 */
function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

/**
 * 以大端序写入 4 字节无符号整数。
 *
 * @param view 字节视图
 * @param offset 起始偏移
 * @param value 待写入值
 */
function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, false);
}

/**
 * 将 ASCII 字符串编码为字节（仅本工具使用的 tEXt 载荷均为纯 ASCII）。
 *
 * @param text ASCII 字符串
 * @returns UTF-8/ASCII 字节数组
 */
function asciiToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * 从 PNG 缓冲区中查找并读取指定 keyword 的 tEXt 块。
 *
 * 从偏移 8（跳过签名）开始遍历 chunk（4B length + 4B type + length B data + 4B CRC），
 * 遇到 `type === 'tEXt'` 时按 `keyword\0text` 解析。仅返回第一个匹配 keyword 的块。
 *
 * @param buf PNG 字节缓冲区
 * @param keyword tEXt 关键字（Latin-1 合法，1–79 字符）
 * @returns 命中的文本内容；未命中或非 PNG / 损坏 → 抛中文错误（未命中时返回 null）
 * @throws 非 PNG 或 chunk 结构损坏时抛中文错误
 */
export function readTextChunk(buf: ArrayBuffer, keyword: string): string | null {
  if (!isPng(buf)) {
    throw new Error('非 PNG 文件，无法读取元数据');
  }
  const view = new DataView(buf);
  const total = buf.byteLength;
  let offset = 8; // 跳过签名

  while (offset + CHUNK_HEADER_BYTES + CHUNK_CRC_BYTES <= total) {
    const length = readUint32(view, offset);
    const typeOffset = offset + U32_BYTES;
    const dataOffset = typeOffset + U32_BYTES;
    const crcOffset = dataOffset + length;
    const nextOffset = crcOffset + CHUNK_CRC_BYTES;
    if (nextOffset > total) {
      throw new Error('PNG 结构损坏：chunk 越界');
    }

    // 读取 4 字节类型（ASCII）
    const type = String.fromCharCode(
      view.getUint8(typeOffset),
      view.getUint8(typeOffset + 1),
      view.getUint8(typeOffset + 2),
      view.getUint8(typeOffset + 3),
    );

    if (type === 'tEXt') {
      const data = new Uint8Array(buf, dataOffset, length);
      // keyword\0text 分隔：找第一个 0x00
      let sep = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === 0x00) {
          sep = i;
          break;
        }
      }
      if (sep >= 0) {
        const kw = new TextDecoder('latin1').decode(data.subarray(0, sep));
        if (kw === keyword) {
          return new TextDecoder('latin1').decode(data.subarray(sep + 1));
        }
      }
    }

    // IEND 之后不再遍历（按规范 IEND 是最后一个 chunk）
    if (type === 'IEND') break;
    offset = nextOffset;
  }

  return null;
}

/**
 * 向 PNG 缓冲区写入一个 tEXt 块（keyword + text），插入位置为 IEND 之前。
 *
 * 构造 `[4B length][tEXt][keyword][0x00][text][4B crc32(type+data)]`，
 * 不改动其它 chunk。若已存在同 keyword 的 tEXt 块，**不会**覆盖（PNG 允许同类型 chunk 重复，
 * 解析时取第一个匹配；本工具写入路径只在新置乱结果上调用一次，不存在重复写入场景）。
 *
 * `length` = keyword 字节数 + 1（分隔 0x00）+ text 字节数。
 *
 * @param buf 原 PNG 字节缓冲区
 * @param keyword tEXt 关键字
 * @param text tEXt 文本内容
 * @returns 含新 tEXt 块的新 PNG 字节缓冲区
 * @throws 非 PNG 或 chunk 结构损坏时抛中文错误
 */
export function writeTextChunk(buf: ArrayBuffer, keyword: string, text: string): ArrayBuffer {
  if (!isPng(buf)) {
    throw new Error('非 PNG 文件，无法写入元数据');
  }

  // 定位 IEND chunk 起始偏移
  const view = new DataView(buf);
  const total = buf.byteLength;
  let offset = 8;
  let iendOffset = -1;
  while (offset + CHUNK_HEADER_BYTES + CHUNK_CRC_BYTES <= total) {
    const length = readUint32(view, offset);
    const typeOffset = offset + U32_BYTES;
    const dataOffset = typeOffset + U32_BYTES;
    const crcOffset = dataOffset + length;
    const nextOffset = crcOffset + CHUNK_CRC_BYTES;
    if (nextOffset > total) {
      throw new Error('PNG 结构损坏：chunk 越界');
    }
    const type = String.fromCharCode(
      view.getUint8(typeOffset),
      view.getUint8(typeOffset + 1),
      view.getUint8(typeOffset + 2),
      view.getUint8(typeOffset + 3),
    );
    if (type === 'IEND') {
      iendOffset = offset;
      break;
    }
    offset = nextOffset;
  }
  if (iendOffset < 0) {
    throw new Error('PNG 结构损坏：未找到 IEND 块');
  }

  // 构造新 tEXt chunk 的 data：keyword + 0x00 + text
  const keywordBytes = asciiToBytes(keyword);
  const textBytes = asciiToBytes(text);
  const dataLen = keywordBytes.length + 1 + textBytes.length;
  const chunkBytes = CHUNK_HEADER_BYTES + dataLen + CHUNK_CRC_BYTES;

  // 新缓冲区：[原文件 0..iendOffset] + [新 tEXt chunk] + [IEND 及其后（IEND 为最后块，其后无数据）]
  const out = new ArrayBuffer(total + chunkBytes);
  const outView = new DataView(out);
  const outU8 = new Uint8Array(out);

  // 拷贝 IEND 之前的全部字节
  outU8.set(new Uint8Array(buf, 0, iendOffset), 0);

  // 写入新 tEXt chunk
  const chunkStart = iendOffset;
  writeUint32(outView, chunkStart, dataLen); // length
  // type = "tEXt"
  outU8[chunkStart + 4] = 0x74; // t
  outU8[chunkStart + 5] = 0x45; // E
  outU8[chunkStart + 6] = 0x58; // X
  outU8[chunkStart + 7] = 0x74; // t
  // data: keyword + 0x00 + text
  outU8.set(keywordBytes, chunkStart + 8);
  outU8[chunkStart + 8 + keywordBytes.length] = 0x00;
  outU8.set(textBytes, chunkStart + 8 + keywordBytes.length + 1);

  // CRC：对 type + data 计算
  const crcInput = new Uint8Array(outU8.buffer, chunkStart + 4, 4 + dataLen);
  const crc = crc32(crcInput);
  writeUint32(outView, chunkStart + 8 + dataLen, crc);

  // 拷贝 IEND 块（chunkBytes - 0 长度 IEND 的完整 12 字节）
  outU8.set(new Uint8Array(buf, iendOffset, total - iendOffset), chunkStart + chunkBytes);

  return out;
}
