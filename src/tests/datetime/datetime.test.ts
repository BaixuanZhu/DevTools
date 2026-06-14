import { describe, it, expect } from 'vitest';
import {
  detectTimestampUnit,
  timestampToDateInfo,
  parseDateInput,
  formatByTimezone,
  formatCustom,
  getQuickTimestamp,
  getLiveClockInfo,
  TIMEZONES,
  QUICK_TIME_OPTIONS,
} from '../../utils/datetime/datetime';

describe('detectTimestampUnit', () => {
  it('应将 13 位数字识别为毫秒', () => {
    expect(detectTimestampUnit('1700000000000')).toBe('ms');
  });

  it('应将 10 位数字识别为秒', () => {
    expect(detectTimestampUnit('1700000000')).toBe('s');
  });

  it('应将空字符串返回 null', () => {
    expect(detectTimestampUnit('')).toBeNull();
  });

  it('应将非数字返回 null', () => {
    expect(detectTimestampUnit('abc')).toBeNull();
  });
});

describe('timestampToDateInfo', () => {
  it('应正确解析毫秒时间戳', () => {
    const info = timestampToDateInfo(1700000000000);
    expect(info.iso).toContain('2023');
    expect(info.unixSeconds).toBe(1700000000);
    expect(info.unixMillis).toBe(1700000000000);
  });

  it('应正确解析秒级时间戳转为毫秒后', () => {
    const info = timestampToDateInfo(1700000000 * 1000);
    expect(info.iso).toContain('2023');
    expect(info.unixSeconds).toBe(1700000000);
  });

  it('应包含所有必要字段', () => {
    const info = timestampToDateInfo(Date.now());
    expect(info).toHaveProperty('iso');
    expect(info).toHaveProperty('local');
    expect(info).toHaveProperty('utc');
    expect(info).toHaveProperty('relative');
    expect(info).toHaveProperty('unixSeconds');
    expect(info).toHaveProperty('unixMillis');
    expect(info).toHaveProperty('rfc2822');
    expect(info).toHaveProperty('tzTime');
    expect(info).toHaveProperty('custom');
  });

  it('应包含 RFC 2822 格式', () => {
    const info = timestampToDateInfo(1700000000000);
    expect(info.rfc2822).toBeTruthy();
    expect(typeof info.rfc2822).toBe('string');
  });

  it('应支持指定时区', () => {
    const info = timestampToDateInfo(1700000000000, 'Asia/Tokyo');
    expect(info.tzTime).toBeTruthy();
  });

  it('应支持自定义格式', () => {
    const info = timestampToDateInfo(1700000000000, 'local', 'YYYY/MM/DD');
    expect(info.custom).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});

describe('parseDateInput', () => {
  it('应解析标准格式日期字符串', () => {
    const info = parseDateInput('2023/11/14 12:00:00');
    expect(info).not.toBeNull();
    expect(info!.unixSeconds).toBeGreaterThan(0);
  });

  it('应支持指定时区', () => {
    const info = parseDateInput('2023/11/14 12:00:00', 'Asia/Tokyo');
    expect(info).not.toBeNull();
    expect(info!.tzTime).toBeTruthy();
  });

  it('应支持自定义格式', () => {
    const info = parseDateInput('2023/11/14 12:00:00', 'local', 'YYYY/MM/DD');
    expect(info).not.toBeNull();
    expect(info!.custom).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('应返回 null 对于无效输入', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('invalid')).toBeNull();
  });
});

describe('formatByTimezone', () => {
  it('应格式化本地时间', () => {
    const result = formatByTimezone(1700000000000, 'local');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('应格式化 UTC 时间', () => {
    const result = formatByTimezone(1700000000000, 'UTC');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('应格式化亚洲/上海时间', () => {
    const result = formatByTimezone(1700000000000, 'Asia/Shanghai');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

describe('formatCustom', () => {
  it('应按自定义格式输出', () => {
    const result = formatCustom(1700000000000, 'YYYY/MM/DD HH:mm');
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it('应返回空字符串对空格式', () => {
    expect(formatCustom(1700000000000, '')).toBe('');
  });
});

describe('getQuickTimestamp', () => {
  it('应返回当前时间戳', () => {
    const ts = getQuickTimestamp('now');
    expect(ts).toBeGreaterThan(0);
    expect(Math.abs(ts - Date.now())).toBeLessThan(1000);
  });

  it('应返回今天零点的时间戳', () => {
    const ts = getQuickTimestamp('today');
    const d = new Date(ts);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('应返回昨天零点的时间戳', () => {
    const ts = getQuickTimestamp('yesterday');
    const d = new Date(ts);
    expect(d.getHours()).toBe(0);
  });

  it('应返回明天零点的时间戳', () => {
    const ts = getQuickTimestamp('tomorrow');
    const d = new Date(ts);
    expect(d.getHours()).toBe(0);
  });
});

describe('getLiveClockInfo', () => {
  it('应返回实时时钟信息', () => {
    const info = getLiveClockInfo('local');
    expect(info).toHaveProperty('unixSeconds');
    expect(info).toHaveProperty('unixMillis');
    expect(info).toHaveProperty('iso');
    expect(info).toHaveProperty('local');
    expect(info).toHaveProperty('utc');
    expect(info).toHaveProperty('tzTime');
    expect(info.unixSeconds).toBeGreaterThan(0);
  });

  it('应返回接近当前时间的毫秒时间戳', () => {
    const info = getLiveClockInfo('local');
    expect(Math.abs(info.unixMillis - Date.now())).toBeLessThan(1000);
  });
});

describe('常量导出', () => {
  it('TIMEZONES 应包含常用时区', () => {
    expect(TIMEZONES.length).toBeGreaterThanOrEqual(10);
    const values = TIMEZONES.map(tz => tz.value);
    expect(values).toContain('local');
    expect(values).toContain('UTC');
    expect(values).toContain('Asia/Shanghai');
    expect(values).toContain('America/New_York');
  });

  it('QUICK_TIME_OPTIONS 应包含快捷选项', () => {
    expect(QUICK_TIME_OPTIONS.length).toBeGreaterThanOrEqual(6);
    const keys = QUICK_TIME_OPTIONS.map(opt => opt.key);
    expect(keys).toContain('now');
    expect(keys).toContain('today');
    expect(keys).toContain('yesterday');
  });
});
