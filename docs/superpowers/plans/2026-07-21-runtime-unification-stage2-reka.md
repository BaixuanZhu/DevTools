# 运行时统一重构 · 阶段 2：UI 原语替换（Headless UI → Reka / shadcn-vue）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 8 个文件里的 `@headlessui/vue` 原语（4 共享 ui 组件 + 4 工具内部直用）逐组件替换为 `reka-ui` 原语，公共 API（props/emits）**零变化**，最终从 `package.json` 移除 `@headlessui/vue`，全项目 grep 零残留。

**Architecture:** Reka UI 与 Headless UI 同为 unstyled composable/slot 模式，但 API 有三处系统性差异——(1) HeadlessUI 的 `as="template"` → Reka 的 `as-child`；(2) HeadlessUI Tab 是 **index** 制（`selected-index`/`@change`），Reka Tabs 是 **value** 制（`v-model` 字符串值），后者反而更贴合现有 `ModeTabGroup`/`CronParser` 的 string-key 模型；(3) HeadlessUI 的 `ui-active:`/`ui-selected:` Tailwind 变体在本项目未注册（确认无 `@custom-variant`），是死类名，迁到 Reka 的 `data-[highlighted]`/`data-[state=checked]` 后**反而修复**了 SelectListbox 的选中/高亮样式。4 个共享 ui 组件先换（27 个调用方零改动即受益），4 个工具内部直用后换（FakeDataGenerator 放最后，因其内部消费 SelectListbox/OptionRadioGroup，须待共享件先迁完）。

**Tech Stack:** Astro 6 · Vue 3.5 · reka-ui `^2.10.1`（阶段 0 已装）· tw-animate-css（阶段 0 已装，Dialog 动画用）· Tailwind CSS v4 · Vitest 4（node 环境 + 组件测试用 happy-dom）· @vue/test-utils

**Spec:** `docs/superpowers/specs/2026-07-21-runtime-unification-design.md`（§7 UI 原语替换表、§8 阶段划分、§13 验收标准）

**分支：** `refactor/runtime-unification`（阶段 1 完成于 `02a87a9`，本计划从 `02a87a9` 继续）

---

## Global Constraints

（每个任务的隐含前提，源自 spec、阶段 0/1 成果与项目约定）

- **不引入路径别名**：无 `@/`，所有 import 用相对路径（spec §8 决策）。Reka 从 `reka-ui` 顶层 barrel 导入（如 `import { SwitchRoot } from 'reka-ui'`），不涉及别名
- **共享 ui 公共 API 冻结（最高优先级）**：`ToggleSwitch`/`SelectListbox`/`ModeTabGroup`/`OptionRadioGroup` 的 props（`modelValue`/`options`/`label`/...）与 emits（`update:modelValue`）**签名不可变**——它们被 27 个文件、106 处消费。本阶段只换组件**内部**实现，外部契约不动一个字符
- **store 不动**：阶段 0/1 的 5 个 store 签名冻结，本阶段不涉及 store
- **SSR/水合陷阱（最高优先级风险）**：涉及 UI 变更必须 `pnpm dev` 浏览器实测——build/类型/单测全过 ≠ 运行时正确（记忆 `astro-ssg-tolerates-vue-ssr-errors`）。Reka 的 portal 类组件（Select/Dialog/DropdownMenu 的 Content）在**关闭态**不渲染，SSR 只输出 trigger，无水合 mismatch；打开态 Content 经 Teleport 到 body，属客户端行为，SSR 无关。仍须每组件浏览器实测确认
- **Tailwind v4**：优先标准类名；CSS 变量宽度（如 Select 内容对齐触发器宽度）用任意值 `min-w-[var(--reka-select-trigger-width)]`（项目 Styling Conventions 允许的「特殊值」例外）
- **注释**：新增/修改公共组件必须写文档注释（CLAUDE.md 注释规则）
- **Reka 组件名规范**：模板里用 kebab-case prop（`as-child`、`force-mount`、`model-value`、`update:model-value`），JS 里用 camelCase（`asChild`、`forceMount`）。Reka 原语一律从 `'reka-ui'` barrel 导入
- **测试位置**：共享 ui 组件测试 `src/components/ui/__tests__/`，工具组件测试 `src/tools/<category>/__tests__/`，文件首行 `// @vitest-environment happy-dom` pragma（不改全局 `environment: 'node'`）。portal 类测试（Select/DropdownMenu/Dialog）须 `attachTo: document.body`
- **每 task 浏览器实测**：结束前 `pnpm dev` 打开对应页面，确认无空白/无水合错误/交互正常，再 commit
- **环境**：Node >=22.12，pnpm；bash 里 grep 含 `$` 的模式用**单引号**（记忆 `runtime-unification-refactor` 踩坑）；SM4-CBC 是已知 flaky，单独重跑

## 关键架构决策（implementer 必读）

1. **as-child 替代 as="template"**：HeadlessUI 用 `<Tab as="template" v-slot="{selected}"><button/></Tab>` 把行为合并到自定义元素；Reka 用 `<TabsTrigger as-child :value><button type="button">...</button></TabsTrigger>`，Reka 把 `role`/`aria-*`/`data-state`/点击处理合并到子 button。**所有自定义 button 渲染的 Reka 触发器/选项都加 `as-child`**。
2. **data-state 取代 slot prop + ui-* 变体**：HeadlessUI 给 `v-slot="{checked/selected/active}"`，Reka 改为在合并的子元素上设 `data-state="checked|unchecked"`（Switch/Radio）、`data-state="active|inactive"`（Tabs）、`data-[highlighted]`（键盘焦点）。样式从 JS 三元 / `ui-*:` 类迁到 Tailwind `data-[state=checked]:...` / `data-[highlighted]:...` 变体。
3. **Tabs value 制**：HeadlessUI `<TabGroup :selected-index @change>`（index）；Reka `<TabsRoot :model-value @update:model-value>`（字符串值）。`ModeTabGroup` 与 `CronParser` 现有 `v-model` 本就是 string key，**直接传值，删掉 index↔key 转换**，逻辑更简单。
4. **TabsContent 用 force-mount + 隐藏保留 HeadlessUI 行为**：HeadlessUI 的 `TabPanel` 把所有面板挂载在 DOM（非选中加 `hidden`）。Reka `TabsContent` 默认**仅渲染激活面板**。为零行为回归，所有 TabsContent 加 `force-mount` + `class="data-[state=inactive]:hidden"`，复刻「全部挂载、非选中隐藏」。SSR 确定性：`activeValue` 是 `props.modelValue` 的纯函数，SSR 与客户端一致 → 无水合 mismatch（但须浏览器实测 6 个 ModeTabGroup 消费方确认）。
5. **Collapsible 保留手写 transition**：HeadlessUI `Disclosure` + Vue `<transition>` 的滑入动画须保留。Reka 方案：`<CollapsibleRoot v-model:open="open">` + `<CollapsibleTrigger as-child>`（免费 `aria-expanded`）+ `<transition>` 包 `<CollapsibleContent force-mount v-if="open">`。`force-mount` 让 Reka 不自行卸载，Vue `v-if` 驱动 enter/leave，`CollapsibleContent` 提供 `role=region` + `aria-labelledby` 的 a11y 对等。
6. **Dialog 用 tw-animate CSS 动画**：FakeDataGenerator 原 HeadlessUI `TransitionRoot`+`TransitionChild` 编排 overlay/content 动画。Reka 方案：`DialogRoot v-model:open` + `DialogPortal` > `DialogOverlay` + `DialogContent`，动画用 `data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0/zoom-in-95 ...`（tw-animate-css，阶段 0 已 `@import`）。删除 HeadlessUI 的 TransitionRoot/Child。`DialogContent` 加 `:aria-describedby="undefined"` 静默 Reka「缺 DialogDescription」控制台告警。
7. **Select 修死类名**：SelectListbox 现有 `ui-active:`/`ui-selected:` 在 Tailwind v4 未注册（无 `@custom-variant`），是**无效死类名**——选中/高亮样式当前实际不生效。迁 Reka 后用 `data-[highlighted]:bg-accent` / `data-[state=checked]:text-primary` 真正生效，`SelectItemIndicator` 只在选中时渲染对勾。这是**修复**非回归，浏览器实测应看到选中项变橙 + 对勾。
8. **任务顺序的依赖**：FakeDataGenerator 内部 Dialog 里用了 `SelectListbox`（Task 3）与 `OptionRadioGroup`（Task 1），故须**先迁共享件**再迁它。CronParser/MarkdownEditor/TextToolbox 各自独立，但统一放工具阶段。Task 8（移除依赖）放最后，须等 8 处全迁完。

## Reka 原语映射速查（implementer 对照用）

| Headless UI | → Reka UI（本计划用） | 关键差异 |
|---|---|---|
| `Switch`（`model-value`/`update:model-value`，自带 thumb slot） | `SwitchRoot` + `SwitchThumb` | Reka `SwitchRoot` 同样 `modelValue`/`update:modelValue`（v2.10.1 已核），thumb 单独子组件 |
| `RadioGroup` + `RadioGroupOption v-slot={checked} as=template` | `RadioGroupRoot` + `RadioGroupItem as-child :value` | 选中态走 `data-[state=checked]`，不再有 `checked` slot prop |
| `TabGroup :selected-index @change` + `Tab v-slot={selected} as=template` + `TabPanels`/`TabPanel` | `TabsRoot :model-value @update:model-value` + `TabsList` + `TabsTrigger as-child :value` + `TabsContent :value force-mount` | index→value；value 制更贴合现有 string key |
| `Listbox`/`ListboxButton`/`ListboxOptions`/`ListboxOption` + `ui-active`/`ui-selected` | `SelectRoot v-model` + `SelectTrigger` + `SelectPortal` > `SelectContent position=popper` > `SelectViewport` > `SelectItem :value` + `SelectItemIndicator` | portal 化；选中/高亮走 `data-[state=checked]`/`data-[highlighted]` |
| `Disclosure`/`DisclosureButton`/`DisclosurePanel` | `CollapsibleRoot v-model:open` + `CollapsibleTrigger as-child` + `CollapsibleContent force-mount` | open 走 `v-model:open` |
| `Menu`/`MenuButton`/`MenuItems`/`MenuItem v-slot={active}` | `DropdownMenuRoot` + `DropdownMenuTrigger as-child` + `DropdownMenuPortal` > `DropdownMenuContent align=end` + `DropdownMenuItem as-child` | 高亮走 `data-[highlighted]` |
| `Dialog`/`DialogPanel`/`DialogTitle` + `TransitionRoot`/`TransitionChild` | `DialogRoot v-model:open` + `DialogPortal` > `DialogOverlay` + `DialogContent` + `DialogTitle` | 动画改 tw-animate CSS 类 |

---

## File Structure

| 文件 | 职责 | 任务 |
|---|---|---|
| `src/components/ui/ToggleSwitch.vue` | Switch → SwitchRoot/SwitchThumb（公共 API 不变） | Task 1 |
| `src/components/ui/__tests__/ToggleSwitch.test.ts` | v-model 转发 + role=switch + 标签/状态渲染 | Task 1 |
| `src/components/ui/OptionRadioGroup.vue` | RadioGroup → RadioGroupRoot/RadioGroupItem as-child（公共 API 不变） | Task 1 |
| `src/components/ui/__tests__/OptionRadioGroup.test.ts` | v-model 转发（string + number 泛型）+ 选项渲染 + 选中态 class | Task 1 |
| `src/components/ui/ModeTabGroup.vue` | Tab → TabsRoot/TabsList/TabsTrigger/TabsContent force-mount（公共 API 不变） | Task 2 |
| `src/components/ui/__tests__/ModeTabGroup.test.ts` | v-model 转发（string key）+ 具名 slot + 非选中隐藏 + 回落首项 | Task 2 |
| `src/components/ui/SelectListbox.vue` | Listbox → SelectRoot/.../SelectItem（公共 API 不变；修复 ui-* 死类名） | Task 3 |
| `src/components/ui/__tests__/SelectListbox.test.ts` | label + 选中 label + v-model 转发 + 打开后内容/对勾/高亮 | Task 3 |
| `src/tools/text/TextToolbox.vue` | Disclosure → Collapsible（保留手写 transition） | Task 4 |
| `src/tools/text/__tests__/TextToolbox.test.ts` | 查找替换面板展开/收起 | Task 4 |
| `src/tools/datetime/CronParser.vue` | Tab → Tabs value 制（删 index 转换） | Task 5 |
| `src/tools/datetime/__tests__/CronParser.test.ts` | 冒烟：挂载 + 7 字段 tab 渲染 | Task 5 |
| `src/tools/editor/MarkdownEditor.vue` | Menu → DropdownMenu | Task 6 |
| `src/tools/editor/__tests__/MarkdownEditor.test.ts` | 导出触发器 + 打开后 3 项出现 | Task 6 |
| `src/tools/text/FakeDataGenerator.vue` | Dialog → DialogRoot + tw-animate（消费 Task 1/3 的共享件） | Task 7 |
| `src/tools/text/__tests__/FakeDataGenerator.test.ts` | 打开字段 Dialog → DialogTitle 出现 | Task 7 |
| `package.json` | 移除 `@headlessui/vue` | Task 8 |
| `src/components/ui/Button.vue` | 删除（Stage 0 验证件，grep 确认零引用） | Task 8 |

---

## Task 1: ToggleSwitch + OptionRadioGroup（Switch / RadioGroup）

**Files:**
- Modify: `src/components/ui/ToggleSwitch.vue`（整文件重写内部）
- Modify: `src/components/ui/OptionRadioGroup.vue`（整文件重写内部）
- Create: `src/components/ui/__tests__/ToggleSwitch.test.ts`
- Create: `src/components/ui/__tests__/OptionRadioGroup.test.ts`

**Interfaces:**
- Produces（公共 API 冻结，调用方零改动）:
  - `ToggleSwitch` props `{ modelValue: boolean; label?: string; description?: string; showStatus?: boolean }` + emit `update:modelValue: [boolean]`
  - `OptionRadioGroup` props（泛型 `T extends string|number`）`{ modelValue: T; options: RadioOption<T>[]; label?: string; inlineLabel?: boolean }` + emit `update:modelValue: [T]`，`RadioOption<T> = { value: T; label: string }`

**Why this task is first:** 两个最简单的按钮型原语（Switch/RadioGroup），无 portal、无动画，是 Reka 在本 Astro 项目可用的 **go/no-go 节点**。一次过则后续 Tabs/Select/Dialog 风险递增。

- [ ] **Step 1: 写 ToggleSwitch 失败测试**

Create `src/components/ui/__tests__/ToggleSwitch.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ToggleSwitch from '../ToggleSwitch.vue';

describe('ToggleSwitch.vue', () => {
  it('渲染 label 与状态文字，root 为 role=switch', () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: '自动', description: '关' },
    });
    expect(wrapper.get('[role="switch"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('自动');
    expect(wrapper.text()).toContain('关');
  });

  it('点击切换 → emit update:modelValue 为 true', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false } });
    await wrapper.get('[role="switch"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
  });

  it('modelValue=true 时 thumb 带 translate-x-4', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: true } });
    expect(wrapper.get('[role="switch"]').html()).toContain('translate-x-4');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/ui/__tests__/ToggleSwitch.test.ts`
Expected: FAIL（当前 ToggleSwitch 用 HeadlessUI `Switch`，root 无 `role="switch"` attribute on a queryable element — 失败于断言；或因后续重写前的中间态）。先确认测试能跑、断言方向正确即可。

- [ ] **Step 3: 重写 ToggleSwitch.vue**

Replace `src/components/ui/ToggleSwitch.vue` 整文件为:

```vue
<script setup lang="ts">
/**
 * 开关切换组件（共享 ui，27 个调用方公共 API 冻结）。
 *
 * 底层由 @headlessui/vue Switch 迁移至 reka-ui SwitchRoot/SwitchThumb。
 * 行为/外观/props/emits 与迁移前一致：modelValue 双向绑定、可选 label 与状态文字。
 */
import { SwitchRoot, SwitchThumb } from 'reka-ui';

withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    description?: string;
    /** 是否在开关右侧显示状态文字（description 或「已开启/已关闭」），默认 true */
    showStatus?: boolean;
  }>(),
  { label: undefined, description: undefined, showStatus: true },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted-foreground min-w-18 shrink-0">{{ label }}</span>
    <SwitchRoot
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-[background-color] duration-150',
        'focus:outline-none',
        modelValue ? 'bg-primary' : 'bg-border',
      ]"
    >
      <SwitchThumb
        :class="[
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          modelValue ? 'translate-x-4' : 'translate-x-0',
        ]"
      />
    </SwitchRoot>
    <span v-if="showStatus" class="text-[0.8125rem] text-muted-foreground">{{ description ?? (modelValue ? '已开启' : '已关闭') }}</span>
  </div>
</template>
```

- [ ] **Step 4: 跑 ToggleSwitch 测试确认通过**

Run: `pnpm test src/components/ui/__tests__/ToggleSwitch.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: 写 OptionRadioGroup 失败测试**

Create `src/components/ui/__tests__/OptionRadioGroup.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import OptionRadioGroup from '../OptionRadioGroup.vue';

describe('OptionRadioGroup.vue', () => {
  it('渲染全部选项，选中项 role=radio + aria-checked=true + data-state=checked', () => {
    const wrapper = mount(OptionRadioGroup, {
      props: {
        modelValue: 'b',
        options: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ],
      },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios).toHaveLength(2);
    const checked = radios.find((r) => r.attributes('aria-checked') === 'true')!;
    expect(checked.text()).toBe('乙');
    expect(checked.attributes('data-state')).toBe('checked');
  });

  it('点击未选项 → emit update:modelValue 为该值（string）', async () => {
    const wrapper = mount(OptionRadioGroup, {
      props: {
        modelValue: 'a',
        options: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ],
      },
    });
    await wrapper.findAll('[role="radio"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b']);
  });

  it('泛型支持 number 值', async () => {
    const wrapper = mount(OptionRadioGroup, {
      props: {
        modelValue: 1,
        options: [
          { value: 1, label: '一' },
          { value: 2, label: '二' },
        ],
      },
    });
    await wrapper.findAll('[role="radio"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([2]);
  });
});
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm test src/components/ui/__tests__/OptionRadioGroup.test.ts`
Expected: FAIL（`[role="radio"]` 找不到 / 选中态断言失败）

- [ ] **Step 7: 重写 OptionRadioGroup.vue**

Replace `src/components/ui/OptionRadioGroup.vue` 整文件为:

```vue
<script setup lang="ts" generic="T extends string | number">
/**
 * 单选按钮组（共享 ui，公共 API 冻结）。
 *
 * 底层由 @headlessui/vue RadioGroup/RadioGroupOption 迁移至 reka-ui
 * RadioGroupRoot/RadioGroupItem。选中态改用 data-[state=checked] 表达，
 * props/emits 与迁移前一致。
 *
 * @template T - 选项值类型，限定为 string | number
 */
import { RadioGroupRoot, RadioGroupItem } from 'reka-ui';

/**
 * 单选按钮组选项。
 *
 * @template T - 选项值类型，限定为 string | number
 */
export interface RadioOption<T extends string | number = string> {
  /** 选项值 */
  value: T;
  /** 显示文本 */
  label: string;
}

/**
 * 组件 props。
 *
 * @template T - 选中值类型，限定为 string | number
 */
interface Props<T extends string | number> {
  /** 当前选中的值 */
  modelValue: T;
  /** 选项列表 */
  options: RadioOption<T>[];
  /** 标签文本 */
  label?: string;
  /** label 紧贴按钮组（去除固定最小宽度），用于水平并排场景 */
  inlineLabel?: boolean;
}

const props = withDefaults(defineProps<Props<T>>(), { label: undefined, inlineLabel: false });

const emit = defineEmits<{
  /** 选中值变化时触发 */
  'update:modelValue': [value: T];
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted-foreground shrink-0" :class="inlineLabel ? '' : 'min-w-18'">{{ label }}</span>
    <RadioGroupRoot :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v as T)" class="flex gap-1 flex-wrap">
      <RadioGroupItem
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        as-child
      >
        <button
          type="button"
          :class="[
            'px-3 py-1.5 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
            'transition-[background-color,border-color] duration-150',
            'data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-white',
            'bg-background border-border text-foreground hover:bg-accent hover:border-primary',
          ]"
        >
          {{ option.label }}
        </button>
      </RadioGroupItem>
    </RadioGroupRoot>
  </div>
</template>
```

- [ ] **Step 8: 跑 OptionRadioGroup 测试确认通过**

Run: `pnpm test src/components/ui/__tests__/OptionRadioGroup.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 9: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: astro check 0 error；全量测试通过（SM4-CBC 概率性失败单独重跑）。两个旧文件改内部、公共 API 不变，27 个调用方无需改也不报错。

- [ ] **Step 10: 浏览器实测**

Run: `pnpm dev`，打开含 ToggleSwitch 与 OptionRadioGroup 的页面：
- `/crypto/asymmetric`（ToggleSwitch 多处 + ModeTabGroup，先验 ToggleSwitch）：开关拨动有橙色滑入、状态文字切换、功能联动正常。
- `/text/fake-data-generator` 结果区 OptionRadioGroup（JSON/CSV）：点 JSON/CSV 互切，选中项变橙底白字，输出格式随之变化。

Expected: 开关/单选交互与视觉与迁移前一致，无控制台错误。

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/ToggleSwitch.vue src/components/ui/OptionRadioGroup.vue src/components/ui/__tests__/ToggleSwitch.test.ts src/components/ui/__tests__/OptionRadioGroup.test.ts
git commit -m "refactor(ui): ToggleSwitch/OptionRadioGroup 由 @headlessui/vue 迁移至 reka-ui"
```

---

## Task 2: ModeTabGroup（Tab → Tabs）

**Files:**
- Modify: `src/components/ui/ModeTabGroup.vue`（整文件重写内部）
- Create: `src/components/ui/__tests__/ModeTabGroup.test.ts`

**Interfaces:**
- Produces（公共 API 冻结，6 个消费方：MetaTagGenerator/SymmetricCrypto/SM2Crypto/AsymmetricCrypto/JwtParser/JsonDiff 零改动）:
  - props `{ modelValue: string; options: { key: string; label: string }[] }` + emit `update:modelValue: [string]`
  - 具名 slot：每个 `option.key` 一个 slot（消费方 `<template #encrypt>`）

**Why force-mount + 隐藏**：复刻 HeadlessUI「所有面板挂载、非选中 hidden」行为，避免任何消费方依赖非激活面板存在于 DOM（见决策 4）。SSR 确定性保证无水合 mismatch，但须浏览器实测 6 个消费方。

- [ ] **Step 1: 写失败测试**

Create `src/components/ui/__tests__/ModeTabGroup.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ModeTabGroup from '../ModeTabGroup.vue';

const options = [
  { key: 'encrypt', label: '加密' },
  { key: 'decrypt', label: '解密' },
];

describe('ModeTabGroup.vue', () => {
  it('渲染 options 为 tab，激活项 role=tab + aria-selected=true', () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'encrypt', options },
      slots: { encrypt: '<div>加密面板</div>', decrypt: '<div>解密面板</div>' },
    });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    const active = tabs.find((t) => t.attributes('aria-selected') === 'true')!;
    expect(active.text()).toBe('加密');
  });

  it('激活面板可见、非激活面板 force-mount 在 DOM 且 data-state=inactive', () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'encrypt', options },
      slots: { encrypt: '<div>加密面板</div>', decrypt: '<div>解密面板</div>' },
    });
    expect(wrapper.text()).toContain('加密面板');
    // 非激活面板仍在 DOM（force-mount），Reka 标 data-state=inactive（Tailwind 变体类 data-[state=inactive]:hidden 由其触发）
    const panels = wrapper.findAll('[role="tabpanel"]');
    expect(panels).toHaveLength(2);
    const decryptPanel = panels.find((p) => p.text().includes('解密面板'));
    expect(decryptPanel?.attributes('data-state')).toBe('inactive');
  });

  it('点击未激活 tab → emit update:modelValue 为其 key', async () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'encrypt', options },
      slots: { encrypt: '<div></div>', decrypt: '<div></div>' },
    });
    await wrapper.findAll('[role="tab"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['decrypt']);
  });

  it('modelValue 未命中任何 key → 回落激活首项', () => {
    const wrapper = mount(ModeTabGroup, {
      props: { modelValue: 'nope', options },
      slots: { encrypt: '<div></div>', decrypt: '<div></div>' },
    });
    const active = wrapper.findAll('[role="tab"]').find((t) => t.attributes('aria-selected') === 'true')!;
    expect(active.text()).toBe('加密');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/ui/__tests__/ModeTabGroup.test.ts`
Expected: FAIL（`[role="tab"]` 找不到 / aria-selected 缺失）

- [ ] **Step 3: 重写 ModeTabGroup.vue**

Replace `src/components/ui/ModeTabGroup.vue` 整文件为:

```vue
<script setup lang="ts">
/**
 * 模式 Tab 组（共享 ui，公共 API 冻结；6 个工具消费）。
 *
 * 底层由 @headlessui/vue Tab（index 制）迁移至 reka-ui Tabs（value 制）。
 * value 制直接消费 string key，省去 index↔key 转换。所有面板 force-mount +
 * data-[state=inactive]:hidden，复刻迁移前「全部挂载、非选中隐藏」行为。
 */
import { computed } from 'vue';
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui';

const props = defineProps<{
  modelValue: string;
  options: { key: string; label: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

/** 当前激活值：modelValue 命中选项时用它，否则回落首项（对齐原 HeadlessUI selectedIndex 回落 0）。 */
const activeValue = computed(() =>
  props.options.some((opt) => opt.key === props.modelValue) ? props.modelValue : (props.options[0]?.key ?? ''),
);
</script>

<template>
  <TabsRoot :model-value="activeValue" @update:model-value="(v) => emit('update:modelValue', v as string)">
    <TabsList class="flex gap-1 mb-4">
      <TabsTrigger
        v-for="option in options"
        :key="option.key"
        :value="option.key"
        as-child
      >
        <button
          type="button"
          :class="[
            'px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
            'transition-[background-color,border-color] duration-150',
            'data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:border-primary',
            'bg-card text-foreground border-border hover:bg-accent',
          ]"
        >
          {{ option.label }}
        </button>
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="option in options"
      :key="option.key"
      :value="option.key"
      force-mount
      class="data-[state=inactive]:hidden"
    >
      <slot :name="option.key" />
    </TabsContent>
  </TabsRoot>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/ui/__tests__/ModeTabGroup.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: astro check 0 error；测试全过。

- [ ] **Step 6: 浏览器实测（6 个消费方，重点水合拦截）**

Run: `pnpm dev`，逐一打开并切换 Tab：
- `/devops/meta-tag-generator`（多行 ModeTabGroup，最复杂）
- `/crypto/symmetric-encryption`（加密/解密）
- `/crypto/sm2`（modeOptions）
- `/crypto/asymmetric`（availableModes）
- `/encoding/jwt`
- `/format/json-diff`

每页：确认**无水合错误/无空白**、Tab 点击切换、激活项橙底白字、对应面板内容显示、非激活面板隐藏。刷新各页确认 SSR 一致（force-mount 下所有面板在 DOM，激活态由 modelValue 决定，应稳定）。

Expected: 6 页 Tab 行为与迁移前一致，控制台无错误。**任一页空白或报 hydration mismatch 立即停下排查 force-mount/data-state**。

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/ModeTabGroup.vue src/components/ui/__tests__/ModeTabGroup.test.ts
git commit -m "refactor(ui): ModeTabGroup 由 HeadlessUI Tab(index) 迁移至 reka-ui Tabs(value)"
```

---

## Task 3: SelectListbox（Listbox → Select，修复 ui-* 死类名）

**Files:**
- Modify: `src/components/ui/SelectListbox.vue`（整文件重写内部）
- Create: `src/components/ui/__tests__/SelectListbox.test.ts`

**Interfaces:**
- Produces（公共 API 冻结）:
  - props `{ modelValue: string|number; options: { value: string|number; label: string }[]; label?: string; buttonClass?: string }` + emit `update:modelValue: [string|number]`
  - 值解析兼容历史 `(option as any).key ?? option.value`（保留 `optionValue()` 助手）

**Why this task here**：Select 是共享件里唯一的 portal 组件，最复杂；放共享阶段末，其前两个简单任务已验证 Reka 基建可用。迁后修复 `ui-active`/`ui-selected` 死类名（选中/高亮当前实际不生效）。

- [ ] **Step 1: 写失败测试**

Create `src/components/ui/__tests__/SelectListbox.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SelectListbox from '../SelectListbox.vue';

const options = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
];

describe('SelectListbox.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('渲染 label 与触发器中的选中项文案', () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '2', options, label: '数量' },
      attachTo: document.body,
    });
    expect(wrapper.text()).toContain('数量');
    expect(wrapper.get('button').text()).toContain('二');
  });

  it('v-model 转发：改 modelValue → 触发器文案更新', async () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '1', options },
      attachTo: document.body,
    });
    await wrapper.setProps({ modelValue: '2' });
    expect(wrapper.get('button').text()).toContain('二');
  });

  it('点击触发器 → 打开内容（portal 到 body），含全部选项；选中项 data-state=checked', async () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '2', options },
      attachTo: document.body,
    });
    await wrapper.get('button').trigger('click');
    await nextTick();
    await nextTick();
    const opts = Array.from(document.body.querySelectorAll('[role="option"]')) as HTMLElement[];
    expect(opts.map((o) => o.textContent)).toEqual(expect.arrayContaining(['一', '二']));
    // 选中项（二）被 Reka 标 data-state=checked（驱动 text-primary + 对勾 indicator）
    const checked = opts.find((o) => o.getAttribute('data-state') === 'checked');
    expect(checked?.textContent).toContain('二');
  });

  it('点击某选项 → emit update:modelValue', async () => {
    const wrapper = mount(SelectListbox, {
      props: { modelValue: '1', options },
      attachTo: document.body,
    });
    await wrapper.get('button').trigger('click');
    await nextTick();
    await nextTick();
    // 选项 role=option
    const opt = Array.from(document.body.querySelectorAll('[role="option"]')).find((el) => el.textContent === '二') as HTMLElement;
    expect(opt).toBeTruthy();
    opt.click();
    await nextTick();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/components/ui/__tests__/SelectListbox.test.ts`
Expected: FAIL（当前 Listbox 触发器非 `<button>` 或 `[role=option]` 缺失 / 打开行为不同）

- [ ] **Step 3: 重写 SelectListbox.vue**

Replace `src/components/ui/SelectListbox.vue` 整文件为:

```vue
<script setup lang="ts">
/**
 * 下拉选择框（共享 ui，公共 API 冻结）。
 *
 * 底层由 @headlessui/vue Listbox 迁移至 reka-ui Select（portal 化）。
 * 迁移同时修复历史 ui-active/ui-selected 死类名（Tailwind v4 未注册）：
 * 选中态走 data-[state=checked] + SelectItemIndicator（对勾），键盘高亮走 data-[highlighted]。
 * 值解析兼容历史 (option.key ?? option.value)。
 */
import { computed } from 'vue';
import {
  SelectRoot,
  SelectTrigger,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemIndicator,
} from 'reka-ui';
import { Check, ChevronDown } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    options: { value: string | number; label: string }[];
    label?: string;
    /** 透传给触发器按钮的额外 class，用于行内紧凑场景对齐高度（如 h-9） */
    buttonClass?: string;
  }>(),
  { label: undefined, buttonClass: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

/** 解析选项值：兼容历史 `(option as any).key ?? option.value`。 */
function optionValue(option: { value: string | number; [k: string]: unknown }): string | number {
  return (option.key as string | number | undefined) ?? option.value;
}

/** v-model 转发（Reka Select 接受 AcceptableValue，这里收窄回 string|number）。 */
const model = computed<string | number>({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue || optionValue(o) === props.modelValue);
  return opt?.label ?? '';
});
</script>

<template>
  <div class="relative">
    <label v-if="label" class="block mb-1 text-[0.8125rem] text-muted-foreground font-sans">{{ label }}</label>
    <SelectRoot v-model="model">
      <SelectTrigger
        :class="[
          'relative w-full px-2 py-1 border border-border rounded-sm bg-background text-foreground text-[0.8125rem] font-sans cursor-pointer flex items-center justify-center',
          props.buttonClass,
        ]"
      >
        <span class="block truncate">{{ selectedLabel }}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown class="h-4 w-4 text-muted-foreground" :size="16" aria-hidden="true" />
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          position="popper"
          :side-offset="4"
          class="z-10 max-h-60 min-w-[var(--reka-select-trigger-width)] overflow-auto rounded-sm bg-card border border-border py-1 text-[0.8125rem] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        >
          <SelectViewport>
            <SelectItem
              v-for="option in options"
              :key="optionValue(option)"
              :value="optionValue(option)"
              class="relative cursor-pointer select-none py-1.5 px-2 outline-none data-[highlighted]:bg-accent data-[highlighted]:text-foreground"
            >
              <span class="flex items-center justify-center gap-1.5 truncate data-[state=checked]:font-semibold data-[state=checked]:text-primary">{{ option.label }}</span>
              <SelectItemIndicator class="absolute inset-y-0 left-0 flex items-center pl-1.5 text-primary">
                <Check class="h-4 w-4" :size="16" aria-hidden="true" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/components/ui/__tests__/SelectListbox.test.ts`
Expected: PASS（4 tests）。若「打开内容」用例偶发时序问题，增加一处 `await nextTick()`；portal 在 happy-dom 下通常 2 次 nextTick 稳定。

- [ ] **Step 5: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: astro check 0 error；测试全过。

- [ ] **Step 6: 浏览器实测**

Run: `pnpm dev`，打开含 SelectListbox 的页面：
- `/editor/markdown-editor` 工具栏「标题 H1/H2/H3」与「列表」下拉（此时 MarkdownEditor 仍用 HeadlessUI Menu，但 SelectListbox 已是 Reka）：点开下拉，**确认选中项变橙色 + 左侧对勾**（这是迁移修复点，迁移前因 ui-selected 死类名不生效）、键盘上下键高亮、点击选项收起并更新。
- `/text/fake-data-generator`（此时其 Dialog 仍是 HeadlessUI）打开字段配置 Dialog，里面 SelectListbox 选生成器类型/参数：行为同上。

Expected: 下拉打开/选中对勾/高亮/收起均正常，无控制台错误。

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/SelectListbox.vue src/components/ui/__tests__/SelectListbox.test.ts
git commit -m "refactor(ui): SelectListbox 由 HeadlessUI Listbox 迁移至 reka-ui Select（修复 ui-* 死类名）"
```

---

## Task 4: TextToolbox（Disclosure → Collapsible）

**Files:**
- Modify: `src/tools/text/TextToolbox.vue`（import 行 + Disclosure 块）
- Create: `src/tools/text/__tests__/TextToolbox.test.ts`

**Interfaces:**
- Consumes: 本组件无对外公共 API（工具内部组件），仅改 Disclosure→Collapsible，外部不变
- 内部新增：`const findReplaceOpen = ref(false)`（取代 Disclosure 的 `open` slot prop）

**Atomicity note:** 保留原手写 `<transition>` 滑入动画——用 `CollapsibleRoot v-model:open` + `CollapsibleTrigger as-child`（免费 aria-expanded）+ `<transition>` 包 `<CollapsibleContent force-mount v-if="open">`（force-mount 让 Vue `v-if` 驱动 enter/leave，CollapsibleContent 提供 role=region 的 a11y）。

- [ ] **Step 1: 写失败测试**

Create `src/tools/text/__tests__/TextToolbox.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TextToolbox from '../TextToolbox.vue';

describe('TextToolbox.vue', () => {
  it('挂载渲染，查找替换面板默认隐藏', () => {
    const wrapper = mount(TextToolbox);
    expect(wrapper.find('textarea').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('查找内容');
  });

  it('点击查找替换按钮 → 面板展开（含「查找内容」输入框）', async () => {
    const wrapper = mount(TextToolbox);
    await wrapper.get('button[aria-label="查找替换"]').trigger('click');
    expect(wrapper.find('input[aria-label="查找内容"]').exists()).toBe(true);
  });

  it('再次点击 → 面板收起', async () => {
    const wrapper = mount(TextToolbox);
    await wrapper.get('button[aria-label="查找替换"]').trigger('click');
    await wrapper.get('button[aria-label="查找替换"]').trigger('click');
    expect(wrapper.find('input[aria-label="查找内容"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/tools/text/__tests__/TextToolbox.test.ts`
Expected: PASS 或部分 PASS（当前 Disclosure 也能展开）。本任务测试主要锁「迁移后行为不变」，先记录迁移前基线通过；若「再次点击收起」用例失败，说明 Disclosure 行为差异，迁移后须过。

- [ ] **Step 3: 替换 import（第 9 行）**

Modify `src/tools/text/TextToolbox.vue` 第 9 行：

旧：
```ts
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
```

新（删除 HeadlessUI import，换 Reka）：
```ts
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
```

- [ ] **Step 4: 新增 findReplaceOpen 状态**

在 `const useRegex = ref(false);`（第 43 行）下方、`const replaceError = ref('');` 附近，新增：

```ts
/** 查找替换面板是否展开（取代 HeadlessUI Disclosure 的 open slot prop）。 */
const findReplaceOpen = ref(false);
```

（放在 `text`/`find`/`replace` 等 ref 附近即可，保持就近语义。）

- [ ] **Step 5: 替换 Disclosure 块（第 144-234 行整段）**

旧（第 144 行起）：
```vue
    <Disclosure as="div" v-slot="{ open }" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-1.5 border border-border rounded-md p-3 bg-card">
```
…（中间所有变换按钮不变）…
```vue
        <!-- 查找替换（点击展开） -->
        <DisclosureButton :class="[ICON_BTN_BASE, 'w-9 h-9', open ? 'bg-accent text-foreground' : '']" title="查找替换" aria-label="查找替换">
          <Search :size="16" />
        </DisclosureButton>
      </div>

      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <DisclosurePanel class="border border-border rounded-md p-4 bg-card flex flex-col gap-3">
          ...查找替换表单内容（不变）...
        </DisclosurePanel>
      </transition>
    </Disclosure>
```

新：把外层 `<Disclosure as="div" v-slot="{ open }" ...>` 换成 `<CollapsibleRoot v-model:open="findReplaceOpen" as-child>` + 内层 `<div class="flex flex-col gap-2">`；`<DisclosureButton>` 换成 `<CollapsibleTrigger as-child>` + 内层 button（`open` → `findReplaceOpen`）；`<DisclosurePanel>` 换成 `<CollapsibleContent force-mount v-if="findReplaceOpen" ...>`。**transition 与所有内部按钮/表单内容一字不动**。完整新结构：

```vue
    <CollapsibleRoot v-model:open="findReplaceOpen" as-child>
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1.5 border border-border rounded-md p-3 bg-card">
          <!-- 大小写 / 全半角 / 清理 / 排序 / 操作 等所有变换按钮：保持原样不变 -->
          <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9 font-mono font-semibold text-[0.9375rem]']" title="大写" aria-label="大写" @click="apply(toUpperCase)">A</button>
          <!-- …其余变换按钮原样保留，不做任何改动… -->
          <CopyButton :text="text" />
          <span class="mx-0.5 h-6 w-px self-center bg-border" aria-hidden="true"></span>
          <!-- 查找替换（点击展开） -->
          <CollapsibleTrigger as-child>
            <button type="button" :class="[ICON_BTN_BASE, 'w-9 h-9', findReplaceOpen ? 'bg-accent text-foreground' : '']" title="查找替换" aria-label="查找替换">
              <Search :size="16" />
            </button>
          </CollapsibleTrigger>
        </div>

        <transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <CollapsibleContent force-mount v-if="findReplaceOpen" class="border border-border rounded-md p-4 bg-card flex flex-col gap-3">
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="find"
                type="text"
                class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary box-border"
                placeholder="查找内容"
                aria-label="查找内容"
              />
              <input
                v-model="replace"
                type="text"
                class="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary box-border"
                placeholder="替换为"
                aria-label="替换内容"
              />
            </div>
            <div class="flex flex-wrap items-center gap-4">
              <label class="flex items-center gap-1.5 text-sm text-foreground cursor-pointer select-none">
                <input v-model="caseSensitive" type="checkbox" class="cursor-pointer" />
                区分大小写
              </label>
              <label class="flex items-center gap-1.5 text-sm text-foreground cursor-pointer select-none">
                <input v-model="useRegex" type="checkbox" class="cursor-pointer" />
                使用正则
              </label>
              <button type="button" :class="BTN_PRIMARY_CLASS" class="ml-auto" @click="handleReplace">替换全部</button>
            </div>
            <p v-if="replaceError" class="text-xs text-error">{{ replaceError }}</p>
          </CollapsibleContent>
        </transition>
      </div>
    </CollapsibleRoot>
```

> implementer 注意：第 145-188 行之间的全部变换按钮（大写/小写/首字母/半角/全角/去空行/去重/去空白/合并空白/升序/降序/撤销/重做/清空/CopyButton 及分隔线）**逐字保留**，只改外层包裹与查找替换触发器/面板三处标签。建议用 IDE 对照 diff，避免误删中间按钮。

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/tools/text/__tests__/TextToolbox.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 7: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: 0 error；全量过。

- [ ] **Step 8: 浏览器实测**

Run: `pnpm dev`，打开 `/text/text-toolbox`：
- 默认查找替换面板收起；点放大镜按钮 → 面板**滑入展开**（保留原动画），含查找/替换输入框 + 区分大小写/正则 + 替换全部；再点 → **滑出收起**。
- 各变换按钮（大小写/去重/排序/撤销重做/清空/复制）功能正常；查找替换（含正则、区分大小写）能正确改写文本框。

Expected: 展开动画与全部功能与迁移前一致，无控制台错误。

- [ ] **Step 9: Commit**

```bash
git add src/tools/text/TextToolbox.vue src/tools/text/__tests__/TextToolbox.test.ts
git commit -m "refactor(text): TextToolbox 由 HeadlessUI Disclosure 迁移至 reka-ui Collapsible"
```

---

## Task 5: CronParser（Tab → Tabs，删 index 转换）

**Files:**
- Modify: `src/tools/datetime/CronParser.vue`（import 行 + TabGroup 块）
- Create: `src/tools/datetime/__tests__/CronParser.test.ts`

**Interfaces:**
- Consumes: 本工具内部组件，无对外 API。`activeFieldTab: ref<keyof CronFields7>` 直接作为 Tabs 的 value（Reka value 制），删掉原 `:selected-index` + `@change` 的 index↔key 转换

**Why no interaction test（仅冒烟）**：CronParser 近 960 行、含两个 deep watch + setup 期 `parseExpression()`，挂载即可；交互切换的 Tabs 行为已由 Task 2 ModeTabGroup 测试覆盖（同一 Reka Tabs 模式）。本任务浏览器实测作为交互门槛。

- [ ] **Step 1: 写冒烟测试**

Create `src/tools/datetime/__tests__/CronParser.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CronParser from '../CronParser.vue';

describe('CronParser.vue', () => {
  it('挂载并渲染 7 个字段 Tab（role=tab）', () => {
    const wrapper = mount(CronParser);
    expect(wrapper.text()).toContain('Cron 表达式');
    // 秒/分/时/日/月/周/年 共 7 个字段 tab
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(7);
  });

  it('默认激活「秒」字段 tab（aria-selected=true）', () => {
    const wrapper = mount(CronParser);
    const active = wrapper.findAll('[role="tab"]').find((t) => t.attributes('aria-selected') === 'true');
    expect(active?.text()).toContain('秒');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/tools/datetime/__tests__/CronParser.test.ts`
Expected: FAIL（`[role="tab"]` 找不到）

- [ ] **Step 3: 替换 import（第 3 行）**

Modify `src/tools/datetime/CronParser.vue` 第 3 行：

旧：
```ts
import {TabGroup, TabList, Tab, TabPanels, TabPanel} from '@headlessui/vue';
```

新：
```ts
import {TabsRoot, TabsList, TabsTrigger, TabsContent} from 'reka-ui';
```

- [ ] **Step 4: 替换 TabGroup 块（第 275-592 行）**

4a. 把外层 `<TabGroup as="div" ... :selected-index=... @change=...>` 与 `</TabGroup>` 换成 TabsRoot：

旧（第 275-280 行）：
```vue
        <TabGroup
            as="div"
            class="border border-border rounded-lg bg-card overflow-hidden"
            :selected-index="FIELD_KEYS.indexOf(activeFieldTab)"
            @change="(i: number) => activeFieldTab = FIELD_KEYS[i]"
        >
          <TabList class="flex gap-1 px-2 pt-2 pb-0 border-b border-border">
```

新：
```vue
        <TabsRoot
            as-child
            :model-value="activeFieldTab"
            @update:model-value="(v) => activeFieldTab = v as keyof CronFields7"
        >
          <div class="border border-border rounded-lg bg-card overflow-hidden">
          <TabsList class="flex gap-1 px-2 pt-2 pb-0 border-b border-border">
```

4b. 把 `<Tab v-slot="{ selected }" as="template">` + 内层 button 换成 `<TabsTrigger as-child :value>` + button（`selected` 三元 → `data-[state=active]`）：

旧（第 282-301 行）：
```vue
            <Tab v-for="config in FIELD_CONFIGS" :key="config.key" v-slot="{ selected }" as="template">
              <button
                  :class="[
                  'flex flex-col items-center gap-0.5 px-3 py-2 border border-solid rounded-t-md cursor-pointer min-w-12 -mb-px relative z-10',
                  'transition-[background-color,border-color] duration-150',
                  'focus:outline-none',
                  selected
                    ? 'border-primary border-b-card bg-primary/5'
                    : 'border-transparent bg-transparent hover:bg-accent',
                ]"
              >
                <span class="text-[0.8125rem] font-medium" :class="selected ? 'text-primary' : 'text-foreground'">
                  {{ config.label }}
                </span>
                <code class="text-[0.6875rem] font-mono" :class="selected ? 'text-primary' : 'text-muted-foreground'">
                  {{ fieldValuePreview[config.key] }}
                </code>
              </button>
            </Tab>
          </TabList>
```

新：
```vue
            <TabsTrigger v-for="config in FIELD_CONFIGS" :key="config.key" :value="config.key" as-child>
              <button
                  type="button"
                  :class="[
                  'flex flex-col items-center gap-0.5 px-3 py-2 border border-solid rounded-t-md cursor-pointer min-w-12 -mb-px relative z-10',
                  'transition-[background-color,border-color] duration-150',
                  'focus:outline-none',
                  'data-[state=active]:border-primary data-[state=active]:border-b-card data-[state=active]:bg-primary/5',
                  'border-transparent bg-transparent hover:bg-accent',
                ]"
              >
                <span class="text-[0.8125rem] font-medium data-[state=active]:text-primary text-foreground">
                  {{ config.label }}
                </span>
                <code class="text-[0.6875rem] font-mono data-[state=active]:text-primary text-muted-foreground">
                  {{ fieldValuePreview[config.key] }}
                </code>
              </button>
            </TabsTrigger>
          </TabsList>
```

4c. 把 `<TabPanels class="p-4 h-160">` + `<TabPanel class="h-full" v-for>` 换成包裹 div + `<TabsContent force-mount>`：

旧（第 303-304 行与第 590-592 行）：
```vue
          <TabPanels class="p-4 h-160">
            <TabPanel class="h-full" v-for="config in FIELD_CONFIGS" :key="config.key">
              <div class="flex flex-col gap-1.5 h-full overflow-y-auto">
                ...（各模式编辑器内容，第 306-588 行，完全不变）...
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
```

新：
```vue
          <div class="p-4 h-160">
            <TabsContent force-mount class="h-full data-[state=inactive]:hidden" v-for="config in FIELD_CONFIGS" :key="config.key" :value="config.key">
              <div class="flex flex-col gap-1.5 h-full overflow-y-auto">
                ...（各模式编辑器内容，完全不变）...
              </div>
            </TabsContent>
          </div>
          </div>
        </TabsRoot>
```

> implementer 注意：第 306-588 行的各模式编辑器（every/range/step/specific 网格/lastDay/...）**逐字保留**，仅改 TabGroup→TabsRoot、Tab→TabsTrigger、TabPanels/TabPanel→div+TabsContent 三层包裹，并把 `selected` 三元换成 `data-[state=active]`。`switchToField` 仍设 `activeFieldTab`，与新 Tabs value 制兼容，无需改。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/tools/datetime/__tests__/CronParser.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 6: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: 0 error；全量过。

- [ ] **Step 7: 浏览器实测**

Run: `pnpm dev`，打开 `/datetime/cron-parser`：
- 7 个字段 Tab 渲染，「秒」默认激活（橙底/橙字 + 预览值）；点击其他字段 Tab 切换，对应模式编辑器显示、其余隐藏。
- 字段模式切换（每/范围/步长/指定值网格等）、表达式双向同步、常用模板、执行时间预览均正常。
- 刷新无水合错误、无空白。

Expected: Tab 切换与全部 cron 功能与迁移前一致。

- [ ] **Step 8: Commit**

```bash
git add src/tools/datetime/CronParser.vue src/tools/datetime/__tests__/CronParser.test.ts
git commit -m "refactor(datetime): CronParser 由 HeadlessUI Tab(index) 迁移至 reka-ui Tabs(value)"
```

---

## Task 6: MarkdownEditor（Menu → DropdownMenu）

**Files:**
- Modify: `src/tools/editor/MarkdownEditor.vue`（import 行 + Menu 块）
- Create: `src/tools/editor/__tests__/MarkdownEditor.test.ts`

**Interfaces:**
- Consumes: 工具内部组件，无对外 API。导出菜单 HeadlessUI Menu → Reka DropdownMenu，高亮 `active ? 'bg-accent'` → `data-[highlighted]:bg-accent`

- [ ] **Step 1: 写失败测试**

Create `src/tools/editor/__tests__/MarkdownEditor.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MarkdownEditor from '../MarkdownEditor.vue';

describe('MarkdownEditor.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('渲染导出触发器（aria-label=导出）', () => {
    const wrapper = mount(MarkdownEditor, { attachTo: document.body });
    expect(wrapper.find('button[aria-label="导出"]').exists()).toBe(true);
  });

  it('点击导出 → 菜单打开，HTML/PDF 项出现（PDF 打开前不在 body）', async () => {
    const wrapper = mount(MarkdownEditor, { attachTo: document.body });
    // 示例 Markdown 文本里本身含 "Markdown" 字样，故用 PDF 作为打开前后差异信号
    expect(document.body.textContent ?? '').not.toContain('PDF');
    await wrapper.get('button[aria-label="导出"]').trigger('click');
    await nextTick();
    await nextTick();
    const body = document.body.textContent ?? '';
    expect(body).toContain('Markdown');
    expect(body).toContain('HTML');
    expect(body).toContain('PDF');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/tools/editor/__tests__/MarkdownEditor.test.ts`
Expected: FAIL 或部分（当前 HeadlessUI Menu 打开后项也可能在 body；本测试锁迁移后行为，先确认能跑）。

- [ ] **Step 3: 替换 import（第 9 行）**

Modify `src/tools/editor/MarkdownEditor.vue` 第 9 行：

旧：
```ts
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
```

新：
```ts
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem } from 'reka-ui';
```

- [ ] **Step 4: 替换导出菜单块（第 419-443 行）**

旧：
```vue
        <Menu as="div" class="relative">
          <MenuButton :class="toolBtn" title="导出">
            <Download :size="16" />
          </MenuButton>
          <MenuItems class="absolute right-0 z-10 mt-1 w-28 origin-top-right rounded-sm bg-card border border-border py-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <MenuItem v-slot="{ active }">
              <button
                :class="[active ? 'bg-accent' : '', 'block w-full px-3 py-1.5 text-center text-[0.8125rem] text-foreground font-sans']"
                @click="handleExportMd"
              >Markdown</button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                :class="[active ? 'bg-accent' : '', 'block w-full px-3 py-1.5 text-center text-[0.8125rem] text-foreground font-sans']"
                @click="handleExportHtml"
              >HTML</button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button
                :class="[active ? 'bg-accent' : '', 'block w-full px-3 py-1.5 text-center text-[0.8125rem] text-foreground font-sans']"
                @click="handleExportPdf"
              >PDF</button>
            </MenuItem>
          </MenuItems>
        </Menu>
```

新：
```vue
        <DropdownMenuRoot>
          <DropdownMenuTrigger as-child>
            <button type="button" :class="toolBtn" title="导出" aria-label="导出">
              <Download :size="16" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              align="end"
              :side-offset="4"
              class="z-10 min-w-28 rounded-sm bg-card border border-border py-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <DropdownMenuItem as-child>
                <button type="button" class="block w-full px-3 py-1.5 text-center text-[0.8125rem] text-foreground font-sans data-[highlighted]:bg-accent" @click="handleExportMd">Markdown</button>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <button type="button" class="block w-full px-3 py-1.5 text-center text-[0.8125rem] text-foreground font-sans data-[highlighted]:bg-accent" @click="handleExportHtml">HTML</button>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <button type="button" class="block w-full px-3 py-1.5 text-center text-[0.8125rem] text-foreground font-sans data-[highlighted]:bg-accent" @click="handleExportPdf">PDF</button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
```

> `align="end"` 对齐原 `right-0`（右对齐触发器）；`side-offset=4` ≈ 原 `mt-1`。DropdownMenuItem as-child 把 Reka 的 role/选中关闭行为合并到 button，点击触发 `handleExportMd` 等并自动收起菜单。`handleExportMd/Html/Pdf` 内部仍 `dispatchEvent(CustomEvent('toast'))`——本阶段不动（Toast shim 阶段 3 退役）。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/tools/editor/__tests__/MarkdownEditor.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 6: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: 0 error；全量过。

- [ ] **Step 7: 浏览器实测**

Run: `pnpm dev`，打开 `/editor/markdown-editor`：
- 工具栏 SelectListbox（Task 3 已 Reka）选标题/列表正常；点导出按钮 → 下拉出现 Markdown/HTML/PDF（右对齐），键盘上下高亮、点击导出对应文件 + toast 反馈。
- 视图模式（分栏/编辑/预览）、加粗/斜体/代码/链接/代码块、同步滚动、Ctrl+B/I/K 快捷键均正常。

Expected: 菜单与全部编辑功能与迁移前一致，无控制台错误。

- [ ] **Step 8: Commit**

```bash
git add src/tools/editor/MarkdownEditor.vue src/tools/editor/__tests__/MarkdownEditor.test.ts
git commit -m "refactor(editor): MarkdownEditor 由 HeadlessUI Menu 迁移至 reka-ui DropdownMenu"
```

---

## Task 7: FakeDataGenerator（Dialog → Dialog + tw-animate）

**Files:**
- Modify: `src/tools/text/FakeDataGenerator.vue`（import 行 + Dialog 块）
- Create: `src/tools/text/__tests__/FakeDataGenerator.test.ts`

**Interfaces:**
- Consumes: 工具内部组件，无对外 API。Dialog 内部的 `SelectListbox`（Task 3）与 `OptionRadioGroup`（Task 1）已是 Reka——本任务因此排在共享件之后
- 内部 `dialogOpen: ref(false)` 不变，改由 `DialogRoot v-model:open` 消费

**Atomicity note:** 删除 HeadlessUI 的 `TransitionRoot`/`TransitionChild`/`Dialog`/`DialogPanel` 五个 import 与对应包裹，换成 Reka `DialogRoot`/`DialogPortal`/`DialogOverlay`/`DialogContent`/`DialogTitle` + tw-animate CSS 动画类。`DialogContent` 加 `:aria-describedby="undefined"` 静默 Reka「缺 DialogDescription」告警。

- [ ] **Step 1: 写失败测试**

Create `src/tools/text/__tests__/FakeDataGenerator.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import FakeDataGenerator from '../FakeDataGenerator.vue';

describe('FakeDataGenerator.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('挂载渲染，字段配置 Dialog 默认关闭（无 DialogTitle 在 body）', () => {
    mount(FakeDataGenerator, { attachTo: document.body });
    expect(document.body.textContent ?? '').not.toContain('编辑「');
  });

  it('点击字段「配置」按钮 → Dialog 打开，DialogTitle 出现在 body', async () => {
    const wrapper = mount(FakeDataGenerator, { attachTo: document.body });
    // 首个字段行的「配置」按钮（带 title 以「配置 」开头）
    const configBtn = wrapper.find('button[title^="配置 "]');
    expect(configBtn.exists()).toBe(true);
    await configBtn.trigger('click');
    await nextTick();
    await nextTick();
    expect(document.body.textContent ?? '').toContain('编辑「');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/tools/text/__tests__/FakeDataGenerator.test.ts`
Expected: PASS 或部分（当前 HeadlessUI Dialog 也能打开）。锁迁移后行为不变。

- [ ] **Step 3: 替换 import（第 9-15 行）**

Modify `src/tools/text/FakeDataGenerator.vue` 第 9-15 行：

旧：
```ts
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
```

新：
```ts
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui';
```

- [ ] **Step 4: 替换字段配置 Dialog 块（第 294-392 行）**

旧（第 294-392 行整段 `<TransitionRoot ...>...</TransitionRoot>`）：
```vue
    <TransitionRoot appear :show="dialogOpen" as="template">
      <Dialog as="div" class="relative z-50" @close="dialogOpen = false">
        <TransitionChild ...overlay...>
          <div class="fixed inset-0 bg-black/20" aria-hidden="true" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild ...panel...>
              <DialogPanel class="w-full max-w-md rounded-md bg-card border border-border p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <DialogTitle ...>编辑「{{ editingField.name }}」生成器</DialogTitle>
                <div class="mt-4 space-y-4">
                  ...（列名/类型 SelectListbox/参数，完全不变）...
                </div>
                <div class="mt-6 flex justify-end gap-2">
                  ...（取消/保存按钮，完全不变）...
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
```

新：
```vue
    <DialogRoot v-model:open="dialogOpen">
      <DialogPortal>
        <DialogOverlay
          class="fixed inset-0 bg-black/20 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />
        <DialogContent
          aria-describedby="undefined"
          class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-md bg-card border border-border p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        >
          <DialogTitle class="text-base font-semibold text-foreground">
            编辑「{{ editingField.name }}」生成器
          </DialogTitle>
          <div class="mt-4 space-y-4">
            ...（列名/类型 SelectListbox/参数，完全不变）...
          </div>
          <div class="mt-6 flex justify-end gap-2">
            ...（取消/保存按钮，完全不变）...
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
```

> implementer 注意：DialogPanel 内部的列名 input、类型 `SelectListbox`、参数 `SelectListbox`/input、取消/保存按钮（第 324-386 行）**逐字保留**。仅替换最外两层 TransitionRoot/Dialog/TransitionChild/DialogPanel 包裹为 DialogRoot/Portal/Overlay/Content；`dialogOpen` 由 `DialogRoot v-model:open` 双向绑定（点 overlay/ESC 自动关闭，对齐原 `@close`）。`DialogTitle` 保留。`:aria-describedby="undefined"` 显式声明无描述，静默 Reka 告警。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/tools/text/__tests__/FakeDataGenerator.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 6: 类型 + 全量回归**

Run: `pnpm astro check && pnpm test`
Expected: 0 error；全量过。

- [ ] **Step 7: 浏览器实测**

Run: `pnpm dev`，打开 `/text/fake-data-generator`：
- 点字段行的「配置」按钮 → Dialog **淡入 + 缩放展开**（居中），遮罩半透明；内含列名、生成器类型 SelectListbox（Task 3 Reka，选中橙色+对勾）、参数输入。
- 切换生成器类型 → 参数默认值重置；保存 → Dialog 关闭、字段配置更新；取消/点遮罩/ESC → 关闭。
- 快速模板、添加/删除字段、生成 JSON/CSV（OptionRadioGroup Task 1 Reka）、复制均正常。

Expected: Dialog 开合动画与全部功能与迁移前一致，无控制台错误（含无 Reka DialogDescription 告警）。

- [ ] **Step 8: Commit**

```bash
git add src/tools/text/FakeDataGenerator.vue src/tools/text/__tests__/FakeDataGenerator.test.ts
git commit -m "refactor(text): FakeDataGenerator 由 HeadlessUI Dialog+Transition 迁移至 reka-ui Dialog(tw-animate)"
```

---

## Task 8: 移除 @headlessui/vue + 全量验证

**Files:**
- Modify: `package.json`（移除 `@headlessui/vue`）
- Delete: `src/components/ui/Button.vue`（Stage 0 验证件，grep 确认零引用）

**Interfaces:**
- Consumes: 前 7 个 task 已迁完 8 处 @headlessui/vue 使用点；本 task 仅做清理与验收

**Why this task is last:** 必须等 8 处全部迁到 Reka 后才能移除 `@headlessui/vue` 依赖，否则 import 断裂。

- [ ] **Step 1: grep 验收——全项目 src 零 @headlessui/vue 残留**

Run: `pnpm exec grep -rn '@headlessui/vue' src/`
Expected: **零命中**。（docs/CLAUDE.md/DESIGN.md/package.json 的提及留待阶段 3 文档更新处理，不在 src/ 范围。）

- [ ] **Step 2: 删除 Stage 0 验证件 Button.vue**

先确认零引用（应在规划期已验证，复核）：

Run: `pnpm exec grep -rn 'ui/Button' src/`
Expected: **零命中**。

```bash
rm src/components/ui/Button.vue
```

> Button.vue 是阶段 0 为验证 shadcn-vue + cn() + token 链路而 add 的最小件，从未被任何组件 import。使命已达成，删除以免死代码。`components.json` 的 ui alias 不受影响。

- [ ] **Step 3: 移除 @headlessui/vue 依赖**

```bash
pnpm remove @headlessui/vue
```

- [ ] **Step 4: 全量验证**

Run:
```bash
pnpm astro check
pnpm test
pnpm build
```
Expected: astro check 0 error；测试全过（SM4-CBC 概率性失败单独重跑）；build 成功。

- [ ] **Step 5: 浏览器全量回归（所有受影响路由）**

Run: `pnpm dev`，逐项验证（无 @headlessui/vue 后全部由 Reka 接管）：
- ToggleSwitch/OptionRadioGroup：`/crypto/asymmetric`、`/text/fake-data-generator`（JSON/CSV）
- ModeTabGroup（6 处）：`/devops/meta-tag-generator`、`/crypto/symmetric-encryption`、`/crypto/sm2`、`/crypto/asymmetric`、`/encoding/jwt`、`/format/json-diff`
- SelectListbox：`/editor/markdown-editor`（标题/列表下拉）、`/text/fake-data-generator`（Dialog 内类型/参数）
- TextToolbox：`/text/text-toolbox`（查找替换展开）
- CronParser：`/datetime/cron-parser`（7 字段 Tab）
- MarkdownEditor：`/editor/markdown-editor`（导出菜单）
- FakeDataGenerator：`/text/fake-data-generator`（字段配置 Dialog）

每页确认：**无空白、无水合错误、交互与迁移前一致**。重点抽查 SelectListbox 选中橙色+对勾、Dialog 开合动画、Tab 切换。

Expected: 全部正常，控制台无错误/无告警。

- [ ] **Step 6: 更新进度 ledger**

Modify `.superpowers/sdd/progress.md`，在末尾追加「Stage 2 (UI 原语替换)」段，记录 8 个 task 的 commit 区间 + 验收结论（grep 零、测试数、浏览器门槛通过）。沿用 Stage 0/1 的记录格式。

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/Button.vue .superpowers/sdd/progress.md
git commit -m "chore(runtime): 移除 @headlessui/vue 依赖（8 处原语已迁移至 reka-ui）"
```

---

## 阶段 2 出口标准

- [ ] 全项目 `grep -rn '@headlessui/vue' src/` 零结果；`package.json` 无 `@headlessui/vue`
- [ ] `pnpm astro check` / `pnpm test` / `pnpm build` 全过
- [ ] 4 个共享 ui 组件（ToggleSwitch/OptionRadioGroup/ModeTabGroup/SelectListbox）公共 API 零变化，27 个调用方无需改动
- [ ] 4 个工具内部组件（TextToolbox/CronParser/MarkdownEditor/FakeDataGenerator）交互与迁移前一致
- [ ] SelectListbox 选中态（橙色 + 对勾）与键盘高亮真实生效（修复历史 ui-* 死类名）
- [ ] 新增组件测试（共享 4 件 + TextToolbox/CronParser 冒烟/MarkdownEditor/FakeDataGenerator）全过
- [ ] 所有受影响路由 `pnpm dev` 手测无空白、无水合错误

## 阶段 2 未覆盖（推迟到阶段 3，避免范围蔓延）

- **toast 工具本地迁移**：MarkdownEditor 等仍 `dispatchEvent(CustomEvent('toast'))`，经 ToastContainer shim 转发——阶段 3 迁 `toastStore.show()` 直连后移除 shim
- **CLAUDE.md / DESIGN.md 文档更新**：Tech Stack 仍写 HeadlessUI（阶段 3 移除并加 Reka/shadcn-vue）
- **暗色全工具对比度逐个校验**：阶段 3
- **shadcn-vue 预制件正式引入**：本阶段用 Reka 原语手写样式（与现有手写 Tailwind 风格一致）；未来若需 shadcn 预制件（如正式 Button/Form），按 `components.json`（无 @/ 别名）`add` 后改相对路径
- **SelectListbox 内 Content 宽度**：迁后用 `min-w-[var(--reka-select-trigger-width)]`（≥ 触发器宽，长 label 可扩展），原为 `w-full` 精确等宽——视觉等价或略宽，浏览器实测可接受

