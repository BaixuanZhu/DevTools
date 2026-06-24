# robots.txt / sitemap.xml 生成器 设计文档

- **日期**: 2026-06-24
- **分类**: DevOps 工具
- **状态**: 设计待评审
- **相关**: 拆分为两个独立工具（符合项目「独立工具优先」偏好）

---

## 1. 背景与目标

为站长/开发者提供浏览器端生成 `robots.txt` 与 `sitemap.xml` 的工具，纯前端运算、数据不上传。两个工具的差异化价值在于**基于查证事实的「规则解释」**——诚实告知每条规则/字段对搜索引擎的真实影响，避免用户对已失效的字段抱有不切实际的期望。

### 核心功能

- **robots.txt 生成器**：按 User-agent 分组可视化添加 Allow/Disallow 规则，生成标准文本。
- **sitemap.xml 生成器**：逐条 + 批量粘贴录入 URL 列表，设置更新频率/优先级/最后修改时间，生成标准 XML。

### 亮点功能

- **AI 爬虫一键拦截**（robots）：快捷开关一键禁止 GPTBot、ClaudeBot、Google-Extended 等主流 AI 训练爬虫。
- **规则解释**（两者）：输入旁常驻通俗提示，解释每条规则/字段对搜索引擎的具体影响，文案以官方文档为依据。

---

## 2. 范围与非目标（YAGNI）

### 范围内

- robots.txt：按 User-agent 分组的 Allow/Disallow 规则、AI 爬虫一键拦截、Sitemap 引用、规则解释、复制 + 下载。
- sitemap.xml：URL 列表（loc/lastmod/changefreq/priority）、批量粘贴导入、诚实规则解释、复制 + 下载。

### 非目标（明确排除）

- **不支持 sitemap index**（大站分片 `<sitemapindex>`）——多数目标用户无需，YAGNI。
- **不做 robots.txt 反向解析**（粘贴文本→可视化）——单向生成即可，避免复杂度。
- **不做 URL 自动发现/抓取**（无后端，无法抓取站点）。
- **不做 `.htaccess` / meta robots 标签**生成——超出本工具范围。
- **不做 crawl-delay 默认暴露**——Google 早已不支持 `Crawl-delay`，仅作为可选高级项且标注已废弃。

---

## 3. 工具一：robots.txt 生成器

### 3.1 路由与文件

| 类型 | 路径 |
|---|---|
| 页面 | `src/pages/devops/robots-generator.astro` |
| 组件 | `src/tools/devops/RobotsGenerator.vue` |
| 逻辑 | `src/utils/devops/robots-generator.ts` |
| AI 清单 | `src/utils/devops/ai-crawlers.ts` |
| 测试 | `src/utils/devops/__tests__/robots-generator.test.ts` |
| URL | `/devops/robots-generator` |
| 图标 | `🤖` |

> **铁律**：`tools.ts` 注册的 `id` 必须等于 `robots-generator`（path 末段），否则 FAQ/相关工具/SEO 结构化数据静默失效。

### 3.2 数据模型

```ts
/** 单条路径规则类型 */
type RuleType = 'allow' | 'disallow';

/** 一条 Allow/Disallow 路径规则 */
interface PathRule {
  id: string;
  type: RuleType;
  path: string; // 如 '/private/'、'/search'、'/*?$'
}

/** 一个 User-agent 规则组（标准支持多 UA 共享同一组规则） */
interface AgentGroup {
  id: string;
  userAgents: string[]; // 如 ['*']、['GPTBot']、['GPTBot', 'OAI-SearchBot']
  rules: PathRule[];
}

/** 完整 robots.txt 数据 */
interface RobotsData {
  groups: AgentGroup[];
  sitemaps: string[]; // Sitemap: 引用
}
```

### 3.3 UI（`ResponsiveWorkspace` 左右布局，参照 MetaTagGenerator）

**左侧表单区**

- **规则组卡片列表**：每张卡片 = 一个规则组
  - User-agent 输入框（旁注「`*` = 所有搜索引擎爬虫」）。**v1 每组仅支持单个 UA**（`userAgents` 数组始终长度为 1）；多 UA 共享规则作为后续扩展，不在本期范围
  - 该组的 Allow/Disallow 路径列表（每条：类型下拉 + 路径输入 + 删除按钮）
  - 「删除该组」按钮
  - 「+ 添加规则组」按钮（位于列表底部）
- **🤖 AI 爬虫一键拦截**（亮点，独立分区）：
  - 一组 `ToggleSwitch`，每个对应一个主流 AI 训练爬虫，旁边标注中文归属（如「GPTBot · OpenAI/ChatGPT」）
  - 「全选 / 全不选」+ 一个「一键拦截所有 AI 爬虫」主开关
  - 勾选即**自动追加**对应规则组：`User-agent: <bot>` + `Disallow: /`。该组用专用 id 前缀（如 `ai:`）标记，与手动组物理隔离——**取消勾选仅移除对应的 `ai:` 组，不影响任何手动组**。若用户手动已存在同 UA 的规则组，二者并存（生成文本中手动组在前、`ai:` 组在后；不自动合并，保持逻辑简单）。UI 上 `ai:` 组显示「AI 拦截」徽标且只读（不可编辑路径，只能通过开关增删）。
- **Sitemap 引用区**：可添加多条 `Sitemap: <url>`（自然衔接 sitemap 工具）

**右侧输出区（`CodePanel`）**

- 实时生成的 robots.txt 文本（`computed` 派生）
- 「复制结果」按钮（`useCopy`）
- 「下载 `robots.txt`」按钮（见 §5 共享下载）

### 3.4 AI 爬虫清单（`ai-crawlers.ts`，带中文归属）

实现时以最新公开清单为准，初版包含：

| User-agent | 归属 |
|---|---|
| `GPTBot` | OpenAI / ChatGPT |
| `OAI-SearchBot` | OpenAI 搜索 |
| `ChatGPT-User` | ChatGPT 用户触发抓取 |
| `ClaudeBot` | Anthropic / Claude |
| `Claude-Web` | Anthropic |
| `anthropic-ai` | Anthropic |
| `Google-Extended` | Google / Gemini 训练 |
| `PerplexityBot` | Perplexity |
| `CCBot` | Common Crawl（众多模型训练数据源） |
| `Amazonbot` | Amazon |
| `Bytespider` | 字节跳动 / 豆包 |
| `Applebot-Extended` | Apple 训练 |
| `Meta-ExternalAgent` | Meta |
| `cohere-ai` | Cohere |
| `Diffbot` | Diffbot |
| `ChatGLM-Spider` | 智谱 AI / ChatGLM |
| `DeepSeekBot` | 深度求索 / DeepSeek |

> 默认全部**不勾选**，由用户主动开启；提供全选开关。
>
> **真实性与来源**：以上 User-agent 全部经开源权威清单 [ai-robots-txt/ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt)（源自 Dark Visitors，实时维护）核验，**无编造**。对中文用户额外收录智谱、深度求索两个主流中文 AI 爬虫。实现时以最新公开清单为准，清单独立存放于 `ai-crawlers.ts` 便于后续更新。

### 3.5 规则解释（亮点，文案以 RFC 9309 + Google 规范为依据）

在对应输入下方常驻通俗提示，关键文案：

| 规则 | 解释文案 |
|---|---|
| `User-agent: *` | 匹配所有搜索引擎爬虫，是站点的默认规则 |
| `User-agent: <具体bot>` | 仅对指定爬虫生效；同组多个 UA 共享下方规则 |
| `Disallow:` （空） | 允许抓取整站 |
| `Disallow: /` | 禁止该爬虫抓取**整站** |
| `Disallow: /private/` | 禁止抓取 `/private/` 目录及其下所有子路径 |
| `Allow: /public/` | 显式允许抓取，通常用于在 Disallow 范围内开例外 |
| `*` 通配符 | 匹配任意字符序列（如 `/*.pdf` 拦截所有 PDF） |
| `$` 锚点 | 标记路径结尾（如 `/$` 仅匹配首页） |
| `Sitemap:` | 告知搜索引擎 sitemap.xml 的位置 |

**冲突解析说明**（高级提示，可选展示）：当 Allow 与 Disallow 同时匹配某 URL 时——**最长（最具体）匹配路径优先**；若路径长度相同，**Allow 优先于 Disallow**。规则在文件中的物理顺序不影响优先级。路径匹配**区分大小写**。

来源：[Google robots.txt 规范](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)、RFC 9309。

### 3.6 输出格式

标准 robots.txt 文本，按组顺序输出，每组内 UA 行在前、规则行在后，`Sitemap:` 行统一置于文件末尾。组与组之间空一行分隔。例如：

```text
User-agent: *
Disallow: /admin/

User-agent: GPTBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
```

### 3.7 默认值（开箱即可体验）

- 一个 `User-agent: *` 组，含一条示例 `Disallow: /admin/`。
- 不勾选任何 AI 拦截（用户主动开启）。
- 不预填 Sitemap（留空示例占位）。

### 3.8 校验

- User-agent 非空、不含非法字符（冒号、换行）。
- 路径以 `/` 开头（提示，不强制阻断）。
- Sitemap URL 用 `isValidHttpUrl` 校验。

---

## 4. 工具二：sitemap.xml 生成器

### 4.1 路由与文件

| 类型 | 路径 |
|---|---|
| 页面 | `src/pages/devops/sitemap-generator.astro` |
| 组件 | `src/tools/devops/SitemapGenerator.vue` |
| 逻辑 | `src/utils/devops/sitemap-generator.ts` |
| 测试 | `src/utils/devops/__tests__/sitemap-generator.test.ts` |
| URL | `/devops/sitemap-generator` |
| 图标 | `🗺️` |

> **铁律**：`id` = `sitemap-generator`。

### 4.2 数据模型

```ts
/** sitemap 允许的更新频率枚举（sitemaps.org 协议） */
type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

/** 一条 URL 记录 */
interface SitemapUrl {
  id: string;
  loc: string;        // 完整 URL，必填
  lastmod?: string;   // YYYY-MM-DD，主推字段（Google 唯一参考）
  changefreq?: ChangeFreq;
  priority?: number;  // 0.0 - 1.0
}

/** 完整 sitemap 数据 */
interface SitemapData {
  urls: SitemapUrl[];
}
```

### 4.3 UI（左右布局）

**左侧表单区**

- **批量粘贴区**（可折叠，默认展开）：一个 `textarea`，提示「一行一个 URL」，「解析」按钮 → 按行拆分、去空行去重、自动生成 `SitemapUrl` 条目追加到列表。
- **URL 卡片列表**：每条卡片
  - `loc`（URL 输入，主字段）
  - `lastmod`（日期选择，**主推字段**，置于显眼位置）
  - `changefreq`（下拉：always/hourly/.../never）
  - `priority`（下拉或步进：0.0–1.0，步长 0.1）
  - 删除按钮
- 「+ 添加 URL」按钮

**右侧输出区（`CodePanel`）**

- 顶部一个**全局诚实提示框**（InfoPanel 风格）：「Google 仅参考 `<lastmod>`，已忽略 `<priority>` 与 `<changefreq>`。」
- 实时生成的 sitemap.xml 文本
- 「复制结果」+ 「下载 `sitemap.xml`」

### 4.4 规则解释（亮点，文案以 Google Search Central 官方文档为依据）

| 字段 | 解释文案 |
|---|---|
| `lastmod` | **最后修改时间——搜索引擎当前唯一真正参考的字段**，建议如实填写；人为篡改日期不会提升 SEO |
| `changefreq` | 预期更新频率。注意：**Google 等现已完全忽略此字段**，仅作参考 |
| `priority` | 站内相对优先级（0.0–1.0）。注意：**Google 等现已完全忽略此字段**，对排名/抓取无实际影响 |
| `loc` | 页面完整 URL（须含协议 http/https），必填 |

来源：[Google Search Central – Build and Submit a Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[Google Search Central Blog (2023-06)](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping)。

### 4.5 输出格式

标准 sitemap.xml，UTF-8、`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`。仅输出有值的子元素。例如：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-06-24</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

> XML 转义：`loc` 等文本中的 `&`、`<`、`>`、`"`、`'` 必须转义，实现须覆盖（含 `&` 在 query string 的常见场景）。

### 4.6 默认值

- 3–4 条示例 URL（如首页 `/`、`/about`、`/blog`），带合理的 `lastmod`、`changefreq=weekly`、`priority` 递减。

### 4.7 校验

- `loc` 用 `isValidHttpUrl`（复用 `meta-generator`）。
- `priority` 限 [0, 1]；超出范围时 clamp 到边界值（0 或 1）并就地提示，不阻断输入。
- `lastmod` 校验为合法日期格式。

---

## 5. 共享设计

### 5.1 实现路径

严格跟随 `meta-tag-generator` 既有模式：页面 `.astro` 挂 `client:idle` + `.vue` 交互组件 + `utils/devops/*.ts` 纯逻辑（可单测）+ `tools.ts` / `tool-faqs.ts` 注册。

### 5.2 复用组件

`ToolHeader`、`ResponsiveWorkspace`、`CodePanel`、`ToggleSwitch`、`SelectListbox`、`ModeTabGroup`（如需）、`useCopy`。

### 5.3 下载文件

两个工具都需「下载」。实现第一步先搜索项目现有下载逻辑（如 `image-converter` 导出），**有则复用**；无则在 `src/utils/shared/` 新建 `downloadTextFile(filename: string, content: string): void`，用 `Blob` + `URL.createObjectURL` + 触发 `<a download>` + `revokeObjectURL`。该函数须写 JSDoc。

### 5.4 SEO 注册

- `src/data/tools.ts`：新增两条，`id` 严格等于 path 末段，填写 `description` / `seoDescription` / `keywords` / `relatedToolIds`（二者互设相关工具，并可关联 `meta-tag-generator`）。
- `src/data/tool-faqs.ts`：各加 FAQ（如 robots：「如何屏蔽 ChatGPT/Gemini 抓取？」；sitemap：「priority 和 changefreq 还有用吗？」——直接呼应诚实提示）。

### 5.5 测试（Vitest）

纯逻辑函数单测，覆盖：

- `robots-generator`：分组→文本生成（顺序、空行、Sitemap 末尾）、AI 拦截组生成/移除、空数据兜底、非法字符处理。
- `sitemap-generator`：URL 列表→XML 生成、XML 转义（`&`、`<`、`>`）、批量粘贴解析（去空行/去重/去空白）、空 `urls` 兜底。
- `ai-crawlers`：清单完整性（每项含 user-agent + 归属）。

### 5.6 样式规范

遵循 `CLAUDE.md` Styling Conventions：优先 Tailwind 标准类名（4px 基准），禁止可用标准类名替代的任意值语法；设计令牌值（label/sidebar-heading 字号）用任意值合法。

### 5.7 注释规范

公共函数/类型（`generateRobotsTxt`、`generateSitemapXml`、`parseBulkUrls`、`AI_CRAWLERS`、`downloadTextFile` 等）必须写 JSDoc/TSDoc。

---

## 6. 风险与验证

| 风险 | 缓解 |
|---|---|
| **Astro SSG 容忍 Vue SSR 错误**：构建/类型/单测全过但页面运行时白屏 | 实现后必须 `pnpm dev` 浏览器实测两个页面；警惕模板字符串 `${}` 被插值、`watch` 标志须 `nextTick` 重置 |
| AI 爬虫清单时效性 | 清单独立于 `ai-crawlers.ts`，便于后续更新；spec 注明「以最新公开清单为准」 |
| XML 转义遗漏导致生成无效 sitemap | 单测覆盖 `&`/`<`/`>` 等场景 |
| `id` ≠ path 末段导致结构化数据静默失效 | spec 已强调铁律；实现后核对 |
| `isValidHttpUrl` 复用路径 | 相对路径 `../../utils/devops/meta-generator`，确认其已导出（IDE 新文件索引延迟可能假阳性，以 vitest 为准） |

---

## 7. 验收标准

1. `/devops/robots-generator` 与 `/devops/sitemap-generator` 均可正常访问、`pnpm dev` 实测无白屏。
2. robots：可增删规则组与路径规则；AI 拦截开关能正确追加/移除 `Disallow: /` 组；生成文本格式标准。
3. sitemap：逐条添加与批量粘贴均可用；XML 转义正确；诚实提示框显示。
4. 两个工具均支持复制 + 下载。
5. `pnpm test`（新增单测）、`pnpm astro check`、`pnpm build` 全部通过。
6. `tools.ts` / `tool-faqs.ts` 注册完整，`id` 与 path 末段一致。
7. 公共 API 均有 JSDoc/TSDoc；Tailwind 类名符合规范。
