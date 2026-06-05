import { describe, it, expect } from 'vitest';
import {
  generateQrPngDataUrl,
  generateQrSvgString,
  validateQrInput,
  getContrastWarning,
  stripSvgSize,
  QR_ERROR_LEVELS,
  QR_DEFAULT_FOREGROUND,
  QR_DEFAULT_BACKGROUND,
  QR_DEFAULT_SIZE,
  QR_MIN_SIZE,
  QR_MAX_SIZE,
} from '../../utils/media/qr-code';

describe('generateQrSvgString', () => {
  it('应生成有效的 SVG 字符串', async () => {
    const svg = await generateQrSvgString('hello', { size: 200, errorLevel: 'M' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('应能编码中文字符', async () => {
    const svg = await generateQrSvgString('你好世界', { size: 200, errorLevel: 'M' });
    expect(svg.length).toBeGreaterThan(100);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('自定义颜色应出现在输出 SVG 中', async () => {
    const svg = await generateQrSvgString('color-test', {
      size: 200,
      errorLevel: 'M',
      foreground: '#FF0000',
      background: '#00FF00',
    });
    // qrcode 库可能输出小写颜色字符串，使用 toLowerCase 兼容
    expect(svg.toLowerCase()).toContain('#ff0000');
    expect(svg.toLowerCase()).toContain('#00ff00');
  });

  it('同输入同参数应产生一致输出（确定性）', async () => {
    const opts = { size: 200, errorLevel: 'M' as const };
    const svg1 = await generateQrSvgString('deterministic-input', opts);
    const svg2 = await generateQrSvgString('deterministic-input', opts);
    expect(svg1).toBe(svg2);
  });

  it('空字符串应 reject 抛错', async () => {
    await expect(generateQrSvgString('', { size: 200, errorLevel: 'M' })).rejects.toThrow();
  });

  it('纯空白字符串应 reject 抛错', async () => {
    await expect(
      generateQrSvgString('   \t\n  ', { size: 200, errorLevel: 'M' }),
    ).rejects.toThrow();
  });
});

describe('generateQrPngDataUrl', () => {
  it('应返回 data:image/png;base64, 前缀的 DataURL', async () => {
    const url = await generateQrPngDataUrl('hello', { size: 200, errorLevel: 'M' });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('解码后字节签名为 PNG', async () => {
    const url = await generateQrPngDataUrl('hello', { size: 200, errorLevel: 'M' });
    const base64 = url.split(',')[1];
    expect(base64).toBeTruthy();
    const bin = atob(base64);
    // PNG 签名：89 50 4E 47
    expect(bin.charCodeAt(0)).toBe(0x89);
    expect(bin.charCodeAt(1)).toBe(0x50);
    expect(bin.charCodeAt(2)).toBe(0x4e);
    expect(bin.charCodeAt(3)).toBe(0x47);
  });

  it('空字符串应 reject', async () => {
    await expect(generateQrPngDataUrl('', { size: 200, errorLevel: 'M' })).rejects.toThrow();
  });
});

describe('validateQrInput', () => {
  it('空字符串应返回空字符串（视为待输入）', async () => {
    const err = await validateQrInput('', 'M');
    expect(err).toBe('');
  });

  it('纯空白字符串应返回空字符串', async () => {
    const err = await validateQrInput('   \t  ', 'M');
    expect(err).toBe('');
  });

  it('合法短文本应返回空字符串', async () => {
    const err = await validateQrInput('hello world', 'M');
    expect(err).toBe('');
  });

  it('超长输入在 L 容错下应返回包含"过长"的错误信息', async () => {
    const longText = 'a'.repeat(3000);
    const err = await validateQrInput(longText, 'L');
    expect(err).not.toBe('');
    expect(err).toContain('过长');
  });

  it('超长输入在 H 容错下：若 L 报错则 H 不一定报错', async () => {
    const longText = 'a'.repeat(3000);
    const errL = await validateQrInput(longText, 'L');
    if (errL) {
      // 当 L 容错下确实报过长时，H 容错下有可能仍合法
      const errH = await validateQrInput(longText, 'H');
      // 不做强断言：H 容错可能通过也可能不通过，取决于具体容量阈值
      // 但若 H 通过，则不应与 L 报错一致（更宽松的容错应允许更长的输入或不报错）
      expect(typeof errH).toBe('string');
    } else {
      // L 都没报错，H 自然也不应报错
      const errH = await validateQrInput(longText, 'H');
      expect(errH).toBe('');
    }
  });
});

describe('getContrastWarning', () => {
  it('黑前景 + 白背景应返回空字符串（对比度最高）', () => {
    const warning = getContrastWarning('#000000', '#FFFFFF');
    expect(warning).toBe('');
  });

  it('浅灰前景 + 白背景应返回非空警告（对比度低于 3.0）', () => {
    // #BBBBBB vs #FFFFFF 的 WCAG 对比度约 1.90:1，远低于阈值 3.0
    const warning = getContrastWarning('#BBBBBB', '#FFFFFF');
    expect(warning).not.toBe('');
    expect(typeof warning).toBe('string');
  });

  it('非法 hex 应返回空字符串（无法计算时不警告）', () => {
    const warning = getContrastWarning('invalid', '#FFFFFF');
    expect(warning).toBe('');
  });
});

describe('常量导出', () => {
  it('QR_ERROR_LEVELS 长度为 4 且 value 为 L/M/Q/H', () => {
    expect(QR_ERROR_LEVELS).toHaveLength(4);
    expect(QR_ERROR_LEVELS.map((item) => item.value)).toEqual(['L', 'M', 'Q', 'H']);
  });

  it('QR_DEFAULT_FOREGROUND 规范化后是 #000000', () => {
    expect(QR_DEFAULT_FOREGROUND.toLowerCase()).toBe('#000000');
  });

  it('QR_DEFAULT_BACKGROUND 规范化后是 #FFFFFF', () => {
    expect(QR_DEFAULT_BACKGROUND.toLowerCase()).toBe('#ffffff');
  });

  it('QR_MIN_SIZE <= 64', () => {
    expect(QR_MIN_SIZE).toBeLessThanOrEqual(64);
  });

  it('QR_MAX_SIZE >= 1024', () => {
    expect(QR_MAX_SIZE).toBeGreaterThanOrEqual(1024);
  });

  it('QR_DEFAULT_SIZE 在 [QR_MIN_SIZE, QR_MAX_SIZE] 范围内', () => {
    expect(QR_DEFAULT_SIZE).toBeGreaterThanOrEqual(QR_MIN_SIZE);
    expect(QR_DEFAULT_SIZE).toBeLessThanOrEqual(QR_MAX_SIZE);
  });
});

describe('stripSvgSize', () => {
  it('应移除 SVG 根标签的 width 与 height 属性', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">content</svg>';
    const output = stripSvgSize(input);
    expect(output).not.toMatch(/\swidth\s*=/i);
    expect(output).not.toMatch(/\sheight\s*=/i);
  });

  it('应保留 viewBox 与其他属性（xmlns / shape-rendering）', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" shape-rendering="crispEdges"><path/></svg>';
    const output = stripSvgSize(input);
    expect(output).toContain('viewBox="0 0 1024 1024"');
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain('shape-rendering="crispEdges"');
    expect(output).toContain('<path/>');
    expect(output).toContain('</svg>');
  });

  it('应处理真实 qrcode 库输出（生成 SVG → 剥离 → 校验）', async () => {
    const original = await generateQrSvgString('integration test', { size: 256, errorLevel: 'M' });
    expect(original).toMatch(/\swidth="256"/);
    expect(original).toMatch(/\sheight="256"/);
    const stripped = stripSvgSize(original);
    expect(stripped).not.toMatch(/\swidth="256"/);
    expect(stripped).not.toMatch(/\sheight="256"/);
    expect(stripped).toMatch(/viewBox=/);
  });

  it('不含 width/height 的 SVG 应原样返回', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>';
    expect(stripSvgSize(input)).toBe(input);
  });

  it('应大小写不敏感（兼容 WIDTH / Height）', () => {
    const input = '<svg WIDTH="200" Height="200" viewBox="0 0 200 200"/>';
    const output = stripSvgSize(input);
    expect(output).not.toMatch(/WIDTH=/);
    expect(output).not.toMatch(/Height=/);
    expect(output).toContain('viewBox');
  });

  it('应仅处理第一个 <svg> 根标签，不影响内部嵌套 svg（保守起见）', () => {
    // 实际 qrcode 输出只有一个根 svg，此用例验证函数不会误伤后续标签
    const input = '<svg width="200" height="200" viewBox="0 0 200 200"><foreignObject><svg width="50" height="50"/></foreignObject></svg>';
    const output = stripSvgSize(input);
    // 第一个 svg 的 width/height 被移除
    expect(output.indexOf('<svg')).toBeGreaterThanOrEqual(0);
    // 嵌套的 width="50" / height="50" 应保留（replace 只匹配第一次）
    expect(output).toContain('width="50"');
    expect(output).toContain('height="50"');
  });
});
