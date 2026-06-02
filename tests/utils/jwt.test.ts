import { describe, it, expect } from 'vitest';
import { parseJwt } from '../../src/utils/jwt';

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
});
