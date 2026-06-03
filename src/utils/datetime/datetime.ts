import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/zh-cn';

dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale('zh-cn');

/** 时间戳单位检测结果 */
export type TimestampUnit = 's' | 'ms' | null;

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

/** 将时间戳转为多格式日期信息 */
export function timestampToDateInfo(timestamp: number): DateInfo {
  const d = dayjs(timestamp);
  return {
    iso: d.toISOString(),
    local: d.format('YYYY-MM-DD HH:mm:ss'),
    utc: d.utc().format('YYYY-MM-DD HH:mm:ss [UTC]'),
    relative: d.fromNow(),
    unixSeconds: Math.floor(timestamp / 1000),
    unixMillis: timestamp,
  };
}

/** 解析日期字符串为多格式信息 */
export function parseDateInput(dateStr: string): DateInfo | null {
  if (!dateStr.trim()) return null;
  const d = dayjs(dateStr);
  if (!d.isValid()) return null;
  return timestampToDateInfo(d.valueOf());
}
