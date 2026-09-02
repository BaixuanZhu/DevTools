import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  BCRYPT_BASE64_ALPHABET,
  COST_MIN,
  COST_MAX,
  COST_DEFAULT,
  BCRYPT_HASH_LENGTH,
  PASSWORD_MAX_BYTES,
  encodeBcryptBase64,
  generateSalt,
  parseBcryptHash,
  getBcryptHashFormatError,
  normalizeHashForCompare,
  getPasswordByteInfo,
} from '../bcrypt';

/**
 * jBCrypt 官方测试向量（实现期经 bcryptjs 3.0.3 实测记录），
 * 用于 known-answer 断言：实现或依赖升级若改变输出会在此立即暴露。
 * 注意第二条盐的大写 I 开头。
 */
const VECTOR_A_HASH = '$2a$06$m0CrhHm10qJ3lXRY.5zDGO3rS2KdeeWLuGmsfGlMfOxih58VYVfxe';
const VECTOR_ABC_HASH = '$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i';
const VECTOR_ABC_SALT = '$2a$06$If6bvum7DFjUnE9p2uDeDu';

/** 测试辅助：数字数组 → encodeBcryptBase64。 */
function encodeBytes(list: number[]): string {
  return encodeBcryptBase64(new Uint8Array(list));
}

describe('encodeBcryptBase64', () => {
  it('16 个全零字节编码为 22 个 "."（字母表第 0 位）', () => {
    expect(encodeBcryptBase64(new Uint8Array(16))).toBe('.'.repeat(22));
  });

  it('16 个全 0xFF 字节编码为 21 个 "9" 加 "u"（首尾位模式可手推）', () => {
    expect(encodeBcryptBase64(new Uint8Array(16).fill(0xff))).toBe('9'.repeat(21) + 'u');
  });

  it('不满 3 字节的尾组按 6 位分组自然收尾（2 字节 → 3 字符）', () => {
    expect(encodeBytes([0xff, 0xff])).toBe('996');
  });

  it('任意 16 字节的输出长度为 22 且全部落在 bcrypt 字母表内', () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const encoded = encodeBcryptBase64(bytes);
    expect(encoded).toHaveLength(22);
    for (const ch of encoded) {
      expect(BCRYPT_BASE64_ALPHABET).toContain(ch);
    }
  });
});

describe('generateSalt', () => {
  it('默认生成 $2b$ 前缀、cost 补零两位、22 字符盐，总长 29', () => {
    const salt = generateSalt(10);
    expect(salt).toMatch(/^\$2b\$10\$[./A-Za-z0-9]{22}$/);
    expect(salt).toHaveLength(29);
  });

  it('个位数 cost 补零（4 → $04$）', () => {
    expect(generateSalt(4).startsWith('$2b$04$')).toBe(true);
  });

  it('prefix 参数生效（$2a）', () => {
    expect(generateSalt(10, '$2a').startsWith('$2a$10$')).toBe(true);
  });

  it('两次调用盐不同（Web Crypto 随机性）', () => {
    expect(generateSalt(10)).not.toBe(generateSalt(10));
  });
});

describe('parseBcryptHash', () => {
  it('解析官方向量哈希的 prefix/cost/salt/checksum', () => {
    const parsed = parseBcryptHash(VECTOR_ABC_HASH);
    expect(parsed).toEqual({
      prefix: '$2a',
      cost: 6,
      salt: 'If6bvum7DFjUnE9p2uDeDu',
      checksum: '0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i',
    });
    expect(parseBcryptHash(VECTOR_A_HASH)?.salt).toBe('m0CrhHm10qJ3lXRY.5zDGO');
  });

  it('兼容 $2b/$2y/$2x 前缀与容忍首尾空白', () => {
    const body = 'If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i';
    for (const prefix of ['$2b$', '$2y$', '$2x$']) {
      expect(parseBcryptHash(`${prefix}12$${body}`)?.cost).toBe(12);
    }
    expect(parseBcryptHash(`  ${VECTOR_ABC_HASH} \n`)).not.toBeNull();
  });

  it('非法输入一律返回 null（不抛错）', () => {
    const badSamples = [
      '',
      'not-a-bcrypt-hash',
      // 错误版本前缀
      '$2c$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i',
      // 长度 59（截尾）
      VECTOR_ABC_HASH.slice(0, BCRYPT_HASH_LENGTH - 1),
      // 长度 61（补尾）
      `${VECTOR_ABC_HASH}x`,
      // 字符集含非法字符 -
      '$2a$06$If6bvum7DFjUnE9p2uDeDu-0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i',
      // cost 低于 4 / 高于 31
      `$2a$03$${'a'.repeat(53)}`,
      `$2a$99$${'a'.repeat(53)}`,
    ];
    for (const sample of badSamples) {
      expect(parseBcryptHash(sample), sample).toBeNull();
    }
  });
});

describe('getBcryptHashFormatError 差异化中文错误', () => {
  it('合法与空输入返回空串', () => {
    expect(getBcryptHashFormatError(VECTOR_ABC_HASH)).toBe('');
    expect(getBcryptHashFormatError('')).toBe('');
    expect(getBcryptHashFormatError('   ')).toBe('');
  });

  it('不以 $ 开头 → 格式不正确', () => {
    expect(getBcryptHashFormatError(`2a$06$${'a'.repeat(53)}`)).toContain('应以 $2a$、$2b$、$2y$ 或 $2x$ 开头');
  });

  it('版本前缀不合法 → 前缀错误', () => {
    expect(getBcryptHashFormatError(`$2c$06$${'a'.repeat(53)}`)).toContain('版本前缀不正确');
  });

  it('cost 字段非两位数字 → cost 字段错误', () => {
    expect(getBcryptHashFormatError(`$2b$ab$${'a'.repeat(53)}`)).toContain('cost 字段不正确');
  });

  it('cost 超出 4-31 → 范围错误', () => {
    expect(getBcryptHashFormatError(`$2b$03$${'a'.repeat(53)}`)).toContain('cost 因子超出范围');
    expect(getBcryptHashFormatError(`$2b$99$${'a'.repeat(53)}`)).toContain('cost 因子超出范围');
  });

  it('长度不为 60 → 长度错误（附实际长度）', () => {
    expect(getBcryptHashFormatError(`$2b$10$${'a'.repeat(52)}`)).toContain('长度不正确');
    expect(getBcryptHashFormatError(`$2b$10$${'a'.repeat(52)}`)).toContain('59');
  });

  it('含字母表外字符 → 非法字符错误', () => {
    const bad = `$2b$10$${'a'.repeat(22)}-${'b'.repeat(30)}`;
    expect(getBcryptHashFormatError(bad)).toContain('非法字符');
  });
});

describe('normalizeHashForCompare $2x 归一化', () => {
  it('$2x 前缀替换为 $2a，其余前缀原样返回', () => {
    expect(normalizeHashForCompare(VECTOR_A_HASH.replace('$2a$', '$2x$'))).toBe(VECTOR_A_HASH);
    expect(normalizeHashForCompare(VECTOR_ABC_HASH)).toBe(VECTOR_ABC_HASH);
  });

  it('归一化后的 $2x 哈希可被 bcryptjs 比对（不归一化则抛 Invalid salt revision）', () => {
    const hash2x = VECTOR_A_HASH.replace('$2a$', '$2x$');
    expect(() => bcrypt.compareSync('a', hash2x)).toThrow();
    expect(bcrypt.compareSync('a', normalizeHashForCompare(hash2x))).toBe(true);
    expect(bcrypt.compareSync('b', normalizeHashForCompare(hash2x))).toBe(false);
  });
});

describe('getPasswordByteInfo 72 字节检测', () => {
  it('ASCII 边界：72 字节不截断、73 字节截断', () => {
    expect(getPasswordByteInfo('a'.repeat(PASSWORD_MAX_BYTES))).toEqual({ bytes: 72, truncated: false });
    expect(getPasswordByteInfo('a'.repeat(PASSWORD_MAX_BYTES + 1))).toEqual({ bytes: 73, truncated: true });
  });

  it('中文每字 3 字节：24 字不截断、25 字截断', () => {
    expect(getPasswordByteInfo('中'.repeat(24))).toEqual({ bytes: 72, truncated: false });
    expect(getPasswordByteInfo('中'.repeat(25))).toEqual({ bytes: 75, truncated: true });
  });

  it('emoji 每字 4 字节', () => {
    expect(getPasswordByteInfo('😀')).toEqual({ bytes: 4, truncated: false });
    expect(getPasswordByteInfo('😀'.repeat(19))).toEqual({ bytes: 76, truncated: true });
  });

  it('空密码为 0 字节不截断', () => {
    expect(getPasswordByteInfo('')).toEqual({ bytes: 0, truncated: false });
  });
});

describe('known-answer 与 compare 正反例（bcryptjs 3.0.3 实测记录）', () => {
  it('官方向量 hashSync 输出与记录常量一致', () => {
    expect(bcrypt.hashSync('a', '$2a$06$m0CrhHm10qJ3lXRY.5zDGO')).toBe(VECTOR_A_HASH);
    expect(bcrypt.hashSync('abc', VECTOR_ABC_SALT)).toBe(VECTOR_ABC_HASH);
  });

  it('自产盐生成的哈希可被 compareSync 正确验证（$2b$）', () => {
    const salt = generateSalt(COST_MIN); // cost 4，测试要快
    const hash = bcrypt.hashSync('DevTools@2026', salt);
    expect(hash.startsWith('$2b$04$')).toBe(true);
    expect(bcrypt.compareSync('DevTools@2026', hash)).toBe(true);
    expect(bcrypt.compareSync('wrong-password', hash)).toBe(false);
  });

  it('$2a 前缀哈希可正常比对（跨前缀校验互通）', () => {
    expect(bcrypt.compareSync('a', VECTOR_A_HASH)).toBe(true);
    expect(bcrypt.compareSync('b', VECTOR_A_HASH)).toBe(false);
    expect(bcrypt.compareSync('abc', VECTOR_ABC_HASH)).toBe(true);
  });
});

describe('常量守卫', () => {
  it('cost 档位与默认值符合产品口径（UI 4-15，默认 10）', () => {
    expect(COST_MIN).toBe(4);
    expect(COST_MAX).toBe(15);
    expect(COST_DEFAULT).toBe(10);
  });

  it('标准哈希长度与截断阈值符合 bcrypt 规范', () => {
    expect(BCRYPT_HASH_LENGTH).toBe(60);
    expect(PASSWORD_MAX_BYTES).toBe(72);
  });
});
