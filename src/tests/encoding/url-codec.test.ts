import { describe, it, expect } from 'vitest';
import { encodeUrl, decodeUrl, parseUrl } from '../../utils/encoding/url-codec';

describe('encodeUrl', () => {
  it('应使用 encodeURIComponent 编码所有特殊字符', () => {
    const result = encodeUrl('hello world?foo=bar&baz=1');
    expect(result.component.value).toBe('hello%20world%3Ffoo%3Dbar%26baz%3D1');
  });

  it('应使用 encodeURI 保留 URL 结构字符', () => {
    const result = encodeUrl('https://example.com/path?name=hello world');
    expect(result.full.value).toContain('https://');
    expect(result.full.value).toContain('example.com');
    expect(result.full.value).toContain('%20');
  });

  it('空字符串应返回空结果', () => {
    const result = encodeUrl('');
    expect(result.component.value).toBe('');
    expect(result.full.value).toBe('');
  });
});

describe('decodeUrl', () => {
  it('应正确解码 percent-encoded 字符串', () => {
    const result = decodeUrl('hello%20world');
    expect(result.component.value).toBe('hello world');
  });

  it('解码失败时应包含错误信息', () => {
    const result = decodeUrl('%E0%A4%A');
    expect(result.component.error).toBeDefined();
  });

  it('空字符串应返回空结果', () => {
    const result = decodeUrl('');
    expect(result.component.value).toBe('');
    expect(result.full.value).toBe('');
  });

  it('decodeURIComponent 失败但 decodeURI 可能处理不同的情况', () => {
    // 孤立的 % 会导致 decodeURIComponent 和 decodeURI 都失败
    const result = decodeUrl('https://example.com/%');
    expect(result.component.error).toBeDefined();
    expect(result.full.error).toBeDefined();
  });
});

describe('parseUrl', () => {
  it('应正确解析完整的 URL', () => {
    const result = parseUrl('https://example.com:8080/path?q=hello#section');
    expect(result).not.toBeNull();
    expect(result!.protocol).toBe('https:');
    expect(result!.host).toBe('example.com:8080');
    expect(result!.port).toBe('8080');
    expect(result!.pathname).toBe('/path');
    expect(result!.search).toBe('?q=hello');
    expect(result!.hash).toBe('#section');
    expect(result!.searchParams).toEqual([{ key: 'q', value: 'hello' }]);
  });

  it('无效 URL 应返回 null', () => {
    expect(parseUrl('not-a-valid-url')).toBeNull();
  });

  it('没有端口的 URL port 应为空字符串', () => {
    const result = parseUrl('https://example.com/path');
    expect(result).not.toBeNull();
    expect(result!.port).toBe('');
  });
});
