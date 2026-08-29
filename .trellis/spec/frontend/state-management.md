# State Management

> How state is managed in this project.

---

## Overview

三层模型，按作用域自上而下选择，**禁止引入 Pinia 等全局状态库**（依赖规则强制）：

1. **模块级 reactive store**（`src/stores/*.ts`）——跨 island 共享的壳层状态，ESM 单例
2. **工具本地页面状态**——工具主组件持有的 `reactive` ctx + `computed` 派生（范式：`RedisConfigGenerator.vue`）
3. **组件内 ref/computed**——默认选择，作用域最小优先

无服务端状态（纯浏览器端运算、无后端），无请求缓存问题。

---

## State Categories

### 1. 模块级 store（壳层全局）

`src/stores/`：`toast.ts`、`theme.ts`、`sidebar.ts`、`search.ts`。

- 模块顶层创建 `ref`/`reactive`，**ESM 单例**——多个 island import 同一模块即共享同一份状态
- 只暴露函数与只读 ref，不暴露可随意赋值的内部结构（范式见 `toast.ts`：`show/success/error` 函数 + `items` 镜像 ref）
- 适配层模式：`toastStore` 保留原 API（30+ 调用方零改动），内部委派 vue-sonner 渲染（Shell 全局挂载一次 `<Toaster />`）。**禁止** `CustomEvent` 字符串桥接、**禁止**自建 toast 队列

```ts
// 任意组件/组合式函数里直接调用，无需 provide/inject
import { toastStore } from '../../stores/toast';
toastStore.success('已开始下载 redis.conf');
```

### 2. 工具本地页面状态（引擎 + ctx 模式）

复杂工具用「纯函数引擎 + reactive ctx」：主组件持有上下文，computed 驱动输出。

```ts
// RedisConfigGenerator.vue（范式）
const ctx = reactive<GenerateContext>(createDefaultContext());   // 画像 + overrides
const lines = computed(() => generateConf(ctx));                 // 纯函数引擎实时渲染
```

约定（私有子组件）：**ctx 由父组件持有，子组件仅属性级直改，不整体替换**——`ControlPanel` 直接 `props.ctx.mode = v`，`overrides[param.key] = value`。

- 推荐值 vs 用户覆盖：画像字段（如 `listenScope`）进 `GenerateContext` 由 `compute()` 公式驱动；用户手动改动写 `ctx.overrides[key]`，resolve 时覆盖优先（范式 `redis-config/generate.ts` 的 `resolveValue`）
- **区分"画像字段"与"覆盖值"**：前者是公式输入（重置不丢），后者是用户个性化（重置清除）。放错层会导致重置后 UI 与数据不一致

### 3. 组件内状态

`ref`/`computed` 常规用法；跨组件无关的草稿态（如 NumberField 的输入草稿）留在最内层组件。

---

## When to Use Global State

仅当满足：**跨 island 共享** 且 **应用级生命周期**（主题、侧栏开合、搜索面板、toast）。工具自己的数据永远不进 store——配置生成器刷新即重置是特性不是缺陷（无持久化必要，见 `RedisConfigGenerator.vue` 头注释）。

---

## Server State

不存在。整站无后端；不要为此引入任何请求缓存库。

---

## Common Mistakes

### Common Mistake: 子组件整体替换 reactive 对象

**Symptom**: 父组件的 computed 失联或响应断裂。

**Fix**: 私有子组件只做 `props.ctx.field = v` 属性级赋值（`ControlPanel.vue` 的 `setMode/setVersion` 等收窄 setter）。

### Common Mistake: 用 Pinia/事件桥接解决跨 island 通信

**Fix**: ESM 模块级 store 已覆盖（vitest node 环境可直测，无需 mock 框架）。禁止 Pinia、禁止 CustomEvent 字符串桥接。

### Common Mistake: 客户端副作用写在 setup 顶层

**Symptom**: island 服务端渲染时 setup 也会执行，随机值导致 SSR/水合不匹配。

**Fix**: 依赖浏览器环境的初始化放 `onMounted`（实例：`RedisConfigGenerator.vue` 的 requirepass 自动生成）。
