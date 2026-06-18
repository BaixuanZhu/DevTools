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
