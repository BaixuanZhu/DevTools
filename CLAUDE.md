# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Knowledge Sources

这两个文件是整个项目开发的 UI 指导，定义了产品行为和视觉规范的唯一标准。开发任何功能或修改任何界面时，必须先查阅对应文件并严格遵循。本文件只保留编码层面的快速参考。

| 文件             | 职责                                                          | 何时查阅                  |
|----------------|-------------------------------------------------------------|-----------------------|
| **PRODUCT.md** | 产品定位、用户画像、工具分类、URL 策略、错误处理、浏览器兼容、性能基线、无障碍要求                 | 新增工具页、修改产品行为、讨论功能优先级时 |
| **DESIGN.md**  | 设计令牌、组件状态矩阵、布局模板、视觉规则、UI 组件选型、样式实现规则、工具页面组件模式、Do's & Don'ts | 编写任何 UI 代码前必读         |

## Code Search Rules（强制）

### 按场景选择工具

不要固守"先 A 后 B"的固定顺序，而要根据问题类型选最高效的工具。

| 场景 | 首选工具 | 说明 |
|---|---|---|
| 找符号定义 | `codegraph query` | 全库符号搜索，精准返回定义位置、签名、文档 |
| 找直接调用方 | `codegraph callers` | 返回一层调用关系；如需继续展开，对结果再次 `callers` |
| 理解模块 / 追踪架构 / 分析影响 | `codegraph explore` 或 `codegraph impact` | 一次返回相关文件、调用关系图、影响面；注意结果可能有噪音，需筛选 |
| 查找所有出现位置 / 模板文本 / 配置值 | `IDEA MCP search_text` / `search_regex` | 比 `explore` 更精确、更少噪音 |
| 需要 LSP / 文本替换 / IDEA 特有功能 | `IDEA MCP` | 如 go-to-definition、rename、类型提示等 |
| 以上都覆盖不到的片段 | `Grep` / `Read` | 兜底，用于验证具体行或读取实现细节 |

### 两条铁律

1. **能用 codegraph 或 IDEA MCP 一次性解决的问题，禁止用 Read 逐个文件拼凑理解**
2. **使用 `codegraph explore` 时主动筛选噪音** — 它返回的是关系图而非精确答案，关注核心符号和 blast radius，不要被无关文件带偏

> **调用方式**：`codegraph` 已封装为同名 skill，优先通过 `Skill('codegraph')` 调用；必要时也可直接在项目根目录执行 `codegraph explore <query>` 等 CLI 命令。

### 反面教材

❌ **不要这样做**：

```text
Read Footer.astro → Read Layout.astro → Read ToolLayout.astro → Read index.astro
```

✅ **应该这样做**：

```text
理解整体结构：调用 codegraph skill 或执行 codegraph explore "Layout ToolLayout Footer"
精确查找文本：IDEA search_text("反馈")
```

### 特殊注意

- `codegraph callers` 默认只返回一层调用方，不会递归展开完整调用链。
- 通过 `new Worker(new URL('./path/to/worker.ts', import.meta.url))` 动态实例化的 Worker 文件，不会被 codegraph 索引为调用关系；需要手动搜索 `worker.ts` 或 `.worker.ts` 引用。

## Project Overview

基于 Astro 6 的在线开发者工具网站。浏览器端运算，无后端。详细的产品定义见 PRODUCT.md。

## Commands

```bash
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本到 ./dist/
pnpm preview          # 本地预览构建结果
pnpm test             # 运行全部 vitest 测试
pnpm test <pattern>   # 运行匹配文件/名称的测试，如 pnpm test src/utils/format/__tests__/json-diff.test.ts
pnpm test:watch       # 以 watch 模式运行 vitest
pnpm astro check      # 运行 Astro TypeScript 类型检查
```

## Tech Stack

- **Framework:** Astro 6 + Vue 3（@astrojs/vue）
- **UI:** Vue 3 `<script setup lang="ts">` + Composition API（交互型组件）
- **Language:** TypeScript（strict 模式，继承 astro/tsconfigs/strict）
- **Styling:** Tailwind CSS v4 — 令牌定义于 `src/styles/global.css` 的 `@theme` 块，组件通过 utility class 消费
- **UI Components:** @headlessui/vue — 无样式可访问组件（Tab、Switch、Listbox、Disclosure 等），用 Tailwind class 定制外观
- **Package Manager:** pnpm
- **Node:** >=22.12.0

## Architecture

```
src/
├── layouts/     # 页面骨架（Layout.astro, ToolLayout.astro）
├── pages/       # 基于文件的路由，每个 .astro 文件对应一个 URL
├── tools/       # 工具页面（按分类组织子目录：encoding/、crypto/、datetime/ 等）
├── components/  # 可复用 UI 组件（.vue 交互型 + .astro 纯展示）
│   ├── ui/          # 通用交互组件（ToggleSwitch、SelectListbox 等）
│   └── layout/      # 布局组件（ToolHeader、Breadcrumb、RelatedTools、ResponsiveWorkspace）
├── composables/ # Vue 组合式函数（如 useCopy），供多个工具组件复用
├── data/        # 工具注册表（tools.ts、tool-faqs.ts）
├── utils/       # 工具函数
├── styles/      # 设计令牌（global.css @theme 块）
├── types/       # 全局类型声明（第三方库类型补充，如 alpinejs、des.js）
├── tests/       # 按分类组织的集成/页面测试
└── assets/      # 静态资源（通过 Astro import 引用）
public/          # 不经处理的静态文件（favicon 等）
```

路由采用 `/category/tool-name` 二级结构：`src/tools/encoding/base64.astro` → `/encoding/base64`。工具注册表位于
`src/data/tools.ts`。URL 策略详见 PRODUCT.md §URL Strategy。

## Frontend Architecture

项目采用**双引擎**架构：

- **Alpine.js** — 负责全局壳层交互（侧边栏开关、Toast 通知、收藏夹面板、搜索过滤、暗色模式切换）。这些逻辑写在 `.astro`
  页面和布局文件中，通过 `x-data` / `x-show` / `@click` 等指令实现。
- **Vue 3** — 负责工具内部的复杂交互（编码转换、JSON 格式化、哈希计算等）。每个工具是一个独立的 Vue 组件，通过 Astro `client:`
  指令按需水合。

**跨框架通信**：Vue 组件通过 `CustomEvent('toast', { detail: { message } })` 触发 Alpine 管理的 Toast 通知系统。不需要引入全局状态库。

## Heavy Computation Pattern

耗时运算（大文件哈希、深层 JSON 对比等）使用 Web Worker 避免阻塞主线程：

- Worker 文件放在 `src/utils/` 对应子目录下，命名约定为 `{feature}.worker.ts`
- Vue 组件中通过 `new Worker(new URL('./path/to/worker.ts', import.meta.url), { type: 'module' })` 实例化
- Worker 与主线程通过 `postMessage` / `onmessage` 交换数据
- 现有参考：`src/utils/format/json-diff.worker.ts`、`src/utils/regex/regex.worker.ts`

## Testing

测试使用 **Vitest**，配置见 `vitest.config.ts`：

- `environment: 'node'`：工具函数测试在 Node 环境运行
- `globals: true`：测试文件可直接使用 `describe`、`it`、`expect`

测试文件分布在两类位置：

- 单元测试：`src/**/__tests__/`（与被测模块同目录），如 `src/utils/format/__tests__/json-diff.test.ts`
- 分类集成测试：`src/tests/{category}/`，如 `src/tests/crypto/crypto.test.ts`

## Build & Deploy Configuration

关键配置集中在 `astro.config.mjs`：

- `site: 'https://tools.baixuanz.cn'`：主站点域名
- `build.inlineStylesheets: 'always'`：内联所有样式表，避免 CSS 请求阻塞渲染
- Sitemap 集成：过滤掉旧扁平路径（根级单段路径）的重定向页面，仅保留 `/category/slug` 真实页面
- `vite.worker.format: 'es'`：兼容 `@jsquash/avif` 的多线程 emscripten worker 的 code-splitting
- `vite.optimizeDeps.exclude: ['@jsquash/avif']`：避免预打包破坏其 wasm 相对路径加载

部署渠道：

- **EdgeOne Pages**：主站点 `https://tools.baixuanz.cn`
- **GitHub Pages**：`.github/workflows/astro-gh-workflow.yml` 在 push 到 `main` 时触发，构建命令为
  `pnpm exec astro build --base=/DevTools`，部署到仓库的 GitHub Pages

## Security Rules（强制）

- **禁止使用 `eval()`、`Function()`、`setTimeout/setInterval(string)`** 处理用户输入，无任何例外
- 正则表达式执行必须使用 `new RegExp(pattern, flags)` 并包裹 `try-catch`
- URL 参数中的回调/代码片段必须做过滤和转义
- 用户输入必须经过校验后才能参与运算

## Tool Page Requirements（每个工具页面必须满足）

1. **输入格式检查 + 友好错误提示** — 在运算前验证输入格式，错误信息用中文描述具体问题。错误处理策略见 PRODUCT.md §Error
   Handling。
2. **"清空"和"复制结果"按钮** — 清空重置所有输入；复制结果到剪贴板并给出反馈
3. **合理的默认值** — 如果工具有适合的默认输入值，直接在代码中定义，让用户打开页面即可体验功能。不需要单独的"填入示例"按钮
4. **SEO 元数据完整** — 新增工具时必须在 `src/data/tools.ts` 中填写完整的 SEO 字段，有 FAQ 时同步在
   `src/data/tool-faqs.ts` 中添加问答对

## Development Conventions

- 页面 title 和布局使用 Layout.astro / ToolLayout.astro，通过 props 传递页面标题
- 交互型工具组件使用 Vue 3，通过 Astro `client:` 指令控制水合
- **Astro 水合策略**：工具组件默认使用 `client:idle`（页面空闲时水合），对需要立即响应用户输入的工具可用 `client:load`（如
  CronParser）。纯展示型组件不使用 `client:` 指令，保持零 JS
- 纯展示型组件使用 Astro 组件（.astro），保持零 JS 输出
- 新增公共组件/工具函数时必须写文档注释（JSDoc / TSDoc 格式）
- 可复用的 Vue 交互逻辑优先封装到 `src/composables/`，如 `useCopy` 封装剪贴板复制状态与 Toast 反馈

### Project Conventions

- **无路径别名**：项目不使用 `@/` 或 `~/` 等路径别名，所有导入使用相对路径（如 `../../utils/shared/clipboard`）
- **无 ESLint / Prettier 配置**：项目依靠 TypeScript strict 模式和代码审查保证一致性，不额外配置 lint/format 工具
- **测试文件位置**：单元测试放在被测模块所在目录的 `__tests__/` 子目录中，如
  `src/utils/format/__tests__/json-diff.test.ts`

### Styling Conventions（强制）

项目使用 Tailwind CSS v4，所有样式类名必须遵循以下规范：

#### 优先使用标准类名

**禁止使用任意值语法**（`-[value]`）来表示可以通过 Tailwind 标准类名表示的值：

❌ **错误**：
```html
<div class="w-[120px]">        <!-- 应使用 w-30 -->
<div class="min-h-[160px]">     <!-- 应使用 min-h-40 -->
<div class="max-w-[720px]">      <!-- 应使用 max-w-180 -->
```

✅ **正确**：
```html
<div class="w-30">              <!-- 30 * 4px = 120px -->
<div class="min-h-40">           <!-- 40 * 4px = 160px -->
<div class="max-w-180">          <!-- 180 * 4px = 720px -->
```

**转换规则**：Tailwind 默认间距系统基于 4px 单位，计算公式为 `像素值 / 4 = 类名数值`。

常见转换对照：
| 任意值语法 | 标准类名 | 像素值 |
|-----------|---------|--------|
| `w-[80px]` | `w-20` | 80px |
| `w-[120px]` | `w-30` | 120px |
| `w-[140px]` | `w-35` | 140px |
| `w-[160px]` | `w-40` | 160px |
| `w-[180px]` | `w-45` | 180px |
| `w-[200px]` | `w-50` | 200px |
| `min-h-[120px]` | `min-h-30` | 120px |
| `max-h-[400px]` | `max-h-100` | 400px |

#### 任意值语法的合法使用场景

以下情况**允许且必须**使用任意值语法：

1. **设计令牌值**（定义于 DESIGN.md）：
   - 文本大小：`text-[0.8125rem]`（label）、`text-[0.75rem]`（sidebar-heading）
   - 这些是精确的排版尺寸，不在 Tailwind 默认系统中

2. **特殊值**（非 4 的倍数）：
   - `h-[57px]`、`w-[57px]` 等无法被标准类名精确表示的值

3. **特殊层级和效果**：
   - z-index：`z-[99]`、`z-[100]`（Toast 层级）
   - 自定义阴影：`shadow-[0_2px_8px_rgba(0,0,0,0.06)]`

#### 为什么要遵守这个规范

1. **更好的 CSS 压缩**：标准类名可以被 PurgeCSS/tree-shaking 更好地优化
2. **更好的可读性**：`w-30` 比 `w-[120px]` 更简洁易懂
3. **设计一致性**：遵循 Tailwind 的 4px 基准单位系统，避免随意选择的数值
4. **避免 IDE 警告**：JetBrains IDEA 等 IDE 会提示任意值语法可以转换为标准类名

#### 检查和修复

使用 IDEA MCP 工具检查文件中的任意值语法：
```bash
# 获取文件中的所有 Tailwind 警告
get_file_problems(filePath="src/components/Example.vue")
```

定期运行以下检查确保代码符合规范：
```bash
# 搜索可能需要转换的任意值
search_text("w-[1")  # 搜索宽度任意值
search_text("h-[1")  # 搜索高度任意值
search_text("min-w-[1")  # 搜索最小宽度任意值
```

## Dependency Rules（强制）

### 库选型原则

- **优先使用稳定成熟的库**：选择 npm 周下载量高、维护活跃、无已知安全漏洞的库（如
  dayjs、@noble/ciphers、uuid）。新增依赖前需确认其社区活跃度和兼容性
- **禁止引入未经广泛验证的实验性库**：如果功能可用浏览器原生 API（Web Crypto API、TextEncoder、URL 等）实现，优先使用原生方案
- **同类库不重复引入**：已有 dayjs 处理日期则不再引入 moment/luxon；已有 @noble/ciphers 则不再引入 crypto-js
