import { describe, it, expect } from 'vitest';
import { parseJwt, isTokenExpired } from '../../utils/encoding/jwt';

const SAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('parseJwt', () => {
  it('应正确解析 JWT 的三个段', () => {
    const result = parseJwt(SAMPLE_JWT);
    expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(result.payload.sub).toBe('1234567890');
    expect(result.payload.name).toBe('John');
    expect(result.payload.iat).toBe(1516239022);
    expect(result.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('应在 JWT 格式无效时返回错误', () => {
    const result = parseJwt('not.a.valid-jwt-format-because-too-many-dots.in.it');
    expect(result.error).toBeDefined();
  });

  it('应在空输入时返回错误', () => {
    const result = parseJwt('');
    expect(result.error).toBeDefined();
  });

  it('应在段不是合法 Base64URL 时返回错误', () => {
    const result = parseJwt('!!!invalid.!!!invalid.signature');
    expect(result.error).toBeDefined();
  });

  it('应正确解析包含 Unicode 字符的 payload', () => {
    // 手动构造 header 和 payload
    const header = btoa(unescape(encodeURIComponent(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ name: '你好世界' }))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `${header}.${payload}.fake-signature`;
    const result = parseJwt(token);
    expect(result.error).toBeUndefined();
    expect(result.payload.name).toBe('你好世界');
  });

  it('应正确解析包含自定义 claims 的 payload', () => {
    const header = btoa(unescape(encodeURIComponent(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ email: 'test@example.com', role: 'admin' }))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `${header}.${payload}.fake-signature`;
    const result = parseJwt(token);
    expect(result.error).toBeUndefined();
    expect(result.payload.email).toBe('test@example.com');
    expect(result.payload.role).toBe('admin');
  });
});

describe('isTokenExpired', () => {
  it('exp 在过去应返回 true', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    expect(isTokenExpired({ exp: pastExp })).toBe(true);
  });

  it('exp 在未来应返回 false', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired({ exp: futureExp })).toBe(false);
  });

  it('没有 exp 字段应返回 null', () => {
    expect(isTokenExpired({ sub: '123' })).toBeNull();
  });

  it('exp 为非数字类型应返回 null', () => {
    expect(isTokenExpired({ exp: 'not-a-number' })).toBeNull();
  });
});
