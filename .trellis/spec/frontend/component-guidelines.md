# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

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

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

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
