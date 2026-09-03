import { describe, it, expect } from 'vitest';
import { argon2id, argon2i, argon2d, argon2Verify } from 'hash-wasm';
import {
  M_MIN_KIB,
  M_MAX_KIB,
  T_MIN,
  T_MAX,
  P_MIN,
  P_MAX,
  SALT_BYTES,
  ARGON2_VERSION,
  parseArgon2Hash,
  getArgon2HashFormatError,
  validateArgon2Params,
  generateArgon2Salt,
} from '../argon2';

/**
 * 外部公开测试向量（多库一致的 argon2i 参考向量，spike 2026-09-02 经
 * hash-wasm 实算核对后固化）：password='password'、salt='somesalt'、
 * m=65536, t=2, p=1。用于 known-answer 断言：实现或依赖升级若改变输出
 * 会在此立即暴露。
 */
const EXTERNAL_VECTOR = '$argon2i$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$wWKIMhR9lyDFvRz9YTZweHKfbftvj+qf+YFY4NeBbtA';

/** 测试用低参数组合（m=1024,t=1,p=1，毫秒级完成，保证套件速度） */
const LOW_PARAMS = { memorySize: 1024, iterations: 1, parallelism: 1, hashLength: 32 } as const;

/** hash-wasm 直算辅助：固定低参数 + 指定盐生成 PHC 哈希。 */
async function lowHash(
  fn: typeof argon2id,
  password: string,
  salt: string,
): Promise<string> {
  return fn({ password, salt, ...LOW_PARAMS, outputType: 'encoded' });
}

describe('parseArgon2Hash', () => {
  it('解析外部向量的全部字段', () => {
    const parsed = parseArgon2Hash(EXTERNAL_VECTOR);
    expect(parsed).toEqual({
      type: 'argon2i',
      version: ARGON2_VERSION,
      m: 65536,
      t: 2,
      p: 1,
      saltB64: 'c29tZXNhbHQ',
      hashB64: 'wWKIMhR9lyDFvRz9YTZweHKfbftvj+qf+YFY4NeBbtA',
      saltLength: 8,
      hashLength: 32,
    });
  });

  it('三种类型均可解析且容忍首尾空白', () => {
    for (const type of ['argon2id', 'argon2i', 'argon2d'] as const) {
      const hash = `$${type}$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$descMbrKrq9SktOz9pBJmUYWY0YQKqhQRHofW58tXoI`;
      expect(parseArgon2Hash(hash)?.type, type).toBe(type);
    }
    expect(parseArgon2Hash(`  ${EXTERNAL_VECTOR} \n`)).not.toBeNull();
  });

  it('非法输入一律返回 null（不抛错）', () => {
    const badSamples = [
      '',
      'not-a-hash',
      // 错误前缀
      '$scrypt$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$wWKIMhR9lyDFvRz9YTZweHKfbftvj+qf+YFY4NeBbtA',
      // 错误类型段
      '$argon2x$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$wWKIMhR9lyDFvRz9YTZweHKfbftvj+qf+YFY4NeBbtA',
      // v=16 老版本（工具不支持）
      EXTERNAL_VECTOR.replace('v=19', 'v=16'),
      // v=99
      EXTERNAL_VECTOR.replace('v=19', 'v=99'),
      // 参数段格式破坏
      EXTERNAL_VECTOR.replace('m=65536,t=2,p=1', 'm=65536,t=2'),
      EXTERNAL_VECTOR.replace('m=65536,t=2,p=1', 'm=65536;x=2;p=1'),
      // 缺失哈希段
      '$argon2i$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$',
      // b64 长度非法（%4===1 无法解码）
      '$argon2i$v=19$m=65536,t=2,p=1$c29tZXNhbHQZZ$wWKIMhR9lyDFvRz9YTZweHKfbftvj+qf+YFY4NeBbtA',
    ];
    for (const sample of badSamples) {
      expect(parseArgon2Hash(sample), sample).toBeNull();
    }
  });
});

describe('getArgon2HashFormatError 差异化中文错误', () => {
  it('合法与空输入返回空串', () => {
    expect(getArgon2HashFormatError(EXTERNAL_VECTOR)).toBe('');
    expect(getArgon2HashFormatError('')).toBe('');
    expect(getArgon2HashFormatError('   ')).toBe('');
  });

  it('不以 $argon2 开头 → 前缀错误', () => {
    expect(getArgon2HashFormatError('scrypt$v=19$m=1,t=1,p=1$a$b')).toContain('应以 $argon2id$');
  });

  it('类型段不合法 → 类型错误', () => {
    expect(getArgon2HashFormatError('$argon2x$v=19$m=1,t=1,p=1$a$b')).toContain('类型段不正确');
  });

  it('版本段格式破坏 → 版本格式错误', () => {
    expect(getArgon2HashFormatError('$argon2id$x=19$m=1,t=1,p=1$a$b')).toContain('版本段格式不正确');
  });

  it('v=16 → 老版本专门文案（parse 层拦截，不进 worker）', () => {
    expect(getArgon2HashFormatError(EXTERNAL_VECTOR.replace('v=19', 'v=16'))).toContain('v=16 为老版本');
  });

  it('其他版本值 → 仅支持 v=19', () => {
    expect(getArgon2HashFormatError(EXTERNAL_VECTOR.replace('v=19', 'v=99'))).toContain('仅支持 v=19');
  });

  it('m,t,p 段格式破坏 → 参数段错误', () => {
    expect(getArgon2HashFormatError(EXTERNAL_VECTOR.replace('m=65536,t=2,p=1', 'm=65536,t=2'))).toContain(
      '参数段格式不正确',
    );
  });

  it('缺失哈希段 → 字段缺失错误', () => {
    expect(getArgon2HashFormatError('$argon2id$v=19$m=1024,t=1,p=1$c29tZXNhbHQ$')).toContain('字段缺失');
  });

  it('盐段 b64 非法 → 盐段错误', () => {
    expect(getArgon2HashFormatError('$argon2id$v=19$m=1024,t=1,p=1$c29tZXNhbHQ!$aGVsbG8')).toContain(
      '盐段不合法',
    );
  });

  it('盐/哈希段含 = padding → 段不合法（PHC 为无 padding 形态，formatError 与 parse 口径一致）', () => {
    // 盐段带 ==（devtools-salt-16 的 padded b64）：atob 能解但 PHC 段不允许 =，必须差异化拦截
    const paddedSalt = '$argon2id$v=19$m=1024,t=1,p=1$ZGV2dG9vbHMtc2FsdC0xNg==$aGVsbG8';
    expect(getArgon2HashFormatError(paddedSalt)).toContain('盐段不合法');
    expect(parseArgon2Hash(paddedSalt)).toBeNull();
    const paddedHash = '$argon2id$v=19$m=1024,t=1,p=1$ZGV2dG9vbHMtc2FsdC0xNg$jIIX1uovxCL2ZHQBN7UUqThrqDCyZEeBV5W7pN/wweE=';
    expect(getArgon2HashFormatError(paddedHash)).toContain('哈希段不合法');
    expect(parseArgon2Hash(paddedHash)).toBeNull();
  });
});

describe('validateArgon2Params', () => {
  it('边界值合法：m=1024/262144、t=1/10、p=1/8', () => {
    expect(validateArgon2Params(M_MIN_KIB, T_MIN, P_MIN)).toBe('');
    expect(validateArgon2Params(M_MAX_KIB, T_MAX, P_MAX)).toBe('');
  });

  it('范围外的 m/t/p 与非整数均拦截并给出字段级文案', () => {
    expect(validateArgon2Params(M_MIN_KIB - 1, 3, 4)).toContain('内存参数超出范围');
    expect(validateArgon2Params(M_MAX_KIB + 1024, 3, 4)).toContain('内存参数超出范围');
    expect(validateArgon2Params(65536, 0, 4)).toContain('迭代次数超出范围');
    expect(validateArgon2Params(65536, 11, 4)).toContain('迭代次数超出范围');
    expect(validateArgon2Params(65536, 3, 0)).toContain('并行度超出范围');
    expect(validateArgon2Params(65536, 3, 9)).toContain('并行度超出范围');
    expect(validateArgon2Params(65536.5, 3, 4)).toContain('内存参数超出范围');
  });

  it('m < 8×p 时拦截（Argon2 最小内存约束；当前 M_MIN ≥ 8×P_MAX 使 UI 域内天然满足，守卫防御程序化调用）', () => {
    expect(validateArgon2Params(1024, 1, 200)).toContain('8 倍');
    expect(validateArgon2Params(1024, 1, 200)).toContain('8×p = 1600');
    // 合法参数域内不误伤
    expect(validateArgon2Params(M_MIN_KIB, 1, P_MAX)).toBe('');
  });
});

describe('generateArgon2Salt', () => {
  it('长度为 16 字节且两次调用不同', () => {
    const a = generateArgon2Salt();
    const b = generateArgon2Salt();
    expect(a).toHaveLength(SALT_BYTES);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('known-answer 与 verify 正反例（hash-wasm 4.12.0 实测）', () => {
  it('外部 argon2i 向量直算比对（独立公开向量，双源核对）', async () => {
    const hash = await argon2i({
      password: 'password',
      salt: 'somesalt',
      iterations: 2,
      parallelism: 1,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'encoded',
    });
    expect(hash).toBe(EXTERNAL_VECTOR);
  });

  it('三种类型 roundtrip：生成 → argon2Verify 正反例', async () => {
    for (const [type, fn] of [
      ['argon2id', argon2id],
      ['argon2i', argon2i],
      ['argon2d', argon2d],
    ] as const) {
      const hash = await lowHash(fn, 'DevTools@2026', 'devtools-salt-16');
      expect(hash.startsWith(`$${type}$v=19$`)).toBe(true);
      expect(await argon2Verify({ password: 'DevTools@2026', hash })).toBe(true);
      expect(await argon2Verify({ password: 'wrong-password', hash })).toBe(false);
    }
  });

  it('篡改哈希尾部 → 返回 false 而非抛错', async () => {
    const hash = await lowHash(argon2id, 'DevTools@2026', 'devtools-salt-16');
    const tampered =
      hash.slice(0, -1) + (hash.endsWith('A') ? 'B' : 'A');
    expect(await argon2Verify({ password: 'DevTools@2026', hash: tampered })).toBe(false);
  });

  it('v=16 哈希 argon2Verify 直接 throw 英文错误（worker 侧已 catch 转中文，parse 层提前拦截）', async () => {
    const hash = (await lowHash(argon2id, 'x', 'devtools-salt-16')).replace('v=19', 'v=16');
    // 派发前 parse 层已给出差异化中文错误，不进 worker
    expect(getArgon2HashFormatError(hash)).toContain('v=16 为老版本');
    await expect(argon2Verify({ password: 'x', hash })).rejects.toThrow('Unsupported version: 16');
  });

  it('自产随机盐生成的哈希可被 argon2Verify 正确验证', async () => {
    const hash = await argon2id({
      password: 'DevTools@2026',
      salt: generateArgon2Salt(),
      ...LOW_PARAMS,
      outputType: 'encoded',
    });
    expect(await argon2Verify({ password: 'DevTools@2026', hash })).toBe(true);
    expect(await argon2Verify({ password: 'nope', hash })).toBe(false);
  });
});

describe('常量守卫', () => {
  it('参数范围与默认口径符合产品定义（1-256 MiB / 1-10 / 1-8 / 盐 16 字节 / v19）', () => {
    expect(M_MIN_KIB).toBe(1024);
    expect(M_MAX_KIB).toBe(262144);
    expect(T_MIN).toBe(1);
    expect(T_MAX).toBe(10);
    expect(P_MIN).toBe(1);
    expect(P_MAX).toBe(8);
    expect(SALT_BYTES).toBe(16);
    expect(ARGON2_VERSION).toBe(19);
  });
});
