# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Knowledge Sources

这两个文件是整个项目开发的 UI 指导，定义了产品行为和视觉规范的唯一标准。开发任何功能或修改任何界面时，必须先查阅对应文件并严格遵循。本文件只保留编码层面的快速参考。

| 文件 | 职责 | 何时查阅 |
|------|------|----------|
| **PRODUCT.md** | 产品定位、用户画像、工具分类、URL 策略、错误处理、浏览器兼容、性能基线、无障碍要求 | 新增工具页、修改产品行为、讨论功能优先级时 |
| **DESIGN.md** | 设计令牌（颜色/字体/间距/圆角）、组件状态矩阵、布局模板、视觉规则、Do's & Don'ts | 编写 UI、调整样式、创建新组件、审查视觉一致性时 |

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
4. **SEO 元数据完整** — 新增工具时必须在 `src/data/tools.ts` 中填写 `seoDescription`、`keywords`、`relatedToolIds`。有 FAQ 时同步在 `src/data/tool-faqs.ts` 中添加问答对（原生 `details/summary` 渲染，零 JS），ToolLayout 会自动注入 FAQ 结构化数据。

## Development Conventions

- 页面 title 和布局使用 Layout.astro / ToolLayout.astro，通过 props 传递页面标题
- 交互型组件使用 Vue 3 `<script setup lang="ts">` + Composition API，通过 Astro `client:` 指令控制水合
- **Astro 水合策略**：工具组件默认使用 `client:idle`（页面空闲时水合），对需要立即响应用户输入的工具可用 `client:load`（如 CronParser）。纯展示型组件不使用 `client:` 指令，保持零 JS
- 纯展示型组件使用 Astro 组件（.astro），保持零 JS 输出
- 样式统一使用 Tailwind utility class，令牌和组件规范见 DESIGN.md
- 新增公共组件/工具函数时必须写文档注释（JSDoc / TSDoc 格式）

### Project Conventions

- **无路径别名**：项目不使用 `@/` 或 `~/` 等路径别名，所有导入使用相对路径（如 `../../utils/shared/clipboard`）
- **无 ESLint / Prettier 配置**：项目依靠 TypeScript strict 模式和代码审查保证一致性，不额外配置 lint/format 工具
- **测试文件位置**：单元测试放在被测模块所在目录的 `__tests__/` 子目录中，如 `src/utils/format/__tests__/json-diff.test.ts`

### Tool Page Structure Template

最小工具页面示例（`.astro` 文件）：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import MyTool from './MyTool.vue';
---

<ToolLayout toolId="category/tool-name">
  <MyTool client:idle />
</ToolLayout>
```

工具 Vue 组件（`.vue` 文件）遵循标准模式：
- `<script setup lang="ts">` + Composition API
- 导入 `ToolHeader`、`CopyButton`、`ClearButton` 等布局组件
- 输入即输出，无需"运行"按钮（耗时操作除外）
- 使用 `focus:outline-none focus:border-accent` 给 input/textarea 添加焦点样式

## Dependency & Component Rules（强制）

### 库选型原则
- **优先使用稳定成熟的库**：选择 npm 周下载量高、维护活跃、无已知安全漏洞的库（如 dayjs、@noble/ciphers、uuid）。新增依赖前需确认其社区活跃度和兼容性
- **禁止引入未经广泛验证的实验性库**：如果功能可用浏览器原生 API（Web Crypto API、TextEncoder、URL 等）实现，优先使用原生方案
- **同类库不重复引入**：已有 dayjs 处理日期则不再引入 moment/luxon；已有 @noble/ciphers 则不再引入 crypto-js

### UI 组件规则
- **优先使用 @headlessui/vue 组件**：涉及 Tab 切换、开关、下拉选择、折叠面板、对话框、弹出层等交互模式时，使用 Headless UI 的对应组件（TabGroup/Switch/Listbox/Disclosure/Dialog/Popover 等），不要手写或引入其他 UI 框架
- **已有封装组件优先复用**：`src/components/ui/` 下已有 ToggleSwitch（开关）、SelectListbox（下拉选择）、ModeTabGroup（Tab 切换）、OptionRadioGroup（单选按钮组）、CopyButton（复制）、ClearButton（清空）、ColorInput（颜色选择器）、CodePanel（代码展示）等封装组件，新功能应先检查是否有可复用的组件
- **自定义交互组件走 Vue 3 Composition API**：Headless UI 无法覆盖的交互需求，使用 Vue 3 `<script setup lang="ts">` + Composition API 自行实现，保持无障碍（ARIA、键盘导航、focus 管理）

### 样式规则
- **统一使用 Tailwind utility class**：所有样式通过 Tailwind class 表达，禁止内联 style、禁止引入额外 CSS 框架（如 Bootstrap、Element Plus、Ant Design Vue）
- **消费设计令牌**：颜色、间距、圆角、字体使用 `global.css` @theme 中定义的令牌（如 `text-surface`、`bg-card`、`border-default`），避免硬编码数值
- **组件状态完整**：每个可交互元素必须覆盖 hover / focus / active / disabled 状态，状态样式参考 DESIGN.md 组件状态矩阵
- **Focus 样式约束**：仅 `input`、`textarea` 等文本输入元素使用 `focus:outline-none focus:border-accent` 表示焦点状态。按钮、radio、select、tab、details/summary 等其他交互元素**不添加任何 focus 视觉样式**。
