# DevTools P1 阶段设计文档 — FAQ 常见问题区块

## 背景

P0 阶段已完成 SEO 基础优化（统一 title 管理、keywords 字段）和互链生态（相关工具推荐区）。P1 聚焦于为每个工具页面增加 FAQ（常见问题）区块，目标有二：

1. **长尾关键词覆盖** — FAQ 的问答内容本身是优质的搜索关键词载体，有助于触发搜索引擎的"People Also Ask"特征片段
2. **用户自助解决疑惑** — 降低用户跳出率，在工具操作区正下方提供即时帮助

URL 参数分享功能经讨论后暂时搁置，不在本阶段范围内。

## 设计目标

1. FAQ 数据集中管理在独立文件中，与 `tools.ts` 解耦
2. 由 `ToolLayout.astro` 统一渲染，22 个 Vue 工具组件零改动
3. 使用原生 `<details>/<summary>` 实现，零 JS 增量
4. FAQ 答案支持简单 HTML 标签（`<code>`、`<strong>` 等）
5. 未配置 FAQ 的工具不渲染该区块，零成本

## 详细设计

### 1. 数据结构

#### 1.1 新建 `src/data/tool-faqs.ts`

```typescript
/** FAQ 条目 */
export interface FaqItem {
  /** 问题 */
  question: string;
  /** 答案（支持简单 HTML 标签如 <code>、<strong>） */
  answer: string;
}

/** 按工具 ID 索引的 FAQ 数据（未配置的工具不会渲染 FAQ 区块） */
export const toolFaqs: Record<string, FaqItem[]> = {
  'base64': [
    {
      question: 'Base64 是加密吗？',
      answer: '不是。Base64 是一种<strong>编码方式</strong>，不是加密算法。编码后的数据可以直接解码还原，不提供任何安全保护。',
    },
    {
      question: '编码后的数据会变大多少？',
      answer: 'Base64 编码后数据体积会增加约 <strong>33%</strong>。每 3 个字节原始数据编码为 4 个 Base64 字符。',
    },
    // ... 更多问题
  ],
  // 其他工具按需配置
};

/** 获取指定工具的 FAQ 列表 */
export function getToolFaqs(toolId: string): FaqItem[] {
  return toolFaqs[toolId] || [];
}
```

#### 1.2 数据编写规范

- 每个工具配置 3-5 个 FAQ 条目
- question 用疑问句，直接面向用户疑惑
- answer 简洁直接（1-3 句话），可用 `<strong>` 强调关键词、`<code>` 标记代码/术语
- 优先覆盖"这是什么""和 X 有什么区别""有什么限制"等典型问题

### 2. 渲染层

#### 2.1 ToolLayout.astro 改动

在 `<slot />` 之后、`RelatedTools` 之前插入 FAQ 区块。页面内容层次为：

```
[slot — 工具 Vue 组件]
    ↓
[FAQ 常见问题区块（如有配置）]  ← 新增
    ↓
[相关工具推荐区（如有配置）]
    ↓
[Footer]
```

渲染逻辑：
- 从 `tool-faqs.ts` 的 `getToolFaqs(toolId)` 获取 FAQ 数据
- `toolId` 从现有 `toolId` prop 获取（已是 ToolLayout 的 props）
- FAQ 数组为空时不渲染区块

#### 2.2 渲染方式

使用原生 `<details>/<summary>` HTML 元素：

```astro
{faqs.length > 0 && (
  <section class="mt-12 pt-8 border-t border-border">
    <h2 class="text-lg font-semibold text-text mb-4">常见问题</h2>
    <div class="space-y-0 divide-y divide-border">
      {faqs.map((faq) => (
        <details class="group py-4">
          <summary class="flex items-center justify-between cursor-pointer text-[0.8125rem] text-muted hover:text-text transition-[color] duration-150 list-none">
            <span>{faq.question}</span>
            <svg class="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
            </svg>
          </summary>
          <div class="pt-2 text-[0.8125rem] text-muted leading-relaxed" set:html={faq.answer} />
        </details>
      ))}
    </div>
  </section>
)}
```

关键设计决策：
- **原生 `<details>/<summary>`** 而非 Vue 的 DisclosureSection — 纯 HTML，零 JS，原生支持键盘操作和无障碍
- **`set:html`** 渲染 answer — 支持 `<strong>`、`<code>` 等简单 HTML 标签
- **箭头旋转动画** — 与 DisclosureSection.vue 的交互反馈一致（`group-open:rotate-180`）
- **`list-none`** — 移除 `<summary>` 默认的三角箭头，使用自定义 SVG 箭头

#### 2.3 与 DisclosureSection.vue 的关系

`DisclosureSection.vue` 仍在 5 个工具组件中被使用（SymmetricCrypto、AsymmetricCrypto、SM2Crypto、JwtParser、Ipv4Cidr），用于工具内部的交互式折叠区。FAQ 区块不复用它，原因是：
- FAQ 是页面级静态内容，不需要 Vue 水合
- 避免在 ToolLayout 中引入 Vue 水合开销

两者视觉风格统一，但底层实现不同。

### 3. 样式规范

| 元素 | 样式 |
|------|------|
| 区块标题 | `text-lg font-semibold text-text mb-4`，文字为"常见问题" |
| 区块分隔 | `mt-12 pt-8 border-t border-border`（与相关工具区一致） |
| 问题项分隔 | `divide-y divide-border`，每项 `py-4` |
| 问题文字 | `text-[0.8125rem] text-muted hover:text-text` |
| 答案文字 | `text-[0.8125rem] text-muted leading-relaxed` |
| 箭头图标 | 与 DisclosureSection 一致的 chevron-down SVG |

### 4. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/data/tool-faqs.ts` | 新建 | FAQ 数据定义 + `getToolFaqs()` 辅助函数 + 首批工具 FAQ 数据 |
| `src/layouts/ToolLayout.astro` | 修改 | 导入 `getToolFaqs`，在 slot 后渲染 FAQ 区块 |

### 5. 数据流

```
┌──────────────────┐
│  tool-faqs.ts    │── getToolFaqs(toolId) → FaqItem[]
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ToolLayout      │── 有 FAQ → 渲染 <details> 区块
│                  │── 无 FAQ → 不渲染
└──────────────────┘
```

### 6. 首批 FAQ 覆盖范围

优先为以下高频工具编写 FAQ（其余工具后续补充）：

| 工具 | FAQ 数量 | 典型问题示例 |
|------|---------|-------------|
| Base64 编解码 | 4 | 是加密吗？编码后变大多少？支持中文吗？Data URI 是什么？ |
| URL 编解码 | 3 | encodeURI vs encodeURIComponent 区别？中文编码原理？ |
| JWT 编解码 | 4 | JWT 安全吗？三部分分别是什么？如何验证签名？过期时间怎么看？ |
| JSON 格式化 | 3 | 支持多大的 JSON？什么是 JSON Path？压缩有什么用？ |
| 哈希生成器 | 4 | 哈希可以反解吗？MD5 安全吗？SHA-256 和 SHA-512 区别？ |
| UUID 生成器 | 3 | UUID 和 GUID 区别？v4 是什么？会重复吗？ |
| 对称加解密 | 3 | AES 和 SM4 区别？CBC 和 GCM 区别？密钥怎么保管？ |
| 二维码生成器 | 3 | 容错级别怎么选？最大支持多少字符？SVG 和 PNG 区别？ |
| Cron 表达式 | 3 | 五位和七位区别？特殊字符含义？常见错误？ |
| HTTP 状态码 | 2 | 301 和 302 区别？429 是什么？ |

共计约 33 条 FAQ，覆盖 10 个高频工具。其余 12 个工具暂不配置。

### 7. 边界情况处理

| 场景 | 处理策略 |
|------|---------|
| 工具未配置 FAQ | `getToolFaqs()` 返回空数组，不渲染区块 |
| answer 中包含恶意 HTML | 数据由开发者维护，安全性可控；不做 HTML 消毒 |
| `<details>` 无障碍 | 原生支持屏幕阅读器和键盘操作 |
| `<details>` 浏览器兼容 | 所有目标浏览器均支持（Chrome 90+、Firefox 90+、Safari 15+） |

### 8. 验证方式

1. 访问有 FAQ 的工具页（如 Base64），确认操作区下方显示"常见问题"区块
2. 点击每个问题，确认折叠/展开动画正常、箭头旋转
3. 检查答案中的 HTML 标签（`<strong>`、`<code>`）正确渲染
4. 访问未配置 FAQ 的工具页，确认不显示区块
5. 键盘操作：Tab 聚焦到问题，Enter 展开/折叠
6. `pnpm build` 确认构建成功，FAQ 区块不增加 JS 体积

## 反模式排除

- ❌ 不引入新的 npm 依赖
- ❌ 不修改任何 Vue 工具组件
- ❌ 不使用 Vue 水合渲染 FAQ（纯 Astro/HTML）
- ❌ 不删除 `DisclosureSection.vue`（仍在 5 个工具组件中使用）
