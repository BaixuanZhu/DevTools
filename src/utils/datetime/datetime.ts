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

/** 检测时间戳是秒级还是毫秒级 */
export function detectTimestampUnit(input: string): TimestampUnit {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (trimmed.length >= 13 || num > 9999999999) return 'ms';
  if (trimmed.length >= 10) return 's';
  return null;
}

/** 按指定时区格式化时间戳 */
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

/** 解析日期字符串为多格式信息 */
export function parseDateInput(
  dateStr: string,
  tz: string = 'local',
  customFormatStr: string = 'YYYY-MM-DD HH:mm:ss',
): DateInfo | null {
  if (!dateStr.trim()) return null;
  const d = dayjs(dateStr);
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
