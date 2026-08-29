# Hook Guidelines

> Vue 组合式函数（composables）在本项目的写法。本项目无 React，"hook" 一律指 Vue composable。

---

## Overview

可复用的**有状态交互逻辑**放 `src/composables/`（命名 `useXxx.ts`）；纯函数工具放 `src/utils/`（无 Vue 依赖）。判定：逻辑里出现 `ref`/`computed`/`watch`/生命周期 → composable；否则 → utils。

现有清单（保持少量、高复用）：`useCopy.ts`（剪贴板交互态）、`useImageBatch.ts`（批量图片处理进度）。

---

## Custom Hook Patterns

标准结构（范式：`src/composables/useCopy.ts`）：

```ts
import { ref, type Ref } from 'vue';

/** 可选项：interface UseXxxOptions，字段带 JSDoc 与默认值说明 */
export interface UseCopyOptions {
  /** 复制成功后状态保持时长，默认 1500ms */
  duration?: number;
}

/** 返回值：interface UseXxxResult，ref 字段显式标 Ref<T> */
export interface UseCopyResult {
  /** 是否处于"已复制"确认态 */
  copied: Ref<boolean>;
  /** 触发复制 */
  copy: (text: string) => Promise<void>;
}

/** 工厂函数形式（不是单例）——每次调用返回全新状态 */
export function useCopy(options?: UseCopyOptions): UseCopyResult {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  // ...内部管理 timer，副作用自负清理
}
```

要点：

- **工厂函数**而非模块级单例：调用方各自持有状态；跨 island 全局状态属于 `src/stores/`（见 state-management.md）
- Options / Result 两个 interface 都导出并逐字段写 JSDoc（用户注释规则：公共 API 必须文档注释）
- 定时器/监听器在函数内自清理；涉及组件卸载的场景由调用方在 `onBeforeUnmount` 处理或用 `watch` 自动清理
- 失败反馈走 `toastStore`，不在 composable 里自造提示 UI

---

## Data Fetching

无后端、无服务端状态。浏览器 API（Clipboard、crypto.subtle、FileReader、Workers）的异步封装都按上面的工厂函数模式做；不引入 TanStack Query / SWR 之类请求库（依赖规则：禁止实验性/重复库）。

---

## Naming Conventions

- 文件与函数同名：`useCopy.ts` → `export function useCopy()`
- 返回接口 `UseXxxOptions` / `UseXxxResult` 成对出现
- 只读状态返回 `Ref<boolean>` 形态并在 JSDoc 标注语义（如"已复制确认态"）

---

## Common Mistakes

### Common Mistake: 把一次性逻辑抽成 composable

**Symptom**: `src/composables/` 堆满只有单个工具使用的函数，形成虚假的"共享层"。

**Fix**: 只有一个消费方的逻辑留在工具私有目录（如 `redis-config/secret.ts` 的 `generatePassword()` 是纯函数所以放私有目录而非 composable）；跨 3+ 工具复用才上浮（与组件上浮规则一致）。

### Common Mistake: composable 里直接操作 DOM 或全局单例状态

**Fix**: 交互态返回 ref 给调用方绑定；全局通知一律 `toastStore.show/success/error(msg)`。
