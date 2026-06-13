import { describe, it, expect } from 'vitest';
import { detectContentType } from '../qr-reader';

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

  it('普通文本为 text', () => {
    expect(detectContentType('hello world')).toEqual({ type: 'text', value: 'hello world', href: '' });
  });

  it('空字符串为 text 且 value 为空', () => {
    expect(detectContentType('   ')).toEqual({ type: 'text', value: '', href: '' });
  });
});
