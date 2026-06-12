# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Knowledge Sources

这两个文件是整个项目开发的 UI 指导，定义了产品行为和视觉规范的唯一标准。开发任何功能或修改任何界面时，必须先查阅对应文件并严格遵循。本文件只保留编码层面的快速参考。

| 文件 | 职责 | 何时查阅 |
|------|------|----------|
| **PRODUCT.md** | 产品定位、用户画像、工具分类、URL 策略、错误处理、浏览器兼容、性能基线、无障碍要求 | 新增工具页、修改产品行为、讨论功能优先级时 |
| **DESIGN.md** | 设计令牌、组件状态矩阵、布局模板、视觉规则、UI 组件选型、样式实现规则、工具页面组件模式、Do's & Don'ts | 编写任何 UI 代码前必读 |

## Code Search Rules（强制）

项目已接入两个代码搜索 MCP，**互为补充**，必须按场景选择最优工具。

### 两个 MCP 的能力边界

| | **Codegraph**（`mcp__codegraph__*`） | **IDEA**（`mcp__idea-codebase-mcp__*`） |
|---|---|---|
| **索引范围** | `.ts` `.vue` `.js` | 全部文件（含 `.astro`） |
| **Vue 组件** | ✅ 完美（组件、import、调用关系全跟踪） | ❌ 盲视（Vue 组件符号搜索返回空） |
| **Astro 文件** | ❌ 不索引 | ✅ 完整索引 |
| **调用关系图** | ✅ `callers` / `callees` / `impact` | ❌ 无此功能 |
| **代码理解** | ✅ `explore` 一次调用返回多文件源码+关系 | ❌ 需多次 `search_text` 拼凑 |
| **全局文本搜索** | ❌ 不提供 | ✅ `search_text` 精确匹配 |
| **TypeScript 符号** | ✅ 好 | ✅ 更强（含完整源码片段） |

### 按场景选择工具

| 场景 | 首选工具 | 备选/补充 |
|------|---------|----------|
| 理解一个功能/模块的工作原理 | **`codegraph_explore`**（主力，一次搞定） | — |
| 按名称查找 Vue 组件或函数 | **`codegraph_search`** | — |
| 查看某个符号的完整源码 | **`codegraph_node`**（`includeCode: true`） | IDEA `search_symbol`（仅 TS） |
| 查找调用关系 / 修改影响 | **`codegraph_callers` / `callees` / `impact`** | — |
| 搜索 `.astro` 文件内容（布局、页面路由、Alpine 逻辑） | — | **IDEA `search_text`**（Codegraph 不索引 .astro） |
| 全局文本搜索（字符串、配置值、CSS 类名） | — | **IDEA `search_text`** |
| 查找 `.astro` 页面文件 | — | **IDEA `search_file`** |
| 浏览项目文件结构（按语言分组） | **`codegraph_files`** | IDEA `list_directory_tree` |

### 硬性规则

1. **`codegraph_explore` 是代码理解的主力**：一个问题通常只需要一次调用，返回多文件源码 + 调用关系 + blast radius
2. **涉及 `.astro` 文件的搜索必须用 IDEA**：Codegraph 不索引 .astro，搜索布局、路由、Alpine 逻辑时用 IDEA `search_text`
3. **禁止 Grep + Read 循环**：不要先用 Grep 找文件再逐个 Read。先用 codegraph 或 IDEA 的专用搜索工具定位
4. **Grep/Read 仅作为最后补充**：只在两个 MCP 都未覆盖的边缘场景使用

## Project Overview

基于 Astro 6 的在线开发者工具网站。浏览器端运算，无后端。详细的产品定义见 PRODUCT.md。

## Commands

```bash
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
pnpm preview    # 预览构建结果
```

## Tech Stack

- **Framework:** Astro 6.4.2 + Vue 3（@astrojs/vue）
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
├── data/        # 工具注册表（tools.ts）
├── utils/       # 工具函数
├── styles/      # 设计令牌（global.css @theme 块）
└── assets/      # 静态资源（通过 Astro import 引用）
public/          # 不经处理的静态文件（favicon 等）
```

路由采用 `/category/tool-name` 二级结构：`src/tools/encoding/base64.astro` → `/encoding/base64`。工具注册表位于 `src/data/tools.ts`。URL 策略详见 PRODUCT.md §URL Strategy。

## Frontend Architecture

项目采用**双引擎**架构：

- **Alpine.js** — 负责全局壳层交互（侧边栏开关、Toast 通知、收藏夹面板、搜索过滤、暗色模式切换）。这些逻辑写在 `.astro` 页面和布局文件中，通过 `x-data` / `x-show` / `@click` 等指令实现。
- **Vue 3** — 负责工具内部的复杂交互（编码转换、JSON 格式化、哈希计算等）。每个工具是一个独立的 Vue 组件，通过 Astro `client:` 指令按需水合。

**跨框架通信**：Vue 组件通过 `CustomEvent('toast', { detail: { message } })` 触发 Alpine 管理的 Toast 通知系统。不需要引入全局状态库。

## Heavy Computation Pattern

耗时运算（大文件哈希、深层 JSON 对比等）使用 Web Worker 避免阻塞主线程：

- Worker 文件放在 `src/utils/` 对应子目录下，命名约定为 `{feature}.worker.ts`
- Vue 组件中通过 `new Worker(new URL('./path/to/worker.ts', import.meta.url), { type: 'module' })` 实例化
- Worker 与主线程通过 `postMessage` / `onmessage` 交换数据
- 现有参考：`src/utils/format/json-diff.worker.ts`、`src/utils/crypto/hash.worker.ts`

## Security Rules（强制）

- **禁止使用 `eval()`、`Function()`、`setTimeout/setInterval(string)`** 处理用户输入，无任何例外
- 正则表达式执行必须使用 `new RegExp(pattern, flags)` 并包裹 `try-catch`
- URL 参数中的回调/代码片段必须做过滤和转义
- 用户输入必须经过校验后才能参与运算

## Tool Page Requirements（每个工具页面必须满足）

1. **输入格式检查 + 友好错误提示** — 在运算前验证输入格式，错误信息用中文描述具体问题。错误处理策略见 PRODUCT.md §Error Handling。
2. **"清空"和"复制结果"按钮** — 清空重置所有输入；复制结果到剪贴板并给出反馈
3. **合理的默认值** — 如果工具有适合的默认输入值，直接在代码中定义，让用户打开页面即可体验功能。不需要单独的"填入示例"按钮
4. **SEO 元数据完整** — 新增工具时必须在 `src/data/tools.ts` 中填写完整的 SEO 字段，有 FAQ 时同步在 `src/data/tool-faqs.ts` 中添加问答对

## Development Conventions

- 页面 title 和布局使用 Layout.astro / ToolLayout.astro，通过 props 传递页面标题
- 交互型工具组件使用 Vue 3，通过 Astro `client:` 指令控制水合
- **Astro 水合策略**：工具组件默认使用 `client:idle`（页面空闲时水合），对需要立即响应用户输入的工具可用 `client:load`（如 CronParser）。纯展示型组件不使用 `client:` 指令，保持零 JS
- 纯展示型组件使用 Astro 组件（.astro），保持零 JS 输出
- 新增公共组件/工具函数时必须写文档注释（JSDoc / TSDoc 格式）

### Project Conventions

- **无路径别名**：项目不使用 `@/` 或 `~/` 等路径别名，所有导入使用相对路径（如 `../../utils/shared/clipboard`）
- **无 ESLint / Prettier 配置**：项目依靠 TypeScript strict 模式和代码审查保证一致性，不额外配置 lint/format 工具
- **测试文件位置**：单元测试放在被测模块所在目录的 `__tests__/` 子目录中，如 `src/utils/format/__tests__/json-diff.test.ts`

## Dependency Rules（强制）

### 库选型原则
- **优先使用稳定成熟的库**：选择 npm 周下载量高、维护活跃、无已知安全漏洞的库（如 dayjs、@noble/ciphers、uuid）。新增依赖前需确认其社区活跃度和兼容性
- **禁止引入未经广泛验证的实验性库**：如果功能可用浏览器原生 API（Web Crypto API、TextEncoder、URL 等）实现，优先使用原生方案
- **同类库不重复引入**：已有 dayjs 处理日期则不再引入 moment/luxon；已有 @noble/ciphers 则不再引入 crypto-js
