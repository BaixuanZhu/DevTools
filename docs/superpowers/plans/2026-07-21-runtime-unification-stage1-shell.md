# 运行时统一重构 · 阶段 1：壳层迁移（Shell Migration）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全局壳层交互从 Alpine 迁移到 Vue 模块级 store——建立 `Shell.vue`（Header + Sidebar + Overlay + 暗色切换），抽出 `ToastContainer` / `FavoriteButton` / `SearchPanel` / `FeedbackForm` / `FavoritesList` 五个 Vue 岛，消费阶段 0 已就绪的 5 个 store，最终移除 Alpine 运行时。

**Architecture:** 单一 `Shell.vue` 作为 ToolLayout 唯一 `client:load` 的岛，包裹页面内容 slot（Astro 把 server 渲染的 slot 子节点作为该岛的默认 slot 注入，岛在水合时围绕它们渲染）。所有 Vue 岛通过 ESM `import` 同一个 `src/stores/*.ts` 模块单例 store 共享状态。SimpleLayout（无侧栏页）只替换 Toast 岛、不引入 Shell。Alpine 在中间态与 Vue 共存——每个系统先把**消费者**迁完，最后一个 task 才移除 `Alpine.store` 注册与 `alpinejs` 依赖（否则中间态断裂）。

**Tech Stack:** Astro 6 · Vue 3.5 · Reka UI（阶段 0 已装）· Tailwind CSS v4 · Vitest 4（node 环境 + 组件测试用 happy-dom）· @vue/test-utils（本阶段新增）

**Spec:** `docs/superpowers/specs/2026-07-21-runtime-unification-design.md`（§6 壳层迁移映射、§12 主题切换边界）

**分支：** `refactor/runtime-unification`（阶段 0 完成于 `ae1e834`，本计划从 `ae1e834` 继续）

---

## Global Constraints

（每个任务的隐含前提，源自 spec、阶段 0 成果与项目约定）

- **不引入路径别名**：无 `@/`，所有 import 用相对路径（spec §8 决策，阶段 0 已遵循）
- **store 模式**：模块级 `ref` 单例，**不引入 Pinia**；store 公共方法写 JSDoc（阶段 0 已建好 5 个 store，本阶段只消费、不改签名）
- **SSR/水合陷阱（最高优先级风险）**：涉及 UI 变更必须 `pnpm dev` 浏览器实测——build/类型/单测全过 ≠ 运行时正确（记忆 `astro-ssg-tolerates-vue-ssr-errors`）。警惕：模板字符串里 `${}` 被 Astro 插值、`watch` 标志须 `nextTick` 重置、store 读 `localStorage` 必须在 `onMounted` 或客户端守卫内
- **Tailwind v4**：优先标准类名，禁止用任意值语法表达可用标准类名的值；设计令牌值（如 `text-[0.8125rem]`）保留任意值（CLAUDE.md Styling Conventions）
- **注释**：新增公共组件/函数必须写文档注释（CLAUDE.md 注释规则）
- **安全**：禁止 `eval()`/`Function()`；正则用 `new RegExp` + try-catch
- **测试位置**：组件测试 `src/components/shell/__tests__/{name}.test.ts`，文件首行 `// @vitest-environment happy-dom` pragma（不改全局 `vitest.config.ts` 的 `environment: 'node'`）
- **每个 task 必须浏览器实测**：结束前 `pnpm dev` 打开对应页面，确认无空白/无水合错误/交互正常，再 commit
- **环境**：Node >=22.12，pnpm；已知 flaky 测试 SM4-CBC「密码错误应抛错」概率性失败，非回归（记忆 `sm4-cbc-flaky-test`），单独重跑即可

## 关键架构决策（implementer 必读）

1. **Shell.vue 包裹 slot**：ToolLayout.astro 改为 `<Layout><Shell client:load :categories :tools-by-category :current-path> <内容列 slot> </Shell></Layout>`。Astro 支持 `client:*` 岛接收 server 渲染的 slot 子节点（作为岛的默认 slot / light DOM），岛水合时围绕它们渲染，子节点无需响应式。这是 spec §4「唯一 client:load 岛」的落地。**最大水合风险点**，由 Task 2 的 `pnpm dev` 最早拦截。
2. **toast 事件桥接 shim 本阶段保留**：`useCopy.ts`（14 处调用方的中心路径）直连 `toastStore.show()`；但 13 个工具 `.vue` 各自的本地 `showToast`/`dispatchToast` 助手（仍发 `CustomEvent('toast')`）本阶段**不动**——`ToastContainer.vue` 在 `onMounted` 注册一个 `document.addEventListener('toast', ...)` 兼容 shim 转发到 `toastStore`。工具本地迁移 + shim 移除推迟到**阶段 3**。验收 grep（§13）不含 `CustomEvent('toast')`，故合规。
3. **首页搜索网格留 `.astro`**：网格 `{tools.map(...)}` 由 Astro SSR（保 SEO + `ToolCard.astro` 单源），`SearchPanel.vue` 岛只负责搜索框 + 防抖过滤（按 `[data-id]` 切 DOM `display`）+ 空态。`spec §6.2` 的「SearchPanel.vue + searchStore」按此落地。
4. **favorites toggle 签名**：store 是对象参数 `toggle({path,name,icon})`（阶段 0 已定），组件调用后自行 `toastStore.show()`（store 保持纯函数、不带 toast 副作用，阶段 0 测试不需改）。
5. **FOUC 防闪**：`Layout.astro` 的 `<head>` 加一段 `is:inline` 脚本，在首帧前读 `localStorage('devtools-theme')` 给 `<html>` 加 `.dark`（全局所有页面，Task 2）。`themeStore.load()` 在 `Shell.vue` 的 `onMounted` 再同步 store 状态。
6. **SimpleLayout 不引入 Shell**：它无侧栏、Header 是纯链接无 Alpine；本阶段只把 `Toast.astro` 换成 `ToastContainer.vue`（Task 3）。暗色模式经全局 FOUC 脚本 + CSS 生效，无切换按钮（超出本次范围）。
7. **新组件目录**：本阶段所有新 Vue 壳层岛放 `src/components/shell/`（与工具内部组件 `src/components/ui/` 区分）。

## File Structure

| 文件 | 职责 | 任务 |
|---|---|---|
| `package.json` | 新增 devDep `happy-dom`、`@vue/test-utils` | Task 1 |
| `src/components/shell/Shell.vue` | ToolLayout 唯一 client:load 岛：Header + Sidebar + Overlay + 暗色按钮，包裹 slot | Task 2 |
| `src/layouts/Layout.astro` | `<head>` 加 FOUC 暗色脚本 | Task 2 |
| `src/layouts/ToolLayout.astro` | 移除 Header/Sidebar/Overlay 的 Alpine 标记，改用 `<Shell>` 包裹 slot；移除内联 `<style>` 侧栏 CSS（移入 Shell） | Task 2 / 3 |
| `src/components/shell/ToastContainer.vue` | 消费 `toastStore.items`，`TransitionGroup`；挂 toast 事件 shim | Task 3 |
| `src/composables/useCopy.ts` | 复制失败 `dispatchEvent` → `toastStore.show()` | Task 3 |
| `src/components/shell/FeedbackForm.vue` | 反馈表单，用 `toastStore` | Task 3 |
| `src/pages/feedback.astro` | 移除 Alpine，挂 `<FeedbackForm>` | Task 3 |
| `src/layouts/{ToolLayout,SimpleLayout}.astro` | `<Toast>` → `<ToastContainer client:load>` | Task 3 |
| `src/components/layout/Toast.astro` | 删除 | Task 3 |
| `src/layouts/Layout.astro` | 移除 Alpine toast 事件桥接（保留 `Alpine.store` 注册到 Task 6） | Task 3 |
| `src/components/shell/FavoriteButton.vue` | 收藏星标按钮，消费 `favoritesStore` + `toastStore` | Task 4 |
| `src/components/layout/ToolCard.astro` | Alpine 收藏按钮 → `<FavoriteButton client:visible>` | Task 4 |
| `src/components/shell/FavoritesList.vue` | 收藏页列表，消费 `favoritesStore` | Task 4 |
| `src/pages/favorites.astro` | 移除 Alpine + tools-data 脚本，挂 `<FavoritesList>` | Task 4 |
| `src/components/shell/SearchPanel.vue` | 首页搜索框 + 防抖过滤 + 空态，消费 `searchStore`/`filterTools` | Task 5 |
| `src/pages/index.astro` | 移除 Alpine 搜索 + tools-data 脚本，挂 `<SearchPanel>`；网格加 `data-search-grid` | Task 5 |
| `src/data/tools.ts` | 删除死代码 `searchTools()`（620-627 行） | Task 5 |
| `src/layouts/Layout.astro` | 移除整段 Alpine `<script>`（import/store 注册/start） | Task 6 |
| `package.json` | 移除 `alpinejs` 依赖 | Task 6 |
| `src/styles/global.css`（或所在文件） | 移除 `[x-cloak]` 规则 | Task 6 |

---

## Task 1: 搭建 Vue 组件测试基建（happy-dom + @vue/test-utils）

**Files:**
- Modify: `package.json`（新增 devDep）
- Create then delete: `src/components/shell/__tests__/harness-smoke.test.ts`（临时冒烟）

**Interfaces:**
- Produces: `happy-dom` + `@vue/test-utils` 可用；后续组件任务可用 `mount()` + `// @vitest-environment happy-dom` pragma 写组件测试，且**不影响**全局 `environment: 'node'` 的 1065 个现有测试

**Why this task is first:** Tasks 2-5 都要写组件测试。先验证 happy-dom + @vue/test-utils 在本项目 vitest 4 + Vue 3.5 下能 mount 组件，是 go/no-go 节点。

- [ ] **Step 1: 安装 devDep**

```bash
pnpm add -D happy-dom @vue/test-utils
```

- [ ] **Step 2: 写临时冒烟测试**

Create `src/components/shell/__tests__/harness-smoke.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';

describe('组件测试基建冒烟', () => {
  it('能用 @vue/test-utils + happy-dom mount 一个组件并断言 DOM', () => {
    const Hello = defineComponent({
      props: { name: { type: String, required: true } },
      setup: (p) => () => h('div', { class: 'greeting' }, `hi ${p.name}`),
    });
    const wrapper = mount(Hello, { props: { name: 'shell' } });
    expect(wrapper.classes()).toContain('greeting');
    expect(wrapper.text()).toBe('hi shell');
  });
});
```

- [ ] **Step 3: 跑冒烟测试**

Run: `pnpm test src/components/shell/__tests__/harness-smoke.test.ts`
Expected: PASS（1 test）

- [ ] **Step 4: 回归确认全局 node 环境测试不受影响**

Run: `pnpm test`
Expected: 全部通过（阶段 0 的 1065 测试 + 1 冒烟 = 1066）。SM4-CBC 若概率性失败单独重跑。

- [ ] **Step 5: 删除临时冒烟测试**

```bash
rm src/components/shell/__tests__/harness-smoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(test): 新增 happy-dom + @vue/test-utils 组件测试基建"
```

---

## Task 2: Shell.vue（sidebar + theme 系统）

**Files:**
- Create: `src/components/shell/Shell.vue`
- Create: `src/components/shell/__tests__/Shell.test.ts`
- Modify: `src/layouts/Layout.astro`（`<head>` 内 `<title>` 前加 FOUC 暗色脚本）
- Modify: `src/layouts/ToolLayout.astro`（删除 Header/Sidebar/Overlay 的 Alpine 标记与内联 `<style>`；改用 `<Shell>` 包裹内容列 slot，传 props）

**Interfaces:**
- Consumes（阶段 0 已就绪，签名不可改）:
  - `sidebarStore` from `../../stores/sidebar` — `{ isOpen: Ref<boolean>, open(), close(), toggle() }`
  - `themeStore` from `../../stores/theme` — `{ current: Ref<'light'|'dark'>, apply(theme), toggle(), load() }`
  - `favoritesStore` from `../../stores/favorites` — `{ load(), ... }`（本任务只调 `load()` 预热）
- Consumes（data 层）: `getCategories`/`getToolsByCategory` 的产物，由 ToolLayout 通过 props 注入
- Produces: `Shell.vue` 接收 props `{ categories: string[]; toolsByCategory: Record<string, ToolMeta[]>; currentPath: string }`，渲染 Header/Sidebar/Overlay + 默认 slot；`onMounted` 内 `themeStore.load()` + `favoritesStore.load()`

**Why this task is here:** sidebar 与 theme 同属「ToolLayout 顶部 chrome」，且都依赖在 `onMounted` 初始化 store。Shell 是整阶段最大水合风险（包裹 slot），必须最先做并在浏览器实测拦截。

- [ ] **Step 1: 写失败测试**

Create `src/components/shell/__tests__/Shell.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Shell from '../Shell.vue';
import { sidebarStore } from '../../../stores/sidebar';
import { themeStore } from '../../../stores/theme';

const categories = ['文本处理'];
const toolsByCategory = {
  '文本处理': [
    { id: 'uuid-generator', name: 'UUID 生成器', icon: '🔑', path: '/text/uuid-generator' },
  ],
};

describe('Shell.vue', () => {
  beforeEach(() => {
    sidebarStore.isOpen.value = false;
    themeStore.current.value = 'light';
    document.documentElement.classList.remove('dark');
  });

  it('渲染 logo、汉堡按钮、暗色按钮（默认 light 态）', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
      slots: { default: '<div class="content">页面内容</div>' },
    });
    expect(wrapper.find('header').exists()).toBe(true);
    expect(wrapper.find('[aria-label="打开导航菜单"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="切换到暗色模式"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('页面内容');
  });

  it('点击汉堡按钮 → sidebarStore.isOpen 变 true，aside 获得 sidebar-open', async () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    expect(sidebarStore.isOpen.value).toBe(false);
    await wrapper.find('[aria-label="打开导航菜单"]').trigger('click');
    expect(sidebarStore.isOpen.value).toBe(true);
    expect(wrapper.find('aside').classes()).toContain('sidebar-open');
  });

  it('点击暗色按钮 → themeStore.current 变 dark，<html> 加 .dark', async () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/' },
    });
    await wrapper.find('[aria-label="切换到暗色模式"]').trigger('click');
    expect(themeStore.current.value).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('侧栏渲染传入的分类与工具链接', () => {
    const wrapper = mount(Shell, {
      props: { categories, toolsByCategory, currentPath: '/text/uuid-generator' },
    });
    expect(wrapper.find('aside').text()).toContain('文本处理');
    expect(wrapper.find('aside').text()).toContain('UUID 生成器');
    // 当前路径高亮
    const activeLink = wrapper.find('aside a[href="/text/uuid-generator"]');
    expect(activeLink.classes()).toContain('bg-accent');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/shell/__tests__/Shell.test.ts`
Expected: FAIL（`Cannot find module '../Shell.vue'`）

- [ ] **Step 3: 实现 Shell.vue**

Create `src/components/shell/Shell.vue`:

```vue
<script setup lang="ts">
/**
 * 全局应用壳层（ToolLayout 唯一 client:load 岛）。
 *
 * 渲染 Header（汉堡 + Logo + 收藏入口 + 暗色按钮 + 仓库链接）、
 * Sidebar（桌面常驻 / 移动抽屉）、移动 Overlay，并通过默认 slot
 * 承载页面内容列（由 Astro server 渲染注入）。
 *
 * 响应式状态来自模块级单例 store（sidebarStore / themeStore），
 * onMounted 预热 favorites/theme 的 localStorage 读取。
 */
import { onMounted, onUnmounted } from 'vue';
import { Wrench, Sun, Moon } from '@lucide/vue';
import { siGithub, siGitee } from 'simple-icons';
import type { ToolMeta } from '../../data/tools';
import { sidebarStore } from '../../stores/sidebar';
import { themeStore } from '../../stores/theme';
import { favoritesStore } from '../../stores/favorites';

interface Props {
  /** 分类列表（顺序保持注册顺序） */
  categories: string[];
  /** 分类 → 工具列表映射 */
  toolsByCategory: Record<string, Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon'>[]>;
  /** 当前路径（用于侧栏高亮），格式如 /text/uuid-generator */
  currentPath: string;
}
const props = defineProps<Props>();

const { isOpen } = sidebarStore;
const { current } = themeStore;

/** ESC 关闭侧栏（移动端） */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') sidebarStore.close();
}
onMounted(() => {
  themeStore.load();
  favoritesStore.load();
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function toggleTheme(): void {
  themeStore.toggle();
}
</script>

<template>
  <div id="app" class="h-dvh flex flex-col overflow-hidden">
    <!-- Header（通栏，横跨全宽） -->
    <header class="flex items-center justify-between px-6 py-2 border-b border-border bg-card h-[57px] shrink-0">
      <!-- 左侧：汉堡按钮（mobile-only） + Logo -->
      <div class="flex items-center gap-4">
        <button
          class="hidden max-lg:flex flex-col gap-1 p-2 border-none bg-transparent cursor-pointer focus:outline-none"
          aria-label="打开导航菜单"
          :aria-expanded="isOpen"
          @click="sidebarStore.toggle()"
        >
          <span class="block w-[18px] h-[2px] bg-foreground rounded-[1px]" aria-hidden="true"></span>
          <span class="block w-[18px] h-[2px] bg-foreground rounded-[1px]" aria-hidden="true"></span>
          <span class="block w-[18px] h-[2px] bg-foreground rounded-[1px]" aria-hidden="true"></span>
        </button>
        <a
          href="/"
          class="group flex items-center gap-1.5 text-lg font-semibold text-foreground hover:text-primary transition-[color] duration-150"
          aria-label="DevTools 首页"
        >
          <Wrench class="w-6 h-6 text-violet-600 group-hover:text-primary group-hover:-rotate-12 transition-[transform,color] duration-300 ease-out" />
          <span>DevTools</span>
        </a>
      </div>

      <!-- 右侧：工具按钮区 + 仓库入口 -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1">
          <!-- 收藏夹入口 -->
          <a
            href="/favorites"
            class="flex items-center gap-1.5 h-9 px-2 max-md:px-1.5 rounded-sm text-muted-foreground hover:text-primary hover:bg-accent transition-[color,background-color] duration-150 focus:outline-none"
            aria-label="我的收藏"
          >
            <span class="text-[1.125rem] leading-none">⭐</span>
            <span class="text-[0.8125rem] font-medium max-md:hidden">我的收藏</span>
          </a>

          <!-- 暗色模式按钮 -->
          <button
            class="flex items-center justify-center w-9 h-9 rounded-sm text-muted-foreground hover:text-primary hover:bg-accent transition-[color,background-color] duration-150 cursor-pointer border-none bg-transparent focus:outline-none"
            :aria-label="current === 'dark' ? '切换到亮色模式' : '切换到暗色模式'"
            @click="toggleTheme"
          >
            <Moon v-if="current === 'dark'" class="w-5 h-5" />
            <Sun v-else class="w-5 h-5" />
          </button>
        </div>

        <!-- 仓库入口 -->
        <div class="flex items-center gap-2 text-foreground">
          <a
            href="https://gitee.com/baixuanz"
            target="_blank"
            rel="noopener noreferrer"
            class="focus:outline-none"
            aria-label="Gitee 仓库"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" role="img" aria-hidden="true" :fill="`#${siGitee.hex}`">
              <path :d="siGitee.path" />
            </svg>
          </a>
          <a
            href="https://github.com/BaixuanZhu/DevTools"
            target="_blank"
            rel="noopener noreferrer"
            class="focus:outline-none"
            aria-label="GitHub 仓库"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" role="img" aria-hidden="true" fill="currentColor">
              <path :d="siGithub.path" />
            </svg>
          </a>
        </div>
      </div>
    </header>

    <!-- 主体行：aside + 内容列 -->
    <div class="flex-1 flex min-h-0">
      <!-- Sidebar（桌面静态；移动端抽屉，定位见 <style>） -->
      <aside
        :class="['sidebar', 'w-60', 'shrink-0', 'border-r', 'border-border', 'bg-card', 'flex', 'flex-col', isOpen && 'sidebar-open']"
        role="navigation"
        aria-label="工具导航"
      >
        <div class="flex-1 sidebar-nav-scroll overflow-y-auto py-2">
          <div v-for="category in props.categories" :key="category">
            <h3 class="text-xs font-semibold text-muted-foreground px-4 py-4 pb-1 uppercase tracking-wider">{{ category }}</h3>
            <ul class="list-none m-0 p-0">
              <li v-for="tool in props.toolsByCategory[category]" :key="tool.id">
                <a
                  :href="tool.path"
                  :class="[
                    'flex items-center gap-2 px-4 py-2 text-sm text-foreground transition-[background-color] duration-150 hover:bg-accent focus:outline-none',
                    props.currentPath === tool.path && 'bg-accent text-primary font-medium',
                  ]"
                >
                  <span class="text-base w-6 text-center shrink-0">{{ tool.icon }}</span>
                  <span>{{ tool.name }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <!-- Mobile overlay -->
      <div
        v-if="isOpen"
        class="sidebar-overlay fixed inset-0 bg-black/30 z-[99]"
        @click="sidebarStore.close()"
      ></div>

      <!-- 内容列（Astro server 渲染注入：main + footer 等） -->
      <slot />
    </div>
  </div>
</template>

<style>
  /* 移动端侧栏：从 header 下方滑出，header 常驻可见 */
  @media (max-width: 1023px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 57px;
      z-index: 100;
      height: calc(100dvh - 57px);
      transform: translateX(-100%);
      transition: transform 250ms ease;
    }
    .sidebar.sidebar-open {
      transform: translateX(0);
    }
    .sidebar-overlay {
      top: 57px;
    }
  }
  /* 桌面端不显示 overlay（aside 静态常驻） */
  @media (min-width: 1024px) {
    .sidebar-overlay {
      display: none;
    }
  }
</style>
```

> 说明：收藏入口原用 `@lucide/astro` 的 `<Star>`，这里改用 emoji ⭐ 避免 Header 引入额外图标依赖（与设计身份一致，ToolCard 收藏星标仍在 Task 4 用 lucide）。若 review 要求保持 Star 图标，可 `import { Star } from '@lucide/vue'` 替换——二选一即可，不影响行为。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/shell/__tests__/Shell.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: 给 Layout.astro 加 FOUC 暗色脚本**

Modify `src/layouts/Layout.astro`，在 `<head>` 内 `<title>{title}</title>`（第 56 行）**之前**插入：

```astro
    <!-- 首帧前同步设置暗色 class，避免 FOUC（localStorage 读取须容错） -->
    <script is:inline>
      (function () {
        try {
          if (localStorage.getItem('devtools-theme') === 'dark') {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 6: 改造 ToolLayout.astro——移除 Header/Sidebar/Overlay 标记，用 Shell 包裹 slot**

Modify `src/layouts/ToolLayout.astro`:

6a. 删除 Header（155-237 行整段 `<header>...</header>`）、Sidebar `<aside>`（242-276 行）、Mobile overlay（279-288 行）、末尾 `<Toast />`（326 行）暂留（Task 3 再换）。同时删除 `<div id="app">`、`<div class="flex-1 flex min-h-0">` 这两层包裹（移入 Shell），保留内容列 `<div class="flex-1 flex flex-col overflow-x-hidden overflow-y-auto min-w-0">`（含 `<main>`、breadcrumb、slot、faqs、related、`<Footer />`）作为 Shell 的 slot 内容。

6b. 删除文件末尾整个 `<style>...</style>` 块（329-354 行，已移入 Shell.vue）。

6c. 删除 `import Toast from '../components/layout/Toast.astro';`（第 6 行）暂留到 Task 3——本步先保留 Toast import 与 `<Toast />`，仅把 Header/Sidebar/Overlay 换成 Shell。

6d. 把 `<Layout ...>` 内部改为（替换原 153-327 行的整段 `<div id="app">...</div>` 与 `<style>`）：

```astro
<Layout title={finalTitle} description={finalDescription} jsonLd={allJsonLd} keywords={keywords}>
  <Shell
    client:load
    categories={categories}
    toolsByCategory={toolsByCategory}
    currentPath={currentPath}
  >
    <!-- 内容列（Shell 的默认 slot）：server 渲染注入 -->
    <div class="flex-1 flex flex-col overflow-x-hidden overflow-y-auto min-w-0">
      <main class="flex-1 p-8 max-w-full max-md:p-4">
        {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
        <slot />
        {faqs.length > 0 && (
          <section class="mt-12 pt-8 border-t border-border">
            <h2 class="text-lg font-semibold text-foreground mb-4">常见问题</h2>
            <div class="space-y-0 divide-y divide-border">
              {faqs.map((faq) => (
                <details class="group py-4" open>
                  <summary class="flex items-center justify-between cursor-pointer text-[0.8125rem] text-foreground hover:text-primary transition-[color] duration-150 list-none">
                    <span class="[&_code]:bg-accent [&_code]:text-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_strong]:text-foreground [&_strong]:font-semibold" set:html={faq.question} />
                    <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
                  </summary>
                  <div class="pt-2 text-[0.8125rem] text-muted-foreground leading-relaxed [&_code]:bg-accent [&_code]:text-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_strong]:text-foreground [&_strong]:font-semibold" set:html={faq.answer} />
                </details>
              ))}
            </div>
          </section>
        )}
        {relatedToolIds.length > 0 && (
          <section class="mt-12 pt-8 border-t border-border">
            <h2 class="text-lg font-semibold text-foreground mb-4">相关工具</h2>
            <RelatedTools toolIds={relatedToolIds} />
          </section>
        )}
      </main>

      <Footer />
    </div>
  </Shell>

  <!-- Alpine Toast（Task 3 替换为 <ToastContainer client:load />） -->
  <Toast />
</Layout>
```

6e. 在 frontmatter（第 1-10 行 import 区）新增 Shell import：

```astro
import Shell from '../components/shell/Shell.vue';
```

> 注意：`ToolLayout` 顶部仍保留 `import { Star, Sun, Wrench, ChevronDown } from '@lucide/astro';`——其中 `ChevronDown` 仍被 FAQ 用到，`Star/Sun/Wrench` 在移除 Header 后不再被 ToolLayout 使用，应一并从该 import 中删掉（只留 `ChevronDown`），避免 unused 警告。

- [ ] **Step 7: 类型检查**

Run: `pnpm astro check`
Expected: 0 error。（Shell props 类型与 ToolLayout 传值匹配；`toolsByCategory` 由 `getToolsByCategory()` 返回 `Record<ToolCategory, ToolMeta[]>`，Shell props 声明 `Record<string, Pick<ToolMeta,'id'|'path'|'name'|'icon'>[]>` 是其超集，兼容。）

- [ ] **Step 8: 浏览器实测（关键水合拦截）**

Run: `pnpm dev`，打开：
- `/text/uuid-generator`（任一工具页）：确认页面内容正常渲染（**非空白**）、无控制台水合错误；侧栏链接可见且当前项高亮；点击右上角太阳按钮 → 整页切暗色（背景变深）；再点月亮按钮 → 切回亮色；刷新后暗色保持（localStorage 持久化 + FOUC 不闪）。
- 缩窗到移动端宽度（<1024px）：汉堡按钮出现，点击 → 侧栏从左滑入 + 半透明 overlay 出现；点 overlay 或按 ESC → 侧栏关闭。

Expected: 全部正常。**若页面空白或报 hydration mismatch，立即停下排查 slot 包裹问题**（见记忆 `astro-ssg-tolerates-vue-ssr-errors`），不要继续。

- [ ] **Step 9: Commit**

```bash
git add src/components/shell/Shell.vue src/components/shell/__tests__/Shell.test.ts src/layouts/Layout.astro src/layouts/ToolLayout.astro
git commit -m "feat(shell): Shell.vue 替代 ToolLayout 侧栏/暗色 Alpine（消费 sidebarStore/themeStore）"
```

---

## Task 3: Toast 系统（ToastContainer + useCopy + FeedbackForm）

**Files:**
- Create: `src/components/shell/ToastContainer.vue`
- Create: `src/components/shell/__tests__/ToastContainer.test.ts`
- Create: `src/components/shell/FeedbackForm.vue`
- Create: `src/components/shell/__tests__/FeedbackForm.test.ts`
- Modify: `src/composables/useCopy.ts`（失败路径直连 toastStore）
- Modify: `src/pages/feedback.astro`（移除 Alpine，挂 FeedbackForm）
- Modify: `src/layouts/ToolLayout.astro`（`<Toast />` → `<ToastContainer client:load />`，删 Toast import）
- Modify: `src/layouts/SimpleLayout.astro`（同上）
- Modify: `src/layouts/Layout.astro`（移除 Alpine toast 事件桥接；保留 `Alpine.store` 注册 + `Alpine.start` 到 Task 6）
- Delete: `src/components/layout/Toast.astro`

**Interfaces:**
- Consumes: `toastStore` from `../../stores/toast` — `{ items: Ref<ToastItem[]>, show(message, type?, duration?), success(message), error(message), remove(id) }`，`ToastItem = { id, type: 'success'|'error', message }`
- Produces: `ToastContainer.vue`（无 props，全局单岛）；`FeedbackForm.vue`（无 props）；`useCopy` 失败路径不再发 DOM 事件，改调 `toastStore.show(msg,'error')`

**Atomicity note:** 本 task 同时完成「Toast UI 替换 + 事件桥接切换」——`Toast.astro`（Alpine 渲染器）与 `ToastContainer.vue`（Vue 渲染器）不能并存（否则双 toast）。一次切完。

- [ ] **Step 1: 写 ToastContainer 失败测试**

Create `src/components/shell/__tests__/ToastContainer.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ToastContainer from '../ToastContainer.vue';
import { toastStore } from '../../../stores/toast';

describe('ToastContainer.vue', () => {
  beforeEach(() => {
    // 清空队列（remove 所有）
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  it('渲染 toastStore.items 中的通知', async () => {
    toastStore.show('保存成功', 'success');
    const wrapper = mount(ToastContainer);
    await nextTick();
    expect(wrapper.text()).toContain('保存成功');
  });

  it('兼容 shim：document CustomEvent("toast") → toastStore.show()', async () => {
    const wrapper = mount(ToastContainer);
    await nextTick();
    document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: ' shim 兼容' } }));
    await nextTick();
    expect(wrapper.text()).toContain('shim 兼容');
    expect(toastStore.items.value.some((t) => t.type === 'error')).toBe(true);
    wrapper.unmount();
  });

  it('卸载后移除 shim 监听', async () => {
    const wrapper = mount(ToastContainer);
    await nextTick();
    wrapper.unmount();
    const before = toastStore.items.value.length;
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '卸载后不应出现' } }));
    expect(toastStore.items.value.length).toBe(before);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/shell/__tests__/ToastContainer.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 ToastContainer.vue**

Create `src/components/shell/ToastContainer.vue`:

```vue
<script setup lang="ts">
/**
 * Toast 通知容器（全局单岛，client:load）。
 *
 * 渲染 toastStore.items 队列，成功/失败用 lucide 图标 + TransitionGroup 动画。
 * 兼容 shim：阶段 1 过渡期，把遗留 `document` CustomEvent('toast')
 * 转发到 toastStore，使未迁移的工具本地 showToast 助手继续工作。
 * 阶段 3 迁移完所有工具后移除该 shim。
 */
import { onMounted, onUnmounted } from 'vue';
import { CircleCheck, CircleX } from '@lucide/vue';
import { toastStore, type ToastType } from '../../stores/toast';

const { items } = toastStore;

/** 遗留 toast 事件 → toastStore 桥接（阶段 3 移除） */
function legacyBridge(e: Event): void {
  const detail = (e as CustomEvent).detail || {};
  if (detail.message) {
    toastStore.show(String(detail.message), (detail.type as ToastType) || 'success');
  }
}
onMounted(() => document.addEventListener('toast', legacyBridge as EventListener));
onUnmounted(() => document.removeEventListener('toast', legacyBridge as EventListener));
</script>

<template>
  <div
    class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-3 max-w-[90vw]"
    role="region"
    aria-label="通知"
  >
    <TransitionGroup
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95"
    >
      <div
        v-for="t in items"
        :key="t.id"
        :class="t.type === 'success' ? 'border-border' : 'border-error/20'"
        class="flex items-center gap-3 px-5 py-3.5 rounded-lg border shadow-lg bg-card text-foreground text-sm font-sans min-w-48 max-w-sm"
        role="status"
        aria-live="polite"
      >
        <CircleCheck v-if="t.type === 'success'" class="w-5 h-5 shrink-0 text-success" />
        <CircleX v-else class="w-5 h-5 shrink-0 text-error" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
```

- [ ] **Step 4: 跑 ToastContainer 测试确认通过**

Run: `pnpm test src/components/shell/__tests__/ToastContainer.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: 改 useCopy.ts 失败路径直连 toastStore**

Modify `src/composables/useCopy.ts`:

5a. 第 1-2 行 import 区改为：

```ts
import { ref, type Ref } from 'vue';
import { copyToClipboard } from '../utils/shared/clipboard';
import { toastStore } from '../stores/toast';
```

5b. 把 `copy()` 内失败分支（原第 40 行）：

```ts
      document.dispatchEvent(new CustomEvent('toast', { detail: { message: errorMessage } }));
```

改为：

```ts
      toastStore.show(errorMessage, 'error');
```

- [ ] **Step 6: 同步更新 useCopy 现有测试（失败路径不再 dispatchEvent）**

现有 `src/composables/__tests__/useCopy.test.ts` 的两个失败用例（41-67 行）断言了 `document.dispatchEvent('toast')`，改为断言 `toastStore.items`。

6a. import 区（第 3 行后）新增：

```ts
import { toastStore } from '../../stores/toast';
```

6b. `beforeEach`（6-16 行）移除 `vi.stubGlobal('document', …)` 整段（不再需要），并加 toast 队列重置：

```ts
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
      },
    });
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });
```

6c. 把「复制失败时 copied 保持 false 并 dispatch toast」用例（41-53 行）替换为：

```ts
  it('复制失败时 copied 保持 false 并 toast error', async () => {
    (navigator.clipboard.writeText as Mock).mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy();
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(
      toastStore.items.value.some((t) => t.type === 'error' && t.message === '复制失败，请重试'),
    ).toBe(true);
  });
```

6d. 把「支持自定义失败文案」用例（55-67 行）替换为：

```ts
  it('支持自定义失败文案', async () => {
    (navigator.clipboard.writeText as Mock).mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy({ errorMessage: '自定义失败' });
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(
      toastStore.items.value.some((t) => t.type === 'error' && t.message === '自定义失败'),
    ).toBe(true);
  });
```

6e. 跑测试确认通过：

Run: `pnpm test src/composables/__tests__/useCopy.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 7: 写 FeedbackForm 失败测试**

Create `src/components/shell/__tests__/FeedbackForm.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FeedbackForm from '../FeedbackForm.vue';
import { toastStore } from '../../../stores/toast';

describe('FeedbackForm.vue', () => {
  beforeEach(() => {
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  it('内容为空提交 → toastStore 出现 error「请填写反馈内容」', async () => {
    const wrapper = mount(FeedbackForm);
    await wrapper.find('button[type="submit"]').trigger('click');
    await nextTick();
    expect(toastStore.items.value.some((t) => t.type === 'error' && t.message.includes('请填写反馈内容'))).toBe(true);
  });

  it('填入内容提交 → 不报错 toast，且尝试跳转 mailto', async () => {
    const hrefSetter = vi.spyOn(window.location, 'href', 'set');
    const wrapper = mount(FeedbackForm);
    await wrapper.find('textarea').setValue('这个工具很好用');
    await wrapper.find('button[type="submit"]').trigger('click');
    await nextTick();
    expect(toastStore.items.value.some((t) => t.type === 'error')).toBe(false);
    expect(hrefSetter).toHaveBeenCalled();
    expect(hrefSetter.mock.calls[0][0]).toContain('mailto:');
    hrefSetter.mockRestore();
  });
});
```

- [ ] **Step 8: 跑测试确认失败**

Run: `pnpm test src/components/shell/__tests__/FeedbackForm.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 9: 实现 FeedbackForm.vue**

Create `src/components/shell/FeedbackForm.vue`:

```vue
<script setup lang="ts">
/**
 * 反馈建议表单。
 *
 * 用户填写类型/内容/联系方式后，拼装 mailto: 链接打开邮件客户端。
 * 内容为空时以 error toast 提示，成功时以 success toast 反馈。
 */
import { ref } from 'vue';
import { toastStore } from '../../stores/toast';

const FEEDBACK_MAILTO = 'wy2359117018@163.com';

const type = ref('功能建议');
const content = ref('');
const contact = ref('');

/** 提交：校验内容 → 拼 mailto → 打开邮件客户端 + toast 反馈 */
function submit(): void {
  if (!content.value.trim()) {
    toastStore.show('请填写反馈内容', 'error');
    return;
  }
  const subject = encodeURIComponent('[DevTools 反馈] ' + type.value);
  const body = encodeURIComponent(
    '反馈类型：' + type.value + '\n\n' +
    '反馈内容：\n' + content.value +
    (contact.value.trim() ? '\n\n联系方式：' + contact.value.trim() : ''),
  );
  window.location.href = `mailto:${FEEDBACK_MAILTO}?subject=${subject}&body=${body}`;
  toastStore.show('已打开邮件客户端，感谢你的反馈！');
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div>
      <label for="feedback-type" class="block text-sm font-medium text-foreground mb-1.5">反馈类型</label>
      <select
        id="feedback-type"
        v-model="type"
        class="w-full px-3 py-2.5 border border-border rounded-sm bg-card text-foreground text-base font-sans transition-[border-color] duration-150 focus:border-primary focus:outline-none appearance-none cursor-pointer"
      >
        <option>功能建议</option>
        <option>Bug 报告</option>
        <option>体验问题</option>
        <option>其他</option>
      </select>
    </div>

    <div>
      <label for="feedback-content" class="block text-sm font-medium text-foreground mb-1.5">
        详细描述
        <span class="text-error text-xs ml-1">*</span>
      </label>
      <textarea
        id="feedback-content"
        v-model="content"
        placeholder="请描述你的建议或遇到的问题..."
        rows="6"
        class="w-full px-3 py-2.5 border border-border rounded-sm bg-card text-foreground text-base font-sans transition-[border-color] duration-150 focus:border-primary focus:outline-none resize-y min-h-40 placeholder:text-muted-foreground"
        required
      ></textarea>
    </div>

    <div>
      <label for="feedback-contact" class="block text-sm font-medium text-foreground mb-1.5">
        联系方式
        <span class="text-muted-foreground text-xs font-normal ml-1">（可选，方便我们跟进）</span>
      </label>
      <input
        id="feedback-contact"
        v-model="contact"
        type="text"
        placeholder="邮箱或微信号"
        class="w-full px-3 py-2.5 border border-border rounded-sm bg-card text-foreground text-base font-sans transition-[border-color] duration-150 focus:border-primary focus:outline-none placeholder:text-muted-foreground"
      />
    </div>

    <div class="pt-2">
      <button
        type="submit"
        class="px-6 py-2.5 bg-primary text-white rounded-sm font-medium text-base cursor-pointer border-none hover:opacity-90 transition-opacity"
      >
        发送反馈
      </button>
    </div>
  </form>
</template>
```

- [ ] **Step 10: 跑 FeedbackForm 测试确认通过**

Run: `pnpm test src/components/shell/__tests__/FeedbackForm.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 11: 改 feedback.astro 挂 FeedbackForm**

Modify `src/pages/feedback.astro`——删除整段 `x-data="..."` 的 `<div>`（12-96 行），改为：

```astro
---
/**
 * 反馈建议页面
 *
 * 提供反馈表单，用户填写后通过 mailto: 链接
 * 打开邮件客户端发送到 wy2359117018@163.com。
 */
import SimpleLayout from '../layouts/SimpleLayout.astro';
import FeedbackForm from '../components/shell/FeedbackForm.vue';
---

<SimpleLayout title="反馈建议 | DevTools" description="向 DevTools 提交反馈建议、Bug 报告或功能需求">
  <h1 class="text-3xl font-bold text-foreground m-0 mb-2">反馈建议</h1>
  <p class="text-muted-foreground text-base m-0 mb-8">你的反馈对改进工具至关重要，我们会认真对待每一条建议</p>
  <FeedbackForm client:load />
</SimpleLayout>
```

- [ ] **Step 12: 替换两个 Layout 的 Toast 岛**

Modify `src/layouts/ToolLayout.astro`:
- import 区删除 `import Toast from '../components/layout/Toast.astro';`，新增 `import ToastContainer from '../components/shell/ToastContainer.vue';`
- 把末尾 `<Toast />` 改为 `<ToastContainer client:load />`

Modify `src/layouts/SimpleLayout.astro`:
- import 区（第 10 行）`import Toast from '../components/layout/Toast.astro';` 改为 `import ToastContainer from '../components/shell/ToastContainer.vue';`
- 把末尾注释 `<!-- Alpine Toast -->` + `<Toast />` 改为 `<ToastContainer client:load />`

- [ ] **Step 13: 删除 Toast.astro**

```bash
rm src/components/layout/Toast.astro
```

- [ ] **Step 14: 移除 Layout.astro 的 Alpine toast 事件桥接**

Modify `src/layouts/Layout.astro`——删除末尾 `<script>` 内的桥接段（143-147 行）：

```js
  // 桥接 DOM CustomEvent → Alpine toast store
  document.addEventListener('toast', ((e: CustomEvent) => {
    const { type = 'success', message } = e.detail || {};
    if (message) Alpine.store('toast').add(type, message);
  }) as EventListener);
```

> **保留** `Alpine.store('toast')`、`Alpine.store('favorites')` 注册、`Alpine.store('favorites').load()`、`Alpine.start()`——Task 6 统一移除。Alpine.store('toast') 此时无渲染器（Toast.astro 已删），仅被 `Alpine.store('favorites').toggle` 内部调用（harmless），Task 6 随 favorites 一起清。

- [ ] **Step 15: 类型 + 全量测试**

Run: `pnpm astro check && pnpm test`
Expected: astro check 0 error；测试全过（含新 3 个测试文件）。

- [ ] **Step 16: 浏览器实测**

Run: `pnpm dev`：
- `/feedback`：空内容点「发送反馈」→ 红色 error toast「请填写反馈内容」；填内容点发送 → 成功 toast + 跳转 mailto。
- 任一工具页点「复制结果」类按钮：复制成功有反馈；构造复制失败场景（如断网/权限拒绝）→ error toast 出现一次（非两次，验证 shim 不双渲染）。
- 任一工具页触发其本地 `showToast`（如转盘/二维码的提示）→ toast 正常显示（验证 shim 工作）。

Expected: toast 单次渲染、shim 生效、无控制台错误。

- [ ] **Step 17: Commit**

```bash
git add src/components/shell/ToastContainer.vue src/components/shell/FeedbackForm.vue src/components/shell/__tests__/ src/composables/useCopy.ts src/pages/feedback.astro src/layouts/ToolLayout.astro src/layouts/SimpleLayout.astro src/layouts/Layout.astro src/components/layout/Toast.astro
git commit -m "feat(shell): ToastContainer/FeedbackForm 替代 Alpine toast，useCopy 直连 toastStore"
```

---

## Task 4: Favorites 系统（FavoriteButton + ToolCard + FavoritesList）

**Files:**
- Create: `src/components/shell/FavoriteButton.vue`
- Create: `src/components/shell/__tests__/FavoriteButton.test.ts`
- Create: `src/components/shell/FavoritesList.vue`
- Create: `src/components/shell/__tests__/FavoritesList.test.ts`
- Modify: `src/components/layout/ToolCard.astro`（Alpine 星标 → `<FavoriteButton>`）
- Modify: `src/pages/favorites.astro`（移除 Alpine + tools-data 脚本，挂 FavoritesList）

**Interfaces:**
- Consumes: `favoritesStore` from `../../stores/favorites` — `{ list: Ref<FavoriteItem[]>, load(), isFavorite(path), toggle(item: FavoriteItem), clearAll() }`，`FavoriteItem = { path, name, icon }`
- Consumes: `toastStore`（toggle 后给反馈）
- Produces: `FavoriteButton.vue` props `{ tool: Pick<ToolMeta,'path'|'name'|'icon'> }`；`FavoritesList.vue` 无 props（内部读 `tools` + `favoritesStore`）

**Atomicity note:** `Alpine.store('favorites')` 注册保留到 Task 6；本 task 把两个消费者（ToolCard、favorites.astro）都迁到 Vue favoritesStore 后，Alpine favorites store 即成无消费者空壳。

- [ ] **Step 1: 写 FavoriteButton 失败测试**

Create `src/components/shell/__tests__/FavoriteButton.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import FavoriteButton from '../FavoriteButton.vue';
import { favoritesStore } from '../../../stores/favorites';
import { toastStore } from '../../../stores/toast';

const tool = { path: '/text/uuid-generator', name: 'UUID 生成器', icon: '🔑' };

describe('FavoriteButton.vue', () => {
  beforeEach(() => {
    favoritesStore.list.value = [];
    toastStore.items.value.forEach((t) => toastStore.remove(t.id));
  });

  it('未收藏态：aria-label 为「收藏 …」，点击后加入收藏 + success toast', async () => {
    const wrapper = mount(FavoriteButton, { props: { tool } });
    expect(wrapper.attributes('aria-label')).toBe('收藏 UUID 生成器');
    await wrapper.trigger('click');
    expect(favoritesStore.isFavorite(tool.path)).toBe(true);
    expect(toastStore.items.value.some((t) => t.message.includes('已收藏'))).toBe(true);
  });

  it('已收藏态：再次点击 → 取消收藏 + 「已取消收藏」toast', async () => {
    favoritesStore.list.value = [tool];
    const wrapper = mount(FavoriteButton, { props: { tool } });
    expect(wrapper.attributes('aria-label')).toBe('取消收藏 UUID 生成器');
    await wrapper.trigger('click');
    expect(favoritesStore.isFavorite(tool.path)).toBe(false);
    expect(toastStore.items.value.some((t) => t.message.includes('已取消收藏'))).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/shell/__tests__/FavoriteButton.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 FavoriteButton.vue**

Create `src/components/shell/FavoriteButton.vue`:

```vue
<script setup lang="ts">
/**
 * 收藏星标按钮（ToolCard 内 client:visible 岛）。
 *
 * SSR 渲染未收藏态（favoritesStore 在 SSR 为空），onMounted 读 localStorage
 * 后反映真实状态。点击切换收藏并 toast 反馈。
 */
import { computed, onMounted } from 'vue';
import { Star } from '@lucide/vue';
import { favoritesStore } from '../../stores/favorites';
import { toastStore } from '../../stores/toast';
import type { ToolMeta } from '../../data/tools';

interface Props {
  /** 工具元数据子集 */
  tool: Pick<ToolMeta, 'path' | 'name' | 'icon'>;
}
const props = defineProps<Props>();

const isFav = computed(() => favoritesStore.isFavorite(props.tool.path));

/** 确保本地状态已加载（与 Shell 的 load 幂等，防御岛挂载顺序） */
onMounted(() => favoritesStore.load());

/** 切换收藏 + toast 反馈 */
function onClick(): void {
  const was = isFav.value;
  favoritesStore.toggle({ path: props.tool.path, name: props.tool.name, icon: props.tool.icon });
  toastStore.show(was ? `已取消收藏 ${props.tool.name}` : `已收藏 ${props.tool.name}`);
}
</script>

<template>
  <button
    class="absolute top-2 right-2 z-10 shrink-0 p-2 rounded-sm border-none bg-transparent cursor-pointer transition-[color] duration-150"
    :class="isFav ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-400'"
    :aria-label="isFav ? `取消收藏 ${props.tool.name}` : `收藏 ${props.tool.name}`"
    @click.prevent="onClick"
  >
    <Star v-if="isFav" class="w-5 h-5" fill="currentColor" stroke-width="1" aria-hidden="true" />
    <Star v-else class="w-5 h-5" aria-hidden="true" />
  </button>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/shell/__tests__/FavoriteButton.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: 改 ToolCard.astro 挂 FavoriteButton**

Modify `src/components/layout/ToolCard.astro`——整文件改为：

```astro
---
import type { ToolMeta } from '../../data/tools';
import FavoriteButton from '../shell/FavoriteButton.vue';

interface Props {
  tool: ToolMeta;
}

const { tool } = Astro.props;
---

<div class="relative flex h-full">
  <a
    href={tool.path}
    class="flex items-start gap-4 p-5 pr-14 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full h-full"
  >
    <span class="text-[1.75rem] leading-none shrink-0 mt-0.5">{tool.icon}</span>
    <div class="flex-1 min-w-0">
      <h3 class="m-0 mb-1 text-[0.9375rem] font-semibold leading-snug">{tool.name}</h3>
      <p class="m-0 text-[0.8125rem] text-muted-foreground leading-relaxed">{tool.description}</p>
    </div>
  </a>

  <FavoriteButton client:visible tool={tool} />
</div>
```

- [ ] **Step 6: 写 FavoritesList 失败测试**

Create `src/components/shell/__tests__/FavoritesList.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import FavoritesList from '../FavoritesList.vue';
import { favoritesStore } from '../../../stores/favorites';

describe('FavoritesList.vue', () => {
  beforeEach(() => {
    favoritesStore.list.value = [];
  });

  it('收藏为空 → 显示空状态', () => {
    const wrapper = mount(FavoritesList);
    expect(wrapper.text()).toContain('还没有收藏任何工具');
  });

  it('有收藏 → 渲染对应工具卡片（按 path 匹配 tools 注册表）', () => {
    favoritesStore.list.value = [
      { path: '/text/uuid-generator', name: 'UUID 生成器', icon: '🔑' },
    ];
    const wrapper = mount(FavoritesList);
    expect(wrapper.text()).toContain('UUID 生成器');
    expect(wrapper.find('a[href="/text/uuid-generator"]').exists()).toBe(true);
  });

  it('点击取消收藏 → 从列表移除', async () => {
    favoritesStore.list.value = [
      { path: '/text/uuid-generator', name: 'UUID 生成器', icon: '🔑' },
    ];
    const wrapper = mount(FavoritesList);
    await wrapper.find('button[aria-label="取消收藏 UUID 生成器"]').trigger('click');
    expect(favoritesStore.isFavorite('/text/uuid-generator')).toBe(false);
  });
});
```

- [ ] **Step 7: 跑测试确认失败**

Run: `pnpm test src/components/shell/__tests__/FavoritesList.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 8: 实现 FavoritesList.vue**

Create `src/components/shell/FavoritesList.vue`:

```vue
<script setup lang="ts">
/**
 * 我的收藏列表（/favorites 页 client:load 岛）。
 *
 * 读 favoritesStore.list，按 path 与 tools 注册表 join 出完整工具信息渲染。
 * SSR 渲染空状态（SSG 无法预知用户收藏），onMounted 读 localStorage 后更新。
 */
import { computed, onMounted } from 'vue';
import { Star } from '@lucide/vue';
import { tools } from '../../data/tools';
import { favoritesStore } from '../../stores/favorites';
import { toastStore } from '../../stores/toast';

onMounted(() => favoritesStore.load());

/** 收藏 path 集合 → 命中注册表的工具列表（保持注册顺序） */
const favoriteTools = computed(() => {
  const paths = new Set(favoritesStore.list.value.map((f) => f.path));
  return tools.filter((t) => paths.has(t.path));
});

/** 取消收藏 */
function removeFavorite(tool: { path: string; name: string; icon: string }): void {
  favoritesStore.toggle({ path: tool.path, name: tool.name, icon: tool.icon });
  toastStore.show(`已取消收藏 ${tool.name}`);
}
</script>

<template>
  <div v-if="favoriteTools.length > 0" class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
    <div v-for="tool in favoriteTools" :key="tool.path" class="relative flex h-full">
      <a
        :href="tool.path"
        class="flex items-start gap-4 p-5 pr-14 bg-card border border-border rounded-lg transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] w-full h-full"
      >
        <span class="text-[1.75rem] leading-none shrink-0 mt-0.5">{{ tool.icon }}</span>
        <div class="flex-1 min-w-0">
          <h3 class="m-0 mb-1 text-[0.9375rem] font-semibold leading-snug">{{ tool.name }}</h3>
          <p class="m-0 text-[0.8125rem] text-muted-foreground leading-relaxed">{{ tool.description }}</p>
        </div>
      </a>

      <button
        class="absolute top-2 right-2 z-10 shrink-0 p-2 rounded-sm border-none bg-transparent cursor-pointer text-amber-500 hover:text-amber-400 transition-[color] duration-150"
        :aria-label="`取消收藏 ${tool.name}`"
        @click.prevent="removeFavorite(tool)"
      >
        <Star class="w-5 h-5" fill="currentColor" stroke-width="1" aria-hidden="true" />
      </button>
    </div>
  </div>

  <div v-else class="text-center py-16">
    <p class="text-muted-foreground text-base m-0 mb-2">还没有收藏任何工具</p>
    <a href="/" class="text-[0.8125rem] text-primary hover:underline">去首页看看吧 →</a>
  </div>
</template>
```

- [ ] **Step 9: 跑 FavoritesList 测试确认通过**

Run: `pnpm test src/components/shell/__tests__/FavoritesList.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 10: 改 favorites.astro 挂 FavoritesList**

Modify `src/pages/favorites.astro`——整文件改为：

```astro
---
/**
 * 我的收藏页面
 *
 * 展示用户通过 ToolCard 星标收藏的常用工具，支持在页面内直接取消收藏。
 * 数据来自 localStorage，经 Vue favoritesStore 管理。
 */
import ToolLayout from '../layouts/ToolLayout.astro';
import FavoritesList from '../components/shell/FavoritesList.vue';
---

<ToolLayout title="我的收藏 | DevTools" description="查看和管理你在 DevTools 收藏的工具">
  <div class="max-w-320 mx-auto">
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold m-0 mb-3">我的收藏</h1>
      <p class="text-muted-foreground text-base m-0">常用工具集中管理，点击星标即可取消收藏。</p>
    </div>

    <FavoritesList client:load />
  </div>
</ToolLayout>
```

- [ ] **Step 11: 类型 + 全量测试**

Run: `pnpm astro check && pnpm test`
Expected: astro check 0 error；测试全过。

- [ ] **Step 12: 浏览器实测**

Run: `pnpm dev`：
- `/`（首页）：工具卡片右上角星标可见；点击 → 变实心橙色 + toast「已收藏 X」；再点 → 变回轮廓 + 「已取消收藏 X」。
- `/favorites`：收藏过的工具出现在列表；点取消收藏星标 → 移除 + toast；清空收藏后显示空状态「还没有收藏任何工具」。
- 刷新页面：收藏状态持久化（localStorage）。

Expected: 收藏增删、持久化、列表同步均正常。

- [ ] **Step 13: Commit**

```bash
git add src/components/shell/FavoriteButton.vue src/components/shell/FavoritesList.vue src/components/shell/__tests__/FavoriteButton.test.ts src/components/shell/__tests__/FavoritesList.test.ts src/components/layout/ToolCard.astro src/pages/favorites.astro
git commit -m "feat(shell): FavoriteButton/FavoritesList 替代 Alpine favorites（消费 favoritesStore）"
```

---

## Task 5: Search 系统（SearchPanel + index.astro + 退役 searchTools）

**Files:**
- Create: `src/components/shell/SearchPanel.vue`
- Create: `src/components/shell/__tests__/SearchPanel.test.ts`
- Modify: `src/pages/index.astro`（移除 Alpine 搜索 + tools-data 脚本，挂 SearchPanel；网格加 `data-search-grid`）
- Modify: `src/data/tools.ts`（删除 `searchTools` 620-627 行）

**Interfaces:**
- Consumes: `searchStore` from `../../stores/search` — `{ query: Ref<string>, filterTools(tools, q): Set<string>|null, setQuery(v), clear() }`；`tools` from `../../data/tools`
- Produces: `SearchPanel.vue` 无 props（内部 import tools + 操作 DOM `[data-search-grid] [data-id]`）

**Atomicity note:** index.astro 是最后一个 Alpine 消费者；迁完后全项目 .astro 无 Alpine 指令（除 Layout.astro 的 `<script>` 注册块，Task 6 清）。`searchTools()` 死代码在本 task 退役（改用 `filterTools`）。

- [ ] **Step 1: 确认 searchTools 无其他引用（退役前置检查）**

Run: `pnpm exec grep -rn "searchTools" src/ --include="*.ts" --include="*.vue" --include="*.astro"`
Expected: 仅 `src/data/tools.ts:621`（定义处）命中。若有其他引用，先处理引用再删。

- [ ] **Step 2: 写 SearchPanel 失败测试**

Create `src/components/shell/__tests__/SearchPanel.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SearchPanel from '../SearchPanel.vue';

/** 造一个模拟首页网格的 DOM，供 SearchPanel 过滤 */
function seedGrid() {
  const grid = document.createElement('div');
  grid.setAttribute('data-search-grid', '');
  grid.innerHTML = `
    <div data-id="uuid-generator" style="display:"></div>
    <div data-id="hash-generator" style="display:"></div>
  `;
  document.body.appendChild(grid);
  return grid;
}

describe('SearchPanel.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    seedGrid();
  });

  it('输入匹配词 → 仅命中的卡片 display 非 none，其余隐藏', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('uuid');
    // 防抖 150ms
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    const cards = document.querySelectorAll('[data-search-grid] [data-id]') as NodeListOf<HTMLElement>;
    const byId = (id: string) => Array.from(cards).find((c) => c.getAttribute('data-id') === id)!;
    expect(byId('uuid-generator').style.display).not.toBe('none');
    expect(byId('hash-generator').style.display).toBe('none');
  });

  it('输入无匹配词 → 显示空状态', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    expect(wrapper.text()).toContain('没有找到匹配');
  });

  it('清空搜索 → 全部卡片恢复显示，空状态消失', async () => {
    const wrapper = mount(SearchPanel);
    await wrapper.find('input').setValue('zzzznope');
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    await wrapper.find('button[aria-label="清除搜索"]').trigger('click');
    await new Promise((r) => setTimeout(r, 200));
    await nextTick();
    const cards = document.querySelectorAll('[data-search-grid] [data-id]') as NodeListOf<HTMLElement>;
    expect(Array.from(cards).every((c) => c.style.display !== 'none')).toBe(true);
    expect(wrapper.text()).not.toContain('没有找到匹配');
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm test src/components/shell/__tests__/SearchPanel.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 SearchPanel.vue**

Create `src/components/shell/SearchPanel.vue`:

```vue
<script setup lang="ts">
/**
 * 首页工具搜索面板（client:load 岛）。
 *
 * 搜索框 + 防抖过滤 + 空态。工具网格由 .astro SSR（保 SEO + ToolCard 单源），
 * 本岛通过 [data-search-grid] [data-id] 切换 DOM display 完成客户端过滤，
 * 过滤逻辑复用 searchStore.filterTools 纯函数。
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Search, X } from '@lucide/vue';
import { searchStore, filterTools } from '../../stores/search';
import { tools } from '../../data/tools';

const DEBOUNCE_MS = 150;

const query = ref('');
const empty = ref(false);
let gridEl: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** 应用过滤到网格 DOM */
function applyFilter(): void {
  const ids = filterTools(tools, query.value);
  empty.value = !!ids && ids.size === 0;
  if (!gridEl) return;
  gridEl.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
    const id = el.getAttribute('data-id');
    el.style.display = !ids || ids.has(id!) ? '' : 'none';
  });
}

/** 防抖触发过滤 */
function onInput(): void {
  searchStore.setQuery(query.value);
  if (timer) clearTimeout(timer);
  timer = setTimeout(applyFilter, DEBOUNCE_MS);
}

/** 清空搜索 */
function clear(): void {
  query.value = '';
  searchStore.clear();
  applyFilter();
}

onMounted(() => {
  gridEl = document.querySelector('[data-search-grid]');
});
onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="max-w-140 mx-auto mb-6">
    <div class="flex items-center gap-2 px-5 py-3 border border-border rounded-lg bg-card transition-[border-color] duration-150 focus-within:border-primary">
      <Search class="w-4 h-4 shrink-0 text-muted-foreground" />
      <input
        v-model="query"
        type="text"
        placeholder="搜索工具..."
        class="flex-1 border-none outline-none text-base font-sans text-foreground bg-transparent placeholder:text-muted-foreground"
        @input="onInput"
      />
      <button
        v-if="query"
        class="border-none bg-transparent cursor-pointer text-muted-foreground text-sm px-1 py-0.5 rounded-sm hover:text-foreground"
        aria-label="清除搜索"
        @click="clear"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
    <div v-if="empty" class="text-center py-16">
      <p class="text-muted-foreground text-base m-0">没有找到匹配「<span class="text-foreground font-medium">{{ query }}</span>」的工具</p>
    </div>
  </div>
</template>
```

> 布局说明：空态现在渲染在搜索框下方（原 Alpine 版在网格下方）。视觉等价、位置上移，UX 更即时——记录为有意变更。

- [ ] **Step 5: 跑 SearchPanel 测试确认通过**

Run: `pnpm test src/components/shell/__tests__/SearchPanel.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 6: 改 index.astro 挂 SearchPanel**

Modify `src/pages/index.astro`——整文件改为：

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import ToolCard from '../components/layout/ToolCard.astro';
import SearchPanel from '../components/shell/SearchPanel.vue';
import { tools } from '../data/tools';

const siteUrl = Astro.site?.toString().replace(/\/$/, '') || 'https://tools.baixuanz.cn';

/** 首页 ItemList 结构化数据：列出全部工具，便于搜索引擎与 AI 理解站点能力全集 */
const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'DevTools 在线工具箱',
  description: '零门槛的浏览器端在线开发者工具集合',
  numberOfItems: tools.length,
  itemListElement: tools.map((tool, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: tool.name,
    url: `${siteUrl}${tool.path}`,
    description: tool.description,
  })),
};
---

<ToolLayout title="DevTools - 在线工具箱" jsonLd={itemListJsonLd}>
  <div class="max-w-320 mx-auto">
    <!-- Hero Section -->
    <div class="text-center mb-10">
      <h1 class="text-4xl font-bold m-0 mb-3">在线工具箱</h1>
      <p class="text-muted-foreground text-base m-0 mb-8">零门槛的浏览器端在线工具，即开即用</p>
    </div>

    <!-- 搜索面板（Vue 岛，负责输入 + 过滤 + 空态） -->
    <SearchPanel client:load />

    <!-- 工具卡片网格（Astro SSR，保 SEO；SearchPanel 按 data-id 过滤） -->
    <div
      class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"
      data-search-grid
    >
      {tools.map((tool) => (
        <div data-category={tool.category} data-id={tool.id} class="flex">
          <ToolCard tool={tool} />
        </div>
      ))}
    </div>
  </div>
</ToolLayout>
```

> 删除了原 `toolsJson` 序列化与 `<script is:inline id="tools-data">`（SearchPanel 直接 import tools，无需 JSON 桥）。

- [ ] **Step 7: 退役 data/tools.ts 的 searchTools**

Modify `src/data/tools.ts`——删除 620-627 行：

```ts
/** 搜索工具（匹配名称和描述，大小写不敏感） */
export function searchTools(query: string): ToolMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return tools;
  return tools.filter(
    (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}
```

连同其上方的注释行一并删除。

- [ ] **Step 8: 类型 + 全量测试**

Run: `pnpm astro check && pnpm test`
Expected: astro check 0 error；测试全过。

- [ ] **Step 9: 浏览器实测**

Run: `pnpm dev`，打开 `/`：
- 输入「uuid」→ 仅 UUID 相关卡片显示，其余隐藏；空态不出现。
- 输入「zzzz」→ 显示「没有找到匹配「zzzz」的工具」。
- 点清除按钮（X）→ 全部卡片恢复。
- 网格在 SSR 源码可见（view-source 确认卡片 HTML 存在，SEO 保留）。

Expected: 搜索过滤、空态、清空、SSR 均正常。

- [ ] **Step 10: Commit**

```bash
git add src/components/shell/SearchPanel.vue src/components/shell/__tests__/SearchPanel.test.ts src/pages/index.astro src/data/tools.ts
git commit -m "feat(shell): SearchPanel 替代首页 Alpine 搜索，退役 searchTools 死代码"
```

---

## Task 6: 移除 Alpine 运行时

**Files:**
- Modify: `src/layouts/Layout.astro`（删除整段 Alpine `<script>`）
- Modify: `package.json`（移除 `alpinejs`）
- Modify: CSS 文件（移除 `[x-cloak]` 规则）

**Interfaces:**
- Consumes: 前 5 个 task 已迁完所有 Alpine 消费者；本 task 仅做清理与验收

**Why this task is last:** 必须等所有消费者（sidebar/theme、toast、favorites、search）都迁到 Vue store 后，才能移除 `Alpine.store` 注册与 `alpinejs` 依赖，否则中间态断裂（spec §8、记忆 task 5）。

- [ ] **Step 1: 移除 Layout.astro 的整段 Alpine 脚本**

Modify `src/layouts/Layout.astro`——删除文件末尾整个 `<script>` 块（原 63-148 行，含 `import Alpine`、两个 `Alpine.store(...)` 注册、`Alpine.store('favorites').load()`、`Alpine.start()`）。Toast 事件桥接已在 Task 3 删除。删除后该文件以 `</html>` 结尾，无 `<script>`。

- [ ] **Step 2: 定位并移除 [x-cloak] CSS 规则**

Run: `pnpm exec grep -rn "x-cloak" src/ --include="*.css" --include="*.astro"`
Expected: 命中含 `[x-cloak]` 选择器的 CSS 规则（很可能在 `src/styles/global.css`）。

把命中的 `[x-cloak] { display: none !important; }`（或类似）规则整段删除。

- [ ] **Step 3: 移除 alpinejs 依赖**

```bash
pnpm remove alpinejs
```

- [ ] **Step 4: grep 验收——全项目零 Alpine 残留**

Run: `pnpm exec grep -rnE "x-data|\\$store|@\\$store|x-show|x-cloak|x-model|x-text|x-for|x-transition|alpinejs|from 'alpinejs'" src/ --include="*.ts" --include="*.vue" --include="*.astro" --include="*.css"`
Expected: **零命中**（docs/plans 下的文档不算；若 grep 范围含 docs，加 `--exclude-dir=docs`）。

> 注意：`@headlessui/vue` 本阶段**仍存在**（阶段 2 才替换），故验收 grep 不含 headlessui。阶段 1 出口标准 = Alpine 清零。

- [ ] **Step 5: 全量验证**

Run:
```bash
pnpm astro check
pnpm test
pnpm build
```
Expected: astro check 0 error；测试全过（SM4-CBC 若概率性失败单独重跑）；build 成功。

- [ ] **Step 6: 浏览器全量手测**

Run: `pnpm dev`，逐项验证（无 Alpine 后全部由 Vue 接管）：
- `/`：搜索过滤、收藏星标、暗色切换均正常
- `/favorites`：列表、取消收藏、空态正常
- `/feedback`：表单校验、mailto、toast 正常
- `/text/uuid-generator`（任一工具页）：侧栏高亮、移动端汉堡抽屉、ESC/overlay 关闭、暗色切换、复制按钮 toast 均正常
- `/about`（SimpleLayout 页）：暗色经 FOUC 脚本生效、ToastContainer 可触发、无侧栏
- 刷新各页：暗色 + 收藏持久化、无 FOUC 闪烁、**无任何页面空白**

Expected: 全部正常，控制台无错误/无水合警告。

- [ ] **Step 7: Commit**

```bash
git add src/layouts/Layout.astro src/styles/global.css package.json pnpm-lock.yaml
git commit -m "chore(runtime): 移除 alpinejs 运行时（壳层迁移完成）"
```

---

## 阶段 1 出口标准

- [ ] 全项目 `grep -rE "x-data|\\$store|x-show|x-cloak|alpinejs"` 零结果（`@headlessui/vue` 允许，阶段 2 处理）
- [ ] `pnpm astro check` / `pnpm test` / `pnpm build` 全过
- [ ] 5 个 store 被 UI 真正消费（sidebar/theme/favorites/search/toast 各有 Vue 岛接入）
- [ ] 暗色模式切换可用（全局壳层：Header/Sidebar/Toast/卡片）
- [ ] 新增组件测试（Shell/ToastContainer/FeedbackForm/FavoriteButton/FavoritesList/SearchPanel）全过
- [ ] 所有页面 `pnpm dev` 手测无空白、无水合错误

## 阶段 1 未覆盖（推迟到后续阶段，避免范围蔓延）

- **toast 工具本地迁移**：13 个工具 `.vue` 的 `showToast`/`dispatchToast` 仍发 `CustomEvent('toast')`，经 ToastContainer shim 转发——阶段 3 迁移到 `toastStore.show()` 直连后移除 shim
- **`@headlessui/vue` → Reka/shadcn-vue**：8 文件（4 共享 ui + 4 工具）——阶段 2
- **工具组件暗色对比度逐个校验**——阶段 3
- **文档更新**（CLAUDE.md/DESIGN.md 仍滞后旧 token 名 + Alpine 架构）——阶段 3
- **SimpleLayout 暗色切换按钮**：当前 SimpleLayout 无暗色按钮（超出本次范围），暗色经全局 FOUC 脚本 + CSS 生效
