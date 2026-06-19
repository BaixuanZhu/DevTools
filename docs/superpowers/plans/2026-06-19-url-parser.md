# URL 解析器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 `/encoding/url-encode` 工具迁移并扩展为 `/network/url`，新增 URL 结构化解析与 query 参数编辑能力。

**Architecture:** 新建 `src/utils/network/url.ts` 封装 URL 解析、重建与编解码逻辑；新建 `src/tools/network/UrlTool.vue` 提供居中上中下三层 UI；新建 `src/pages/network/url.astro` 作为新入口；旧 `/encoding/url-encode.astro` 改为 meta 跳转页；更新 `tools.ts` 与 `tool-faqs.ts` 完成注册与 FAQ 迁移。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript + Tailwind CSS v4，无第三方库。

## Global Constraints

- 工具 ID 必须等于 path 末段：`id: 'url'` 对应 `path: '/network/url'`。
- 公共函数/接口必须写 JSDoc/TSDoc 文档注释。
- 错误提示使用中文。
- 复制功能使用 `useCopy` composable；错误时通过 `CustomEvent('toast')` 通知。
- 正则/URL 解析必须包裹 `try-catch`。
- 新增单元测试放在被测模块所在目录的 `__tests__/` 子目录。
- 每个任务结束后执行 `git commit`，message 以 `feat(url-parser):` 或 `refactor(url-parser):` 开头。

---

## Task 1: 创建 URL 工具函数模块

**Files:**
- Create: `src/utils/network/url.ts`
- Test: `src/utils/network/__tests__/url.test.ts`（在 Task 2 中编写）

**Interfaces:**
- Consumes: 无
- Produces:
  - `UrlParsedParts` — URL 结构化解析结果
  - `UrlEncodeResult` / `UrlDecodeResult` — 编解码结果
  - `parseUrl(url: string): UrlParsedParts | null`
  - `encodeUrl(text: string): UrlEncodeResult`
  - `decodeUrl(text: string): UrlDecodeResult`
  - `buildUrlFromParams(baseUrl: string, params: Array<{ key: string; value: string }>): string`

- [ ] **Step 1: 创建 `src/utils/network/url.ts`**

```typescript
/**
 * URL 解析、重建与编解码工具函数
 * 基于浏览器原生 URL API，无第三方依赖
 */

/**
 * URL 结构化解析结果
 */
export interface UrlParsedParts {
  /** 协议，如 `https:` */
  protocol: string;
  /** 主机名 + 端口，如 `example.com:8080` */
  host: string;
  /** 仅主机名，如 `example.com` */
  hostname: string;
  /** 端口字符串，未指定为空字符串 */
  port: string;
  /** 路径，如 `/search` */
  pathname: string;
  /** 查询字符串，含前导 `?` */
  search: string;
  /** 哈希片段，含前导 `#` */
  hash: string;
  /** query 参数列表 */
  params: Array<{ key: string; value: string }>;
}

/**
 * URL 编码结果
 */
export interface UrlEncodeResult {
  /** encodeURIComponent 编码结果（编码所有特殊字符） */
  component: { value: string };
  /** encodeURI 编码结果（保留 URL 结构字符） */
  full: { value: string };
}

/**
 * URL 解码结果
 */
export interface UrlDecodeResult {
  /** decodeURIComponent 解码结果 */
  component: { value: string; error?: string };
  /** decodeURI 解码结果 */
  full: { value: string; error?: string };
}

/**
 * 解析 URL 字符串
 * @param url - 待解析的 URL
 * @returns 解析成功返回结构化对象，失败返回 `null`
 */
export function parseUrl(url: string): UrlParsedParts | null {
  try {
    const parsed = new URL(url);
    const params: Array<{ key: string; value: string }> = [];
    parsed.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return {
      protocol: parsed.protocol,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      params,
    };
  } catch {
    return null;
  }
}

/**
 * URL 编码
 * @param text - 原始文本
 * @returns 包含 component 与 full 两种编码方式的结果
 */
export function encodeUrl(text: string): UrlEncodeResult {
  return {
    component: { value: encodeURIComponent(text) },
    full: { value: encodeURI(text) },
  };
}

/**
 * URL 解码
 * @param text - 编码后的字符串
 * @returns 包含 component 与 full 两种解码方式的结果，分别报告错误
 */
export function decodeUrl(text: string): UrlDecodeResult {
  let componentValue = '';
  let componentError: string | undefined;
  let fullValue = '';
  let fullError: string | undefined;

  try {
    componentValue = decodeURIComponent(text);
  } catch {
    componentError = 'URIComponent 解码失败：输入包含非法的 percent-encoded 序列';
  }

  try {
    fullValue = decodeURI(text);
  } catch {
    fullError = 'URI 解码失败：输入包含非法的 percent-encoded 序列';
  }

  return {
    component: { value: componentValue, error: componentError },
    full: { value: fullValue, error: fullError },
  };
}

/**
 * 使用新的 query 参数重建 URL
 * @param baseUrl - 原始 URL（用于取协议、主机、路径、hash）
 * @param params - 新的 query 参数列表，空 key 会被忽略
 * @returns 重建后的完整 URL；若 baseUrl 非法则原样返回
 */
export function buildUrlFromParams(
  baseUrl: string,
  params: Array<{ key: string; value: string }>,
): string {
  try {
    const url = new URL(baseUrl.trim());
    url.search = '';
    params.forEach(({ key, value }) => {
      if (key.trim() !== '') {
        url.searchParams.append(key, value);
      }
    });
    return url.toString();
  } catch {
    return baseUrl;
  }
}
```

- [ ] **Step 2: 创建目录并确认文件存在**

Run:
```bash
mkdir -p src/utils/network/__tests__
ls src/utils/network/url.ts
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add src/utils/network/url.ts
git commit -m "feat(url-parser): 添加 URL 解析、重建与编解码工具函数

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 编写单元测试

**Files:**
- Create: `src/utils/network/__tests__/url.test.ts`

**Interfaces:**
- Consumes: `parseUrl`, `encodeUrl`, `decodeUrl`, `buildUrlFromParams` from `../url`
- Produces: 无

- [ ] **Step 1: 编写测试文件**

```typescript
import { describe, it, expect } from 'vitest';
import { parseUrl, encodeUrl, decodeUrl, buildUrlFromParams } from '../url';

describe('parseUrl', () => {
  it('解析完整 URL', () => {
    const result = parseUrl('https://example.com:8080/path?a=1&b=2#hash');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('https:');
    expect(result?.host).toBe('example.com:8080');
    expect(result?.hostname).toBe('example.com');
    expect(result?.port).toBe('8080');
    expect(result?.pathname).toBe('/path');
    expect(result?.search).toBe('?a=1&b=2');
    expect(result?.hash).toBe('#hash');
    expect(result?.params).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
  });

  it('解析无端口与 query 的 URL', () => {
    const result = parseUrl('https://example.com/');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('https:');
    expect(result?.host).toBe('example.com');
    expect(result?.hostname).toBe('example.com');
    expect(result?.port).toBe('');
    expect(result?.pathname).toBe('/');
    expect(result?.search).toBe('');
    expect(result?.hash).toBe('');
    expect(result?.params).toEqual([]);
  });

  it('无效 URL 返回 null', () => {
    expect(parseUrl('not a url')).toBeNull();
    expect(parseUrl('')).toBeNull();
  });
});

describe('buildUrlFromParams', () => {
  it('重建 URL 并替换 query', () => {
    const result = buildUrlFromParams('https://example.com/path?old=1', [
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(result).toBe('https://example.com/path?a=1&b=2');
  });

  it('忽略空 key', () => {
    const result = buildUrlFromParams('https://example.com/path', [
      { key: '', value: 'ignored' },
      { key: 'a', value: '1' },
    ]);
    expect(result).toBe('https://example.com/path?a=1');
  });

  it('保留 hash 与路径', () => {
    const result = buildUrlFromParams('https://example.com/path#section', [
      { key: 'x', value: 'y' },
    ]);
    expect(result).toBe('https://example.com/path?x=y#section');
  });

  it('非法 baseUrl 原样返回', () => {
    const result = buildUrlFromParams('not a url', [{ key: 'a', value: '1' }]);
    expect(result).toBe('not a url');
  });
});

describe('encodeUrl', () => {
  it('编码中文 URL', () => {
    const result = encodeUrl('https://example.com/你好?key=中文');
    expect(result.component.value).toBe(
      'https%3A%2F%2Fexample.com%2F%E4%BD%A0%E5%A5%BD%3Fkey%3D%E4%B8%AD%E6%96%87',
    );
    expect(result.full.value).toBe(
      'https://example.com/%E4%BD%A0%E5%A5%BD?key=%E4%B8%AD%E6%96%87',
    );
  });

  it('编码普通字符串', () => {
    const result = encodeUrl('hello world');
    expect(result.component.value).toBe('hello%20world');
    expect(result.full.value).toBe('hello%20world');
  });
});

describe('decodeUrl', () => {
  it('解码 percent-encoded 字符串', () => {
    const result = decodeUrl('https%3A%2F%2Fexample.com');
    expect(result.component.value).toBe('https://example.com');
    expect(result.full.value).toBe('https%3A%2F%2Fexample.com');
    expect(result.component.error).toBeUndefined();
    expect(result.full.error).toBeUndefined();
  });

  it('component 解码失败时返回错误', () => {
    const result = decodeUrl('%E0%A4%A');
    expect(result.component.value).toBe('');
    expect(result.component.error).toContain('URIComponent 解码失败');
  });
});
```

- [ ] **Step 2: 运行测试**

Run:
```bash
pnpm test src/utils/network/__tests__/url.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/utils/network/__tests__/url.test.ts
git commit -m "test(url-parser): 添加 URL 工具函数单元测试

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 创建 Vue 组件

**Files:**
- Create: `src/tools/network/UrlTool.vue`

**Interfaces:**
- Consumes:
  - `parseUrl`, `encodeUrl`, `decodeUrl`, `buildUrlFromParams`, `UrlParsedParts`, `UrlEncodeResult`, `UrlDecodeResult` from `../../utils/network/url`
  - `ToolHeader` from `../../components/layout/ToolHeader.vue`
  - `CopyButton` from `../../components/ui/CopyButton.vue`
  - `ClearButton` from `../../components/ui/ClearButton.vue`
- Produces: 无（Astro 页面直接渲染此组件）

- [ ] **Step 1: 创建 `src/tools/network/UrlTool.vue`**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseUrl,
  encodeUrl,
  decodeUrl,
  buildUrlFromParams,
  type UrlParsedParts,
  type UrlEncodeResult,
  type UrlDecodeResult,
} from '../../utils/network/url';

/** 默认示例 URL */
const DEFAULT_INPUT = 'https://example.com/search?q=你好世界&lang=zh-CN';

/** Primary 按钮 class */
const BTN_PRIMARY_CLASS =
  'px-4 py-2 border border-accent rounded-sm bg-accent text-white text-[0.8125rem] cursor-pointer transition-[opacity] duration-150 hover:opacity-90';

/** 次要按钮 class */
const BTN_SECONDARY_CLASS =
  'px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent';

const input = ref(DEFAULT_INPUT);
const parsed = ref<UrlParsedParts | null>(parseUrl(DEFAULT_INPUT));
const params = ref<Array<{ key: string; value: string }>>(parsed.value?.params ?? []);
const parseError = ref('');
const encodeResult = ref<UrlEncodeResult | null>(null);
const decodeResult = ref<UrlDecodeResult | null>(null);

// 输入变化时自动解析
watch(input, (val) => {
  const trimmed = val.trim();
  if (!trimmed) {
    parsed.value = null;
    params.value = [];
    parseError.value = '';
    return;
  }
  const result = parseUrl(trimmed);
  if (result) {
    parsed.value = result;
    params.value = result.params.map((p) => ({ ...p }));
    parseError.value = '';
  } else {
    parsed.value = null;
    params.value = [];
    parseError.value = '无法解析为合法 URL，请检查协议和格式';
  }
});

/** 编码当前输入 */
function handleEncode() {
  if (!input.value.trim()) return;
  decodeResult.value = null;
  encodeResult.value = encodeUrl(input.value);
}

/** 解码当前输入 */
function handleDecode() {
  if (!input.value.trim()) return;
  encodeResult.value = null;
  decodeResult.value = decodeUrl(input.value);
}

/** 清空所有状态 */
function handleClear() {
  input.value = '';
  parsed.value = null;
  params.value = [];
  parseError.value = '';
  encodeResult.value = null;
  decodeResult.value = null;
}

/** 新增 query 参数 */
function addParam() {
  params.value.push({ key: '', value: '' });
}

/** 删除指定 query 参数 */
function removeParam(index: number) {
  params.value.splice(index, 1);
}

/** 将当前 query 参数表应用回输入 URL */
function applyParams() {
  if (!input.value.trim() || !parsed.value) return;
  input.value = buildUrlFromParams(input.value, params.value);
}
</script>

<template>
  <div class="w-full max-w-3xl">
    <ToolHeader
      title="URL 解析器"
      description="URL 编解码与结构化解析，支持 query 参数表格化编辑与一键重建 URL"
      :show-example="false"
    />

    <!-- 输入层 -->
    <div class="mb-4">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1.5">URL</label>
      <div class="flex items-start gap-3">
        <textarea
          v-model="input"
          rows="2"
          placeholder="输入 URL，如 https://example.com/search?q=test"
          class="flex-1 px-4 py-2.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 placeholder:font-sans outline-none transition-[border-color] duration-150 focus:border-accent resize-none"
        ></textarea>
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 编解码层 -->
    <div class="mb-5 p-4 border border-border rounded-sm bg-card">
      <div class="flex items-center gap-2 mb-3">
        <button type="button" :class="BTN_SECONDARY_CLASS" @click="handleEncode">编码</button>
        <button type="button" :class="BTN_SECONDARY_CLASS" @click="handleDecode">解码</button>
      </div>

      <div v-if="encodeResult" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">encodeURIComponent</span>
            <CopyButton :text="encodeResult.component.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ encodeResult.component.value }}</code>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">encodeURI</span>
            <CopyButton :text="encodeResult.full.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ encodeResult.full.value }}</code>
        </div>
      </div>

      <div v-if="decodeResult" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">decodeURIComponent</span>
            <CopyButton :text="decodeResult.component.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ decodeResult.component.value }}</code>
          <p v-if="decodeResult.component.error" class="text-error text-[0.75rem] m-0">{{ decodeResult.component.error }}</p>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">decodeURI</span>
            <CopyButton :text="decodeResult.full.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ decodeResult.full.value }}</code>
          <p v-if="decodeResult.full.error" class="text-error text-[0.75rem] m-0">{{ decodeResult.full.error }}</p>
        </div>
      </div>
    </div>

    <!-- 结构化解析层 -->
    <div class="p-4 border border-border rounded-sm bg-card">
      <h3 class="text-[0.8125rem] text-muted font-medium mb-3">结构化解析</h3>

      <p v-if="parseError" class="text-error text-[0.8125rem] m-0 mb-3">{{ parseError }}</p>

      <div v-if="parsed" class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div
            v-for="item in [
              { label: 'Protocol', value: parsed.protocol },
              { label: 'Host', value: parsed.host },
              { label: 'Hostname', value: parsed.hostname },
              { label: 'Port', value: parsed.port || '-' },
              { label: 'Pathname', value: parsed.pathname },
              { label: 'Search', value: parsed.search || '-' },
              { label: 'Hash', value: parsed.hash || '-' },
            ]"
            :key="item.label"
            class="flex flex-col gap-1 px-3 py-2 border border-border rounded-sm bg-surface"
          >
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
            <div class="flex items-center gap-2">
              <code class="text-xs text-text font-mono break-all flex-1">{{ item.value }}</code>
              <CopyButton v-if="item.value !== '-'" :text="item.value" size="sm" />
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-[0.75rem] font-semibold text-muted uppercase tracking-wide">Query 参数</h4>
            <button type="button" :class="BTN_SECONDARY_CLASS" @click="addParam">+ 添加</button>
          </div>

          <div v-if="params.length === 0" class="text-[0.8125rem] text-muted">暂无 query 参数</div>

          <div v-else class="flex flex-col gap-2">
            <div v-for="(_, index) in params" :key="index" class="flex items-center gap-2">
              <input
                v-model="params[index].key"
                type="text"
                placeholder="key"
                class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 outline-none focus:border-accent"
              />
              <input
                v-model="params[index].value"
                type="text"
                placeholder="value"
                class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 outline-none focus:border-accent"
              />
              <button
                type="button"
                class="px-2 py-1.5 text-[0.75rem] rounded-sm border border-border bg-card text-error hover:bg-hover transition-colors"
                @click="removeParam(index)"
              >
                删除
              </button>
            </div>
          </div>

          <button
            v-if="params.length > 0"
            type="button"
            :class="[BTN_PRIMARY_CLASS, 'mt-3']"
            @click="applyParams"
          >
            应用至 URL
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 验证 Vue 单文件语法**

Run:
```bash
pnpm exec vue-tsc --noEmit src/tools/network/UrlTool.vue
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/network/UrlTool.vue
git commit -m "feat(url-parser): 添加 URL 解析器 Vue 组件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 创建新 Astro 页面

**Files:**
- Create: `src/pages/network/url.astro`

**Interfaces:**
- Consumes: `UrlTool` from `../../tools/network/UrlTool.vue`
- Produces: `/network/url` 页面

- [ ] **Step 1: 创建 `src/pages/network/url.astro`**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import UrlTool from '../../tools/network/UrlTool.vue';
---

<ToolLayout toolId="network/url">
  <UrlTool client:idle />
</ToolLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/network/url.astro
git commit -m "feat(url-parser): 添加 /network/url 页面

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 旧页面改为跳转页

**Files:**
- Modify: `src/pages/encoding/url-encode.astro`

**Interfaces:**
- Consumes: 无
- Produces: `/encoding/url-encode` 跳转页

- [ ] **Step 1: 替换旧页面内容为跳转页**

```astro
---
const destination = '/network/url';
---

<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <meta http-equiv="refresh" content={`0;url=${destination}`} />
    <link rel="canonical" href={destination} />
    <title>URL 解析器 - DevTools</title>
  </head>
  <body>
    <p>此页面已迁移至 <a href={destination}>{destination}</a></p>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/encoding/url-encode.astro
git commit -m "refactor(url-parser): 旧 /encoding/url-encode 页面改为跳转至 /network/url

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 更新工具注册表与 FAQ

**Files:**
- Modify: `src/data/tools.ts`
- Modify: `src/data/tool-faqs.ts`

**Interfaces:**
- Consumes: 无
- Produces: 更新后的工具注册信息与 FAQ

- [ ] **Step 1: 在 `src/data/tools.ts` 中删除旧条目并添加新条目**

找到并删除以下条目（约在 126–136 行）：

```typescript
  {
    id: 'url-encode',
    name: 'URL 编解码',
    description: 'URL 编码与解码，支持组件级和完整 URL 编码',
    seoDescription: '在线 URL 编解码工具，支持 encodeURI 与 encodeURIComponent 两种模式，批量处理 URL 编码与解码，纯浏览器端运算。',
    category: '编码转换',
    icon: '🔗',
    path: '/encoding/url-encode',
    keywords: ['url 编码', 'url 解码', 'urlencode 在线', 'urldecode 在线', 'uri 编码', '中文 url 编码'],
    relatedToolIds: ['base64', 'jwt-parser'],
  },
```

在 `network` 分类区域（`ipv4-range-expander` 之后）新增：

```typescript
  {
    id: 'url',
    name: 'URL 解析器',
    description: 'URL 编解码与结构化解析，支持 query 参数表格化编辑与一键重建 URL',
    seoDescription: '免费在线 URL 解析器，支持 URL 编码/解码、结构化拆解 protocol/host/path/query/hash，以及 query 参数表格化编辑与一键重建 URL，纯浏览器端运算数据不上传。',
    category: '网络工具',
    icon: '🔗',
    path: '/network/url',
    keywords: ['url 解析', 'url 编码', 'url 解码', 'query 参数编辑', 'url 参数解析', 'urlencode', 'urldecode', 'uri 解析'],
    relatedToolIds: ['ipv4-cidr', 'ipv6-cidr', 'http-status-codes', 'device-info'],
  },
```

- [ ] **Step 2: 替换所有 `relatedToolIds` 中的 `'url-encode'` 为 `'url'`**

涉及位置（根据当前代码）：
- `base64` 条目的 `relatedToolIds`: `['url-encode', 'base64-to-image', ...]` → `['url', 'base64-to-image', ...]`
- `tester` 条目的 `relatedToolIds`: `['json-formatter', 'json-to-ts', 'url-encode', 'base64']` → `['json-formatter', 'json-to-ts', 'url', 'base64']`

- [ ] **Step 3: 更新 `src/data/tool-faqs.ts`**

将 key 为 `'url-encode'` 的条目改为 `'url'`，并更新/新增 FAQ：

```typescript
  url: [
    {
      question: 'encodeURI 和 encodeURIComponent 有什么区别？',
      answer: '<code>encodeURI</code> 用于编码完整 URL，不会编码 <code>:/?#[]@!$&\'()*+,;=</code> 等 URL 保留字符。<code>encodeURIComponent</code> 用于编码 URL 参数值，会编码所有特殊字符。一般规则：编码整体 URL 用前者，编码参数值用后者。',
    },
    {
      question: 'URL 解析器如何编辑 query 参数？',
      answer: '在「结构化解析」区域的 Query 参数表格中，可直接修改已有参数的 key/value，或点击「+ 添加」新增参数、点击「删除」移除参数。修改完成后点击「应用至 URL」，工具会按当前表格重新拼装 query 并更新输入框中的 URL。',
    },
    {
      question: '为什么访问 /encoding/url-encode 会跳转到新页面？',
      answer: 'URL 工具已从「编码转换」分类迁移到更合适的「网络工具」分类，新地址为 <code>/network/url</code>。旧地址保留自动跳转，以便收藏夹和外部链接仍可正常访问。',
    },
  ],
```

- [ ] **Step 4: Commit**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts
git commit -m "refactor(url-parser): 迁移 URL 工具注册与 FAQ 到 /network/url

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 构建与验证

**Files:**
- 无新增/修改

- [ ] **Step 1: 运行类型检查**

```bash
pnpm exec vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: 运行单元测试**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: 运行生产构建**

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 4: 本地验证关键路径**

```bash
pnpm preview
```

打开浏览器验证：
1. `/network/url` 正常渲染，默认 URL 被解析。
2. 修改输入框 URL，结构化解析实时更新。
3. 点击「编码」「解码」显示对应结果。
4. 修改 query 参数后点击「应用至 URL」，输入框 URL 更新。
5. `/encoding/url-encode` 自动跳转至 `/network/url`。
6. 侧边栏「网络工具」分类下出现「URL 解析器」，「编码转换」分类下不再出现「URL 编解码」。

- [ ] **Step 5: 最终提交（如有改动）**

如果验证过程中有修复，单独 commit：

```bash
git add .
git commit -m "fix(url-parser): 验证修复

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Spec Coverage Checklist

| Spec 要求 | 对应任务 |
|-----------|---------|
| 新页面 `/network/url` | Task 4 |
| 旧页面 `/encoding/url-encode` 跳转 | Task 5 |
| `tools.ts` 迁移条目与 relatedToolIds | Task 6 |
| `tool-faqs.ts` key 更新与新增 FAQ | Task 6 |
| 居中上中下三层布局 | Task 3 |
| 输入自动解析 | Task 3 |
| 编解码按钮触发 | Task 3 |
| query 参数表格 + 手动应用 | Task 3 |
| 公共函数文档注释 | Task 1 |
| 单元测试 | Task 2 |
| 构建/自测 | Task 7 |

## Notes

- 旧组件 `src/tools/encoding/UrlEncodeCodec.vue` 与旧工具函数 `src/utils/encoding/url-codec.ts` 在迁移后不再被引用，但为避免破坏外部硬引用，本计划不删除它们；可在后续清理周期中移除。
- `ToolLayout` 会自动读取 `tools.ts` 中的 SEO 字段生成 `<title>` 与 meta 标签，因此 Astro 页面无需额外写 SEO。
