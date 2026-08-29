# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Astro 6 + Vue 3 的纯浏览器端工具站，无后端。组织原则：**页面路由与实现组件目录对称**、**共享与私有严格分层**（私有组件不上浮全局，跨 3+ 工具复用才上浮）、**纯函数引擎与 UI 分离**。

上级规范：`AGENTS.md`（编码快速参考）、`PRODUCT.md`（产品行为）、`DESIGN.md`（视觉令牌）。本文件是代码层细化，冲突以上级为准。

---

## Directory Layout

```
src/
├── layouts/        # 页面骨架：Layout.astro（首页/分类）、ToolLayout.astro（工具页）、SimpleLayout.astro
├── pages/          # 文件路由，每个 .astro 一个 URL；纯展示页零 JS
├── tools/          # 工具实现（按分类子目录：text/ crypto/ format/ network/ datetime/ frontend/ devops/）
│   └── devops/
│       ├── RedisConfigGenerator.vue        # 工具页主组件（页面级）
│       └── redis-config/                   # 工具私有目录（典型范式，见下）
├── components/
│   ├── ui/         # 共享交互原语 + shadcn-vue 组件库
│   ├── layout/     # 布局组件（ToolHeader、Breadcrumb、RelatedTools 等，多为 .astro 纯展示）
│   └── shell/      # 全局壳层（Shell.vue 唯一 client:load island + SearchPanel + FeedbackForm）
├── composables/    # Vue 组合式函数（useCopy.ts、useImageBatch.ts）+ __tests__/
├── stores/         # 模块级 reactive store（toast/theme/sidebar/search），ESM 单例跨 island 共享
├── lib/            # cn()（clsx + tailwind-merge），供 shadcn 组件合并 class
├── data/           # 工具注册表（tools.ts、tool-faqs.ts、categories.ts）+ __tests__/
├── utils/          # 按领域分目录的纯函数（color/crypto/format/regex/...），耗时运算放 *.worker.ts
├── styles/         # global.css 设计令牌（Tailwind v4 :root/.dark + @theme inline）
├── types/          # 第三方库类型补充
├── tests/          # 分类集成测试 src/tests/{category}/
└── assets/         # Astro import 引用的静态资源
public/             # 不经处理的静态文件
```

---

## Module Organization

### 工具页 = 路由 + 主组件 + 私有目录（对称规则）

新增工具必须保持 `pages/` 与 `tools/` 路径对称：

```
src/pages/{category}/{tool}.astro    # import 主组件 + <ToolLayout toolId="{category}/{tool}"> + client:idle
src/tools/{category}/{Tool}.vue      # 工具页主组件（PascalCase）
```

复杂工具在其旁建**私有目录**（范式：`src/tools/devops/redis-config/`）：

```
redis-config/
├── params.ts        # 参数定义表（数据层，纯数据）
├── compute.ts       # 画像 → 默认值公式（纯函数，不 import Vue）
├── generate.ts      # 渲染引擎：params + ctx → 行数组（纯函数）
├── version.ts       # 版本序数与可用性过滤（纯函数）
├── secret.ts        # 密码生成（crypto.getRandomValues）
├── components/      # 工具私有组件（NumberField.vue 等，绝不 import 进其他工具）
└── __tests__/       # 与源码同目录
```

分层原则：**数据与计算全部是可单测的纯函数**，Vue 组件只做输入绑定与展示。MySQL/PG 生成器复用的是这套"引擎模式"而非具体代码。

### 组件归属判定

| 类型 | 位置 | 判定 |
|---|---|---|
| shadcn-vue 原语 | `components/ui/{button,card,...}/` | cva 变体 + cn()，由 CLI/手工按 shadcn 规范落地 |
| 共享交互组件 | `components/ui/Xxx.vue` | 被 3+ 工具使用的通用交互（SelectListbox、OptionRadioGroup、CopyButton、CodePanel、ToggleSwitch…）|
| 布局展示 | `components/layout/Xxx.astro` | 纯展示零 JS（ToolHeader、Breadcrumb、ToolCard…）|
| 全局壳层 | `components/shell/` | Shell.vue（唯一 `client:load`）+ 搜索/反馈 |
| 工具私有 | `src/tools/{category}/{tool-dir}/components/` | 仅单个工具使用，**不上浮** |

### 耗时运算

大文件哈希、深层 JSON diff 等放 Web Worker：`src/utils/{feature}/{feature}.worker.ts`，
组件里 `new Worker(new URL('./path.ts', import.meta.url), { type: 'module' })`。
实例：`src/utils/format/json-diff.worker.ts`、`src/utils/regex/regex.worker.ts`。

---

## Naming Conventions

- 组件文件 PascalCase（`ToolHeader.astro`、`NumberField.vue`）；ts 工具 camelCase（`useCopy.ts`、`tool-faqs.ts`）
- 工具注册 id 用 kebab-case（`redis-config-generator`），与路由 slug 一致
- 目录名：领域复数或工具 slug（`components/ui/`、`utils/format/`）
- 测试目录固定叫 `__tests__/`，与被测模块同目录；集成测试在 `src/tests/{category}/`

---

## Examples

- 最佳实践完整范式：`src/tools/devops/redis-config/`（引擎 + 私有组件 + 全套单测）
- 共享组件范式：`src/components/ui/SelectListbox.vue`（reka-ui 封装 + 组件级测试）
- 组合式函数范式：`src/composables/useCopy.ts`
