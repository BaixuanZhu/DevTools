# URL 解析器设计文档

> 设计日期：2026-06-19  
> 目标：将现有 `/encoding/url-encode` 工具迁移并扩展为 `/network/url`，新增 URL 结构化解析与 query 参数编辑能力。

---

## 一、背景与目标

现有 `/encoding/url-encode` 只提供 URL 编解码，属于编码转换分类。根据 ROADMAP，URL 工具更适合归入网络工具分类，并扩展结构化解析能力（protocol/host/path/query/hash 拆解、query 参数表格化编辑与重新拼装）。

**本次目标：**
- 在 `/network/url` 提供统一的 URL 编解码 + 结构化解析 + query 编辑工具。
- 旧 `/encoding/url-encode` 页面保留但做 0 秒 meta 跳转，侧边栏不再出现。
- 不引入第三方库，纯浏览器原生 `URL` API 实现。

---

## 二、路由与页面

| 页面文件 | URL | 行为 |
|---------|-----|------|
| `src/pages/network/url.astro` | `/network/url` | 新工具主页面，渲染 `UrlTool.vue` |
| `src/pages/encoding/url-encode.astro` | `/encoding/url-encode` | 从 `tools.ts` 移除；页面仅输出 HTML 骨架与 meta refresh 跳转至 `/network/url`，不再使用 `ToolLayout` |

**`src/data/tools.ts` 变更：**
- 删除 `encoding` 分类下的 `url-encode` 条目。
- 在 `network` 分类新增 `url` 条目：
  - `id: 'url'`
  - `name: 'URL 解析器'`
  - `path: '/network/url'`
  - 完整 SEO 字段（name/description/seoDescription/keywords/relatedToolIds）。
- 同步将所有 `relatedToolIds` 中的 `'url-encode'` 替换为 `'url'`。

**`src/data/tool-faqs.ts` 变更：**
- key 从 `'url-encode'` 改为 `'url'`。
- 保留原 URL 编解码相关 FAQ，新增 1–2 条关于结构化解析 / query 编辑的 FAQ。

---

## 三、页面布局

采用**居中、上中下三层**布局，输入框高度紧凑。

```
┌─────────────────────────────────────┐
│  URL 输入框（单行/双行高度）           │
│  [清空]                              │
├─────────────────────────────────────┤
│  [编码] [解码]                       │
│  encodeURIComponent 结果             │
│  encodeURI 结果                      │
│  （错误提示）                         │
├─────────────────────────────────────┤
│  结构化解析                           │
│  protocol / host / port / pathname   │
│  search / hash                       │
│                                     │
│  Query 参数表格（可增删改）            │
│  [应用至 URL]                        │
└─────────────────────────────────────┘
```

### 各层说明

**上层：输入**
- 单个 `<textarea>` 输入框，高度约 2–3 行，足以容纳常见 URL。
- 右侧「清空」按钮，点击后清空输入、结果、解析状态。
- 输入变化时自动触发解析。

**中层：编解码**
- 两个按钮「编码」「解码」。
- 点击后展示对应结果：
  - 编码：显示 `encodeURIComponent` 与 `encodeURI` 结果。
  - 解码：显示 `decodeURIComponent` 与 `decodeURI` 结果，分别报告错误。
- 每个结果区带「复制」按钮。

**下层：结构化解析**
- 解析成功时显示 protocol、host、port、pathname、search、hash 字段。
- 这些字段只读展示，格式为 key-value 列表。
- query 参数以表格展示，支持：
  - 新增参数
  - 删除参数
  - 修改 key/value
- 表格下方「应用至 URL」按钮，将当前表格内容反向拼回输入框 URL。
- 解析失败时显示中文错误提示，不展示表格。

---

## 四、数据结构与工具函数

新建 `src/utils/network/url.ts`，提供以下能力：

### 类型定义

```typescript
export interface UrlParsedParts {
  protocol: string;
  host: string;
  port: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  params: Array<{ key: string; value: string }>;
}

export interface UrlEncodeResult {
  component: { value: string };
  full: { value: string };
}

export interface UrlDecodeResult {
  component: { value: string; error?: string };
  full: { value: string; error?: string };
}
```

### 函数

- `parseUrl(url: string): UrlParsedParts | null` — 使用原生 `URL` 解析，失败返回 `null`。
- `encodeUrl(text: string): UrlEncodeResult` — 复用现有 `encodeURIComponent` / `encodeURI`。
- `decodeUrl(text: string): UrlDecodeResult` — 复用现有 `decodeURIComponent` / `decodeURI`，分别捕获错误。
- `buildUrlFromParts(baseUrl: string, params: Array<{ key: string; value: string }>): string` — 用 `URLSearchParams` 重建 search 并返回完整 URL。

---

## 五、组件架构

新建 `src/tools/network/UrlTool.vue`。

### 状态

```typescript
const input = ref(DEFAULT_INPUT);
const parsed = ref<UrlParsedParts | null>(null);
const parseError = ref('');
const params = ref<Array<{ key: string; value: string }>>([]);
const encodeResult = ref<UrlEncodeResult | null>(null);
const decodeResult = ref<UrlDecodeResult | null>(null);
```

### 核心逻辑

- `watch(input, ...)`：
  - 调用 `parseUrl`。
  - 成功时更新 `parsed` 与 `params`。
  - 失败时清空 `parsed` 与 `params`，设置 `parseError`。
- 编码/解码按钮：调用 `encodeUrl` / `decodeUrl`，结果写入 `encodeResult` / `decodeResult`。
- 「应用至 URL」：调用 `buildUrlFromParts(input.value, params.value)`，结果写回 `input.value`。
- 「清空」：重置所有状态。

### 样式

- 容器最大宽度 `max-w-3xl mx-auto`。
- 使用 Tailwind 工具类，遵循 `DESIGN.md` 令牌。
- 输入框、按钮、卡片样式与现有工具保持一致。

---

## 六、错误处理

| 场景 | 处理方式 |
|------|---------|
| 输入为空 | 解析区显示占位提示，不报错 |
| 输入非合法 URL | `parseError = '无法解析为合法 URL，请检查协议和格式'` |
| decodeURIComponent 失败 | 在 component 结果区显示错误，full 同理 |
| query key 为空 | 应用时忽略空 key 或提示 |

---

## 七、SEO 与 FAQ

**SEO 字段（`tools.ts`）：**
- `name`: `URL 解析器`
- `description`: `URL 编解码与结构化解析，支持 query 参数表格化编辑与一键重建 URL`
- `seoDescription`: 120–160 字符，覆盖 encode/decode、URL 解析、query 编辑。
- `keywords`: `url 解析`, `url 编码`, `url 解码`, `query 参数编辑`, `url 参数解析` 等。

**FAQ（`tool-faqs.ts`）：**
1. URL 编码中 encodeURI 与 encodeURIComponent 的区别？（保留）
2. URL 解析器如何编辑 query 参数？（新增）
3. 为什么旧页面 /encoding/url-encode 会跳转？（新增，说明迁移）

---

## 八、测试要点

- `src/utils/network/__tests__/url.test.ts`：覆盖解析、重建、编解码错误路径。
- 验证旧 `/encoding/url-encode` 页面输出正确的 meta refresh。
- 验证 `/network/url` 渲染正常，query 编辑后「应用至 URL」正确更新输入。

---

## 九、文件清单

- 新建：`src/pages/network/url.astro`
- 新建：`src/tools/network/UrlTool.vue`
- 新建：`src/utils/network/url.ts`
- 新建：`src/utils/network/__tests__/url.test.ts`
- 修改：`src/pages/encoding/url-encode.astro`（改为跳转页）
- 修改：`src/data/tools.ts`（迁移条目、更新 relatedToolIds）
- 修改：`src/data/tool-faqs.ts`（key 与 FAQ 更新）
- 删除或保留：`src/tools/encoding/UrlEncodeCodec.vue`、`src/utils/encoding/url-codec.ts`（旧页跳转后不再使用，但为避免外部硬引用暂时保留，后续清理）
