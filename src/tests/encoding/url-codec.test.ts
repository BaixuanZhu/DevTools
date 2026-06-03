import { describe, it, expect } from 'vitest';
import { encodeUrl, decodeUrl } from '../../utils/encoding/url-codec';

describe('encodeUrl', () => {
  it('应使用 encodeURIComponent 编码所有特殊字符', () => {
    const result = encodeUrl('hello world?foo=bar&baz=1');
    expect(result.component).toBe('hello%20world%3Ffoo%3Dbar%26baz%3D1');
  });

  it('应使用 encodeURI 保留 URL 结构字符', () => {
    const result = encodeUrl('https://example.com/path?name=hello world');
    expect(result.full).toContain('https://');
    expect(result.full).toContain('example.com');
    expect(result.full).toContain('%20');
  });

  it('空字符串应返回空结果', () => {
    const result = encodeUrl('');
    expect(result.component).toBe('');
    expect(result.full).toBe('');
  });
});

describe('decodeUrl', () => {
  it('应正确解码 percent-encoded 字符串', () => {
    const result = decodeUrl('hello%20world');
    expect(result.component).toBe('hello world');
  });

  it('解码失败时应包含错误信息', () => {
    const result = decodeUrl('%E0%A4%A');
    expect(result.error).toBeDefined();
  });

  it('空字符串应返回空结果', () => {
    const result = decodeUrl('');
    expect(result.component).toBe('');
    expect(result.full).toBe('');
  });
});
