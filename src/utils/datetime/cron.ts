/**
 * Cron 表达式解析工具函数
 * 基于 cron-parser 库，提供表达式解析、字段构建和模板管理
 * 支持 5/6/7 字段格式（分/时/日/月/周，可选秒和年）
 */
import { CronExpressionParser } from 'cron-parser';

// =============================================================================
// 类型定义
// =============================================================================

/** 字段模式类型 */
export type FieldMode =
  // 通用模式（所有字段共享）
  | 'every' | 'range' | 'step' | 'specific'
  // 日字段专属
  | 'lastDay' | 'lastNDay' | 'nearWeekday' | 'lastWeekday'
  // 周字段专属
  | 'lastN' | 'nthDay';

/** 单个字段的构建状态 */
export interface FieldState {
  /** 当前模式 */
  mode: FieldMode;
  /** 周期模式：起始值 */
  rangeStart?: number;
  /** 周期模式：结束值 */
  rangeEnd?: number;
  /** 步长模式：起始值 */
  stepStart?: number;
  /** 步长模式：间隔 */
  stepInterval?: number;
  /** 指定值模式：具体值列表 */
  specificValues?: number[];
  /** 日字段 L-N 模式：倒数第 N 天 */
  lastN?: number;
  /** 日字段 W 模式：最近工作日的日期 */
  nearWDay?: number;
  /** 周字段 N#M 模式：第 N 个 */
  nthDayN?: number;
  /** 周字段 N#M 模式：星期几 */
  nthDayWeekday?: number;
}

/** 7 字段 Cron 字段结构 */
export interface CronFields7 {
  second: string;
  minute: string;
  hour: string;
  day: string;
  month: string;
  dayOfWeek: string;
  year: string;
}

/** 7 字段解析结果 */
export interface CronParseResult {
  /** 接下来 N 次执行时间 */
  nextExecutions: Date[];
  /** 当前表达式各字段值（7 字段格式） */
  fields: CronFields7;
}

/** 字段配置 */
export interface FieldConfig {
  /** 字段标识 */
  key: keyof CronFields7;
  /** 中文标签 */
  label: string;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 该字段支持的模式列表 */
  modes: FieldMode[];
}

// =============================================================================
// 常量定义
// =============================================================================

/** 7 个字段的配置信息 */
export const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'second', label: '秒', min: 0, max: 59, modes: ['every', 'range', 'step', 'specific'] },
  { key: 'minute', label: '分', min: 0, max: 59, modes: ['every', 'range', 'step', 'specific'] },
  { key: 'hour', label: '时', min: 0, max: 23, modes: ['every', 'range', 'step', 'specific'] },
  { key: 'day', label: '日', min: 1, max: 31, modes: ['every', 'range', 'step', 'specific', 'lastDay', 'lastNDay', 'nearWeekday', 'lastWeekday'] },
  { key: 'month', label: '月', min: 1, max: 12, modes: ['every', 'range', 'step', 'specific'] },
  { key: 'dayOfWeek', label: '周', min: 0, max: 6, modes: ['every', 'range', 'step', 'specific', 'lastN', 'nthDay'] },
  { key: 'year', label: '年', min: 1970, max: 2099, modes: ['every', 'range', 'specific'] },
];

/** 字段配置映射（按 key 索引） */
export const FIELD_CONFIG_MAP: Record<keyof CronFields7, FieldConfig> = {
  second: FIELD_CONFIGS[0],
  minute: FIELD_CONFIGS[1],
  hour: FIELD_CONFIGS[2],
  day: FIELD_CONFIGS[3],
  month: FIELD_CONFIGS[4],
  dayOfWeek: FIELD_CONFIGS[5],
  year: FIELD_CONFIGS[6],
};

/** 常用 Cron 模板 */
export const CRON_TEMPLATES = [
  { label: '每分钟', expression: '* * * * *' },
  { label: '每小时', expression: '0 * * * *' },
  { label: '每天零点', expression: '0 0 * * *' },
  { label: '每天 9 点', expression: '0 9 * * *' },
  { label: '工作日 9 点', expression: '0 9 * * 1-5' },
  { label: '每周一 9 点', expression: '0 9 * * 1' },
  { label: '每月 1 日零点', expression: '0 0 1 * *' },
  { label: '每年 1 月 1 日', expression: '0 0 1 1 *' },
  { label: '每 5 分钟', expression: '*/5 * * * *' },
  { label: '每 30 分钟', expression: '0,30 * * * *' },
] as const;

/** 星期名称（0=周日, 1=周一, ..., 6=周六） */
export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 月份名称（1月~12月，索引 0 对应 1 月） */
export const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] as const;

/** 默认 7 字段状态（全为 every） */
export const DEFAULT_FIELDS_7: Record<keyof CronFields7, FieldState> = {
  second: { mode: 'every' },
  minute: { mode: 'every' },
  hour: { mode: 'every' },
  day: { mode: 'every' },
  month: { mode: 'every' },
  dayOfWeek: { mode: 'every' },
  year: { mode: 'every' },
};

// =============================================================================
// 字段值解析与构建
// =============================================================================

/**
 * 将单个字段的 Cron 字符串值解析为 FieldState
 * @param value 字段字符串值，如 `*`、`1-5`、`0/5`、`1,3,5`
 * @returns 解析后的字段状态
 */
export function parseFieldValue(value: string): FieldState {
  const trimmed = value.trim();

  if (trimmed === '*') {
    return { mode: 'every' };
  }

  // 先检查 L 和 W 系列语法（必须在 - 检查之前，因为 L-3 包含 -）
  if (trimmed === 'L') {
    return { mode: 'lastDay' };
  }
  if (trimmed === 'LW') {
    return { mode: 'lastWeekday' };
  }
  if (/^L-\d+$/.test(trimmed)) {
    const n = parseInt(trimmed.slice(2), 10);
    return { mode: 'lastNDay', lastN: n };
  }
  if (/^\d+W$/.test(trimmed)) {
    const day = parseInt(trimmed.slice(0, -1), 10);
    return { mode: 'nearWeekday', nearWDay: day };
  }
  if (/^\d+L$/.test(trimmed)) {
    const weekday = parseInt(trimmed.slice(0, -1), 10);
    return { mode: 'lastN', nthDayWeekday: weekday };
  }
  if (trimmed.includes('#')) {
    const [weekday, n] = trimmed.split('#');
    const nthDayWeekday = parseInt(weekday, 10);
    const nthDayN = parseInt(n, 10);
    if (!isNaN(nthDayWeekday) && !isNaN(nthDayN)) {
      return { mode: 'nthDay', nthDayN, nthDayWeekday };
    }
  }

  if (trimmed.includes('/')) {
    const [start, interval] = trimmed.split('/');
    const stepStart = start === '*' ? 0 : parseInt(start, 10);
    const stepInterval = parseInt(interval, 10);
    if (!isNaN(stepStart) && !isNaN(stepInterval) && stepInterval > 0) {
      return { mode: 'step', stepStart, stepInterval };
    }
    return { mode: 'every' };
  }

  if (trimmed.includes('-')) {
    const [start, end] = trimmed.split('-');
    const rangeStart = parseInt(start, 10);
    const rangeEnd = parseInt(end, 10);
    if (!isNaN(rangeStart) && !isNaN(rangeEnd)) {
      return { mode: 'range', rangeStart, rangeEnd };
    }
    return { mode: 'every' };
  }

  if (trimmed.includes(',')) {
    const values = trimmed
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((n) => !isNaN(n));
    if (values.length > 0) {
      return { mode: 'specific', specificValues: values };
    }
    return { mode: 'every' };
  }

  const num = parseInt(trimmed, 10);
  if (!isNaN(num)) {
    return { mode: 'specific', specificValues: [num] };
  }

  return { mode: 'every' };
}

/**
 * 将 FieldState 构建为 Cron 字段字符串值
 * @param state 字段状态
 * @returns Cron 字段字符串，如 `*`、`1-5`、`0/5`、`1,3,5`
 */
export function buildFieldValue(state: FieldState): string {
  switch (state.mode) {
    case 'every':
      return '*';
    case 'range':
      if (state.rangeStart === undefined || state.rangeEnd === undefined) return '*';
      return `${state.rangeStart}-${state.rangeEnd}`;
    case 'step':
      if (state.stepStart === undefined || state.stepInterval === undefined) return '*';
      return `${state.stepStart}/${state.stepInterval}`;
    case 'specific':
      if (!state.specificValues?.length) return '*';
      return state.specificValues.join(',');
    case 'lastDay':
      return 'L';
    case 'lastNDay':
      if (state.lastN === undefined) return 'L';
      return `L-${state.lastN}`;
    case 'nearWeekday':
      if (state.nearWDay === undefined) return '*';
      return `${state.nearWDay}W`;
    case 'lastWeekday':
      return 'LW';
    case 'lastN':
      if (state.nthDayWeekday === undefined) return '*';
      return `${state.nthDayWeekday}L`;
    case 'nthDay':
      if (state.nthDayN === undefined || state.nthDayWeekday === undefined) return '*';
      return `${state.nthDayWeekday}#${state.nthDayN}`;
    default:
      return '*';
  }
}

/**
 * 解析指定值输入字符串为去重排序的数字数组
 * @param input 用户输入的逗号分隔字符串
 * @param min 字段最小值
 * @param max 字段最大值
 * @returns 有效数字数组（已去重排序）
 */
export function parseSpecificValues(input: string, min: number, max: number): number[] {
  return input
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(n => !isNaN(n) && n >= min && n <= max)
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .sort((a, b) => a - b);
}

// =============================================================================
// 表达式构建与解析
// =============================================================================

/**
 * 从 7 个字段状态构建 Cron 表达式
 * 自适应省略默认值字段：秒和年为 `*` 时自动省略
 * @param fields 7 个字段的字符串值
 * @returns 构建后的 Cron 表达式（5/6/7 字段）
 */
export function buildCronFromFields(fields: CronFields7): string {
  const parts = [
    fields.second,
    fields.minute,
    fields.hour,
    fields.day,
    fields.month,
    fields.dayOfWeek,
    fields.year,
  ];

  let startIndex = 0;
  let endIndex = 7;

  // 秒为 * 时省略
  if (fields.second === '*') startIndex = 1;
  // 年为 * 时省略
  if (fields.year === '*') endIndex = 6;

  return parts.slice(startIndex, endIndex).join(' ');
}

/**
 * 将 Cron 表达式拆分为 7 个字段
 * 支持 5/6/7 字段格式，缺失字段用 `*` 填充
 * @param expression Cron 表达式
 * @returns 7 字段对象
 */
export function getFieldsFromExpression(expression: string): CronFields7 {
  const parts = expression.trim().split(/\s+/);

  if (parts.length === 5) {
    return {
      minute: parts[0] ?? '*',
      hour: parts[1] ?? '*',
      day: parts[2] ?? '*',
      month: parts[3] ?? '*',
      dayOfWeek: parts[4] ?? '*',
      second: '*',
      year: '*',
    };
  }

  if (parts.length === 6) {
    // 6 字段优先解析为 秒+5字段（构建器产出的主要格式）
    return {
      second: parts[0] ?? '*',
      minute: parts[1] ?? '*',
      hour: parts[2] ?? '*',
      day: parts[3] ?? '*',
      month: parts[4] ?? '*',
      dayOfWeek: parts[5] ?? '*',
      year: '*',
    };
  }

  if (parts.length === 7) {
    return {
      second: parts[0] ?? '*',
      minute: parts[1] ?? '*',
      hour: parts[2] ?? '*',
      day: parts[3] ?? '*',
      month: parts[4] ?? '*',
      dayOfWeek: parts[5] ?? '*',
      year: parts[6] ?? '*',
    };
  }

  return {
    second: '*',
    minute: '*',
    hour: '*',
    day: '*',
    month: '*',
    dayOfWeek: '*',
    year: '*',
  };
}

// =============================================================================
// 表达式解析（执行时间计算）
// =============================================================================

/**
 * 解析 Cron 表达式，返回接下来 N 次执行时间
 * 支持 5/6/7 字段格式
 * @param expression Cron 表达式（5/6/7 字段）
 * @param count 返回的执行时间数量，默认 5
 * @throws 表达式格式错误时抛出中文描述错误
 */
export function parseCronExpression(expression: string, count: number = 5): CronParseResult {
  const trimmed = expression.trim();

  if (!trimmed) {
    throw new Error('请输入 Cron 表达式');
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length < 5 || parts.length > 7) {
    throw new Error(`Cron 表达式应有 5~7 个字段，当前为 ${parts.length} 个`);
  }

  let parseExpr = trimmed;
  let hasSeconds = false;

  if (parts.length === 7) {
    // 7 字段：去掉年字段，用前 6 字段解析
    parseExpr = parts.slice(0, 6).join(' ');
    hasSeconds = true;
  } else if (parts.length === 6) {
    hasSeconds = true;
  }

  try {
    const interval = CronExpressionParser.parse(parseExpr, {
      currentDate: new Date(),
      ...(hasSeconds ? { hasSeconds: true } : {}),
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
    // 6 字段解析失败时，尝试作为 5 字段 + 年 解析
    if (parts.length === 6) {
      try {
        const interval = CronExpressionParser.parse(parts.slice(0, 5).join(' '), {
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
          fields: {
            second: '*',
            minute: parts[0] ?? '*',
            hour: parts[1] ?? '*',
            day: parts[2] ?? '*',
            month: parts[3] ?? '*',
            dayOfWeek: parts[4] ?? '*',
            year: parts[5] ?? '*',
          },
        };
      } catch {
        // 继续抛出原错误
      }
    }

    const msg = e instanceof Error ? e.message : '表达式无效';
    if (msg.includes('invalid cron expression')) {
      throw new Error('无效的 Cron 表达式，请检查字段值');
    }
    throw new Error(`表达式解析失败：${msg}`);
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 格式化日期为本地时间字符串
 * @param date 日期对象
 * @returns 格式化后的字符串，如 `2024-01-15 09:30:00`
 */
export function formatExecutionTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 根据字段 key 获取该字段的模式选项标签
 * 用于 UI 中根据字段类型显示不同的模式名称
 * @param fieldKey 字段 key
 * @param mode 模式值
 * @returns 模式标签
 */
export function getModeLabel(fieldKey: keyof CronFields7, mode: FieldMode): string {
  // every 模式按字段返回
  if (mode === 'every') {
    const everyLabels: Partial<Record<keyof CronFields7, string>> = {
      second: '每秒',
      minute: '每分',
      hour: '每时',
      day: '每日',
      month: '每月',
      dayOfWeek: '每周',
      year: '每年',
    };
    return everyLabels[fieldKey] ?? '任意';
  }

  const labels: Record<FieldMode, string> = {
    every: '每秒',
    range: '周期',
    step: '从X每Y',
    specific: '指定值',
    lastDay: '最后一天',
    lastNDay: '倒数第N天',
    nearWeekday: '最近工作日',
    lastWeekday: '最后工作日',
    lastN: '最后周X',
    nthDay: '第N个周X',
  };
  return labels[mode] ?? mode;
}
