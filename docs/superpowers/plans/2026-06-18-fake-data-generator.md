# 假数据生成器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个结构化假数据生成工具 `/text/fake-data-generator`，按字段配置批量生成姓名/邮箱/手机号/UUID/Lorem 等 15 类字段，输出 JSON 数组或 CSV。

**Architecture:** 纯函数核心模块（`fake-data.ts` 逻辑 + `fake-data-dict.ts` 词库）+ Vue 组件（字段配置 UI + 结果区）+ 极简 Astro 页面。随机源统一基于 `crypto.getRandomValues`，复用现有 `generateRandomString`。TDD：核心逻辑先写测试再实现。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">`、TypeScript strict、Tailwind v4 token、@headlessui/vue（SelectListbox）、vitest。

## Global Constraints

- 路由 `/text/fake-data-generator`，工具 id 必须等于 path 末段 `fake-data-generator`
- 相对路径导入，无 `@/` 别名（如 `../../utils/text/fake-data`、`./random-string`、`./fake-data-dict`）
- 随机源统一 `crypto.getRandomValues`，禁用 `Math.random`
- 禁用 `eval`/`Function`；CSV 输出做 RFC4180 转义；JSON 用 `JSON.stringify`
- 复用 `generateRandomString`（`src/utils/text/random-string.ts`），不重复造随机串逻辑
- 批量上限 500 条（与 uuid-generator / random-string 一致）
- 公共类/函数/类型必须有 TSDoc 注释（JSDoc 风格，中文）
- 测试放在 `src/utils/text/__tests__/`，用 vitest，相对路径 `from '../fake-data'`
- 组件用现有 UI：`ToolHeader`、`SelectListbox`、`OptionRadioGroup`、`CopyButton`、`useCopy`
- 页面 `.astro` 用 `<ToolLayout toolId="text/fake-data-generator">` + `client:idle`

---

## File Structure

| 文件 | 职责 |
|------|------|
| Create: `src/utils/text/fake-data-dict.ts` | 静态词库常量（中文姓/名用字、英文 first/last、Lorem 词库、手机号段） |
| Create: `src/utils/text/fake-data.ts` | 类型定义 + 字段元数据 + 随机源 + 字段生成器 + 记录组装 + 序列化 + 校验 |
| Create: `src/utils/text/__tests__/fake-data.test.ts` | 核心逻辑单元测试 |
| Create: `src/tools/text/FakeDataGenerator.vue` | 交互组件（字段配置 + 快速模板 + 结果区） |
| Create: `src/pages/text/fake-data-generator.astro` | 页面壳 |
| Modify: `src/data/tools.ts` | 注册工具 |
| Modify: `src/data/tool-faqs.ts` | 4 条 FAQ |
| Modify: `docs/ROADMAP.md` | 勾选 P2 假数据生成器 |

---

## Task 1: 模块骨架 + 随机源 + 字段元数据

**Files:**
- Create: `src/utils/text/fake-data.ts`
- Test: `src/utils/text/__tests__/fake-data.test.ts`

**Interfaces:**
- Produces: `FieldType`、`FieldConfig`、`FieldTypeMeta`、`FieldParamDef`、`FIELD_TYPE_OPTIONS`、`QUICK_PRESETS`、`randomInt`、`pick`、`shuffle`（后续任务依赖）

- [ ] **Step 1: 写失败测试（随机源）**

```ts
// src/utils/text/__tests__/fake-data.test.ts
import { describe, it, expect } from 'vitest';
import { randomInt, pick, shuffle } from '../fake-data';

describe('randomInt', () => {
  it('returns value within [min, max]', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('swaps when min > max', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(7, 3);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('returns min when min === max', () => {
    expect(randomInt(5, 5)).toBe(5);
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(pick(arr));
    }
  });

  it('can return every element over many draws', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(pick(arr));
    expect(seen.size).toBe(4);
  });
});

describe('shuffle', () => {
  it('preserves elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input', () => {
    const arr = [1, 2, 3];
    const snapshot = [...arr];
    shuffle(arr);
    expect(arr).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: FAIL（`fake-data` 无导出 / 模块不存在）

- [ ] **Step 3: 实现 `fake-data.ts`（类型 + 元数据 + 随机源）**

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: PASS（randomInt / pick / shuffle 全绿）

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/fake-data.ts src/utils/text/__tests__/fake-data.test.ts
git commit -m "feat(fake-data): 类型定义、字段元数据与随机源"
```

---

## Task 2: 无词库依赖的值生成器

**Files:**
- Modify: `src/utils/text/fake-data.ts`（追加生成器）
- Test: `src/utils/text/__tests__/fake-data.test.ts`（追加测试）

**Interfaces:**
- Consumes: `randomInt`、`pick`、`shuffle`（Task 1）、`generateRandomString`（`./random-string`）
- Produces: `genUuid`、`genUsername`、`genPhone`、`genIp`、`genBoolean`、`genInteger`、`genDecimal`、`genAutoId`

- [ ] **Step 1: 追加失败测试**

在 `fake-data.test.ts` 顶部 import 增补，并追加 describe：

```ts
import {
  randomInt, pick, shuffle,
  genUuid, genUsername, genPhone, genIp, genBoolean,
  genInteger, genDecimal, genAutoId,
} from '../fake-data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('genUuid', () => {
  it('matches v4 format', () => {
    for (let i = 0; i < 50; i++) expect(UUID_RE.test(genUuid())).toBe(true);
  });
});

describe('genUsername', () => {
  it('is lowercase alphanumeric within length range', () => {
    for (let i = 0; i < 100; i++) {
      const u = genUsername();
      expect(u).toMatch(/^[a-z]+[0-9]*$/);
      expect(u.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('genPhone', () => {
  it('is 11 digits starting with 1 and valid second digit', () => {
    const validSecond = ['3', '4', '5', '7', '8', '9'];
    for (let i = 0; i < 100; i++) {
      const p = genPhone();
      expect(p).toMatch(/^1\d{10}$/);
      expect(validSecond).toContain(p[1]);
    }
  });
});

describe('genIp', () => {
  it('has four octets in 0-255', () => {
    for (let i = 0; i < 100; i++) {
      const parts = genIp().split('.').map(Number);
      expect(parts).toHaveLength(4);
      parts.forEach((n) => expect(n).toBeGreaterThanOrEqual(0) && expect(n).toBeLessThanOrEqual(255));
    }
  });
});

describe('genBoolean', () => {
  it('returns true or false', () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) set.add(genBoolean());
    expect(set).toEqual(new Set(['true', 'false']));
  });
});

describe('genInteger', () => {
  it('stays within range', () => {
    for (let i = 0; i < 200; i++) {
      const n = Number(genInteger({ min: -5, max: 5 }));
      expect(n).toBeGreaterThanOrEqual(-5);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('swaps when min > max', () => {
    const n = Number(genInteger({ min: 10, max: 1 }));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(10);
  });
});

describe('genDecimal', () => {
  it('respects precision and range', () => {
    for (let i = 0; i < 200; i++) {
      const s = genDecimal({ min: 0, max: 10, precision: 2 });
      const n = Number(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(10);
      expect(s.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    }
  });
});

describe('genAutoId', () => {
  it('increments by rowIndex from start', () => {
    expect(genAutoId({ start: 1 }, 0)).toBe('1');
    expect(genAutoId({ start: 1 }, 4)).toBe('5');
    expect(genAutoId({ start: 100 }, 0)).toBe('100');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: FAIL（生成器未导出）

- [ ] **Step 3: 追加实现**

在 `fake-data.ts` 末尾追加：

```ts
import { generateRandomString } from './random-string';

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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/fake-data.ts src/utils/text/__tests__/fake-data.test.ts
git commit -m "feat(fake-data): 无词库依赖的值生成器"
```

---

## Task 3: 词库 + 词库依赖生成器

**Files:**
- Create: `src/utils/text/fake-data-dict.ts`
- Modify: `src/utils/text/fake-data.ts`（追加生成器 + import 词库）
- Test: `src/utils/text/__tests__/fake-data.test.ts`（追加测试）

**Interfaces:**
- Consumes: `randomInt`、`pick`、`shuffle`、`generateRandomString`、`CN_SURNAMES`、`CN_GIVEN`、`EN_FIRST`、`EN_LAST`、`LOREM_WORDS`（dict）
- Produces: `genName`、`genEmail`、`genPassword`、`genLoremWord`、`genLoremSentence`、`genLoremParagraph`、`genUrl`

- [ ] **Step 1: 创建词库文件**

```ts
/**
 * 假数据生成器内置词库。
 *
 * 提供中文姓氏、中文名用字、英文 first/last 名、Lorem ipsum 经典词库，
 * 均为静态数据，供字段生成器随机取用。
 */

/** 中文常见姓氏（约 60 个） */
export const CN_SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎',
  '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
];

/** 中文常见名用字（约 60 个） */
export const CN_GIVEN = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀', '霞', '平',
  '刚', '桂', '英', '华', '斌', '颖', '鹏', '宇', '婷', '凯',
  '健', '俊', '红', '梅', '琳', '鑫', '波', '辉', '燕', '宁',
  '龙', '婷', '雪', '欣', '怡', '佳', '浩', '然', '梓', '涵',
  '子', '睿', '晨', '诺', '思', '博', '雅', '诗', '雨', '阳',
];

/** 英文常见 first name（约 40 个） */
export const EN_FIRST = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael',
  'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan',
  'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher',
  'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Helen',
  'Mark', 'Sandra', 'Donald', 'Donna', 'Steven', 'Carol', 'Paul', 'Ruth',
  'Andrew', 'Sharon', 'Joshua', 'Michelle',
];

/** 英文常见 last name（约 40 个） */
export const EN_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
];

/** Lorem ipsum 经典词库（约 40 个） */
export const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
  'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
  'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam',
  'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip',
  'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in',
  'reprehenderit', 'voluptate',
];
```

- [ ] **Step 2: 追加失败测试**

在 `fake-data.test.ts` import 增补：

```ts
import {
  genName, genEmail, genPassword, genLoremWord, genLoremSentence,
  genLoremParagraph, genUrl,
} from '../fake-data';
```

追加 describe：

```ts
describe('genName', () => {
  it('chinese name contains a surname and given chars', () => {
    const CN_SURNAMES_PLACEHOLDER = '王李张'; // 仅断言含中文
    for (let i = 0; i < 100; i++) {
      const n = genName({ locale: 'zh' });
      expect(/[一-龥]{2,4}/.test(n)).toBe(true);
      expect(n.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('english name has two parts separated by space', () => {
    for (let i = 0; i < 100; i++) {
      const n = genName({ locale: 'en' });
      expect(n.split(' ')).toHaveLength(2);
      expect(/^[A-Z][a-z]+$/.test(n.split(' ')[0])).toBe(true);
    }
  });
});

describe('genEmail', () => {
  it('contains @ and given domain', () => {
    const e = genEmail({ domain: '@test.com' });
    expect(e.endsWith('@test.com')).toBe(true);
    expect(e.indexOf('@')).toBeGreaterThan(0);
  });
});

describe('genPassword', () => {
  it('has requested length and covers upper/lower/digit', () => {
    for (let i = 0; i < 100; i++) {
      const p = genPassword({ length: 12 });
      expect(p).toHaveLength(12);
      expect(/[A-Z]/.test(p)).toBe(true);
      expect(/[a-z]/.test(p)).toBe(true);
      expect(/[0-9]/.test(p)).toBe(true);
    }
  });

  it('clamps length to minimum 4', () => {
    const p = genPassword({ length: 2 });
    expect(p).toHaveLength(4);
  });
});

describe('genLoremWord', () => {
  it('returns the requested number of words', () => {
    const s = genLoremWord({ count: 5 });
    expect(s.split(' ')).toHaveLength(5);
  });
});

describe('genLoremSentence', () => {
  it('ends with a period and starts uppercase', () => {
    const s = genLoremSentence({ count: 1 });
    expect(s.endsWith('.')).toBe(true);
    expect(/^[A-Z]/.test(s)).toBe(true);
  });

  it('joins multiple sentences', () => {
    const s = genLoremSentence({ count: 3 });
    expect(s.split('.').filter(Boolean)).toHaveLength(3);
  });
});

describe('genLoremParagraph', () => {
  it('returns the requested number of paragraphs', () => {
    const s = genLoremParagraph({ count: 2 });
    expect(s.split('\n')).toHaveLength(2);
  });
});

describe('genUrl', () => {
  it('starts with https://', () => {
    for (let i = 0; i < 50; i++) {
      expect(genUrl().startsWith('https://')).toBe(true);
    }
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: FAIL（生成器未导出）

- [ ] **Step 4: 追加实现**

在 `fake-data.ts` 顶部 import 区追加词库 import（与 `generateRandomString` 同处）：

```ts
import { generateRandomString } from './random-string';
import { CN_SURNAMES, CN_GIVEN, EN_FIRST, EN_LAST, LOREM_WORDS } from './fake-data-dict';
```

在文件末尾追加：

```ts
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
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT)];
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
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/utils/text/fake-data-dict.ts src/utils/text/fake-data.ts src/utils/text/__tests__/fake-data.test.ts
git commit -m "feat(fake-data): 词库与词库依赖生成器"
```

---

## Task 4: 日期时间生成器 + 记录组装

**Files:**
- Modify: `src/utils/text/fake-data.ts`
- Test: `src/utils/text/__tests__/fake-data.test.ts`

**Interfaces:**
- Consumes: 全部 `genX`、`FieldConfig`
- Produces: `genDate`、`genTimestamp`、`generateRecords`（被 Task 5 序列化、Task 6 组件调用）

- [ ] **Step 1: 追加失败测试**

在 `fake-data.test.ts` import 增补：

```ts
import { genDate, genTimestamp, generateRecords } from '../fake-data';
import type { FieldConfig } from '../fake-data';
```

追加 describe：

```ts
describe('genDate', () => {
  const NOW = Date.UTC(2026, 0, 1); // 2026-01-01 固定基准
  it('matches YYYY-MM-DD format', () => {
    for (let i = 0; i < 100; i++) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(genDate({ years: 10 }, NOW))).toBe(true);
    }
  });

  it('falls within the past N years', () => {
    for (let i = 0; i < 100; i++) {
      const t = Date.parse(genDate({ years: 5 }, NOW));
      expect(t).toBeLessThanOrEqual(NOW);
      expect(t).toBeGreaterThan(NOW - 5 * 366 * 86400000);
    }
  });
});

describe('genTimestamp', () => {
  const NOW = Date.UTC(2026, 0, 1);
  it('is a positive integer in seconds', () => {
    for (let i = 0; i < 100; i++) {
      const s = Number(genTimestamp({ years: 1 }, NOW));
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(Math.floor(NOW / 1000));
    }
  });
});

describe('generateRecords', () => {
  const NOW = Date.UTC(2026, 0, 1);
  const fields: FieldConfig[] = [
    { rowId: 'r1', name: 'id', type: 'auto-id', params: { start: 1 } },
    { rowId: 'r2', name: 'name', type: 'name', params: { locale: 'zh' } },
  ];

  it('produces the requested number of records', () => {
    expect(generateRecords(fields, 5, NOW)).toHaveLength(5);
  });

  it('uses field names as keys in order', () => {
    const recs = generateRecords(fields, 1, NOW);
    expect(Object.keys(recs[0])).toEqual(['id', 'name']);
  });

  it('increments auto-id across rows', () => {
    const recs = generateRecords(fields, 3, NOW);
    expect(recs.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('returns empty array for count 0', () => {
    expect(generateRecords(fields, 0, NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: FAIL（genDate / genTimestamp / generateRecords 未导出）

- [ ] **Step 3: 追加实现**

在 `fake-data.ts` 末尾追加：

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/fake-data.ts src/utils/text/__tests__/fake-data.test.ts
git commit -m "feat(fake-data): 日期时间生成器与记录组装"
```

---

## Task 5: 序列化 + 字段校验

**Files:**
- Modify: `src/utils/text/fake-data.ts`
- Test: `src/utils/text/__tests__/fake-data.test.ts`

**Interfaces:**
- Consumes: `FieldConfig`、`generateRecords` 产出的记录
- Produces: `toJson`、`toCsv`、`validateFields`（被 Task 6 组件调用）

- [ ] **Step 1: 追加失败测试**

在 `fake-data.test.ts` import 增补：

```ts
import { toJson, toCsv, validateFields } from '../fake-data';

const FIELDS: FieldConfig[] = [
  { rowId: 'r1', name: 'id', type: 'auto-id', params: { start: 1 } },
  { rowId: 'r2', name: 'name', type: 'name', params: { locale: 'zh' } },
];
const RECS = [{ id: '1', name: '张三, Jr.' }, { id: '2', name: '李"四' }];
```

追加 describe：

```ts
describe('toJson', () => {
  it('serializes to a parseable JSON array', () => {
    const out = toJson(RECS);
    expect(JSON.parse(out)).toEqual(RECS);
    expect(out.startsWith('[')).toBe(true);
  });

  it('pretty-prints with 2-space indent', () => {
    expect(toJson([{ a: 1 }])).toContain('\n  "a"');
  });
});

describe('toCsv', () => {
  it('emits header row then data rows with CRLF', () => {
    const csv = toCsv(RECS, FIELDS);
    expect(csv.startsWith('id,name\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3); // header + 2 rows
  });

  it('quotes values containing comma, quote, or newline (RFC4180)', () => {
    const csv = toCsv(RECS, FIELDS);
    // 张三, Jr. → 含逗号需加引号
    expect(csv).toContain('"张三, Jr."');
    // 李"四 → 含引号，整体加引号包裹、内部引号双写
    expect(csv).toContain('"李""四"');
  });
});

describe('validateFields', () => {
  it('rejects empty field list', () => {
    expect(validateFields([]).valid).toBe(false);
  });

  it('rejects empty column name', () => {
    const r = validateFields([{ rowId: 'r1', name: ' ', type: 'uuid', params: {} }]);
    expect(r.valid).toBe(false);
  });

  it('rejects duplicate names', () => {
    const r = validateFields([
      { rowId: 'r1', name: 'id', type: 'uuid', params: {} },
      { rowId: 'r2', name: 'id', type: 'uuid', params: {} },
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('重复');
  });

  it('rejects illegal column name (starts with digit)', () => {
    const r = validateFields([{ rowId: 'r1', name: '1bad', type: 'uuid', params: {} }]);
    expect(r.valid).toBe(false);
  });

  it('accepts valid english, underscore, and chinese names', () => {
    const r = validateFields([
      { rowId: 'r1', name: 'user_id', type: 'uuid', params: {} },
      { rowId: 'r2', name: '姓名', type: 'name', params: {} },
    ]);
    expect(r.valid).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: FAIL（toJson / toCsv / validateFields 未导出）

- [ ] **Step 3: 追加实现**

在 `fake-data.ts` 末尾追加：

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/utils/text/__tests__/fake-data.test.ts`
Expected: PASS（全部核心逻辑测试通过）

- [ ] **Step 5: 跑全量测试，确认未破坏其他工具**

Run: `pnpm test`
Expected: 全绿

- [ ] **Step 6: 提交**

```bash
git add src/utils/text/fake-data.ts src/utils/text/__tests__/fake-data.test.ts
git commit -m "feat(fake-data): JSON/CSV 序列化与字段校验"
```

---

## Task 6: Vue 交互组件

**Files:**
- Create: `src/tools/text/FakeDataGenerator.vue`

**Interfaces:**
- Consumes: `FIELD_TYPE_OPTIONS`、`QUICK_PRESETS`、`generateRecords`、`toJson`、`toCsv`、`validateFields`、`FieldConfig`、`FieldType`（`../../utils/text/fake-data`）；UI 组件 `ToolHeader`、`SelectListbox`、`OptionRadioGroup`、`CopyButton`；`useCopy`

- [ ] **Step 1: 创建组件**

```vue
<script setup lang="ts">
/**
 * 假数据生成器交互组件。
 *
 * 通过动态字段行配置列名、类型与参数，批量生成结构化假数据记录，
 * 支持 JSON 数组与 CSV 两种输出格式，快速模板一键填充常见字段组合。
 */
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import { useCopy } from '../../composables/useCopy';
import {
  FIELD_TYPE_OPTIONS,
  QUICK_PRESETS,
  generateRecords,
  toJson,
  toCsv,
  validateFields,
  type FieldConfig,
  type FieldType,
  type FieldTypeMeta,
} from '../../utils/text/fake-data';

/** 行 id 自增计数器（避开 Math.random）。 */
let rowSeq = 0;
/** 生成一个新的行 id。 */
function nextRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

/** 按类型构造默认字段配置（列名取默认值、参数取默认值）。 */
function makeField(type: FieldType, name?: string): FieldConfig {
  const meta = FIELD_TYPE_OPTIONS.find((m) => m.value === type) as FieldTypeMeta;
  const params: Record<string, string | number> = {};
  for (const p of meta.params) params[p.key] = p.default;
  return { rowId: nextRowId(), name: name ?? meta.defaultName, type, params };
}

/** 当前字段配置（默认预填 id / name / email）。 */
const fields = ref<FieldConfig[]>([
  makeField('auto-id', 'id'),
  makeField('name', 'name'),
  makeField('email', 'email'),
]);

/** 生成条数。 */
const count = ref(10);
/** 输出格式。 */
const format = ref<'json' | 'csv'>('json');
/** 已生成的原始记录（切格式时不重新随机）。 */
const records = ref<Record<string, unknown>[]>([]);
/** 校验错误信息（内联提示）。 */
const errorMsg = ref('');

/** 类型下拉选项。 */
const typeOptions = FIELD_TYPE_OPTIONS.map((m) => ({ value: m.value, label: m.label }));

/** 序列化结果文本。 */
const output = computed(() => {
  if (!records.value.length) return '';
  return format.value === 'json' ? toJson(records.value) : toCsv(records.value, fields.value);
});

/** 修改某字段类型时重置其参数为该类型默认值。 */
function onTypeChange(field: FieldConfig, type: FieldType): void {
  field.type = type;
  const meta = FIELD_TYPE_OPTIONS.find((m) => m.value === type) as FieldTypeMeta;
  const params: Record<string, string | number> = {};
  for (const p of meta.params) params[p.key] = p.default;
  field.params = params;
}

/** 返回某字段当前类型的参数元数据。 */
function paramDefs(field: FieldConfig): FieldTypeMeta['params'] {
  return (FIELD_TYPE_OPTIONS.find((m) => m.value === field.type) as FieldTypeMeta).params;
}

/** 添加一个默认字段行。 */
function addField(): void {
  fields.value.push(makeField('name', `field${fields.value.length + 1}`));
}

/** 删除指定字段行。 */
function removeField(rowId: string): void {
  fields.value = fields.value.filter((f) => f.rowId !== rowId);
}

/** 应用快速模板（整体替换字段配置）。 */
function applyPreset(idx: number): void {
  const preset = QUICK_PRESETS[idx];
  fields.value = preset.fields.map((f) => ({ ...f, params: { ...f.params }, rowId: nextRowId() }));
}

/** 钳制条数到 1–500。 */
function clampCount(): void {
  if (!Number.isFinite(count.value)) count.value = 10;
  count.value = Math.min(Math.max(Math.floor(count.value), 1), 500);
}

/** 生成记录。 */
function generate(): void {
  clampCount();
  const result = validateFields(fields.value);
  if (!result.valid) {
    errorMsg.value = result.error;
    return;
  }
  errorMsg.value = '';
  records.value = generateRecords(fields.value, count.value);
}

/** 清空结果（保留字段配置）。 */
function clearResult(): void {
  records.value = [];
  errorMsg.value = '';
}

const { copy } = useCopy();
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="假数据生成器"
      description="按字段配置批量生成姓名、邮箱、手机号、UUID、Lorem 等结构化假数据，输出 JSON 或 CSV。"
      :show-example="false"
    />

    <!-- 快速模板 -->
    <div class="border border-border rounded-md p-4 bg-card flex items-center gap-2 flex-wrap">
      <span class="text-[0.8125rem] text-muted">快速模板</span>
      <button
        v-for="(preset, idx) in QUICK_PRESETS"
        :key="idx"
        type="button"
        class="px-3 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
        @click="applyPreset(idx)"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- 字段配置区 -->
    <div class="mt-4 border border-border rounded-md bg-card overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2 border-b border-border">
        <span class="text-[0.8125rem] text-muted">字段配置</span>
        <button
          type="button"
          class="px-3 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
          @click="addField"
        >
          + 添加字段
        </button>
      </div>

      <div class="p-3 flex flex-col gap-2">
        <div
          v-for="field in fields"
          :key="field.rowId"
          class="flex items-center gap-2 flex-wrap"
        >
          <input
            v-model="field.name"
            type="text"
            class="px-2 py-1 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[120px]"
            placeholder="列名"
            aria-label="列名"
          />
          <div class="w-[120px]">
            <SelectListbox
              :model-value="field.type"
              :options="typeOptions"
              @update:model-value="(v) => onTypeChange(field, v as FieldType)"
            />
          </div>
          <template v-for="def in paramDefs(field)" :key="def.key">
            <label v-if="def.type === 'select'" class="flex items-center gap-1 text-[0.75rem] text-muted">
              {{ def.label }}
              <select
                v-model="field.params[def.key]"
                class="px-1 py-1 border border-border rounded-sm bg-background text-text text-[0.75rem] outline-none focus:border-accent"
              >
                <option v-for="opt in def.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </label>
            <label v-else class="flex items-center gap-1 text-[0.75rem] text-muted">
              {{ def.label }}
              <input
                v-model="field.params[def.key]"
                :type="def.type"
                class="px-2 py-1 border border-border rounded-sm bg-background text-text text-[0.75rem] font-mono outline-none focus:border-accent w-[80px]"
              />
            </label>
          </template>
          <button
            type="button"
            class="ml-auto flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-card text-muted cursor-pointer hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
            title="删除字段"
            aria-label="删除字段"
            @click="removeField(field.rowId)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 生成控制 -->
    <div class="mt-4 flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-[0.8125rem] text-muted">条数</span>
        <input
          v-model.number="count"
          type="number"
          min="1"
          max="500"
          class="px-2 py-1 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[80px]"
          @blur="clampCount"
        />
      </div>
      <button
        type="button"
        class="px-6 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90 transition-[opacity] duration-150"
        @click="generate"
      >
        生成
      </button>
      <button
        type="button"
        class="px-6 py-2 bg-surface border border-border text-text rounded-sm text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
        @click="clearResult"
      >
        清空
      </button>
    </div>
    <p v-if="errorMsg" class="mt-2 text-xs text-error">{{ errorMsg }}</p>

    <!-- 结果区 -->
    <div class="mt-6">
      <div v-if="!output" class="border border-border rounded-md bg-card min-h-[120px] flex items-center justify-center">
        <p class="text-muted text-[0.8125rem]">配置字段后点击「生成」</p>
      </div>
      <div v-else class="border border-border rounded-md bg-card overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-border">
          <OptionRadioGroup
            v-model="format"
            :options="[{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }]"
          />
          <div class="flex items-center gap-2">
            <span class="text-[0.75rem] text-muted">{{ records.length }} 条记录</span>
            <CopyButton :text="output" />
          </div>
        </div>
        <textarea
          readonly
          :value="output"
          rows="14"
          class="w-full px-3 py-2 bg-background text-text text-[0.8125rem] font-mono outline-none resize-y box-border"
          aria-label="生成结果"
        ></textarea>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `npx astro check`
Expected: 无与该组件相关的错误（IDE 索引可能对新文件有延迟的假阳性，以 astro check 为准）

- [ ] **Step 3: 手动验证（开发服务器）**

Run: 先完成 Task 7 的页面与注册，再 `pnpm dev` 打开 `/text/fake-data-generator`，验证：
- 默认预填 id/name/email 三行，点「生成」出 JSON
- 切换 CSV 格式，数据不重新随机
- 点「用户表」模板替换字段，重新生成
- 添加/删除字段行，改列名为重复值时显示错误
- 复制按钮工作

- [ ] **Step 4: 提交**

```bash
git add src/tools/text/FakeDataGenerator.vue
git commit -m "feat(fake-data): 假数据生成器交互组件"
```

---

## Task 7: 页面 + 注册 + FAQ + ROADMAP 收尾

**Files:**
- Create: `src/pages/text/fake-data-generator.astro`
- Modify: `src/data/tools.ts`（在 `gradient` 条目后追加）
- Modify: `src/data/tool-faqs.ts`（在 `toolFaqs` 对象内追加 key）
- Modify: `docs/ROADMAP.md`（勾选 P2 假数据生成器条目）

**Interfaces:**
- Consumes: `FakeDataGenerator.vue`

- [ ] **Step 1: 创建页面**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import FakeDataGenerator from '../../tools/text/FakeDataGenerator.vue';
---

<ToolLayout toolId="text/fake-data-generator">
  <FakeDataGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 2: 在 `tools.ts` 注册（`gradient` 条目 `relatedToolIds` 后追加新对象）**

在 `gradient` 对象的结尾 `},` 之后、数组结尾 `];` 之前插入：

```ts
  {
    id: 'fake-data-generator',
    name: '假数据生成器',
    description: '按字段配置批量生成姓名、邮箱、手机号、UUID、Lorem 占位文等结构化假数据，输出 JSON 或 CSV',
    seoDescription: '在线假数据生成器，可自定义字段类型与列名，批量生成中文英文姓名、邮箱、手机号、UUID、Lorem 占位文、日期、IP 等 15 类结构化测试数据，一键导出 JSON 或 CSV，纯浏览器端生成数据绝不上传，前后端测试与数据库灌库必备。',
    category: '文本处理',
    icon: '🧪',
    path: '/text/fake-data-generator',
    keywords: ['假数据生成', '测试数据生成', 'mock 数据', '随机姓名生成', '随机邮箱', 'faker', '生成 JSON 测试数据', '生成 CSV 测试数据', 'Lorem ipsum', '造数据'],
    relatedToolIds: ['random-string', 'uuid-generator', 'text-toolbox'],
  },
```

- [ ] **Step 3: 在 `tool-faqs.ts` 的 `toolFaqs` 对象内追加（建议放在 `'text-toolbox'` 条目之后）**

```ts
  'fake-data-generator': [
    {
      question: '生成的姓名 / 手机号是真实存在的吗？',
      answer: '不是。姓名由内置百家姓与常见名用字随机组合，手机号按合法号段随机拼接，<strong>不对应任何真人或真实号码</strong>，仅供开发测试与占位填充使用。',
    },
    {
      question: '和「随机字符串生成」「UUID 生成器」有什么区别？',
      answer: '「随机字符串生成」产出无语义的随机字符或密码，「UUID 生成器」专门生成并解析 UUID。本工具生成的是<strong>一整条结构化记录</strong>（如 { id, name, email }），UUID、随机串只是其中一种可选的<strong>字段类型</strong>。',
    },
    {
      question: '数据会上传到服务器吗？',
      answer: '不会。所有数据均在<strong>浏览器本地</strong>随机生成，不上传任何信息，关闭页面后即清除。',
    },
    {
      question: '能生成中文姓名、自定义列名吗？',
      answer: '可以。姓名字段默认中文，可在该行参数里切换为<strong>英文</strong>；每行的<strong>列名</strong>可自由编辑，直接作为 JSON 的 key 与 CSV 的表头（支持字母、数字、下划线、中文，不能以数字开头）。也可用顶部的「用户表 / 文章 / 订单 / 商品」快速模板一键填充常见字段组合。',
    },
  ],
```

- [ ] **Step 4: 勾选 ROADMAP**

`docs/ROADMAP.md` 中将：

```
- [ ] 文本处理：假数据生成器
```

改为：

```
- [x] 文本处理：假数据生成器 — 已完成（2026-06-18）。新建 `/text/fake-data-generator`，字段配置+批量记录模式，15 类字段（自增ID/UUID/姓名/用户名/邮箱/手机号/密码/Lorem 词句段/日期/时间戳/整数/小数/布尔/IPv4/URL），JSON/CSV 双输出，4 个快速模板；自研纯函数模块 `utils/text/fake-data.ts` + `fake-data-dict.ts`（随机源统一 crypto，复用 generateRandomString，未引入第三方库），配套 4 条 FAQ。P2 收尾
```

- [ ] **Step 5: 启动开发服务器验证**

Run: `pnpm dev`
打开 `http://localhost:4321/text/fake-data-generator`（端口号以实际输出为准），验证 Task 6 Step 3 列出的全部交互。同时确认首页/分类页能看到该工具卡片、面包屑、相关工具、FAQ 折叠正常。

- [ ] **Step 6: 全量测试 + 构建**

Run: `pnpm test && pnpm build`
Expected: 测试全绿、构建无错误

- [ ] **Step 7: 提交**

```bash
git add src/pages/text/fake-data-generator.astro src/data/tools.ts src/data/tool-faqs.ts docs/ROADMAP.md
git commit -m "feat(fake-data): 注册工具、页面、FAQ 并勾选 ROADMAP"
```

---

## Self-Review Notes

- **Spec 覆盖**：15 类字段 → Task 1 元数据 + Task 2/3 生成器；JSON/CSV 输出 → Task 5；快速模板 → Task 1 QUICK_PRESETS + Task 6；中文为主可切英文姓名 → Task 3 genName；纯随机 crypto → Task 1 randomInt + 复用 generateRandomString；条数 500 → Task 6 clampCount；校验 → Task 5 validateFields；安全（RFC4180 转义）→ Task 5 toCsv；FAQ 4 条 → Task 7。
- **类型一致性**：`FieldConfig`、`FieldType`、各 `genX` 签名在 Task 1–5 间一致；`generateRecords` 内 `generateFieldValue` 分发覆盖全部 17 个 case（含 3 个 Lorem 变体）。
- **无占位符**：所有步骤含完整可运行代码。
