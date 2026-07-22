# 运行时统一重构 · 阶段 3：toast shim 退役 + 清理 + 文档 + 全量验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消灭最后一个跨框架桥接（`CustomEvent('toast')` → `toastStore.show()` 直连），移除 ToastContainer 兼容 shim，修复 CopyButton size prop 警告，同步三份根文档（CLAUDE.md / DESIGN.md / PRODUCT.md）到 Vue 单引擎 + reka-ui + 双主题现实，并完成 spec §13 全量验收。

**Architecture:** 阶段 1 已把 toast 系统迁入 `toastStore`（`src/stores/toast.ts`），但 13 个工具/组件文件仍通过 `document.dispatchEvent(new CustomEvent('toast', ...))` 经 ToastContainer 的 `legacyBridge` 转发。本阶段把 13 处全部改为直接 `import { toastStore }` 调用，随后删除 shim。文档侧把 Stage 0 令牌语义重命名（bg-accent→bg-primary 等）与运行时统一（Alpine/HeadlessUI 移除、暗色交付）回写到三份根文档。

**Tech Stack:** Astro 6 + Vue 3 + reka-ui 2.10 + Tailwind CSS v4 + Vitest（happy-dom + @vue/test-utils）

**上下文（禁止凭记忆，实施前必读）：**
- spec：`docs/superpowers/specs/2026-07-21-runtime-unification-design.md`（§10 文档清单、§12 主题边界、§13 验收标准）
- ledger：`.superpowers/sdd/progress.md`（Stage 0/1/2 全部记录与 Minor 分诊）
- `src/stores/toast.ts`：`toastStore.show(message, type='success', duration=3000): number`、`toastStore.error(message)`、`toastStore.items: Ref<ToastItem[]>`
- `src/components/shell/ToastContainer.vue`：legacyBridge shim（本阶段删除）
- `src/styles/global.css`：`:root`/`.dark` + `@theme inline` token 现状

## Global Constraints

- **行为等价优先**：toast 迁移只换投递机制，不改文案、不新增/删除 toast 触发点、不改 type（见 Task 1 的 RegexTester 特例说明）。
- 不引入 `@/` 别名；import 一律相对路径。
- Tailwind 标准类名优先；禁止可用标准类表示的任意值。
- 公共 API（组件 props/emits、store 签名）写 JSDoc；**store 签名冻结勿改**。
- 主域名 `https://tools.baixuanz.cn`。
- 每处 UI 行为改动必须 `pnpm dev` 浏览器实测（build/类型/单测全过 ≠ 运行时正确）。
- 文档是 UI 唯一标准：DESIGN.md 的令牌表、组件规范必须与代码现状一致，禁止留下已不存在的类名。

## 关键架构决策

1. **删除本地助手、直连 toastStore**：13 个文件里的 `dispatchToast`/`notifyToast`/`showToast`/`notifyCopy` 本地助手全部删除，调用点直接写 `toastStore.show(...)`。助手只是 dispatchEvent 的薄封装，删除后少一层间接、语义统一。
2. **type 映射保持现状**：`detail.type` 缺省时 shim 按 `'success'` 处理——直连后同样不传 type（默认 success）。唯一例外是 RegexTester 的 `notifyCopy(ok, s, e)`：当前失败文案也以 success 样式弹出（shim 行为），直连保持 `toastStore.show(ok ? s : e)` 不改样式，是否应改 error 样式留 final review 分诊，不在本阶段擅自变更。
3. **DESIGN.md 令牌改名用「整段重写 + sed 清残」两步**：§Colors 表格语义变化大（accent 从品牌橙变悬停灰），整段手写重写；其余散落处（§5 组件矩阵等 41 处）用两遍 sed 机械替换（先 accent→primary，再 hover→accent，避免链式污染）。
4. **暗色模式按 spec §12 边界交付**：token 双组 + themeStore + 壳层适配已落地；本阶段做浏览器抽查验证「暗色切换可用（至少全局壳层）」，**全工具逐个对比度校验列为后续项**（spec 明确的"后续可选"），PRODUCT.md/DESIGN.md 按此口径声明。
5. **CopyButton `size` 改可选**：Stage 2 final review 确认的 pre-existing 警告（3 页面 `[Vue warn] Missing required prop "size"`），一行修复。

## File Structure

**toast 迁移（13 文件，Task 1/2）：**

| 文件 | 模式 | 助手/调用点 |
|---|---|---|
| `src/tools/encoding/FileToBase64.vue` | 助手 `dispatchToast`（152-155 行） | 1 调用点（129） |
| `src/tools/format/JsonFormatter.vue` | 助手 `notifyToast`（122-125 行） | 9 调用点 |
| `src/tools/format/TomlFormatter.vue` | 助手 `notifyToast`（67-70 行） | 5 调用点 |
| `src/tools/media/ImageScrambler.vue` | 助手 `dispatchToast`（79-82 行） | 3 调用点 |
| `src/tools/media/PhantomTank.vue` | 助手 `dispatchToast`（100-103 行） | 1 调用点（392） |
| `src/components/media/ImageCropper.vue` | 助手 `dispatchToast`（251-256 行） | 2 调用点（163、298） |
| `src/tools/text/WheelPicker.vue` | 助手 `showToast(message)`（33-36 行） | 7 调用点 |
| `src/tools/media/QrCodeGenerator.vue` | 助手 `showToast(type, message)`（115-118 行） | 4 调用点（131/133/149/151），含 error type |
| `src/tools/regex/RegexTester.vue` | 助手 `notifyCopy(ok, s, e)`（481-486 行） | 2 调用点（447/454）；文件头注释第 9 行提 CustomEvent 需同步改 |
| `src/tools/crypto/AsymmetricCrypto.vue` | 直接 dispatchEvent | 2 调用点（243、346） |
| `src/tools/crypto/SM2Crypto.vue` | 直接 dispatchEvent | 1 调用点（126） |
| `src/tools/editor/MarkdownEditor.vue` | 直接 dispatchEvent | 5 调用点（285/287/295/297/306），3 个 error type |
| `src/tools/media/ImageConverter.vue` | 直接 dispatchEvent | 2 调用点（102、111） |

**shim 移除与清理（Task 3）：**
- Modify: `src/components/shell/ToastContainer.vue`（删 legacyBridge + 事件监听 + 更新文档注释）
- Modify: `src/components/shell/__tests__/ToastContainer.test.ts`（删 2 个 shim 测试，加 error 渲染测试）
- Modify: `src/components/ui/CopyButton.vue:9`（`size` → `size?`）

**文档（Task 4）：**
- Modify: `CLAUDE.md`（Tech Stack、Architecture 树、Frontend Architecture、Dependency Rules）
- Modify: `DESIGN.md`（组件库选型、Focus 约束、§Colors 重写、§Elevation Dark Mode、Sidebar Overlay 行、Header 表、OptionRadioGroup 段、全文令牌改名）
- Modify: `PRODUCT.md`（Design Principles 加暗色声明）

**验收（Task 5）：** 无文件改动（ledger 除外），纯验证。

---

## Task 1: toast 直连批次 1（9 个本地助手文件）

**Files:**
- Modify: `src/tools/encoding/FileToBase64.vue`
- Modify: `src/tools/format/JsonFormatter.vue`
- Modify: `src/tools/format/TomlFormatter.vue`
- Modify: `src/tools/media/ImageScrambler.vue`
- Modify: `src/tools/media/PhantomTank.vue`
- Modify: `src/components/media/ImageCropper.vue`
- Modify: `src/tools/text/WheelPicker.vue`
- Modify: `src/tools/media/QrCodeGenerator.vue`
- Modify: `src/tools/regex/RegexTester.vue`

**Interfaces:**
- Consumes: `toastStore.show(message: string, type?: 'success' | 'error', duration?: number): number`、`toastStore.error(message: string): number`（`src/stores/toast.ts`，签名冻结勿改）
- Produces: 9 个文件内零 `dispatchEvent`/`CustomEvent('toast')`；toastStore import 路径：tools 下为 `'../../stores/toast'`，`components/media/` 下同为 `'../../stores/toast'`

**Atomicity note:** 纯机械重构（换投递机制）。验证策略与 Stage 2 Task 8 同类：per-file grep 验收 + 全量测试保绿 + 浏览器实测 toast 真实弹出。无新单测（13 个工具组件均无既有 toast 断言，toastStore 本身已有 `src/stores/__tests__/toast.test.ts` 覆盖队列逻辑）。

**通用变换规则（每文件适用）：**
1. `<script setup>` 顶部 import 区加：`import { toastStore } from '../../stores/toast';`（若文件已有同路径 import 则合并，禁止重复 import）。
2. 删除本地助手函数及其文档注释整段。
3. 调用点替换：`助手名(X)` → `toastStore.show(X)`；带 error type 的 → `toastStore.error(X)`。
4. 文案逐字保留；触发条件、位置不动。

**逐文件要点：**

| 文件 | 特殊处理 |
|---|---|
| FileToBase64.vue | `dispatchToast('结果较大，复制可能耗时，建议优先下载 .txt')` → `toastStore.show(...)`；删 151-155 行助手+注释 |
| JsonFormatter.vue | 删 122-125 行 `notifyToast`（注释含「与 Alpine Toast 系统对接」一并删）；9 处 `notifyToast(X)` → `toastStore.show(X)` |
| TomlFormatter.vue | 删 67-70 行 `notifyToast`；5 处替换 |
| ImageScrambler.vue | 删 79-82 行 `dispatchToast`；3 处替换（162/222/352） |
| PhantomTank.vue | 删 100-103 行 `dispatchToast`；1 处替换（392） |
| ImageCropper.vue | 删 251-256 行 `dispatchToast`（含 `@param` 注释）；2 处替换（163、298） |
| WheelPicker.vue | 删 33-36 行 `showToast`；7 处替换（41/61/74/129/135/138/152） |
| QrCodeGenerator.vue | 删 115-118 行 `showToast(type, message)`；`showToast('success', '已下载 PNG')` → `toastStore.show('已下载 PNG')`；`showToast('error', e instanceof Error ? e.message : '下载失败')` → `toastStore.error(e instanceof Error ? e.message : '下载失败')`（131/133/149/151 共 4 处） |
| RegexTester.vue | 删 481-486 行 `notifyCopy`；2 处 `notifyCopy(ok, s, e)` → `toastStore.show(ok ? s : e)`（**保持 shim 的 success 样式现状，见决策 2**）；文件头注释第 9 行「复制/清空通过 CustomEvent('toast') 反馈」改为「复制/清空通过 toastStore 反馈」 |

- [ ] **Step 1: 基线确认**

Run: `pnpm test 2>&1 | tail -3`
Expected: 1105 passed（Stage 2 终点状态），全绿才动手。

- [ ] **Step 2: 逐文件执行通用变换（9 个文件）**

按上表逐文件修改。每改完一个文件 grep 自验：

Run: `pnpm exec grep -n "dispatchEvent\|CustomEvent" src/tools/encoding/FileToBase64.vue`（逐文件替换路径）
Expected: 零命中。

> implementer 注意：QrCodeGenerator 的 `showToast('success', ...)` 两参数别误改成 `toastStore.show('success', '已下载 PNG')`（参数顺序不同，type 是第二参数）。RegexTester 的 `toastStore.show(ok ? successMsg : errorMsg)` 保留三元，不传 type。

- [ ] **Step 3: 批次 grep 验收**

Run: `pnpm exec grep -rn "dispatchEvent\|CustomEvent" src/tools/encoding/FileToBase64.vue src/tools/format/JsonFormatter.vue src/tools/format/TomlFormatter.vue src/tools/media/ImageScrambler.vue src/tools/media/PhantomTank.vue src/components/media/ImageCropper.vue src/tools/text/WheelPicker.vue src/tools/media/QrCodeGenerator.vue src/tools/regex/RegexTester.vue`
Expected: 零命中。

- [ ] **Step 4: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test 2>&1 | tail -3`
Expected: 0 errors；1105 passed。

- [ ] **Step 5: 浏览器实测（toast 真实弹出，4 条代表路由）**

Run: `pnpm dev`，playwright-cli 逐页验证（每页操作后检查 `.playwright-cli` snapshot 中出现 toast 文本或 `[role=status]`，且 console 0 errors）：
1. `/format/json-formatter`：输入框清空后点「格式化」→ toast「请输入 JSON 数据」；输入 `{"a":1}` 点格式化 → toast「已完成」
2. `/text/wheel-picker`：选项清空后点开始 → toast「请先添加至少 2 个选项」
3. `/media/qr-code-generator`：点「下载 PNG」→ toast「已下载 PNG」
4. `/encoding/file-to-base64`：页面加载 console 0 errors（该文件 toast 需 >5MB 结果触发，不强制触发，验证页面正常即可）

Expected: toast 从顶部出现、文案与迁移前一致、自动消失；console 全部 0 errors。

- [ ] **Step 6: Commit**

```bash
git add src/tools/encoding/FileToBase64.vue src/tools/format/JsonFormatter.vue src/tools/format/TomlFormatter.vue src/tools/media/ImageScrambler.vue src/tools/media/PhantomTank.vue src/components/media/ImageCropper.vue src/tools/text/WheelPicker.vue src/tools/media/QrCodeGenerator.vue src/tools/regex/RegexTester.vue
git commit -m "refactor(tools): 9 个工具 toast 由 CustomEvent 桥接迁移至 toastStore 直连（批次 1）"
```

---

## Task 2: toast 直连批次 2（4 个直接 dispatchEvent 文件）

**Files:**
- Modify: `src/tools/crypto/AsymmetricCrypto.vue`
- Modify: `src/tools/crypto/SM2Crypto.vue`
- Modify: `src/tools/editor/MarkdownEditor.vue`
- Modify: `src/tools/media/ImageConverter.vue`

**Interfaces:**
- Consumes: 同 Task 1（toastStore.show / toastStore.error）
- Produces: 4 个文件内零 `dispatchEvent`

**逐调用点精确替换：**

`src/tools/crypto/AsymmetricCrypto.vue`（import `'../../stores/toast'`）：
- 243 行：`document.dispatchEvent(new CustomEvent('toast', {detail: {message: '密钥对生成成功'}}));` → `toastStore.show('密钥对生成成功');`
- 346 行：`document.dispatchEvent(new CustomEvent('toast', {detail: {message: '签名验证通过'}}));` → `toastStore.show('签名验证通过');`

`src/tools/crypto/SM2Crypto.vue`：
- 126 行：`document.dispatchEvent(new CustomEvent('toast', { detail: { message: '密钥对生成成功' } }));` → `toastStore.show('密钥对生成成功');`

`src/tools/editor/MarkdownEditor.vue`：
- 285 行 → `toastStore.show('已导出 Markdown 文件');`
- 287 行 → `toastStore.error('导出失败，请重试');`
- 295 行 → `toastStore.show('已导出 HTML 文件');`
- 297 行 → `toastStore.error('导出失败，请重试');`
- 306 行 → `toastStore.error('导出失败，请重试');`

`src/tools/media/ImageConverter.vue`：
- 102 行：`document.dispatchEvent(new CustomEvent('toast', { detail: { message: limit.error } }));` → `toastStore.show(limit.error);`
- 111 行 → `toastStore.show('已开始打包下载');`

> ImageConverter 的 `limit.error` 是校验失败文案——shim 现状按 success 样式弹出，保持不传 type（决策 2）。

- [ ] **Step 1: 执行替换**

按上表修改 4 个文件（各自加 `import { toastStore } from '../../stores/toast';`）。

- [ ] **Step 2: grep 验收**

Run: `pnpm exec grep -rn "dispatchEvent\|CustomEvent" src/tools/crypto/AsymmetricCrypto.vue src/tools/crypto/SM2Crypto.vue src/tools/editor/MarkdownEditor.vue src/tools/media/ImageConverter.vue`
Expected: 零命中。

- [ ] **Step 3: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test 2>&1 | tail -3`
Expected: 0 errors；1105 passed。

- [ ] **Step 4: 浏览器实测**

Run: `pnpm dev`，playwright-cli：
1. `/crypto/asymmetric-crypto`：点「生成密钥对」→ toast「密钥对生成成功」
2. `/crypto/sm2-crypto`：点「生成密钥对」→ toast「密钥对生成成功」
3. `/editor/markdown-editor`：导出菜单点「导出 Markdown」→ toast「已导出 Markdown 文件」
Expected: toast 弹出正常，console 0 errors。

- [ ] **Step 5: Commit**

```bash
git add src/tools/crypto/AsymmetricCrypto.vue src/tools/crypto/SM2Crypto.vue src/tools/editor/MarkdownEditor.vue src/tools/media/ImageConverter.vue
git commit -m "refactor(tools): 4 个工具 toast 由 CustomEvent 桥接迁移至 toastStore 直连（批次 2）"
```

---

## Task 3: ToastContainer shim 移除 + CopyButton size 可选化

**Files:**
- Modify: `src/components/shell/ToastContainer.vue`（删 legacyBridge）
- Modify: `src/components/shell/__tests__/ToastContainer.test.ts`（删 shim 测试、加 error 渲染测试）
- Modify: `src/components/ui/CopyButton.vue:9`（size 改可选）

**Interfaces:**
- Consumes: Task 1/2 已清零所有 `CustomEvent('toast')` 生产者——shim 从此无输入，可安全删除
- Produces: `grep -rn "CustomEvent('toast'" src/` 零命中；CopyButton `size?: 'sm' | 'md'`（props 签名变宽不破坏调用方，向后兼容）

- [ ] **Step 1: 改写测试文件（先锁行为）**

Modify `src/components/shell/__tests__/ToastContainer.test.ts` 全文替换为：

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, enableAutoUnmount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ToastContainer from '../ToastContainer.vue';
import { toastStore } from '../../../stores/toast';

// 自动卸载 wrapper，避免跨用例污染
enableAutoUnmount(afterEach);

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

  it('error 类型通知渲染错误样式', async () => {
    toastStore.show('操作失败', 'error');
    const wrapper = mount(ToastContainer);
    await nextTick();
    expect(wrapper.text()).toContain('操作失败');
    expect(wrapper.html()).toContain('border-error/20');
  });
});
```

- [ ] **Step 2: 跑测试确认通过（当前带 shim 也应全过）**

Run: `pnpm test src/components/shell/__tests__/ToastContainer.test.ts`
Expected: PASS（3 tests）。

- [ ] **Step 3: 移除 shim**

Modify `src/components/shell/ToastContainer.vue` 的 `<script setup>`，旧：

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
```

新：

```vue
<script setup lang="ts">
/**
 * Toast 通知容器（全局单岛，client:load）。
 *
 * 渲染 toastStore.items 队列，成功/失败用 lucide 图标 + TransitionGroup 动画。
 * 生产者一律直接调用 toastStore.show()/error()（13 处 CustomEvent 桥接已于阶段 3 清零）。
 */
import { CircleCheck, CircleX } from '@lucide/vue';
import { toastStore } from '../../stores/toast';

const { items } = toastStore;
</script>
```

- [ ] **Step 4: CopyButton size 改可选**

Modify `src/components/ui/CopyButton.vue` 第 5-10 行，旧：

```ts
interface Props {
  /** 要复制的文本 */
  text: string;
  /** 按钮尺寸，默认 md */
  size: 'sm' | 'md';
}
```

新：

```ts
interface Props {
  /** 要复制的文本 */
  text: string;
  /** 按钮尺寸，默认 md */
  size?: 'sm' | 'md';
}
```

- [ ] **Step 5: grep 验收——CustomEvent('toast') 全 src 清零**

Run: `pnpm exec grep -rn "CustomEvent('toast'" src/ ; pnpm exec grep -rn "dispatchEvent" src/`
Expected: 零命中（两条都是）。

- [ ] **Step 6: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test 2>&1 | tail -3`
Expected: 0 errors；**1105 passed**（ToastContainer.test.ts 原为 3 个测试：render + 2 shim；新文件同为 3 个：render + error，总数不变）。若输出不符，停下来核对。

- [ ] **Step 7: 浏览器实测（shim 移除后 toast 仍工作 + CopyButton 警告消失）**

Run: `pnpm dev`，playwright-cli：
1. `/format/json-formatter`：点格式化 → toast 正常弹出（验证 shim 移除后直连链路完整）
2. `/datetime/cron-parser`：console 中**不再出现** `[Vue warn] Missing required prop: "size"`（CopyButton 修复验证）；7 个 tab 切换正常
Expected: toast 正常；两个页面 console 0 errors 0 warnings。

- [ ] **Step 8: Commit**

```bash
git add src/components/shell/ToastContainer.vue src/components/shell/__tests__/ToastContainer.test.ts src/components/ui/CopyButton.vue
git commit -m "refactor(shell): 移除 ToastContainer CustomEvent 兼容 shim；CopyButton size 改可选"
```

---

## Task 4: 文档更新（CLAUDE.md / DESIGN.md / PRODUCT.md）

**Files:**
- Modify: `CLAUDE.md`（4 处）
- Modify: `DESIGN.md`（整段重写 5 处 + 手动行 3 处 + sed 全文改名）
- Modify: `PRODUCT.md`（1 处）

**Interfaces:**
- Consumes: Stage 0-2 全部落地现实（token 语义、reka-ui、模块级 store、暗色交付边界 spec §12）
- Produces: 三份文档与代码现状一致；`grep -in "alpine\|headlessui" CLAUDE.md DESIGN.md` 零命中；DESIGN.md 零旧令牌类名

**Why one task:** 纯文档，无代码行为变化；验证 = grep + 通读。拆成多 task Reviewer 无法独立否决其一。

- [ ] **Step 1: CLAUDE.md — Tech Stack（第 78 行）**

旧：
```markdown
- **UI Components:** @headlessui/vue — 无样式可访问组件（Tab、Switch、Listbox、Disclosure 等），用 Tailwind class 定制外观
```

新：
```markdown
- **UI Components:** reka-ui — 无样式可访问原语（Tabs、Switch、Select、Collapsible、Dialog、DropdownMenu 等），用 Tailwind class 定制外观；shadcn-vue 已初始化（`components.json`，无 `@/` 别名，组件 import 一律相对路径）
```

- [ ] **Step 2: CLAUDE.md — Architecture 树（第 89-96 行）**

旧：
```
├── components/  # 可复用 UI 组件（.vue 交互型 + .astro 纯展示）
│   ├── ui/          # 通用交互组件（ToggleSwitch、SelectListbox 等）
│   └── layout/      # 布局组件（ToolHeader、Breadcrumb、RelatedTools、ResponsiveWorkspace）
├── composables/ # Vue 组合式函数（如 useCopy），供多个工具组件复用
├── data/        # 工具注册表（tools.ts、tool-faqs.ts）
├── utils/       # 工具函数
├── styles/      # 设计令牌（global.css @theme 块）
├── types/       # 全局类型声明（第三方库类型补充，如 alpinejs、des.js）
```

新：
```
├── components/  # 可复用 UI 组件（.vue 交互型 + .astro 纯展示）
│   ├── ui/          # 通用交互组件（ToggleSwitch、SelectListbox 等）
│   ├── layout/      # 布局组件（ToolHeader、Breadcrumb、RelatedTools、ResponsiveWorkspace）
│   └── shell/       # 全局壳层组件（Shell、ToastContainer、FavoriteButton、SearchPanel、FeedbackForm）
├── composables/ # Vue 组合式函数（如 useCopy），供多个工具组件复用
├── stores/      # 模块级 reactive store（toast、sidebar、favorites、search、theme），跨 island 共享单例
├── data/        # 工具注册表（tools.ts、tool-faqs.ts）
├── utils/       # 工具函数
├── styles/      # 设计令牌（global.css：:root/.dark 双组变量 + @theme inline 映射）
├── types/       # 全局类型声明（第三方库类型补充，如 des.js）
```

- [ ] **Step 3: CLAUDE.md — Frontend Architecture（第 105-114 行整节）**

旧：
```markdown
## Frontend Architecture

项目采用**双引擎**架构：

- **Alpine.js** — 负责全局壳层交互（侧边栏开关、Toast 通知、收藏夹面板、搜索过滤、暗色模式切换）。这些逻辑写在 `.astro`
  页面和布局文件中，通过 `x-data` / `x-show` / `@click` 等指令实现。
- **Vue 3** — 负责工具内部的复杂交互（编码转换、JSON 格式化、哈希计算等）。每个工具是一个独立的 Vue 组件，通过 Astro `client:`
  指令按需水合。

**跨框架通信**：Vue 组件通过 `CustomEvent('toast', { detail: { message } })` 触发 Alpine 管理的 Toast 通知系统。不需要引入全局状态库。
```

新：
```markdown
## Frontend Architecture

项目采用 **Vue 单引擎**架构（2026-07 运行时统一重构完成，Alpine.js 已移除）：

- **全局壳层** — `Shell.vue`（唯一 `client:load` 的 island）承载 Header / Sidebar / ToastContainer / 收藏夹 / 搜索 / 暗色切换，
  响应式状态来自 `src/stores/` 的模块级 reactive store（ESM 单例，跨 island 共享）。
- **工具 islands** — 每个工具是独立 Vue 组件（`client:idle` / `client:load` 按需水合），`import` 同一批 store 模块。

**通知通信**：任意组件直接调用 `toastStore.show(message)` / `toastStore.error(message)`。禁止重新引入 `CustomEvent` 字符串桥接；
不引入全局状态库（Pinia 等），模块级 store 已覆盖壳层共享需求。
```

- [ ] **Step 4: CLAUDE.md — Dependency Rules 增补**

在「同类库不重复引入」一条之后追加：

```markdown
- **UI 原语只用 reka-ui**：可访问交互原语（弹层、选项卡、开关等）一律用 reka-ui，禁止重新引入 @headlessui/vue 或其他原语库；壳层共享状态用 `src/stores/` 模块级 store，禁止重新引入 Alpine.js 或全局状态库
```

- [ ] **Step 5: DESIGN.md — §Implementation Rules 组件库选型（第 149-152 行）**

旧：
```markdown
**组件库选型：**
- 优先使用 @headlessui/vue 组件（TabGroup / Switch / Listbox / Disclosure / Dialog / Popover 等），不要手写或引入其他 UI 框架
- `src/components/ui/` 下已有封装组件优先复用：ToggleSwitch、SelectListbox、ModeTabGroup、OptionRadioGroup、CopyButton、ClearButton、ColorInput、CodePanel
- Headless UI 无法覆盖的交互需求，使用 Vue 3 Composition API 自行实现，保持无障碍（ARIA、键盘导航、focus 管理）
```

新：
```markdown
**组件库选型：**
- 可访问交互原语使用 reka-ui（Tabs / Switch / Select / RadioGroup / Collapsible / Dialog / DropdownMenu 等），不要手写或引入其他 UI 框架；shadcn-vue 预制件可按 `components.json`（无 `@/` 别名）`add` 后改相对路径引入
- `src/components/ui/` 下已有封装组件优先复用：ToggleSwitch、SelectListbox、ModeTabGroup、OptionRadioGroup、CopyButton、ClearButton、ColorInput、CodePanel
- reka-ui 无法覆盖的交互需求，使用 Vue 3 Composition API 自行实现，保持无障碍（ARIA、键盘导航、focus 管理）
```

- [ ] **Step 6: DESIGN.md — Focus 样式约束（第 159 行）**

旧：
```markdown
**Focus 样式约束：** `input`、`textarea` 等文本输入元素使用 `focus:outline-none focus:border-accent` 表示焦点状态。其他交互元素（按钮、开关、下拉选择等）使用 `focus:outline-none` 移除默认 outline，通过背景色变化或 Headless UI 的内置 focus 管理处理焦点。不使用 `focus:ring` 或 `focus:border-accent`。
```

新：
```markdown
**Focus 样式约束：** `input`、`textarea` 等文本输入元素使用 `focus:outline-none focus:border-primary` 表示焦点状态。其他交互元素（按钮、开关、下拉选择等）使用 `focus:outline-none` 移除默认 outline，通过背景色变化或 reka-ui 原语的内置 focus 管理处理焦点。不使用 `focus:ring`。
```

> 说明：`focus:border-accent` 在令牌语义重命名后指向悬停灰（错误），代码现状 136 处全部是 `focus:border-primary`（品牌橙），文档对齐现实；末句「不使用 focus:border-accent」删除（现 accent 是合法悬停底色，该禁令已无意义）。

- [ ] **Step 7: DESIGN.md — §Colors 整段重写（第 165-191 行，从 `## 2. Colors` 到 Semantic 表结束）**

旧段整段（含 The Shelf Rule、Neutral 表、Accent 表、Semantic 表）替换为：

```markdown
## 2. Colors

**The Shelf Rule.** 中性色承载 90% 的面。primary（#e8590c）仅出现在交互元素的活跃态：聚焦输入框、活跃标签页、选中筛选、悬停 Logo。稀缺即力量。任一屏幕超过 10% 的橙色即为异常。

**令牌体系（2026-07 重构）：** 设计令牌定义于 `src/styles/global.css`，采用 shadcn 语义的双层结构——`:root` / `.dark` 两组 CSS 变量（语义层）经 `@theme inline` 映射进 Tailwind 命名空间（映射层）。组件只消费语义类名，切换 `<html class="dark">` 即整站换主题。**语义对齐 shadcn 约定：`primary` = 品牌橙（主操作色），`accent` = 悬停/次要底色（灰）**——与重构前的旧命名（accent=橙、hover=灰）相反，引用旧文档时注意。

### Neutral + Primary（浅色 / 暗色双组）

| 语义 | 浅色 | 暗色 | Tailwind Utility | 使用范围 |
|------|------|------|-----------------|---------|
| 页面底色 | #faf9f7 | #161514 | `bg-background` | 所有页面的 `<body>` 底色 |
| 卡片/Header 底 | #ffffff | #1f1e1c | `bg-card` | 卡片、Sidebar、Header、Footer 的背景 |
| 主文字 | #1a1a1a | #f3f1ee | `text-foreground` | 正文、标题、输入内容。从不使用纯黑 |
| 次要文字/禁用 | #6b7280 | #a1a1aa | `text-muted-foreground` | 辅助说明、placeholder、侧栏分组标题、禁用态文字 |
| 次要背景 | #f3f1ee | #2a2826 | `bg-muted` | 需要比卡片浅一阶的填充区 |
| 边框/分割线 | #e5e2dd | #2a2826 | `border-border` | 输入框、卡片、分割线、侧栏右边框 |
| 悬停底色 | #f3f1ee | #2a2826 | `bg-accent` | 按钮、卡片、侧栏项的悬停底色，比 background 深一阶 |
| 强调色（品牌橙） | #e8590c | #f97316 | `text-primary` `bg-primary` `border-primary` | 仅交互元素活跃态。从不作为大面积底色 |

### Semantic

| 语义 | 浅色 | 暗色 | Tailwind Utility | 使用范围 |
|------|------|------|-----------------|---------|
| 错误 | #dc2626 | #ef4444 | `text-error`（兼容别名，指向 destructive） | 仅文字，不做底色 |
| 成功 | #16a34a | #22c55e | `text-success` | 仅文字，不做底色（如复制确认） |
```

- [ ] **Step 8: DESIGN.md — §Elevation Dark Mode 段（第 237 行）**

旧：
```markdown
**Dark Mode: Not Supported.** 当前设计有意只支持暖调浅色主题。warm-ivory 底色是刻意的设计身份标识，不做暗色模式。如未来需要支持，应作为独立项目在 PRODUCT.md 中声明后再启动。
```

新：
```markdown
**Dark Mode: Supported（2026-07 起）。** 暖调浅色仍是默认与设计身份；暗色通过 `.dark` 组 token 实现（见 §Colors），由 Header 的暗色按钮切换（`themeStore`，选择持久化于 localStorage）。全局壳层（Header/Sidebar/Toast/卡片）与所有消费语义 token 的组件自动适配；**不使用 token 而硬编码颜色的组件在暗色下属于缺陷**，应改消费 token。个别工具的暗色对比度深度校验为持续跟进项，发现具体问题进行具体修复。
```

- [ ] **Step 9: DESIGN.md — Sidebar Overlay 行（第 313 行）+ Header 表两行（第 322、324 行）+ OptionRadioGroup 段（第 370 行）**

第 313 行，旧：
```markdown
| Overlay（移动） | `.sidebar-overlay fixed inset-0 bg-black/30 z-[99]`，`top: 57px`；显隐由 Alpine `x-show` 跟随 `sidebar-toggle`/`sidebar-close` 事件（响应式 `show` 变量），点击或 Esc 关闭 |
```
新：
```markdown
| Overlay（移动） | `.sidebar-overlay fixed inset-0 bg-black/30 z-[99]`，`top: 57px`；显隐由 `sidebarStore.isOpen` 驱动（Shell.vue 内 `<Transition>`），点击或 Esc 关闭 |
```

第 322 行，旧：
```markdown
| 汉堡按钮 | `hidden max-lg:flex`，三条 2px 横线，宽 18px，`@click` 触发 `sidebar-toggle` |
```
新：
```markdown
| 汉堡按钮 | `hidden max-lg:flex`，三条 2px 横线，宽 18px，点击调用 `sidebarStore.toggle()` |
```

第 324 行，旧：
```markdown
| 暗色模式按钮 | 同收藏夹按钮样式，当前为 UI 预留（Toast 提示"即将支持"） |
```
新：
```markdown
| 暗色模式按钮 | 同收藏夹按钮样式，点击调用 `themeStore.toggle()` 切换浅色/暗色（持久化于 localStorage） |
```

第 370 行，旧：
```markdown
基于 Headless UI 的单选按钮组组件，用于在一组互斥选项中选择一个（如哈希算法选择、输出格式选择）。
```
新：
```markdown
基于 reka-ui RadioGroup 的单选按钮组组件，用于在一组互斥选项中选择一个（如哈希算法选择、输出格式选择）。
```

- [ ] **Step 10: DESIGN.md — 全文旧令牌类名 sed 清残**

上面的整段重写已覆盖 §Colors，但 §1/§3/§5 等散落 41 处旧类名。依次执行（顺序敏感，禁止调换）：

```bash
# pass 1：旧 accent（品牌橙）→ primary
sed -i 's/bg-accent/bg-primary/g; s/text-accent/text-primary/g; s/border-accent/border-primary/g' DESIGN.md
# pass 2：旧 hover（悬停灰）→ accent
sed -i 's/bg-hover/bg-accent/g' DESIGN.md
# pass 3：其余一对一 rename
sed -i 's/bg-surface/bg-background/g; s/\btext-text\b/text-foreground/g' DESIGN.md
sed -i -E 's/text-muted([^-a-zA-Z])/text-muted-foreground\1/g; s/text-muted$/text-muted-foreground/' DESIGN.md
```

验证（必须零命中）：

```bash
grep -nE "bg-surface|bg-hover|text-text|text-accent|border-accent" DESIGN.md
grep -nE "text-muted([^-a-zA-Z]|$)" DESIGN.md
grep -nE "bg-accent|text-accent|border-accent" DESIGN.md   # 人工核对：这些应全部是「悬停灰 accent」语义，无残留品牌橙语境
```

> 注意第三条的输出需人工通读：pass 2 后 `bg-accent` 合法存在（悬停语义）；确认没有「orange/橙/#e8590c」语境下的 `accent` 字样残留（§Colors 新表除外，那里是有意说明）。

- [ ] **Step 11: PRODUCT.md — Design Principles 加暗色声明**

在 `## Design Principles` 的「值得信赖」一条之后追加：

```markdown
- **主题可切换**：默认暖调浅色主题，支持手动切换暗色模式（token 双组变量驱动，选择持久化于 localStorage）
```

- [ ] **Step 12: 文档验收 grep**

Run:
```bash
grep -in "alpine\|headlessui" CLAUDE.md DESIGN.md PRODUCT.md
grep -n "CustomEvent" CLAUDE.md DESIGN.md
```
Expected: 全部零命中（docs/superpowers/ 下的历史 spec/plan 不在范围）。

- [ ] **Step 13: Commit**

```bash
git add CLAUDE.md DESIGN.md PRODUCT.md
git commit -m "docs: 三份根文档同步 Vue 单引擎 + reka-ui + 双主题 token 现实"
```

---

## Task 5: 暗色抽查 + spec §13 全量验收 + ledger 收尾

**Files:**
- Modify: `.superpowers/sdd/progress.md`（追加 Stage 3 段，gitignored 本地文件）

**Interfaces:**
- Consumes: Task 1-4 全部完成
- Produces: spec §13 逐条验收结论；最终 whole-branch review 的输入材料

- [ ] **Step 1: 暗色模式浏览器抽查**

Run: `pnpm dev`，playwright-cli：
1. 打开 `/`（首页），点 Header 暗色按钮 → `document.documentElement.classList` 含 `dark`；`getComputedStyle(document.body).backgroundColor` 变为暗色值（#161514 = rgb(22,21,20)）；刷新页面暗色保持（localStorage 持久化）
2. 暗色态下打开 `/format/json-formatter`、`/crypto/asymmetric-crypto`、`/text/wheel-picker`：页面不刺眼（卡片/输入/按钮均随 token 翻转）、console 0 errors
3. 切回浅色，确认恢复
Expected: 切换可用、壳层与 token 消费组件正常适配、无 console 错误。发现个别硬编码颜色问题 → 记录 ledger Minor（逐工具深度校验是后续项，不在本阶段修）。

- [ ] **Step 2: spec §13 验收清单逐条执行**

| 验收项 | 命令/方式 | Expected |
|---|---|---|
| alpinejs、@headlessui/vue 从 package.json 移除 | `grep -E "alpinejs|headlessui" package.json` | 零命中 |
| grep 零残留 | `grep -rn "x-data\|x-show\|x-cloak" src/` + `grep -rn '\$store' src/` + `grep -rn "@headlessui/vue" src/` | 全部零命中 |
| pnpm build / astro check / test 全过 | 依次执行 | build 63 页成功；0 errors；全量 passed |
| 工具页 pnpm dev 验证无 SSR 空白 | Task 1-3 已覆盖 13 个改动文件路由 + Stage 1 全路由回归结论 | 引用记录 |
| 暗色模式切换可用（至少全局壳层） | Step 1 | 通过 |
| CLAUDE.md / DESIGN.md / global.css 更新完成 | Task 4 + Stage 0 | 引用记录 |
| 5 个 store 单测通过 | `pnpm test src/stores` | 全过 |

- [ ] **Step 3: 全量构建终验**

Run: `pnpm astro check && pnpm test 2>&1 | tail -3 && pnpm build 2>&1 | tail -3`
Expected: 0 errors；测试全过；build 成功。

- [ ] **Step 4: 更新 ledger**

Modify `.superpowers/sdd/progress.md`，追加「Stage 3」段：5 个 task 的 commit 区间、per-task review 结论、§13 验收清单结果、遗留 Minor（RegexTester notifyCopy 样式问题、暗色逐工具校验后续项）。沿用 Stage 0/1/2 格式。

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-22-runtime-unification-stage3-cleanup.md
git commit -m "docs(plan): 补充阶段 3（toast shim 退役 + 文档 + 验收）实施计划与验收结论"
```

> 说明：ledger（.superpowers/）gitignored 不提交；本 commit 提交的是 plan 文件本身（Stage 2 的 plan 也是后置补提交的，沿用同一模式）。

---

## 阶段 3 出口标准

- [ ] `grep -rn "CustomEvent('toast'" src/` 与 `grep -rn "dispatchEvent" src/` 零命中；ToastContainer 无 legacyBridge
- [ ] 13 个工具/组件文件全部 `toastStore` 直连，toast 浏览器实测弹出正常
- [ ] CopyButton `size?` 可选化，3 个曾告警页面 console 无 `[Vue warn] Missing required prop`
- [ ] `grep -in "alpine\|headlessui" CLAUDE.md DESIGN.md PRODUCT.md` 零命中；DESIGN.md 零旧令牌类名（bg-surface/bg-hover/text-text/text-muted 独立形/旧 accent=橙语境）
- [ ] spec §13 七条验收全过（含暗色切换浏览器实测）
- [ ] `pnpm astro check` / `pnpm test` / `pnpm build` 全过
- [ ] 最终 whole-branch review（Stage 3 区间）完成，无 Critical/Important

## 阶段 3 未覆盖（明确排除 / 后续项）

- **全工具暗色对比度逐个校验**：spec §12 明确的「后续可选」项；本阶段只抽查壳层 + 代表工具。发现的具体问题记 ledger，不就地修复扩散范围
- **RegexTester `notifyCopy` 失败文案的样式**：当前失败也以 success 样式弹出（shim 时代行为），直连保持等价；是否改 `toastStore.error` 样式留 final review / 后续决策
- **shadcn-vue 预制件正式引入**：现阶段共享 ui 组件为 reka-ui 原语 + 手写 Tailwind（与项目风格一致）；未来需要新组件（DatePicker 等）时按 `components.json` `add` + 改相对路径
- **docs/superpowers/ 下的历史 spec/plan 文档**：保留对 Alpine/HeadlessUI 的提及（历史记录，非现行标准）

