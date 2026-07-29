# AGENTS.md

Guidance for ZCode (and other coding agents) working in this repository.

## Knowledge Sources

PRODUCT.md 与 DESIGN.md 是产品行为与视觉规范的唯一标准，开发功能或修改界面前必须查阅。本文件仅保留编码层面的快速参考。

| 文件 | 职责 | 何时查阅 |
|------|------|----------|
| **PRODUCT.md** | 产品定位、工具分类、URL 策略、错误处理、浏览器兼容、性能与无障碍 | 新增工具页、改产品行为、讨论优先级 |
| **DESIGN.md** | 设计令牌、组件状态矩阵、布局模板、UI 选型、样式规则、工具页模式 | 编写任何 UI 代码前 |

## Code Search Rules（强制）

按问题类型选最高效的工具，不固守固定顺序：

| 场景 | 首选工具 |
|------|----------|
| 找符号定义 | `codegraph query` |
| 找直接调用方 | `codegraph callers`（仅返回一层，需递归再 callers） |
| 理解模块/架构/影响面 | `codegraph explore` / `impact`（结果有噪音，需筛选） |
| 查找所有出现位置/模板文本/配置值 | IDEA MCP `search_text` / `search_regex`（比 explore 精确） |
| 需要 LSP / rename / 类型提示 | IDEA MCP |
| 以上覆盖不到 | `Grep` / `Read` 兜底 |

**铁律**：能用 codegraph 或 IDEA MCP 一次性解决的问题，禁止用 Read 逐文件拼凑；`explore` 返回关系图而非精确答案，主动筛选噪音。

> `codegraph` 已封装为同名 skill，优先 `Skill('codegraph')` 调用；必要时在项目根目录执行 `codegraph explore <query>`。
> 注意：`new Worker(new URL('./x.worker.ts', import.meta.url))` 动态实例化的 Worker 不被 codegraph 索引，需手动搜 `.worker.ts` 引用。

## Project Overview

基于 Astro 6 的在线开发者工具网站，浏览器端运算、无后端。产品定义详见 PRODUCT.md。

## Commands

```bash
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本到 ./dist/
pnpm preview          # 本地预览构建结果
pnpm test             # 运行全部 vitest 测试
pnpm test <pattern>   # 运行匹配文件/名称的测试
pnpm test:watch       # vitest watch 模式
pnpm astro check      # Astro TypeScript 类型检查
```

## Tech Stack

- **Framework:** Astro 6 + Vue 3（@astrojs/vue）
- **UI:** Vue 3 `<script setup lang="ts">` + Composition API（交互型）；纯展示用 .astro，零 JS
- **Language:** TypeScript strict（继承 astro/tsconfigs/strict）
- **Styling:** Tailwind CSS v4，令牌定义于 `src/styles/global.css`（`:root`/`.dark` 双组变量 + `@theme inline`），utility class 消费
- **UI Primitives:** reka-ui 无样式可访问原语（Tabs/Switch/Select/Collapsible/Dialog/DropdownMenu）用 Tailwind 定制；shadcn-vue 已初始化（`components.json`，无 `@/` 别名，import 一律相对路径）
- **Package Manager:** pnpm ｜ **Node:** >=22.12.0

## Architecture

```
src/
├── layouts/      # 页面骨架（Layout.astro, ToolLayout.astro）
├── pages/        # 文件路由，每个 .astro 对应一个 URL
├── tools/        # 工具页面（按分类子目录：text/、crypto/、format/、network/、datetime/、frontend/、devops/）
├── components/   # .vue 交互型 + .astro 纯展示
│   ├── ui/       # 通用交互（ToggleSwitch、SelectListbox 等）
│   ├── layout/   # 布局（ToolHeader、Breadcrumb、RelatedTools、CategoryCard 等）
│   └── shell/    # 全局壳层（Shell、ToastContainer、SearchPanel、FeedbackForm）
├── composables/  # Vue 组合式函数（如 useCopy）
├── stores/       # 模块级 reactive store（toast/sidebar/search/theme），跨 island ESM 单例
├── data/         # 工具注册表（tools.ts、tool-faqs.ts、categories.ts）
├── utils/        # 工具函数（含 *.worker.ts）
├── styles/       # 设计令牌 global.css
├── types/        # 第三方库类型补充
├── tests/        # 分类集成测试
└── assets/       # Astro import 引用的静态资源
public/           # 不经处理的静态文件
```

三级导航：首页 `/` → 分类页 `/[category]`（如 `/text`）→ 工具页 `/[category]/[tool]`（如 `/text/base64`）。`src/pages/{category}/{tool}.astro` 路由与 `src/tools/{category}/{Tool}.vue` 实现组件目录结构对称。注册表 `src/data/tools.ts`，分类元数据 `src/data/categories.ts`。URL 策略见 PRODUCT.md §URL Strategy。

## Frontend Architecture

**Vue 单引擎**（2026-07 运行时统一重构完成，Alpine.js 已移除）：

- **全局壳层** `Shell.vue`（唯一 `client:load` island）承载 Header / Sidebar（7 分类入口 + 工具数徽标 + 当前分类高亮）/ Toast / 搜索 / 暗色切换。响应式状态来自 `src/stores/` 模块级 reactive store（ESM 单例，跨 island 共享）。
- **工具 islands** 每个工具独立 Vue 组件，按需 `client:idle`（默认）/ `client:load`（如 CronParser 需立即响应），`import` 同一批 store 模块。

**通知通信**：任意组件直接 `toastStore.show(msg)` / `toastStore.error(msg)`。禁止 `CustomEvent` 字符串桥接、禁止引入全局状态库（Pinia 等），模块级 store 已覆盖共享需求。

## Heavy Computation Pattern

耗时运算（大文件哈希、深层 JSON 对比）用 Web Worker 避免阻塞主线程：

- Worker 放 `src/utils/{feature}/` 下，命名 `{feature}.worker.ts`
- 组件中 `new Worker(new URL('./path/to/worker.ts', import.meta.url), { type: 'module' })` 实例化，通过 `postMessage`/`onmessage` 交换数据
- 参考：`src/utils/format/json-diff.worker.ts`、`src/utils/regex/regex.worker.ts`

## Testing

Vitest（配置 `vitest.config.ts`）：`environment: 'node'`、`globals: true`（直接用 `describe`/`it`/`expect`）。

- 单元测试：`src/**/__tests__/`（与被测模块同目录）
- 分类集成测试：`src/tests/{category}/`

## Build & Deploy Configuration

关键配置在 `astro.config.mjs`：

- `site: 'https://tools.baixuanz.cn'`；`build.inlineStylesheets: 'always'`（内联样式表，避免 CSS 阻塞渲染）
- Sitemap：单段路径仅保留 7 分类页（`CATEGORY_SLUGS` 内联定义，与 `categorySlugMap` 同步），排除旧扁平重定向页；首页 priority 1.0、分类页 0.9、工具页 0.8。两段 URL 301 由 `redirects` 生成。
- `vite.worker.format: 'es'`：兼容 `@jsquash/avif` emscripten worker code-splitting；`vite.optimizeDeps.exclude: ['@jsquash/avif']`

部署：EdgeOne Pages（主站）；GitHub Pages（`.github/workflows/astro-gh-workflow.yml`，push main 触发，`pnpm exec astro build --base=/DevTools`）。

## Security Rules（强制）

- **禁止 `eval()` / `Function()` / `setTimeout|setInterval(string)` 处理用户输入**，无例外
- 正则执行用 `new RegExp(pattern, flags)` 并包裹 try-catch
- URL 参数中的回调/代码片段必须过滤转义；用户输入校验后才参与运算

## Tool Page Requirements（每个工具页面必须满足）

1. **输入格式检查 + 中文友好错误提示**（运算前验证；策略见 PRODUCT.md §Error Handling）
2. **"清空"和"复制结果"按钮**（复制给反馈）
3. **合理默认值**（打开即可体验，不需单独"填入示例"按钮）
4. **SEO 元数据完整**（`src/data/tools.ts` 全字段；有 FAQ 同步 `src/data/tool-faqs.ts`）

## Tool Architecture & Maintenance

### 工具拓扑（三级导航）

```
首页 /（7 分类卡片 + 搜索直达）
├── /text     文本与编码   Base64/JWT/URL 编解码、UUID、随机串、正则测试器
├── /crypto   加密与安全   哈希、对称/非对称/SM2 加解密
├── /format   格式化与转换 JSON 美化/差异、TOML/YAML/XML/TS 互转
├── /network  网络工具     URL 解析、HTTP 状态码、IPv4 子网、设备信息
├── /datetime 日期时间     时间戳转换、Cron 解析、时间差
├── /frontend 前端与媒体   CSS 单位/渐变、颜色面板、二维码、图片转换、幻影坦克
└── /devops   开发与运维   Docker/Env 转换、Meta/robots/sitemap、Markdown 编辑器
     └── /{category}/{tool}  工具页（末层，约 48 个）
```

分类页 `src/pages/[category]/index.astro` 聚合工具卡片；Sidebar 全程常驻（7 分类切换 + 工具数徽标 + 当前分类高亮）。

### 新增工具步骤

1. **注册** — `src/data/tools.ts` 的 `tools` 数组加 `ToolMeta`：`id`/`category`/`path`（`/{categorySlug}/{toolSlug}`）/`name`/`description`/`seoDescription`/`keywords`/`icon`/`relatedToolIds`。分类 slug 与中文名见 `categorySlugMap`。
2. **组件** — `src/tools/{category}/{Tool}.vue`（`<script setup lang="ts">`）。
3. **路由** — `src/pages/{category}/{tool}.astro`：import 组件 + `<ToolLayout toolId="{category}/{tool}">` 包裹 + `client:idle` 水合。`pages/` 与 `tools/` 目录对称。
4. **（可选）FAQ** — `src/data/tool-faqs.ts` 以 tool slug 为 key 加问答数组。
5. **（可选）测试** — `src/tools/{category}/__tests__/` 或 `src/utils/{feature}/__tests__/`；集成测试 `src/tests/{category}/`。
6. **验证** — `pnpm build` + `pnpm test` + `pnpm astro check`。

### 维护流程

- **分类调整**：改 `categories.ts` + `tools.ts` 的 `categorySlugMap`/`ToolCategory` + 受影响工具 `category`/`path` + 迁移 `pages/` 与 `tools/` 文件 + `astro.config.mjs` `redirects` 补旧→新 301。
- **URL 变更**：改 `tools.ts` `path` + 迁移路由/组件 + `astro.config.mjs` redirects 补两段→两段 301；扁平 URL 在 `src/pages/[slug].astro` 补条目。
- **下线**：从 `tools.ts` 移除 + 删路由 + `[slug].astro` 或 `redirects` 加到分类页兜底跳转，避免外链 404。
- **sitemap 校验**：新增分类页需把 slug 加入 `astro.config.mjs` `CATEGORY_SLUGS`，否则被 sitemap filter 误排除。

## Development Conventions

- 页面 title/布局用 Layout.astro / ToolLayout.astro，props 传标题
- 水合策略：工具默认 `client:idle`，需立即响应用户输入的用 `client:load`（如 CronParser）；纯展示组件不加 `client:`，零 JS
- 新增公共组件/工具函数必须写 JSDoc/TSDoc；可复用 Vue 逻辑优先封装到 `src/composables/`（如 `useCopy`）
- **无路径别名**：不用 `@/`/`~/`，import 一律相对路径
- **无 ESLint/Prettier**：靠 TS strict + 代码审查保证一致性
- **测试位置**：单元测试放被测模块同目录的 `__tests__/`

### Styling Conventions（强制）

Tailwind CSS v4，间距基于 4px 单位（`像素值 / 4 = 类名数值`，如 120px → `w-30`）。

- **禁止用任意值语法表示标准类名能表示的值**：`w-[120px]`→`w-30`、`min-h-[160px]`→`min-h-40`、`max-w-[720px]`→`max-w-180`。
- **允许任意值**：设计令牌精确尺寸（`text-[0.8125rem]` 等，见 DESIGN.md）、非 4 倍数特殊值（`h-[57px]`）、自定义层级/效果（`z-[100]`、`shadow-[...]`）。
- 检查任意值：用 IDEA MCP `get_file_problems(filePath)` 或 `search_text("w-[1")` 排查。

## Dependency Rules（强制）

- **优先稳定成熟库**：npm 周下载量高、维护活跃、无已知漏洞（如 dayjs、@noble/ciphers、uuid）；新增依赖前确认社区活跃度与兼容性
- **禁止实验性库**：能用浏览器原生 API（Web Crypto API、TextEncoder、URL）实现的优先原生方案
- **同类不重复**：已有 dayjs 不引 moment/luxon；已有 @noble/ciphers 不引 crypto-js
- **UI 原语只用 reka-ui**，禁止 @headlessui/vue 等；壳层状态用 `src/stores/` 模块级 store，禁止 Alpine.js 或全局状态库
