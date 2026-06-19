import { describe, it, expect } from 'vitest';
import { parseUrl, encodeUrl, decodeUrl, buildUrlFromParams } from '../url';

describe('parseUrl', () => {
  it('解析完整 URL', () => {
    const result = parseUrl('https://example.com:8080/path?a=1&b=2#hash');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('https:');
    expect(result?.host).toBe('example.com:8080');
    expect(result?.hostname).toBe('example.com');
    expect(result?.port).toBe('8080');
    expect(result?.pathname).toBe('/path');
    expect(result?.search).toBe('?a=1&b=2');
    expect(result?.hash).toBe('#hash');
    expect(result?.params).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('解析无端口与 query 的 URL', () => {
    const result = parseUrl('https://example.com/');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('https:');
    expect(result?.host).toBe('example.com');
    expect(result?.hostname).toBe('example.com');
    expect(result?.port).toBe('');
    expect(result?.pathname).toBe('/');
    expect(result?.search).toBe('');
    expect(result?.hash).toBe('');
    expect(result?.params).toEqual([]);
  });

  it('无效 URL 返回 null', () => {
    expect(parseUrl('not a url')).toBeNull();
    expect(parseUrl('')).toBeNull();
  });
});

describe('buildUrlFromParams', () => {
  it('重建 URL 并替换 query', () => {
    const result = buildUrlFromParams('https://example.com/path?old=1', [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(result).toBe('https://example.com/path?a=1&b=2');
  });

  it('忽略空 key', () => {
    const result = buildUrlFromParams('https://example.com/path', [
      { key: '', value: 'ignored' },
      { key: 'a', value: '1' },
    ]);
    expect(result).toBe('https://example.com/path?a=1');
  });

  it('保留 hash 与路径', () => {
    const result = buildUrlFromParams('https://example.com/path#section', [
      { key: 'x', value: 'y' },
    ]);
    expect(result).toBe('https://example.com/path?x=y#section');
  });

  it('非法 baseUrl 原样返回', () => {
    const result = buildUrlFromParams('not a url', [{ key: 'a', value: '1' }]);
    expect(result).toBe('not a url');
  });
});

describe('encodeUrl', () => {
  it('编码中文 URL', () => {
    const result = encodeUrl('https://example.com/你好?key=中文');
    expect(result.component.value).toBe(
      'https%3A%2F%2Fexample.com%2F%E4%BD%A0%E5%A5%BD%3Fkey%3D%E4%B8%AD%E6%96%87',
    );
    expect(result.full.value).toBe(
      'https://example.com/%E4%BD%A0%E5%A5%BD?key=%E4%B8%AD%E6%96%87',
    );
  });

  it('编码普通字符串', () => {
    const result = encodeUrl('hello world');
    expect(result.component.value).toBe('hello%20world');
    expect(result.full.value).toBe('hello%20world');
  });
});

describe('decodeUrl', () => {
  it('解码 percent-encoded 字符串', () => {
    const result = decodeUrl('https%3A%2F%2Fexample.com');
    expect(result.component.value).toBe('https://example.com');
    expect(result.full.value).toBe('https%3A%2F%2Fexample.com');
    expect(result.component.error).toBeUndefined();
    expect(result.full.error).toBeUndefined();
  });

  it('component 解码失败时返回错误', () => {
    const result = decodeUrl('%E0%A4%A');
    expect(result.component.value).toBe('');
    expect(result.component.error).toContain('URIComponent 解码失败');
  });
});
