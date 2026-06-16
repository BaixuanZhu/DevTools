# Headless UI + Tailwind CSS 迁移计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 9 个工具组件从原生 HTML 交互元素迁移到 @headlessui/vue 无障碍组件 + Tailwind CSS 设计令牌，统一交互模式、提升可访问性。

**Architecture:** 先抽取共享 Headless UI 包装组件（Tab / Listbox / RadioGroup / Switch / Disclosure），各工具组件消费共享组件完成迁移。每个包装组件内聚设计令牌样式，工具组件只传 props 和监听 events。

**Tech Stack:** Vue 3 Composition API + @headlessui/vue v1.7.x + Tailwind CSS v4 + Astro 岛屿

---

## 迁移全景分析

### 现状：9 个组件的交互模式

| 组件 | 模式切换 | 下拉选择 | 多选/单选组 | 开关 | 折叠面板 |
|------|---------|---------|-----------|------|---------|
| Base64Codec | ✅ 编码/解码 | - | - | - | - |
| UrlEncodeCodec | ✅ 编码/解码 | - | - | - | - |
| JwtParser | - | - | - | - | - |
| HashGenerator | - | ✅ 输出格式 | ✅ 算法多选 | - | - |
| SymmetricCrypto | ✅ 加密/解密 | ✅ 算法、密钥长度 | - | - | ✅ 高级选项 |
| DeviceInfo | - | - | - | - | - |
| DateTimeConverter | ✅ 时间戳/日期 | - | - | - | - |
| RandomStringGenerator | - | - | ✅ 字符集、大小写 | - | - |
| UuidGenerator | - | - | ✅ 版本选择 | ✅ 转换开关 | - |

### Headless UI 组件映射

| 原生模式 | Headless UI 组件 | 共享包装组件名 |
|---------|-----------------|--------------|
| 模式切换按钮组 | `Tab.Group` / `Tab.List` / `Tab` / `Tab.Panel` | `ModeTabGroup.vue` |
| `<select>` 下拉 | `Listbox` / `ListboxButton` / `ListboxOption` | `SelectListbox.vue` |
| 单选按钮组 | `RadioGroup` / `RadioGroupOption` | `OptionRadioGroup.vue` |
| checkbox 多选 / 布尔开关 | `Switch` / `SwitchGroup` / `SwitchLabel` | `ToggleSwitch.vue` |
| `<details>` 折叠 | `Disclosure` / `DisclosureButton` / `DisclosurePanel` | `DisclosureSection.vue` |

### 不需要 Headless UI 的组件

- **JwtParser** — 纯输入→展示，无交互控件需迁移
- **DeviceInfo** — 纯展示 + textarea，无交互控件需迁移

---

## Phase 1：共享 Headless UI 包装组件

### Task 1: 创建 ModeTabGroup.vue

**目标：** 替换当前 4 个组件中的"模式切换按钮组"（编码/解码、加密/解密、时间戳/日期），提供无障碍 Tab 切换。

**Files:**
- Create: `src/components/ui/ModeTabGroup.vue`
- Test: 手动 dev server 验证

**Step 1: 创建 ModeTabGroup.vue**

```vue
<script setup lang="ts">
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue';

export interface TabOption {
  key: string;
  label: string;
}

const props = defineProps<{
  options: TabOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onChange(index: number) {
  emit('update:modelValue', props.options[index].key);
}

const selectedIndex = computed(() =>
  props.options.findIndex((o) => o.key === props.modelValue),
);
</script>

<template>
  <TabGroup :selected-index="selectedIndex" @change="onChange">
    <TabList class="flex gap-1 mb-4">
      <Tab
        v-for="option in options"
        :key="option.key"
        :class="[
          'px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          modelValue === option.key
            ? 'bg-accent text-white border-accent'
            : 'bg-card text-text border-border hover:bg-hover',
        ]"
      >
        {{ option.label }}
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="option in options" :key="option.key">
        <slot :name="option.key" />
      </TabPanel>
    </TabPanels>
  </TabGroup>
</template>
```

**设计要点：**
- `v-model` 双向绑定当前选中的 key
- 支持具名插槽，每个 tab 对应一个 panel
- `focus-visible` 环形焦点，符合无障碍规范
- 活跃态/非活跃态样式与现有设计令牌一致

**Step 2: 启动 dev server 验证组件加载无报错**

Run: `pnpm dev`
Expected: 无编译错误

**Step 3: Commit**

```bash
git add src/components/ui/ModeTabGroup.vue
git commit -m "feat(ui): add ModeTabGroup shared component using Headless UI Tab"
```

---

### Task 2: 创建 SelectListbox.vue

**目标：** 替换 `<select>` 下拉框，提供无障碍、可键盘操作的 Listbox。

**Files:**
- Create: `src/components/ui/SelectListbox.vue`

**Step 1: 创建 SelectListbox.vue**

```vue
<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';

export interface SelectOption<T = string> {
  value: T;
  label: string;
}

const props = defineProps<{
  options: SelectOption[];
  modelValue: string | number;
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();
</script>

<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" class="field-label">{{ label }}</label>
    <Listbox :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
      <div class="relative">
        <ListboxButton
          class="relative w-full px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-sans cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <span class="block truncate">
            {{ options.find((o) => o.value === modelValue)?.label ?? '请选择' }}
          </span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg class="h-4 w-4 text-muted" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
            </svg>
          </span>
        </ListboxButton>
        <ListboxOptions
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm bg-card border border-border py-1 text-[0.8125rem] shadow-[0_2px_8px_rgba(0,0,0,0.06)] focus:outline-none"
        >
          <ListboxOption
            v-for="option in options"
            :key="String(option.value)"
            :value="option.value"
            :class="[
              'relative cursor-pointer select-none py-1.5 pl-3 pr-9 transition-[background-color] duration-150',
              'data-[focus]:bg-hover data-[focus]:text-text',
              'data-[selected]:font-semibold',
            ]"
          >
            <span :class="['block truncate', option.value === modelValue ? 'text-accent' : 'text-text']">
              {{ option.label }}
            </span>
            <span v-if="option.value === modelValue" class="absolute inset-y-0 right-0 flex items-center pr-3 text-accent">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
              </svg>
            </span>
          </ListboxOption>
        </ListboxOptions>
      </div>
    </Listbox>
  </div>
</template>
```

**设计要点：**
- `v-model` 双向绑定
- 下拉面板使用唯一的允许阴影 `shadow-[0_2px_8px_rgba(0,0,0,0.06)]`
- `data-[focus]` 替代 Headless UI v1 的 `active` class（v1 用 `ui-active`，按实际版本调整）
- 选中项带 ✓ 和 accent 色标记

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/components/ui/SelectListbox.vue
git commit -m "feat(ui): add SelectListbox shared component using Headless UI Listbox"
```

---

### Task 3: 创建 OptionRadioGroup.vue

**目标：** 替换按钮组式单选（字符集切换、UUID 版本选择），提供无障碍的 RadioGroup。

**Files:**
- Create: `src/components/ui/OptionRadioGroup.vue`

**Step 1: 创建 OptionRadioGroup.vue**

```vue
<script setup lang="ts">
import { RadioGroup, RadioGroupOption } from '@headlessui/vue';

export interface RadioOption<T = string> {
  value: T;
  label: string;
}

const props = defineProps<{
  options: RadioOption[];
  modelValue: string;
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">{{ label }}</span>
    <RadioGroup :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" class="flex gap-1 flex-wrap">
      <RadioGroupOption
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
        :class="[
          'px-2 py-1 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          modelValue === option.value
            ? 'bg-accent border-accent text-white'
            : 'bg-surface border-border text-text hover:bg-hover hover:border-accent',
        ]"
      >
        {{ option.label }}
      </RadioGroupOption>
    </RadioGroup>
  </div>
</template>
```

**设计要点：**
- 外观与现有按钮组完全一致，但获得键盘导航和 ARIA 属性
- `v-model` 双向绑定
- `focus-visible` 环形焦点

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/components/ui/OptionRadioGroup.vue
git commit -m "feat(ui): add OptionRadioGroup shared component using Headless UI RadioGroup"
```

---

### Task 4: 创建 ToggleSwitch.vue

**目标：** 替换布尔开关（UUID 转换开关），提供无障碍的 Switch。

**Files:**
- Create: `src/components/ui/ToggleSwitch.vue`

**Step 1: 创建 ToggleSwitch.vue**

```vue
<script setup lang="ts">
import { Switch } from '@headlessui/vue';

const props = defineProps<{
  modelValue: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <span v-if="label" class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">{{ label }}</span>
    <Switch
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-[background-color] duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        modelValue ? 'bg-accent' : 'bg-border',
      ]"
    >
      <span
        :class="[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          modelValue ? 'translate-x-4' : 'translate-x-0',
        ]"
      />
    </Switch>
    <span class="text-[0.8125rem] text-text">{{ modelValue ? '已开启' : '已关闭' }}</span>
  </div>
</template>
```

**设计要点：**
- 滑动开关外观，accent 色表示开启
- `focus-visible` 环形焦点
- 状态文字跟随开关状态

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/components/ui/ToggleSwitch.vue
git commit -m "feat(ui): add ToggleSwitch shared component using Headless UI Switch"
```

---

### Task 5: 创建 DisclosureSection.vue

**目标：** 替换 `<details>/<summary>`，提供无障碍的 Disclosure。

**Files:**
- Create: `src/components/ui/DisclosureSection.vue`

**Step 1: 创建 DisclosureSection.vue**

```vue
<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';

defineProps<{
  title: string;
}>();
</script>

<template>
  <Disclosure>
    <div class="border-t border-border pt-4">
      <DisclosureButton
        class="flex w-full items-center justify-between cursor-pointer text-[0.8125rem] text-muted hover:text-text transition-[color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      >
        <span>{{ title }}</span>
        <svg
          class="h-4 w-4 transition-transform duration-150 ui-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </DisclosureButton>
      <DisclosurePanel class="pt-2">
        <slot />
      </DisclosurePanel>
    </div>
  </Disclosure>
</template>
```

**设计要点：**
- 箭头旋转 180° 指示展开/折叠
- 与现有 `<details>` 视觉一致
- `focus-visible` 环形焦点

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/components/ui/DisclosureSection.vue
git commit -m "feat(ui): add DisclosureSection shared component using Headless UI Disclosure"
```

---

## Phase 2：迁移工具组件

### Task 6: 迁移 Base64Codec.vue

**目标：** 用 ModeTabGroup 替换手写模式切换，用 Tab Panel 组织输入/输出区域。

**Files:**
- Modify: `src/tools/encoding/Base64Codec.vue`

**变更点：**
1. 导入 `ModeTabGroup` 替换手写按钮组
2. `mode` ref 保留，通过 `v-model` 绑定
3. 移除手写 `:class` 动态模式按钮
4. 将输入/输出区域放入 `ModeTabGroup` 的 slot 中

**迁移前模式切换代码（删除）：**
```html
<div class="flex gap-1 mb-4">
  <button :class="[...]" @click="switchMode('encode')">编码</button>
  <button :class="[...]" @click="switchMode('decode')">解码</button>
</div>
```

**迁移后：**
```html
<ModeTabGroup
  v-model="mode"
  :options="[{ key: 'encode', label: '编码' }, { key: 'decode', label: '解码' }]"
>
  <template #encode>
    <!-- 编码输入区 -->
  </template>
  <template #decode>
    <!-- 解码输入区 -->
  </template>
</ModeTabGroup>
```

**注意：** Base64Codec 的编码和解码输入区差异较大（编码有文件上传），需要调整 slot 内容结构。switchMode 函数中的 `input.value = output.value` 逻辑需要保留在 mode watch 中。

**Step 1: 修改 Base64Codec.vue**

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/encoding/Base64Codec.vue
git commit -m "refactor(encoding): migrate Base64Codec to ModeTabGroup"
```

---

### Task 7: 迁移 UrlEncodeCodec.vue

**目标：** 用 ModeTabGroup 替换模式切换。

**Files:**
- Modify: `src/tools/encoding/UrlEncodeCodec.vue`

**变更点：** 与 Task 6 相同模式，替换按钮组为 ModeTabGroup。

**注意：** UrlEncodeCodec 的结果区域同时展示两种编码结果（encodeURIComponent / encodeURI），不需要 Tab Panel 分隔。ModeTabGroup 仅用于模式切换，不使用 slot。

**Step 1: 修改 UrlEncodeCodec.vue**

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/encoding/UrlEncodeCodec.vue
git commit -m "refactor(encoding): migrate UrlEncodeCodec to ModeTabGroup"
```

---

### Task 8: 迁移 DateTimeConverter.vue

**目标：** 用 ModeTabGroup 替换模式切换（时间戳→日期 / 日期→时间戳）。

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

**变更点：**
1. 替换按钮组为 ModeTabGroup
2. 两种输入模式放入各自的 Tab Panel
3. 去掉 `v-if` 切换，改用 slot

**Step 1: 修改 DateTimeConverter.vue**

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/datetime/DateTimeConverter.vue
git commit -m "refactor(datetime): migrate DateTimeConverter to ModeTabGroup"
```

---

### Task 9: 迁移 SymmetricCrypto.vue

**目标：** 用 ModeTabGroup + SelectListbox + DisclosureSection 全面迁移。

**Files:**
- Modify: `src/tools/crypto/SymmetricCrypto.vue`

**变更点：**
1. 模式切换 → `ModeTabGroup`
2. 算法 `<select>` → `SelectListbox`
3. 密钥长度 `<select>` → `SelectListbox`
4. `<details>` 高级选项 → `DisclosureSection`

**SelectListbox 用法示例：**
```html
<SelectListbox
  v-model="algorithm"
  label="算法"
  :options="[
    { value: 'AES-GCM', label: 'AES-GCM' },
    { value: 'AES-CBC', label: 'AES-CBC' },
    { value: 'AES-CTR', label: 'AES-CTR' },
  ]"
/>
```

**DisclosureSection 用法示例：**
```html
<DisclosureSection title="高级选项">
  <p class="text-[0.8125rem] text-muted m-0 leading-relaxed">
    当前算法：{{ algorithm }}，密钥长度：{{ keyLength }} 位。...
  </p>
</DisclosureSection>
```

**Step 1: 修改 SymmetricCrypto.vue**

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/crypto/SymmetricCrypto.vue
git commit -m "refactor(crypto): migrate SymmetricCrypto to Headless UI components"
```

---

### Task 10: 迁移 HashGenerator.vue

**目标：** 用 SelectListbox 替换输出格式下拉，用 ToggleSwitch 替换算法 checkbox（改为开关组）。

**Files:**
- Modify: `src/tools/crypto/HashGenerator.vue`

**变更点：**
1. 输出格式 `<select>` → `SelectListbox`
2. 算法 `<input type="checkbox">` → 多个 `ToggleSwitch` 或保持 checkbox 但加 `focus-visible` 样式

**设计决策：** 算法选择是多选，Headless UI 没有多选 Listbox（v1 不支持 `multiple`）。方案：
- **方案 A**：保持原生 checkbox，添加 `focus-visible:ring-2 focus-visible:ring-accent` 样式
- **方案 B**：用多个 ToggleSwitch，每个算法一个开关

**推荐方案 A**：保持 checkbox 更直观，只需补充无障碍样式。

**Step 1: 修改 HashGenerator.vue**
- 替换 `<select>` 为 SelectListbox
- 给 checkbox 添加 `focus-visible:ring-2 focus-visible:ring-accent rounded-sm`

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/crypto/HashGenerator.vue
git commit -m "refactor(crypto): migrate HashGenerator to SelectListbox"
```

---

### Task 11: 迁移 RandomStringGenerator.vue

**目标：** 用 OptionRadioGroup 替换字符集和大小写按钮组。

**Files:**
- Modify: `src/tools/text/RandomStringGenerator.vue`

**变更点：**
1. 字符集切换按钮组 → `OptionRadioGroup`
2. 大小写切换按钮组 → `OptionRadioGroup`

**注意：** 现有 `onCharsetModeChange` 函数会在切换到 `digits` 时重置 `letterCase`，这个逻辑需要保留在 RadioGroup 的 `@update:modelValue` 中。

**Step 1: 修改 RandomStringGenerator.vue**

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/text/RandomStringGenerator.vue
git commit -m "refactor(text): migrate RandomStringGenerator to OptionRadioGroup"
```

---

### Task 12: 迁移 UuidGenerator.vue

**目标：** 用 OptionRadioGroup 替换版本选择，用 ToggleSwitch 替换转换开关。

**Files:**
- Modify: `src/tools/text/UuidGenerator.vue`

**变更点：**
1. UUID 版本选择按钮组 → `OptionRadioGroup`
2. 转换开关按钮 → `ToggleSwitch`
3. `onVersionChange` 逻辑保留

**Step 1: 修改 UuidGenerator.vue**

**Step 2: 启动 dev server 验证**

**Step 3: Commit**

```bash
git add src/tools/text/UuidGenerator.vue
git commit -m "refactor(text): migrate UuidGenerator to OptionRadioGroup + ToggleSwitch"
```

---

## Phase 3：全局验证与收尾

### Task 13: 全局 dev build 验证

**目标：** 确保所有页面正常渲染、交互正常、无控制台报错。

**Step 1: 运行 build**

Run: `pnpm build`
Expected: 无错误

**Step 2: 运行 preview 逐页验证**

Run: `pnpm preview`

逐页检查：
- [ ] /base64 — Tab 切换正常
- [ ] /url-encode — Tab 切换正常
- [ ] /datetime-converter — Tab 切换正常
- [ ] /symmetric-crypto — Tab + Listbox + Disclosure 正常
- [ ] /hash-generator — Listbox + checkbox 正常
- [ ] /random-string — RadioGroup 正常
- [ ] /uuid-generator — RadioGroup + Switch 正常
- [ ] /jwt-parser — 无变更，确认无回归
- [ ] /device-info — 无变更，确认无回归

**Step 3: 运行现有单元测试**

Run: `pnpm test`
Expected: 全部通过

**Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: address issues found during global verification"
```

---

### Task 14: 更新 STRUCTURE.md

**目标：** 反映新增的共享组件和架构变更。

**Files:**
- Modify: `STRUCTURE.md`

**变更点：**
- 在 `src/components/ui/` 下添加新增的 5 个共享组件
- 更新架构分层说明，明确 Headless UI 包装组件的职责

**Step 1: 修改 STRUCTURE.md**

**Step 2: Commit**

```bash
git add STRUCTURE.md
git commit -m "docs: update STRUCTURE.md with Headless UI shared components"
```

---

## 不迁移的组件说明

| 组件 | 原因 |
|------|------|
| JwtParser.vue | 纯输入→展示，无交互控件需迁移 |
| DeviceInfo.vue | 纯展示 + textarea，无交互控件需迁移 |
| CopyButton.vue | 简单按钮，Headless UI 无对应组件 |
| ClearButton.vue | 简单按钮，Headless UI 无对应组件 |
| ToolHeader.vue | 标题展示 + 按钮，无需迁移 |

---

## 风险与注意事项

1. **Headless UI v1 class API**：v1 使用 `ui-active` / `ui-selected` / `ui-open` 等特殊 class 前缀，非 `data-*` 属性。实际编码时需确认安装版本的具体 API。
2. **Tab Panel 布局**：ModeTabGroup 使用 Tab Panel 时，切换可能影响 DOM 挂载（Panel 默认不渲染非活跃面板），需注意表单状态保持。
3. **SelectListbox 层叠**：下拉面板需要 `z-10` + 正确的定位，在 Astro 岛屿内可能有层叠上下文问题。
4. **渐进式迁移**：每个 Task 独立 commit，可随时回退单个组件。
5. **Tailwind v4 兼容**：`focus-visible:ring-*` 在 Tailwind v4 中语法不变，但需确认 `data-[focus]` 是否需要用 Tailwind v4 的 `@data` 变体。
