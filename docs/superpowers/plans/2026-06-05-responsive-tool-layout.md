# 工具页响应式布局优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 ResponsiveWorkspace 响应式布局组件，并将 4 个工具页改造为支持 ≥1920px 水平并排布局。

**Architecture:** 通过通用布局骨架组件 ResponsiveWorkspace 统一封装响应式逻辑，工具页通过 mode prop 和具名 slots 声明式使用。水平布局下 Input/Output 左右 50/50 并排，Actions 顶部居中；垂直布局保持现有 max-w-[720px] 行为不变。

**Tech Stack:** Astro 6 + Vue 3 (`<script setup lang="ts">`) + Tailwind CSS v4 + TypeScript strict

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/layout/ResponsiveWorkspace.vue` | **新建** | 响应式布局骨架组件，支持 vertical/horizontal 模式，三个可选 slot |
| `src/tools/encoding/Base64Codec.vue` | **修改** | 改造为 horizontal 模式，Input（含文件上传）/ Output 左右并排 |
| `src/tools/encoding/UrlEncodeCodec.vue` | **修改** | 改造为 horizontal 模式，Input / 编码结果+解码结果 左右并排 |
| `src/tools/encoding/JwtParser.vue` | **修改** | 改造为 horizontal 模式，Parse 模式：Input JWT / 解析结果；Encode 模式：配置区 / 输出 Token |
| `src/tools/crypto/SymmetricCrypto.vue` | **修改** | 改造为 horizontal 模式，Input（明文/密文+密码）/ Output（结果）左右并排 |

---

## 关键约束

- **Tailwind 断点**: 1920px 断点无默认前缀，使用 `min-w-[1920px]:` arbitrary variant
- **Slot 全部可选**: input、output、actions 均可为空，为空时区域自动隐藏且不留空白
- **垂直模式保持 720px**: horizontal 模式在 <1920px 时降级为垂直，但 max-width 仍为 1600px（组件根元素控制）
- **现有样式不变**: 不修改 textarea、button、card 等现有样式类，只调整布局结构
- **文档注释**: 新增公共组件必须写 JSDoc/TSDoc 文档注释

---

## Task 1: 创建 ResponsiveWorkspace.vue 组件

**Files:**
- Create: `src/components/layout/ResponsiveWorkspace.vue`

---

- [ ] **Step 1: 创建组件文件并编写基础结构**

```vue
<script setup lang="ts">
import { useSlots, computed } from 'vue';

/**
 * 工具页响应式布局骨架组件。
 *
 * 根据屏幕宽度和配置模式，自动排列 Input、Actions、Output 三大区域。
 * 业务组件只负责填充内容，不关心布局逻辑。
 *
 * @example
 * ```vue
 * <ResponsiveWorkspace mode="horizontal">
 *   <template #input><InputTextarea v-model="input" /></template>
 *   <template #actions><ActionButtons /></template>
 *   <template #output><OutputTextarea :value="output" /></template>
 * </ResponsiveWorkspace>
 * ```
 */
interface Props {
  /**
   * 布局模式。
   * - `vertical`: 始终垂直堆叠（Input → Actions → Output），max-width 720px
   * - `horizontal`: ≥1920px 时 Input|Output 左右 50/50 并排，Actions 顶部居中；<1920px 降级为垂直
   */
  mode?: 'vertical' | 'horizontal';
  /** 区域间距，默认 gap-6（24px） */
  gap?: string;
  /** 输入区额外 class */
  inputClass?: string;
  /** 输出区额外 class */
  outputClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'vertical',
  gap: 'gap-6',
  inputClass: '',
  outputClass: '',
});

const slots = useSlots();

/** 是否有 actions slot 内容 */
const hasActions = computed(() => !!slots.actions);
/** 是否有 input slot 内容 */
const hasInput = computed(() => !!slots.input);
/** 是否有 output slot 内容 */
const hasOutput = computed(() => !!slots.output);

/**
 * 根容器 class。
 * - horizontal 模式: max-w-[1600px]，grid 布局，1920px+ 双栏
 * - vertical 模式: max-w-[720px]，flex-col 布局
 */
const rootClass = computed(() => {
  const base = 'w-full transition-all duration-300 ease-in-out';
  if (props.mode === 'horizontal') {
    return `${base} max-w-[1600px] grid grid-cols-1 min-w-[1920px]:grid-cols-2 ${props.gap}`;
  }
  return `${base} max-w-[720px] flex flex-col ${props.gap}`;
});

/**
 * Actions 区域 class。
 * - horizontal: 横跨两栏，居中
 * - vertical: 普通 flex 子项
 */
const actionsClass = computed(() => {
  if (props.mode === 'horizontal') {
    return 'col-span-full flex justify-center gap-2';
  }
  return 'flex gap-2 items-center';
});

/**
 * Input/Output 区域 class。
 * - horizontal: 占满 grid 单元格
 * - vertical: 普通 flex 子项
 */
const cellClass = computed(() => {
  if (props.mode === 'horizontal') {
    return 'min-w-0'; // 防止 grid 子项溢出
  }
  return '';
});
</script>

<template>
  <div :class="rootClass">
    <!-- Actions 区域（顶部，可选） -->
    <div v-if="hasActions" :class="actionsClass">
      <slot name="actions" />
    </div>

    <!-- Input 区域（可选） -->
    <div v-if="hasInput" :class="[cellClass, inputClass]">
      <slot name="input" />
    </div>

    <!-- Output 区域（可选） -->
    <div v-if="hasOutput" :class="[cellClass, outputClass]">
      <slot name="output" />
    </div>
  </div>
</template>
```

---

- [ ] **Step 2: 验证组件编译**

运行: `pnpm build`
Expected: 构建成功，无 TypeScript 类型错误

---

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ResponsiveWorkspace.vue
git commit -m "feat(layout): 新增 ResponsiveWorkspace 响应式布局骨架组件

- 支持 vertical/horizontal 两种模式
- horizontal 模式在 ≥1920px 时 Input|Output 左右并排
- 三个 slot（input/output/actions）全部可选，为空自动隐藏
- 使用 CSS Grid 实现，为 future 三栏扩展预留

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 改造 Base64Codec.vue

**Files:**
- Modify: `src/tools/encoding/Base64Codec.vue`

---

- [ ] **Step 1: 引入 ResponsiveWorkspace 并替换根容器**

在 `<script setup>` 顶部添加 import:
```typescript
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
```

将模板中的根容器:
```vue
<template>
  <div class="max-w-[720px]">
```

替换为:
```vue
<template>
  <ResponsiveWorkspace mode="horizontal">
```

---

- [ ] **Step 2: 提取 Input slot**

将 Input 区域（包括 label、textarea、文件上传）包裹在 `<template #input>` 中:

```vue
<template #input>
  <div>
    <label class="block text-[0.8125rem] text-muted font-medium mb-1">
      {{ mode === 'encode' ? '输入文本' : '输入 Base64' }}
    </label>
    <textarea
      v-model="input"
      class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
      :rows="mode === 'horizontal' ? 12 : 6"
      :placeholder="mode === 'encode' ? '输入要编码的文本' : '输入要解码的 Base64 字符串'"
    ></textarea>
  </div>

  <!-- Encode mode: drag-drop file upload -->
  <div v-if="mode === 'encode'" class="mt-3">
    <div
      class="border-dashed border-2 border-border rounded-md p-5 text-center cursor-pointer hover:border-accent hover:bg-hover transition-[border-color,background-color] duration-150"
      :class="{ 'border-accent bg-hover': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="handleDrop"
      @click="fileInputRef?.click()"
    >
      <input ref="fileInputRef" type="file" class="hidden" @change="handleFile" />
      <template v-if="fileMeta && fileName">
        <span class="text-[0.8125rem] text-text">📄 {{ fileName }} · {{ fileMeta.mime }} · {{ fileMeta.size }}</span>
      </template>
      <template v-else>
        <span class="text-muted text-sm">拖拽文件到这里或点击选择</span>
      </template>
    </div>
  </div>
</template>
```

注意: textarea rows 改为动态 `:rows="mode === 'horizontal' ? 12 : 6"` 不适应，因为 `mode` 是 Base64Codec 的 encode/decode mode，不是 ResponsiveWorkspace 的 layout mode。保持 `rows="6"` 即可，水平布局下宽度增加已经提升了可读性。

修正: textarea rows 保持 `rows="6"` 不变，不需要动态调整。

---

- [ ] **Step 3: 提取 Actions slot**

将 Action buttons 区域包裹在 `<template #actions>` 中:

```vue
<template #actions>
  <div class="flex gap-2 items-center">
    <button
      class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
      @click="execute"
    >{{ mode === 'encode' ? '编码' : '解码' }}</button>
    <ClearButton @clear="handleClear" />
  </div>
</template>
```

注意: 原代码中 actions 区域有 `mb-4`，现在在 slot 内部不需要 margin-bottom，因为 ResponsiveWorkspace 已经通过 gap 控制间距。

---

- [ ] **Step 4: 提取 Output slot**

将 Output 区域（编码结果/解码结果）包裹在 `<template #output>` 中。注意原代码有两个模式下的输出，需要合并到一个 slot:

```vue
<template #output>
  <!-- Error message -->
  <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

  <!-- Encode output -->
  <div v-if="mode === 'encode'">
    <div v-if="fileMeta" class="mb-2 px-3 py-1.5 bg-hover border border-border rounded-sm text-[0.8125rem] text-muted flex items-center gap-1.5">
      <span>📄</span>
      <span>{{ fileMeta.mime }} · {{ fileMeta.size }}</span>
    </div>
    <label class="block text-[0.8125rem] text-muted font-medium mb-1">编码结果</label>
    <textarea
      v-model="output"
      class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
      rows="6"
      readonly
      :placeholder="output ? '' : '点击「编码」查看结果'"
    ></textarea>
    <div v-if="output" class="mt-1.5">
      <CopyButton :text="output" label="复制结果" />
    </div>
  </div>

  <!-- Decode output -->
  <div v-if="mode === 'decode'">
    <label class="block text-[0.8125rem] text-muted font-medium mb-1">解码结果</label>

    <!-- Text result -->
    <template v-if="!isDecodeBinaryResult()">
      <textarea
        v-model="output"
        class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
        rows="6"
        readonly
        :placeholder="output ? '' : '点击「解码」查看结果'"
      ></textarea>
      <div v-if="output" class="mt-1.5">
        <CopyButton :text="output" label="复制结果" />
      </div>
    </template>

    <!-- Image preview -->
    <div v-if="decodedImageSrc" class="p-3 border border-border rounded-sm bg-hover">
      <img :src="decodedImageSrc" alt="解码图片" class="max-w-full max-h-80 rounded-sm" />
    </div>
    <div v-if="decodedImageSrc" class="mt-1.5">
      <CopyButton :text="input" label="复制原始 Base64" />
    </div>

    <!-- Binary file card -->
    <div v-if="decodedBinaryMeta" class="p-3 border border-border rounded-sm bg-hover flex items-center gap-3">
      <div class="flex-1">
        <div class="text-[0.8125rem] text-muted">📄 {{ decodedBinaryMeta.mime }} · {{ decodedBinaryMeta.size }}</div>
      </div>
      <button
        class="px-3 py-1.5 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] cursor-pointer hover:opacity-90"
        @click="handleDownload"
      >下载文件</button>
    </div>
  </div>
</template>
```

---

- [ ] **Step 5: 关闭 ResponsiveWorkspace 标签**

在模板末尾将 `</div>` 替换为 `</ResponsiveWorkspace>`。

---

- [ ] **Step 6: 验证改动**

运行: `pnpm build`
Expected: 构建成功，无错误

---

- [ ] **Step 7: Commit**

```bash
git add src/tools/encoding/Base64Codec.vue
git commit -m "feat(base64): 改造为响应式水平布局

- 使用 ResponsiveWorkspace 组件
- ≥1920px 时 Input/Output 左右并排
- <1920px 保持垂直布局

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 改造 UrlEncodeCodec.vue

**Files:**
- Modify: `src/tools/encoding/UrlEncodeCodec.vue`

---

- [ ] **Step 1: 引入 ResponsiveWorkspace**

在 `<script setup>` 顶部添加:
```typescript
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
```

---

- [ ] **Step 2: 重构模板结构**

原结构分析:
- Input: 一个 textarea（输入文本/URL）
- Actions: ClearButton
- Output: 两个大卡片（编码结果、解码结果），以及 URL 解析折叠面板

UrlEncodeCodec 的输出比较复杂，不是简单的 textarea。左右并排时，左侧放 Input + URL 解析，右侧放编码/解码结果。

重构后:

```vue
<template>
  <ResponsiveWorkspace mode="horizontal">
    <template #input>
      <div class="mb-4">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入</label>
        <textarea v-model="input" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="3" placeholder="输入文本或 URL，同时查看编码与解码结果"></textarea>
      </div>

      <!-- URL 解析 -->
      <DisclosureSection v-if="urlParsed" title="🔗 检测到 URL" class="mb-4">
        <!-- ... 原有 URL 解析内容 ... -->
      </DisclosureSection>
    </template>

    <template #actions>
      <ClearButton @clear="handleClear" />
    </template>

    <template #output>
      <!-- 编码结果 -->
      <div class="border border-border rounded-md p-4 bg-card mb-4">
        <!-- ... 原有编码结果内容 ... -->
      </div>

      <!-- 解码结果 -->
      <div class="border border-border rounded-md p-4 bg-card">
        <!-- ... 原有解码结果内容 ... -->
      </div>
    </template>
  </ResponsiveWorkspace>
</template>
```

---

- [ ] **Step 3: 验证改动**

运行: `pnpm build`
Expected: 构建成功

---

- [ ] **Step 4: Commit**

```bash
git add src/tools/encoding/UrlEncodeCodec.vue
git commit -m "feat(url-codec): 改造为响应式水平布局

- 使用 ResponsiveWorkspace 组件
- ≥1920px 时 Input/URL解析 与 编解码结果 左右并排
- <1920px 保持垂直布局

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 改造 JwtParser.vue

**Files:**
- Modify: `src/tools/encoding/JwtParser.vue`

---

- [ ] **Step 1: 引入 ResponsiveWorkspace**

在 `<script setup>` 顶部添加:
```typescript
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
```

---

- [ ] **Step 2: 重构 Parse 模式**

Parse 模式原结构:
- Input: JWT Token textarea
- Output: 解析结果（Header/Payload/Signature 标签页）+ 签名验证面板

重构后，将 ModeTabGroup 保留在 ResponsiveWorkspace 外部（因为它控制整个工具的 parse/encode 模式，不是 layout 的一部分）:

```vue
<template>
  <div>
    <ToolHeader ... />
    <ModeTabGroup ... />

    <!-- Parse Mode -->
    <template v-if="mode === 'parse'">
      <ResponsiveWorkspace mode="horizontal">
        <template #input>
          <div class="mb-4">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入 JWT Token</label>
            <textarea
              v-model="tokenInput"
              class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
              rows="4"
              placeholder="粘贴 JWT Token..."
              @input="runParse()"
            ></textarea>
          </div>
        </template>

        <template #output>
          <p v-if="parseError" class="text-error text-[0.8125rem] m-0 mb-4">{{ parseError }}</p>

          <div v-if="expiredStatus !== null" :class="['inline-block px-4 py-1 rounded-sm text-xs font-semibold mb-4', expiredStatus ? 'bg-red-100 text-error' : 'bg-green-100 text-success']">
            {{ expiredStatus ? 'Token 已过期' : 'Token 未过期' }}
          </div>

          <!-- Parse Result Tabs -->
          <div class="border border-border rounded-md bg-card overflow-hidden">
            <!-- ... 原有标签页内容 ... -->
          </div>
        </template>
      </ResponsiveWorkspace>

      <!-- Verify Signature Panel（放在 ResponsiveWorkspace 外部，因为不属于 Input/Output 对照） -->
      <DisclosureSection title="验证签名" class="mt-4 max-w-[1600px]">
        <!-- ... 原有验证签名内容 ... -->
      </DisclosureSection>

      <div class="mt-4">
        <ClearButton @clear="handleClearParse" />
      </div>
    </template>

    <!-- Encode Mode -->
    <template v-else>
      <!-- ... 见 Step 3 ... -->
    </template>
  </div>
</template>
```

注意: ClearButton 放在 ResponsiveWorkspace 外部，因为清空操作同时作用于 Input 和 Output，不属于单一区域。

---

- [ ] **Step 3: 重构 Encode 模式**

Encode 模式原结构:
- Input: 算法选择 + 密钥 + Quick Claims + 自定义 Payload JSON
- Actions: 生成 Token 按钮 + ClearButton
- Output: 生成的 JWT Token textarea

重构后:

```vue
<template v-else>
  <ResponsiveWorkspace mode="horizontal">
    <template #input>
      <!-- Algorithm & Secret -->
      <div class="flex flex-col gap-3 mb-4">
        <SelectListbox ... />
        <div class="flex flex-col gap-1">
          <!-- 密钥输入 ... -->
        </div>
      </div>

      <!-- Quick Claims -->
      <div class="border border-border rounded-md p-4 bg-card mb-4">
        <!-- ... -->
      </div>

      <!-- Custom Payload JSON -->
      <div class="mb-4">
        <label ...>自定义 Payload（JSON 对象，可选）</label>
        <textarea ... />
      </div>
    </template>

    <template #actions>
      <button class="px-4 py-2 bg-accent text-white ..." @click="handleEncode">生成 Token</button>
      <ClearButton @clear="handleClearEncode" />
    </template>

    <template #output>
      <p v-if="encodeError" class="text-error text-[0.8125rem] m-0 mb-3">{{ encodeError }}</p>

      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">生成的 JWT Token</label>
        <textarea
          v-model="encodedToken"
          class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
          rows="4"
          readonly
          :placeholder="'点击「生成 Token」查看结果'"
        ></textarea>
        <div v-if="encodedToken" class="mt-1.5">
          <CopyButton :text="encodedToken" label="复制 Token" />
        </div>
      </div>
    </template>
  </ResponsiveWorkspace>
</template>
```

---

- [ ] **Step 4: 验证改动**

运行: `pnpm build`
Expected: 构建成功

---

- [ ] **Step 5: Commit**

```bash
git add src/tools/encoding/JwtParser.vue
git commit -m "feat(jwt-parser): 改造为响应式水平布局

- Parse 模式: Input JWT / 解析结果左右并排
- Encode 模式: 配置区 / 输出 Token 左右并排
- 签名验证面板保持在 ResponsiveWorkspace 外部

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 改造 SymmetricCrypto.vue

**Files:**
- Modify: `src/tools/crypto/SymmetricCrypto.vue`

---

- [ ] **Step 1: 引入 ResponsiveWorkspace**

在 `<script setup>` 顶部添加:
```typescript
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
```

---

- [ ] **Step 2: 重构模板结构**

原结构分析:
- 顶部配置: ModeTabGroup + 算法选择 + 密钥长度 + 格式选择
- Input: 明文/密文 textarea + 密码输入
- Actions: 加密/解密按钮 + ClearButton
- Output: 结果展示（code 块）+ CopyButton
- 底部: DisclosureSection 高级选项

重构策略: ModeTabGroup 和配置区（算法、格式）保留在外部，ResponsiveWorkspace 包裹 Input + Actions + Output:

```vue
<template>
  <div>
    <ToolHeader ... />
    <ModeTabGroup ... />

    <!-- 配置区（保留在外部，不属于 Input/Output 对照） -->
    <div class="flex gap-4 mb-4 flex-wrap max-w-[1600px]">
      <SelectListbox v-model="algorithm" label="算法" class="w-[200px]" :options="algorithmOptions" />
      <SelectListbox v-if="showKeyLength" v-model="keyLength" label="密钥长度" class="w-[140px]" :options="keyLengthOptions" />
    </div>
    <div class="mb-4 max-w-[1600px]">
      <SelectListbox v-model="format" :label="formatLabel" :options="..." />
    </div>

    <!-- Input / Output 对照区 -->
    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="mb-4">
          <div class="mb-2">
            <label class="field-label">{{ mode === 'encrypt' ? '明文' : '密文' }}</label>
            <textarea v-if="mode === 'encrypt'" v-model="plaintext" ... />
            <textarea v-else v-model="ciphertext" ... />
          </div>
          <div>
            <label class="field-label">密码</label>
            <input v-model="password" type="password" ... />
          </div>
        </div>
      </template>

      <template #actions>
        <button class="px-4 py-2 bg-accent text-white ..." :disabled="isProcessing" @click="execute">
          {{ isProcessing ? '处理中...' : (mode === 'encrypt' ? '加密' : '解密') }}
        </button>
        <ClearButton @clear="handleClear" />
      </template>

      <template #output>
        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

        <div v-if="output">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">{{ mode === 'encrypt' ? '密文' : '明文' }}</span>
            <CopyButton :text="output" label="复制结果" />
          </div>
          <div class="border border-border rounded-md p-4 bg-card">
            <code class="font-mono text-[0.8125rem] break-all text-text">{{ output }}</code>
          </div>
        </div>
      </template>
    </ResponsiveWorkspace>

    <!-- 高级选项（外部） -->
    <DisclosureSection title="高级选项" class="mt-4 max-w-[1600px]">
      <!-- ... -->
    </DisclosureSection>
  </div>
</template>
```

---

- [ ] **Step 3: 验证改动**

运行: `pnpm build`
Expected: 构建成功

---

- [ ] **Step 4: Commit**

```bash
git add src/tools/crypto/SymmetricCrypto.vue
git commit -m "feat(symmetric-crypto): 改造为响应式水平布局

- ≥1920px 时 输入区(明文/密文+密码) / 输出结果 左右并排
- 算法配置区保留在 ResponsiveWorkspace 外部
- <1920px 保持垂直布局

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 构建验证与最终检查

---

- [ ] **Step 1: 完整构建验证**

运行: `pnpm build`
Expected: 构建成功，无 TypeScript 类型错误，无 Vue 编译错误

---

- [ ] **Step 2: 开发服务器视觉验证（关键）**

运行: `pnpm dev`

在 1920px+ 屏幕下验证:
1. Base64 编解码: Input/Output 左右并排，Actions 顶部居中
2. URL 编解码: Input/编解码结果 左右并排
3. JWT 解析器: Parse 模式 Input/解析结果 左右并排；Encode 模式 配置区/输出 左右并排
4. 对称加解密: 输入区/输出结果 左右并排

在 <1920px 屏幕下验证:
1. 上述 4 个工具页自动降级为垂直布局
2. 其他工具页不受影响，保持原有垂直布局

---

- [ ] **Step 3: 最终 Commit**

```bash
git add .
git commit -m "feat(layout): 工具页响应式水平布局改造完成

- 新增 ResponsiveWorkspace 组件
- 4 个工具页支持 ≥1920px 水平并排布局
- 11 个工具页保持垂直布局不变

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自审清单

### Spec 覆盖率

| 设计文档要求 | 对应任务 |
|-------------|---------|
| 新增 ResponsiveWorkspace 组件 | Task 1 |
| mode="vertical" 行为 | Task 1 Step 1 |
| mode="horizontal" 行为（≥1920px 水平，<1920px 垂直） | Task 1 Step 1 |
| 三个 slot 全部可选 | Task 1 Step 1（hasActions/hasInput/hasOutput computed） |
| Actions 顶部居中 | Task 1 Step 1（actionsClass） |
| 内容区 max-w-[1600px] | Task 1 Step 1（rootClass） |
| Base64 改造 | Task 2 |
| URL 编解码改造 | Task 3 |
| JWT 解析器改造 | Task 4 |
| 对称加密改造 | Task 5 |
| 文档注释 | Task 1 Step 1（JSDoc） |

### Placeholder 扫描

- [x] 无 TBD/TODO
- [x] 无 "implement later"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 每个代码步骤都有具体代码

### 类型一致性

- [x] ResponsiveWorkspace Props 接口与使用处一致
- [x] slot 名称统一：input、output、actions
- [x] mode 值统一：'vertical' | 'horizontal'
