# 运行时统一重构设计（Runtime Unification）

- **日期**：2026-07-21
- **状态**：待审阅
- **相关文档**：PRODUCT.md、DESIGN.md、CLAUDE.md
- **决策来源**：brainstorming 会话（已确认路线）

---

## 1. 背景

dev-tools 当前由 **Astro + Vue + Alpine + Headless UI** 四套运行时拼装：

- **Astro**：页面框架（路由、SEO、SSG、零 JS 布局）
- **Alpine.js**：全局壳层交互（侧栏开关、Toast、收藏、首页搜索、暗色按钮）
- **Vue 3**：工具内部复杂交互（约 52 个工具组件）
- **@headlessui/vue**：无障碍交互原语（Switch/Listbox/Tab/RadioGroup/Menu/Disclosure）

用户最初提出"整体过于简单朴素，迁 React + shadcn/ui"。经诊断，真实痛点**不是**框架本身，而是运行时层的碎片化。本设计将运行时收敛到 **Vue 单一事实源**，用 Reka UI + shadcn-vue 替代 Headless UI，用 Vue 模块级 store 替代 Alpine。

**明确排除**：迁移到 React / Next.js（诊断结论：痛点用 Vue 也能解决，迁 React 是几倍成本却不治痛点；用户确认选路线 1）。

---

## 2. 痛点诊断（用户已确认）

| # | 痛点 | 根因 |
|---|------|------|
| 1 | Alpine + Vue 双引擎割裂 | 两套响应式/心智/调试，CustomEvent 跨框架通信 |
| 2 | Headless UI 组件不够 | 维护慢、组件少（缺 DatePicker 等） |
| 3 | 三引擎整体太碎 | Astro + Vue + Alpine + Headless UI 四套拼装 |

**非痛点**：Astro SSR/水合（用户未选）→ **Astro 保留**。

---

## 3. 目标态：单一事实源

| 维度 | 重构前（多事实源） | 重构后（单一事实） |
|---|---|---|
| 运行时框架 | Vue（工具）+ Alpine（壳层） | **Vue 唯一** |
| UI 原语 | `@headlessui/vue` | **Reka UI**（unstyled，原 Radix Vue） |
| UI 样式组件 | 手写 Tailwind class | **shadcn-vue**（基于 Reka，源码复制进项目） |
| 壳层状态 | Alpine `x-data`/`$store` 散落 6 个文件 + 2 全局 store | **模块级 store**（toast/sidebar/favorites/search/theme） |
| Toast 通信 | `CustomEvent('toast')` 字符串桥接 | **`toastStore.show()` 函数调用** |
| Token 体系 | `@theme` 单组（暗色硬编码不支持） | **`:root`/`.dark` + `@theme inline`（主题可切换）** |

**Reka 与 shadcn-vue 是两层、一个生态**：Reka = 无障碍原语层（替代 Headless UI 的角色）；shadcn-vue = 基于 Reka 的预制样式组件（替代"到处手写 class"）。二者共同构成 UI 单一事实源。

---

## 4. 目标架构

```
┌──────────────────────────────────────────────────┐
│  Astro 页面层（.astro）—— 零 JS：路由 / SEO / 布局   │
│  Layout.astro · ToolLayout.astro · SimpleLayout   │
└───────────────────┬──────────────────────────────┘
         client:load（壳层）│ client:idle（工具）
┌──────────────────────────▼──────────────────────┐
│  全局壳层 Shell.vue（唯一 client:load 的 island）    │
│  渲染：Header / Sidebar / ToastContainer /         │
│        FavoritesButton / SearchOverlay            │
└───────────────────┬──────────────────────────────┘
            import │ 共享 .ts 模块（Vue reactive 单例）
┌──────────────────────────────────────────────────▼┐
│  src/stores/  —— 模块级 reactive store              │
│  toast.ts · sidebar.ts · favorites.ts ·            │
│  search.ts · theme.ts                              │
└───────────────────┬──────────────────────────────┘
      任意 island 都 import 同一个 store（ESM 单例）
┌──────────────────────────────────────────────────▼┐
│  工具 islands（各 .vue，client:idle）—— 业务逻辑不动 │
│  发通知：toastStore.show(msg) 替代 dispatchEvent     │
└───────────────────────────────────────────────────┘
```

### 为什么状态管理用「模块级 store」

- **provide/inject 不行**：Astro 下每个 Vue island 是独立 Vue app 实例，`provide/inject` 无法跨 island。
- **模块级 reactive 可以**：Vue 的 `reactive()` 是框架级单例，多个 island `import` 同一个 `.ts` store，Vite/Rollup dedupe 成同一份模块，运行时拿到同一响应式对象。这是 Alpine「页面级单实例」能力的 Vue 等价物，且类型安全。
- **不引入 Pinia**：5 个轻量 store 用 `reactive`/`ref` 手写共约百来行，符合项目「不引入全局状态库」现状。模块级 store 是 Vue 官方文档认可的模式。

### SSR 约束

store 在 SSG 构建时会被求值（空状态），读 `localStorage` 的逻辑（favorites/theme）必须在 `onMounted` 或客户端守卫内执行——与当前 Alpine 处理方式一致。

---

## 5. Token 体系重构

### 现状

`src/styles/global.css` 已是 Tailwind v4 `@theme` 模式：

```css
@import "tailwindcss";
@theme {
  --color-surface: #faf9f7;
  --color-accent:  #e8590c;   /* 品牌橙 = 主操作色 */
  --color-hover:   #f3f1ee;   /* 悬停底色 */
  /* ... */
}
```

### 目标：对齐 shadcn v4 token 模式

Tailwind v4 的 CSS-first 方向正是 shadcn 想要的——二者**天生契合**。改造为 `:root`/`.dark` + `@theme inline`：

```css
@import "tailwindcss";

/* 语义层：浅色 + 暗色两组，切 <html class="dark"> 即换主题 */
:root {
  --background: #faf9f7;   /* 原 --color-surface */
  --foreground: #1a1a1a;   /* 原 --color-text */
  --card: #ffffff;
  --primary:  #e8590c;     /* 原 --color-accent，品牌橙保留 */
  --border: #e5e2dd;
  --muted: #f3f1ee;            /* 次要背景 */
  --muted-foreground: #6b7280;        /* 次要文字 */
  --accent: #f3f1ee;       /* shadcn 语义：悬停/次要底色（= 原 --color-hover） */
  --destructive: #dc2626;
  --success: #16a34a;
  --radius: 0.25rem;
}
.dark {
  --background: #161514;
  --foreground: #f3f1ee;
  --card: #1f1e1c;
  --primary: #f97316;      /* 暗色下橙色提亮 */
  --border: #2a2826;
  --muted: #2a2826;
  --muted-foreground: #a1a1aa;
  --accent: #2a2826;
  /* ... */
}

/* 映射层：@theme inline 注入 Tailwind 命名空间，生成 bg-background 等 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary:    var(--primary);
  --color-card:       var(--card);
  --color-border:     var(--border);
  --color-muted:      var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent:     var(--accent);
  --color-destructive: var(--destructive);
  --color-success:    var(--success);
  --radius-sm: calc(var(--radius));
  --radius-md: calc(var(--radius) * 2);
  --radius-lg: calc(var(--radius) * 3);
}
```

> 变量值任意，**品牌橙 `#e8590c` 保留 hex**（shadcn 默认生成器输出 oklch，但不强制）。

### ⚠️ 语义重命名（全项目范围，一次性）

项目当前 `--color-accent` = **品牌橙（主操作色）**，但 shadcn 体系 `accent` = **悬停/次要底色**，`primary` 才是主色。需全项目重命名：

| 现在 | → shadcn 语义 | 说明 |
|---|---|---|
| `bg-accent` / `text-accent`（品牌橙） | `bg-primary` / `text-primary` | grep 批量替换 |
| `bg-hover`（悬停底） | `bg-accent` | grep 批量替换 |
| `bg-surface` | `bg-background` | grep 批量替换 |
| `bg-card` | `bg-card`（不变） | — |
| `text-text` | `text-foreground` | grep 批量替换 |
| `text-muted`（次要文字） | `text-muted-foreground` | grep 批量替换 |
| `border-border` | `border-border`（不变） | — |

机械工作，可 grep 批量替换（项目无路径别名，class 为纯文本）。对齐后未来抄用 shadcn 组件零摩擦。

---

## 6. 壳层迁移映射（Alpine → Vue）

### 6.1 全局 store（Layout.astro `<script>` → `src/stores/`）

| Alpine store | → Vue store | 职责 |
|---|---|---|
| `$store.toast`（add/success/error + items 队列） | `stores/toast.ts` | `show(message, type?)`、自动消失、items 响应式队列 |
| `$store.favorites`（load/save/isFavorite/toggle/clearAll） | `stores/favorites.ts` | 同左，localStorage 持久化，`onMounted` 加载 |

**Toast 通信变更**：`dispatchEvent(new CustomEvent('toast', {detail:{message}}))` → `toastStore.show(message)`。消灭字符串事件桥接，类型安全。

### 6.2 Alpine 使用点（跨 6 个消费文件，9 处使用点）

| 文件 | Alpine 用法 | → Vue 迁移 |
|---|---|---|
| `ToolLayout.astro` 汉堡按钮 | `x-data{expanded}` + `$dispatch('sidebar-toggle')` | `sidebarStore.toggle()` |
| `ToolLayout.astro` Sidebar | `x-data{isOpen}` + `sidebar-toggle/close.window` + `:class sidebar-open` | `Shell.vue` 内 `sidebarStore.isOpen`，watch 切 class |
| `ToolLayout.astro` Overlay | `x-data{show}` + `x-show` + `x-cloak` | `sidebarStore.isOpen` + `<Transition>` |
| `ToolLayout.astro` 暗色按钮 | `$store.toast.success('即将支持')` | `themeStore.toggle()`（本次接真实切换，见 §12） |
| `index.astro` 首页搜索 | `x-data{query,searchIds}` + `x-show` 空态 | `SearchPanel.vue` + `searchStore` |
| `ToolCard.astro` 收藏按钮 | `$store.favorites.isFavorite/toggle` + `x-show` 星标 | **`FavoriteButton.vue`（新 Vue 组件，client:visible）** |
| `favorites.astro` | 读 favoriteTools + `x-show` 空态 | 保留 `.astro` 骨架 + Vue 岛消费 `favoritesStore` |
| `feedback.astro` | `$store.toast.error/success` | `toastStore.show()` |
| `Toast.astro` | `x-for` 渲染 `$store.toast.items` + `x-transition` | `ToastContainer.vue` + `<TransitionGroup>` |

### 6.3 Sidebar/Overlay 事件模型简化

当前用 `$dispatch('sidebar-toggle'/'sidebar-close')` 自定义事件在汉堡按钮、Sidebar、Overlay 三者间联动。迁移后三者同属 `Shell.vue` 一个组件，直接共享 `sidebarStore`，**消灭所有 sidebar 自定义事件**。

### 6.4 ToolCard 收藏按钮 Vue 化（重点）

`ToolCard.astro` 当前是零 JS 的 `.astro` 组件，收藏按钮靠 Alpine `:class`/`@click` 直接调 `$store.favorites`。迁移后收藏交互必须有 JS 承接 → 抽出 `FavoriteButton.vue`（`client:visible`），`ToolCard.astro` 其余部分保持零 JS。

---

## 7. UI 原语替换表（Headless UI → Reka / shadcn-vue）

**关键：Headless UI 只在 8 个文件使用**（4 共享 ui 组件 + 4 工具）。替换这 8 处底层 import 即清零。

| 文件 | Headless UI | → Reka UI 原语 | → shadcn-vue 预制 |
|---|---|---|---|
| `ui/ToggleSwitch.vue` | `Switch` | `SwitchRoot`/`SwitchThumb` | `Switch` |
| `ui/SelectListbox.vue` | `Listbox*` | `ListboxRoot/Trigger/Content/Item` | `Select` 或 `Combobox` |
| `ui/ModeTabGroup.vue` | `Tab*` | `TabsRoot/List/Trigger/Content` | `Tabs` |
| `ui/OptionRadioGroup.vue` | `RadioGroup*` | `RadioGroupRoot/Item` | `RadioGroup` |
| `text/TextToolbox.vue` | `Disclosure*` | `CollapsibleRoot/Trigger/Content` | `Collapsible` |
| `text/FakeDataGenerator.vue` | 多组件（实现时确认） | 对应 Reka 原语 | — |
| `editor/MarkdownEditor.vue` | `Menu*` | `MenuRoot/Trigger/Content/Item` | `DropdownMenu` |
| `datetime/CronParser.vue` | `Tab*` | 同 ModeTabGroup | `Tabs` |

**策略**：4 个共享 ui 组件先换底层原语，调用方（几十个工具）零改动即受益；4 个工具内部直接使用的，单独改。

---

## 8. 迁移阶段

### 阶段 0：基建（无破坏性，可独立合并）
- 初始化 shadcn-vue（`components.json`、`src/components/ui/` shadcn 目录）。**路径别名决策：不引入 `@/`**——shadcn 组件 import 统一改相对路径（`add` 后调整，或配置 `components.json` 的 alias 指向相对）。理由：① codegraph 解析 `@/` 调用关系边依赖索引读取 tsconfig paths，有断裂风险（项目第一铁律依赖 codegraph）；② 项目当前全相对路径一致，引入 `@/` 仅服务 shadcn 会造成混用，破坏一致性
- 验证 shadcn-vue + Tailwind v4 在本项目的 init（最大技术风险点，优先做）
- 引入 Reka UI，跑通一个 demo（如 Switch）
- Token 体系重构（§5：`:root`/`.dark` + `@theme inline` + 语义重命名）
- 建立 5 个 store 骨架（toast/sidebar/favorites/search/theme）

### 阶段 1：壳层迁移（Alpine → Vue）
- 建 `Shell.vue`（Header + Sidebar + Overlay + ToastContainer）
- 迁移 2 个全局 store（toast/favorites）
- 逐文件迁移 §6.2 的 7 处 Alpine 点
- 抽出 `FavoriteButton.vue`、`SearchPanel.vue`、`ToastContainer.vue`
- 每迁一处，`pnpm dev` 验证对应页面

### 阶段 2：UI 原语替换（Headless UI → Reka/shadcn-vue）
- 4 个共享 ui 组件换底层原语
- 4 个工具内部直接使用处替换
- 逐组件 `pnpm dev` 验证交互

### 阶段 3：清理与文档
- 移除 `alpinejs`、`@headlessui/vue` 依赖
- 移除 `[x-cloak]`、Alpine `<script>` 等残留
- 更新 CLAUDE.md / DESIGN.md（§10）
- 全量验证（§13）

---

## 9. 风险与应对

| 风险 | 等级 | 应对 |
|---|---|---|
| shadcn-vue + Tailwind v4 init 失败 | 低（已查证有官方 v4 支持） | 阶段 0 首先验证；失败则退回「Reka + 自写 shadcn 风格样式」（Reka 与 Tailwind 版本无关，一定可行） |
| shadcn-vue 默认 `@/` 别名与项目「无别名」约定冲突 | 低（已决策） | **不引入别名**：shadcn 组件 import 统一改相对路径。理由：codegraph 解析 `@/` 边有风险 + 项目全相对路径一致性 |
| Reka API 与 Headless UI 差异 | 低-中 | 二者都是 unstyled composable/slot 模式，API 相近；逐组件对照替换 |
| Astro islands + 模块级 store 跨 island 共享 | 低 | ESM 单例保证共享；阶段 0 用 toast 跨 island 验证 |
| 工具页 SSR/水合回归（空白/闪烁） | 中 | 记忆教训：build/类型/单测全过但运行时空白 → **每处迁移必须 `pnpm dev` 浏览器验证**；警惕模板字符串 `${}` 插值、watch 标志须 `nextTick` 重置 |
| localStorage 在 SSR 期被访问 | 低 | store 内 `onMounted`/客户端守卫读取（沿用 Alpine 期做法） |
| 迁移期网站半残 | 中 | 阶段 1/2 可按文件渐进，每个 PR 保持可部署；建议在独立分支/worktree 进行 |

---

## 10. 文档更新清单

| 文档 | 更新内容 |
|---|---|
| **CLAUDE.md** | Tech Stack（移除 Alpine、Headless UI；加 Reka/shadcn-vue）；Frontend Architecture（双引擎 → Vue 单引擎；跨框架通信 → store 函数调用）；Dependency Rules（新增 Reka/shadcn-vue 选型说明） |
| **DESIGN.md** | §Implementation Rules 组件库选型（@headlessui/vue → Reka/shadcn-vue）；§Elevation Dark Mode（如本次交付暗色，从"Not Supported"改为支持）；§Colors 补 shadcn 语义变量表 |
| **PRODUCT.md** | 若交付暗色模式，在相应章节声明 |
| **global.css** | Token 体系重构（§5） |

---

## 11. 测试策略

- **现有 Vitest（utils 单测）**：不受影响，全部保留
- **store**：为 5 个 store 补单测（toast 队列时序、favorites 持久化、search 过滤逻辑）
- **UI 组件**：关键交互（Sidebar 开合、Toast 显隐、收藏 toggle）补组件测试
- **回归**：每处迁移 `pnpm dev` 浏览器手测；阶段末 `pnpm build` + `pnpm astro check` + `pnpm test` 全过
- **SSR 陷阱**：警惕「构建/类型/测试全过但运行时空白」，以浏览器实测为准（见记忆 `astro-ssg-tolerates-vue-ssr-errors`）

---

## 12. 排除项（YAGNI）与主题切换边界

- **❌ 迁移到 React / Next.js**：诊断结论不支持，明确排除
- **❌ i18n 国际化**：不在本次范围。仅保证 token 体系与组件抽象不阻碍未来 i18n
- **主题/暗色模式**（用户诉求之一）：
  - **本次交付**：Token 基建（`:root`/`.dark` 两组变量）+ `theme.ts` store + `<html class="dark">` 切换 + **全局壳层**（Header/Sidebar/Toast/卡片）的暗色适配
  - **后续可选**：全部工具组件的暗色对比度逐个校验（工作量大，作为独立后续项）
  - DESIGN.md 原"Dark Mode: Not Supported 是设计身份"需相应修订

---

## 13. 验收标准

- [ ] `alpinejs`、`@headlessui/vue` 从 `package.json` 移除
- [ ] 全项目 `grep "x-data\|\$store\|@headlessui/vue\|x-show\|x-cloak"` 零结果
- [ ] `pnpm build` / `pnpm astro check` / `pnpm test` 全过
- [ ] 所有工具页 `pnpm dev` 手动验证功能正常（无 SSR 空白）
- [ ] 暗色模式切换可用（至少全局壳层）
- [ ] CLAUDE.md / DESIGN.md / global.css 更新完成
- [ ] 5 个 store 单测通过

---

## 附：决策溯源（为何不迁 React）

1. 用户列的三个痛点（双引擎割裂 / Headless UI 不够 / 整体太碎）**没有一个强制要求 React**
2. "shadcn 的好看"来自 Radix + Tailwind + CSS 变量 token，在 Vue 有 1:1 等价物（Reka + shadcn-vue），且 shadcn-vue 2026 年仍活跃维护
3. 迁移 React 的成本（重写 67 组件 + 壳层 + 测试，几周）买的是"进入 React 生态"，不解决上述痛点
4. Tailwind v4 恰恰是 shadcn 路线的最佳契合点（CSS-first 同向），技术栈无阻碍
5. 用户确认选路线 1（收敛到 Vue）
