# Type Safety

> Type safety patterns in this project.

---

## Overview

- TypeScript **strict**（继承 `astro/tsconfigs/strict`），`pnpm astro check` 为门禁：**0 errors 才算过**（warnings/hints 需逐条判断）
- **无 ESLint/Prettier**，风格一致性靠 strict + 代码审查（AGENTS.md 明示）
- **无路径别名**：禁止 `@/` `~/`，import 一律相对路径（深层如 `../../../../components/ui/X.vue` 是正常现象）
- 无运行时校验库（Zod 等）——输入侧全是手工校验 + 中文错误提示（Tool Page Requirements），不引依赖

---

## Type Organization

- **领域类型定义在使用它的引擎层**，不设全局 types 目录（`src/types/` 仅放第三方库类型补充）
  - 范式：`redis-config/params.ts` 定义 `GenerateContext`/`ConfigParam`/`ParamValue`，`compute.ts`/`generate.ts`/组件层单向引用
  - `version.ts` 需要参数版本信息但避免循环依赖，定义了最小结构 `VersionedParam`（注释写明"避免与 params.ts 相互依赖"）——解耦优先于集中
- 公共类型随实现导出（`export interface`），字段逐个 JSDoc（用户注释规则：公共类/接口/函数必须文档注释，只补充"为什么"）

---

## Validation

运行时校验模式（无校验库，手写纯函数）：

```ts
// redis-config/components/ControlPanel.vue —— 布尔化 computed + 模板条件渲染
const bindIpError = computed(
  () => props.ctx.listenScope === 'intranet' && !props.ctx.bindIp.trim(),
);
```

- 输入框校验错误用 `:aria-invalid` + `aria-describedby` + 红边框 + 中文提示文案
- 数值输入在失焦时 clamp 到 `[min, max]`（范式 `NumberField.vue`），解析失败不 emit
- **正则执行必须** `new RegExp(pattern, flags)` 并包裹 try-catch（用户输入构造 pattern）

---

## Common Patterns

### 宽类型收窄 setter（事件回调 → 具体联合类型）

共享组件 emit `string | number`，写入具体联合字段时用集中收窄函数：

```ts
// ControlPanel.vue
function setMode(v: string | number): void {
  props.ctx.mode = v as GenerateContext['mode'];
}
```

### 值域联合类型贯穿全链路

```ts
// params.ts —— 一种参数值的所有形态
export type ParamValue = string | number | boolean | string[];

// 排除法派生：pre-7 不是可选目标版本
export type TargetVersion = Exclude<RedisVersion, 'pre-7'>;
```

### 泛型组件约束选项值

```ts
// OptionRadioGroup.vue
<script setup lang="ts" generic="T extends string | number">
```

### 模块级 ref 的显式断言

```ts
// stores/toast.ts —— ref() 推断不满足时的标准写法（而非 any）
const items = ref<ToastItem[]>([]) as Ref<ToastItem[]>;
```

### 类型辅助的边界

SFC 默认导出**不是可构造类型**，`InstanceType<typeof XxxVue>` 会报错；组件 props 类型用显式 interface 声明（范式 `SelectListbox.test.ts` 的 `SelectListboxProps`）。

---

## Forbidden Patterns

- **`any`**：禁止。事件 target 用 `($event.target as HTMLInputElement).value` 精确断言
- **路径别名**：`@/`、`~/` 一律不用
- **非空断言泛滥**：`getParam(key)!` 这类仅在测试/确证存在的场景可用，业务路径走 `undefined` 分支
- **`as` 双重断言 / `as unknown as`**：出现即设计问题，回炉类型建模
- **枚举**：用字符串字面量联合 + `as const` 对象（见 `LISTEN_SCOPE_HINTS`、`VERSION_ORDER`）
