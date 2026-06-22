# FileDropzone 可复用文件选择组件实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 `FileDropzone.vue` 可复用文件选择组件，先在 `ImageScrambler.vue` 中落地，解决必须清空才能重选同一文件的问题。

**Architecture:** 将隐藏 input、点击触发、拖拽高亮、粘贴监听、文件校验等重复逻辑封装到一个受控 Vue 组件中。组件只负责「把文件交出来」，业务解码与展示由调用方通过 slot 处理。核心校验函数 `validateFile` 从组件导出以便单元测试。

**Tech Stack:** Astro 6 + Vue 3 (`<script setup lang="ts">`) + Tailwind CSS v4 + Vitest。不引入新依赖。

## Global Constraints

- 所有新增公共函数/组件必须写 JSDoc/TSDoc 文档注释。
- 不使用路径别名，导入使用相对路径（如 `../../utils/media/image-convert`）。
- 错误提示使用中文。
- 组件样式必须使用 DESIGN.md 设计令牌（`border-border`、`border-accent`、`bg-hover` 等）。
- 单元测试文件放在被测模块所在目录的 `__tests__/` 子目录中。
- 构建命令：`pnpm build`；测试命令：`pnpm test`；类型检查：`pnpm astro check`。

---

### Task 1: 创建 `FileDropzone.vue` 组件

**Files:**
- Create: `src/components/ui/FileDropzone.vue`

**Interfaces:**
- Consumes: `formatBytes` from `../../utils/media/image-convert`
- Produces: `FileDropzone` Vue 组件；命名导出 `validateFile(file, accept?, maxSize?)` 供测试使用

- [ ] **Step 1: 创建组件文件**

  新建 `src/components/ui/FileDropzone.vue`，完整内容如下：

  ```vue
  <script setup lang="ts">
  /**
   * 通用文件拖拽/点击/粘贴选择区。
   *
   * 支持点击选择、拖拽上传、剪贴板粘贴，内置文件类型与大小校验。
   * 选中文件后通过 `select` 事件与 `update:modelValue` 抛出，调用方负责后续处理。
   */
  import { computed, ref, onMounted, onUnmounted } from 'vue';
  import { formatBytes } from '../../utils/media/image-convert';

  interface Props {
    /** 当前已选文件（受控） */
    modelValue?: File | null;
    /** accept 属性，与原生 input 一致，如 "image/*" 或 ".json" */
    accept?: string;
    /** 文件大小上限（字节），0 表示不限 */
    maxSize?: number;
    /** 是否启用拖拽（默认 true） */
    enableDrag?: boolean;
    /** 是否监听全局 paste 事件（默认 false） */
    enablePaste?: boolean;
    /** 是否显示内置删除 ICON（默认 true） */
    clearable?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    modelValue: null,
    enableDrag: true,
    enablePaste: false,
    clearable: true,
  });

  const emit = defineEmits<{
    'update:modelValue': [file: File | null];
    /** 用户通过点击、拖拽、粘贴选中有效文件时触发 */
    select: [file: File];
    /** 点击内置删除 ICON 时触发 */
    clear: [];
    /** 校验失败时触发，消息为中文 */
    error: [message: string];
  }>();

  const isDragging = ref(false);
  const inputRef = ref<HTMLInputElement | null>(null);

  const hasFile = computed(() => props.modelValue != null);

  /**
   * 校验文件是否满足 accept 与 maxSize 约束。
   *
   * @param file 待校验文件
   * @param accept 接受的 MIME 类型或扩展名，如 "image/*"、".json"
   * @param maxSize 文件大小上限（字节）
   * @returns 空字符串表示通过，否则为中文错误描述
   */
  export function validateFile(file: File, accept?: string, maxSize?: number): string {
    if (accept && accept.trim()) {
      const tokens = accept
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const accepted = tokens.some((token) => {
        const lowerToken = token.toLowerCase();
        if (lowerToken.startsWith('.')) {
          return file.name.toLowerCase().endsWith(lowerToken);
        }
        if (lowerToken.endsWith('/*')) {
          return file.type.startsWith(lowerToken.slice(0, -1));
        }
        return file.type === token;
      });
      if (!accepted) return `文件类型不符，请上传 ${accept} 格式`;
    }

    if (maxSize && maxSize > 0 && file.size > maxSize) {
      return `文件过大（${formatBytes(file.size)}），超过 ${formatBytes(maxSize)} 上限`;
    }

    return '';
  }

  function processFile(file: File | undefined | null): void {
    if (!file) return;
    const error = validateFile(file, props.accept, props.maxSize);
    if (error) {
      emit('error', error);
      return;
    }
    emit('update:modelValue', file);
    emit('select', file);
  }

  function handleClick(): void {
    if (inputRef.value) inputRef.value.value = '';
    inputRef.value?.click();
  }

  function handleChange(event: Event): void {
    processFile((event.target as HTMLInputElement).files?.[0]);
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    isDragging.value = false;
    processFile(event.dataTransfer?.files?.[0]);
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
    isDragging.value = true;
  }

  function handleDragLeave(): void {
    isDragging.value = false;
  }

  function handlePaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          processFile(file);
          return;
        }
      }
    }
  }

  function handleClear(): void {
    emit('update:modelValue', null);
    emit('clear');
  }

  onMounted(() => {
    if (props.enablePaste) window.addEventListener('paste', handlePaste);
  });

  onUnmounted(() => {
    if (props.enablePaste) window.removeEventListener('paste', handlePaste);
  });
  </script>

  <template>
    <div
      class="relative border-2 border-dashed rounded-lg min-h-[400px] flex flex-col transition-[border-color,background-color] duration-150"
      :class="[isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent']"
      @click="handleClick"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <button
        v-if="clearable && hasFile"
        type="button"
        class="absolute top-3 right-3 z-10 p-1.5 rounded-sm text-muted hover:text-error hover:bg-hover transition-[color,background-color] duration-150 cursor-pointer"
        aria-label="删除已选文件"
        @click.stop="handleClear"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>

      <input
        ref="inputRef"
        type="file"
        class="hidden"
        :accept="accept"
        @change="handleChange"
        @click.stop
      />

      <div class="flex-1 flex flex-col items-center justify-center w-full">
        <slot>
          <div class="text-sm text-text">拖入文件 / 点击选择</div>
          <div v-if="accept" class="text-xs text-muted mt-1">支持 {{ accept }} 格式</div>
        </slot>
      </div>
    </div>
  </template>
  ```

- [ ] **Step 2: 验证文件创建**

  运行：
  ```bash
  ls -la src/components/ui/FileDropzone.vue
  ```
  Expected: 文件存在。

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/ui/FileDropzone.vue
  git commit -m "feat(ui): add reusable FileDropzone component

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Task 2: 为 `validateFile` 编写单元测试

**Files:**
- Create: `src/components/ui/__tests__/FileDropzone.test.ts`

**Interfaces:**
- Consumes: `validateFile` named export from `../FileDropzone.vue`
- Produces: 通过/失败断言

- [ ] **Step 1: 创建测试文件**

  新建 `src/components/ui/__tests__/FileDropzone.test.ts`，内容如下：

  ```ts
  import { describe, it, expect } from 'vitest';
  import { validateFile } from '../FileDropzone.vue';

  describe('validateFile', () => {
    it('无限制时通过', () => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      expect(validateFile(file)).toBe('');
    });

    it('accept 为 MIME 通配时匹配', () => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      expect(validateFile(file, 'image/*')).toBe('');
    });

    it('accept 为具体 MIME 时匹配', () => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      expect(validateFile(file, 'image/png')).toBe('');
      expect(validateFile(file, 'image/jpeg')).toContain('文件类型不符');
    });

    it('accept 为扩展名时匹配（忽略大小写）', () => {
      const file = new File(['x'], 'a.PNG', { type: 'image/png' });
      expect(validateFile(file, '.png')).toBe('');
      expect(validateFile(file, '.json')).toContain('文件类型不符');
    });

    it('超出 maxSize 时报错', () => {
      const file = new File(['xx'], 'a.png', { type: 'image/png' });
      expect(validateFile(file, undefined, 1)).toContain('文件过大');
    });

    it('maxSize 为 0 时不限制', () => {
      const file = new File(['xx'], 'a.png', { type: 'image/png' });
      expect(validateFile(file, undefined, 0)).toBe('');
    });
  });
  ```

- [ ] **Step 2: 运行测试**

  运行：
  ```bash
  pnpm test src/components/ui/__tests__/FileDropzone.test.ts
  ```
  Expected: 全部测试通过。

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/ui/__tests__/FileDropzone.test.ts
  git commit -m "test(ui): add FileDropzone validation tests

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Task 3: 在 `ImageScrambler.vue` 中集成 `FileDropzone`

**Files:**
- Modify: `src/tools/media/ImageScrambler.vue`

**Interfaces:**
- Consumes: `FileDropzone` from `../../components/ui/FileDropzone.vue`
- Produces: 移除隐藏 input、拖拽状态、`ClearButton`；新增 `selectedFile` 与 FileDropzone 集成

- [ ] **Step 1: 修改 script setup**

  在 `src/tools/media/ImageScrambler.vue` 中：

  1. 将 `import ClearButton from '../../components/ui/ClearButton.vue';` 替换为：
     ```ts
     import FileDropzone from '../../components/ui/FileDropzone.vue';
     ```

  2. 删除以下两行：
     ```ts
     const fileInputRef = ref<HTMLInputElement | null>(null);
     const isDragging = ref(false);
     ```

  3. 在它们原来的位置添加：
     ```ts
     /** 当前通过 FileDropzone 选中的文件 */
     const selectedFile = ref<File | null>(null);
     ```

  4. 删除 `handleClear` 中重置 input value 的代码（保留其他重置逻辑）。即将：
     ```ts
     function handleClear(): void {
       resetState();
       errorMsg.value = '';
       seed.value = '';
       blockSize.value = 8;
       if (fileInputRef.value) fileInputRef.value.value = '';
     }
     ```
     改为：
     ```ts
     function handleClear(): void {
       resetState();
       errorMsg.value = '';
       seed.value = '';
       blockSize.value = 8;
     }
     ```

- [ ] **Step 2: 替换模板中的图片区**

  将模板中以下整个代码块（从 `<!-- 单一图片区：空态为上传区，有图态为当前展示图（置乱/还原在原位替换） -->` 开始到对应的 `</div>` 结束）：

  ```vue
    <!-- 单一图片区：空态为上传区，有图态为当前展示图（置乱/还原在原位替换） -->
    <div class="mt-4">
      <div
        v-if="!displayUrl"
        class="border-2 border-dashed rounded-lg p-10 min-h-[400px] flex flex-col items-center justify-center text-center cursor-pointer transition-[border-color] duration-150"
        :class="isDragging ? 'border-accent bg-hover' : 'border-border hover:border-accent'"
        @click="fileInputRef?.click()"
        @drop.prevent="(e) => { isDragging = false; const f = e.dataTransfer?.files?.[0]; if (f) void processFile(f); }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
      >
        <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
        <div class="text-xs text-muted mt-1">支持任意图片格式，上限 50MB</div>
      </div>

      <div v-else class="bg-hover border border-border rounded-sm p-4 flex flex-col gap-2">
        ...
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void processFile(f); }"
    />
  ```

  替换为：

  ```vue
    <!-- 单一图片区：FileDropzone 包裹空态与图片展示，内置删除入口 -->
    <div class="mt-4">
      <FileDropzone
        v-model="selectedFile"
        accept="image/*"
        :max-size="FILE_SIZE_LIMIT"
        enable-drag
        enable-paste
        clearable
        @select="(f) => void processFile(f)"
        @clear="handleClear"
        @error="(msg) => errorMsg = msg"
      >
        <template #default>
          <div v-if="!displayUrl" class="flex flex-col items-center justify-center text-center">
            <div class="text-sm text-text">拖入图片 / 点击选择 / Ctrl+V 粘贴</div>
            <div class="text-xs text-muted mt-1">支持任意图片格式，上限 50MB</div>
          </div>
          <div v-else class="w-full flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[0.8125rem] font-medium text-muted">{{ isProcessing ? '正在处理…' : stateLabel }}</span>
              <span class="text-xs text-muted font-mono">
                {{ dimensions?.width }}×{{ dimensions?.height }} · {{ formatBytes(currentSize) }}
              </span>
            </div>
            <img
              :src="displayUrl"
              :alt="stateLabel"
              class="max-h-[480px] w-full object-contain rounded-sm bg-white cursor-pointer"
            />
            <div v-if="displayLabel !== 'original' && originalSize && currentSize" class="text-xs text-muted">
              原图 {{ formatBytes(originalSize) }} → 当前 {{ formatBytes(currentSize) }}
              <span class="font-mono">（{{ sizeRatio >= 1 ? sizeRatio.toFixed(1) + ' 倍' : '更小' }}）</span>
            </div>
            <p v-if="displayLabel === 'scrambled' && originalSize && sizeRatio > 1.5" class="text-xs text-muted">
              混淆后像素被打乱为随机分布，PNG 无损压缩失效，体积显著增大属正常现象，不影响还原。
            </p>
          </div>
        </template>
      </FileDropzone>
    </div>
  ```

- [ ] **Step 3: 移除顶部操作区的 ClearButton**

  在模板中找到：
  ```vue
  <ClearButton @clear="handleClear" />
  ```
  删除这一行。

- [ ] **Step 4: 运行类型检查**

  运行：
  ```bash
  pnpm astro check
  ```
  Expected: 无类型错误。

- [ ] **Step 5: Commit**

  ```bash
  git add src/tools/media/ImageScrambler.vue
  git commit -m "feat(image-scrambler): integrate FileDropzone for re-selectable file picker

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Task 4: 验证与构建

**Files:**
- 修改：`src/tools/media/ImageScrambler.vue`（已完成）
- 修改：`src/components/ui/FileDropzone.vue`（已完成）
- 测试：`src/components/ui/__tests__/FileDropzone.test.ts`（已完成）

**Interfaces:**
- 运行项目命令验证功能、类型与构建。

- [ ] **Step 1: 运行全部单元测试**

  运行：
  ```bash
  pnpm test
  ```
  Expected: 全部通过（包括新增的 FileDropzone 测试）。

- [ ] **Step 2: 运行类型检查**

  运行：
  ```bash
  pnpm astro check
  ```
  Expected: 无类型错误。

- [ ] **Step 3: 构建生产版本**

  运行：
  ```bash
  pnpm build
  ```
  Expected: 构建成功，输出到 `./dist/`。

- [ ] **Step 4: 手动验证 Image Scrambler**

  运行：
  ```bash
  pnpm dev
  ```

  打开 `http://localhost:4321/media/image-scrambler`，按以下顺序验证：

  1. 点击上传区选择 `test.png` → 图片加载成功。
  2. 不点击删除图标，再次点击上传区并选择**同一张** `test.png` → 图片重新加载（object URL 更新）。
  3. 点击上传区后按 Esc 取消 → 再选择任意图片 → 图片正常加载。
  4. 拖拽一张图片到上传区 → 图片加载成功。
  5. 复制一张图片到剪贴板，按 Ctrl+V → 图片加载成功。
  6. 点击图片区右上角的删除图标 → 回到空态；再次选择图片 → 正常加载。
  7. 点击「混淆」→ 图片变为置乱状态 → 点击「下载」→ PNG 下载成功。
  8. 上传带元数据的置乱 PNG → 自动识别并还原。

- [ ] **Step 5: Commit（如有任何后续调整）**

  如果手动验证过程中无代码改动，可跳过。若有微调（如样式、文案），单独 commit：
  ```bash
  git add ...
  git commit -m "fix(image-scrambler): polish FileDropzone integration

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

## Self-Review

### 1. Spec coverage

| 设计文档要求 | 对应任务 |
|---|---|
| 受控组件 `modelValue` + `update:modelValue` | Task 1 |
| `accept` / `maxSize` 校验 | Task 1、Task 2 |
| 点击前重置 input value | Task 1 (`handleClick`) |
| 拖拽高亮与粘贴监听 | Task 1 |
| 内置删除 ICON | Task 1 |
| 最小高度 400px | Task 1 |
| ImageScrambler 集成并移除 ClearButton | Task 3 |
| 单元测试 | Task 2 |
| 手动验证 | Task 4 |

### 2. Placeholder scan

- 无 TBD/TODO。
- 所有代码块包含完整可执行代码。
- 所有命令包含预期结果。

### 3. Type consistency

- `validateFile` 签名在组件导出与测试导入中一致：`validateFile(file: File, accept?: string, maxSize?: number): string`。
- `FileDropzone` emits 在组件定义与 ImageScrambler 使用中一致：`select`、`clear`、`error`、`update:modelValue`。
- `selectedFile` 类型 `Ref<File | null>` 与 `modelValue` prop 类型一致。

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-file-dropzone.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
