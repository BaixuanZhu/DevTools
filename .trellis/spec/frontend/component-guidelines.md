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

### Common Mistake: DropdownMenuItem 的 select 里同步开 Dialog → 秒开秒关

**Symptom**: 点菜单项后 Dialog 完全不出现，console 无报错；用 MutationObserver 观察 `[role=dialog]`，可见「挂载后 ~20ms 内即被移除」。

**Cause**: reka-ui 菜单收起流程（焦点还原 trigger / DismissableLayer 外部交互判定）与同 tick 挂载的 Dialog 焦点管理相撞，刚挂载的 Dialog 被判定为外部交互立即 dismiss。

**Fix / Prevention**: select 处理器里 `window.setTimeout(() => open.value = true, 100)` 等菜单卸载完成后再置开（范式 `MarkdownWorkstation.vue` 的 `handleExportHtml`）。不要用 0ms/rAF—— dismissal 发生在挂载之后的任务里，仍有竞态窗口。

## Patterns

### Pattern: 可搜索选择（combobox）= reka-ui Popover 薄壳 + 既有 ui/command 系列

需要"大列表 + 关键词过滤"的选择器（如 83 条 IANA 时区）时，不要引 cmdk 之类新依赖，也不要手写过滤下拉：组件库已有 `src/components/ui/command/`（shadcn-vue Command，基于 reka-ui Listbox 原语），只需按 `src/components/ui/SearchSelect.vue` 的方式用 reka-ui `PopoverRoot/Trigger/Content` 做薄壳组合。共享 ParamRow 的 `control: 'combobox'` 分支是消费范例；弹层宽度用 `w-[var(--reka-popover-trigger-width)]` 对齐触发器，`emptyText` 等领域文案由调用方传入（共享组件不硬编码）。

### Pattern: IANA 时区/地域类本地表的有效性测试锚定

静态维护 IANA 名清单时（如 `src/tools/devops/postgres-config/timezones.ts`），有效性断言用 `new Intl.DateTimeFormat('en-US', { timeZone: value })` **可解析性**，不要断言 `Intl.supportedValuesOf('timeZone')` 成员——后者只含 canonical 名且新旧拼写取向随运行时 ICU 版本漂移，前者接受 tzdata 全部 canonical 名与 backward 链接，与 PostgreSQL 的接受面一致。表值统一采用**现代规范拼写**（Asia/Kolkata、Europe/Kyiv 等 tzdata 主文件 Zone 名），旧拼写（Calcutta、Kiev）放 keywords 作搜索别名。

### Pattern: 完全独立工作台页（standalone workbench island）

旗舰工具（如 /markdown Markdown 工作台）需要脱离站点壳层的全屏应用形态时，页面**不 import Layout.astro/ToolLayout**，直接输出完整 HTML 文档（手写 head 元数据 + JSON-LD + `import global.css`），body 只放一个 `client:only="vue"` 全屏岛（范式 `src/pages/markdown.astro` + `src/tools/markdown/MarkdownWorkstation.vue`）。脱离 Shell 后有三项必须自含的隐藏职责，遗漏即静默失效：`onMounted` 调 `themeStore.load()`（否则主题不恢复）、岛内挂 vue-sonner `<Toaster />`（否则 toastStore 无渲染目标）、主题切换控件需自带（复用 themeStore API）。注册表（tools.ts）仅是元数据与入口，独立页照常注册（`path` 可为单段，需登记 `astro.config.mjs` 单段白名单与 `src/data/__tests__/tools.test.ts` 的 `FLAGSHIP_SINGLE_SEGMENT_PATHS` 两个**人工同步点**）。

### Pattern: 重型编辑器扩展库本地实例注入（禁运行时 CDN）

md-editor-v3 等组件库默认从 unpkg CDN 运行时加载扩展（mermaid/katex/highlight.js/prettier/cropperjs/screenfull/echarts 共 7 处），国内可达性不稳定。接入时一律 `pnpm add` 对应包并在模块级 `config({ editorExtensions: { *.instance } })` 注入本地实例（库源码守卫：有 instance 即跳过 script/link 追加，范式 `MarkdownWorkstation.vue` 顶部）；被替代的 CDN 样式（katex css+字体、cropper css、hljs 主题）也要本地 import。库体只允许进懒加载岛 chunk。两个易踩坑：echarts 6 ESM 无 default export（用 `import * as`），且其默认 `parseOption` 用 `new Function` 处理用户输入、触碰 Security Rules，必须覆写为 `JSON.parse`；同版本共存冲突（如 md-editor 需要 cropperjs v1 而站点用 v2）用 npm 别名解决（`"cropperjs1": "npm:cropperjs@^1.6.3"`），**禁止直接降级共享依赖版本**——会隐性打断不相关工具（image-converter/ico-maker 的裁切器用 v2 API，且 .vue 组件不受 astro check/单测覆盖，门禁全绿仍会放行）。

### Pattern: 独立 HTML 导出产物（多主题内嵌 + 单一生成路径）

导出类功能凡有「预览 + 下载」，预览与下载必须共用同一条产物生成函数（范式 `markdown-export.ts` 的 `buildHtmlDocument`，消费方 `HtmlExportDialog.vue`），杜绝两套渲染漂移；主题选择收敛在预览 UI，**产物只烘焙所选主题、不含任何脚本**（单测固化零 `<script>`/零外链，`markdown-export.test.ts`）。多主题实现：主题 = CSS 变量声明集挂 `:root[data-theme]`，基础排版只消费变量（新增主题成本 = 一组变量；变量表达不了的结构性特色用主题级 `extraCss` 附加规则）。预览 iframe 用空 `sandbox`（全沙箱禁脚本，静态展示）。另两条硬约束：① 嵌在 md-editor-v3 页面里的弹层（共享 `ui/dialog/DialogContent.vue`）z-index 必须 ≥ 21000——md-editor 内部 dropdown/modal 为 20000-20001，z-50 会被盖住；② 从 DropdownMenuItem select 里开 Dialog 必须 `setTimeout ≥100ms` 再置开（见上文 Common Mistake）。

### Pattern: 慢计算类工具交互（按钮触发 + 输入快照 stale + reqId 丢弃）

站内「输入即输出」默认对**故意慢**的操作（bcrypt 哈希/校验、cost 12+ 秒级计算）失效——DESIGN.md 明示"慢操作除外"。范式 `src/tools/crypto/BcryptTool.vue` + `src/utils/crypto/bcrypt.ts`（worker 协议类型），四条硬规则：① 按钮触发而非 watch 自动计算，计算中按钮 disabled 防连点；② 请求带递增 `reqId`，回包 reqId 与当前序号不符直接丢弃（worker 内同步计算不可中断，靠结果侧丢弃防乱序）；③ **stale 标记不能只靠 watch**——派发时记录输入快照，回包时与当前输入比对，不一致置 stale（弱化展示 + 警告文案），否则计算窗口（可达数十秒）内改输入会让旧结果以"新鲜"状态展示；④ 清空按钮必须同时递增 reqSeq 使在途响应失效并复位计算中状态，否则回包会把已清空的结果回填。慢计算本体放 Web Worker（`self.onmessage` 薄层风格同 `json-diff.worker.ts`，算法库只进 worker chunk 保主包零增长）。库特定坑：bcryptjs `compareSync` 遇 `$2x$` 前缀直接 throw（英文错误泄漏），比对前须归一化 `$2x`→`$2a`（`normalizeHashForCompare` 纯函数 + 单测）；盐用 Web Crypto `getRandomValues` 自产（不依赖库的运行时随机源探测）。
