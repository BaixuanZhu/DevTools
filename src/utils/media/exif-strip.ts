// src/utils/media/exif-strip.ts
/**
 * JPEG 隐私元数据无损剥离。
 *
 * 本模块只关心 JPEG 字节格式：段（marker）遍历、隐私段识别与删除，
 * 不解析 EXIF 字段语义（读取展示见组件层 exifr 调用）。
 * 所有函数均在纯 `ArrayBuffer`/`Uint8Array` 上操作，不依赖 DOM / canvas，
 * 因此可单测，且对图像像素数据零修改（无损）。
 */

/** JPEG 文件头两字节：`FF D8`（SOI）。 */
const JPEG_SOI = [0xff, 0xd8] as const;

/** EXIF APP1 段载荷前 6 字节标识：`Exif\0\0`。 */
const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);

/** 需剥离的隐私段 marker（第二字节）：APP1(EXIF/XMP)、APP2(ICC)、APP13(Photoshop/IPTC)、COM(注释)。 */
const PRIVACY_MARKERS = new Set([0xe1, 0xe2, 0xed, 0xfe]);

/** SOS marker（扫描开始）：其后为无长度框架的熵编码数据，直到 EOI。 */
const MARKER_SOS = 0xda;

/**
 * 判断缓冲区是否以 JPEG SOI 头开头。
 *
 * @param buf 任意字节缓冲区
 * @returns 是否为 JPEG
 */
function isJpeg(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 2) return false;
  const v = new Uint8Array(buf);
  return v[0] === JPEG_SOI[0] && v[1] === JPEG_SOI[1];
}

/**
 * 无损剥离 JPEG 的隐私元数据段。
 *
 * 从 SOI 之后遍历各 marker 段，删除 {@link PRIVACY_MARKERS} 中的隐私段
 *（APP1 的 EXIF/XMP、APP2 的 ICC、APP13 的 Photoshop/IPTC、COM 注释），
 * 保留 APP0(JFIF)、SOF、DQT、DHT 等图像必需段；遇 SOS 后将其及全部熵数据
 *（含 EOI）原样保留，从而保证像素数据一字节不动。
 *
 * 段长度字段为大端 2 字节、含自身 2 字节（不含 `FF marker`）。
 *
 * @param buf JPEG 字节缓冲区
 * @returns 剥离隐私段后的新 JPEG 字节缓冲区
 * @throws 非 JPEG 或段结构损坏（长度越界）时抛中文错误
 */
export function stripJpegMetadata(buf: ArrayBuffer): ArrayBuffer {
  if (!isJpeg(buf)) {
    throw new Error('非 JPEG 文件，无法剥离元数据');
  }
  const view = new Uint8Array(buf);
  const total = view.length;

  /** 保留的字节区段 [start, end)。 */
  const ranges: Array<[number, number]> = [[0, 2]]; // SOI 始终保留

  let i = 2;
  while (i + 1 < total) {
    if (view[i] !== 0xff) {
      throw new Error('JPEG 结构损坏：段标记缺失');
    }
    const marker = view[i + 1];

    // 无长度字节的独立 marker：TEM(0x01)、RST0-7(0xD0-0xD7)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      ranges.push([i, i + 2]);
      i += 2;
      continue;
    }

    // SOS：其后为熵数据，整段到文件尾原样保留并结束遍历
    if (marker === MARKER_SOS) {
      ranges.push([i, total]);
      break;
    }

    // 带长度字节的段：FF marker + 2B 大端长度（含自身）+ 载荷
    if (i + 4 > total) {
      throw new Error('JPEG 结构损坏：段长度越界');
    }
    const len = (view[i + 2] << 8) | view[i + 3];
    const segEnd = i + 2 + len; // 长度从 length 字段起算
    if (len < 2 || segEnd > total) {
      throw new Error('JPEG 结构损坏：段长度越界');
    }

    if (!PRIVACY_MARKERS.has(marker)) {
      ranges.push([i, segEnd]);
    }
    i = segEnd;
  }

  // 拼接所有保留区段为连续缓冲区
  const outLen = ranges.reduce((s, [a, b]) => s + (b - a), 0);
  const out = new Uint8Array(outLen);
  let off = 0;
  for (const [a, b] of ranges) {
    out.set(view.subarray(a, b), off);
    off += b - a;
  }
  return out.buffer;
}

/**
 * 判断 JPEG 是否包含 EXIF APP1 段（载荷以 `Exif\0\0` 开头）。
 *
 * 仅识别 EXIF，不把 XMP（同属 APP1 但载荷头不同）误判为 EXIF。
 * 遇 SOS 即停止（其后再无段结构）。
 *
 * @param buf 任意字节缓冲区
 * @returns 含 EXIF 段返回 true；非 JPEG / 无 EXIF / 仅 XMP 返回 false
 */
export function hasJpegExif(buf: ArrayBuffer): boolean {
  if (!isJpeg(buf)) return false;
  const view = new Uint8Array(buf);
  const total = view.length;

  let i = 2;
  while (i + 3 < total) {
    if (view[i] !== 0xff) return false;
    const marker = view[i + 1];
    if (marker === MARKER_SOS) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (view[i + 2] << 8) | view[i + 3];
    const segEnd = i + 2 + len;
    if (len < 2 || segEnd > total) return false;

    if (marker === 0xe1) {
      const payloadStart = i + 4;
      if (payloadStart + EXIF_HEADER.length <= segEnd) {
        let match = true;
        for (let k = 0; k < EXIF_HEADER.length; k++) {
          if (view[payloadStart + k] !== EXIF_HEADER[k]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
    }
    i = segEnd;
  }
  return false;
}
