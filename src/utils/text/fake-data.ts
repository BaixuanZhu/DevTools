/**
 * 假数据生成器核心模块。
 *
 * 定义字段类型、字段配置与字段元数据，提供基于 crypto 的统一随机源，
 * 供后续任务的字段生成器、记录组装与序列化使用。
 */

/** 字段类型 key */
export type FieldType =
  | 'auto-id' | 'uuid' | 'name' | 'username' | 'email' | 'phone' | 'password'
  | 'lorem-word' | 'lorem-sentence' | 'lorem-paragraph'
  | 'date' | 'timestamp' | 'integer' | 'decimal' | 'boolean' | 'ip' | 'url';

/** 单个字段配置（字段配置区一行） */
export interface FieldConfig {
  /** 行内唯一标识（Vue 列表 key，非列名） */
  rowId: string;
  /** 列名（JSON key / CSV 表头） */
  name: string;
  /** 字段类型 */
  type: FieldType;
  /** 类型参数（结构随 type 变化，宽松存储） */
  params: Record<string, string | number>;
}

/** 字段参数控件定义 */
export interface FieldParamDef {
  /** 参数 key（对应 FieldConfig.params 的键） */
  key: string;
  /** 控件标签 */
  label: string;
  /** 控件类型 */
  type: 'number' | 'text' | 'select';
  /** 默认值 */
  default: string | number;
  /** select 类型的可选项 */
  options?: { value: string; label: string }[];
}

/** 字段类型元数据（下拉选项 + 默认列名 + 参数控件） */
export interface FieldTypeMeta {
  /** 类型 key */
  value: FieldType;
  /** 下拉显示名 */
  label: string;
  /** 默认列名 */
  defaultName: string;
  /** 参数控件定义 */
  params: FieldParamDef[];
}

/** 全部字段类型元数据，顺序即下拉顺序 */
export const FIELD_TYPE_OPTIONS: FieldTypeMeta[] = [
  { value: 'auto-id', label: '自增ID', defaultName: 'id', params: [{ key: 'start', label: '起始值', type: 'number', default: 1 }] },
  { value: 'uuid', label: 'UUID', defaultName: 'uuid', params: [] },
  { value: 'name', label: '姓名', defaultName: 'name', params: [{ key: 'locale', label: '语种', type: 'select', default: 'zh', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: '英文' }] }] },
  { value: 'username', label: '用户名', defaultName: 'username', params: [] },
  { value: 'email', label: '邮箱', defaultName: 'email', params: [{ key: 'domain', label: '域名', type: 'text', default: '@example.com' }] },
  { value: 'phone', label: '手机号', defaultName: 'phone', params: [] },
  { value: 'password', label: '密码', defaultName: 'password', params: [{ key: 'length', label: '长度', type: 'number', default: 12 }] },
  { value: 'lorem-word', label: 'Lorem 词', defaultName: 'text', params: [{ key: 'count', label: '词数', type: 'number', default: 3 }] },
  { value: 'lorem-sentence', label: 'Lorem 句', defaultName: 'title', params: [{ key: 'count', label: '句数', type: 'number', default: 1 }] },
  { value: 'lorem-paragraph', label: 'Lorem 段', defaultName: 'content', params: [{ key: 'count', label: '段数', type: 'number', default: 1 }] },
  { value: 'date', label: '日期', defaultName: 'date', params: [{ key: 'years', label: '近 N 年', type: 'number', default: 10 }] },
  { value: 'timestamp', label: '时间戳', defaultName: 'timestamp', params: [{ key: 'years', label: '近 N 年', type: 'number', default: 10 }] },
  { value: 'integer', label: '整数', defaultName: 'value', params: [{ key: 'min', label: '最小', type: 'number', default: 0 }, { key: 'max', label: '最大', type: 'number', default: 100 }] },
  { value: 'decimal', label: '小数', defaultName: 'value', params: [{ key: 'min', label: '最小', type: 'number', default: 0 }, { key: 'max', label: '最大', type: 'number', default: 100 }, { key: 'precision', label: '小数位', type: 'number', default: 2 }] },
  { value: 'boolean', label: '布尔', defaultName: 'active', params: [] },
  { value: 'ip', label: 'IPv4', defaultName: 'ip', params: [] },
  { value: 'url', label: 'URL', defaultName: 'url', params: [] },
];

/** 快速模板预设 */
export const QUICK_PRESETS: { label: string; fields: Omit<FieldConfig, 'rowId'>[] }[] = [
  {
    label: '用户表',
    fields: [
      { name: 'id', type: 'auto-id', params: { start: 1 } },
      { name: 'name', type: 'name', params: { locale: 'zh' } },
      { name: 'email', type: 'email', params: { domain: '@example.com' } },
      { name: 'phone', type: 'phone', params: {} },
    ],
  },
  {
    label: '文章',
    fields: [
      { name: 'id', type: 'auto-id', params: { start: 1 } },
      { name: 'title', type: 'lorem-sentence', params: { count: 1 } },
      { name: 'author', type: 'name', params: { locale: 'zh' } },
      { name: 'content', type: 'lorem-paragraph', params: { count: 1 } },
      { name: 'date', type: 'date', params: { years: 3 } },
    ],
  },
  {
    label: '订单',
    fields: [
      { name: 'id', type: 'auto-id', params: { start: 1 } },
      { name: 'user', type: 'name', params: { locale: 'zh' } },
      { name: 'amount', type: 'decimal', params: { min: 0, max: 9999.99, precision: 2 } },
      { name: 'created_at', type: 'timestamp', params: { years: 1 } },
      { name: 'paid', type: 'boolean', params: {} },
    ],
  },
  {
    label: '商品',
    fields: [
      { name: 'id', type: 'auto-id', params: { start: 1 } },
      { name: 'name', type: 'lorem-word', params: { count: 2 } },
      { name: 'price', type: 'decimal', params: { min: 0, max: 9999.99, precision: 2 } },
      { name: 'stock', type: 'integer', params: { min: 0, max: 9999 } },
      { name: 'url', type: 'url', params: {} },
    ],
  },
];

/**
 * 生成闭区间 [min, max] 内的随机整数（基于 crypto）。
 * @param min - 下界
 * @param max - 上界
 * @returns 闭区间内的随机整数
 */
export function randomInt(min: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  const range = max - min + 1;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return min + (arr[0] % range);
}

/**
 * 从数组中随机取一个元素。
 * @param arr - 非空数组
 * @returns 随机元素
 */
export function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

/**
 * Fisher-Yates 洗牌，返回新数组，不改原数组。
 * @param arr - 待洗牌数组
 * @returns 洗牌后的新数组
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

import { generateRandomString } from './random-string';
import { CN_SURNAMES, CN_GIVEN, EN_FIRST, EN_LAST, LOREM_WORDS } from './fake-data-dict';

/** 生成 v4 UUID 字符串。 */
export function genUuid(): string {
  return crypto.randomUUID();
}

/** 生成 6–12 位小写字母用户名，半数概率追加数字后缀。 */
export function genUsername(): string {
  const base = generateRandomString(randomInt(6, 10), 'abcdefghijklmnopqrstuvwxyz');
  return randomInt(0, 1) === 1 ? `${base}${randomInt(0, 999)}` : base;
}

/** 手机号合法第二位号段。 */
const PHONE_SECOND_DIGITS = ['3', '4', '5', '7', '8', '9'];

/** 生成 11 位手机号：1 + 合法号段 + 9 位数字。 */
export function genPhone(): string {
  const second = pick(PHONE_SECOND_DIGITS);
  const rest = generateRandomString(9, '0123456789');
  return `1${second}${rest}`;
}

/** 生成 IPv4 地址。 */
export function genIp(): string {
  return Array.from({ length: 4 }, () => String(randomInt(0, 255))).join('.');
}

/** 生成布尔字符串 "true" / "false"。 */
export function genBoolean(): string {
  return randomInt(0, 1) === 1 ? 'true' : 'false';
}

/** 整数生成参数。 */
export interface IntegerParams { min?: number; max?: number; }
/** 小数生成参数。 */
export interface DecimalParams { min?: number; max?: number; precision?: number; }
/** 自增 ID 生成参数。 */
export interface AutoIdParams { start?: number; }

/**
 * 生成闭区间随机整数字符串。
 * @param params - min/max，缺省 0/100
 */
export function genInteger(params: IntegerParams): string {
  return String(randomInt(params.min ?? 0, params.max ?? 100));
}

/**
 * 生成指定小数位的随机小数字符串（缩放法避免 modulo bias）。
 * @param params - min/max/precision，precision 缺省 2，上限 10
 */
export function genDecimal(params: DecimalParams): string {
  const lo = Math.min(params.min ?? 0, params.max ?? 100);
  const hi = Math.max(params.min ?? 0, params.max ?? 100);
  const precision = Math.max(0, Math.min(params.precision ?? 2, 10));
  const scale = 10 ** precision;
  const loScaled = Math.ceil(lo * scale);
  const hiScaled = Math.floor(hi * scale);
  const value = randomInt(Math.min(loScaled, hiScaled), Math.max(loScaled, hiScaled)) / scale;
  return value.toFixed(precision);
}

/**
 * 生成自增 ID 字符串：start + rowIndex。
 * @param params - start 起始值，缺省 1
 * @param rowIndex - 当前行索引（从 0 起）
 */
export function genAutoId(params: AutoIdParams, rowIndex: number): string {
  return String((params.start ?? 1) + rowIndex);
}

/** 姓名生成参数。 */
export interface NameParams { locale?: 'zh' | 'en'; }
/** 邮箱生成参数。 */
export interface EmailParams { domain?: string; }
/** 密码生成参数。 */
export interface PasswordParams { length?: number; }
/** Lorem 生成参数。 */
export interface LoremParams { count?: number; }

/**
 * 生成姓名。
 * @param params - locale 缺省 'zh'；中文为「姓 + 1~2 个名用字」，英文为「first + ' ' + last」
 */
export function genName(params: NameParams): string {
  if (params.locale === 'en') {
    return `${pick(EN_FIRST)} ${pick(EN_LAST)}`;
  }
  const surname = pick(CN_SURNAMES);
  const givenLen = randomInt(1, 2);
  const given = Array.from({ length: givenLen }, () => pick(CN_GIVEN)).join('');
  return surname + given;
}

/**
 * 生成邮箱：随机小写用户名 + 域名。
 * @param params - domain 缺省 '@example.com'
 */
export function genEmail(params: EmailParams): string {
  const user = generateRandomString(randomInt(6, 10), 'abcdefghijklmnopqrstuvwxyz');
  return `${user}${params.domain ?? '@example.com'}`;
}

/**
 * 生成密码：保证含大写、小写、数字三类，长度不足时补齐随机字符。
 * @param params - length 缺省 12，钳制到 [4, 128]
 */
export function genPassword(params: PasswordParams): string {
  const len = Math.max(4, Math.min(params.length ?? 12, 128));
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const DIGIT = '0123456789';
  const SYM = '!@#$%^&*';
  const chars = [pick([...UPPER]), pick([...LOWER]), pick([...DIGIT])];
  const all = UPPER + LOWER + DIGIT + SYM;
  while (chars.length < len) chars.push(generateRandomString(1, all));
  return shuffle(chars).join('');
}

/**
 * 生成 Lorem 词组。
 * @param params - count 词数，缺省 3
 */
export function genLoremWord(params: LoremParams): string {
  const count = Math.max(1, params.count ?? 3);
  return Array.from({ length: count }, () => pick(LOREM_WORDS)).join(' ');
}

/**
 * 生成 Lorem 句子：每句 4–12 词，首字母大写、句末加句点。
 * @param params - count 句数，缺省 1
 */
export function genLoremSentence(params: LoremParams): string {
  const count = Math.max(1, params.count ?? 1);
  const sentences = Array.from({ length: count }, () => {
    const wlen = randomInt(4, 12);
    const words = Array.from({ length: wlen }, () => pick(LOREM_WORDS));
    const s = words.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  });
  return sentences.join(' ');
}

/**
 * 生成 Lorem 段落：每段 3–6 句，段间换行。
 * @param params - count 段数，缺省 1
 */
export function genLoremParagraph(params: LoremParams): string {
  const count = Math.max(1, params.count ?? 1);
  const paras = Array.from({ length: count }, () => {
    const slen = randomInt(3, 6);
    return genLoremSentence({ count: slen });
  });
  return paras.join('\n');
}

/** 生成随机 URL：https://www.<词>.com/<路径>。 */
export function genUrl(): string {
  const domain = pick(LOREM_WORDS);
  const pathLen = randomInt(1, 3);
  const path = Array.from({ length: pathLen }, () => pick(LOREM_WORDS)).join('/');
  return `https://www.${domain}.com/${path}`;
}

/** 日期 / 时间戳生成参数。 */
export interface DateParams { years?: number; }

/**
 * 生成日期字符串（YYYY-MM-DD），落在 [now - N 年, now] 区间。
 * @param params - years 缺省 10
 * @param now - 基准时间戳（毫秒），传入以保证可测
 */
export function genDate(params: DateParams, now: number): string {
  const years = Math.max(1, params.years ?? 10);
  const past = now - years * 365 * 86400000;
  const t = randomInt(past, now);
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 生成 Unix 时间戳（秒），落在 [now - N 年, now] 区间。
 * @param params - years 缺省 10
 * @param now - 基准时间戳（毫秒）
 */
export function genTimestamp(params: DateParams, now: number): string {
  const years = Math.max(1, params.years ?? 10);
  const past = now - years * 365 * 86400000;
  const t = randomInt(past, now);
  return String(Math.floor(t / 1000));
}

/**
 * 根据字段类型分发，生成单个字段值。
 * @param field - 字段配置
 * @param rowIndex - 当前行索引
 * @param now - 基准时间戳（毫秒）
 */
function generateFieldValue(field: FieldConfig, rowIndex: number, now: number): unknown {
  const p = field.params;
  switch (field.type) {
    case 'uuid': return genUuid();
    case 'username': return genUsername();
    case 'phone': return genPhone();
    case 'ip': return genIp();
    case 'boolean': return genBoolean();
    case 'url': return genUrl();
    case 'integer': return genInteger({ min: Number(p.min ?? 0), max: Number(p.max ?? 100) });
    case 'decimal': return genDecimal({ min: Number(p.min ?? 0), max: Number(p.max ?? 100), precision: Number(p.precision ?? 2) });
    case 'auto-id': return genAutoId({ start: Number(p.start ?? 1) }, rowIndex);
    case 'name': return genName({ locale: (p.locale as 'zh' | 'en') ?? 'zh' });
    case 'email': return genEmail({ domain: String(p.domain ?? '@example.com') });
    case 'password': return genPassword({ length: Number(p.length ?? 12) });
    case 'lorem-word': return genLoremWord({ count: Number(p.count ?? 3) });
    case 'lorem-sentence': return genLoremSentence({ count: Number(p.count ?? 1) });
    case 'lorem-paragraph': return genLoremParagraph({ count: Number(p.count ?? 1) });
    case 'date': return genDate({ years: Number(p.years ?? 10) }, now);
    case 'timestamp': return genTimestamp({ years: Number(p.years ?? 10) }, now);
  }
}

/**
 * 按字段配置生成 count 条记录。
 * @param fields - 字段配置（顺序即列顺序）
 * @param count - 记录条数
 * @param now - 基准时间戳（毫秒），缺省 Date.now()
 * @returns 记录数组，每条为「列名 → 值」对象
 */
export function generateRecords(fields: FieldConfig[], count: number, now: number = Date.now()): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const rec: Record<string, unknown> = {};
    for (const f of fields) {
      rec[f.name] = generateFieldValue(f, i, now);
    }
    records.push(rec);
  }
  return records;
}

/** 字段校验结果。 */
export interface ValidationResult {
  /** 是否通过 */
  valid: boolean;
  /** 失败时的中文错误信息 */
  error: string;
}

/** 合法列名：字母/下划线/中文开头，后接字母/数字/下划线/中文。 */
const COLUMN_NAME_RE = /^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*$/;

/**
 * 校验字段配置：非空、列名非空、列名合法、列名不重复。
 * @param fields - 字段配置列表
 * @returns 校验结果
 */
export function validateFields(fields: FieldConfig[]): ValidationResult {
  if (!fields.length) return { valid: false, error: '请至少添加一个字段' };
  const seen = new Set<string>();
  for (const f of fields) {
    const name = f.name.trim();
    if (!name) return { valid: false, error: '存在未填写列名的字段' };
    if (!COLUMN_NAME_RE.test(name)) {
      return { valid: false, error: `列名「${name}」不合法：只能包含字母、数字、下划线或中文，且不能以数字开头` };
    }
    if (seen.has(name)) return { valid: false, error: `列名「${name}」重复，请修改` };
    seen.add(name);
  }
  return { valid: true, error: '' };
}

/**
 * 将记录序列化为 JSON 数组字符串（2 空格缩进）。
 * @param records - 记录数组
 */
export function toJson(records: Record<string, unknown>[]): string {
  return JSON.stringify(records, null, 2);
}

/**
 * 按 RFC4180 将记录序列化为 CSV：首行列名 + 数据行，行尾 CRLF；
 * 含逗号、双引号或换行的值用双引号包裹，内部引号双写。
 * @param records - 记录数组
 * @param fields - 字段配置（决定列名与列顺序）
 */
export function toCsv(records: Record<string, unknown>[], fields: FieldConfig[]): string {
  const headers = fields.map((f) => f.name);
  const escape = (value: unknown): string => {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const rec of records) {
    lines.push(headers.map((h) => escape(rec[h])).join(','));
  }
  return lines.join('\r\n');
}
