# 运行时统一重构 · 阶段 0：基建（Foundation）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有功能的前提下，建立新运行时的基建——shadcn-vue/Reka 工具链就绪、Tailwind v4 token 体系对齐 shadcn 语义、5 个模块级 store 骨架（含单测），为阶段 1（壳层迁移）铺路。

**Architecture:** 保留 Astro + Vue 双层（Astro 页面 / Vue islands）。新增 `src/stores/` 模块级 reactive 单例 store，替代散落的 Alpine `x-data`/`$store`。`global.css` 从单一 `@theme` 改造为 `:root`/`.dark` + `@theme inline`，对齐 shadcn v4 token 模式。Alpine 与 `@headlessui/vue` 本阶段**保留不动**（共存可工作），阶段 1/2 再移除。

**Tech Stack:** Astro 6 · Vue 3.5 · Reka UI（新）· shadcn-vue（新，源码复制模式）· Tailwind CSS v4 · Vitest 4（globals + node 环境）

**Spec:** `docs/superpowers/specs/2026-07-21-runtime-unification-design.md`

## Global Constraints

（每个任务的隐含前提，源自 spec 与项目约定）

- **不引入路径别名**：项目无 `@/`，shadcn 组件 import 一律改相对路径（spec §8 决策）
- **注释**：公共 API 必须有 JSDoc/TSDoc；store 公共方法写功能说明（CLAUDE.md 注释规则）
- **Tailwind v4**：优先标准类名，禁止任意值语法表达可用标准类名的值（CLAUDE.md Styling Conventions）
- **store 模式**：模块级 `ref`/`reactive` 单例，**不引入 Pinia**（spec §4）
- **SSR/水合陷阱**：涉及 UI 变更必须 `pnpm dev` 浏览器实测；build/类型/单测全过≠运行时正确（记忆 `astro-ssg-tolerates-vue-ssr-errors`）
- **安全**：禁止 `eval()`/`Function()`；正则用 `new RegExp` + try-catch
- **测试位置**：`src/stores/__tests__/{name}.test.ts`（同目录 `__tests__`，遵循项目约定）
- **环境**：Node >=22.12，pnpm；当前分支 `refactor/runtime-unification`

## File Structure

| 文件 | 职责 | 任务 |
|---|---|---|
| `package.json` | 新增 reka-ui / clsx / tailwind-merge / cva / tw-animate-css | Task 1 |
| `src/lib/utils.ts` | `cn()` class 合并函数（shadcn 标配） | Task 2 |
| `components.json` | shadcn-vue 配置（相对路径，无别名） | Task 2 |
| `src/styles/global.css` | token 体系重构（`:root`/`.dark` + `@theme inline`） | Task 3 |
| 全项目 `.vue`/`.astro` | 语义 class 重命名（grep 批量） | Task 3 |
| `src/stores/toast.ts` + `__tests__/toast.test.ts` | toast 队列 store | Task 4 |
| `src/stores/favorites.ts` + 测试 | 收藏 store（localStorage 持久化） | Task 5 |
| `src/stores/theme.ts` + 测试 | 主题 store（dark class 切换） | Task 6 |
| `src/stores/sidebar.ts` + 测试 | 侧栏开关 store | Task 7 |
| `src/stores/search.ts` + 测试 | 搜索 store（`filterTools` 纯函数） | Task 8 |

---

## Task 1: 安装运行时依赖并验证 Reka UI 可用

**Files:**
- Modify: `package.json`（新增依赖）

**Interfaces:**
- Produces: `reka-ui`、`clsx`、`tailwind-merge`、`class-variance-authority`、`tw-animate-css` 可 import（后续任务的运行时基座）

**Why this task is first:** shadcn-vue + Tailwind v4 是整条路线最大不确定点（spec §9）。先验证 Reka UI（shadcn-vue 底层）能在本项目 import 并渲染，是 go/no-go 节点。失败则退回「Reka + 自写样式」。

- [ ] **Step 1: 安装依赖**

```bash
pnpm add reka-ui class-variance-authority clsx tailwind-merge
pnpm add -D tw-animate-css
```

> `tw-animate-css` 是 Tailwind v4 下 shadcn 动画依赖（替代 v3 的 `tailwindcss-animate`）。

- [ ] **Step 2: 验证 reka-ui 可 import（写一个临时冒烟测试）**

Create `src/stores/__tests__/smoke-reka.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('reka-ui smoke', () => {
  it('能从 reka-ui 导入 SwitchRoot（验证依赖安装链路）', async () => {
    const mod = await import('reka-ui');
    expect(mod.SwitchRoot).toBeDefined();
  });
});
```

- [ ] **Step 3: 跑冒烟测试，确认通过**

Run: `pnpm test src/stores/__tests__/smoke-reka.test.ts`
Expected: PASS（1 test）

- [ ] **Step 4: 删除临时冒烟测试**

```bash
rm src/stores/__tests__/smoke-reka.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: 引入 reka-ui 与 shadcn 工具链依赖

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: shadcn-vue 手动配置（无别名）+ cn 工具函数

**Files:**
- Create: `src/lib/utils.ts`
- Create: `components.json`
- Create: `src/components/ui/Button.vue`（验证链路用，后续可替换为 shadcn add 产物）

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`（`src/lib/utils.ts`，所有 shadcn 组件消费）；shadcn-vue 配置就绪

**Why manual config:** shadcn-vue CLI 依赖 `@/` 别名生成 import 路径，但项目硬约束无别名（Global Constraints）。故手动建立配置 + 用相对路径复制首个组件，验证整条 token→cn→组件 链路。后续 add 组件沿用此手动流程。

- [ ] **Step 1: 创建 cn 工具函数**

Create `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind class 名。
 *
 * clsx 处理条件/数组输入，tailwind-merge 消解冲突的 Tailwind utility
 * （如 `px-2 px-4` → `px-4`）。shadcn 组件统一用它拼 class。
 * @param inputs - 任意 class 值（字符串/对象/数组）
 * @returns 合并去重后的 class 字符串
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: 创建 shadcn-vue 配置（相对路径，无别名）**

Create `components.json`:

```json
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "new-york",
  "typescript": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/global.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "framework": "vite",
  "aliases": {
    "components": "src/components",
    "composables": "src/composables",
    "utils": "src/lib/utils",
    "ui": "src/components/ui",
    "lib": "src/lib"
  },
  "iconLibrary": "lucide"
}
```

> 注：不配置 tsconfig `paths`。shadcn-vue CLI 默认生成 `@/...` import，本项目**不跑 CLI 的路径逻辑**，改为手动复制组件源码后把 `@/` 改回相对路径。

- [ ] **Step 3: 创建验证用 Button 组件（手动复制 shadcn-vue Button，改相对路径）**

Create `src/components/ui/Button.vue`:

```vue
<script setup lang="ts">
/**
 * shadcn-vue 风格 Button（验证用最小实现）。
 *
 * 仅用于 Task 2 验证 cn + token 链路；Task 3 token 重构后，
 * 此组件的 class（bg-primary 等）会指向新语义变量。
 */
import { cn } from '../../lib/utils';

withDefaults(
  defineProps<{
    variant?: 'default' | 'outline';
    class?: string;
  }>(),
  { variant: 'default' },
);

const base =
  'inline-flex items-center justify-center rounded-sm px-4 py-2 text-sm font-medium transition-[background-color] duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
const variants: Record<string, string> = {
  default: 'bg-primary text-white hover:bg-primary/90',
  outline: 'border border-border bg-card text-foreground hover:bg-accent',
};
</script>

<template>
  <button :class="cn(base, variants[variant], $props.class)">
    <slot />
  </button>
</template>
```

- [ ] **Step 4: 类型检查通过**

Run: `pnpm astro check`
Expected: 无新增 error（Button.vue 类型合法）

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts components.json src/components/ui/Button.vue
git commit -m "build: 配置 shadcn-vue（无别名）与 cn 工具函数

Co-Authored-By: Claude <noreply@anthropic.com>"
```

> ⚠️ Button.vue 的视觉验证推迟到 Task 3 token 重构后（此时 `bg-primary` 等变量尚未定义，会显示为默认色，正常）。

---

## Task 3: Token 体系重构（global.css + 全局语义重命名）

**Files:**
- Modify: `src/styles/global.css`（整体重写 `@theme` 区块）
- Modify: 全项目 `.vue`/`.astro`（语义 class grep 替换）

**Interfaces:**
- Produces: shadcn v4 token 体系（`:root`/`.dark` + `@theme inline`）；全项目 class 用新语义名

**Why one big task:** `accent` 在旧体系=品牌橙、在新 shadcn 体系=悬停底色，**语义冲突无法用别名共存**，必须原子重命名 CSS + 组件 class（否则中间状态样式错乱）。任务内按 class 分组 bite-sized step，最后统一验证 + 单次 commit。

### Step 1: 重写 global.css 的 token 区块

- [ ] **Step 1: 替换 `@theme {...}` 区块为新的三层结构**

Modify `src/styles/global.css`——把开头的 `@import "tailwindcss";` 和 `@theme {...}` 块（约第 1–24 行）整体替换为：

```css
@import "tailwindcss";
@import "tw-animate-css";

/* ============ 语义层：浅色 + 暗色两组 ============ */
:root {
  --background: #faf9f7;            /* 原 --color-surface，页面底 */
  --foreground: #1a1a1a;            /* 原 --color-text，主文字 */
  --card: #ffffff;                  /* 卡片/壳层底 */
  --primary: #e8590c;               /* 原 --color-accent，品牌橙（主操作色） */
  --border: #e5e2dd;                /* 边框/分割线 */
  --muted: #f3f1ee;                 /* 次要背景 */
  --muted-foreground: #6b7280;      /* 原 text-muted，次要文字 */
  --accent: #f3f1ee;                /* shadcn 语义：悬停/次要底色（原 --color-hover） */
  --destructive: #dc2626;           /* 原 --color-error */
  --success: #16a34a;               /* 成功色（项目保留，不改 destructive） */
  --radius: 0.25rem;
}
.dark {
  --background: #161514;
  --foreground: #f3f1ee;
  --card: #1f1e1c;
  --primary: #f97316;
  --border: #2a2826;
  --muted: #2a2826;
  --muted-foreground: #a1a1aa;
  --accent: #2a2826;
  --destructive: #ef4444;
  --success: #22c55e;
}

/* ============ 映射层：注入 Tailwind 命名空间 ============ */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-primary: var(--primary);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-error: var(--destructive);     /* 兼容：旧 text-error 指向 destructive */
  --radius-sm: calc(var(--radius));
  --radius-md: calc(var(--radius) * 2);
  --radius-lg: calc(var(--radius) * 3);
  --font-sans: 'Noto Sans SC', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
}
```

> 保留 `--color-error`/`--color-success` 别名，避免 `text-error`/`text-success` 也需重命名（减少 grep 面）。`@theme inline` 的 `inline` 关键字让变量值内联，支持运行时主题切换。

### Step 2–8: 全局语义 class 重命名（逐条 grep 替换 + 验证）

> 执行方式（Windows git bash）：每条规则先 `grep -rn` 看影响范围，再 `sed -i` 替换。替换后保留 `bg-card`/`border-border`/`text-error`/`text-success` 不变（已在 token 中对齐）。

- [ ] **Step 2: `bg-surface` → `bg-background`**

```bash
grep -rln 'bg-surface' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/bg-surface/bg-background/g'
```

- [ ] **Step 3: `text-text` → `text-foreground`**

```bash
grep -rln 'text-text' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/text-text/text-foreground/g'
```

> 注意 `text-text` 可能误匹配 `text-text-lg` 之类——执行后用 `grep -rn 'text-text' src` 确认无残留/无误伤。

- [ ] **Step 4: `bg-accent` → `bg-primary`（品牌橙底）**

```bash
grep -rln 'bg-accent' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/bg-accent/bg-primary/g'
```

- [ ] **Step 5: `text-accent` → `text-primary`；`border-accent` → `border-primary`**

```bash
grep -rln 'text-accent' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/text-accent/text-primary/g'
grep -rln 'border-accent' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/border-accent/border-primary/g'
```

- [ ] **Step 6: `bg-hover` → `bg-accent`（旧悬停底 → 新 shadcn accent）**

```bash
grep -rln 'bg-hover' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/bg-hover/bg-accent/g'
```

- [ ] **Step 7: `text-muted` → `text-muted-foreground`**

```bash
grep -rln 'text-muted' src --include='*.vue' --include='*.astro' \
  | xargs sed -i 's/\btext-muted\b/text-muted-foreground/g'
```

> 用 `\b` 词边界，避免误伤 `text-muted-foreground`（本就存在时）或 `bg-muted`（保留）。

- [ ] **Step 8: 残留扫描——确认无旧 class 名遗留**

```bash
grep -rn 'bg-surface\|text-text\|bg-hover' src --include='*.vue' --include='*.astro'
grep -rn 'text-accent\|border-accent' src --include='*.vue' --include='*.astro'
```

Expected: 仅 `global.css` 的注释/DESIGN.md 文档可能有残留（文档下阶段统一更新），代码文件零残留。

- [ ] **Step 9: 构建验证**

Run: `pnpm build`
Expected: 构建成功，无 "cannot resolve" 类错误。

- [ ] **Step 10: 浏览器实测（SSR 陷阱强制项）**

Run: `pnpm dev`
打开 `http://localhost:4321/`（首页）和一个工具页（如 `/encoding/base64`）。
Expected:
- 页面底色、文字、品牌橙按钮/链接颜色与重构前**视觉一致**（浅色态）
- 暗色按钮（Header Sun 图标）暂不切换主题（theme store Task 6 才接入），样式不破即可
- 控制台无报错

- [ ] **Step 11: 类型检查**

Run: `pnpm astro check`
Expected: 无新增 error。

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(styles): token 体系对齐 shadcn v4（:root/.dark + @theme inline）+ 全局语义重命名

bg-surface→bg-background, text-text→text-foreground, bg-accent→bg-primary,
text-accent→text-primary, border-accent→border-primary, bg-hover→bg-accent,
text-muted→text-muted-foreground。保留 error/success 别名。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: toast store（TDD）

**Files:**
- Create: `src/stores/toast.ts`
- Test: `src/stores/__tests__/toast.test.ts`

**Interfaces:**
- Produces: `toastStore`（模块级单例）：
  - `items: Ref<ToastItem[]>`
  - `show(message: string, type?: 'success' | 'error', duration?: number): number`
  - `success(message: string): number`
  - `error(message: string): number`
  - `remove(id: number): void`
- 后续阶段 1 消费：Shell 的 ToastContainer 渲染 `items`；工具组件/`useCopy` 调 `toastStore.show()` 替代 `CustomEvent`

- [ ] **Step 1: 写失败测试**

Create `src/stores/__tests__/toast.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toastStore } from '../toast';

describe('toastStore', () => {
  beforeEach(() => {
    toastStore.items.value = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('show 添加一条 toast，默认 type=success', () => {
    toastStore.show('已复制');
    expect(toastStore.items.value).toHaveLength(1);
    expect(toastStore.items.value[0]).toMatchObject({ message: '已复制', type: 'success' });
  });

  it('duration 后自动移除', () => {
    toastStore.show('临时', 'success', 3000);
    expect(toastStore.items.value).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(toastStore.items.value).toHaveLength(0);
  });

  it('success / error 设置正确 type', () => {
    toastStore.success('ok');
    toastStore.error('bad');
    expect(toastStore.items.value[0]!.type).toBe('success');
    expect(toastStore.items.value[1]!.type).toBe('error');
  });

  it('remove 按 id 精确移除', () => {
    const id = toastStore.show('a');
    toastStore.show('b');
    toastStore.remove(id);
    expect(toastStore.items.value).toHaveLength(1);
    expect(toastStore.items.value[0]!.message).toBe('b');
  });

  it('多条 toast 共存（队列）', () => {
    toastStore.success('a');
    toastStore.success('b');
    toastStore.success('c');
    expect(toastStore.items.value).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm test src/stores/__tests__/toast.test.ts`
Expected: FAIL（`Cannot find module '../toast'`）

- [ ] **Step 3: 实现 toast store**

Create `src/stores/toast.ts`:

```ts
import { ref } from 'vue';
import type { Ref } from 'vue';

/** toast 类型 */
export type ToastType = 'success' | 'error';

/** 单条 toast 通知 */
export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

/** 默认显示时长（ms） */
const DEFAULT_DURATION = 3000;

const items = ref<ToastItem[]>([]) as Ref<ToastItem[]>;
/** 自增 id（模块级单例，跨调用累加） */
let counter = 0;

/**
 * 添加一条 toast，到时自动移除。
 * @param message 文案
 * @param type 类型，默认 success
 * @param duration 显示时长 ms，默认 3000
 * @returns 新 toast 的 id（可用于手动 remove）
 */
function show(message: string, type: ToastType = 'success', duration = DEFAULT_DURATION): number {
  const id = ++counter;
  items.value.push({ id, type, message });
  if (duration > 0) setTimeout(() => remove(id), duration);
  return id;
}

/** 添加成功 toast */
function success(message: string): number {
  return show(message, 'success');
}

/** 添加错误 toast */
function error(message: string): number {
  return show(message, 'error');
}

/** 按 id 移除一条 toast */
function remove(id: number): void {
  items.value = items.value.filter((t) => t.id !== id);
}

/** toast 全局单例 store（替代 Alpine `$store.toast`） */
export const toastStore = { items, show, success, error, remove };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm test src/stores/__tests__/toast.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add src/stores/toast.ts src/stores/__tests__/toast.test.ts
git commit -m "feat(store): toast 模块级 store（替代 Alpine toast store）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: favorites store（TDD）

**Files:**
- Create: `src/stores/favorites.ts`
- Test: `src/stores/__tests__/favorites.test.ts`

**Interfaces:**
- Consumes: 浏览器 `localStorage`（SSR 守卫）
- Produces: `favoritesStore`：
  - `list: Ref<FavoriteItem[]>`
  - `load(): void`、`isFavorite(path: string): boolean`、`toggle(item: FavoriteItem): void`、`clearAll(): void`
- `FavoriteItem = { path: string; name: string; icon: string }`

- [ ] **Step 1: 写失败测试（含 localStorage mock）**

Create `src/stores/__tests__/favorites.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { favoritesStore } from '../favorites';

/** 内存 localStorage mock（node 环境无 localStorage） */
function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  return store;
}

describe('favoritesStore', () => {
  beforeEach(() => {
    favoritesStore.list.value = [];
    mockLocalStorage();
  });

  it('toggle 添加/移除收藏', () => {
    const item = { path: '/encoding/base64', name: 'Base64', icon: '🔐' };
    expect(favoritesStore.isFavorite(item.path)).toBe(false);
    favoritesStore.toggle(item);
    expect(favoritesStore.isFavorite(item.path)).toBe(true);
    expect(favoritesStore.list.value).toHaveLength(1);
    favoritesStore.toggle(item);
    expect(favoritesStore.isFavorite(item.path)).toBe(false);
    expect(favoritesStore.list.value).toHaveLength(0);
  });

  it('toggle 持久化到 localStorage', () => {
    favoritesStore.toggle({ path: '/x', name: 'X', icon: '❓' });
    const raw = localStorage.getItem('devtools-favorites');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it('load 从 localStorage 恢复', () => {
    localStorage.setItem(
      'devtools-favorites',
      JSON.stringify([{ path: '/y', name: 'Y', icon: '❓' }]),
    );
    favoritesStore.load();
    expect(favoritesStore.list.value).toHaveLength(1);
    expect(favoritesStore.isFavorite('/y')).toBe(true);
  });

  it('load 容错损坏数据（返回空数组）', () => {
    localStorage.setItem('devtools-favorites', '{不是合法 json');
    favoritesStore.load();
    expect(favoritesStore.list.value).toHaveLength(0);
  });

  it('clearAll 清空并持久化', () => {
    favoritesStore.toggle({ path: '/a', name: 'A', icon: '❓' });
    favoritesStore.toggle({ path: '/b', name: 'B', icon: '❓' });
    favoritesStore.clearAll();
    expect(favoritesStore.list.value).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('devtools-favorites')!)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm test src/stores/__tests__/favorites.test.ts`
Expected: FAIL（`Cannot find module '../favorites'`）

- [ ] **Step 3: 实现 favorites store**

Create `src/stores/favorites.ts`:

```ts
import { ref } from 'vue';
import type { Ref } from 'vue';

/** 一条收藏记录 */
export interface FavoriteItem {
  path: string;
  name: string;
  icon: string;
}

const STORAGE_KEY = 'devtools-favorites';
const list = ref<FavoriteItem[]>([]) as Ref<FavoriteItem[]>;

/** 从 localStorage 加载收藏（客户端调用，SSR 安全） */
function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    list.value = raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    list.value = [];
  }
}

/** 持久化到 localStorage */
function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.value));
  } catch {
    /* 忽略写入失败（隐私模式等） */
  }
}

/** 判断指定路径是否已收藏 */
function isFavorite(path: string): boolean {
  return list.value.some((f) => f.path === path);
}

/**
 * 切换某工具的收藏状态。
 * @param item 工具元数据（path/name/icon）
 */
function toggle(item: FavoriteItem): void {
  if (isFavorite(item.path)) {
    list.value = list.value.filter((f) => f.path !== item.path);
  } else {
    list.value = [...list.value, item];
  }
  save();
}

/** 清空全部收藏 */
function clearAll(): void {
  list.value = [];
  save();
}

/** 收藏全局单例 store（替代 Alpine `$store.favorites`） */
export const favoritesStore = { list, load, save, isFavorite, toggle, clearAll };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm test src/stores/__tests__/favorites.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add src/stores/favorites.ts src/stores/__tests__/favorites.test.ts
git commit -m "feat(store): favorites 模块级 store（localStorage 持久化）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: theme store（TDD）

**Files:**
- Create: `src/stores/theme.ts`
- Test: `src/stores/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: `document.documentElement.classList`、`localStorage`（均 SSR 守卫）
- Produces: `themeStore`：
  - `current: Ref<'light' | 'dark'>`
  - `apply(theme: 'light' | 'dark'): void`、`toggle(): void`、`load(): void`
- 副作用：`apply` 切 `<html>` 的 `dark` class + 持久化

- [ ] **Step 1: 写失败测试（含 document/localStorage mock）**

Create `src/stores/__tests__/theme.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { themeStore } from '../theme';

/** mock document.documentElement.classList + localStorage */
function mockDom() {
  const classSet = new Set<string>();
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (cls: string, force?: boolean) => {
          const on = force ?? !classSet.has(cls);
          if (on) classSet.add(cls);
          else classSet.delete(cls);
          return on;
        },
        contains: (cls: string) => classSet.has(cls),
      },
    },
  });
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  return { classSet, store };
}

describe('themeStore', () => {
  beforeEach(() => {
    themeStore.current.value = 'light';
    mockDom();
  });

  it('apply(dark) 切换 html.dark 并持久化', () => {
    themeStore.apply('dark');
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('devtools-theme')).toBe('dark');
  });

  it('apply(light) 移除 html.dark', () => {
    themeStore.apply('dark');
    themeStore.apply('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('devtools-theme')).toBe('light');
  });

  it('toggle 在 light/dark 间切换', () => {
    expect(themeStore.current.value).toBe('light');
    themeStore.toggle();
    expect(themeStore.current.value).toBe('dark');
    themeStore.toggle();
    expect(themeStore.current.value).toBe('light');
  });

  it('load 恢复已保存的 dark', () => {
    localStorage.setItem('devtools-theme', 'dark');
    themeStore.load();
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('load 忽略非法值', () => {
    localStorage.setItem('devtools-theme', 'purple');
    themeStore.load();
    expect(themeStore.current.value).toBe('light');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm test src/stores/__tests__/theme.test.ts`
Expected: FAIL（`Cannot find module '../theme'`）

- [ ] **Step 3: 实现 theme store**

Create `src/stores/theme.ts`:

```ts
import { ref } from 'vue';
import type { Ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'devtools-theme';
const current = ref<Theme>('light') as Ref<Theme>;

/**
 * 应用主题：更新状态、切换 <html>.dark、持久化。
 * 所有副作用均带 SSR 守卫（document/localStorage 仅客户端存在）。
 * @param theme 目标主题
 */
function apply(theme: Theme): void {
  current.value = theme;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* 忽略写入失败 */
    }
  }
}

/** 在 light/dark 间切换 */
function toggle(): void {
  apply(current.value === 'dark' ? 'light' : 'dark');
}

/** 从 localStorage 恢复主题（客户端启动时调用） */
function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') apply(saved);
  } catch {
    /* 忽略读取失败 */
  }
}

/** 主题全局单例 store（替代 Header 暗色按钮的占位逻辑） */
export const themeStore = { current, apply, toggle, load };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm test src/stores/__tests__/theme.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add src/stores/theme.ts src/stores/__tests__/theme.test.ts
git commit -m "feat(store): theme 模块级 store（dark class 切换 + 持久化）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: sidebar store

**Files:**
- Create: `src/stores/sidebar.ts`
- Test: `src/stores/__tests__/sidebar.test.ts`

**Interfaces:**
- Produces: `sidebarStore`：
  - `isOpen: Ref<boolean>`
  - `open(): void`、`close(): void`、`toggle(): void`
- 后续阶段 1 消费：Shell 的 Header 汉堡按钮 / Sidebar / Overlay 共享此 store，消灭 `$dispatch('sidebar-toggle'/'sidebar-close')`

- [ ] **Step 1: 写失败测试**

Create `src/stores/__tests__/sidebar.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sidebarStore } from '../sidebar';

describe('sidebarStore', () => {
  beforeEach(() => {
    sidebarStore.isOpen.value = false;
  });

  it('open / close / toggle', () => {
    expect(sidebarStore.isOpen.value).toBe(false);
    sidebarStore.open();
    expect(sidebarStore.isOpen.value).toBe(true);
    sidebarStore.close();
    expect(sidebarStore.isOpen.value).toBe(false);
    sidebarStore.toggle();
    expect(sidebarStore.isOpen.value).toBe(true);
    sidebarStore.toggle();
    expect(sidebarStore.isOpen.value).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm test src/stores/__tests__/sidebar.test.ts`
Expected: FAIL（`Cannot find module '../sidebar'`）

- [ ] **Step 3: 实现 sidebar store**

Create `src/stores/sidebar.ts`:

```ts
import { ref } from 'vue';
import type { Ref } from 'vue';

/** 移动端侧栏抽屉开合状态 */
const isOpen = ref(false) as Ref<boolean>;

/** 打开侧栏 */
function open(): void {
  isOpen.value = true;
}

/** 关闭侧栏 */
function close(): void {
  isOpen.value = false;
}

/** 切换侧栏开合 */
function toggle(): void {
  isOpen.value = !isOpen.value;
}

/** 侧栏全局单例 store（替代 Alpine sidebar-toggle/close 事件） */
export const sidebarStore = { isOpen, open, close, toggle };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm test src/stores/__tests__/sidebar.test.ts`
Expected: PASS（1 test）

- [ ] **Step 5: Commit**

```bash
git add src/stores/sidebar.ts src/stores/__tests__/sidebar.test.ts
git commit -m "feat(store): sidebar 模块级 store

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: search store（TDD，filterTools 纯函数）

**Files:**
- Create: `src/stores/search.ts`
- Test: `src/stores/__tests__/search.test.ts`

**Interfaces:**
- Consumes: `ToolMeta`（`src/data/tools.ts`，字段 `id`/`name`/`description`/`keywords`）
- Produces: `searchStore`：
  - `query: Ref<string>`
  - `setQuery(v: string): void`、`clear(): void`
- 纯函数 `filterTools(tools: ToolMeta[], q: string): Set<string> | null`（`null` = query 空，不筛选）

- [ ] **Step 1: 写失败测试**

Create `src/stores/__tests__/search.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { searchStore, filterTools } from '../search';
import type { ToolMeta } from '../../data/tools';

const tools: ToolMeta[] = [
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: '编码与解码 Base64 字符串',
    seoDescription: '',
    category: '编码转换',
    icon: '🔐',
    path: '/encoding/base64',
    keywords: ['base64', '编码'],
    relatedToolIds: [],
  },
  {
    id: 'hash',
    name: '哈希生成器',
    description: 'MD5 SHA 哈希计算',
    seoDescription: '',
    category: '加密哈希',
    icon: '#️⃣',
    path: '/crypto/hash',
    keywords: ['md5', 'sha256'],
    relatedToolIds: [],
  },
];

describe('filterTools', () => {
  it('query 为空返回 null（不筛选）', () => {
    expect(filterTools(tools, '')).toBeNull();
    expect(filterTools(tools, '   ')).toBeNull();
  });

  it('按 name 匹配（大小写无关）', () => {
    const ids = filterTools(tools, 'BASE64');
    expect(ids).not.toBeNull();
    expect(ids!.has('base64')).toBe(true);
    expect(ids!.has('hash')).toBe(false);
  });

  it('按 description 匹配', () => {
    const ids = filterTools(tools, '哈希计算');
    expect(ids!.has('hash')).toBe(true);
  });

  it('按 keywords 匹配', () => {
    const ids = filterTools(tools, 'sha256');
    expect(ids!.has('hash')).toBe(true);
  });

  it('无匹配返回空集合（非 null）', () => {
    const ids = filterTools(tools, '不存在的工具');
    expect(ids).not.toBeNull();
    expect(ids!.size).toBe(0);
  });
});

describe('searchStore', () => {
  beforeEach(() => {
    searchStore.clear();
  });

  it('setQuery / clear', () => {
    expect(searchStore.query.value).toBe('');
    searchStore.setQuery('base64');
    expect(searchStore.query.value).toBe('base64');
    searchStore.clear();
    expect(searchStore.query.value).toBe('');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm test src/stores/__tests__/search.test.ts`
Expected: FAIL（`Cannot find module '../search'`）

- [ ] **Step 3: 实现 search store**

Create `src/stores/search.ts`:

```ts
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { ToolMeta } from '../data/tools';

const query = ref('') as Ref<string>;

/**
 * 按关键词过滤工具列表（纯函数，便于单测）。
 *
 * 在 name / description / keywords 三处做大小写无关子串匹配。
 * @param tools 全量工具
 * @param q 搜索词
 * @returns 匹配工具的 id 集合；q 为空时返回 null 表示不筛选
 */
export function filterTools(tools: ToolMeta[], q: string): Set<string> | null {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  return new Set(
    tools
      .filter((t) => {
        const haystack = [t.name, t.description, ...t.keywords].join(' ').toLowerCase();
        return haystack.includes(needle);
      })
      .map((t) => t.id),
  );
}

/** 设置搜索词 */
function setQuery(v: string): void {
  query.value = v;
}

/** 清空搜索词 */
function clear(): void {
  query.value = '';
}

/** 搜索全局单例 store（替代 index.astro 的 Alpine 搜索状态） */
export const searchStore = { query, filterTools, setQuery, clear };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm test src/stores/__tests__/search.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: 全量测试回归**

Run: `pnpm test`
Expected: 全部 PASS（新增 22 个 store 测试 + 原有 utils 测试不受影响）

- [ ] **Step 6: Commit**

```bash
git add src/stores/search.ts src/stores/__tests__/search.test.ts
git commit -m "feat(store): search 模块级 store（filterTools 纯函数）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 0 完成标准

- [ ] `pnpm build` 成功
- [ ] `pnpm astro check` 无 error
- [ ] `pnpm test` 全过（含 22 个新 store 测试）
- [ ] `pnpm dev` 浏览器实测：首页 + 至少 1 个工具页，浅色态视觉与重构前一致
- [ ] `src/stores/` 下 5 个 store 就绪（未被 UI 消费——阶段 1 接入）
- [ ] `global.css` token 体系为 shadcn v4 模式
- [ ] 全项目无 `bg-surface`/`text-text`/`bg-hover` 等旧 class 残留（文档除外）

> **阶段 1–3 的 plan** 在阶段 0 验证通过后各自编写：阶段 1（壳层迁移，消费 store）、阶段 2（Headless UI → Reka/shadcn-vue）、阶段 3（移除 Alpine/headlessui 依赖 + 文档更新）。
