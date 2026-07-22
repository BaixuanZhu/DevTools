# 三级导航 + 分类合并 + 移除收藏 — 设计文档

- 日期：2026-07-22
- 状态：待评审
- 关联：`docs/superpowers/specs/2026-07-21-runtime-unification-design.md`（运行时统一，已合并）

## 1. 背景与目标

### 1.1 痛点

- 侧边栏把 12 个分类下的全部 ~49 个工具**全展开**列出，工具增多后侧边栏过长、定位困难。
- 分类过细，存在多个只有 1–2 个工具的「孤分类」（正则、颜色、CSS、编辑器），侧边栏心智负担大。
- 收藏功能（`/favorites` 页 + `ToolCard` 星标 + Header 入口 + `favoritesStore`）实际使用率低，维护成本高于价值，判定冗余。

### 1.2 目标

1. **三级导航**：首页（分类入口）→ 分类页 `/category`（该类工具卡片）→ 工具页 `/category/tool`。
2. **分类合并**：12 → 7 个，按开发者心智归并，主力分类保留 slug 以最小化 URL 变更。
3. **移除收藏**：全量删除收藏相关代码、页面、store 与测试。

### 1.3 非目标

- 不改变工具页的交互逻辑与组件实现（仅迁移文件位置/调整 path）。
- 不引入搜索以外的全局导航增强（如命令面板快捷键）——搜索仅做到首页输入直达。
- 不重构 `ToolLayout` 的 JSON-LD 框架，仅新增一个可选 `breadcrumb` prop。

## 2. 信息架构

```
首页  /                         侧边栏（Shell 全程常驻）
┌───────────────────┐          ┌────────────────┐
│ 在线工具箱         │          │ 文本与编码    13│ ← 仅 7 个分类
│ [🔍 搜索框→下拉直达]│ ←────   │ 加密与安全     4│   分类名 + 工具数
│                   │          │ 格式化与转换   8│
│ [7 个分类卡片网格]  │          │ 网络工具       6│
│ 🔤文本与编码   13  │          │ 日期时间       3│
│ 🔒加密与安全    4  │          │ 前端与媒体     8│
│ …                 │          │ 开发与运维     7│
└─────────┬─────────┘          └────────────────┘
          │ 点分类卡片 / 点侧边栏分类
          ▼
分类页  /text  /crypto  /format  /network  /datetime  /frontend  /devops
┌──────────────────────────────┐
│ 首页 › 文本与编码             │
│ 文本与编码（分类描述）        │
│ [Base64][JWT][文本工具箱]…    │ ← 该类工具卡片网格
└──────────┬───────────────────┘
           │ 点工具
           ▼
工具页  /text/base64  ……（URL 见 §3 变更表）
```

Shell（含侧边栏 + Header）在首页、分类页、工具页全程常驻；Toast、Footer 同现状。

## 3. 分类合并方案（核心）

### 3.1 归属表（12 → 7）

| 新分类 | 新 slug | 合并自（原 slug） | 工具数 |
|---|---|---|---|
| 文本与编码 | `text` | 文本处理(`text`) + 编码转换(`encoding`) + 正则工具(`regex`) | 13 |
| 加密与安全 | `crypto` | 加密哈希(`crypto`) | 4 |
| 格式化与转换 | `format` | 格式化(`format`) | 8 |
| 网络工具 | `network` | 网络工具(`network`) | 6 |
| 日期时间 | `datetime` | 日期时间(`datetime`) | 3 |
| 前端与媒体 | `frontend` | CSS 工具(`css`) + 颜色工具(`color`) + 媒体工具(`media`) | 8 |
| 开发与运维 | `devops` | DevOps 工具(`devops`) + 编辑器(`editor`) | 7 |

合计 49 工具，7 分类。原「API 工具」无工具，`getCategories()` 已自动过滤，不出现。

`categorySlugMap` 收敛为 7 条（中→英）；`slugCategoryMap` 由其反向派生（现有逻辑不变）。

### 3.2 URL 变更清单（16 个工具，slug 第一段改变）

| 旧 URL | 新 URL |
|---|---|
| `/encoding/base64` | `/text/base64` |
| `/encoding/jwt-parser` | `/text/jwt-parser` |
| `/encoding/base64-to-image` | `/text/base64-to-image` |
| `/encoding/base64-to-file` | `/text/base64-to-file` |
| `/encoding/file-to-base64` | `/text/file-to-base64` |
| `/encoding/url-encode` | `/text/url-encode` |
| `/regex/tester` | `/text/tester` |
| `/css/unit-converter` | `/frontend/unit-converter` |
| `/css/gradient` | `/frontend/gradient` |
| `/color/panel` | `/frontend/panel` |
| `/media/qr-code-generator` | `/frontend/qr-code-generator` |
| `/media/qr-code-reader` | `/frontend/qr-code-reader` |
| `/media/image-converter` | `/frontend/image-converter` |
| `/media/image-scrambler` | `/frontend/image-scrambler` |
| `/media/phantom-tank` | `/frontend/phantom-tank` |
| `/editor/markdown-editor` | `/devops/markdown-editor` |

其余 33 个工具 URL 不变（其原 slug 恰为保留的主力 slug：`text`/`crypto`/`format`/`network`/`datetime`/`devops`）。

### 3.3 301 重定向策略

- **两段→两段（上表 16 条）**：用 `astro.config.mjs` 的 `redirects` 配置（Astro 5+ 原生支持，SSG 模式生成带 `<meta http-equiv=refresh>` + `canonical` 的重定向 HTML，搜索引擎按 301 等价处理）。
- **`[slug].astro` 根级重定向表更新**：
  - 3 条目标随合并更新：`base64`/`url-encode`/`jwt-parser` → `/text/*`。
  - 新增 1 条：`'favorites': '/'`（§7）。
  - 其余 6 条（`hash-generator`/`symmetric-crypto`/`uuid-generator`/`random-string`/`datetime-converter`/`device-info`）目标不变。
- 旧分类 slug 根级路径（`/encoding`、`/media` 等）此前即为 404（从未存在分类页），无需 301。

## 4. 数据层

### 4.1 `src/data/tools.ts` 改动

- `ToolCategory` 类型收敛为 7 个字面量：`'文本与编码' | '加密与安全' | '格式化与转换' | '网络工具' | '日期时间' | '前端与媒体' | '开发与运维'`。
- `categorySlugMap` 改为 7 条映射。
- 16 个被迁移工具的 `category` 字段改为新分类、`path` 字段改为新 URL。
- `getCategories()` / `getToolsByCategory()` / `getToolById()` / `getToolBySlug()` / `slugCategoryMap` / `getRelatedTools()` 逻辑不变（均从 `tools` 派生）。

### 4.2 新增 `src/data/categories.ts`

分类级元数据，供首页分类卡片、分类页头部、sitemap 白名单共用。

```ts
/** 分类级元数据（描述用于卡片与分类页 SEO；icon 为 emoji） */
export interface CategoryMeta {
  /** 中文分类名（与 ToolCategory 一致） */
  name: string;
  /** 分类 slug（与 categorySlugMap 值一致） */
  slug: string;
  /** 卡片/SEO 用一句话描述 */
  description: string;
  /** 分类代表图标（emoji） */
  icon: string;
}

/** 全部分类元数据（顺序为首页/侧边栏展示顺序） */
export const categories: CategoryMeta[] = [ /* 7 条，见 §4.3 */ ];
```

### 4.3 7 条分类元数据（文案可调）

| name | slug | icon | description |
|---|---|---|---|
| 文本与编码 | `text` | 🔤 | 文本处理、大小写/去重/字数、Base64/JWT/URL 编解码、正则与随机数据生成 |
| 加密与安全 | `crypto` | 🔒 | MD5/SHA 哈希与 HMAC、AES/RSA/SM 国密对称与非对称加解密 |
| 格式化与转换 | `format` | 📋 | JSON 美化压缩、差异对比、TOML/YAML/XML/TypeScript 互转 |
| 网络工具 | `network` | 🌐 | URL 解析、HTTP 状态码、IPv4/IPv6 子网计算与设备信息 |
| 日期时间 | `datetime` | 🕐 | 时间戳转换、Cron 表达式解析与时间差计算 |
| 前端与媒体 | `frontend` | 🎨 | CSS 单位换算、渐变与颜色面板、图片转换压缩与二维码 |
| 开发与运维 | `devops` | 🐳 | Docker/Env 配置转换、Meta/robots/sitemap 生成与 Markdown 编辑器 |

## 5. 路由与文件迁移

### 5.1 工具页 `.astro` 文件迁移

受 §3.2 影响的 16 个工具，其路由壳文件 `src/pages/{old}/{tool}.astro` 迁移到 `src/pages/{new}/{tool}.astro`（Astro 路由由文件位置决定，必须迁移）。**同步迁移**对应的 Vue 实现组件 `src/tools/{old}/{Tool}.vue` → `src/tools/{new}/{Tool}.vue`，保持 `pages/` 与 `tools/` 目录结构对称，并更新 `.astro` 内的相对 import 路径与相关测试 import。

### 5.2 新增分类页 `src/pages/[category]/index.astro`

```ts
export function getStaticPaths() {
  return categories.map((c) => ({
    params: { category: c.slug },
    props: { category: c },
  }));
}
```

SSG 输出 7 个静态分类页（`/text`、`/crypto`、`/format`、`/network`、`/datetime`、`/frontend`、`/devops`）。页面用 `ToolLayout` 承载（见 §8），渲染面包屑 + 分类标题/描述 + 该类工具卡片网格（`getToolsByCategory()` 过滤当前分类后复用 `ToolCard.astro`）。

## 6. 首页 `pages/index.astro`

- **主体**：7 个分类卡片网格。新建 `src/components/layout/CategoryCard.astro`（纯展示、零 JS）：`icon` + 分类名 + 工具数徽标 + `description`，整卡 `<a href="/{slug}">`，复用 DESIGN.md「Tool Cards」状态矩阵（`bg-card border border-border rounded-lg p-6`，hover `border-primary` + `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`）。
- **搜索框**：改造 `SearchPanel.vue`。现状为 `client:load` 过滤首页 `data-search-grid` 内的工具卡片；改为「输入实时匹配 `tools`（按 name/keywords/description）→ 下拉建议列表 → 选中直达 `tool.path`」。数据直接 `import { tools }`，不再依赖首页 DOM；首页主体（分类卡片）不参与搜索过滤。空态、键盘导航（↑↓↵）、Esc 关闭需覆盖。
- **JSON-LD**：首页 `ItemList` 改为列 7 个分类（`CollectionPage`），原「列全部工具的 ItemList」退役（工具级链接下放到分类页）。

## 7. 侧边栏与 Header（`Shell.vue`）

- **侧边栏瘦身**：`v-for="category in props.categories"` 改为只渲染分类（不再内嵌工具 `<ul>`）。每项 = `icon` + 分类名 + 工具数（`toolsByCategory[cat].length`）徽标，整项 `<a href="/{slug}">`。当前路径前缀匹配 `/{slug}` 时高亮（替换原 `currentPath === tool.path` 精确匹配）。
- `props.toolsByCategory` 与 `props.categories` 保留不变，`ToolLayout` 传参方式不改；侧边栏分类项工具数取 `toolsByCategory[cat].length`。
- **Header**：删除「我的收藏」`<a href="/favorites">` 入口（§9）。

## 8. 分类页与 `ToolLayout` 小改

- `ToolLayout.astro` **新增可选 `breadcrumb` prop**（`{ label: string; href?: string }[]`）：传入则用它渲染 `<Breadcrumb>`，分类页用此传 `[首页, 分类]`；现有 `toolId` 驱动的工具页面包屑逻辑不变。
- 分类页 JSON-LD（透传 `ToolLayout` 的 `jsonLd` prop）：`CollectionPage` + `ItemList`（该类工具）+ `BreadcrumbList`（首页 › 分类）。
- **顺带修复隐性 bug**：`ToolLayout` 工具页面包屑 JSON-LD 早已把 `/{categorySlug}` 当分类页链接（position 2 的 `item`），分类页建成后该外链从 404 变有效。

## 9. 移除收藏

### 9.1 删除文件

- `src/components/shell/FavoriteButton.vue`
- `src/components/shell/FavoritesList.vue`
- `src/stores/favorites.ts`
- `src/pages/favorites.astro`
- `src/stores/__tests__/favorites.test.ts`
- `src/components/shell/__tests__/FavoriteButton.test.ts`
- `src/components/shell/__tests__/FavoritesList.test.ts`

### 9.2 改动文件

- `src/components/layout/ToolCard.astro`：移除 `FavoriteButton` import 与使用，卡片右侧留白（`pr-14` 可收敛为常规 padding）。
- `src/components/shell/Shell.vue`：Header 删除「我的收藏」入口（§7）。
- `src/pages/[slug].astro`：重定向表新增 `'favorites': '/'`（§3.3）。

### 9.3 数据

- 用户 `localStorage` 中残留的收藏数据不再被读取，无副作用，无需迁移。

## 10. SEO

- **工具页 URL**：33 个不变；16 个变更（§3.2）+ 301 兜底。
- **sitemap filter 修复（关键）**：`astro.config.mjs` 现有 filter 用 `segments.length !== 1` 排除单段路径，会把新分类页 `/text` 等误判为旧扁平重定向而过滤。改为：
  ```js
  filter: (page) => {
    const pathname = new URL(page).pathname.replace(/\/$/, '');
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return true;            // 首页
    if (segments.length === 1) return CATEGORY_SLUGS.has(segments[0]); // 分类页保留，旧扁平重定向排除
    return true;                                       // 工具页等多段
  }
  ```
  `CATEGORY_SLUGS` 为 7 个分类 slug 集合。因 `astro.config.mjs` 为 ESM JS、无法直接 import TS，在 config 内联该集合并注释指向 `categorySlugMap` 同步源。
- **sitemap priority**：分类页 `priority: 0.9`（介于首页 1.0 与工具页 0.8 之间），在 `serialize` 中按单段路径识别。
- **`llms.txt.ts`**：`src/pages/llms.txt.ts` 当前消费 `tools`，需确认分类合并后输出仍正确（工具清单按新分类分组），列入实施检查项。

## 11. 文档同步

- `PRODUCT.md` §Tool Categories 表替换为 7 个新分类（slug + 工具清单），删除「API 工具」「正则」「颜色」「CSS」「编辑器」等旧行。
- `PRODUCT.md` §URL Strategy 示例更新为新路径。
- `CLAUDE.md` 如有分类枚举/路径示例需同步（架构图 `tools/` 子目录示例）。
- `DESIGN.md`：§Sidebar Navigation 的「Group headings + Nav links（工具链接）」描述更新为「分类项 + 工具数」；Header 表删除「收藏夹入口」行；新增 `CategoryCard` 组件状态矩阵。

## 12. 测试

### 12.1 删除

3 个收藏相关测试（§9.1）。

### 12.2 新增/更新

- `src/data/__tests__/categories.test.ts`：`categories` 覆盖全部 7 个 `ToolCategory`；每条 `slug` 与 `categorySlugMap` 值一致；`description`/`icon` 非空。
- `src/data/__tests__/tools.test.ts`（新增或扩展）：每个 `tool.path` 第一段 ∈ 7 个 slug；`tool.category` ∈ 7 分类；`path` 与 `category` 经 `categorySlugMap` 一致。
- `SearchPanel` 搜索建议：输入命中 `name`/`keywords`，结果按相关性返回，选中直达 `path`；空输入不展示；键盘导航。
- 分类页 `getStaticPaths` 覆盖 7 分类（集成测试或 build 产物校验）。

## 13. 验收

- `pnpm dev` 浏览器验证：
  - 首页显示 7 个分类卡片 + 搜索框（输入「jwt」下拉命中并直达 `/text/jwt-parser`）。
  - 侧边栏仅 7 个分类（带工具数），当前分类高亮。
  - 7 个分类页 `/text`…`/devops` 正常，面包屑、工具网格、JSON-LD 正确。
  - 旧 URL 301：`/encoding/base64` → `/text/base64`；`/editor/markdown-editor` → `/devops/markdown-editor`；`/favorites` → `/`。
  - 收藏入口、星标、`/favorites` 内容均已消失。
- `pnpm build` + `pnpm test` + `pnpm astro check` 全部通过。
- `dist/sitemap-0.xml` 含 7 个分类页，不含旧扁平重定向页与 `/favorites`。
- 暗色模式下首页、分类页、侧边栏视觉正确（token 驱动，预期无需额外适配）。

## 14. 实施顺序建议（供 writing-plans 细化）

1. 数据层：`tools.ts` 分类/path 收敛 + 新建 `categories.ts`。
2. 路由迁移：16 个 `.astro` + Vue 组件迁移到新目录。
3. 新增分类页 `[category]/index.astro` + `ToolLayout` 加 `breadcrumb` prop。
4. 首页改造（`CategoryCard` + `SearchPanel` 改造 + JSON-LD）。
5. 侧边栏瘦身 + Header 删收藏入口。
6. 移除收藏（删文件 + 改 `ToolCard`/`Shell`/`[slug]`）。
7. SEO：`astro.config.mjs` redirects + sitemap filter + `llms.txt.ts` 核查。
8. 文档同步（PRODUCT/CLAUDE/DESIGN）。
9. 测试增删 + 全量验收。
