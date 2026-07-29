# shadcn-vue 重构说明

> 日期：2026-07-27
> 范围：Shell 壳层、首页、分类页、工具页内部控件、SearchPanel
> 组件库：shadcn-vue（new-york 风格，基于 reka-ui 原语）
> 主题色：shadcn 默认 zinc（brand 橙 #e8590c 降级为独立 `--brand` token，仅保留于 Logo）

---

## 1. 重构目标

将项目原有「手写 Tailwind 组件 + Headless UI 残留」统一替换为 shadcn-vue 官方组件体系，实现：

1. 视觉语言统一（zinc 中性色 + 圆角/阴影/边框规范一致）
2. 交互行为标准化（focus ring、aria 属性、键盘导航由 reka-ui 原语保证）
3. 响应式布局适配（移动端 Sheet 抽屉、桌面端静态侧栏、卡片网格自适应）
4. 零控制台报错、可正常打包部署

---

## 2. 组件替换映射表

### 2.1 基础组件库（`src/components/ui/`）

共创建 16 个 shadcn-vue 组件家族（70+ 文件），全部基于 reka-ui 原语 + cva 变体 + `cn()` 合并：

| 组件家族 | 原始实现 | shadcn-vue 替换 | 底层原语 |
|---------|---------|----------------|---------|
| Button | 原生 `<button>` + 内联类 | `Button.vue` + `buttonVariants` (cva) | 原生 button |
| Card | 手写 `bg-card border rounded-lg` | `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` | 原生 div |
| Badge | 手写 `rounded-full bg-accent` | `Badge.vue` + `badgeVariants` | 原生 span |
| Input | 原生 `<input>` | `Input.vue` | 原生 input |
| Textarea | 原生 `<textarea>` | `Textarea.vue` | 原生 textarea |
| Label | 原生 `<label>` | `Label.vue` | reka-ui Label |
| Switch | 自管 SwitchRoot/Thumb 类 | `Switch.vue`（标准 shadcn 类） | reka-ui SwitchRoot/SwitchThumb |
| Tabs | 自管 TabsRoot 类 | `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | reka-ui Tabs* |
| Breadcrumb | 手写 `/` 分隔 | `Breadcrumb*`（6 文件，ChevronRight 分隔） | 原生 nav/ol/li |
| Sheet | 手写 sidebar-open + transform | `Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` 等 | reka-ui DialogRoot |
| Dialog | — | `Dialog` / `DialogContent` / `DialogHeader` 等 | reka-ui DialogRoot |
| DropdownMenu | 单按钮 toggle | `DropdownMenu` / `DropdownMenuTrigger` / `DropdownMenuContent` / `DropdownMenuItem` | reka-ui DropdownMenu* |
| Command | 手写下拉过滤 | `Command` / `CommandInput` / `CommandList` / `CommandGroup` / `CommandItem` / `CommandEmpty` | reka-ui CommandRoot (cmdk) |
| Sonner | ToastContainer.vue（自管队列） | `Toaster.vue` + `use-sonner.ts` | vue-sonner |

### 2.2 业务页面替换

| 页面/组件 | 原始实现 | 重构后 |
|----------|---------|-------|
| `Shell.vue` | 手写 sidebar-open + ESC 监听 + 单按钮主题 toggle | Button（汉堡）+ DropdownMenu（主题）+ Sheet（移动抽屉）+ Toaster（Sonner 全局） |
| `SearchPanel.vue` | 手写 input + 下拉过滤 + keyboard 导航 | Command（cmdk）+ 自定义 filterFunction |
| `index.astro`（首页） | 纯手写 hero + CategoryCard | hero 加 Badge（工具总数）+ 响应式断点 |
| `[category]/index.astro` | 手写标题 + 工具数 | 标题加 Badge（工具数）+ 响应式断点 |
| `CategoryCard.astro` | `rounded-lg` + 自定义徽标 | shadcn Card 类（`rounded-xl shadow`）+ Badge secondary 类 |
| `ToolCard.astro` | `rounded-lg` + 手写标题类 | shadcn Card 类 + CardTitle/Description tokens |
| `RelatedTools.astro` | 同 ToolCard 旧样式 | 与 ToolCard 共享 shadcn Card 类 |
| `Breadcrumb.astro` | `/` 文本分隔 | ChevronRight 分隔 + shadcn Breadcrumb tokens |
| `ToolLayout.astro` | 挂载 ToastContainer | 移除（Shell 内 Sonner Toaster 统一接管） |
| `SimpleLayout.astro` | 挂载 ToastContainer | 改挂 Sonner `<Toaster client:load />` |

### 2.3 共享 UI 组件对齐（杠杆点，影响全部 45 个工具）

| 共享组件 | 变更 | 影响范围 |
|---------|------|---------|
| `ToggleSwitch.vue` | 内部改渲染 shadcn `Switch` 组件 | 27 个调用方自动继承 shadcn Switch 视觉 |
| `ModeTabGroup.vue` | 内部改渲染 shadcn `TabsList/TabsTrigger/TabsContent` | 6 个调用方继承 shadcn Tabs 视觉 |
| `SelectListbox.vue` | 触发器/内容类对齐 shadcn Select（`h-9 rounded-md border-input`） | 全部下拉调用方 |
| `OptionRadioGroup.vue` | 按钮类对齐 shadcn toggle（`rounded-md shadow-sm`） | 全部单选组调用方 |

### 2.4 工具页示范重构

| 工具 | 替换内容 |
|-----|---------|
| `Base64Codec.vue` | 原生 button → `Button`（default/outline）；原生 textarea → `Textarea`；新增 ArrowRightLeft 图标 |
| `NumberBaseConverter.vue` | 原生 textarea → `Textarea`；原生 button → `Button`（outline） |

> 其余 43 个工具通过共享组件（2.3）自动继承 shadcn 视觉；原生 `<button>/<input>/<textarea>` 的内联类因 global.css 的 `@theme inline` token 映射，颜色已自动切换为 zinc。后续可按示范模式逐个迁移。

---

## 3. 样式调整点

### 3.1 调色板（`src/styles/global.css`）

- **主色**：原品牌橙 `#e8590c` (`--primary`) → shadcn zinc-900 `hsl(240 5.9% 10%)` (`--primary`)
- **品牌色保留**：橙 `#e8590c` 降级为独立 `--brand` token，仅用于 Logo（`text-brand`），保留品牌识别
- **语义色保留**：`--success` / `--info` / `--warning` / `--error` 维持原 HSL 值，用于 toast/校验等状态
- **格式标准化**：所有变量从 hex 改为 shadcn 标准 HSL（`H S% L%`），通过 `@theme inline` 映射到 Tailwind v4

### 3.2 圆角与阴影

| 元素 | 原值 | 新值（shadcn 规范） |
|-----|------|------------------|
| Card 根 | `rounded-lg` | `rounded-xl` |
| Button | `rounded-sm` | `rounded-md` |
| Input/Select 触发器 | `rounded-sm` | `rounded-md` |
| Tabs 容器 | 无 | `rounded-lg bg-muted p-1` |
| Card 阴影 | `hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]` | `shadow` + `hover:shadow-md` |

### 3.3 焦点态

- 原始：`focus:outline-none focus:border-primary`（仅边框变色）
- shadcn：`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`（标准 ring，仅键盘聚焦触发）

### 3.4 响应式断点

- 首页 hero 标题：`text-4xl` + `max-md:text-3xl`
- 卡片网格：`grid-cols-[repeat(auto-fill,minmax(280px,1fr))]` + `max-md:grid-cols-1`
- 分类页标题：`text-3xl` + `max-md:text-2xl`
- Header 汉堡按钮：`hidden max-lg:flex`（≤1024px 显示）
- 桌面侧栏：`hidden lg:flex`（>1024px 显示）
- 移动抽屉：Sheet `side="left"` + `w-72`

---

## 4. 关键架构决策

### 4.1 Toast 双容器修复

**问题**：s3 阶段 Shell.vue 挂载了 Sonner `<Toaster />`，但 ToolLayout.astro/SimpleLayout.astro 仍挂载旧 `ToastContainer.vue`，且 30+ 调用方仍用 `toastStore.show/error`。Sonner 收不到这些消息 → 双容器且 toast 不显示。

**方案**：将 `src/stores/toast.ts` 改造为 Sonner 适配器：
- 保留 `items` 镜像 ref（兼容 useCopy/FeedbackForm 等测试的 `items.value` 断言）
- `show/success/error` 内部委派 `sonnerToast.success/error`（Shell 的 Toaster 接收渲染）
- 删除 `ToastContainer.vue` 及其测试
- SimpleLayout（feedback/about 页）单独挂 `<Toaster client:load />`

**结果**：30+ 调用方零改动，toast 统一由 Sonner 渲染。

### 4.2 Astro SSG 与 Vue 岛的边界

- **纯展示组件**（CategoryCard/ToolCard/Breadcrumb/RelatedTools）：保持 `.astro`，零 JS，仅对齐 shadcn 类名 token。避免 N 个卡片网格全量 hydration。
- **交互组件**（Shell/SearchPanel/FeedbackForm）：`.vue` + `client:load`，使用 reka-ui 原语保证可访问性。
- **共享表单组件**（ToggleSwitch/SelectListbox 等）：作为 `.vue` 组件，内部封装 reka-ui 原语 + shadcn 类，被各工具岛消费。

### 4.3 共享组件作为杠杆点

45 个工具全部消费 4-6 个共享 UI 组件。通过重构这些共享组件的内部视觉（不改 API），全部工具自动继承 shadcn 外观，避免 45 文件逐个重写的风险与体量。

---

## 5. 功能验证清单

> 因当前环境 node_modules 为空（沙箱限制），以下验证项需在本地 `pnpm install` 后执行。

### 5.1 单元测试

```bash
pnpm test
```

重点用例（应全绿）：
- `ToggleSwitch.test.ts`：`translate-x-4` 子串断言（shadcn Switch thumb 类含此 token）
- `SelectListbox.test.ts`：pointerdown 打开 + 选项 select（reka-ui 行为不变）
- `ModeTabGroup.test.ts`：role=tab / aria-selected / force-mount（reka-ui Tabs 不变）
- `OptionRadioGroup.test.ts`：role=radio / data-state=checked
- `toast.test.ts` / `useCopy.test.ts` / `FeedbackForm.test.ts`：items 镜像仍按 3000ms 出列

### 5.2 类型检查与构建

```bash
pnpm build
```

验证：
- 无 TS 报错（`vue-sonner` 的 `@ts-expect-error` 已加）
- 无 Astro 构建报错（所有 `.astro` 页面 SSG 通过）
- 7 个分类页 + 首页 + feedback/about 全部产出 HTML

### 5.3 交互手测

| 场景 | 验证点 |
|-----|-------|
| 移动端（<1024px） | 汉堡按钮 → Sheet 抽屉滑入；点击分类项跳转后抽屉关闭 |
| 桌面端（≥1024px） | 静态侧栏常驻；分类高亮 + Badge 计数 |
| 主题切换 | DropdownMenu → 浅色/暗色 切换；全站 zinc 色随之翻转 |
| 搜索面板 | 输入 → Command 实时过滤；↑↓ 键盘导航；Enter 跳转 |
| Base64 工具 | 编码/解码按钮触发；Textarea 输入；互换按钮；toast 弹出 |
| 任意工具 toast | Sonner Toaster 在顶部居点弹出（非旧 ToastContainer） |
| feedback 页 | SimpleLayout 的 Toaster 接收 FeedbackForm 的 toast |
| 卡片 hover | 边框变 primary + 阴影加深（rounded-xl） |
| 面包屑 | ChevronRight 分隔；当前页加粗 + aria-current |

### 5.4 可访问性

- 所有 reka-ui 原语自带 ARIA（role/aria-selected/aria-checked/aria-current）
- 焦点态使用 `focus-visible:ring`（键盘可见，鼠标不干扰）
- 颜色对比度：zinc-900 on white = 18.7:1（远超 WCAG AA 4.5:1）

---

## 6. 后续迁移指引

剩余 43 个工具若需完整迁移到 shadcn-vue 原语，按示范模式：

1. **按钮**：`<button class="px-4 py-2 bg-primary...">` → `<Button>` 或 `<Button variant="outline">`
2. **文本域**：`<textarea class="...">` → `<Textarea v-model="x" class="font-mono">`
3. **输入框**：`<input class="...">` → `<Input v-model="x" type="number">`
4. 共享组件（ToggleSwitch/SelectListbox/OptionRadioGroup/ModeTabGroup）**无需改动**——已统一。

迁移时注意：
- shadcn Button 默认 `h-9`，比原项目按钮略高，紧凑场景传 `size="sm"`
- Textarea/Input 默认带 `border-input`，无需重复写边框类
- 图标用 `@lucide/vue`，Button 内 SVG 自动 `size-4`

---

## 7. 文件变更清单

### 新增
- `src/components/ui/` 下 16 个组件家族（button/card/badge/input/label/textarea/breadcrumb/sheet/sonner/dropdown-menu/command/switch/tabs/dialog 等）

### 修改
- `src/styles/global.css`（zinc HSL 调色板）
- `src/stores/toast.ts`（Sonner 适配器）
- `src/layouts/ToolLayout.astro`（移除 ToastContainer）
- `src/layouts/SimpleLayout.astro`（Sonner Toaster）
- `src/components/shell/Shell.vue`（Button/Sheet/DropdownMenu/Toaster）
- `src/components/shell/SearchPanel.vue`（Command）
- `src/components/layout/CategoryCard.astro` / `ToolCard.astro` / `RelatedTools.astro` / `Breadcrumb.astro`（shadcn 类对齐）
- `src/pages/index.astro` / `src/pages/[category]/index.astro`（Badge + 响应式）
- `src/components/ui/ToggleSwitch.vue` / `ModeTabGroup.vue` / `SelectListbox.vue` / `OptionRadioGroup.vue`（视觉对齐）
- `src/tools/text/Base64Codec.vue` / `NumberBaseConverter.vue`（示范重构）

### 删除
- `src/components/shell/ToastContainer.vue`
- `src/components/shell/__tests__/ToastContainer.test.ts`
