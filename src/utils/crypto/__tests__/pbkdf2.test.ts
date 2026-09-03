import { describe, it, expect } from 'vitest';
import {
  DJANGO_ALGO,
  ITER_MIN,
  ITER_MAX,
  DKLEN_MIN,
  DKLEN_MAX,
  parseDjangoPbkdf2Hash,
  getDjangoHashFormatError,
  validatePbkdf2Params,
  isValidHex,
  hexToBytes,
  bytesToHex,
  bytesToBase64,
  generateRandomSalt,
  derivePbkdf2Bytes,
  verifyDjangoPbkdf2,
} from '../pbkdf2';

/**
 * Django 固化测试向量（spike 2026-09-02 经 node crypto.pbkdf2Sync 与
 * Web Crypto subtle 双实现交叉核对后固化）：密码 DevTools@2026、
 * 盐 some-salt-16byte、迭代 100。盐 b64 带 == padding，用于验证
 * 解析器对有/无 padding 两种形态的容忍。
 */
const DJANGO_VECTOR =
  'pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=';

describe('parseDjangoPbkdf2Hash', () => {
  it('解析固化向量的迭代/盐/哈希', () => {
    const parsed = parseDjangoPbkdf2Hash(DJANGO_VECTOR);
    expect(parsed).not.toBeNull();
    expect(parsed!.iterations).toBe(100);
    expect(new TextDecoder().decode(parsed!.saltBytes)).toBe('some-salt-16byte');
    expect(parsed!.hashBytes).toHaveLength(32);
  });

  it('b64 段缺省 padding 也能解析（passlib 常见形态），且容忍首尾空白', () => {
    const noPad = DJANGO_VECTOR.replace('c29tZS1zYWx0LTE2Ynl0ZQ==', 'c29tZS1zYWx0LTE2Ynl0ZQ');
    const a = parseDjangoPbkdf2Hash(noPad);
    const b = parseDjangoPbkdf2Hash(`  ${noPad} `);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect([...a!.saltBytes]).toEqual([...b!.saltBytes]);
  });

  it('非法输入一律返回 null（不抛错）', () => {
    const badSamples = [
      '',
      'not-a-django-hash',
      // 字段数不对
      'pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ==',
      'pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ==$a$b',
      // 算法段不合法
      'argon2id$100$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=',
      // 迭代段非数字 / 非正数 / 超上限
      'pbkdf2_sha256$abc$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=',
      'pbkdf2_sha256$0$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=',
      `pbkdf2_sha256$${ITER_MAX + 1}$c29tZS1zYWx0LTE2Ynl0ZQ==$iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=`,
      // 盐 b64 非法字符
      'pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ!$aGVsbG8',
    ];
    for (const sample of badSamples) {
      expect(parseDjangoPbkdf2Hash(sample), sample).toBeNull();
    }
  });
});

describe('getDjangoHashFormatError 差异化中文错误', () => {
  it('合法与空输入返回空串', () => {
    expect(getDjangoHashFormatError(DJANGO_VECTOR)).toBe('');
    expect(getDjangoHashFormatError('')).toBe('');
    expect(getDjangoHashFormatError('   ')).toBe('');
  });

  it('无 $ 分隔结构 → 格式错误', () => {
    expect(getDjangoHashFormatError('pbkdf2_sha256_100_salt_hash')).toContain('格式不正确');
  });

  it('字段数不对 → 提示 4 段结构', () => {
    expect(getDjangoHashFormatError('pbkdf2_sha256$100$c29tZS1zYWx0LTE2Ynl0ZQ==')).toContain('4 段');
  });

  it('pbkdf2 家族其他算法 → 暂仅支持文案（带具体算法名）', () => {
    expect(getDjangoHashFormatError(DJANGO_VECTOR.replace('pbkdf2_sha256', 'pbkdf2_sha1'))).toContain(
      '暂仅支持 pbkdf2_sha256，不支持 pbkdf2_sha1',
    );
  });

  it('非 pbkdf2 家族 → 不是 Django PBKDF2 哈希', () => {
    expect(getDjangoHashFormatError(DJANGO_VECTOR.replace('pbkdf2_sha256', 'argon2id'))).toContain(
      '不是 Django PBKDF2 哈希',
    );
  });

  it('迭代段非正整数 → 迭代段错误', () => {
    expect(getDjangoHashFormatError(DJANGO_VECTOR.replace('$100$', '$abc$'))).toContain('迭代段不正确');
    expect(getDjangoHashFormatError(DJANGO_VECTOR.replace('$100$', '$0$'))).toContain('迭代段不正确');
  });

  it('迭代超上限 → 防卡死拒绝文案', () => {
    expect(getDjangoHashFormatError(DJANGO_VECTOR.replace('$100$', '$100000001$'))).toContain('页面卡死');
  });

  it('盐/哈希段 b64 非法 → 对应提示', () => {
    expect(getDjangoHashFormatError(DJANGO_VECTOR.replace('c29tZS1zYWx0LTE2Ynl0ZQ==', 'c29tZS1zYWx0LTE2Ynl0ZQ!'))).toContain(
      '盐段不合法',
    );
    expect(
      getDjangoHashFormatError(DJANGO_VECTOR.replace('iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=', 'iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc!')),
    ).toContain('哈希段不合法');
  });
});

describe('hex 与 b64 工具', () => {
  it('isValidHex：空串/奇数长度/非法字符拒绝，大小写均接受', () => {
    expect(isValidHex('')).toBe(false);
    expect(isValidHex('0')).toBe(false);
    expect(isValidHex('012')).toBe(false);
    expect(isValidHex('zz')).toBe(false);
    expect(isValidHex('0g')).toBe(false);
    expect(isValidHex('0123abcd')).toBe(true);
    expect(isValidHex('ABCDEF')).toBe(true);
  });

  it('hex ↔ bytes 往返一致', () => {
    const bytes = new Uint8Array([0, 1, 0xab, 0xff, 0x42]);
    expect(bytesToHex(bytes)).toBe('0001abff42');
    expect([...hexToBytes('0001abff42')]).toEqual([0, 1, 0xab, 0xff, 0x42]);
    expect([...hexToBytes(bytesToHex(bytes).toUpperCase())]).toEqual([...bytes]);
  });

  it('bytesToBase64 输出标准 b64（与 atob 互逆）', () => {
    expect(bytesToBase64(new TextEncoder().encode('some-salt-16byte'))).toBe('c29tZS1zYWx0LTE2Ynl0ZQ==');
    expect(bytesToBase64(new Uint8Array([0xff, 0x00, 0x0f]))).toBe('/wAP');
  });

  it('generateRandomSalt：hex 模式 32 个十六进制字符、text 模式 16 个字母数字字符，两次不同', () => {
    const hexSalt = generateRandomSalt('hex');
    expect(hexSalt).toHaveLength(32);
    expect(isValidHex(hexSalt)).toBe(true);
    const textSalt = generateRandomSalt('text');
    expect(textSalt).toHaveLength(16);
    expect(/^[A-Za-z0-9]{16}$/.test(textSalt)).toBe(true);
    expect(generateRandomSalt('hex')).not.toBe(hexSalt);
  });
});

describe('RFC 6070 / SHA-256 known-answer 向量（derivePbkdf2Bytes 实算比对）', () => {
  it('SHA-1 c=1 与 c=4096（RFC 6070）', async () => {
    const c1 = await derivePbkdf2Bytes('password', new TextEncoder().encode('salt'), 1, 'SHA-1', 20);
    expect(bytesToHex(c1)).toBe('0c60c80f961f0e71f3a9b524af6012062fe037a6');
    const c4096 = await derivePbkdf2Bytes('password', new TextEncoder().encode('salt'), 4096, 'SHA-1', 20);
    expect(bytesToHex(c4096)).toBe('4b007901b765489abead49d926f721d065a429c1');
  });

  it('SHA-256 c=1 与 c=2（公开测试向量）', async () => {
    const c1 = await derivePbkdf2Bytes('password', new TextEncoder().encode('salt'), 1, 'SHA-256', 32);
    expect(bytesToHex(c1)).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
    const c2 = await derivePbkdf2Bytes('password', new TextEncoder().encode('salt'), 2, 'SHA-256', 32);
    expect(bytesToHex(c2)).toBe('ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43');
  });
});

describe('Django 固化向量校验正反例', () => {
  it('正确密码匹配、错误密码不匹配（带 padding 与无 padding 两种形态）', async () => {
    for (const hash of [DJANGO_VECTOR, DJANGO_VECTOR.replace('c29tZS1zYWx0LTE2Ynl0ZQ==', 'c29tZS1zYWx0LTE2Ynl0ZQ')]) {
      const parsed = parseDjangoPbkdf2Hash(hash);
      expect(parsed).not.toBeNull();
      expect(
        await verifyDjangoPbkdf2('DevTools@2026', parsed!.iterations, parsed!.saltBytes, parsed!.hashBytes),
      ).toBe(true);
      expect(
        await verifyDjangoPbkdf2('wrong-password', parsed!.iterations, parsed!.saltBytes, parsed!.hashBytes),
      ).toBe(false);
    }
  });

  it('期望哈希字节长度即派生长度（Django 按 b64 哈希段长度派生）', async () => {
    const parsed = parseDjangoPbkdf2Hash(DJANGO_VECTOR);
    const derived = await derivePbkdf2Bytes('DevTools@2026', parsed!.saltBytes, 100, 'SHA-256', 32);
    expect(bytesToBase64(derived)).toBe('iV4oXUv2TPWicMAmrK+VSoOVoqjOTUkuUEkrFJP8zbc=');
  });
});

describe('validatePbkdf2Params', () => {
  it('边界值合法：迭代 1/10000000、dkLen 1/512', () => {
    expect(validatePbkdf2Params(ITER_MIN, DKLEN_MIN)).toBe('');
    expect(validatePbkdf2Params(ITER_MAX, DKLEN_MAX)).toBe('');
    expect(validatePbkdf2Params(600_000, 32)).toBe('');
  });

  it('范围外与非整数拦截并给出字段级文案', () => {
    expect(validatePbkdf2Params(0, 32)).toContain('迭代次数超出范围');
    expect(validatePbkdf2Params(ITER_MAX + 1, 32)).toContain('迭代次数超出范围');
    expect(validatePbkdf2Params(600_000, 0)).toContain('派生长度超出范围');
    expect(validatePbkdf2Params(600_000, 513)).toContain('派生长度超出范围');
    expect(validatePbkdf2Params(1.5, 32)).toContain('迭代次数超出范围');
  });
});

describe('常量守卫', () => {
  it('算法字面量与上限符合产品口径', () => {
    expect(DJANGO_ALGO).toBe('pbkdf2_sha256');
    expect(ITER_MIN).toBe(1);
    expect(ITER_MAX).toBe(10_000_000);
    expect(DKLEN_MIN).toBe(1);
    expect(DKLEN_MAX).toBe(512);
  });
});
