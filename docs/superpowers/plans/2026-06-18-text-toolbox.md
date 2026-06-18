# 文本处理工具箱 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现浏览器端即开即用的文本处理工具箱（`/text/text-toolbox`），支持大小写/全半角转换、去重去空行、排序、字数统计、查找替换等高频文本操作，采用原地变换 + 实时统计 + 多步撤销形态。

**Architecture:** 纯函数模块 `utils/text/text-toolbox.ts`（每个变换独立、可单测）+ Vue 组件 `tools/text/TextToolbox.vue`（原地变换、实时统计 computed、撤销栈、查找替换）+ Astro 路由页。无第三方库，全部原生字符串/正则。

**Tech Stack:** Vue 3 `<script setup lang="ts">`、Astro 6、Tailwind v4、vitest 4。

## Global Constraints

- Node ≥ 22.12.0；包管理器 pnpm
- 安全规则：禁用 `eval`/`Function`；正则用 `new RegExp` 包 `try-catch`
- 无路径别名，全部相对路径导入（如 `../../utils/text/text-toolbox`）
- 注释：公共函数/类型/组件必须 JSDoc/TSDoc，简洁说明「为什么」与职责
- 工具 id 必须等于 path 末段：`text-toolbox`（否则 FAQ/相关工具/SEO 结构化数据静默失效）
- 测试：vitest，文件置于被测模块同目录的 `__tests__/` 子目录
- 命令：`pnpm test`（vitest run）、`pnpm build`（astro build，含类型检查与 Vue 编译）
- 视觉令牌：仅用 Tailwind class 消费 `global.css` 令牌，禁止内联 style 与 `<style scoped>`（沿用 NumberBaseConverter.vue 的纯 Tailwind 风格）
- 当前分支：`text-toolbox`（已建，设计文档已提交）

---

## 文件结构

| 文件 | 职责 | 任务 |
|------|------|------|
| `src/utils/text/text-toolbox.ts` | 全部纯函数 + 类型（变换/统计/查找替换/撤销栈） | 1–7 |
| `src/utils/text/__tests__/text-toolbox.test.ts` | 纯函数单元测试 | 1–7 |
| `src/tools/text/TextToolbox.vue` | 交互组件（原地变换 + 实时统计 + 撤销 + 查找替换） | 8 |
| `src/pages/text/text-toolbox.astro` | 路由页（ToolLayout + client:idle） | 8 |
| `src/data/tools.ts` | 注册工具元数据 | 8 |
| `src/data/tool-faqs.ts` | FAQ 问答对 | 8 |

---

## Task 1: 大小写变换函数

**Files:**
- Create: `src/utils/text/text-toolbox.ts`
- Test: `src/utils/text/__tests__/text-toolbox.test.ts`

**Interfaces:**
- Produces: `toUpperCase(input: string): string`、`toLowerCase(input: string): string`、`toTitleCase(input: string): string`

- [ ] **Step 1: 写失败测试**

创建 `src/utils/text/__tests__/text-toolbox.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { toUpperCase, toLowerCase, toTitleCase } from '../text-toolbox';

describe('toUpperCase', () => {
  it('converts lowercase to uppercase', () => {
    expect(toUpperCase('abc')).toBe('ABC');
  });

  it('leaves non-cased characters (Chinese) unchanged', () => {
    expect(toUpperCase('你好abc')).toBe('你好ABC');
  });
});

describe('toLowerCase', () => {
  it('converts uppercase to lowercase', () => {
    expect(toLowerCase('ABC')).toBe('abc');
  });
});

describe('toTitleCase', () => {
  it('capitalizes first char of each line, lowercases the rest', () => {
    expect(toTitleCase('hello world')).toBe('Hello world');
  });

  it('processes each line independently', () => {
    expect(toTitleCase('HELLO\nWORLD')).toBe('Hello\nWorld');
  });

  it('preserves empty lines', () => {
    expect(toTitleCase('a\n\nb')).toBe('A\n\nB');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `Failed to resolve import` 或 `toUpperCase is not a function`（模块尚未创建）

- [ ] **Step 3: 实现**

创建 `src/utils/text/text-toolbox.ts`：

```ts
/**
 * 文本处理工具箱核心模块。
 *
 * 提供大小写/全半角转换、去重去空行、排序、统计、查找替换等纯函数，
 * 以及撤销/重做历史栈。所有函数无副作用，可独立单元测试。
 */

/** 将文本全部转为大写（无大小写概念的字形如中文原样保留）。 */
export function toUpperCase(input: string): string {
  return input.toUpperCase();
}

/** 将文本全部转为小写。 */
export function toLowerCase(input: string): string {
  return input.toLowerCase();
}

/**
 * 按行做标题化：每行首字符大写、其余小写。
 *
 * 空行原样保留；首字符无大小写概念（如中文）时仅对其后字符做小写处理。
 * @param input - 原始文本
 * @returns 标题化后的文本
 */
export function toTitleCase(input: string): string {
  return input
    .split('\n')
    .map((line) => {
      if (!line) return line;
      return line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
    })
    .join('\n');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS（3 个 describe 全绿）

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加文本处理工具箱大小写变换函数" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 全角/半角转换函数

**Files:**
- Modify: `src/utils/text/text-toolbox.ts`（追加导出）
- Test: `src/utils/text/__tests__/text-toolbox.test.ts`（追加测试）

**Interfaces:**
- Produces: `toHalfWidth(input: string): string`、`toFullWidth(input: string): string`

- [ ] **Step 1: 追加失败测试**

在测试文件末尾追加：

```ts
import { toHalfWidth, toFullWidth } from '../text-toolbox';

describe('toHalfWidth', () => {
  it('converts fullwidth ASCII letters and digits', () => {
    expect(toHalfWidth('ＡＢＣ１２３')).toBe('ABC123');
  });

  it('converts fullwidth space (U+3000) to regular space', () => {
    expect(toHalfWidth('Ａ　Ｂ')).toBe('A B');
  });

  it('leaves Chinese characters unchanged', () => {
    expect(toHalfWidth('你好')).toBe('你好');
  });
});

describe('toFullWidth', () => {
  it('converts ASCII letters and digits to fullwidth', () => {
    expect(toFullWidth('ABC123')).toBe('ＡＢＣ１２３');
  });

  it('converts regular space to fullwidth space', () => {
    expect(toFullWidth('a b')).toBe('ａ　ｂ');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `toHalfWidth is not a function`

- [ ] **Step 3: 实现**

在 `text-toolbox.ts` 末尾追加：

```ts
/**
 * 全角转半角。
 *
 * 将 U+FF01–FF5E 映射为 U+0021–007E（偏移 0xFEE0），全角空格 U+3000 转为普通空格 U+0020。
 * 仅作用于 ASCII 范围，中文字符不受影响。
 * @param input - 原始文本
 * @returns 半角化后的文本
 */
export function toHalfWidth(input: string): string {
  return input.replace(/[！-～　]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code === 0x3000) return ' ';
    return String.fromCharCode(code - 0xfee0);
  });
}

/**
 * 半角转全角。
 *
 * 将 U+0021–007E 映射为 U+FF01–FF5E，普通空格 U+0020 转为全角空格 U+3000。
 * @param input - 原始文本
 * @returns 全角化后的文本
 */
export function toFullWidth(input: string): string {
  return input.replace(/[!-~ ]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code === 0x0020) return String.fromCharCode(0x3000);
    return String.fromCharCode(code + 0xfee0);
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加全角半角转换函数" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 文本清理函数

**Files:**
- Modify: `src/utils/text/text-toolbox.ts`、测试文件

**Interfaces:**
- Produces: `removeBlankLines(input: string): string`、`dedupeLines(input: string): string`、`trimLines(input: string): string`、`collapseWhitespace(input: string): string`

- [ ] **Step 1: 追加失败测试**

```ts
import { removeBlankLines, dedupeLines, trimLines, collapseWhitespace } from '../text-toolbox';

describe('removeBlankLines', () => {
  it('removes empty and whitespace-only lines', () => {
    expect(removeBlankLines('a\n\n  \nb')).toBe('a\nb');
  });
});

describe('dedupeLines', () => {
  it('removes duplicate lines keeping first occurrence order', () => {
    expect(dedupeLines('a\nb\na')).toBe('a\nb');
  });
});

describe('trimLines', () => {
  it('trims leading/trailing whitespace of each line only', () => {
    expect(trimLines('  a  b  \n  c')).toBe('a  b\nc');
  });
});

describe('collapseWhitespace', () => {
  it('collapses consecutive whitespace within a line to single space', () => {
    expect(collapseWhitespace('a   b\t\tc')).toBe('a b c');
  });

  it('does not merge across lines', () => {
    expect(collapseWhitespace('a\n  b  c')).toBe('a\nb c');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `removeBlankLines is not a function`

- [ ] **Step 3: 实现**

在 `text-toolbox.ts` 末尾追加：

```ts
/**
 * 删除纯空白行（仅含空格/制表符等空白的行），保留有内容的行。
 * @param input - 原始文本
 * @returns 去除空白行后的文本
 */
export function removeBlankLines(input: string): string {
  return input
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}

/**
 * 按行去重，保留首次出现顺序。
 * @param input - 原始文本
 * @returns 去重后的文本
 */
export function dedupeLines(input: string): string {
  const seen = new Set<string>();
  return input
    .split('\n')
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join('\n');
}

/**
 * 去除每一行的首尾空白，不改动行内中间空白。
 * @param input - 原始文本
 * @returns 每行首尾去空白后的文本
 */
export function trimLines(input: string): string {
  return input
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

/**
 * 将每行内部连续空白（空格/制表符）合并为单个空格，并去除该行首尾空白。
 * 不跨行合并、不删除换行。
 * @param input - 原始文本
 * @returns 合并空白后的文本
 */
export function collapseWhitespace(input: string): string {
  return input
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加文本清理函数（去空行/去重/去空白/合并空白）" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 行排序函数

**Files:**
- Modify: `src/utils/text/text-toolbox.ts`、测试文件

**Interfaces:**
- Produces: `sortLines(input: string, order?: 'asc' | 'desc'): string`（`order` 默认 `'asc'`）

- [ ] **Step 1: 追加失败测试**

```ts
import { sortLines } from '../text-toolbox';

describe('sortLines', () => {
  it('sorts lines ascending by code point', () => {
    expect(sortLines('c\na\nb')).toBe('a\nb\nc');
  });

  it('sorts lines descending', () => {
    expect(sortLines('c\na\nb', 'desc')).toBe('c\nb\na');
  });

  it('places uppercase before lowercase (code point order)', () => {
    expect(sortLines('b\nA\nc')).toBe('A\nb\nc');
  });

  it('moves blank/whitespace-only lines to the end', () => {
    expect(sortLines('b\n\na')).toBe('a\nb\n');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `sortLines is not a function`

- [ ] **Step 3: 实现**

在 `text-toolbox.ts` 末尾追加：

```ts
/**
 * 按行排序。
 *
 * 使用默认码点序（大写 ASCII 排在小写之前），区分大小写；
 * 空行与纯空白行不参与排序，统一移到结果末尾并以空串输出。
 * @param input - 原始文本
 * @param order - 排序方向，默认升序 `'asc'`
 * @returns 排序后的文本
 */
export function sortLines(input: string, order: 'asc' | 'desc' = 'asc'): string {
  const lines = input.split('\n');
  const nonBlank = lines.filter((line) => line.trim() !== '');
  const blankCount = lines.length - nonBlank.length;
  nonBlank.sort();
  if (order === 'desc') nonBlank.reverse();
  return [...nonBlank, ...Array<string>(blankCount).fill('')].join('\n');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加行排序函数" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 文本统计函数

**Files:**
- Modify: `src/utils/text/text-toolbox.ts`、测试文件

**Interfaces:**
- Produces: `TextStats` 接口、`computeStats(input: string): TextStats`

- [ ] **Step 1: 追加失败测试**

```ts
import { computeStats } from '../text-toolbox';

describe('computeStats', () => {
  it('returns zeros for empty string', () => {
    expect(computeStats('')).toEqual({ chars: 0, charsNoSpace: 0, bytes: 0, lines: 0 });
  });

  it('counts chars, bytes and lines for plain ascii', () => {
    expect(computeStats('a\nb')).toEqual({ chars: 3, charsNoSpace: 2, bytes: 3, lines: 2 });
  });

  it('counts UTF-8 bytes correctly for Chinese (3 bytes per char)', () => {
    const s = computeStats('你好');
    expect(s.chars).toBe(2);
    expect(s.bytes).toBe(6);
  });

  it('counts emoji surrogate pair length and bytes', () => {
    const s = computeStats('🎉');
    expect(s.chars).toBe(2);
    expect(s.bytes).toBe(4);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `computeStats is not a function`

- [ ] **Step 3: 实现**

在 `text-toolbox.ts` 末尾追加（模块级复用一个 `TextEncoder`）：

```ts
/** 文本统计结果。 */
export interface TextStats {
  /** 全部字符数（含空白与换行） */
  chars: number;
  /** 去除所有空白后的字符数 */
  charsNoSpace: number;
  /** UTF-8 编码字节数 */
  bytes: number;
  /** 行数 */
  lines: number;
}

/** 复用的 UTF-8 编码器（计算字节数）。 */
const encoder = new TextEncoder();

/**
 * 计算文本的字符数、去空白字符数、UTF-8 字节数与行数。
 * @param input - 原始文本
 * @returns 统计结果
 */
export function computeStats(input: string): TextStats {
  return {
    chars: input.length,
    charsNoSpace: input.replace(/\s/g, '').length,
    bytes: encoder.encode(input).length,
    lines: input === '' ? 0 : input.split('\n').length,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加文本统计函数" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 查找替换函数

**Files:**
- Modify: `src/utils/text/text-toolbox.ts`、测试文件

**Interfaces:**
- Produces: `ReplaceOptions` 接口、`ReplaceResult` 接口、`replaceAll(input: string, find: string, replace: string, options: ReplaceOptions): ReplaceResult`

- [ ] **Step 1: 追加失败测试**

```ts
import { replaceAll } from '../text-toolbox';

describe('replaceAll', () => {
  it('replaces all literal occurrences', () => {
    expect(replaceAll('a-b-c', '-', '_', { caseSensitive: true, regex: false }).result).toBe('a_b_c');
  });

  it('keeps replacement string literally (no $ interpretation) in literal mode', () => {
    expect(replaceAll('abc', 'b', '$&x', { caseSensitive: true, regex: false }).result).toBe('a$&xc');
  });

  it('is case-insensitive when caseSensitive=false', () => {
    expect(replaceAll('AaA', 'a', 'b', { caseSensitive: false, regex: false }).result).toBe('bbb');
  });

  it('supports regex pattern', () => {
    expect(replaceAll('a1b2', '\\d', 'X', { caseSensitive: true, regex: true }).result).toBe('aXbX');
  });

  it('supports backreference in regex mode', () => {
    expect(replaceAll('hello', '(l)', '[$1]', { caseSensitive: true, regex: true }).result).toBe('he[l][l]o');
  });

  it('returns error for invalid regex', () => {
    const r = replaceAll('abc', '(', '_', { caseSensitive: true, regex: true });
    expect(r.error).toBeTruthy();
    expect(r.result).toBe('abc');
  });

  it('returns error when find is empty', () => {
    expect(replaceAll('abc', '', 'x', { caseSensitive: true, regex: false }).error).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `replaceAll is not a function`

- [ ] **Step 3: 实现**

在 `text-toolbox.ts` 末尾追加：

```ts
/** 查找替换选项。 */
export interface ReplaceOptions {
  /** 是否区分大小写 */
  caseSensitive: boolean;
  /** 是否将查找内容作为正则表达式 */
  regex: boolean;
}

/** 查找替换结果。 */
export interface ReplaceResult {
  /** 替换后的文本；出错时为原文。 */
  result: string;
  /** 错误信息；成功时为 undefined。 */
  error?: string;
}

/** 转义字符串中的正则元字符，用于字面量匹配。 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 全局查找替换。
 *
 * - 普通模式：按字面量匹配，替换串原样输出（不解释 `$`）。
 * - 正则模式：`new RegExp(find, flags)`，遵循 JS 标准 `replace` 语义（支持 `$1`/`$&` 反向引用）。
 *
 * 正则编译失败或查找内容为空时返回 `error`，不改动原文。
 * @param input - 原始文本
 * @param find - 查找内容
 * @param replace - 替换内容
 * @param options - 替换选项
 * @returns 替换结果（含可能错误）
 */
export function replaceAll(
  input: string,
  find: string,
  replace: string,
  options: ReplaceOptions,
): ReplaceResult {
  if (find === '') {
    return { result: input, error: '查找内容不能为空' };
  }

  const flags = 'g' + (options.caseSensitive ? '' : 'i');

  if (options.regex) {
    let re: RegExp;
    try {
      re = new RegExp(find, flags);
    } catch (e) {
      return {
        result: input,
        error: e instanceof Error ? `正则表达式语法错误：${e.message}` : '正则表达式语法错误',
      };
    }
    return { result: input.replace(re, replace) };
  }

  // 字面量模式：用函数替换避免替换串中的 $ 被解释
  const re = new RegExp(escapeRegExp(find), flags);
  return { result: input.replace(re, () => replace) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加查找替换函数（字面量与正则）" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 撤销/重做历史栈

**Files:**
- Modify: `src/utils/text/text-toolbox.ts`、测试文件

**Interfaces:**
- Produces: `History` 接口、`createHistory(limit?: number): History`

- [ ] **Step 1: 追加失败测试**

```ts
import { createHistory } from '../text-toolbox';

describe('createHistory', () => {
  it('initial state is not undoable after reset', () => {
    const h = createHistory();
    h.reset('a');
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.current()).toBe('a');
  });

  it('push makes previous state undoable', () => {
    const h = createHistory();
    h.reset('a');
    h.push('b');
    expect(h.canUndo()).toBe(true);
    expect(h.undo()).toBe('a');
    expect(h.canRedo()).toBe(true);
    expect(h.redo()).toBe('b');
  });

  it('truncates redo branch when pushing after undo', () => {
    const h = createHistory();
    h.reset('a');
    h.push('b');
    h.push('c');
    expect(h.undo()).toBe('b'); // 当前 'b'，'c' 仍在 redo 分支
    h.push('d'); // 截断 'c'
    expect(h.canRedo()).toBe(false);
    expect(h.current()).toBe('d');
    expect(h.undo()).toBe('b');
    expect(h.redo()).toBe('d'); // 'c' 已被丢弃
  });

  it('drops oldest beyond limit', () => {
    const h = createHistory(2);
    h.reset('a');
    h.push('b');
    h.push('c'); // 'a' 被丢弃
    expect(h.undo()).toBe('b');
    expect(h.canUndo()).toBe(false); // 无法再撤到 'a'
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test text-toolbox`
Expected: FAIL — `createHistory is not a function`

- [ ] **Step 3: 实现**

在 `text-toolbox.ts` 末尾追加：

```ts
/** 撤销/重做历史栈接口。 */
export interface History {
  /** 当前状态值。 */
  current(): string;
  /** 推入新状态；若处于已撤销的中段，先截断后续 redo 分支。 */
  push(value: string): void;
  /** 撤销一步，返回上一状态；无可撤销时返回 null。 */
  undo(): string | null;
  /** 重做一步，返回下一状态；无可重做时返回 null。 */
  redo(): string | null;
  /** 是否可撤销。 */
  canUndo(): boolean;
  /** 是否可重做。 */
  canRedo(): boolean;
  /** 重置为给定初值并清空历史（仅该初值，不可撤销）。 */
  reset(value: string): void;
}

/**
 * 创建一个有上限的撤销/重做历史栈。
 *
 * 采用标准 undo 语义：在中段（已 undo）插入新状态时截断后续分支；
 * 超过 `limit` 时丢弃最早记录。
 * @param limit - 历史记录上限，默认 50
 * @returns 历史栈实例
 */
export function createHistory(limit = 50): History {
  let stack: string[] = [];
  let pointer = -1;

  return {
    current() {
      return pointer >= 0 ? stack[pointer] : '';
    },
    push(value: string) {
      stack = stack.slice(0, pointer + 1);
      stack.push(value);
      if (stack.length > limit) stack.shift();
      pointer = stack.length - 1;
    },
    undo() {
      if (pointer <= 0) return null;
      pointer--;
      return stack[pointer];
    },
    redo() {
      if (pointer >= stack.length - 1) return null;
      pointer++;
      return stack[pointer];
    },
    canUndo() {
      return pointer > 0;
    },
    canRedo() {
      return pointer < stack.length - 1;
    },
    reset(value: string) {
      stack = [value];
      pointer = 0;
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test text-toolbox`
Expected: PASS（全部纯函数测试通过）

- [ ] **Step 5: 提交**

```bash
git add src/utils/text/text-toolbox.ts src/utils/text/__tests__/text-toolbox.test.ts
git commit -m "feat(text): 添加撤销重做历史栈" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 交互组件 + 路由 + 注册 + FAQ

> 此任务无独立单元测试（UI 组件），以 `pnpm test`（确认纯函数层未被破坏）+ `pnpm build`（类型检查 + Vue 编译 + 路由生成）作为验收。

**Files:**
- Create: `src/tools/text/TextToolbox.vue`、`src/pages/text/text-toolbox.astro`
- Modify: `src/data/tools.ts`、`src/data/tool-faqs.ts`

**Interfaces:**
- Consumes: Task 1–7 全部导出（`toUpperCase` / `toLowerCase` / `toTitleCase` / `toHalfWidth` / `toFullWidth` / `removeBlankLines` / `dedupeLines` / `trimLines` / `collapseWhitespace` / `sortLines` / `computeStats` / `replaceAll` / `createHistory`）；`useCopy`（`../../composables/useCopy`）；`ToolHeader`（`../../components/layout/ToolHeader.vue`）

- [ ] **Step 1: 创建交互组件**

创建 `src/tools/text/TextToolbox.vue`：

```vue
<script setup lang="ts">
/**
 * 文本处理工具箱交互组件。
 *
 * 提供大小写/全半角转换、去重去空行、排序、字数统计与查找替换等高频文本操作。
 * 点击变换按钮原地改写文本框内容，支持多步撤销/重做；统计实时更新。
 */
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import { useCopy } from '../../composables/useCopy';
import {
  toUpperCase,
  toLowerCase,
  toTitleCase,
  toHalfWidth,
  toFullWidth,
  removeBlankLines,
  dedupeLines,
  trimLines,
  collapseWhitespace,
  sortLines,
  computeStats,
  replaceAll,
  createHistory,
} from '../../utils/text/text-toolbox';

/** 初始示例文本，打开页面即可体验。 */
const DEFAULT_TEXT = 'Hello World\nFoo Bar\nfoo bar\n\nHello World';

/** 文本框内容（当前状态）。 */
const text = ref(DEFAULT_TEXT);

/** 查找词。 */
const find = ref('');
/** 替换词。 */
const replace = ref('');
/** 查找替换是否区分大小写。 */
const caseSensitive = ref(false);
/** 查找替换是否使用正则。 */
const useRegex = ref(false);
/** 查找替换错误信息。 */
const replaceError = ref('');

/** 撤销/重做历史栈。 */
const history = createHistory(50);
history.reset(DEFAULT_TEXT);

/** 是否可撤销。 */
const canUndo = ref(false);
/** 是否可重做。 */
const canRedo = ref(false);

const { copy } = useCopy();

/** 实时统计（依赖 text 自动 memo）。 */
const stats = computed(() => computeStats(text.value));

/** Ghost 按钮（变换/操作）的 Tailwind class，集中定义以避免重复。 */
const BTN_CLASS =
  'px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color] duration-150 hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed';
/** Primary 按钮（替换全部）的 Tailwind class。 */
const BTN_PRIMARY_CLASS =
  'px-4 py-2 border border-accent rounded-sm bg-accent text-white text-[0.8125rem] cursor-pointer transition-[opacity] duration-150 hover:opacity-90';

/** 同步撤销/重做按钮可用状态。 */
function syncHistoryFlags(): void {
  canUndo.value = history.canUndo();
  canRedo.value = history.canRedo();
}

/**
 * 应用一个文本变换：基于当前文本计算新值，写回文本框并入历史栈。
 * @param fn - 变换函数
 */
function apply(fn: (input: string) => string): void {
  const next = fn(text.value);
  if (next === text.value) return;
  text.value = next;
  history.push(next);
  syncHistoryFlags();
}

/** 撤销一步。 */
function handleUndo(): void {
  const prev = history.undo();
  if (prev !== null) {
    text.value = prev;
    syncHistoryFlags();
  }
}

/** 重做一步。 */
function handleRedo(): void {
  const next = history.redo();
  if (next !== null) {
    text.value = next;
    syncHistoryFlags();
  }
}

/** 清空文本框并重置历史。 */
function handleClear(): void {
  text.value = '';
  history.reset('');
  syncHistoryFlags();
}

/** 复制当前文本框内容。 */
async function handleCopy(): Promise<void> {
  await copy(text.value);
}

/** 执行查找替换并写回文本框。 */
function handleReplace(): void {
  replaceError.value = '';
  const { result, error } = replaceAll(text.value, find.value, replace.value, {
    caseSensitive: caseSensitive.value,
    regex: useRegex.value,
  });
  if (error) {
    replaceError.value = error;
    return;
  }
  if (result === text.value) return;
  text.value = result;
  history.push(result);
  syncHistoryFlags();
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="文本处理工具箱"
      description="大小写/全半角转换、去重去空行、排序、字数统计与查找替换，一站式文本处理。"
      :show-example="false"
    />

    <!-- 变换按钮区 -->
    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-3">
      <div>
        <p class="text-[0.8125rem] text-muted mb-1.5">变换</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="BTN_CLASS" @click="apply(toUpperCase)">大写</button>
          <button type="button" :class="BTN_CLASS" @click="apply(toLowerCase)">小写</button>
          <button type="button" :class="BTN_CLASS" @click="apply(toTitleCase)">首字母大写</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="BTN_CLASS" @click="apply(toHalfWidth)">全角→半角</button>
        <button type="button" :class="BTN_CLASS" @click="apply(toFullWidth)">半角→全角</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="BTN_CLASS" @click="apply(removeBlankLines)">去空行</button>
        <button type="button" :class="BTN_CLASS" @click="apply(dedupeLines)">去重</button>
        <button type="button" :class="BTN_CLASS" @click="apply(trimLines)">去首尾空白</button>
        <button type="button" :class="BTN_CLASS" @click="apply(collapseWhitespace)">合并空白</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="BTN_CLASS" @click="apply((t) => sortLines(t, 'asc'))">行升序</button>
        <button type="button" :class="BTN_CLASS" @click="apply((t) => sortLines(t, 'desc'))">行降序</button>
      </div>
      <div class="flex flex-wrap gap-2 pt-3 border-t border-border">
        <button type="button" :class="BTN_CLASS" :disabled="!canUndo" @click="handleUndo">↶ 撤销</button>
        <button type="button" :class="BTN_CLASS" :disabled="!canRedo" @click="handleRedo">↻ 重做</button>
        <button type="button" :class="BTN_CLASS" @click="handleClear">清空</button>
        <button type="button" :class="BTN_CLASS" @click="handleCopy">复制</button>
      </div>
    </div>

    <!-- 文本框 -->
    <div class="mt-4">
      <textarea
        v-model="text"
        rows="10"
        class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent resize-y box-border"
        placeholder="粘贴或输入文本..."
      ></textarea>
      <p class="mt-1.5 text-xs text-muted">
        字数 {{ stats.charsNoSpace }} · 字符 {{ stats.chars }} · 字节 {{ stats.bytes }} · 行 {{ stats.lines }}
      </p>
    </div>

    <!-- 查找替换 -->
    <div class="border border-border rounded-md p-6 bg-card mt-4 flex flex-col gap-3">
      <p class="text-[0.8125rem] text-muted">查找替换</p>
      <div class="flex flex-col sm:flex-row gap-2">
        <input
          v-model="find"
          type="text"
          class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent box-border"
          placeholder="查找内容"
        />
        <input
          v-model="replace"
          type="text"
          class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-sm font-mono focus:outline-none focus:border-accent box-border"
          placeholder="替换为"
        />
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-1.5 text-sm text-text cursor-pointer select-none">
          <input v-model="caseSensitive" type="checkbox" class="cursor-pointer" />
          区分大小写
        </label>
        <label class="flex items-center gap-1.5 text-sm text-text cursor-pointer select-none">
          <input v-model="useRegex" type="checkbox" class="cursor-pointer" />
          使用正则
        </label>
        <button type="button" :class="BTN_PRIMARY_CLASS" class="ml-auto" @click="handleReplace">替换全部</button>
      </div>
      <p v-if="replaceError" class="text-xs text-error">{{ replaceError }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建路由页**

创建 `src/pages/text/text-toolbox.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import TextToolbox from '../../tools/text/TextToolbox.vue';
---

<ToolLayout toolId="text/text-toolbox">
  <TextToolbox client:idle />
</ToolLayout>
```

- [ ] **Step 3: 注册工具元数据**

在 `src/data/tools.ts` 中，定位 `number-base-converter` 条目，在其后插入新条目。用 Edit：

old_string：
```
    path: '/text/number-base-converter',
    keywords: ['进制转换', '二进制转十六进制', '八进制转十进制', '十进制转二进制', 'BigInt', '补码', 'hex转binary', '进制互转'],
    relatedToolIds: ['random-string', 'uuid-generator'],
  },
```

new_string：
```
    path: '/text/number-base-converter',
    keywords: ['进制转换', '二进制转十六进制', '八进制转十进制', '十进制转二进制', 'BigInt', '补码', 'hex转binary', '进制互转'],
    relatedToolIds: ['random-string', 'uuid-generator'],
  },
  {
    id: 'text-toolbox',
    name: '文本处理工具箱',
    description: '大小写与全半角转换、去重去空行、排序、字数字节统计、查找替换，一站式文本处理',
    seoDescription: '免费的在线文本处理工具箱，一站式完成大小写与全半角转换、按行去重去空行、文本排序、字数与字节统计、正则查找替换等高频文本操作，纯浏览器端本地运算，数据绝不上传，即开即用。',
    category: '文本处理',
    icon: '🧰',
    path: '/text/text-toolbox',
    keywords: ['文本处理', '大小写转换', '全角半角', '去重', '去空行', '文本排序', '字数统计', '查找替换'],
    relatedToolIds: ['number-base-converter', 'uuid-generator', 'random-string'],
  },
```

- [ ] **Step 4: 添加 FAQ**

在 `src/data/tool-faqs.ts` 中，定位 `number-base-converter` FAQ 数组的闭合，在其后插入 `text-toolbox` 条目。用 Edit：

old_string：
```
      answer: '中括号表示一个字节（8 位），内部按 4 位（一个 nibble）用空格分隔。这样便于把二进制与十六进制逐字节对照，例如 <code>[0001 1010][0011 1111]</code> 对应 <code>0x1A3F</code>。',
    },
  ],
```

new_string：
```
      answer: '中括号表示一个字节（8 位），内部按 4 位（一个 nibble）用空格分隔。这样便于把二进制与十六进制逐字节对照，例如 <code>[0001 1010][0011 1111]</code> 对应 <code>0x1A3F</code>。',
    },
  ],
  'text-toolbox': [
    {
      question: '数据会上传到服务器吗？',
      answer: '不会。所有文本处理（大小写转换、去重、排序、查找替换等）均在<strong>浏览器本地</strong>完成，不会上传到任何服务器，关闭页面后数据自动清除。',
    },
    {
      question: '「字数」是怎么统计的？',
      answer: '本工具的「字数」指<strong>去除所有空白字符后的字符数</strong>，对中文最直观（中文没有词的概念，字符数即字数）。另有「字符」列统计含空白的全部字符数，「字节」列统计 UTF-8 编码字节数（中文每字 3 字节），三者口径不同，可按需参考。',
    },
    {
      question: '全角半角转换覆盖哪些字符？',
      answer: '覆盖 <strong>ASCII 字母、数字、标点与空格</strong>。例如全角 <code>ＡＢＣ１２３</code> 转为半角 <code>ABC123</code>，全角空格转为普通空格。中文字符不受影响。',
    },
    {
      question: '撤销最多能回退多少步？',
      answer: '最多保留 <strong>50 步</strong>历史。每次变换、查找替换都会记录，可连续点击「撤销」逐步回退，也可「重做」恢复。进行新变换后会清除此前已撤销的分支（标准撤销语义）。',
    },
  ],
```

- [ ] **Step 5: 运行全部单元测试，确认纯函数层未被破坏**

Run: `pnpm test`
Expected: PASS（text-toolbox 全部测试 + 其余既有测试全绿）

- [ ] **Step 6: 生产构建验收（类型检查 + Vue 编译 + 路由生成）**

Run: `pnpm build`
Expected: 构建成功，无 TypeScript 错误；输出含 `/text/text-toolbox/` 页面

- [ ] **Step 7: 人工抽查（可选但推荐）**

Run: `pnpm dev`，浏览器打开 `http://localhost:4321/text/text-toolbox`，验证：
- 预填示例文本，统计实时显示
- 点「大写」「去重」「行升序」连续变换，文本原地改写
- 「撤销」「重做」逐步回退/前进
- 查找替换：普通模式替换、勾选「使用正则」输入 `\d` 替换、输入非法正则 `( ` 看到内联错误
- 「复制」触发 Toast

- [ ] **Step 8: 提交**

```bash
git add src/tools/text/TextToolbox.vue src/pages/text/text-toolbox.astro src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(text): 实现文本处理工具箱并接入路由与注册" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 完成后收尾

- 在 `docs/ROADMAP.md`「六、进度追踪」P2 段，将「文本处理：文本处理工具箱」勾选为已完成，注明日期（2026-06-18）与一句交付摘要。
- 提交 ROADMAP 更新：
  ```bash
  git add docs/ROADMAP.md
  git commit -m "docs: 更新 ROADMAP 文本处理工具箱完成状态" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
  ```
- 通知用户分支 `text-toolbox` 可合并 / 开 PR。
