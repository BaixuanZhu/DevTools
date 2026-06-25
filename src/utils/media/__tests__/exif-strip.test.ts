// src/utils/media/__tests__/exif-strip.test.ts
import { describe, it, expect } from 'vitest';
import { stripJpegMetadata, hasJpegExif } from '../exif-strip';

/** 文本编码辅助。 */
const enc = new TextEncoder();

/**
 * 构造一个 JPEG 段：`FF <marker> + 2B 长度（含自身）+ 载荷`。
 *
 * @param marker 段标记第二字节（如 0xE0=APP0、0xE1=APP1）
 * @param payload 段载荷
 * @returns 拼接好的段字节
 */
function seg(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (len >> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(payload, 4);
  return out;
}

/**
 * 拼接 SOI + 若干段 + SOS + 熵数据，构成可被剥离算法遍历的合成 JPEG。
 *
 * SOS 段使用长度=2（空扫描头），其后熵数据应以 `FF D9`（EOI）结尾。
 *
 * @param parts SOI 与 SOS 之间的段
 * @param entropy SOS 之后的熵数据
 * @returns 合成 JPEG 的 ArrayBuffer
 */
function buildJpeg(parts: Uint8Array[], entropy: Uint8Array): ArrayBuffer {
  const soi = new Uint8Array([0xff, 0xd8]);
  const sos = new Uint8Array([0xff, 0xda, 0x00, 0x02]);
  const chunks = [soi, ...parts, sos, entropy];
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

/** 判断 haystack 是否包含 needle 子序列。 */
function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

describe('stripJpegMetadata', () => {
  it('剥离 APP1(EXIF) 段，保留 APP0(JFIF) 与 SOI/EOI', () => {
    const app0 = seg(0xe0, enc.encode('JFIF\0'));
    const exif = seg(0xe1, enc.encode('Exif\0\0MM\0*'));
    const entropy = new Uint8Array([0x10, 0x20, 0x30, 0xff, 0xd9]);
    const jpeg = buildJpeg([app0, exif], entropy);

    const out = new Uint8Array(stripJpegMetadata(jpeg));

    expect(contains(out, exif)).toBe(false);
    expect(contains(out, app0)).toBe(true);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[out.length - 1]).toBe(0xd9);
  });

  it('剥离 APP13(Photoshop/IPTC) 与 COM(注释) 段', () => {
    const app0 = seg(0xe0, enc.encode('JFIF\0'));
    const photoshop = seg(0xed, enc.encode('Photoshop 3.0\0'));
    const com = seg(0xfe, enc.encode('由某相机拍摄'));
    const entropy = new Uint8Array([0x01, 0xff, 0xd9]);
    const jpeg = buildJpeg([app0, photoshop, com], entropy);

    const out = new Uint8Array(stripJpegMetadata(jpeg));

    expect(contains(out, photoshop)).toBe(false);
    expect(contains(out, com)).toBe(false);
    expect(contains(out, app0)).toBe(true);
  });

  it('剥离 APP2(ICC profile) 段', () => {
    const app0 = seg(0xe0, enc.encode('JFIF\0'));
    const icc = seg(0xe2, enc.encode('ICC_PROFILE'));
    const entropy = new Uint8Array([0x07, 0xff, 0xd9]);
    const jpeg = buildJpeg([app0, icc], entropy);

    const out = new Uint8Array(stripJpegMetadata(jpeg));

    expect(contains(out, icc)).toBe(false);
  });

  it('保留非隐私图像段（如 SOF0 帧头）', () => {
    const app0 = seg(0xe0, enc.encode('JFIF\0'));
    const sof = seg(0xc0, new Uint8Array([8, 0, 0, 0, 1, 3, 1, 0x11, 1, 0x11, 2, 0x11]));
    const entropy = new Uint8Array([0x09, 0xff, 0xd9]);
    const jpeg = buildJpeg([app0, sof], entropy);

    const out = new Uint8Array(stripJpegMetadata(jpeg));

    expect(contains(out, sof)).toBe(true);
  });

  it('SOS 之后熵数据字节级完整保留', () => {
    const app0 = seg(0xe0, enc.encode('JFIF\0'));
    const entropy = new Uint8Array([0xaa, 0xbb, 0xcc, 0x1f, 0xff, 0x00, 0xff, 0xd9]);
    const jpeg = buildJpeg([app0], entropy);

    const out = new Uint8Array(stripJpegMetadata(jpeg));

    expect(out.slice(-entropy.length)).toEqual(entropy);
  });

  it('无隐私段时仍输出合法 JPEG（SOI + APP0 + SOS + 熵）', () => {
    const app0 = seg(0xe0, enc.encode('JFIF\0'));
    const entropy = new Uint8Array([0x00, 0xff, 0xd9]);
    const jpeg = buildJpeg([app0], entropy);

    const out = new Uint8Array(stripJpegMetadata(jpeg));

    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[out.length - 1]).toBe(0xd9);
    expect(contains(out, app0)).toBe(true);
  });

  it('非 JPEG（无 FF D8 头）抛出中文错误', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    expect(() => stripJpegMetadata(png)).toThrow(/非 JPEG/);
  });

  it('段长度越界（结构损坏）抛出中文错误', () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0x4a, 0x46]);
    expect(() => stripJpegMetadata(broken.buffer)).toThrow(/损坏|越界/);
  });
});

describe('hasJpegExif', () => {
  it('含 EXIF APP1 段（Exif\\0\\0 头）返回 true', () => {
    const exif = seg(0xe1, enc.encode('Exif\0\0MM\0*'));
    const jpeg = buildJpeg([seg(0xe0, enc.encode('JFIF\0')), exif], new Uint8Array([0xff, 0xd9]));
    expect(hasJpegExif(jpeg)).toBe(true);
  });

  it('仅有 APP0（JFIF）无 EXIF 返回 false', () => {
    const jpeg = buildJpeg([seg(0xe0, enc.encode('JFIF\0'))], new Uint8Array([0xff, 0xd9]));
    expect(hasJpegExif(jpeg)).toBe(false);
  });

  it('APP1 为 XMP（非 Exif 头）返回 false', () => {
    const xmp = seg(0xe1, enc.encode('http://ns.adobe.com/xap/1.0/\0'));
    const jpeg = buildJpeg([seg(0xe0, enc.encode('JFIF\0')), xmp], new Uint8Array([0xff, 0xd9]));
    expect(hasJpegExif(jpeg)).toBe(false);
  });

  it('非 JPEG 返回 false', () => {
    expect(hasJpegExif(new Uint8Array([0x89, 0x50]).buffer)).toBe(false);
  });
});
