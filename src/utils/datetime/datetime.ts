import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/zh-cn';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale('zh-cn');

/** 时间戳单位检测结果 */
export type TimestampUnit = 's' | 'ms' | null;

/** 时区选项 */
export interface TimezoneOption {
  label: string;
  value: string;
}

/** 常用时区列表 */
export const TIMEZONES: TimezoneOption[] = [
  { label: '本地时间', value: 'local' },
  { label: 'UTC', value: 'UTC' },
  { label: '北京时间 (UTC+8)', value: 'Asia/Shanghai' },
  { label: '东京 (UTC+9)', value: 'Asia/Tokyo' },
  { label: '首尔 (UTC+9)', value: 'Asia/Seoul' },
  { label: '新加坡 (UTC+8)', value: 'Asia/Singapore' },
  { label: '迪拜 (UTC+4)', value: 'Asia/Dubai' },
  { label: '伦敦 (UTC+0/+1)', value: 'Europe/London' },
  { label: '巴黎 (UTC+1/+2)', value: 'Europe/Paris' },
  { label: '莫斯科 (UTC+3)', value: 'Europe/Moscow' },
  { label: '纽约 (UTC-5/-4)', value: 'America/New_York' },
  { label: '芝加哥 (UTC-6/-5)', value: 'America/Chicago' },
  { label: '丹佛 (UTC-7/-6)', value: 'America/Denver' },
  { label: '洛杉矶 (UTC-8/-7)', value: 'America/Los_Angeles' },
  { label: '悉尼 (UTC+10/+11)', value: 'Australia/Sydney' },
];

/** 快捷时间类型 */
export type QuickTimeType = 'now' | 'today' | 'yesterday' | 'tomorrow' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

/** 快捷时间选项 */
export const QUICK_TIME_OPTIONS: { key: QuickTimeType; label: string }[] = [
  { key: 'now', label: '现在' },
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'tomorrow', label: '明天' },
  { key: 'thisWeek', label: '本周' },
  { key: 'lastWeek', label: '上周' },
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
];

/** 日期信息（多格式展示） */
export interface DateInfo {
  /** ISO 8601 格式 */
  iso: string;
  /** 本地日期时间 */
  local: string;
  /** UTC 时间 */
  utc: string;
  /** 相对时间 */
  relative: string;
  /** Unix 秒级时间戳 */
  unixSeconds: number;
  /** Unix 毫秒级时间戳 */
  unixMillis: number;
  /** RFC 2822 格式 */
  rfc2822: string;
  /** 指定时区的时间 */
  tzTime: string;
  /** 自定义格式结果 */
  custom: string;
}

/** 检测输入字符串是 Unix 秒级还是毫秒级时间戳。 */
export function detectTimestampUnit(input: string): TimestampUnit {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (trimmed.length >= 13 || num > 9999999999) return 'ms';
  if (trimmed.length >= 10) return 's';
  return null;
}

/** 按指定时区格式化时间戳 */
/** 按指定时区将时间戳格式化为 `YYYY-MM-DD HH:mm:ss`。 */
export function formatByTimezone(timestamp: number, tz: string): string {
  if (tz === 'local') {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  }
  return dayjs(timestamp).tz(tz).format('YYYY-MM-DD HH:mm:ss');
}

/** 自定义格式输出 */
export function formatCustom(timestamp: number, formatStr: string): string {
  if (!formatStr.trim()) return '';
  try {
    return dayjs(timestamp).format(formatStr);
  } catch {
    return '格式无效';
  }
}

/** 获取快捷时间的时间戳（毫秒） */
/** 获取指定快捷时间对应的时间戳（毫秒）。 */
export function getQuickTimestamp(type: QuickTimeType): number {
  const now = dayjs();
  switch (type) {
    case 'now':
      return now.valueOf();
    case 'today':
      return now.startOf('day').valueOf();
    case 'yesterday':
      return now.subtract(1, 'day').startOf('day').valueOf();
    case 'tomorrow':
      return now.add(1, 'day').startOf('day').valueOf();
    case 'thisWeek':
      return now.startOf('week').valueOf();
    case 'lastWeek':
      return now.subtract(1, 'week').startOf('week').valueOf();
    case 'thisMonth':
      return now.startOf('month').valueOf();
    case 'lastMonth':
      return now.subtract(1, 'month').startOf('month').valueOf();
    default:
      return now.valueOf();
  }
}

/** 将时间戳转为多格式日期信息 */
export function timestampToDateInfo(
  timestamp: number,
  tz: string = 'local',
  customFormatStr: string = 'YYYY-MM-DD HH:mm:ss',
): DateInfo {
  const d = dayjs(timestamp);
  return {
    iso: d.toISOString(),
    local: d.format('YYYY-MM-DD HH:mm:ss'),
    utc: d.utc().format('YYYY-MM-DD HH:mm:ss [UTC]'),
    relative: d.fromNow(),
    unixSeconds: Math.floor(timestamp / 1000),
    unixMillis: timestamp,
    rfc2822: d.toDate().toUTCString(),
    tzTime: formatByTimezone(timestamp, tz),
    custom: formatCustom(timestamp, customFormatStr),
  };
}

/**
 * 解析标准格式日期字符串为多格式信息。
 * 仅支持 `YYYY/MM/DD HH:mm:ss` 格式，其它格式返回 null。
 * @param dateStr 待解析的日期字符串
 * @param tz 目标时区，默认为本地时间
 * @param customFormatStr 自定义输出格式字符串
 * @returns 解析成功返回完整日期信息，否则返回 null
 */
export function parseDateInput(
  dateStr: string,
  tz: string = 'local',
  customFormatStr: string = 'YYYY-MM-DD HH:mm:ss',
): DateInfo | null {
  if (!dateStr.trim()) return null;
  const d = dayjs(dateStr, 'YYYY/MM/DD HH:mm:ss', true);
  if (!d.isValid()) return null;
  return timestampToDateInfo(d.valueOf(), tz, customFormatStr);
}

/** 获取实时时钟信息 */
export function getLiveClockInfo(tz: string = 'local') {
  const now = Date.now();
  const d = dayjs(now);
  return {
    unixSeconds: Math.floor(now / 1000),
    unixMillis: now,
    iso: d.toISOString(),
    local: d.format('YYYY-MM-DD HH:mm:ss'),
    utc: d.utc().format('YYYY-MM-DD HH:mm:ss'),
    tzTime: formatByTimezone(now, tz),
  };
}

/**
 * 灵活解析时间输入：接受 Unix 时间戳（秒/毫秒）或 `yyyy/MM/dd HH:mm:ss` 日期。
 *
 * 解析顺序：先按纯数字判定时间戳（复用 detectTimestampUnit），再尝试标准日期格式
 * （复用 parseDateInput）。两者互斥，无需额外分支。
 *
 * @param input 用户输入字符串
 * @returns 解析成功返回毫秒时间戳，空串或无法识别返回 null
 */
export function parseFlexibleTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const unit = detectTimestampUnit(trimmed);
  if (unit) {
    const num = Number(trimmed);
    return unit === 's' ? num * 1000 : num;
  }
  const info = parseDateInput(trimmed);
  return info ? info.unixMillis : null;
}

/** 两个时间点的差值拆解结果。 */
export interface Duration {
  /** a 相对 b 的先后：1 = a 晚于 b，-1 = a 早于 b，0 = 相同 */
  sign: 1 | -1 | 0;
  /** 整天数（按 86400 秒计，不足一天的余量计入 hours） */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 差值绝对值换算的总秒数（毫秒部分向下取整） */
  totalSeconds: number;
}

/**
 * 计算两个毫秒时间戳的差值并拆解为天/时/分/秒。
 *
 * 拆解值（days/hours/...）始终为差值绝对值，方向由 sign 单独给出，
 * 便于倒计时（取绝对剩余）与时间差（附带方向）共用同一函数。
 *
 * @param a 第一个时间点（毫秒）
 * @param b 第二个时间点（毫秒）
 * @returns 差值拆解结果
 */
export function computeDuration(a: number, b: number): Duration {
  const diffMs = a - b;
  const totalSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const sign: 1 | -1 | 0 = diffMs > 0 ? 1 : diffMs < 0 ? -1 : 0;
  return { sign, days, hours, minutes, seconds, totalSeconds };
}

/**
 * 把 Duration 格式化为中文时长字符串，如「1天 2时 3分 4秒」。
 * 省略为 0 的单位；全为 0 时返回「0秒」。
 * @param d 时长拆解结果
 * @returns 格式化后的字符串
 */
export function formatDurationParts(d: Duration): string {
  const parts: string[] = [];
  if (d.days > 0) parts.push(`${d.days}天`);
  if (d.hours > 0) parts.push(`${d.hours}时`);
  if (d.minutes > 0) parts.push(`${d.minutes}分`);
  if (d.seconds > 0 || parts.length === 0) parts.push(`${d.seconds}秒`);
  return parts.join(' ');
}
