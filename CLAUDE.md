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
- **Package Manager:** pnpm
- **Node:** >=22.12.0

## Architecture

```
src/
├── layouts/     # 页面骨架（Layout.astro, ToolLayout.astro）
├── pages/       # 基于文件的路由，每个 .astro 文件对应一个 URL
├── tools/       # 工具页面（按分类组织子目录：encoding/、crypto/、datetime/ 等）
├── components/  # 可复用 UI 组件（.vue 交互型 + .astro 纯展示）
├── data/        # 工具注册表（tools.ts）
├── utils/       # 工具函数
├── styles/      # 设计令牌（global.css @theme 块）
└── assets/      # 静态资源（通过 Astro import 引用）
public/          # 不经处理的静态文件（favicon 等）
```

路由采用 `/category/tool-name` 二级结构：`src/tools/encoding/base64.astro` → `/encoding/base64`。工具注册表位于 `src/data/tools.ts`。URL 策略详见 PRODUCT.md §URL Strategy。

## Security Rules（强制）

- **禁止使用 `eval()`、`Function()`、`setTimeout/setInterval(string)`** 处理用户输入，无任何例外
- 正则表达式执行必须使用 `new RegExp(pattern, flags)` 并包裹 `try-catch`
- URL 参数中的回调/代码片段必须做过滤和转义
- 用户输入必须经过校验后才能参与运算

## Tool Page Requirements（每个工具页面必须满足）

1. **输入格式检查 + 友好错误提示** — 在运算前验证输入格式，错误信息用中文描述具体问题。错误处理策略见 PRODUCT.md §Error Handling。
2. **"清空"和"复制结果"按钮** — 清空重置所有输入；复制结果到剪贴板并给出反馈
3. **示例数据快捷填入** — 提供一键填入示例数据的按钮，方便用户快速体验

## Development Conventions

- 页面 title 和布局使用 Layout.astro / ToolLayout.astro，通过 props 传递页面标题
- 交互型组件使用 Vue 3 `<script setup lang="ts">` + Composition API，通过 Astro `client:` 指令控制水合
- 纯展示型组件使用 Astro 组件（.astro），保持零 JS 输出
- 样式统一使用 Tailwind utility class，令牌和组件规范见 DESIGN.md
- 新增公共组件/工具函数时必须写文档注释（JSDoc / TSDoc 格式）
