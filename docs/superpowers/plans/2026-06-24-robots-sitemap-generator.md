# robots.txt / sitemap.xml 生成器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增两个独立 DevOps 工具——`/devops/robots-generator`(按 User-agent 分组的 robots.txt 生成器 + AI 爬虫一键拦截)与 `/devops/sitemap-generator`(逐条/批量录入的 sitemap.xml 生成器 + 基于官方文档的诚实字段提示),纯浏览器端运算。

**Architecture:** 严格跟随现有 `meta-tag-generator` 模式:页面 `.astro`(仅传 `toolId` 给 `ToolLayout`)+ Vue 组件 `client:idle` + `utils/devops/*.ts` 纯逻辑(可单测)+ `tools.ts`/`tool-faqs.ts` 注册。两工具各自独立成页,共享一个新建的文本下载工具函数。

**Tech Stack:** Astro 6 + Vue 3 `<script setup lang="ts">` + Tailwind v4 + @headlessui/vue + Vitest(node 环境)。

## Global Constraints

- **Node >=22.12.0**,包管理器 **pnpm**,无路径别名(全部相对路径)。
- **`id` 必须等于 path 末段**:`robots-generator` / `sitemap-generator`(否则 FAQ/相关工具/SEO 结构化数据静默失效)。
- **toolId 格式**:`devops/robots-generator` / `devops/sitemap-generator`(categorySlug/toolSlug)。
- **tool-faqs.ts 用短 id 索引**:`'robots-generator'` / `'sitemap-generator'`。
- **禁止** `eval()`/`Function()`/`setTimeout(string)`;正则用 `new RegExp` + try-catch。
- **Tailwind**:优先标准类名(4px 基准),label 字号用任意值 `text-[0.8125rem]`(设计令牌,合法)。
- **公共 API 必须 JSDoc/TSDoc**;简单 getter/工厂除外。
- **SSR 风险**:Vue 组件默认数据中的 id 用**固定字符串字面量**(避免 SSR/水合 id 不匹配);运行时新增项用 `crypto.randomUUID()`。
- **页面验证铁律**:构建/类型/单测全过 ≠ 页面正常。每个组件 task 收尾必须 `pnpm dev` 浏览器实测,警惕模板字符串 `${}` 被插值、空白数据。

---

## File Structure

| 文件 | 职责 | task |
|---|---|---|
| `src/utils/shared/download.ts` | **新建** 共享文本下载 `downloadTextFile` | 1 |
| `src/utils/shared/__tests__/download.test.ts` | 下载函数单测 | 1 |
| `src/utils/devops/ai-crawlers.ts` | **新建** AI 爬虫清单常量 + 类型 | 2 |
| `src/utils/devops/robots-generator.ts` | **新建** robots 数据模型 + 生成/工厂函数 | 2 |
| `src/utils/devops/__tests__/robots-generator.test.ts` | robots 逻辑单测 | 2 |
| `src/tools/devops/RobotsGenerator.vue` | **新建** robots 交互组件 | 3 |
| `src/pages/devops/robots-generator.astro` | **新建** robots 页面 | 3 |
| `src/utils/devops/sitemap-generator.ts` | **新建** sitemap 数据模型 + 生成/转义/解析函数 | 4 |
| `src/utils/devops/__tests__/sitemap-generator.test.ts` | sitemap 逻辑单测 | 4 |
| `src/tools/devops/SitemapGenerator.vue` | **新建** sitemap 交互组件 | 5 |
| `src/pages/devops/sitemap-generator.astro` | **新建** sitemap 页面 | 5 |
| `src/data/tools.ts` | **修改** 注册两条工具 + 互设 relatedToolIds | 3, 5 |
| `src/data/tool-faqs.ts` | **修改** 加两组 FAQ | 3, 5 |

---

## Task 1: 共享文本下载工具函数

**Files:**
- Create: `src/utils/shared/download.ts`
- Test: `src/utils/shared/__tests__/download.test.ts`

**Interfaces:**
- Produces: `downloadTextFile(filename: string, content: string, mimeType?: string): void` — 供 Task 3 / Task 5 组件调用。

- [ ] **Step 1: 写失败测试**

创建 `src/utils/shared/__tests__/download.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadTextFile } from '../download';

describe('downloadTextFile', () => {
  beforeEach(() => {
    const anchor = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('设置文件名并触发点击，随后释放 objectURL', () => {
    downloadTextFile('robots.txt', 'User-agent: *');

    const doc = document as unknown as { createElement: ReturnType<typeof vi.fn> };
    const a = doc.createElement.mock.results[0].value as {
      href: string; download: string; click: ReturnType<typeof vi.fn>;
    };
    expect(a.download).toBe('robots.txt');
    expect(a.href).toBe('blob:mock');
    expect(a.click).toHaveBeenCalledOnce();

    const url = URL as unknown as { revokeObjectURL: ReturnType<typeof vi.fn> };
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/shared/__tests__/download.test.ts`
Expected: FAIL — `Failed to resolve import "../download"`

- [ ] **Step 3: 实现 `downloadTextFile`**

创建 `src/utils/shared/download.ts`:

```ts
/**
 * 通用文本文件下载。
 *
 * 将文本内容封装为 Blob 并通过临时 <a download> 触发浏览器下载，
 * 下载完成后立即释放 objectURL，避免内存泄漏。
 * @param filename - 下载文件名（如 'robots.txt'）
 * @param content - 文件文本内容
 * @param mimeType - MIME 类型，默认 'text/plain;charset=utf-8'
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/shared/__tests__/download.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: 提交**

```bash
git add src/utils/shared/download.ts src/utils/shared/__tests__/download.test.ts
git commit -m "feat(shared): add downloadTextFile util for text file download"
```

---

## Task 2: robots.txt 核心逻辑 + AI 爬虫清单

**Files:**
- Create: `src/utils/devops/ai-crawlers.ts`
- Create: `src/utils/devops/robots-generator.ts`
- Test: `src/utils/devops/__tests__/robots-generator.test.ts`

**Interfaces:**
- Produces:
  - `AI_CRAWLERS: readonly AiCrawler[]`（来自 `ai-crawlers.ts`）
  - 类型:`RuleType`、`PathRule`、`AgentGroup`、`RobotsData`
  - `generateRobotsTxt(data: RobotsData): string`
  - `buildAiBlockGroups(agents: string[]): AgentGroup[]`
  - `createAgentGroup(userAgent: string): AgentGroup`、`createPathRule(type: RuleType, path: string): PathRule`
- Consumes: 无（纯逻辑）

- [ ] **Step 1: 创建 AI 爬虫清单**

创建 `src/utils/devops/ai-crawlers.ts`:

```ts
/** AI 训练爬虫条目 */
export interface AiCrawler {
  /** robots.txt 中的 User-agent 标识 */
  userAgent: string;
  /** 中文归属说明（展示用） */
  vendor: string;
}

/**
 * 主流 AI 训练爬虫清单。
 *
 * 全部经开源权威清单 ai-robots-txt/ai.robots.txt（源自 Dark Visitors）
 * 逐项核验，无编造；对中文用户额外收录智谱、深度求索。
 * 清单独立存放，便于后续按最新公开清单更新。
 */
export const AI_CRAWLERS: readonly AiCrawler[] = [
  { userAgent: 'GPTBot', vendor: 'OpenAI / ChatGPT' },
  { userAgent: 'OAI-SearchBot', vendor: 'OpenAI 搜索' },
  { userAgent: 'ChatGPT-User', vendor: 'ChatGPT 用户触发抓取' },
  { userAgent: 'ClaudeBot', vendor: 'Anthropic / Claude' },
  { userAgent: 'Claude-Web', vendor: 'Anthropic' },
  { userAgent: 'anthropic-ai', vendor: 'Anthropic' },
  { userAgent: 'Google-Extended', vendor: 'Google / Gemini 训练' },
  { userAgent: 'PerplexityBot', vendor: 'Perplexity' },
  { userAgent: 'CCBot', vendor: 'Common Crawl（众多模型训练数据源）' },
  { userAgent: 'Amazonbot', vendor: 'Amazon' },
  { userAgent: 'Bytespider', vendor: '字节跳动 / 豆包' },
  { userAgent: 'Applebot-Extended', vendor: 'Apple 训练' },
  { userAgent: 'Meta-ExternalAgent', vendor: 'Meta' },
  { userAgent: 'cohere-ai', vendor: 'Cohere' },
  { userAgent: 'Diffbot', vendor: 'Diffbot' },
  { userAgent: 'ChatGLM-Spider', vendor: '智谱 AI / ChatGLM' },
  { userAgent: 'DeepSeekBot', vendor: '深度求索 / DeepSeek' },
];
```

- [ ] **Step 2: 写失败测试**

创建 `src/utils/devops/__tests__/robots-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  generateRobotsTxt,
  buildAiBlockGroups,
  type RobotsData,
} from '../robots-generator';
import { AI_CRAWLERS } from '../ai-crawlers';

describe('generateRobotsTxt', () => {
  it('按组顺序输出 User-agent 与规则，组间空行分隔', () => {
    const data: RobotsData = {
      groups: [
        {
          id: 'g1',
          userAgents: ['*'],
          rules: [
            { id: 'r1', type: 'disallow', path: '/admin/' },
            { id: 'r2', type: 'allow', path: '/admin/login/' },
          ],
        },
      ],
      sitemaps: [],
    };
    expect(generateRobotsTxt(data)).toBe(
      'User-agent: *\nDisallow: /admin/\nAllow: /admin/login/',
    );
  });

  it('空规则组保留 Disallow: 兜底（表示允许全部）', () => {
    const data: RobotsData = {
      groups: [{ id: 'g1', userAgents: ['*'], rules: [] }],
      sitemaps: [],
    };
    expect(generateRobotsTxt(data)).toBe('User-agent: *\nDisallow:');
  });

  it('多组之间空行分隔，Sitemap 置于文件末尾', () => {
    const data: RobotsData = {
      groups: [
        { id: 'g1', userAgents: ['*'], rules: [{ id: 'r1', type: 'disallow', path: '/private/' }] },
        { id: 'g2', userAgents: ['BadBot'], rules: [{ id: 'r2', type: 'disallow', path: '/' }] },
      ],
      sitemaps: ['https://example.com/sitemap.xml'],
    };
    expect(generateRobotsTxt(data)).toBe(
      'User-agent: *\nDisallow: /private/\n\n' +
      'User-agent: BadBot\nDisallow: /\n\n' +
      'Sitemap: https://example.com/sitemap.xml',
    );
  });

  it('无任何组时仅输出 Sitemap 行', () => {
    const data: RobotsData = { groups: [], sitemaps: ['https://x.com/s.xml'] };
    expect(generateRobotsTxt(data)).toBe('Sitemap: https://x.com/s.xml');
  });

  it('完全空数据返回空串', () => {
    expect(generateRobotsTxt({ groups: [], sitemaps: [] })).toBe('');
  });
});

describe('buildAiBlockGroups', () => {
  it('为每个爬虫生成独立的 Disallow: / 拦截组，id 以 ai: 前缀标记', () => {
    const groups = buildAiBlockGroups(['GPTBot', 'ClaudeBot']);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      id: 'ai:GPTBot',
      userAgents: ['GPTBot'],
      rules: [{ id: 'ai:GPTBot:rule', type: 'disallow', path: '/' }],
      isAiBlock: true,
    });
    expect(groups[1].userAgents).toEqual(['ClaudeBot']);
  });

  it('空列表返回空数组', () => {
    expect(buildAiBlockGroups([])).toEqual([]);
  });
});

describe('AI_CRAWLERS 清单', () => {
  it('每项含 userAgent 与 vendor，且 userAgent 唯一', () => {
    const uas = AI_CRAWLERS.map((c) => c.userAgent);
    expect(new Set(uas).size).toBe(uas.length);
    for (const c of AI_CRAWLERS) {
      expect(typeof c.vendor).toBe('string');
      expect(c.vendor.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test src/utils/devops/__tests__/robots-generator.test.ts`
Expected: FAIL — `Failed to resolve import "../robots-generator"`

- [ ] **Step 4: 实现 robots-generator.ts**

创建 `src/utils/devops/robots-generator.ts`:

```ts
/** 规则类型 */
export type RuleType = 'allow' | 'disallow';

/** 一条 Allow / Disallow 路径规则 */
export interface PathRule {
  id: string;
  type: RuleType;
  /** 路径，如 '/private/'、'/*?$' */
  path: string;
}

/** 一个 User-agent 规则组（v1 每组单个 UA） */
export interface AgentGroup {
  id: string;
  userAgents: string[];
  rules: PathRule[];
  /** 是否由 AI 拦截自动生成（只读，与手动组区分，移除时按 id 精确匹配） */
  isAiBlock?: boolean;
}

/** 完整 robots.txt 数据 */
export interface RobotsData {
  groups: AgentGroup[];
  /** Sitemap: 引用 URL 列表 */
  sitemaps: string[];
}

/**
 * 将 robots 数据生成为标准 robots.txt 文本。
 *
 * 按组顺序输出：每组 User-agent 行在前、Allow/Disallow 规则行在后；
 * 组间以空行分隔；Sitemap 行统一置于文件末尾。
 * @param data - robots 数据
 * @returns 标准 robots.txt 文本
 */
export function generateRobotsTxt(data: RobotsData): string {
  const blocks: string[] = [];

  for (const group of data.groups) {
    if (group.userAgents.length === 0) continue;
    const lines: string[] = group.userAgents.map((ua) => `User-agent: ${ua}`);
    if (group.rules.length === 0) {
      lines.push('Disallow:');
    } else {
      for (const rule of group.rules) {
        const key = rule.type === 'allow' ? 'Allow' : 'Disallow';
        lines.push(`${key}: ${rule.path}`);
      }
    }
    blocks.push(lines.join('\n'));
  }

  const groupText = blocks.join('\n\n');
  if (data.sitemaps.length === 0) return groupText;

  const sitemapText = data.sitemaps.map((s) => `Sitemap: ${s}`).join('\n');
  return groupText ? `${groupText}\n\n${sitemapText}` : sitemapText;
}

/**
 * 根据已勾选的 AI 爬虫列表生成拦截规则组。
 *
 * 每个爬虫一个独立组：`User-agent: <bot>` + `Disallow: /`。
 * 组 id 固定为 `ai:<bot>`，便于取消勾选时按 id 精确移除。
 * @param agents - 已勾选的爬虫 User-agent 列表
 * @returns AI 拦截规则组数组
 */
export function buildAiBlockGroups(agents: string[]): AgentGroup[] {
  return agents.map((ua) => ({
    id: `ai:${ua}`,
    userAgents: [ua],
    rules: [{ id: `ai:${ua}:rule`, type: 'disallow', path: '/' }],
    isAiBlock: true,
  }));
}

/** 新建一个空规则组（运行时交互用，id 随机生成）。 */
export function createAgentGroup(userAgent: string): AgentGroup {
  return { id: crypto.randomUUID(), userAgents: [userAgent], rules: [] };
}

/** 新建一条路径规则（运行时交互用，id 随机生成）。 */
export function createPathRule(type: RuleType, path: string): PathRule {
  return { id: crypto.randomUUID(), type, path };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test src/utils/devops/__tests__/robots-generator.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: 提交**

```bash
git add src/utils/devops/ai-crawlers.ts src/utils/devops/robots-generator.ts src/utils/devops/__tests__/robots-generator.test.ts
git commit -m "feat(devops): add robots.txt generator core logic and AI crawler list"
```

---

## Task 3: robots.txt 工具页面（组件 + 注册 + FAQ）

**Files:**
- Create: `src/tools/devops/RobotsGenerator.vue`
- Create: `src/pages/devops/robots-generator.astro`
- Modify: `src/data/tools.ts`（在 `meta-tag-generator` 条目后插入）
- Modify: `src/data/tool-faqs.ts`（新增 `'robots-generator'` 条目）

**Interfaces:**
- Consumes: Task 1 `downloadTextFile`、Task 2 `generateRobotsTxt`/`buildAiBlockGroups`/`createAgentGroup`/`createPathRule`/`AI_CRAWLERS`、`useCopy`
- Produces: 可访问的 `/devops/robots-generator` 页面

- [ ] **Step 1: 创建页面 .astro**

创建 `src/pages/devops/robots-generator.astro`:

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import RobotsGenerator from '../../tools/devops/RobotsGenerator.vue';
---

<ToolLayout toolId="devops/robots-generator">
  <RobotsGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 2: 在 tools.ts 注册工具**

在 `src/data/tools.ts` 的 `meta-tag-generator` 条目（`relatedToolIds: ['docker-converter', 'env-converter']` 那条）之后，插入：

```ts
  {
    id: 'robots-generator',
    name: 'robots.txt 生成器',
    description: '按 User-agent 分组可视化添加 Allow/Disallow 规则，一键拦截 GPTBot、ClaudeBot 等 AI 训练爬虫，生成标准 robots.txt',
    seoDescription: '在线 robots.txt 生成器，按 User-agent 分组可视化添加 Allow/Disallow 规则，一键禁止 GPTBot、ClaudeBot、Google-Extended 等主流 AI 训练爬虫抓取，配通俗规则解释，纯浏览器端生成可复制下载。',
    category: 'DevOps 工具',
    icon: '🤖',
    path: '/devops/robots-generator',
    keywords: ['robots.txt 生成', 'robots 生成器', '屏蔽 ai 爬虫', '拦截 gptbot', '拦截 claudebot', '拦截 google-extended', 'disallow 规则', 'user-agent 规则', '禁止 ai 抓取', 'seo robots'],
    relatedToolIds: ['sitemap-generator', 'meta-tag-generator'],
  },
```

- [ ] **Step 3: 在 tool-faqs.ts 加 FAQ**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中，新增键 `'robots-generator'`（放在任意已有键之后）：

```ts
  'robots-generator': [
    {
      question: '如何一键屏蔽 ChatGPT、Gemini、Claude 等 AI 抓取？',
      answer: '在「AI 爬虫一键拦截」区勾选对应爬虫（如 <code>GPTBot</code>、<code>Google-Extended</code>、<code>ClaudeBot</code>），或点击「一键拦截所有 AI 爬虫」全选。工具会自动为每个爬虫生成 <code>User-agent: &lt;bot&gt;</code> + <code>Disallow: /</code> 规则组，禁止其抓取整站。',
    },
    {
      question: 'Allow 和 Disallow 冲突时谁优先？',
      answer: '按 <strong>最长（最具体）匹配路径优先</strong>；若两者匹配的路径长度相同，则 <strong>Allow 优先于 Disallow</strong>。规则在文件中的书写顺序不影响优先级，路径匹配区分大小写。',
    },
    {
      question: 'robots.txt 能阻止搜索引擎收录吗？',
      answer: '不能完全保证。robots.txt 只是「请求」爬虫不要抓取，已被收录的 URL 仍可能出现在搜索结果（仅不显示摘要）。若要彻底移除，应配合 <code>noindex</code> meta 标签或搜索引擎后台的移除工具。',
    },
  ],
```

- [ ] **Step 4: 创建 RobotsGenerator.vue 组件**

创建 `src/tools/devops/RobotsGenerator.vue`（完整代码）:

```vue
<script setup lang="ts">
/**
 * robots.txt 生成器主组件。
 *
 * 左侧表单按 User-agent 分组维护 Allow/Disallow 规则，并提供 AI 爬虫
 * 一键拦截区与 Sitemap 引用区；右侧实时输出标准 robots.txt 文本，
 * 支持复制与下载。规则输入旁常驻通俗规则解释。
 */
import { reactive, ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import { useCopy } from '../../composables/useCopy';
import { downloadTextFile } from '../../utils/shared/download';
import {
  generateRobotsTxt,
  buildAiBlockGroups,
  createAgentGroup,
  createPathRule,
  type AgentGroup,
  type PathRule,
  type RuleType,
} from '../../utils/devops/robots-generator';
import { AI_CRAWLERS } from '../../utils/devops/ai-crawlers';

/** 默认数据：id 用固定字面量，避免 SSR/水合不匹配 */
const groups = reactive<AgentGroup[]>([
  {
    id: 'group-default',
    userAgents: ['*'],
    rules: [{ id: 'rule-default', type: 'disallow', path: '/admin/' }],
  },
]);
const sitemaps = reactive<string[]>([]);
/** 已勾选的 AI 爬虫 User-agent 集合 */
const aiSelected = ref<Set<string>>(new Set());

/** 合并手动组 + AI 拦截组后的 robots 文本 */
const robotsText = computed(() =>
  generateRobotsTxt({
    groups: [...groups, ...buildAiBlockGroups([...aiSelected.value])],
    sitemaps,
  }),
);

/** 新增 UA 为空时使用的临时输入 */
const newSitemap = ref('');

/** 新增规则组 */
function addGroup(): void {
  groups.push(createAgentGroup('*'));
}
/** 删除规则组 */
function removeGroup(id: string): void {
  const idx = groups.findIndex((g) => g.id === id);
  if (idx !== -1) groups.splice(idx, 1);
}
/** 组内新增路径规则 */
function addRule(group: AgentGroup, type: RuleType): void {
  group.rules.push(createPathRule(type, '/'));
}
/** 删除组内某条规则 */
function removeRule(group: AgentGroup, ruleId: string): void {
  const idx = group.rules.findIndex((r) => r.id === ruleId);
  if (idx !== -1) group.rules.splice(idx, 1);
}

/** 切换单个 AI 爬虫拦截 */
function toggleAi(ua: string): void {
  const next = new Set(aiSelected.value);
  if (next.has(ua)) next.delete(ua);
  else next.add(ua);
  aiSelected.value = next;
}
/** 一键拦截 / 解除所有 AI 爬虫 */
const allAiBlocked = computed(
  () => AI_CRAWLERS.length > 0 && aiSelected.value.size === AI_CRAWLERS.length,
);
function toggleAllAi(): void {
  aiSelected.value = allAiBlocked.value
    ? new Set()
    : new Set(AI_CRAWLERS.map((c) => c.userAgent));
}

/** 新增 Sitemap 引用 */
function addSitemap(): void {
  const v = newSitemap.value.trim();
  if (v && !sitemaps.includes(v)) sitemaps.push(v);
  newSitemap.value = '';
}
/** 删除 Sitemap 引用 */
function removeSitemap(idx: number): void {
  sitemaps.splice(idx, 1);
}

const { copy: copyText } = useCopy();
function handleCopy(): void {
  copyText(robotsText.value);
}
function handleDownload(): void {
  downloadTextFile('robots.txt', robotsText.value, 'text/plain;charset=utf-8');
}

/** 清空全部 */
function handleClear(): void {
  groups.splice(0, groups.length);
  sitemaps.splice(0, sitemaps.length);
  aiSelected.value = new Set();
  newSitemap.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="robots.txt 生成器"
      description="按 User-agent 分组添加规则，一键拦截 AI 爬虫，实时生成标准 robots.txt"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入表单 -->
      <template #input>
        <div class="bg-card border border-border rounded-lg p-6 space-y-6">
          <!-- 规则组列表 -->
          <div class="space-y-4">
            <div
              v-for="group in groups"
              :key="group.id"
              class="border border-border rounded-md p-4 space-y-3"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="group.userAgents[0]"
                  type="text"
                  class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                  placeholder="User-agent（* 表示所有爬虫）"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-[0.8125rem] text-error border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="removeGroup(group.id)"
                >删除组</button>
              </div>
              <p class="text-[0.75rem] text-muted m-0">
                <code class="bg-hover px-1 py-0.5 rounded-sm">*</code> 匹配所有搜索引擎爬虫，是站点默认规则
              </p>

              <!-- 该组的路径规则 -->
              <div v-for="rule in group.rules" :key="rule.id" class="flex items-center gap-2">
                <select
                  v-model="rule.type"
                  class="px-2 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
                >
                  <option value="disallow">Disallow</option>
                  <option value="allow">Allow</option>
                </select>
                <input
                  v-model="rule.path"
                  type="text"
                  class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                  placeholder="/private/"
                />
                <button
                  type="button"
                  class="px-2 py-2 text-[0.8125rem] text-muted border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="removeRule(group, rule.id)"
                >✕</button>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-[0.8125rem] border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="addRule(group, 'disallow')"
                >+ Disallow</button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-[0.8125rem] border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="addRule(group, 'allow')"
                >+ Allow</button>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="addGroup"
          >+ 添加规则组</button>

          <!-- AI 爬虫一键拦截 -->
          <div class="border border-border rounded-md p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-text m-0">🤖 AI 爬虫一键拦截</h3>
              <button
                type="button"
                class="text-[0.8125rem] text-accent cursor-pointer bg-transparent border-none"
                @click="toggleAllAi"
              >{{ allAiBlocked ? '全部解除' : '拦截所有' }}</button>
            </div>
            <p class="text-[0.75rem] text-muted m-0">
              勾选即为该爬虫生成 <code class="bg-hover px-1 py-0.5 rounded-sm">Disallow: /</code>，禁止抓取整站
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleSwitch
                v-for="c in AI_CRAWLERS"
                :key="c.userAgent"
                :model-value="aiSelected.has(c.userAgent)"
                :label="`${c.userAgent} · ${c.vendor}`"
                @update:model-value="toggleAi(c.userAgent)"
              />
            </div>
          </div>

          <!-- Sitemap 引用 -->
          <div class="border border-border rounded-md p-4 space-y-2">
            <h3 class="text-sm font-semibold text-text m-0">Sitemap 引用</h3>
            <p class="text-[0.75rem] text-muted m-0">告知搜索引擎你的 sitemap.xml 位置</p>
            <div v-for="(s, idx) in sitemaps" :key="idx" class="flex items-center gap-2">
              <input
                :value="s"
                type="text"
                readonly
                class="flex-1 px-3 py-2 border border-border rounded-sm bg-hover text-text text-sm"
              />
              <button
                type="button"
                class="px-2 py-2 text-[0.8125rem] text-muted border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                @click="removeSitemap(idx)"
              >✕</button>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newSitemap"
                type="text"
                class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                placeholder="https://example.com/sitemap.xml"
                @keydown.enter.prevent="addSitemap"
              />
              <button
                type="button"
                class="px-3 py-2 text-sm border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                @click="addSitemap"
              >添加</button>
            </div>
          </div>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleClear"
          >清空</button>
        </div>
      </template>

      <!-- 输出区 -->
      <template #output>
        <div class="flex justify-end gap-2 mb-2">
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleDownload"
          >下载 robots.txt</button>
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleCopy"
          >复制结果</button>
        </div>
        <CodePanel label="robots.txt" :copy-text="robotsText" show-copy>
          <pre class="w-full p-4 bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap break-all">{{ robotsText }}</pre>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 5: 浏览器实测（防 SSR 白屏）**

Run: `pnpm dev`
打开 `http://localhost:4321/devops/robots-generator`，验证：
- 页面正常渲染（无白屏、无控制台报错）
- 默认显示 `User-agent: * / Disallow: /admin/`
- 增删规则组/规则、勾选 AI 爬虫、添加 Sitemap 均实时更新右侧文本
- 复制、下载按钮工作正常

- [ ] **Step 6: 类型检查 + 提交**

Run: `pnpm astro check`
Expected: 无错误（IDE 对新文件可能报假阳性「找不到模块」，以 astro check 为准）

```bash
git add src/tools/devops/RobotsGenerator.vue src/pages/devops/robots-generator.astro src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(devops): add robots.txt generator page with AI crawler blocking"
```

---

## Task 4: sitemap.xml 核心逻辑

**Files:**
- Create: `src/utils/devops/sitemap-generator.ts`
- Test: `src/utils/devops/__tests__/sitemap-generator.test.ts`

**Interfaces:**
- Produces:
  - 类型:`ChangeFreq`、`SitemapUrl`、`SitemapData`
  - `generateSitemapXml(data: SitemapData): string`
  - `escapeXml(s: string): string`
  - `parseBulkUrls(text: string): string[]`
- Consumes: 无

- [ ] **Step 1: 写失败测试**

创建 `src/utils/devops/__tests__/sitemap-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  generateSitemapXml,
  escapeXml,
  parseBulkUrls,
  type SitemapData,
} from '../sitemap-generator';

describe('escapeXml', () => {
  it('转义 & < > " 五个 XML 特殊字符', () => {
    expect(escapeXml('a&b<c>"d\'e')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e');
  });
});

describe('generateSitemapXml', () => {
  it('生成标准 urlset，仅输出有值字段', () => {
    const data: SitemapData = {
      urls: [
        { id: 'u1', loc: 'https://example.com/', lastmod: '2026-06-24', changefreq: 'weekly', priority: 1 },
      ],
    };
    expect(generateSitemapXml(data)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url>\n' +
      '    <loc>https://example.com/</loc>\n' +
      '    <lastmod>2026-06-24</lastmod>\n' +
      '    <changefreq>weekly</changefreq>\n' +
      '    <priority>1.0</priority>\n' +
      '  </url>\n' +
      '</urlset>',
    );
  });

  it('对 loc 中的 & < > 做 XML 转义', () => {
    const data: SitemapData = {
      urls: [{ id: 'u1', loc: 'https://example.com/?a=1&b=2' }],
    };
    const xml = generateSitemapXml(data);
    expect(xml).toContain('<loc>https://example.com/?a=1&amp;b=2</loc>');
  });

  it('过滤空 loc 的条目', () => {
    const data: SitemapData = {
      urls: [
        { id: 'u1', loc: '' },
        { id: 'u2', loc: 'https://example.com/' },
      ],
    };
    expect(generateSitemapXml(data)).toContain('<loc>https://example.com/</loc>');
    expect(generateSitemapXml(data)).not.toContain('<loc></loc>');
  });

  it('无有效条目时输出空 urlset', () => {
    const xml = generateSitemapXml({ urls: [] });
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>',
    );
  });

  it('changefreq 与 priority 为空字符串时不输出对应节点', () => {
    const xml = generateSitemapXml({
      urls: [{ id: 'u1', loc: 'https://example.com/', changefreq: '', priority: '' }],
    });
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });
});

describe('parseBulkUrls', () => {
  it('按行拆分、去空白、去重、保序', () => {
    const text = 'https://a.com/\n  https://b.com/  \nhttps://a.com/\n\nhttps://c.com/';
    expect(parseBulkUrls(text)).toEqual([
      'https://a.com/',
      'https://b.com/',
      'https://c.com/',
    ]);
  });

  it('空文本返回空数组', () => {
    expect(parseBulkUrls('')).toEqual([]);
    expect(parseBulkUrls('\n  \n')).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/devops/__tests__/sitemap-generator.test.ts`
Expected: FAIL — `Failed to resolve import "../sitemap-generator"`

- [ ] **Step 3: 实现 sitemap-generator.ts**

创建 `src/utils/devops/sitemap-generator.ts`:

```ts
/** sitemap 允许的更新频率（sitemaps.org 协议） */
export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

/** 一条 URL 记录 */
export interface SitemapUrl {
  id: string;
  /** 完整 URL，必填 */
  loc: string;
  /** 最后修改时间 YYYY-MM-DD（Google 唯一真正参考的字段） */
  lastmod?: string;
  /** 预期更新频率（Google 已忽略，仅作参考）；'' 表示未设置 */
  changefreq?: ChangeFreq | '';
  /** 站内相对优先级 0.0-1.0（Google 已忽略）；'' 表示未设置 */
  priority?: number | '';
}

/** 完整 sitemap 数据 */
export interface SitemapData {
  urls: SitemapUrl[];
}

/**
 * 转义 XML 文本中的特殊字符。
 *
 * `&` 必须最先处理，避免二次转义。
 * @param s - 原始字符串
 * @returns 转义后的 XML 安全字符串
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 将 sitemap 数据生成为标准 sitemap.xml 文本。
 *
 * 仅输出 loc 非空的条目；每条仅输出有值的子元素；loc 等文本经 escapeXml 转义。
 * @param data - sitemap 数据
 * @returns 标准 sitemap.xml 文本
 */
export function generateSitemapXml(data: SitemapData): string {
  const entries = data.urls
    .filter((u) => u.loc.trim() !== '')
    .map((u) => {
      const children: string[] = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) children.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
      if (u.changefreq) children.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (typeof u.priority === 'number') {
        children.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${children.join('\n')}\n  </url>`;
    });

  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  if (entries.length === 0) return `${header}\n</urlset>`;
  return `${header}\n${entries.join('\n')}\n</urlset>`;
}

/**
 * 解析批量粘贴文本为 URL 数组。
 *
 * 按行拆分，去除每行首尾空白与空行，按首次出现顺序去重。
 * @param text - 多行 URL 文本
 * @returns 去重保序的 URL 数组
 */
export function parseBulkUrls(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split('\n')) {
    const url = line.trim();
    if (url === '' || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/devops/__tests__/sitemap-generator.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 提交**

```bash
git add src/utils/devops/sitemap-generator.ts src/utils/devops/__tests__/sitemap-generator.test.ts
git commit -m "feat(devops): add sitemap.xml generator core logic"
```

---

## Task 5: sitemap.xml 工具页面（组件 + 注册 + FAQ）

**Files:**
- Create: `src/tools/devops/SitemapGenerator.vue`
- Create: `src/pages/devops/sitemap-generator.astro`
- Modify: `src/data/tools.ts`（插入 sitemap-generator 条目）
- Modify: `src/data/tool-faqs.ts`（新增 `'sitemap-generator'` 条目）

**Interfaces:**
- Consumes: Task 1 `downloadTextFile`、Task 4 `generateSitemapXml`/`parseBulkUrls`、`meta-generator` 的 `isValidHttpUrl`、`useCopy`
- Produces: 可访问的 `/devops/sitemap-generator` 页面

- [ ] **Step 1: 创建页面 .astro**

创建 `src/pages/devops/sitemap-generator.astro`:

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import SitemapGenerator from '../../tools/devops/SitemapGenerator.vue';
---

<ToolLayout toolId="devops/sitemap-generator">
  <SitemapGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 2: 在 tools.ts 注册工具**

在 `src/data/tools.ts` 的 `robots-generator` 条目之后插入：

```ts
  {
    id: 'sitemap-generator',
    name: 'sitemap.xml 生成器',
    description: '逐条或批量粘贴录入 URL，设置更新频率、优先级与最后修改时间，生成标准 sitemap.xml，诚实提示字段有效性',
    seoDescription: '在线 sitemap.xml 生成器，逐条添加或批量粘贴 URL 列表，设置 changefreq、priority 与 lastmod，生成标准 sitemap.xml 可复制下载，并诚实提示 priority/changefreq 已被 Google 忽略、仅 lastmod 有效，纯浏览器端生成。',
    category: 'DevOps 工具',
    icon: '🗺️',
    path: '/devops/sitemap-generator',
    keywords: ['sitemap.xml 生成', 'sitemap 生成器', '网站地图生成', 'sitemap 在线', 'url 列表转 sitemap', 'lastmod', 'changefreq', 'priority', '网站地图在线生成'],
    relatedToolIds: ['robots-generator', 'meta-tag-generator'],
  },
```

- [ ] **Step 3: 在 tool-faqs.ts 加 FAQ**

在 `src/data/tool-faqs.ts` 新增键 `'sitemap-generator'`：

```ts
  'sitemap-generator': [
    {
      question: 'priority 和 changefreq 现在还有用吗？',
      answer: '对 <strong>Google 已基本无效</strong>。Google 官方明确表示完全忽略 <code>&lt;priority&gt;</code> 与 <code>&lt;changefreq&gt;</code>，仅参考 <code>&lt;lastmod&gt;</code>（且仅当值真实准确时）。建议重点维护 lastmod，priority/changefreq 仅作其他引擎的参考。',
    },
    {
      question: 'sitemap.xml 对 SEO 有什么实际作用？',
      answer: '主要帮助搜索引擎<strong>发现和调度抓取</strong>你的页面，尤其对新站、内链稀少或内容频繁更新的站点。它不直接提升排名，但能让重要页面更快被收录。建议同时在 robots.txt 中用 <code>Sitemap:</code> 指令声明其位置。',
    },
    {
      question: 'sitemap 里的 URL 有数量限制吗？',
      answer: '单个 sitemap.xml 最多 <strong>50,000 条 URL</strong> 且压缩前不超过 <strong>50MB</strong>。超出需拆分为多个 sitemap 并用 sitemap index 引用（本工具暂不支持 index，可手工拆分）。',
    },
  ],
```

- [ ] **Step 4: 创建 SitemapGenerator.vue 组件**

创建 `src/tools/devops/SitemapGenerator.vue`（完整代码）:

```vue
<script setup lang="ts">
/**
 * sitemap.xml 生成器主组件。
 *
 * 左侧支持逐条添加与批量粘贴录入 URL，每条可设 lastmod/changefreq/priority；
 * 右侧实时输出标准 sitemap.xml，并置顶诚实提示 Google 仅参考 lastmod。
 */
import { reactive, ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import { useCopy } from '../../composables/useCopy';
import { downloadTextFile } from '../../utils/shared/download';
import {
  generateSitemapXml,
  parseBulkUrls,
  type SitemapUrl,
  type ChangeFreq,
} from '../../utils/devops/sitemap-generator';
import { isValidHttpUrl } from '../../utils/devops/meta-generator';

/** 更新频率可选项 */
const changefreqOptions: { value: ChangeFreq | ''; label: string }[] = [
  { value: '', label: '不设置' },
  { value: 'always', label: 'always' },
  { value: 'hourly', label: 'hourly' },
  { value: 'daily', label: 'daily' },
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
  { value: 'yearly', label: 'yearly' },
  { value: 'never', label: 'never' },
];

/** 优先级可选项 */
const priorityOptions: { value: number | ''; label: string }[] = [
  { value: '', label: '不设置' },
  { value: 1, label: '1.0' },
  { value: 0.8, label: '0.8' },
  { value: 0.6, label: '0.6' },
  { value: 0.4, label: '0.4' },
  { value: 0.2, label: '0.2' },
];

/** 默认 URL 列表（id 用固定字面量避免 SSR/水合不匹配） */
const urls = reactive<SitemapUrl[]>([
  { id: 'u1', loc: 'https://example.com/', lastmod: '2026-06-24', changefreq: 'weekly', priority: 1 },
  { id: 'u2', loc: 'https://example.com/about', lastmod: '2026-06-20', changefreq: 'monthly', priority: 0.8 },
  { id: 'u3', loc: 'https://example.com/blog', lastmod: '2026-06-24', changefreq: 'daily', priority: 0.6 },
]);

/** 批量粘贴文本 */
const bulkText = ref('');

const sitemapXml = computed(() => generateSitemapXml({ urls }));

/** 新增 URL */
function addUrl(): void {
  urls.push({ id: crypto.randomUUID(), loc: 'https://', lastmod: '', changefreq: '', priority: '' });
}
/** 删除 URL */
function removeUrl(id: string): void {
  const idx = urls.findIndex((u) => u.id === id);
  if (idx !== -1) urls.splice(idx, 1);
}

/** 解析批量粘贴并追加 */
function handleBulkImport(): void {
  const parsed = parseBulkUrls(bulkText.value);
  const existing = new Set(urls.map((u) => u.loc));
  for (const loc of parsed) {
    if (!existing.has(loc)) {
      urls.push({ id: crypto.randomUUID(), loc, lastmod: '', changefreq: '', priority: '' });
      existing.add(loc);
    }
  }
  bulkText.value = '';
}

/** 某条 loc 的校验提示 */
function locHint(u: SitemapUrl): string {
  if (u.loc.trim() === '') return '';
  return isValidHttpUrl(u.loc) ? '' : '建议使用完整 URL（以 https:// 开头）';
}

const { copy: copyText } = useCopy();
function handleCopy(): void {
  copyText(sitemapXml.value);
}
function handleDownload(): void {
  downloadTextFile('sitemap.xml', sitemapXml.value, 'application/xml;charset=utf-8');
}

function handleClear(): void {
  urls.splice(0, urls.length);
  bulkText.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="sitemap.xml 生成器"
      description="逐条或批量录入 URL，设置频率/优先级/修改时间，生成标准 sitemap.xml"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入表单 -->
      <template #input>
        <div class="bg-card border border-border rounded-lg p-6 space-y-6">
          <!-- 批量粘贴 -->
          <div class="border border-border rounded-md p-4 space-y-2">
            <h3 class="text-sm font-semibold text-text m-0">批量粘贴 URL</h3>
            <p class="text-[0.75rem] text-muted m-0">一行一个 URL，自动去重</p>
            <textarea
              v-model="bulkText"
              rows="4"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm resize-y box-border focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="https://example.com/&#10;https://example.com/about"
            ></textarea>
            <button
              type="button"
              class="px-4 py-2 text-sm border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
              @click="handleBulkImport"
            >解析并追加</button>
          </div>

          <!-- URL 列表 -->
          <div class="space-y-4">
            <div
              v-for="u in urls"
              :key="u.id"
              class="border border-border rounded-md p-4 space-y-3"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="u.loc"
                  type="text"
                  class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                  placeholder="https://example.com/page"
                />
                <button
                  type="button"
                  class="px-2 py-2 text-[0.8125rem] text-muted border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="removeUrl(u.id)"
                >✕</button>
              </div>
              <p v-if="locHint(u)" class="text-[0.75rem] text-error m-0">{{ locHint(u) }}</p>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label class="block mb-1 text-[0.75rem] text-muted">最后修改 lastmod</label>
                  <input
                    v-model="u.lastmod"
                    type="date"
                    class="w-full px-2 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <span class="block mb-1 text-[0.75rem] text-muted">频率 changefreq</span>
                  <SelectListbox v-model="u.changefreq" :options="changefreqOptions" class="w-full" />
                </div>
                <div>
                  <span class="block mb-1 text-[0.75rem] text-muted">优先级 priority</span>
                  <SelectListbox v-model="u.priority" :options="priorityOptions" class="w-full" />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="addUrl"
          >+ 添加 URL</button>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleClear"
          >清空</button>
        </div>
      </template>

      <!-- 输出区 -->
      <template #output>
        <!-- 诚实提示框 -->
        <div class="mb-2 p-3 border border-border rounded-sm bg-hover text-[0.8125rem] text-muted">
          ℹ️ Google 仅参考 <code class="bg-card px-1 py-0.5 rounded-sm">&lt;lastmod&gt;</code>，已忽略 <code class="bg-card px-1 py-0.5 rounded-sm">&lt;priority&gt;</code> 与 <code class="bg-card px-1 py-0.5 rounded-sm">&lt;changefreq&gt;</code>。
        </div>
        <div class="flex justify-end gap-2 mb-2">
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleDownload"
          >下载 sitemap.xml</button>
          <button
            type="button"
            class="px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleCopy"
          >复制结果</button>
        </div>
        <CodePanel label="sitemap.xml" :copy-text="sitemapXml" show-copy>
          <pre class="w-full p-4 bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap break-all">{{ sitemapXml }}</pre>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

- [ ] **Step 5: 浏览器实测（防 SSR 白屏）**

Run: `pnpm dev`
打开 `http://localhost:4321/devops/sitemap-generator`，验证：
- 页面正常渲染（无白屏、无控制台报错）
- 默认 3 条 URL 生成的 XML 正确（含转义）
- 逐条增删、批量粘贴解析追加、日期/频率/优先级变更均实时更新
- 诚实提示框显示，复制/下载正常

- [ ] **Step 6: 类型检查 + 提交**

Run: `pnpm astro check`
Expected: 无错误

```bash
git add src/tools/devops/SitemapGenerator.vue src/pages/devops/sitemap-generator.astro src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(devops): add sitemap.xml generator page with honest field hints"
```

---

## Task 6: 全量验证

**Files:** 无新增（仅验证）

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS（含新增的 download / robots-generator / sitemap-generator 三组测试）

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`
Expected: 无错误

- [ ] **Step 3: 生产构建**

Run: `pnpm build`
Expected: 构建成功，无 SSR 报错（构建成功不代表页面正常，见下一步）

- [ ] **Step 4: 双页面最终浏览器验证**

Run: `pnpm dev`
逐一访问并操作：
- `http://localhost:4321/devops/robots-generator`
- `http://localhost:4321/devops/sitemap-generator`

确认两个页面均无白屏、交互正常、面包屑/FAQ/相关工具区块正常渲染（验证 toolId 注册正确）。若发现 SSR/运行时问题，修复后回到对应 task 重测。

- [ ] **Step 5:（若有修正）提交**

```bash
git add -A
git commit -m "fix(devops): polish robots/sitemap generators after verification"
```

---

## Self-Review

**1. Spec coverage（逐节核对）:**
- §3 robots.txt 生成器 → Task 2（逻辑）+ Task 3（页面）✓
- §3.4 AI 爬虫清单 17 项 → Task 2 `ai-crawlers.ts`（17 项与 spec 一致）✓
- §3.5 规则解释 → Task 3 组件内联文案（`*` 说明、Sitemap 说明、AI 拦截说明）✓
- §3.7 默认值（* + /admin/）→ Task 3 `group-default` ✓
- §4 sitemap.xml 生成器 → Task 4（逻辑）+ Task 5（页面）✓
- §4.4 诚实规则解释（lastmod 有效 / priority·changefreq 忽略）→ Task 5 顶部提示框 ✓
- §4.6 默认值 3 条 URL → Task 5 `u1/u2/u3` ✓
- §5.3 下载函数（复用现有→无，新建 shared/download.ts）→ Task 1 ✓
- §5.4 SEO 注册 + FAQ → Task 3 / Task 5 ✓
- §5.5 测试覆盖 → Task 1/2/4 ✓
- §6 风险（SSR 白屏 → pnpm dev 实测；id 铁律 → Global Constraints 强调）→ 各组件 task Step 5 + Task 6 ✓
- §7 验收标准 7 条 → Task 6 全量验证覆盖 ✓

**2. Placeholder scan:** 无 TBD/TODO；每个代码 step 均含完整可运行代码；测试用例均有断言。✓

**3. Type consistency:**
- `RobotsData`/`AgentGroup`/`PathRule`/`RuleType`（Task 2 定义）↔ Task 3 组件 import 一致 ✓
- `buildAiBlockGroups(agents: string[])` ↔ Task 3 `buildAiBlockGroups([...aiSelected.value])` ✓
- `SitemapData`/`SitemapUrl`/`ChangeFreq`（Task 4 定义）↔ Task 5 组件 import 一致 ✓
- `parseBulkUrls(text: string): string[]` ↔ Task 5 `handleBulkImport` ✓
- `downloadTextFile(filename, content, mimeType?)` ↔ Task 3 / Task 5 调用签名一致 ✓
- `isValidHttpUrl(s: string): boolean`（meta-generator 已导出）↔ Task 5 import `from '../../utils/devops/meta-generator'` ✓
- SelectListbox `v-model` 绑定 `changefreq: ChangeFreq|''` 与 `priority: number|''`，options value 类型匹配（组件接受 string|number，运行时无类型冲突）✓

**类型兼容性确认（已核对 SelectListbox.vue 源码）:**
- `SelectListbox` 定义为 `modelValue: string | number`、`options.value: string | number`，无泛型约束。
- `SitemapUrl.changefreq?: ChangeFreq | ''` 与 `priority?: number | ''` 均可赋值给 `string | number`，Task 5 组件 `v-model` 直接绑定安全，无需转换。
- `generateSitemapXml` 用 `typeof u.priority === 'number'` 判断，空字符串 '' 被正确跳过（已加测试覆盖 "changefreq 与 priority 为空字符串时不输出对应节点"）。
