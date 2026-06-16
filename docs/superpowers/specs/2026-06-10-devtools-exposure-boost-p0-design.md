# DevTools 曝光度提升 — P0 阶段设计文档

## 背景

DevTools 是一个基于 Astro 6 + Vue 3 的纯前端开发者工具网站，当前已具备扎实的 SEO 基础设施（SeoHead 组件、自动 JSON-LD、sitemap、robots.txt）。但存在以下影响曝光度的关键缺口：

1. **title 硬编码**：22 个工具页面的 `<title>` 硬编码在各自的 `.astro` 文件中，维护不便，无法批量调整
2. **缺少 keywords**：每个工具只有一条 `seoDescription`，未覆盖长尾搜索变体
3. **工具页孤立**：工具之间没有互链，用户用完一个工具后没有自然的下一步引导
4. **缺少 meta keywords**：虽然 Google 不直接参考，但国内搜索引擎（百度、必应中国）可能仍利用

本设计针对上述问题，定义 P0 阶段的最小可行方案。

## 设计目标

1. 将 title、keywords、相关工具配置统一收归到 `tools.ts`，实现"一处修改，全站生效"
2. 在每个工具页底部展示相关工具推荐卡片，降低跳出率、提升 PV
3. 为每个工具补充长尾关键词，生成 `<meta name="keywords">` 标签
4. 保持零运行时成本（纯静态生成），不破坏现有性能基线

## 详细设计

### 1. 数据结构扩展

#### 1.1 `ToolMeta` 接口（`src/data/tools.ts`）

在现有接口上新增三个字段：

```typescript
export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  seoDescription: string;
  category: ToolCategory;
  icon: string;
  path: string;

  // 新增 —— title 覆盖（可选）
  /** 页面 <title>，不传则自动拼接为 "{name} - DevTools" */
  title?: string;

  // 新增 —— 长尾关键词
  /** 长尾关键词列表，用于生成 meta keywords 标签及内部选题参考 */
  keywords: string[];

  // 新增 —— 相关工具
  /** 相关工具 ID 列表，页面最多展示前 4 个 */
  relatedToolIds: string[];
}
```

#### 1.2 辅助函数（`src/data/tools.ts`）

新增 `getRelatedTools(toolId: string): ToolMeta[]`：
- 根据传入工具 ID 找到其 `relatedToolIds`
- 依次查找对应工具元数据
- 返回最多 4 条（取数组前 4 个）
- 如果某个 `relatedToolId` 不存在，静默跳过（防御性处理）

#### 1.3 数据填充规范

**`title` 字段**：
- 默认不填写，由 `ToolLayout` 自动拼接为 `"{name} - DevTools"`
- 仅在需要特殊标题时显式覆盖

**`keywords` 字段**：
- 每个工具配置 5-8 个长尾关键词
- 覆盖常见搜索变体组合，如"在线、工具、转换、编码、解码"
- 示例（Base64）：`['base64 在线编码', 'base64 在线解码', 'base64 转换工具', '文本 base64', 'base64 编解码', '在线 base64']`

**`relatedToolIds` 字段**：
- 手动配置，最多写 6 个（页面最多展示 4 个，留有余量）
- 选择策略：同分类优先 → 功能互补次之
- 示例（Base64）：`['url-encode', 'base64-to-image', 'base64-to-file', 'jwt-parser']`

### 2. SEO 基础优化

#### 2.1 `SeoHead.astro` 扩展

新增 `keywords?: string[]` prop：

```astro
---
interface Props {
  title?: string;
  description?: string;
  canonical?: string;
  jsonLd?: object | object[];
  keywords?: string[];  // 新增
}
const { keywords, ... } = Astro.props;
---

<!-- 在原有 meta 之后追加 -->
{keywords && keywords.length > 0 && (
  <meta name="keywords" content={keywords.join(', ')} />
)}
```

#### 2.2 `ToolLayout.astro` title 逻辑

确定最终 title 的优先级：

```
props.title > toolMeta?.title > "{toolMeta.name} - DevTools"
```

```astro
---
const finalTitle = title || toolMeta?.title || `${toolMeta?.name || ''} - DevTools`;
---
```

description 逻辑保持不变：
```
props.description > toolMeta?.seoDescription > undefined
```

#### 2.3 工具页面简化

22 个 `src/pages/**/*.astro` 文件统一移除硬编码 `title` prop：

```astro
<!-- 修改前 -->
<ToolLayout title="Base64 编解码 - DevTools" toolId="encoding/base64">

<!-- 修改后 -->
<ToolLayout toolId="encoding/base64">
```

### 3. 互链生态（相关工具推荐区）

#### 3.1 `RelatedTools.astro` 组件（新建）

**文件**：`src/components/layout/RelatedTools.astro`

**Props**：
```typescript
interface Props {
  /** 相关工具 ID 列表 */
  toolIds: string[];
}
```

**行为**：
- 通过 `getRelatedTools()` 解析 ID 列表为 `ToolMeta[]`
- 最多取前 4 个
- 使用 `ToolCard.astro` 渲染，1×4 横向排列
- 空数组时不渲染任何内容（组件返回空）

**布局**：
```astro
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {relatedTools.map(tool => <ToolCard tool={tool} />)}
</div>
```

> 使用响应式网格：移动端 1 列 → sm 2 列 → lg 4 列，确保所有屏幕尺寸下体验良好。

#### 3.2 `ToolLayout.astro` 底部插入

在页面内容区闭合前、Footer 之前插入相关工具区块：

```astro
<main class="max-w-3xl mx-auto">
  <slot />

  <!-- 相关工具推荐区（新增） -->
  {relatedTools.length > 0 && (
    <section class="mt-12 pt-8 border-t border-border">
      <h2 class="text-lg font-semibold text-surface mb-4">相关工具</h2>
      <RelatedTools toolIds={toolMeta.relatedToolIds} />
    </section>
  )}
</main>
```

> 用 `border-t` 分隔线将主工具区与推荐区视觉上区分开。

### 4. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/data/tools.ts` | 修改 | `ToolMeta` 新增 `title?`、`keywords`、`relatedToolIds`；新增 `getRelatedTools()`；补全 22 条数据 |
| `src/components/seo/SeoHead.astro` | 修改 | 新增 `keywords` prop，渲染 `<meta name="keywords">` |
| `src/layouts/ToolLayout.astro` | 修改 | title 回退逻辑、注入 keywords、底部插入 RelatedTools |
| `src/layouts/Layout.astro` | 修改 | 将 `keywords` prop 透传给 SeoHead |
| `src/components/layout/RelatedTools.astro` | 新建 | 相关工具卡片容器组件 |
| `src/pages/**/*.astro`（22 个） | 修改 | 移除硬编码 `title` prop |

### 5. 数据流

```
┌──────────────┐
│  tools.ts    │── ToolMeta[]（含 title/keywords/relatedToolIds）
└──────┬───────┘
       │
       ├──────────────┬──────────────────┐
       ▼              ▼                  ▼
┌──────────────┐ ┌──────────┐    ┌──────────────┐
│ ToolLayout   │ │ SeoHead  │    │ RelatedTools │
│ (title逻辑)  │ │(keywords)│    │ (卡片渲染)   │
└──────────────┘ └──────────┘    └──────────────┘
```

### 6. 边界情况处理

| 场景 | 处理策略 |
|------|---------|
| `relatedToolIds` 中存在无效 ID | `getRelatedTools()` 静默过滤，只返回存在的工具 |
| `relatedToolIds` 为空数组 | `RelatedTools` 组件不渲染，不显示区块 |
| `relatedToolIds` 只有 1-3 个 | 显示实际数量，网格自适应（不会补空位） |
| `keywords` 为空数组 | `SeoHead` 不渲染 meta keywords 标签 |
| `title` 和 `name` 同时存在 | 优先使用显式配置的 `title` |
| 工具页面仍传了 `title` prop（遗留代码） | `props.title` 优先级最高，可覆盖 toolMeta |

### 7. 验证方式

1. **title 检查**：访问任意工具页，查看浏览器标签页 title 是否为 `"{name} - DevTools"`
2. **meta keywords 检查**：查看页面源码，确认 `<meta name="keywords">` 存在且内容正确
3. **相关工具区检查**：访问有配置 `relatedToolIds` 的工具页，确认底部显示 1-4 个相关工具卡片
4. **空状态检查**：访问未配置 `relatedToolIds` 的工具页，确认底部不显示推荐区块
5. **响应式检查**：在移动端/平板/桌面端分别检查卡片排列是否正确
6. **Lighthouse**：确保性能评分仍 ≥ 90（新增内容不应增加 JS 体积）

## 与后续阶段的衔接

P0 阶段完成后，`tools.ts` 的数据结构将稳定下来。后续阶段可直接复用：

- **P1 FAQ 区块**：可在 `ToolMeta` 中新增 `faqs: {question, answer}[]` 字段，由 ToolLayout 在操作区下方渲染
- **P1 URL 参数分享**：与数据结构无关，纯前端交互增强
- **P2 博客系统**：博客文章的 `relatedTools` 可复用 `ToolMeta` 数据做关联推荐
- **P2 个性化 OG 图片**：可读取 `ToolMeta.icon` + `name` 动态生成

## 反模式排除

- ❌ 不引入任何新的 npm 依赖（复用现有 `ToolCard`）
- ❌ 不修改路由结构或 URL 策略
- ❌ 不添加运行时 JavaScript（纯静态生成）
- ❌ 不在工具页添加弹窗、广告、强制引导等流量杀手
