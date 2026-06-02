# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

基于 Astro 6 的在线开发者工具网站。所有运算在用户浏览器端完成，不依赖后端服务。工具覆盖编程/软件开发常用场景（正则测试、编解码、格式化、转换等）。

## Commands

```bash
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
pnpm preview    # 预览构建结果
```

## Tech Stack

- **Framework:** Astro 6.4.2（无 UI 框架集成，纯 Astro 组件 + 原生 JS）
- **Language:** TypeScript（strict 模式，继承 astro/tsconfigs/strict）
- **Styling:** Astro scoped CSS（组件内 `<style>` 标签），无外部 CSS 框架
- **Package Manager:** pnpm
- **Node:** >=22.12.0

## Architecture

```
src/
├── layouts/     # 页面骨架（Layout.astro）
├── pages/       # 基于文件的路由，每个 .astro 文件对应一个 URL
├── components/  # 可复用 UI 组件
└── assets/      # 静态资源（通过 Astro import 引用）
public/          # 不经处理的静态文件（favicon 等）
```

路由采用 Astro 文件路由：`src/pages/json-formatter.astro` → `/json-formatter`。工具页面直接作为 pages 下的 `.astro` 文件组织。

## Security Rules（强制）

- **禁止使用 `eval()`、`Function()`、`setTimeout/setInterval(string)`** 处理用户输入，无任何例外
- 正则表达式执行必须使用 `new RegExp(pattern, flags)` 并包裹 `try-catch`
- URL 参数中的回调/代码片段必须做过滤和转义
- 用户输入必须经过校验后才能参与运算

## Tool Page Requirements（每个工具页面必须满足）

每个工具页面必须包含以下三个要素：

1. **输入格式检查 + 友好错误提示** — 在运算前验证输入格式，错误信息用中文描述具体问题
2. **"清空"和"复制结果"按钮** — 清空重置所有输入；复制结果到剪贴板并给出反馈
3. **示例数据快捷填入** — 提供一键填入示例数据的按钮，方便用户快速体验

## Development Conventions

- 页面 title 和布局使用 Layout.astro，通过 props 传递页面标题
- 客户端交互逻辑使用 `<script>` 标签写在 `.astro` 文件内，利用 Astro 的 islands 架构保持零 JS 默认输出
- CSS 使用 Astro scoped styles，组件内 `<style>` 标签编写，不引入全局样式文件
- 新增公共组件/工具函数时必须写文档注释（JSDoc 格式）
