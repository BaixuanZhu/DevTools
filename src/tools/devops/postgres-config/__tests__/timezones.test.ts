/**
 * 时区候选表不变量测试（timezones.ts，design §7b）。
 * 核心目的：以运行时真值锚定数据——每条 IANA 名必须被 Intl 运行时识别
 * （防凭记忆编造），offset 必须与运行时标准偏移一致（防手算漂移），
 * 并锁定默认值条目（UTC / Asia/Shanghai）与 SearchSelect 选项映射契约。
 */
import { describe, it, expect } from 'vitest';
import { TIMEZONES, TIMEZONE_OPTIONS } from '../timezones';
import { getParam } from '../params';

/** 全年 4 个样本日：取最小偏移 = 标准偏移（夏令时恒为加偏移；南半球 1 月正值夏令时） */
const OFFSET_SAMPLES = [
  '2026-01-15T12:00:00Z',
  '2026-04-15T12:00:00Z',
  '2026-07-15T12:00:00Z',
  '2026-10-15T12:00:00Z',
];

/**
 * 运行时计算某时区的标准偏移分钟数（含符号）。
 * @param tz - IANA 时区名
 * @returns 带符号的分钟数（如上海 480、纽约 −300）
 */
function standardOffsetMinutes(tz: string): number {
  const minutes = OFFSET_SAMPLES.map((iso) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date(iso))
      .find((p) => p.type === 'timeZoneName')?.value;
    if (name === 'GMT') return 0;
    const m = name?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (!m) throw new Error(`无法解析 ${tz} 的 longOffset 输出：${name}`);
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3]));
  });
  return Math.min(...minutes);
}

/** 标准偏移分钟数 → 'UTC+8' / 'UTC-3:30' 形态（与 timezones.ts 生成规则一致） */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${h}${mm ? ':' + String(mm).padStart(2, '0') : ''}`;
}

describe('TIMEZONES 数据不变量', () => {
  // 有效性锚定用 Intl.DateTimeFormat 可解析性而非 supportedValuesOf 枚举成员：
  // 后者只含 canonical 名（且各运行时 ICU 版本取向不同），前者接受 tzdata 全部
  // canonical 名与 backward 链接名——与 PostgreSQL 的接受面一致；UTC 无需例外。
  it('每条 value 都能被 ICU 解析（与 PostgreSQL tzdata 接受面一致）', () => {
    for (const t of TIMEZONES) {
      expect(
        () => new Intl.DateTimeFormat('en-US', { timeZone: t.value }),
        `${t.value} 无法被 ICU 解析`,
      ).not.toThrow();
    }
  });

  it('value 唯一且非空', () => {
    const values = TIMEZONES.map((t) => t.value);
    for (const v of values) expect(v).not.toBe('');
    expect(new Set(values).size).toBe(values.length);
  });

  it('含 UTC 与默认值 Asia/Shanghai', () => {
    const values = new Set(TIMEZONES.map((t) => t.value));
    expect(values.has('UTC')).toBe(true);
    expect(values.has('Asia/Shanghai')).toBe(true);
  });

  it('条目数不少于 60（约 80 条常用集，允许精选微调）', () => {
    expect(TIMEZONES.length).toBeGreaterThanOrEqual(60);
  });

  it('offset 均为 UTC±H[:MM] 形态', () => {
    for (const t of TIMEZONES) {
      expect(t.offset, t.value).toMatch(/^UTC[+-]\d{1,2}(:\d{2})?$/);
    }
  });

  it('offset 与运行时标准偏移一致（脚本生成初值后的语义兜底，防手算漂移与时区规则变更）', () => {
    for (const t of TIMEZONES) {
      expect(t.offset, t.value).toBe(formatOffset(standardOffsetMinutes(t.value)));
    }
  });

  it('每条均有中文标注、大区与搜索关键词', () => {
    for (const t of TIMEZONES) {
      expect(t.label, t.value).not.toBe('');
      expect(t.region, t.value).not.toBe('');
      for (const kw of t.keywords) expect(kw, `${t.value} 关键词`).not.toBe('');
    }
  });
});

describe('TIMEZONE_OPTIONS 选项映射', () => {
  it('与 TIMEZONES 一一对应，keywords 覆盖 IANA 名 / 大区 / 偏移', () => {
    expect(TIMEZONE_OPTIONS).toHaveLength(TIMEZONES.length);
    TIMEZONES.forEach((t, i) => {
      const o = TIMEZONE_OPTIONS[i]!;
      expect(o.value).toBe(t.value);
      expect(o.label).toBe(t.label);
      for (const kw of [t.value, t.region, t.offset]) {
        expect(o.keywords, `${t.value} 关键词应含 ${kw}`).toContain(kw);
      }
    });
  });
});

describe('params 注册表接入（design §7b）', () => {
  it('timezone / log_timezone 为 combobox 且 options 与 TIMEZONE_OPTIONS 同源', () => {
    for (const key of ['timezone', 'log_timezone'] as const) {
      const param = getParam(key);
      expect(param?.control, key).toBe('combobox');
      expect(param?.options, key).toEqual(TIMEZONE_OPTIONS);
    }
  });

  it('默认值保持 Asia/Shanghai（渲染产物不变：timezone = \'Asia/Shanghai\'）', () => {
    expect(getParam('timezone')?.defaultValue).toBe('Asia/Shanghai');
    expect(getParam('log_timezone')?.defaultValue).toBe('Asia/Shanghai');
  });
});
