# 假数据生成器字段配置区重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将假数据生成器的字段配置区从拥挤的单行内联参数布局，改为 1024px 宽度下的两行布局，并通过本地 Dialog 子组件编辑字段类型与参数。

**Architecture:** 字段行简化为「列名 + 类型标签 + 删除」和「配置生成器按钮」两行；参数编辑全部迁移到基于 @headlessui/vue Dialog 的本地子组件中，该子组件直接消费 `FieldConfig` 和 `FIELD_TYPE_OPTIONS`。

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS v4, @headlessui/vue Dialog, @headlessui/vue Listbox (SelectListbox)

## Global Constraints

- 使用项目现有组件：`SelectListbox`, `ToolHeader`, `OptionRadioGroup`, `CopyButton`
- 禁止引入额外 UI 框架
- 输入框 focus 样式：`focus:outline-none focus:border-accent`
- 按钮 transition 使用具体属性，如 `transition-[background-color,border-color] duration-150`
- 不修改 `src/utils/text/fake-data.ts`
- 不新增公共 UI 组件文件

---

## File Structure

| 文件 | 职责 | 变更方式 |
|------|------|----------|
| `src/tools/text/FakeDataGenerator.vue` | 字段配置区布局、字段行两行展示、本地 Dialog 子组件、数据流绑定 | 修改 |
| `src/utils/text/fake-data.ts` | 字段类型元数据与生成逻辑 | 不修改 |

---

### Task 1: 调整外层容器宽度

**Files:**
- Modify: `src/tools/text/FakeDataGenerator.vue:125`

**Interfaces:**
- Consumes: 无
- Produces: 页面外层容器 class 从 `max-w-[720px]` 变为 `max-w-5xl mx-auto w-full`

- [ ] **Step 1: 修改最外层容器宽度**

将根容器从：

```vue
<div class="max-w-[720px]">
```

改为：

```vue
<div class="max-w-5xl mx-auto w-full">
```

- [ ] **Step 2: 启动开发服务器验证页面仍正常加载**

Run: `pnpm dev`
Expected: 页面 `/text/fake-data-generator` 可访问，布局宽度已变宽。

- [ ] **Step 3: Commit**

```bash
git add src/tools/text/FakeDataGenerator.vue
git commit -m "feat(fake-data): 页面宽度放大到 1024px

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 重构字段行为两行布局

**Files:**
- Modify: `src/tools/text/FakeDataGenerator.vue:159-217`

**Interfaces:**
- Consumes: `fields: FieldConfig[]`, `removeField(rowId: string)`
- Produces: 新的字段行 HTML 结构，第一行为列名+类型标签+删除，第二行为「配置生成器」按钮

- [ ] **Step 1: 移除行内参数表单，改为两行结构**

将字段列表中的：

```vue
<div class="divide-y divide-border">
  <div v-for="field in fields" :key="field.rowId" class="px-3 py-2.5">
    <!-- 第一行：列名 + 类型 + 删除 -->
    <div class="flex items-center gap-2">
      <input
        v-model="field.name"
        type="text"
        class="px-2 py-1 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150 w-[140px]"
        placeholder="列名"
        aria-label="列名"
      />
      <div class="flex-1 min-w-[120px]">
        <SelectListbox
          :model-value="field.type"
          :options="typeOptions"
          @update:model-value="(v) => onTypeChange(field, v as FieldType)"
        />
      </div>
      <button
        type="button"
        class="flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-card text-muted cursor-pointer hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
        title="删除字段"
        aria-label="删除字段"
        @click="removeField(field.rowId)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <!-- 第二行：参数（仅有参数时渲染） -->
    <div
      v-if="paramDefs(field).length"
      class="flex items-center flex-wrap gap-x-4 gap-y-2 pl-1 pt-2.5"
    >
      <label
        v-for="def in paramDefs(field)"
        :key="def.key"
        class="flex items-center gap-1 text-[0.75rem] text-muted"
      >
        {{ def.label }}
        <div v-if="def.type === 'select'" class="w-[96px]">
          <SelectListbox
            :model-value="String(field.params[def.key])"
            :options="def.options ?? []"
            @update:model-value="(v) => (field.params[def.key] = v)"
          />
        </div>
        <input
          v-else
          v-model="field.params[def.key]"
          :type="def.type"
          class="px-2 py-1 border border-border rounded-sm bg-background text-text text-[0.75rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150 w-[72px]"
        />
      </label>
    </div>
  </div>
</div>
```

替换为：

```vue
<div class="divide-y divide-border">
  <div v-for="field in fields" :key="field.rowId" class="px-4 py-3">
    <!-- 第一行：列名 + 类型标签 + 删除 -->
    <div class="flex items-center gap-3">
      <input
        v-model="field.name"
        type="text"
        class="flex-1 min-w-[160px] px-3 py-1.5 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150"
        placeholder="列名"
        aria-label="列名"
      />
      <span class="shrink-0 px-2 py-0.5 bg-hover text-text border border-border rounded-sm text-[0.8125rem]">
        {{ (FIELD_TYPE_OPTIONS.find((m) => m.value === field.type) as FieldTypeMeta).label }}
      </span>
      <button
        type="button"
        class="shrink-0 flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-card text-muted cursor-pointer hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
        title="删除字段"
        aria-label="删除字段"
        @click="removeField(field.rowId)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <!-- 第二行：配置生成器 -->
    <div class="flex items-center gap-2 mt-2">
      <button
        type="button"
        class="px-3 py-1 border border-border rounded-sm bg-surface text-muted text-[0.8125rem] cursor-pointer hover:bg-hover hover:text-text hover:border-accent transition-[background-color,border-color,color] duration-150"
        @click="openFieldDialog(field)"
      >
        配置生成器
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 移除不再需要的响应式辅助**

在 `<script setup>` 中，删除 `onTypeChange` 函数中只用于行内参数表单的部分（后续 Task 4 在 Dialog 中重新实现类型切换重置参数的逻辑）。暂时保留 `onTypeChange` 函数本身，但内部只重置 `field.type` 和 `field.params`。

```ts
/** 修改某字段类型时重置其参数为该类型默认值。 */
function onTypeChange(field: FieldConfig, type: FieldType): void {
  field.type = type;
  const meta = FIELD_TYPE_OPTIONS.find((m) => m.value === type) as FieldTypeMeta;
  const params: Record<string, string | number> = {};
  for (const p of meta.params) params[p.key] = p.default;
  field.params = params;
}
```

删除 `paramDefs` 函数（行内参数表单已移除，Dialog 中会重新计算）。

- [ ] **Step 3: 在 `<script setup>` 顶部导入 `FIELD_TYPE_OPTIONS` 和 `FieldTypeMeta`**

确认现有导入包含：

```ts
import {
  FIELD_TYPE_OPTIONS,
  QUICK_PRESETS,
  generateRecords,
  toJson,
  toCsv,
  validateFields,
  type FieldConfig,
  type FieldType,
  type FieldTypeMeta,
} from '../../utils/text/fake-data';
```

- [ ] **Step 4: 启动开发服务器验证字段行布局**

Run: `pnpm dev`
Expected: 字段列表显示为两行，不再显示参数输入框，每个字段下方有「配置生成器」按钮。

- [ ] **Step 5: Commit**

```bash
git add src/tools/text/FakeDataGenerator.vue
git commit -m "feat(fake-data): 字段行改为两行布局

- 第一行：列名 + 类型标签 + 删除
- 第二行：配置生成器按钮
- 移除行内参数表单

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 准备 Dialog 状态与辅助函数

**Files:**
- Modify: `src/tools/text/FakeDataGenerator.vue`

**Interfaces:**
- Consumes: `FieldConfig`, `FieldType`, `FieldTypeMeta`, `FIELD_TYPE_OPTIONS`
- Produces: `dialogOpen`, `editingField`, `openFieldDialog`, `saveFieldConfig`, `onDialogTypeChange`, `dialogParamDefs`

- [ ] **Step 1: 导入 @headlessui/vue Dialog 相关组件**

在 `<script setup>` 顶部添加：

```ts
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
```

- [ ] **Step 2: 添加 Dialog 状态与辅助函数**

在 `const { copy } = useCopy();` 之后添加：

```ts
/** Dialog 开关状态。 */
const dialogOpen = ref(false);
/** 当前正在编辑的字段配置副本。 */
const editingField = ref<FieldConfig>(makeField('name'));

/** 打开字段配置 Dialog，复制当前字段到编辑副本。 */
function openFieldDialog(field: FieldConfig): void {
  editingField.value = {
    rowId: field.rowId,
    name: field.name,
    type: field.type,
    params: { ...field.params },
  };
  dialogOpen.value = true;
}

/** 保存 Dialog 中的字段配置，更新 fields 数组对应项。 */
function saveFieldConfig(): void {
  const updated = editingField.value;
  const idx = fields.value.findIndex((f) => f.rowId === updated.rowId);
  if (idx === -1) return;
  fields.value[idx] = { ...updated };
  dialogOpen.value = false;
}

/** Dialog 中切换类型时重置参数默认值。 */
function onDialogTypeChange(type: FieldType): void {
  editingField.value.type = type;
  const meta = FIELD_TYPE_OPTIONS.find((m) => m.value === type) as FieldTypeMeta;
  const params: Record<string, string | number> = {};
  for (const p of meta.params) params[p.key] = p.default;
  editingField.value.params = params;
}

/** Dialog 中当前类型的参数元数据。 */
const dialogParamDefs = computed<FieldTypeMeta['params']>(() => {
  return (FIELD_TYPE_OPTIONS.find((m) => m.value === editingField.value.type) as FieldTypeMeta).params;
});
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/text/FakeDataGenerator.vue
git commit -m "feat(fake-data): 添加字段配置 Dialog 状态与辅助函数

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 实现 Dialog 模板

**Files:**
- Modify: `src/tools/text/FakeDataGenerator.vue`

**Interfaces:**
- Consumes: `dialogOpen`, `editingField`, `saveFieldConfig`, `onDialogTypeChange`, `dialogParamDefs`, `typeOptions`, `SelectListbox`, `Dialog` 组件
- Produces: 可渲染的 Dialog 模板，包含列名、类型选择、参数表单、保存/取消按钮

- [ ] **Step 1: 在父组件模板中内联 Dialog**

Dialog 直接在 `FakeDataGenerator.vue` 的 `<template>` 中实现，不使用独立子组件。在字段配置区之后（`</div>` 结束标签前），添加：

```vue
<TransitionRoot appear :show="dialogOpen" as="template">
  <Dialog as="div" class="relative z-50" @close="dialogOpen = false">
    <TransitionChild
      as="template"
      enter="ease-out duration-150"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in duration-150"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div class="fixed inset-0 bg-black/20" aria-hidden="true" />
    </TransitionChild>

    <div class="fixed inset-0 overflow-y-auto">
      <div class="flex min-h-full items-center justify-center p-4">
        <TransitionChild
          as="template"
          enter="ease-out duration-150"
          enter-from="opacity-0 scale-95"
          enter-to="opacity-100 scale-100"
          leave="ease-in duration-150"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel class="w-full max-w-md rounded-md bg-card border border-border p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <DialogTitle class="text-base font-semibold text-text">
              编辑「{{ editingField.name }}」生成器
            </DialogTitle>

            <div class="mt-4 space-y-4">
              <!-- 列名 -->
              <div>
                <label class="block text-[0.8125rem] text-muted mb-1">列名</label>
                <input
                  v-model="editingField.name"
                  type="text"
                  class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150"
                />
              </div>

              <!-- 类型 -->
              <div>
                <label class="block text-[0.8125rem] text-muted mb-1">生成器类型</label>
                <SelectListbox
                  :model-value="editingField.type"
                  :options="typeOptions"
                  @update:model-value="(v) => onDialogTypeChange(v as FieldType)"
                />
              </div>

              <!-- 参数 -->
              <div v-if="dialogParamDefs.length" class="space-y-3">
                <label class="block text-[0.8125rem] text-muted">参数</label>
                <div
                  v-for="def in dialogParamDefs"
                  :key="def.key"
                  class="flex items-center gap-3"
                >
                  <span class="text-[0.8125rem] text-muted w-16 shrink-0">{{ def.label }}</span>
                  <div v-if="def.type === 'select'" class="flex-1">
                    <SelectListbox
                      :model-value="String(editingField.params[def.key])"
                      :options="def.options ?? []"
                      @update:model-value="(v) => (editingField.params[def.key] = v)"
                    />
                  </div>
                  <input
                    v-else
                    v-model="editingField.params[def.key]"
                    :type="def.type"
                    class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-text text-[0.8125rem] font-mono outline-none focus:border-accent transition-[border-color] duration-150"
                  />
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-end gap-2">
              <button
                type="button"
                class="px-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
                @click="dialogOpen = false"
              >
                取消
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90 transition-[opacity] duration-150"
                @click="saveFieldConfig"
              >
                保存
              </button>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </div>
  </Dialog>
</TransitionRoot>
```

- [ ] **Step 2: 启动开发服务器验证 Dialog**

Run: `pnpm dev`
Expected:
1. 点击「配置生成器」按钮弹出 Dialog。
2. Dialog 中显示当前列名、类型和参数。
3. 修改类型后参数自动重置。
4. 修改参数后点击保存，字段列表的类型标签和生成结果同步更新。
5. 点击取消，字段列表不变。

- [ ] **Step 3: Commit**

```bash
git add src/tools/text/FakeDataGenerator.vue
git commit -m "feat(fake-data): 实现字段配置 Dialog UI

- 使用 @headlessui/vue Dialog
- 支持编辑列名、类型、参数
- 类型切换时自动重置参数

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 清理旧代码与最终验证

**Files:**
- Modify: `src/tools/text/FakeDataGenerator.vue`

**Interfaces:**
- Consumes: 修改后的字段配置区、Dialog、校验/生成逻辑
- Produces: 无冗余代码、构建通过、UI 符合设计

- [ ] **Step 1: 移除不再使用的函数和导入**

确认并删除以下内容（如果仍存在）：

- `onTypeChange` 函数（字段行已不需要类型下拉）
- `paramDefs` 函数（行内参数表单已移除）
- `typeOptions` 如果只在 Dialog 中使用，保留；如果 `SelectListbox` 在字段行中已不需要，确保只在 Dialog 模板中使用

保留：
- `FIELD_TYPE_OPTIONS` 的导入（类型标签和 Dialog 都需要）
- `FieldTypeMeta` 类型导入（Dialog 参数计算需要）

- [ ] **Step 2: 检查 Dialog 打开时是否存在 v-model 绑定问题**

确保 `<TransitionRoot :show="dialogOpen">` 与 `@close="dialogOpen = false"` 能正确关闭 Dialog。

- [ ] **Step 3: 运行构建验证**

Run: `pnpm build`
Expected: 构建成功，无 TypeScript 类型错误。

- [ ] **Step 4: 端到端手动验证**

1. 打开 `/text/fake-data-generator`
2. 确认默认字段 `id/name/email` 显示为两行
3. 点击 `name` 的「配置生成器」
4. 类型改为 `邮箱`，参数显示「域名」
5. 保存，字段列表类型标签变为 `邮箱`
6. 点击生成，输出中包含邮箱格式数据
7. 点击 `id` 的「配置生成器」，类型改为 `UUID`（无参数）
8. 保存，字段列表类型标签变为 `UUID`
9. 点击生成，输出中为 UUID 字符串
10. 调整浏览器宽度到 <768px，确认字段行不溢出

- [ ] **Step 5: Commit**

```bash
git add src/tools/text/FakeDataGenerator.vue
git commit -m "refactor(fake-data): 清理字段配置旧代码并验证

- 移除行内参数表单相关函数
- 移除字段行类型下拉逻辑
- 构建与响应式验证通过

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

### 1. Spec Coverage

| 设计文档要求 | 对应任务 |
|-------------|----------|
| 宽度改为 max-w-5xl | Task 1 |
| 字段行两行布局 | Task 2 |
| 类型标签常驻 | Task 2 |
| 配置生成器按钮打开 Dialog | Task 2 / Task 3 |
| Dialog 编辑列名/类型/参数 | Task 4 |
| 类型切换重置参数 | Task 4 |
| 不修改 fake-data.ts | 所有任务 |
| 不新增公共组件 | 所有任务 |
| 响应式适配 | Task 2 / Task 5 |

无遗漏。

### 2. Placeholder Scan

检查计划中无以下模式：
- [x] 无 TBD / TODO
- [x] 无 "add appropriate error handling" 等模糊描述
- [x] 每个代码步骤包含实际代码
- [x] 每个验证步骤包含具体命令和期望结果

### 3. Type Consistency

- `FieldConfig` / `FieldType` / `FieldTypeMeta` 类型来自 `src/utils/text/fake-data.ts`，与设计文档一致。
- `dialogOpen: ref<boolean>`
- `editingField: ref<FieldConfig>`
- `saveFieldConfig(): void`
- `onDialogTypeChange(type: FieldType): void`

一致。

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-19-fake-data-field-config-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
