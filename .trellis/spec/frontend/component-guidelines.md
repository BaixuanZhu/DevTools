# Component Guidelines

> How components are built in this project.

---

## Overview

两类组件两种写法：

- **Astro 组件**（`.astro`）：纯展示，零 JS、零水合（`components/layout/` 的 ToolHeader、Breadcrumb 等）
- **Vue 组件**（`.vue` + `<script setup lang="ts">`）：一切交互；按需水合（工具页默认 `client:idle`，需立即响应才 `client:load`；全局壳层 Shell.vue 唯一 `client:load`）

交互组件优先组合 reka-ui 原语（Select/RadioGroup/Collapsible/Switch/Dialog）+ shadcn-vue 封装（`components/ui/`），样式用 cva 变体 + `cn()`（`src/lib/utils.ts`）合并。

---

## Component Structure

`<script setup lang="ts">` 段内固定顺序（范式 `ControlPanel.vue`）：

1. 文件级 JSDoc（职责 + 私有/共享声明 + 关键约定）
2. import（相对路径）
3. `defineProps`（`withDefaults` + 逐字段 JSDoc）→ `defineEmits`（类型化对象）
4. 本地常量（选项表等）
5. `computed` → 本地函数（每个公共函数 JSDoc）
6. `<template>`

私有工具组件在头注释声明归属（"本工具私有"），共享组件声明 API 状态（"公共 API 冻结"，见下文 Props Conventions）。

**水合与 SSR 纪律**：island 的 setup 在服务端渲染时也会执行——浏览器副作用（随机数、测量、localStorage）必须放 `onMounted`（实例：`RedisConfigGenerator.vue` requirepass 自动生成，注释写明"避免 SSR/水合不匹配"）。

---

## Props Conventions

### Convention: 共享 ui 组件 API 冻结，扩展只做向后兼容增量

**What**: `src/components/ui/` 下的共享组件（被全站多个工具消费）props/emits 视为冻结 API；需要新能力时只新增**可选 props**，改默认值前必须 grep 全部消费方评估视觉影响。

**Why**: SelectListbox 有约 20 个消费方，改共享默认值等于批量变更全站外观；可选增量则零破坏。

**Example**（2026-08-29 真实案例）：SelectListbox 选项文本原固定 `justify-center`（用户反馈难看），处理方式是新增可选 `itemAlign?: 'left' | 'center' | 'right'`（默认 `left`）而非硬改样式，居中/右对齐场景传参即可：

```vue
<SelectListbox v-model="x" :options="opts" item-align="center" />
```

**Related**: 新增共享能力后在 `src/components/ui/__tests__/` 补组件级测试（SelectListbox.test.ts 是现成范式：portal 打开方式 + afterEach 统一 unmount 防 popper 异步更新空指针）。

---

## Styling Patterns

## Styling Patterns

- Tailwind v4，令牌在 `src/styles/global.css`（`:root`/`.dark` 双组变量 + `@theme inline`），utility class 消费；暗色靠 `.dark` 自动生效，组件内不做主题判断
- 间距 4px 规则：`像素/4`（120px → `w-30`）；任意值仅限设计令牌字号（`text-[0.8125rem]`）、非 4 倍数（`h-[57px]`）、自定义层级/阴影
- 多 class 合并用 `cn()`；状态样式优先 data 属性变体（`data-[state=checked]:bg-primary`），配 `transition-[background-color] duration-150` 微过渡
- 骨架与内容分离：卡片 `rounded-lg border border-border bg-card`，行式清单 `divide-y divide-border`（范式：redis-config 分组清单）

---

## Accessibility

- 交互原语一律用 reka-ui 封装（自动获得键盘/焦点管理），不自造下拉/弹层
- 表单控件：`<label for>` 关联；无可见 label 时 `aria-label`（范式 `NumberField` 的 `label` prop）
- 校验错误：`:aria-invalid` + `aria-describedby` 指向错误文案 id（范式 `ControlPanel.vue` 主库地址/内网 IP 输入框）
- 装饰性图标 `aria-hidden="true"`；折叠触发器用 reka-ui CollapsibleTrigger（自带 expanded 语义）
- 颜色对比走设计令牌（`text-muted-foreground` 等），不自调透明度文字

---

## Common Mistakes

### Common Mistake: reka-ui SelectItem 空字符串 value 直接抛错

**Symptom**: 下拉一打开，该组件树被异常打断——面板折叠失效、下拉"点不开"、后续交互全部失灵（无显式报错弹窗，只有 console error）。

**Cause**: reka-ui `SelectItem` 对 `value === ""` 直接 `throw new Error("A <SelectItem /> must have a value prop that is not an empty string...")`（空串被保留用于清除选择/placeholder）。任何 `options` 数组里出现 `{ value: '', ... }` 都会在选项渲染时炸掉整棵树。

**Fix / Prevention**: 下拉选项值**禁止空串**。语义上的"空/关闭"用字面值表达（如 redis.conf 的 `save ""` → TS 字符串 `'""'`），渲染层照常输出。防回归不变量见 `src/tools/devops/redis-config/__tests__/params.test.ts`（遍历断言所有 select 选项值非空）。

```ts
// Bad — 渲染即抛错
{ value: '', label: '关闭自动快照' }
// Correct — 字面值表达"空"，conf 输出 save ""
{ value: '""', label: '关闭自动快照（save ""）' }
```

### Common Mistake: Vue 组件里用 `valueOf` 等 Object.prototype 同名方法做绑定名

**Symptom**: SSR 非内联渲染下方法解析到原型链而非 setup 绑定，行为诡异难排查。

**Fix**: 换名（如 `currentValueOf`）。实例：`RedisConfigGenerator.vue` 的 `currentValueOf()`。
