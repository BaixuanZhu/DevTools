# 三级导航 + 分类合并 + 移除收藏 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将侧边栏全展开工具列表重构为「首页分类卡片 → 分类页工具网格 → 工具页」三级导航，合并 12→7 分类，并全量移除收藏功能。

**Architecture:** 数据层（`tools.ts` 分类收敛 + 新建 `categories.ts`）为单一数据源；路由层迁移 15 个工具的 `.astro`/`.vue` 文件到新分类目录；新增动态分类页 `[category]/index.astro`；首页改为分类卡片网格 + 搜索下拉直达；侧边栏瘦身为仅分类；收藏相关文件/store/测试全删；301 重定向兜底旧 URL；sitemap filter 白名单修复。

**Tech Stack:** Astro 6 + Vue 3（`<script setup lang="ts">`）+ Tailwind CSS v4 + Vitest（happy-dom / node 双环境）+ @vue/test-utils。

## Global Constraints

- **Node >=22.12.0，包管理器 pnpm**；测试 `pnpm test`，类型检查 `pnpm astro check`，构建 `pnpm build`。
- **无路径别名**：所有 import 用相对路径（如 `../../data/tools`）。
- **Tailwind v4 间距规范**：4px 基准标准类名（`p-6`/`gap-4`/`w-60`），禁止 `w-[120px]` 这类可标准化的任意值；设计 token 排印尺寸（`text-[0.8125rem]`）与特殊阴影（`shadow-[0_2px_8px_rgba(0,0,0,0.06)]`）允许任意值。
- **中文 JSDoc/TSDoc**：新增/修改公共类型、函数、组件必须写文档注释。
- **铁律：`tool.id` 必须等于 `tool.path` 末段**，否则 FAQ/相关工具/SEO 结构化数据静默失效。
- **主域名固定 `https://tools.baixuanz.cn`**（`Astro.site` 已配置）。
- **Vue 组件相对 import 层级**：`src/tools/{cat}/{Tool}.vue` 内的 `../../` 恒指向 `src/`，跨分类目录迁移时层级不变，`.vue` 文件内容无需改动。

---

## Spec 偏差与澄清（务必先读）

定稿 spec `docs/superpowers/specs/2026-07-22-navigation-redesign-design.md`（commit `5c8d3eb`）有两处与代码现状不符，本计划已按代码真相修正：

1. **url-encode 不是迁移目标，是废弃对象**。`src/pages/encoding/url-encode.astro` 本身就是 meta-refresh 重定向页（跳转到 `/network/url`），`src/tools/encoding/UrlEncodeCodec.vue` 是孤儿组件，URL 编解码功能早已并入 `url` 工具（`/network/url`，`UrlTool.vue`）。`tools.ts` 实际注册 **48 个**工具，spec §3.1 计数的 49 / text=13 多算了这一个。本计划将 url-encode 作为废弃处理（删孤儿页+组件，根级重定向直指 `/network/url`），**实际迁移 15 个工具**，合并后 text 分类 = 12 个、总数 = 48。
2. **分类重命名影响全部 48 个工具的 `category` 字段**（不只是 15 个迁移工具）。spec §3.1 把 `加密哈希`→`加密与安全`、`文本处理`/`编码转换`/`正则工具`→`文本与编码`、`格式化`→`格式化与转换`、`DevOps 工具`/`编辑器`→`开发与运维`、`CSS 工具`/`颜色工具`/`媒体工具`→`前端与媒体`，仅 `网络工具`/`日期时间` 两个分类名不变。故 39 个工具的 `category` 值需改名，9 个不变。

3. **sitemap filter 必须同时排除两段重定向页**。spec §10 的 filter 对多段路径 `return true`，但 `astro.config.mjs` 的 `redirects`（Task 2）会生成 15 个两段重定向页（`/encoding/base64` 等），其首段是旧分类 slug，会被错误收入 sitemap。本计划把 filter 统一为「首段必须 ∈ 7 个分类 slug」，同时排除单段旧扁平重定向与两段 redirects 重定向页（见 Task 7）。

---

## File Structure

**新建：**
- `src/data/categories.ts` — 分类级元数据（7 条 `CategoryMeta`），首页卡片/分类页/sitemap 白名单共用。
- `src/data/__tests__/categories.test.ts` — categories 一致性测试。
- `src/data/__tests__/tools.test.ts` — 分类与路径一致性回归守卫。
- `src/pages/[category]/index.astro` — 动态分类页（7 个静态输出）。
- `src/components/layout/CategoryCard.astro` — 首页分类卡片（纯展示、零 JS）。

**迁移（15 工具，`git mv`，`.vue` 内容不改）：**
- `src/pages/{encoding,regex,css,color,media,editor}/*.astro` → `src/pages/{text,frontend,devops}/*.astro`
- `src/tools/{encoding,regex,css,color,media,editor}/*.vue` → `src/tools/{text,frontend,devops}/*.vue`
- `src/tools/editor/__tests__/MarkdownEditor.test.ts` → `src/tools/devops/__tests__/`

**修改：**
- `src/data/tools.ts` — `ToolCategory` 收敛 7 字面量、`categorySlugMap` 收敛 7 条、39 个工具 `category` 改名、15 个工具 `path` 改。
- `src/layouts/ToolLayout.astro` — 新增可选 `breadcrumb` prop。
- `src/pages/index.astro` — 主体改分类卡片网格，JSON-LD 改 `CollectionPage`。
- `src/components/shell/SearchPanel.vue` — 从 DOM 过滤改为下拉建议直达。
- `src/components/shell/Shell.vue` — 侧边栏瘦身为仅分类 + 删 Header 收藏入口。
- `src/components/layout/ToolCard.astro` — 移除 `FavoriteButton`。
- `src/pages/[slug].astro` — 4 条重定向更新。
- `astro.config.mjs` — `redirects` 配置 + sitemap filter 白名单 + serialize 分类页 priority。
- `src/pages/llms.txt.ts` — 描述文案同步新分类（数据自动派生）。
- `PRODUCT.md` / `DESIGN.md` / `CLAUDE.md` — 分类表、侧边栏/Header 描述、CategoryCard 矩阵同步。
- `src/components/shell/__tests__/SearchPanel.test.ts` / `Shell.test.ts` — 适配新行为。

**删除：**
- `src/pages/encoding/url-encode.astro`、`src/tools/encoding/UrlEncodeCodec.vue`（url-encode 废弃孤儿）。
- `src/components/shell/FavoriteButton.vue`、`src/components/shell/FavoritesList.vue`、`src/stores/favorites.ts`、`src/pages/favorites.astro`。
- `src/stores/__tests__/favorites.test.ts`、`src/components/shell/__tests__/FavoriteButton.test.ts`、`src/components/shell/__tests__/FavoritesList.test.ts`。

---

## Task 1: 数据层 — `tools.ts` 分类收敛 + 新建 `categories.ts` + url-encode 废弃

**Files:**
- Modify: `src/data/tools.ts`
- Create: `src/data/categories.ts`
- Create: `src/data/__tests__/categories.test.ts`
- Create: `src/data/__tests__/tools.test.ts`
- Delete: `src/pages/encoding/url-encode.astro`、`src/tools/encoding/UrlEncodeCodec.vue`
- Modify: `src/pages/[slug].astro`（仅 url-encode 一行）

**Interfaces:**
- Produces: `CategoryMeta`（`src/data/categories.ts`）、`categories: CategoryMeta[]`、收敛后的 `ToolCategory` / `categorySlugMap`。

- [ ] **Step 1: 写失败测试 `src/data/__tests__/categories.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { categories } from '../categories';
import { categorySlugMap, type ToolCategory } from '../tools';

describe('categories.ts', () => {
  it('恰好 7 个分类', () => {
    expect(categories).toHaveLength(7);
  });

  it('slug 唯一且每条与 categorySlugMap 值一致', () => {
    const slugs = categories.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const validSlugs = Object.values(categorySlugMap);
    for (const c of categories) {
      expect(validSlugs).toContain(c.slug);
    }
  });

  it('每条 name 是合法 ToolCategory 且 description/icon 非空', () => {
    const validNames = Object.keys(categorySlugMap) as ToolCategory[];
    for (const c of categories) {
      expect(validNames).toContain(c.name);
      expect(c.description.trim().length).toBeGreaterThan(0);
      expect(c.icon.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 写失败测试 `src/data/__tests__/tools.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tools, categorySlugMap, type ToolCategory } from '../tools';

const validSlugs = new Set(Object.values(categorySlugMap));
const validCategories = new Set(Object.keys(categorySlugMap) as ToolCategory[]);

describe('tools.ts 分类与路径一致性', () => {
  it('每个 tool.path 第一段 ∈ categorySlugMap 的 slug 集合', () => {
    for (const t of tools) {
      const seg = t.path.split('/')[1];
      expect(validSlugs.has(seg), `${t.id} path 首段 ${seg} 非法`).toBe(true);
    }
  });

  it('每个 tool.category ∈ 7 个新分类', () => {
    for (const t of tools) {
      expect(validCategories.has(t.category), `${t.id} category ${t.category} 非法`).toBe(true);
    }
  });

  it('tool.path 首段与 category 经 categorySlugMap 一致', () => {
    for (const t of tools) {
      const prefix = `/${categorySlugMap[t.category]}/`;
      expect(t.path.startsWith(prefix), `${t.id} path 与 category 不一致`).toBe(true);
    }
  });

  it('tool.id === tool.path 末段', () => {
    for (const t of tools) {
      expect(t.path.endsWith(`/${t.id}`), `${t.id} path 末段不符`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test src/data/__tests__/categories.test.ts src/data/__tests__/tools.test.ts`
Expected: FAIL（`categories` 不存在；现有 13 分类与 path 不一致）。

- [ ] **Step 4: 改 `src/data/tools.ts` 的 `ToolCategory` 与 `categorySlugMap`（替换文件第 1-32 行）**

```ts
/** 工具分类 */
export type ToolCategory =
  | '文本与编码'
  | '加密与安全'
  | '格式化与转换'
  | '网络工具'
  | '日期时间'
  | '前端与媒体'
  | '开发与运维';

/** 分类 slug 映射（中 → 英） */
export const categorySlugMap: Record<ToolCategory, string> = {
  '文本与编码': 'text',
  '加密与安全': 'crypto',
  '格式化与转换': 'format',
  '网络工具': 'network',
  '日期时间': 'datetime',
  '前端与媒体': 'frontend',
  '开发与运维': 'devops',
};
```

- [ ] **Step 5: 改 `tools` 数组中每个工具的 `category` 字段（39 处重命名）**

按以下旧→新映射，对 `tools` 数组中**每个**工具对象的 `category` 值做替换（`网络工具`/`日期时间` 不变，无需动）：

| 旧 category | 新 category |
|---|---|
| `'文本处理'` | `'文本与编码'` |
| `'编码转换'` | `'文本与编码'` |
| `'正则工具'` | `'文本与编码'` |
| `'加密哈希'` | `'加密与安全'` |
| `'格式化'` | `'格式化与转换'` |
| `'CSS 工具'` | `'前端与媒体'` |
| `'颜色工具'` | `'前端与媒体'` |
| `'媒体工具'` | `'前端与媒体'` |
| `'编辑器'` | `'开发与运维'` |
| `'DevOps 工具'` | `'开发与运维'` |

> 用 IDE 的 search-replace 或逐条 Edit。注意：`'API 工具'` 无工具条目，无需处理。

- [ ] **Step 6: 改 15 个迁移工具的 `path` 字段（仅这 15 个）**

| id | 旧 path | 新 path |
|---|---|---|
| `base64` | `/encoding/base64` | `/text/base64` |
| `jwt-parser` | `/encoding/jwt-parser` | `/text/jwt-parser` |
| `base64-to-image` | `/encoding/base64-to-image` | `/text/base64-to-image` |
| `base64-to-file` | `/encoding/base64-to-file` | `/text/base64-to-file` |
| `file-to-base64` | `/encoding/file-to-base64` | `/text/file-to-base64` |
| `tester` | `/regex/tester` | `/text/tester` |
| `unit-converter` | `/css/unit-converter` | `/frontend/unit-converter` |
| `gradient` | `/css/gradient` | `/frontend/gradient` |
| `panel` | `/color/panel` | `/frontend/panel` |
| `qr-code-generator` | `/media/qr-code-generator` | `/frontend/qr-code-generator` |
| `qr-code-reader` | `/media/qr-code-reader` | `/frontend/qr-code-reader` |
| `image-converter` | `/media/image-converter` | `/frontend/image-converter` |
| `image-scrambler` | `/media/image-scrambler` | `/frontend/image-scrambler` |
| `phantom-tank` | `/media/phantom-tank` | `/frontend/phantom-tank` |
| `markdown-editor` | `/editor/markdown-editor` | `/devops/markdown-editor` |

- [ ] **Step 7: 新建 `src/data/categories.ts`**

```ts
import type { ToolCategory } from './tools';

/** 分类级元数据（描述用于卡片与分类页 SEO；icon 为 emoji） */
export interface CategoryMeta {
  /** 中文分类名（与 ToolCategory 一致） */
  name: ToolCategory;
  /** 分类 slug（与 categorySlugMap 值一致） */
  slug: string;
  /** 卡片/SEO 用一句话描述 */
  description: string;
  /** 分类代表图标（emoji） */
  icon: string;
}

/** 全部分类元数据（顺序为首页/侧边栏展示顺序） */
export const categories: CategoryMeta[] = [
  {
    name: '文本与编码',
    slug: 'text',
    icon: '🔤',
    description: '文本处理、大小写/去重/字数、Base64/JWT/URL 编解码、正则与随机数据生成',
  },
  {
    name: '加密与安全',
    slug: 'crypto',
    icon: '🔒',
    description: 'MD5/SHA 哈希与 HMAC、AES/RSA/SM 国密对称与非对称加解密',
  },
  {
    name: '格式化与转换',
    slug: 'format',
    icon: '📋',
    description: 'JSON 美化压缩、差异对比、TOML/YAML/XML/TypeScript 互转',
  },
  {
    name: '网络工具',
    slug: 'network',
    icon: '🌐',
    description: 'URL 解析、HTTP 状态码、IPv4/IPv6 子网计算与设备信息',
  },
  {
    name: '日期时间',
    slug: 'datetime',
    icon: '🕐',
    description: '时间戳转换、Cron 表达式解析与时间差计算',
  },
  {
    name: '前端与媒体',
    slug: 'frontend',
    icon: '🎨',
    description: 'CSS 单位换算、渐变与颜色面板、图片转换压缩与二维码',
  },
  {
    name: '开发与运维',
    slug: 'devops',
    icon: '🐳',
    description: 'Docker/Env 配置转换、Meta/robots/sitemap 生成与 Markdown 编辑器',
  },
];
```

- [ ] **Step 8: 运行数据层测试确认通过**

Run: `pnpm test src/data/__tests__/categories.test.ts src/data/__tests__/tools.test.ts`
Expected: PASS（48 个工具分类/路径全部一致）。

- [ ] **Step 9: 删除 url-encode 废弃孤儿**

Run:
```bash
git rm src/pages/encoding/url-encode.astro src/tools/encoding/UrlEncodeCodec.vue
```

- [ ] **Step 10: 更新 `src/pages/[slug].astro` 的 url-encode 重定向（消除双重跳转）**

将第 10 行 `    'url-encode': '/encoding/url-encode',` 改为：
```ts
    'url-encode': '/network/url',
```

> `base64`/`jwt-parser` 两行目标更新推迟到 Task 6（其新路径 `/text/*` 的 `.astro` 页面在 Task 2 迁移后才存在）。`favorites` 行也在 Task 6 加。

- [ ] **Step 11: 运行类型检查**

Run: `pnpm astro check`
Expected: 无错误（`getToolBySlug` 按 id 查找，旧 `.astro` 的 `toolId="encoding/base64"` 仍能解析到工具；面包屑 `slugCategoryMap['encoding']` 回退为 slug 字符串，不报错）。

- [ ] **Step 12: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(data): 分类合并 12→7 + categories.ts + url-encode 废弃

- ToolCategory/categorySlugMap 收敛为 7 个分类（文本与编码/加密与安全/格式化与转换/网络工具/日期时间/前端与媒体/开发与运维）
- 39 个工具 category 改名、15 个工具 path 改新 slug
- 新建 categories.ts（7 条 CategoryMeta，首页/分类页/sitemap 共用）
- 新增 categories.test.ts + tools.test.ts 一致性守卫
- 删除 url-encode 重定向孤儿页与 UrlEncodeCodec 孤儿组件，根级重定向直指 /network/url

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 路由迁移 — 15 工具 `.astro` + `.vue` + 测试 + `redirects` 配置

**Files:**
- Move: 15 个 `src/pages/{old}/*.astro` → `src/pages/{new}/*.astro`
- Move: 15 个 `src/tools/{old}/*.vue` → `src/tools/{new}/*.vue`
- Move: `src/tools/editor/__tests__/MarkdownEditor.test.ts` → `src/tools/devops/__tests__/MarkdownEditor.test.ts`
- Modify: 15 个迁移后 `.astro` 的 import 路径与 `toolId`
- Modify: `astro.config.mjs`（新增 `redirects`）

**Interfaces:**
- Consumes: Task 1 的新 `path`（`tools.ts`）。
- Produces: 15 个新位置工具页；旧位置由 `astro.config.mjs` 的 `redirects` 兜底重定向。

> **关键：`.vue` 组件相对 import 层级（`../../`）迁移后不变，文件内容一字不改，仅 `git mv`。** 只有 `.astro` 外壳需改 import 路径和 `toolId`。

- [ ] **Step 1: 迁移 15 个 `.astro` 路由壳（git mv）**

Run:
```bash
git mv src/pages/encoding/base64.astro            src/pages/text/base64.astro
git mv src/pages/encoding/jwt-parser.astro        src/pages/text/jwt-parser.astro
git mv src/pages/encoding/base64-to-image.astro   src/pages/text/base64-to-image.astro
git mv src/pages/encoding/base64-to-file.astro    src/pages/text/base64-to-file.astro
git mv src/pages/encoding/file-to-base64.astro    src/pages/text/file-to-base64.astro
git mv src/pages/regex/tester.astro               src/pages/text/tester.astro
git mv src/pages/css/unit-converter.astro         src/pages/frontend/unit-converter.astro
git mv src/pages/css/gradient.astro               src/pages/frontend/gradient.astro
git mv src/pages/color/panel.astro                src/pages/frontend/panel.astro
git mv src/pages/media/qr-code-generator.astro    src/pages/frontend/qr-code-generator.astro
git mv src/pages/media/qr-code-reader.astro       src/pages/frontend/qr-code-reader.astro
git mv src/pages/media/image-converter.astro      src/pages/frontend/image-converter.astro
git mv src/pages/media/image-scrambler.astro      src/pages/frontend/image-scrambler.astro
git mv src/pages/media/phantom-tank.astro         src/pages/frontend/phantom-tank.astro
git mv src/pages/editor/markdown-editor.astro     src/pages/devops/markdown-editor.astro
```

- [ ] **Step 2: 迁移 15 个 `.vue` 组件（git mv，内容不改）**

Run:
```bash
git mv src/tools/encoding/Base64Codec.vue         src/tools/text/Base64Codec.vue
git mv src/tools/encoding/JwtParser.vue           src/tools/text/JwtParser.vue
git mv src/tools/encoding/Base64ToImage.vue       src/tools/text/Base64ToImage.vue
git mv src/tools/encoding/Base64ToFile.vue        src/tools/text/Base64ToFile.vue
git mv src/tools/encoding/FileToBase64.vue        src/tools/text/FileToBase64.vue
git mv src/tools/regex/RegexTester.vue            src/tools/text/RegexTester.vue
git mv src/tools/css/CssUnitConverter.vue         src/tools/frontend/CssUnitConverter.vue
git mv src/tools/css/CssGradientGenerator.vue     src/tools/frontend/CssGradientGenerator.vue
git mv src/tools/color/ColorPanel.vue             src/tools/frontend/ColorPanel.vue
git mv src/tools/media/QrCodeGenerator.vue        src/tools/frontend/QrCodeGenerator.vue
git mv src/tools/media/QrCodeReader.vue           src/tools/frontend/QrCodeReader.vue
git mv src/tools/media/ImageConverter.vue         src/tools/frontend/ImageConverter.vue
git mv src/tools/media/ImageScrambler.vue         src/tools/frontend/ImageScrambler.vue
git mv src/tools/media/PhantomTank.vue            src/tools/frontend/PhantomTank.vue
git mv src/tools/editor/MarkdownEditor.vue        src/tools/devops/MarkdownEditor.vue
```

- [ ] **Step 3: 迁移 MarkdownEditor 测试（git mv，内容不改）**

Run:
```bash
git mv src/tools/editor/__tests__/MarkdownEditor.test.ts src/tools/devops/__tests__/MarkdownEditor.test.ts
```

- [ ] **Step 4: 修改 15 个迁移后 `.astro` 的 import 路径与 `toolId`**

对每个文件，按"新 import 路径 + 新 toolId"两处改动。完整映射（每行：文件 → 新 import → 新 toolId）：

| 文件 | 新 import 语句 | 新 toolId |
|---|---|---|
| `src/pages/text/base64.astro` | `import Base64Codec from '../../tools/text/Base64Codec.vue';` | `text/base64` |
| `src/pages/text/jwt-parser.astro` | `import JwtParser from '../../tools/text/JwtParser.vue';` | `text/jwt-parser` |
| `src/pages/text/base64-to-image.astro` | `import Base64ToImage from '../../tools/text/Base64ToImage.vue';` | `text/base64-to-image` |
| `src/pages/text/base64-to-file.astro` | `import Base64ToFile from '../../tools/text/Base64ToFile.vue';` | `text/base64-to-file` |
| `src/pages/text/file-to-base64.astro` | `import FileToBase64 from '../../tools/text/FileToBase64.vue';` | `text/file-to-base64` |
| `src/pages/text/tester.astro` | `import RegexTester from '../../tools/text/RegexTester.vue';` | `text/tester` |
| `src/pages/frontend/unit-converter.astro` | `import CssUnitConverter from '../../tools/frontend/CssUnitConverter.vue';` | `frontend/unit-converter` |
| `src/pages/frontend/gradient.astro` | `import CssGradientGenerator from '../../tools/frontend/CssGradientGenerator.vue';` | `frontend/gradient` |
| `src/pages/frontend/panel.astro` | `import ColorPanel from '../../tools/frontend/ColorPanel.vue';` | `frontend/panel` |
| `src/pages/frontend/qr-code-generator.astro` | `import QrCodeGenerator from '../../tools/frontend/QrCodeGenerator.vue';` | `frontend/qr-code-generator` |
| `src/pages/frontend/qr-code-reader.astro` | `import QrCodeReader from '../../tools/frontend/QrCodeReader.vue';` | `frontend/qr-code-reader` |
| `src/pages/frontend/image-converter.astro` | `import ImageConverter from '../../tools/frontend/ImageConverter.vue';` | `frontend/image-converter` |
| `src/pages/frontend/image-scrambler.astro` | `import ImageScrambler from '../../tools/frontend/ImageScrambler.vue';` | `frontend/image-scrambler` |
| `src/pages/frontend/phantom-tank.astro` | `import PhantomTank from '../../tools/frontend/PhantomTank.vue';` | `frontend/phantom-tank` |
| `src/pages/devops/markdown-editor.astro` | `import MarkdownEditor from '../../tools/devops/MarkdownEditor.vue';` | `devops/markdown-editor` |

> 每个文件结构同 `base64.astro` 样板（import 一行 + `<ToolLayout toolId="...">` + `<Xxx client:idle />`）。仅改这两处。

- [ ] **Step 5: 在 `astro.config.mjs` 新增 `redirects` 配置（两段→两段重定向）**

在 `defineConfig({...})` 内、`build` 之后新增顶层 `redirects` 字段：

```js
    /**
     * 两段→两段重定向：分类合并后旧工具 URL 兜底。
     * SSG 模式生成带 <meta http-equiv=refresh> + canonical 的重定向 HTML，
     * 搜索引擎按 301 等价处理。旧分类 slug 根级路径（/encoding 等）此前即为 404，不配。
     */
    redirects: {
        '/encoding/base64': '/text/base64',
        '/encoding/jwt-parser': '/text/jwt-parser',
        '/encoding/base64-to-image': '/text/base64-to-image',
        '/encoding/base64-to-file': '/text/base64-to-file',
        '/encoding/file-to-base64': '/text/file-to-base64',
        '/regex/tester': '/text/tester',
        '/css/unit-converter': '/frontend/unit-converter',
        '/css/gradient': '/frontend/gradient',
        '/color/panel': '/frontend/panel',
        '/media/qr-code-generator': '/frontend/qr-code-generator',
        '/media/qr-code-reader': '/frontend/qr-code-reader',
        '/media/image-converter': '/frontend/image-converter',
        '/media/image-scrambler': '/frontend/image-scrambler',
        '/media/phantom-tank': '/frontend/phantom-tank',
        '/editor/markdown-editor': '/devops/markdown-editor',
    },
```

- [ ] **Step 6: 运行类型检查 + 构建**

Run: `pnpm astro check && pnpm build`
Expected: 全部通过。构建产物含 `dist/text/base64/index.html` 等 15 个新页面，以及 `dist/encoding/base64/index.html` 等重定向页（由 `redirects` 生成）。

- [ ] **Step 7: 抽查构建产物**

Run:
```bash
grep -l "0;url=/text/base64" dist/encoding/base64/index.html && echo "redirect OK"
test -f dist/text/base64/index.html && echo "new page OK"
```
Expected: 两行 OK。

- [ ] **Step 8: 运行全量测试（确保迁移未破坏组件测试）**

Run: `pnpm test`
Expected: 全部 PASS（`MarkdownEditor.test.ts` 新路径下仍通过）。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(routes): 15 工具迁移至新分类目录 + 301 重定向

- 15 个 .astro 路由壳 + .vue 组件 git mv 到 text/frontend/devops（.vue 内容不变）
- 15 个 .astro 更新 import 路径与 toolId
- MarkdownEditor.test.ts 随迁至 devops/__tests__
- astro.config.mjs 新增 redirects（15 条两段重定向兜底旧 URL）

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 分类页 `[category]/index.astro` + `ToolLayout` breadcrumb prop

**Files:**
- Create: `src/pages/[category]/index.astro`
- Modify: `src/layouts/ToolLayout.astro`（Props 加 `breadcrumb`、`breadcrumbItems` 计算分流）

**Interfaces:**
- Consumes: `categories`（Task 1）、`getToolsByCategory`（`tools.ts`）。
- Produces: 7 个静态分类页（`/text`…`/devops`）；`ToolLayout` 可选 `breadcrumb` prop（`{ label: string; href?: string }[]`）。

- [ ] **Step 1: 修改 `src/layouts/ToolLayout.astro` Props 接口**

将 `interface Props`（第 12-21 行）改为：

```ts
interface Props {
  /** 页面标题 */
  title?: string;
  /** 页面描述（优先使用传入值，否则从 seoDescription 回退） */
  description?: string;
  /** 工具 ID（格式：categorySlug/toolSlug，如 encoding/base64） */
  toolId?: string;
  /** 额外的 JSON-LD 结构化数据（透传至 Layout，如首页的 ItemList） */
  jsonLd?: object | object[];
  /** 显式面包屑项（分类页用）；未传时由 toolId 派生 */
  breadcrumb?: { label: string; href?: string }[];
}
```

- [ ] **Step 2: 修改 `ToolLayout.astro` 解构与 `breadcrumbItems` 计算**

将第 23 行解构改为加入 `breadcrumb`：

```ts
const { title, description, toolId = '', jsonLd, breadcrumb } = Astro.props;
```

将第 132-143 行 `breadcrumbItems` 计算替换为（优先用传入的 `breadcrumb`）：

```ts
/** 构建面包屑导航项：显式传入优先，否则由 toolId 派生 */
const breadcrumbItems: { label: string; href?: string }[] =
  breadcrumb && breadcrumb.length > 0
    ? breadcrumb
    : toolId && toolMeta
      ? (() => {
          const [categorySlug] = toolId.split('/');
          const categoryName = slugCategoryMap[categorySlug] || categorySlug;
          return [
            { label: '首页', href: '/' },
            { label: categoryName },
            { label: toolMeta.name },
          ];
        })()
      : [];
```

- [ ] **Step 3: 新建 `src/pages/[category]/index.astro`**

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import ToolCard from '../../components/layout/ToolCard.astro';
import { categories } from '../../data/categories';
import { getToolsByCategory } from '../../data/tools';

/**
 * 分类页：静态生成 7 个分类落地页（/text … /devops）。
 * 渲染面包屑 + 分类标题/描述 + 该类工具卡片网格，复用 ToolLayout 壳层。
 */
export function getStaticPaths() {
  return categories.map((c) => ({
    params: { category: c.slug },
    props: { category: c },
  }));
}

const { category } = Astro.props;
const siteUrl = Astro.site?.toString().replace(/\/$/, '') || 'https://tools.baixuanz.cn';

const toolsInCategory = getToolsByCategory()[category.name] ?? [];
const categoryUrl = `${siteUrl}/${category.slug}`;

/** 分类页结构化数据：CollectionPage + ItemList + BreadcrumbList */
const jsonLd: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: category.description,
    url: categoryUrl,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category.name,
    numberOfItems: toolsInCategory.length,
    itemListElement: toolsInCategory.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: tool.name,
      url: `${siteUrl}${tool.path}`,
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: category.name, item: categoryUrl },
    ],
  },
];

const breadcrumbItems = [
  { label: '首页', href: '/' },
  { label: category.name },
];
---

<ToolLayout title={`${category.name} - DevTools`} description={category.description} breadcrumb={breadcrumbItems} jsonLd={jsonLd}>
  <div class="max-w-320 mx-auto">
    <div class="mb-8">
      <h1 class="flex items-center gap-2 text-3xl font-bold m-0 mb-2">
        <span class="text-[1.75rem] leading-none">{category.icon}</span>
        {category.name}
      </h1>
      <p class="text-muted-foreground text-base m-0">{category.description}</p>
    </div>

    <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {toolsInCategory.map((tool) => (
        <div class="flex">
          <ToolCard tool={tool} />
        </div>
      ))}
    </div>
  </div>
</ToolLayout>
```

- [ ] **Step 4: 运行类型检查 + 构建**

Run: `pnpm astro check && pnpm build`
Expected: 通过。`dist/` 含 7 个分类页目录（`dist/text/index.html` … `dist/devops/index.html`）。

- [ ] **Step 5: 抽查分类页产物**

Run:
```bash
test -f dist/text/index.html && echo "text OK"
test -f dist/frontend/index.html && echo "frontend OK"
grep -o '"@type":"CollectionPage"' dist/crypto/index.html && echo "jsonld OK"
```
Expected: 三行 OK。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(nav): 分类落地页 [category]/index.astro + ToolLayout breadcrumb prop

- 新增动态分类页，getStaticPaths 输出 7 个静态页（/text…/devops）
- 分类页含 CollectionPage + ItemList + BreadcrumbList 结构化数据
- ToolLayout 新增可选 breadcrumb prop，分类页用它传「首页 › 分类」
- 顺带修复工具页面包屑 /{slug} 外链（分类页建成后从 404 变有效）

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 首页改造 — `CategoryCard` + `SearchPanel` 下拉直达 + JSON-LD

**Files:**
- Create: `src/components/layout/CategoryCard.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/components/shell/SearchPanel.vue`（重写为下拉建议直达）
- Modify: `src/components/shell/__tests__/SearchPanel.test.ts`（重写）

**Interfaces:**
- Consumes: `categories`（Task 1）、`tools`/`getToolsByCategory`（`tools.ts`）、`filterTools`（`stores/search.ts`）。
- Produces: 首页 7 分类卡片网格；`SearchPanel` 输入匹配 → 下拉建议 → 选中直达 `tool.path`。

- [ ] **Step 1: 新建 `src/components/layout/CategoryCard.astro`**

```astro
---
import type { CategoryMeta } from '../../data/categories';

interface Props {
  /** 分类元数据 */
  category: CategoryMeta;
  /** 该分类工具数（首页预算好传入） */
  toolCount: number;
}

const { category, toolCount } = Astro.props;
---

<a
  href={`/${category.slug}`}
  class="flex flex-col gap-2 p-6 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
>
  <div class="flex items-center gap-2">
    <span class="text-[1.75rem] leading-none">{category.icon}</span>
    <h2 class="m-0 text-base font-semibold text-foreground">{category.name}</h2>
    <span class="ml-auto text-xs text-muted-foreground bg-accent rounded-full px-2 py-0.5">{toolCount}</span>
  </div>
  <p class="m-0 text-[0.8125rem] text-muted-foreground leading-relaxed">{category.description}</p>
</a>
```

- [ ] **Step 2: 重写 `src/components/shell/SearchPanel.vue`（下拉建议直达，不再过滤首页 DOM）**

```vue
<script setup lang="ts">
/**
 * 首页工具搜索面板（client:load 岛）。
 *
 * 输入实时匹配 tools（name/description/keywords，复用 filterTools 纯函数），
 * 下拉展示最多 MAX_SUGGEST 条建议；键盘 ↑↓ 选择、↵ 直达、Esc 关闭；
 * 点击建议项直达 tool.path。数据直接 import tools，不依赖首页 DOM。
 */
import { ref, computed, watch } from 'vue';
import { Search, X } from '@lucide/vue';
import { filterTools } from '../../stores/search';
import { tools } from '../../data/tools';

/** 下拉建议最大条数 */
const MAX_SUGGEST = 8;

const query = ref('');
const open = ref(false);
const activeIndex = ref(0);

/** 命中工具建议列表（保持 tools 注册顺序，截断 MAX_SUGGEST） */
const suggestions = computed(() => {
  const ids = filterTools(tools, query.value);
  if (!ids) return [];
  return tools.filter((t) => ids.has(t.id)).slice(0, MAX_SUGGEST);
});

/** 输入变化时重置选中并展开下拉 */
watch(query, () => {
  activeIndex.value = 0;
  open.value = query.value.trim().length > 0;
});

/** 跳转到指定工具 */
function go(path: string): void {
  window.location.href = path;
}

/** 选中当前高亮项（回车触发） */
function selectActive(): void {
  const item = suggestions.value[activeIndex.value];
  if (item) go(item.path);
}

/** 键盘导航 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    open.value = false;
    return;
  }
  if (!open.value || suggestions.value.length === 0) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    selectActive();
  }
}

/** 清空搜索 */
function clear(): void {
  query.value = '';
  open.value = false;
}
</script>

<template>
  <div class="max-w-140 mx-auto mb-6 relative">
    <div class="flex items-center gap-2 px-5 py-3 border border-border rounded-lg bg-card transition-[border-color] duration-150 focus-within:border-primary">
      <Search class="w-4 h-4 shrink-0 text-muted-foreground" />
      <input
        v-model="query"
        type="text"
        placeholder="搜索工具..."
        autocomplete="off"
        class="flex-1 border-none outline-none text-base font-sans text-foreground bg-transparent placeholder:text-muted-foreground"
        @keydown="onKeydown"
        @focus="open = query.trim().length > 0"
      />
      <button
        v-if="query"
        class="border-none bg-transparent cursor-pointer text-muted-foreground text-sm px-1 py-0.5 rounded-sm hover:text-foreground"
        aria-label="清除搜索"
        @click="clear"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- 下拉建议 -->
    <ul
      v-if="open && suggestions.length > 0"
      class="absolute left-0 right-0 top-full mt-1 list-none m-0 p-0 bg-card border border-border rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden z-10"
    >
      <li v-for="(item, index) in suggestions" :key="item.id">
        <a
          :href="item.path"
          :class="[
            'flex items-center gap-2 px-4 py-2 text-sm transition-[background-color] duration-100',
            index === activeIndex ? 'bg-accent text-primary' : 'text-foreground hover:bg-accent',
          ]"
        >
          <span class="text-base w-5 text-center shrink-0">{{ item.icon }}</span>
          <span>{{ item.name }}</span>
        </a>
      </li>
    </ul>

    <!-- 空态 -->
    <div v-if="open && suggestions.length === 0" class="text-center py-16">
      <p class="text-muted-foreground text-base m-0">没有找到匹配「<span class="text-foreground font-medium">{{ query }}</span>」的工具</p>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 重写 `src/components/shell/__tests__/SearchPanel.test.ts`**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SearchPanel from '../SearchPanel.vue';

describe('SearchPanel.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('输入匹配词 → 下拉出现命中工具（含正确 href）', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    const links = wrapper.findAll('ul a');
    expect(links.length).toBeGreaterThan(0);
    // JWT 工具 path 含 jwt-parser
    const hrefs = links.map((a) => a.attributes('href'));
    expect(hrefs.some((h) => h?.includes('jwt-parser'))).toBe(true);
  });

  it('输入无匹配词 → 空态文案', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await nextTick();
    expect(wrapper.text()).toContain('没有找到匹配');
  });

  it('↓↓ 改变高亮项（activeIndex 循环）', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('json'); // 命中多个 json 工具
    await nextTick();
    const links = () => wrapper.findAll('ul a');
    const firstClass = () => links()[0].classes();
    expect(firstClass()).toContain('bg-accent');
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(firstClass()).not.toContain('bg-accent');
    expect(links()[1].classes()).toContain('bg-accent');
  });

  it('Esc → 关闭下拉', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(true);
    await wrapper.find('input').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(wrapper.find('ul').exists()).toBe(false);
  });

  it('回车 → 跳转当前高亮项 path', async () => {
    const wrapper = mount(SearchPanel);
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', { value: { href: '', assign: assignSpy }, writable: true });
    await wrapper.find('input').setValue('jwt');
    await nextTick();
    await wrapper.find('input').trigger('keydown', { key: 'Enter' });
    expect(window.location.href).toContain('jwt-parser');
  });
});
```

- [ ] **Step 4: 重写 `src/pages/index.astro`（分类卡片网格 + CollectionPage JSON-LD）**

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import CategoryCard from '../components/layout/CategoryCard.astro';
import SearchPanel from '../components/shell/SearchPanel.vue';
import { categories } from '../data/categories';
import { getToolsByCategory } from '../data/tools';

const siteUrl = Astro.site?.toString().replace(/\/$/, '') || 'https://tools.baixuanz.cn';

/** 分类 → 工具数 */
const toolsByCategory = getToolsByCategory();
const countByCategory = (name: string): number => toolsByCategory[name]?.length ?? 0;

/** 首页 CollectionPage + ItemList（7 分类）结构化数据 */
const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'DevTools 在线工具箱',
  description: '零门槛的浏览器端在线工具集合',
  url: siteUrl,
  mainContent: categories.map((c) => ({
    '@type': 'ListItem',
    name: c.name,
    url: `${siteUrl}/${c.slug}`,
  })),
};
---

<ToolLayout title="DevTools - 在线工具箱" jsonLd={collectionJsonLd}>
  <div class="max-w-320 mx-auto">
    <!-- Hero -->
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold m-0 mb-3">在线工具箱</h1>
      <p class="text-muted-foreground text-base m-0 mb-8">零门槛的浏览器端在线工具，即开即用</p>
    </div>

    <!-- 搜索面板（输入实时匹配 → 下拉建议直达） -->
    <SearchPanel client:load />

    <!-- 分类卡片网格 -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {categories.map((category) => (
        <CategoryCard category={category} toolCount={countByCategory(category.name)} />
      ))}
    </div>
  </div>
</ToolLayout>
```

- [ ] **Step 5: 运行 SearchPanel 测试**

Run: `pnpm test src/components/shell/__tests__/SearchPanel.test.ts`
Expected: 5 个用例 PASS。

- [ ] **Step 6: 类型检查 + 构建**

Run: `pnpm astro check && pnpm build`
Expected: 通过。`dist/index.html` 含 7 个分类卡片链接（`/text`…`/devops`）。

- [ ] **Step 7: 抽查首页产物**

Run:
```bash
grep -o 'href="/text"' dist/index.html && grep -o '"@type":"CollectionPage"' dist/index.html && echo "homepage OK"
```
Expected: 两段匹配 + OK。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(home): 首页分类卡片网格 + 搜索下拉直达

- 新建 CategoryCard.astro（icon+名称+工具数+描述，零 JS）
- 首页主体由全工具网格改为 7 分类卡片，JSON-LD 改 CollectionPage
- SearchPanel 由 DOM 过滤改为下拉建议直达（↑↓↵/Esc 键盘导航）
- 重写 SearchPanel 测试覆盖新交互

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 侧边栏瘦身 + Header 删收藏入口（`Shell.vue`）

**Files:**
- Modify: `src/components/shell/Shell.vue`（侧边栏只渲染分类项 + 删 Header 收藏入口）
- Modify: `src/components/shell/__tests__/Shell.test.ts`

**Interfaces:**
- Consumes: `props.categories`、`props.toolsByCategory`、`props.currentPath`（接口不变）。
- Produces: 侧边栏每项 = icon + 分类名 + 工具数徽标，整项 `<a href="/{slug}">`；当前路径前缀匹配 `/{slug}` 时高亮。

> `categories` 当前是 `string[]`（中文分类名）。工具数取 `toolsByCategory[cat].length`；分类 slug 需在组件内由分类名转换。引入 `categorySlugMap` 做中→英映射。

- [ ] **Step 1: 修改 `Shell.vue` script — 引入 `categorySlugMap`**

将第 15 行 `import type { ToolMeta }` 下方补充导入（第 15 行后加一行）：

```ts
import type { ToolMeta } from '../../data/tools';
import { categorySlugMap } from '../../data/tools';
```

> 即把第 15 行改为上面两行（同模块的 type 与 value 合并导入亦可，但分两行更清晰）。

- [ ] **Step 2: 替换 `Shell.vue` 侧边栏模板（第 133-151 行的 `<div class="flex-1 sidebar-nav-scroll...">` 内部）**

将整个侧边栏导航区（从 `<div class="flex-1 sidebar-nav-scroll overflow-y-auto py-2">` 到其闭合 `</div>`）替换为：

```html
        <div class="flex-1 sidebar-nav-scroll overflow-y-auto py-2">
          <ul class="list-none m-0 p-0">
            <li v-for="category in props.categories" :key="category">
              <a
                :href="`/${categorySlugMap[category]}`"
                :class="[
                  'flex items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-[background-color] duration-150 hover:bg-accent focus:outline-none',
                  props.currentPath.startsWith(`/${categorySlugMap[category]}`) && 'bg-accent text-primary font-medium',
                ]"
              >
                <span class="text-base w-6 text-center shrink-0">{{ props.toolsByCategory[category]?.length ?? 0 }}</span>
                <span>{{ category }}</span>
              </a>
            </li>
          </ul>
        </div>
```

- [ ] **Step 3: 删除 `Shell.vue` Header 收藏入口（第 76-84 行）**

删除以下整块：

```html
          <!-- 收藏夹入口 -->
          <a
            href="/favorites"
            class="flex items-center gap-1.5 h-9 px-2 max-md:px-1.5 rounded-sm text-muted-foreground hover:text-primary hover:bg-accent transition-[color,background-color] duration-150 focus:outline-none"
            aria-label="我的收藏"
          >
            <span class="text-[1.125rem] leading-none">⭐</span>
            <span class="text-[0.8125rem] font-medium max-md:hidden">我的收藏</span>
          </a>
```

并同步更新组件顶部 JSDoc（第 2-11 行）中"收藏入口"字样：将第 5 行 `渲染 Header（汉堡 + Logo + 收藏入口 + 暗色按钮 + 仓库链接）、` 改为 `渲染 Header（汉堡 + Logo + 暗色按钮 + 仓库链接）、`；将第 10 行 `onMounted 预热 favorites/theme 的 localStorage 读取。` 改为 `onMounted 预热 theme 的 localStorage 读取。`。

- [ ] **Step 4: 重写 `Shell.test.ts` 侧边栏断言（第 52-61 行用例）**

将"侧栏渲染传入的分类与工具链接"用例替换为：

```ts
  it('侧栏渲染分类项 + 工具数 + 当前路径前缀高亮', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/text/uuid-generator' },
    });
    expect(wrapper.find('aside').text()).toContain('文本处理');
    expect(wrapper.find('aside').text()).toContain('1');
    // 不再渲染工具链接（仅分类）
    expect(wrapper.find('aside a[href="/text/uuid-generator"]').exists()).toBe(false);
    // 当前分类高亮
    const activeLink = wrapper.find('aside a[href="/text"]');
    expect(activeLink.classes()).toContain('bg-accent');
  });

  it('Header 不再含收藏入口', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    expect(wrapper.find('header a[href="/favorites"]').exists()).toBe(false);
  });
```

- [ ] **Step 5: 运行 Shell 测试**

Run: `pnpm test src/components/shell/__tests__/Shell.test.ts`
Expected: 全部 PASS。

- [ ] **Step 6: 类型检查 + 构建**

Run: `pnpm astro check && pnpm build`
Expected: 通过。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(shell): 侧边栏瘦身为仅分类项 + 删除 Header 收藏入口

- 侧边栏由「分类+工具全展开」改为「7 分类项（工具数徽标）」，当前路径前缀高亮
- Header 移除「我的收藏」入口
- 更新 Shell 测试断言新侧栏结构与无收藏入口

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 移除收藏 — 删文件 + `ToolCard` + `[slug]` 重定向更新

**Files:**
- Delete: `src/components/shell/FavoriteButton.vue`、`src/components/shell/FavoritesList.vue`、`src/stores/favorites.ts`、`src/pages/favorites.astro`、`src/stores/__tests__/favorites.test.ts`、`src/components/shell/__tests__/FavoriteButton.test.ts`、`src/components/shell/__tests__/FavoritesList.test.ts`
- Modify: `src/components/layout/ToolCard.astro`（移除 `FavoriteButton`）
- Modify: `src/pages/[slug].astro`（base64/jwt-parser 目标更新 + 新增 favorites→/）

**Interfaces:**
- Consumes: 无（纯删除）。
- Produces: 收藏功能全量下线；`/favorites` → `/` 重定向。

- [ ] **Step 1: 删除 7 个收藏相关文件**

Run:
```bash
git rm src/components/shell/FavoriteButton.vue \
       src/components/shell/FavoritesList.vue \
       src/stores/favorites.ts \
       src/pages/favorites.astro \
       src/stores/__tests__/favorites.test.ts \
       src/components/shell/__tests__/FavoriteButton.test.ts \
       src/components/shell/__tests__/FavoritesList.test.ts
```

- [ ] **Step 2: 修改 `src/components/layout/ToolCard.astro`（移除 FavoriteButton）**

替换整个文件为：

```astro
---
import type { ToolMeta } from '../../data/tools';

interface Props {
  tool: ToolMeta;
}

const { tool } = Astro.props;
---

<a
  href={tool.path}
  class="flex items-start gap-4 p-5 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full h-full"
>
  <span class="text-[1.75rem] leading-none shrink-0 mt-0.5">{tool.icon}</span>
  <div class="flex-1 min-w-0">
    <h3 class="m-0 mb-1 text-[0.9375rem] font-semibold leading-snug">{tool.name}</h3>
    <p class="m-0 text-[0.8125rem] text-muted-foreground leading-relaxed">{tool.description}</p>
  </div>
</a>
```

> 移除了外层 `<div class="relative flex h-full">` 包裹、`pr-14` 右内边距、`FavoriteButton` import 与使用。整卡即 `<a>`。

- [ ] **Step 3: 更新 `src/pages/[slug].astro`（base64/jwt-parser 目标 + favorites→/）**

将整个重定向表（第 8-18 行 `const redirects = { ... }`）替换为最终 10 条版本：

```ts
  const redirects: Record<string, string> = {
    'base64': '/text/base64',
    'url-encode': '/network/url',
    'jwt-parser': '/text/jwt-parser',
    'hash-generator': '/crypto/hash-generator',
    'symmetric-crypto': '/crypto/symmetric-crypto',
    'uuid-generator': '/text/uuid-generator',
    'random-string': '/text/random-string',
    'datetime-converter': '/datetime/datetime-converter',
    'device-info': '/network/device-info',
    'favorites': '/',
  };
```

> 相比原始 9 条表的变化：`base64`/`jwt-parser` 目标由 `/encoding/*` 改 `/text/*`；`url-encode` 目标由 `/encoding/url-encode` 改 `/network/url`（Task 1 已删该孤儿重定向页，此处一并收敛为单跳直指 `url` 工具）；追加 `'favorites': '/'`。最终 **10 条**。注意 `url-encode` 行**必须保留**，否则 `/url-encode` 会 404（其目标页已在 Task 1 删除）。

- [ ] **Step 4: 全局复查无残留 favorites 引用**

Run:
```bash
pnpm exec astro check
```
Expected: 无 "Cannot find module './favorites'" 或 `FavoriteButton`/`FavoritesList` 未解析错误。

再用搜索确认：
Run: `grep -rn "FavoriteButton\|FavoritesList\|favoritesStore\|/favorites" src/ --include=*.vue --include=*.ts --include=*.astro`
Expected: 仅 `src/pages/[slug].astro` 的 `'favorites': '/'` 一处命中（预期内）；其余无残留。

- [ ] **Step 5: 运行全量测试**

Run: `pnpm test`
Expected: 全部 PASS（3 个收藏测试已删，无断言依赖）。

- [ ] **Step 6: 类型检查 + 构建**

Run: `pnpm astro check && pnpm build`
Expected: 通过。`dist/favorites/` 不再生成。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(favorites): 全量移除收藏功能

- 删除 FavoriteButton/FavoritesList 组件、favorites store、favorites 页面及 3 个测试
- ToolCard 移除星标，整卡简化为单个 <a>
- [slug] 重定向：base64/jwt-parser 改指 /text/*，新增 favorites → /

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: SEO — sitemap filter 白名单 + 分类页 priority + `llms.txt` 核查

**Files:**
- Modify: `astro.config.mjs`（sitemap filter + serialize 分类页 priority）
- Modify: `src/pages/llms.txt.ts`（描述文案同步新分类）

**Interfaces:**
- Consumes: 7 个分类 slug（与 `categorySlugMap` 值一致）。
- Produces: sitemap 含 7 分类页 + 工具页，排除旧扁平重定向页与 `/favorites`；分类页 priority 0.9。

> `astro.config.mjs` 是 ESM JS，无法 import TS。在 config 内联 `CATEGORY_SLUGS` 集合并注释指向 `categorySlugMap` 同步源。

- [ ] **Step 1: 修改 `astro.config.mjs` sitemap filter（第 20-34 行）**

将整个 `sitemap({...})` 调用替换为：

```js
        sitemap({
            /**
             * 过滤：首页保留；单段/两段路径的首段必须 ∈ 7 个分类 slug。
             *   - 单段：保留 7 分类页，排除旧扁平根级重定向（/base64、/favorites 等）。
             *   - 两段：保留新分类下真实工具页，排除 redirects 生成的旧 slug 重定向页
             *     （/encoding/base64、/editor/markdown-editor 等，避免重定向页污染 sitemap）。
             * CATEGORY_SLUGS 与 src/data/tools.ts 的 categorySlugMap 值保持同步。
             */
            filter: (page) => {
                const CATEGORY_SLUGS = new Set(['text', 'crypto', 'format', 'network', 'datetime', 'frontend', 'devops']);
                try {
                    const pathname = new URL(page).pathname.replace(/\/$/, '');
                    const segments = pathname.split('/').filter(Boolean);
                    if (segments.length === 0) return true;                       // 首页
                    return CATEGORY_SLUGS.has(segments[0]);                       // 单段分类页 / 两段工具页，首段须为新 slug
                } catch {
                    return true;
                }
            },
            /**
             * priority：首页 1.0、分类页 0.9、工具页 0.8。
             */
            serialize: ({url, ...rest}) => {
                const pathname = new URL(url).pathname.replace(/\/$/, '');
                const segments = pathname.split('/').filter(Boolean);

                if (segments.length === 0) {
                    return {url, ...rest, priority: 1.0, changefreq: ChangeFreqEnum.WEEKLY};
                }
                if (segments.length === 1) {
                    return {url, ...rest, priority: 0.9, changefreq: ChangeFreqEnum.WEEKLY};
                }
                return {url, ...rest, priority: 0.8, changefreq: ChangeFreqEnum.MONTHLY};
            },
        }),
```

- [ ] **Step 2: 更新 `src/pages/llms.txt.ts` 描述文案（第 23 行）**

将第 23 行：

```ts
    'DevTools 是一个面向开发者的纯前端在线工具箱，覆盖编码转换、加密哈希、格式化、文本处理、正则、网络、颜色、日期时间、CSS、媒体、编辑器与 DevOps 等场景。无需安装、无需注册，打开即用，所有数据均在浏览器端本地处理。',
```

改为：

```ts
    'DevTools 是一个面向开发者的纯前端在线工具箱，覆盖文本与编码、加密与安全、格式化与转换、网络工具、日期时间、前端与媒体、开发与运维等场景。无需安装、无需注册，打开即用，所有数据均在浏览器端本地处理。',
```

> 工具清单由 `getToolsByCategory()` 自动按新分类分组，无需改循环逻辑。

- [ ] **Step 3: 构建并核查 sitemap 产物**

Run: `pnpm build`
Expected: 通过。

Run:
```bash
echo "=== 分类页（应各出现一次，priority 0.9）==="
grep -o '<loc>[^<]*</loc>' dist/sitemap-0.xml | grep -E '/(text|crypto|format|network|datetime|frontend|devops)</loc>'
echo "=== 旧扁平重定向（应为空）==="
grep -E '/(base64|jwt-parser|favorites)</loc>' dist/sitemap-0.xml || echo "none (correct)"
```
Expected: 7 个分类页各出现一次；旧扁平页无命中（输出 "none (correct)"）。

- [ ] **Step 4: 核查 llms.txt 产物**

Run:
```bash
pnpm preview & sleep 3 && curl -s http://localhost:4321/llms.txt | grep -E '文本与编码|前端与媒体' ; kill %1 2>/dev/null
```
Expected: 命中新分类名（端口以 `pnpm preview` 实际输出为准，若非 4321 调整）。

- [ ] **Step 5: 类型检查**

Run: `pnpm astro check`
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(seo): sitemap filter 白名单保留分类页 + 分类页 priority 0.9 + llms.txt 文案

- sitemap filter 改为白名单（7 分类 slug），保留分类页、排除旧扁平重定向与 /favorites
- serialize 分类页 priority 0.9（首页 1.0、工具页 0.8）
- llms.txt 描述同步新分类名（工具清单自动按新分类分组）

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 文档同步 — PRODUCT / DESIGN / CLAUDE

**Files:**
- Modify: `PRODUCT.md`（§Tool Categories 表 + §URL Strategy 示例）
- Modify: `DESIGN.md`（§Sidebar Navigation + Header 表 + 新增 CategoryCard 矩阵）
- Modify: `CLAUDE.md`（架构图 `tools/` 子目录示例，如有分类枚举）

**Interfaces:** 无代码接口，纯文档。

- [ ] **Step 1: 同步 `PRODUCT.md` §Tool Categories**

将分类表替换为 7 个新分类（每行：中文名 + slug + 工具清单）。删除「API 工具」「正则工具」「颜色工具」「CSS 工具」「编辑器」「编码转换」「媒体工具」旧行。新表内容：

| 分类 | slug | 工具 |
|---|---|---|
| 文本与编码 | text | 进制转换器、文本处理工具箱、UUID 生成器、随机字符串生成、假数据生成器、转盘抽奖、Base64 编解码、JWT 编解码、Base64 转图片/文件、文件转 Base64、正则表达式 |
| 加密与安全 | crypto | 哈希生成器、对称加解密、非对称加解密、SM2 国密加解密 |
| 格式化与转换 | format | JSON 格式化器/差异对比/转 XML/YAML/TS、TOML 与 JSON/YAML 互转、TOML 格式化器 |
| 网络工具 | network | URL 解析器、HTTP 状态码查询、IPv4/IPv6 子网计算器、IPv4 范围展开、设备信息与UA |
| 日期时间 | datetime | 日期时间转换器、Cron 表达式、时间差计算器 |
| 前端与媒体 | frontend | CSS 单位转换器、CSS 渐变生成器、颜色面板、二维码生成器/识别器、图片转换与压缩、图片混淆、幻影坦克 |
| 开发与运维 | devops | Docker 配置转换、Docker Run 命令助手、环境变量转换器、Meta/robots/sitemap 生成器、Markdown 编辑器 |

- [ ] **Step 2: 同步 `PRODUCT.md` §URL Strategy 示例**

将示例路径（如 `/encoding/base64`）更新为新路径（`/text/base64`），补充分类页路由说明（`/{category}` → 分类工具网格）。

- [ ] **Step 3: 同步 `DESIGN.md` §Sidebar Navigation**

将「Group headings + Nav links（工具链接）」描述更新为「分类项（icon + 分类名 + 工具数徽标），当前分类高亮」。新增 `CategoryCard` 组件状态矩阵（默认/hover/active，复用 ToolCard token：`bg-card border border-border rounded-lg p-6`，hover `border-primary` + `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`）。Header 表删除「收藏夹入口」行。

- [ ] **Step 4: 同步 `CLAUDE.md` 架构图（如需）**

检查 `CLAUDE.md` Architecture 节 `tools/` 子目录示例是否引用旧分类目录（`encoding/`、`regex/` 等），若有则更新为新目录（`text/`、`frontend/` 等）。

- [ ] **Step 5: 提交**

```bash
git add PRODUCT.md DESIGN.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: 同步 7 分类、三级导航与 CategoryCard 至 PRODUCT/DESIGN/CLAUDE

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 全量验收

**Files:** 无（验证任务，发现问题就地修复并追加提交）。

- [ ] **Step 1: 全量自动化检查**

Run:
```bash
pnpm astro check && pnpm test && pnpm build
```
Expected: 三项全部通过，0 失败。

- [ ] **Step 2: sitemap 终检**

Run:
```bash
echo "总 URL 数：" && grep -c '<loc>' dist/sitemap-0.xml
echo "分类页数（应为 7）：" && grep -E '/(text|crypto|format|network|datetime|frontend|devops)</loc>' dist/sitemap-0.xml | wc -l
echo "favorites（应为 0）：" && (grep -c '/favorites</loc>' dist/sitemap-0.xml || echo 0)
echo "旧 slug 两段重定向（应为 0）：" && (grep -cE '/(encoding|regex|css|color|media|editor)/' dist/sitemap-0.xml || echo 0)
echo "根级扁平重定向（应为 0）：" && (grep -cE '/(base64|jwt-parser|url-encode|hash-generator|symmetric-crypto|uuid-generator|random-string|datetime-converter|device-info)</loc>' dist/sitemap-0.xml || echo 0)
```
Expected: 分类页 = 7；favorites = 0；旧 slug 两段重定向 = 0；根级扁平重定向 = 0；总 URL = 1（首页）+ 7（分类）+ 48（工具）= 56（不含任何重定向页）。

- [ ] **Step 3: 浏览器手测（`pnpm dev`）**

逐项验证：
- 首页显示 7 个分类卡片 + 搜索框；搜索框输入「jwt」→ 下拉命中「JWT 编解码」，回车/点击直达 `/text/jwt-parser`。
- 侧边栏仅 7 个分类（带工具数），当前分类高亮。
- 7 个分类页 `/text`…`/devops` 正常，面包屑「首页 › 分类」、工具网格、JSON-LD 正确。
- 旧 URL 重定向：`/encoding/base64` → `/text/base64`；`/editor/markdown-editor` → `/devops/markdown-editor`；`/url-encode` → `/network/url`；`/favorites` → `/`；`/base64` → `/text/base64`。
- 收藏入口、星标、`/favorites` 内容均已消失。
- 暗色模式下首页、分类页、侧边栏视觉正确。

- [ ] **Step 4: 暗色模式抽查**

在浏览器切暗色，确认首页分类卡片、分类页、侧边栏分类项的 token（`bg-card`/`border-border`/`text-foreground`/`bg-accent`）正确切换，无硬编码颜色泄漏。

- [ ] **Step 5: 修复发现的问题并提交（若有）**

手测发现任何回归，就地修复，`pnpm astro check && pnpm test && pnpm build` 复验后提交。若无问题，本任务无新增 commit。

---

## Self-Review 备忘

- **Spec 覆盖**：§1-13 全部映射到 Task 1-9（数据层→1、URL 变更/301→2+6+7、categories.ts→1、分类页→3、首页/搜索→4、侧边栏/Header→5、收藏移除→6、SEO/sitemap→7、文档→8、验收→13）。
- **url-encode 修正**：spec 错列为迁移目标，本计划改为废弃（Task 1），与代码现状一致。
- **类型一致性**：`CategoryMeta.name: ToolCategory`（Task 1 定义）被 `categories.test.ts`、`index.astro`、`[category]/index.astro`、`CategoryCard.astro` 一致消费；`breadcrumb` prop 类型 `{ label: string; href?: string }[]` 在 `ToolLayout`（Task 3 定义）与 `[category]/index.astro`（Task 3 消费）一致。
