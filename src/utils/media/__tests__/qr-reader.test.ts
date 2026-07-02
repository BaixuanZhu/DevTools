import { describe, it, expect } from 'vitest';
import { decodeForDisplay, detectContentType, computeScaledSize, QR_MAX_EDGE } from '../qr-reader';

describe('detectContentType', () => {
  it('识别 http/https URL 为 url 类型', () => {
    const r = detectContentType('https://example.com/path?q=1');
    expect(r).toEqual({ type: 'url', value: 'https://example.com/path?q=1', href: 'https://example.com/path?q=1' });
  });

  it('识别 http URL', () => {
    expect(detectContentType('http://a.com').type).toBe('url');
  });

  it('含前导文字的 URL 降级为 text（避免误判）', () => {
    expect(detectContentType('请访问 https://x.com').type).toBe('text');
  });

  it('识别单个邮箱为 email 类型，href 为 mailto:', () => {
    const r = detectContentType('a@b.com');
    expect(r).toEqual({ type: 'email', value: 'a@b.com', href: 'mailto:a@b.com' });
  });

  it('非法邮箱降级为 text', () => {
    expect(detectContentType('not @valid').type).toBe('text');
  });

  it('识别中国大陆手机号为 tel', () => {
    const r = detectContentType('13800138000');
    expect(r.type).toBe('tel');
    expect(r.href).toBe('tel:13800138000');
  });

  it('识别 tel: 前缀', () => {
    expect(detectContentType('tel:13800138000').type).toBe('tel');
  });

  it('识别带国家码的国际号码', () => {
    expect(detectContentType('+86 13800138000').type).toBe('tel');
  });

  it('识别座机号码', () => {
    expect(detectContentType('010-12345678').type).toBe('tel');
  });

  it('过短数字串降级为 text', () => {
    expect(detectContentType('12345').type).toBe('text');
  });

  it('11 位非手机号数字串降级为 text（避免订单号等误判）', () => {
    expect(detectContentType('12345678901').type).toBe('text');
  });

  it('无分隔的座机号串降级为 text', () => {
    expect(detectContentType('01012345678').type).toBe('text');
  });

  it('普通文本为 text', () => {
    expect(detectContentType('hello world')).toEqual({ type: 'text', value: 'hello world', href: '' });
  });

  it('空字符串为 text 且 value 为空', () => {
    expect(detectContentType('   ')).toEqual({ type: 'text', value: '', href: '' });
  });

  it('clash 等非 http 协议文本解码显示（text 类型，无 href）', () => {
    const r = detectContentType('clash://install-config?url=https%3A%2F%2Fx.com%2Fy');
    expect(r.type).toBe('text');
    expect(r.value).toBe('clash://install-config?url=https://x.com/y');
    expect(r.href).toBe('');
  });

  it('http 中文 URL：value 解码显示，href 保留原始编码', () => {
    const r = detectContentType('https://example.com/%E4%B8%AD%E6%96%87');
    expect(r.value).toBe('https://example.com/中文');
    expect(r.href).toBe('https://example.com/%E4%B8%AD%E6%96%87');
  });
});

describe('decodeForDisplay', () => {
  it('完整解码 clash 订阅链接（结构字符 + 中文）', () => {
    expect(decodeForDisplay('clash://install-config?url=https%3A%2F%2Fx.com%2Fc%3Ft%3Dab&name=%E8%BF%85%E8%BF%9E'))
      .toBe('clash://install-config?url=https://x.com/c?t=ab&name=迅连');
  });

  it('解码 http 中文 URL', () => {
    expect(decodeForDisplay('https://example.com/%E4%B8%AD%E6%96%87')).toBe('https://example.com/中文');
  });

  it('非法 UTF-8 序列保留原文', () => {
    expect(decodeForDisplay('https://example.com/%E4%00')).toBe('https://example.com/%E4%00');
  });

  it('% 后非 hex 保留原文', () => {
    expect(decodeForDisplay('100%纯棉')).toBe('100%纯棉');
  });

  it('无编码原样返回', () => {
    expect(decodeForDisplay('https://example.com/path')).toBe('https://example.com/path');
  });
});

describe('computeScaledSize', () => {
  it('长边超过上限时按比例缩放', () => {
    expect(computeScaledSize(2000, 1000)).toEqual({ width: 1024, height: 512 });
  });

  it('长边等于上限时保持原尺寸', () => {
    expect(computeScaledSize(1024, 512)).toEqual({ width: 1024, height: 512 });
  });

  it('小于上限时保持原尺寸', () => {
    expect(computeScaledSize(100, 100)).toEqual({ width: 100, height: 100 });
  });

  it('正方形大图缩放到上限', () => {
    expect(computeScaledSize(3000, 3000)).toEqual({ width: 1024, height: 1024 });
  });

  it('竖图按长边（高）缩放', () => {
    expect(computeScaledSize(500, 2000)).toEqual({ width: 256, height: 1024 });
  });

  it('非法尺寸返回 0', () => {
    expect(computeScaledSize(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it('默认上限为 QR_MAX_EDGE 常量', () => {
    expect(QR_MAX_EDGE).toBe(1024);
  });
});
