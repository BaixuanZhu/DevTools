/**
 * Cron 表达式解析工具函数
 * 基于 cron-parser 库，提供表达式解析、字段构建和模板管理
 */
import { CronExpressionParser } from 'cron-parser';

/** Cron 字段结构（标准 5 字段格式） */
export interface CronFields {
  minute: string;
  hour: string;
  day: string;
  month: string;
  dayOfWeek: string;
}

/** Cron 解析结果 */
export interface CronParseResult {
  /** 接下来 N 次执行时间 */
  nextExecutions: Date[];
  /** 当前表达式各字段值 */
  fields: CronFields;
}

/** 常用 Cron 模板 */
export const CRON_TEMPLATES = [
  { label: '每分钟', expression: '* * * * *' },
  { label: '每小时', expression: '0 * * * *' },
  { label: '每天零点', expression: '0 0 * * *' },
  { label: '每天 9 点', expression: '0 9 * * *' },
  { label: '每周一 9 点', expression: '0 9 * * 1' },
  { label: '每月 1 日零点', expression: '0 0 1 * *' },
  { label: '工作日 9 点', expression: '0 9 * * 1-5' },
  { label: '每 5 分钟', expression: '*/5 * * * *' },
  { label: '每 15 分钟', expression: '*/15 * * * *' },
  { label: '每 30 分钟', expression: '0,30 * * * *' },
] as const;

/** 字段名映射（中文） */
export const FIELD_LABELS: Record<keyof CronFields, string> = {
  minute: '分钟',
  hour: '小时',
  day: '日',
  month: '月',
  dayOfWeek: '周',
};

/** 各字段预设选项 */
export const FIELD_OPTIONS: Record<keyof CronFields, { key: string; label: string }[]> = {
  minute: [
    { key: '*', label: '每分钟' },
    { key: '*/5', label: '每 5 分钟' },
    { key: '*/15', label: '每 15 分钟' },
    { key: '*/30', label: '每 30 分钟' },
    { key: '0', label: '第 0 分' },
    { key: '0,30', label: '0 和 30 分' },
  ],
  hour: [
    { key: '*', label: '每小时' },
    { key: '0', label: '0 点' },
    { key: '6', label: '6 点' },
    { key: '9', label: '9 点' },
    { key: '12', label: '12 点' },
    { key: '18', label: '18 点' },
  ],
  day: [
    { key: '*', label: '每天' },
    { key: '1', label: '1 日' },
    { key: '15', label: '15 日' },
  ],
  month: [
    { key: '*', label: '每月' },
    { key: '1', label: '1 月' },
    { key: '*/3', label: '每 3 月' },
    { key: '*/6', label: '每 6 月' },
  ],
  dayOfWeek: [
    { key: '*', label: '每天' },
    { key: '1', label: '周一' },
    { key: '2', label: '周二' },
    { key: '3', label: '周三' },
    { key: '4', label: '周四' },
    { key: '5', label: '周五' },
    { key: '1-5', label: '工作日' },
    { key: '0,6', label: '周末' },
  ],
};

/**
 * 解析 Cron 表达式，返回接下来 N 次执行时间
 * @param expression 标准 5 字段 Cron 表达式
 * @param count 返回的执行时间数量，默认 10
 * @throws 表达式格式错误时抛出中文描述错误
 */
export function parseCronExpression(expression: string, count: number = 10): CronParseResult {
  const trimmed = expression.trim();

  if (!trimmed) {
    throw new Error('请输入 Cron 表达式');
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Cron 表达式应有 5 个字段（分 时 日 月 周）');
  }

  try {
    const interval = CronExpressionParser.parse(trimmed, {
      currentDate: new Date(),
    });

    const nextExecutions: Date[] = [];
    for (let i = 0; i < count; i++) {
      try {
        nextExecutions.push(interval.next().toDate());
      } catch {
        break;
      }
    }

    return {
      nextExecutions,
      fields: getFieldsFromExpression(trimmed),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '表达式无效';
    if (msg.includes('invalid cron expression')) {
      throw new Error('无效的 Cron 表达式，请检查字段值');
    }
    throw new Error(`表达式解析失败：${msg}`);
  }
}

/**
 * 从 5 个字段值拼接 Cron 表达式
 * @param fields 各字段值
 */
export function buildCronFromFields(fields: CronFields): string {
  return [fields.minute, fields.hour, fields.day, fields.month, fields.dayOfWeek].join(' ');
}

/**
 * 将 Cron 表达式拆分为 5 个字段
 * @param expression 标准 5 字段 Cron 表达式
 */
export function getFieldsFromExpression(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  return {
    minute: parts[0] ?? '*',
    hour: parts[1] ?? '*',
    day: parts[2] ?? '*',
    month: parts[3] ?? '*',
    dayOfWeek: parts[4] ?? '*',
  };
}

/**
 * 格式化日期为本地时间字符串
 * @param date 日期对象
 */
export function formatExecutionTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
