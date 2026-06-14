# CopyButton 统一 redesign 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全站复制按钮统一为图标按钮，提取 `useCopy` composable 集中管理复制状态与反馈。

**Architecture:** 新增 `src/composables/useCopy.ts` 封装复制成功/失败状态、1.5s 自动复位、失败 Toast；`CopyButton.vue` 和 `CodePanel.vue` 共用该 composable；散落各工具中的自定义复制逻辑逐一切换到 `useCopy` 或 `<CopyButton>`。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript + Tailwind CSS v4 + Vitest

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/composables/useCopy.ts` | 新建：复制状态、自动复位、失败 Toast 的复用逻辑 |
| `src/composables/__tests__/useCopy.test.ts` | 新建：`useCopy` 单元测试 |
| `src/components/ui/CopyButton.vue` | 改造：从文字按钮变为图标按钮，使用 `useCopy` |
| `src/components/ui/CodePanel.vue` | 改造：复制逻辑改用 `useCopy`，移除重复实现 |
| `src/tools/text/UuidGenerator.vue` | 修改：`copySingle`/`copyAll` 改用 `useCopy` |
| `src/tools/text/RandomStringGenerator.vue` | 修改：单条/全部复制改用 `useCopy` 或 `<CopyButton>` |
| `src/tools/encoding/FileToBase64.vue` | 修改：`handleCopy` 改用 `useCopy` 并覆盖失败文案 |
| 多个使用 `<CopyButton>` 的工具文件 | 修改：移除 `label` prop 和不适用的自定义 class |

---

## Task 1: 创建 `useCopy` composable（TDD）

**Files:**
- Create: `src/composables/useCopy.ts`
- Test: `src/composables/__tests__/useCopy.test.ts`

### Step 1: 写失败测试

创建 `src/composables/__tests__/useCopy.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCopy } from '../useCopy';

describe('useCopy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('空字符串不执行复制', async () => {
    const { copied, copy } = useCopy();
    await copy('');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(copied.value).toBe(false);
  });

  it('复制成功后 copied 为 true，1.5s 后自动恢复', async () => {
    navigator.clipboard.writeText.mockResolvedValue(undefined);
    const { copied, copy } = useCopy();

    await copy('hello');
    expect(copied.value).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(copied.value).toBe(false);
  });

  it('复制失败时 copied 保持 false 并 dispatch toast', async () => {
    const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');
    navigator.clipboard.writeText.mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy();
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      new CustomEvent('toast', { detail: { message: '复制失败，请重试' } }),
    );
  });

  it('支持自定义失败文案', async () => {
    const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');
    navigator.clipboard.writeText.mockRejectedValue(new Error('fail'));

    const { copied, copy } = useCopy({ errorMessage: '自定义失败' });
    await copy('hello');

    expect(copied.value).toBe(false);
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      new CustomEvent('toast', { detail: { message: '自定义失败' } }),
    );
  });

  it('多次点击重置计时器', async () => {
    navigator.clipboard.writeText.mockResolvedValue(undefined);
    const { copied, copy } = useCopy();

    await copy('hello');
    vi.advanceTimersByTime(1000);
    expect(copied.value).toBe(true);

    await copy('hello');
    vi.advanceTimersByTime(1000);
    expect(copied.value).toBe(true);

    vi.advanceTimersByTime(500);
    expect(copied.value).toBe(false);
  });
});
```

### Step 2: 运行测试确认失败

```bash
pnpm test src/composables/__tests__/useCopy.test.ts
```

Expected: FAIL，`useCopy` 未定义或模块找不到。

### Step 3: 实现 `useCopy`

创建 `src/composables/useCopy.ts`：

```ts
import { ref, type Ref } from 'vue';
import { copyToClipboard } from '../utils/shared/clipboard';

export interface UseCopyOptions {
  /** 复制成功后状态保持时长，默认 1500ms */
  duration?: number;
  /** 复制失败时的 Toast 文案，默认 '复制失败，请重试' */
  errorMessage?: string;
}

export interface UseCopyResult {
  /** 是否处于"已复制"确认态 */
  copied: Ref<boolean>;
  /** 触发复制 */
  copy: (text: string) => Promise<void>;
}

/**
 * 封装复制到剪贴板的交互状态。
 *
 * 提供成功后的临时确认态、自动复位以及失败 Toast 反馈。
 */
export function useCopy(options?: UseCopyOptions): UseCopyResult {
  const duration = options?.duration ?? 1500;
  const errorMessage = options?.errorMessage ?? '复制失败，请重试';
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string): Promise<void> {
    if (!text) return;

    const success = await copyToClipboard(text);
    if (success) {
      copied.value = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        copied.value = false;
      }, duration);
    } else {
      document.dispatchEvent(new CustomEvent('toast', { detail: { message: errorMessage } }));
    }
  }

  return { copied, copy };
}
```

### Step 4: 运行测试确认通过

```bash
pnpm test src/composables/__tests__/useCopy.test.ts
```

Expected: PASS

### Step 5: 提交

```bash
git add src/composables/useCopy.ts src/composables/__tests__/useCopy.test.ts
git commit -m "feat: add useCopy composable with tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 改造 `CopyButton.vue`

**Files:**
- Modify: `src/components/ui/CopyButton.vue`

### Step 1: 替换脚本与模板

完整替换 `src/components/ui/CopyButton.vue` 内容：

```vue
<script setup lang="ts">
import { useCopy } from '../../composables/useCopy';

interface Props {
  /** 要复制的文本 */
  text: string;
  /** 按钮尺寸，默认 md */
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const { copied, copy } = useCopy();

const sizeClasses = {
  md: 'w-9 h-9',
  sm: 'w-7 h-7',
};

const iconSize = {
  md: 16,
  sm: 14,
};

async function handleCopy() {
  await copy(props.text);
}
</script>

<template>
  <button
    type="button"
    :class="[
      sizeClasses[size],
      'flex items-center justify-center',
      'rounded-sm border',
      'bg-card text-muted',
      'transition-[background-color,border-color,color] duration-150',
      'hover:bg-hover hover:text-text',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      copied ? 'border-success text-success' : 'border-border',
    ]"
    :disabled="!text"
    @click="handleCopy"
  >
    <svg
      v-if="copied"
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize[size]"
      :height="iconSize[size]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>

    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize[size]"
      :height="iconSize[size]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  </button>
</template>
```

### Step 2: 运行构建检查

```bash
pnpm astro check
```

Expected: 无 TypeScript 错误。

### Step 3: 提交

```bash
git add src/components/ui/CopyButton.vue
git commit -m "refactor: convert CopyButton to icon button using useCopy

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 改造 `CodePanel.vue`

**Files:**
- Modify: `src/components/ui/CodePanel.vue`

### Step 1: 替换脚本逻辑

保留模板结构，只替换脚本中的复制逻辑。修改 `src/components/ui/CodePanel.vue` 的 `<script>` 部分：

```vue
<script setup lang="ts">
/**
 * 一体化代码面板容器。
 *
 * 为内容区提供带边框的卡片外壳，并在顶部标题栏嵌入复制/清空图标按钮。
 * 标题栏与内容区共享同一个边框容器，视觉上融为一体；按钮通过 slot 外部渲染，
 * 不会成为 textarea 等内容的子元素。
 *
 * @example
 * ```vue
 * <CodePanel label="JSON 输入" showClear @clear="handleClear">
 *   <textarea v-model="input" class="w-full h-80 p-3 bg-card text-text font-mono text-sm" />
 * </CodePanel>
 *
 * <CodePanel label="输出结果" showCopy :copyText="output">
 *   <pre class="w-full h-80 p-3 bg-card text-text font-mono text-sm">{{ output }}</pre>
 * </CodePanel>
 * ```
 */
import { useCopy } from '../../composables/useCopy';

interface Props {
  /** 面板标签文字 */
  label?: string;
  /** 是否显示复制图标按钮 */
  showCopy?: boolean;
  /** 要复制的文本内容 */
  copyText?: string;
  /** 是否显示清空图标按钮 */
  showClear?: boolean;
  /** 是否禁用按钮 */
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'clear'): void;
}>();

const { copied, copy } = useCopy();

async function handleCopy(): Promise<void> {
  if (!props.copyText) return;
  await copy(props.copyText);
}

function handleClear(): void {
  emit('clear');
}
</script>
```

### Step 2: 验证模板中复制按钮使用 `copied`

确认模板中复制按钮的 `v-if="copied"` 和 `@click="handleCopy"` 仍然有效。原模板中 `copied` 变量名不变，因此无需修改模板。

### Step 3: 移除未使用的 import

确认 `src/components/ui/CodePanel.vue` 中不再 `import { copyToClipboard } from '../../utils/shared/clipboard';`。

### Step 4: 运行构建检查

```bash
pnpm astro check
```

Expected: 无 TypeScript 错误。

### Step 5: 提交

```bash
git add src/components/ui/CodePanel.vue
git commit -m "refactor: CodePanel uses useCopy for copy logic

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 清理使用 `<CopyButton>` 工具文件中的 `label` prop

**Files:**
- Modify: `src/tools/encoding/UrlEncodeCodec.vue`
- Modify: `src/tools/encoding/JwtParser.vue`
- Modify: `src/tools/encoding/Base64ToImage.vue`
- Modify: `src/tools/crypto/HashGenerator.vue`
- Modify: `src/tools/network/HttpStatusCodes.vue`
- Modify: `src/tools/network/DeviceInfo.vue`
- Modify: `src/tools/datetime/DateTimeConverter.vue`

### Step 1: 批量移除 `label` 和不适用的 class

在每个文件中，找到所有 `<CopyButton ... />` 用法：

- 删除 `label="复制"`、`label="复制 JSON"`、`label="复制 UA"`、`label="复制 Base64"`、`label="复制全部"` 等属性。
- 在 `DateTimeConverter.vue` 中，同时删除 `class="px-2 py-1 text-xs shrink-0"`。
- 保留其他必要的 prop（如 `:text="..."`、`v-if="..."`、`class="shrink-0"`）。

例如 `DateTimeConverter.vue` 中的：

```vue
<CopyButton
  v-if="isMounted"
  :text="field.value"
  label="复制"
  class="px-2 py-1 text-xs shrink-0"
/>
```

改为：

```vue
<CopyButton
  v-if="isMounted"
  :text="field.value"
  size="sm"
/>
```

### Step 2: 运行构建检查

```bash
pnpm astro check
```

Expected: 无 TypeScript 错误。

### Step 3: 提交

```bash
git add src/tools/encoding/UrlEncodeCodec.vue src/tools/encoding/JwtParser.vue src/tools/encoding/Base64ToImage.vue src/tools/crypto/HashGenerator.vue src/tools/network/HttpStatusCodes.vue src/tools/network/DeviceInfo.vue src/tools/datetime/DateTimeConverter.vue
git commit -m "refactor: remove label prop from CopyButton usages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 收敛 `UuidGenerator.vue` 复制逻辑

**Files:**
- Modify: `src/tools/text/UuidGenerator.vue`

### Step 1: 替换自定义复制函数

在 `src/tools/text/UuidGenerator.vue` 中：

1. 顶部 `import` 增加：

```ts
import { useCopy } from '../../composables/useCopy';
```

2. 在 `script setup` 合适位置（例如在 `showToast` 之后）初始化：

```ts
const { copy: copySingle } = useCopy();
const { copy: copyAll } = useCopy();
```

3. 替换 `copySingle` 函数：

```ts
async function copySingle(uuid: string) {
  await copySingle(uuid);
}
```

但这样会有命名冲突。改为：

```ts
const { copy: copySingleItem } = useCopy();
const { copy: copyAllItems } = useCopy();

async function copySingle(uuid: string) {
  await copySingleItem(uuid);
}

async function copyAll() {
  const text = formattedResults.value.join('\n');
  await copyAllItems(text);
}
```

4. 删除旧的 `showToast('已复制')` 调用。

### Step 2: 运行构建检查

```bash
pnpm astro check
```

### Step 3: 提交

```bash
git add src/tools/text/UuidGenerator.vue
git commit -m "refactor: UuidGenerator uses useCopy

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 收敛 `RandomStringGenerator.vue` 复制逻辑

**Files:**
- Modify: `src/tools/text/RandomStringGenerator.vue`

### Step 1: 查看当前实现

先读取 `src/tools/text/RandomStringGenerator.vue` 的复制相关代码（约第 62-80 行和模板中的复制按钮位置）。

### Step 2: 替换为 `useCopy`

在 `script setup` 中：

```ts
import { useCopy } from '../../composables/useCopy';
```

替换单条复制和全部复制函数：

```ts
const { copy: copyItem } = useCopy();
const { copy: copyAllItems } = useCopy();

async function copySingle(text: string) {
  await copyItem(text);
}

async function copyAll() {
  const text = results.value.join('\n');
  await copyAllItems(text);
}
```

删除旧的 `showToast` 调用。

### Step 3: 检查模板

确认模板中的复制按钮仍然是 `<CopyButton>` 或自定义按钮。如果是自定义按钮，改为使用 `<CopyButton :text="..." size="sm" />`。

### Step 4: 运行构建检查

```bash
pnpm astro check
```

### Step 5: 提交

```bash
git add src/tools/text/RandomStringGenerator.vue
git commit -m "refactor: RandomStringGenerator uses useCopy

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 收敛 `FileToBase64.vue` 复制逻辑

**Files:**
- Modify: `src/tools/encoding/FileToBase64.vue`

### Step 1: 替换 `handleCopy`

在 `src/tools/encoding/FileToBase64.vue` 中：

1. 顶部 `import` 改为：

```ts
import { useCopy } from '../../composables/useCopy';
```

删除 `import { copyToClipboard } from '../../utils/shared/clipboard';`。

2. 在 `script setup` 中初始化：

```ts
const { copy } = useCopy({ errorMessage: '复制失败，请尝试下载 .txt' });
```

3. 替换 `handleCopy`：

```ts
async function handleCopy() {
  if (!outputText.value) return;
  if (outputText.value.length > COPY_WARN_SIZE) {
    dispatchToast('结果较大，复制可能耗时，建议优先下载 .txt');
  }
  await copy(outputText.value);
}
```

### Step 2: 运行构建检查

```bash
pnpm astro check
```

### Step 3: 提交

```bash
git add src/tools/encoding/FileToBase64.vue
git commit -m "refactor: FileToBase64 uses useCopy with custom error message

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 全站检查与构建

### Step 1: 搜索残留的 `label=` 和 `navigator.clipboard.writeText`

```bash
grep -R "label=\"复制" src/ || true
grep -R "navigator.clipboard.writeText" src/ || true
```

Expected: 无匹配（`FileToBase64` 中已移除）。

### Step 2: 运行测试

```bash
pnpm test
```

Expected: 全部通过。

### Step 3: 运行构建

```bash
pnpm build
```

Expected: 构建成功。

### Step 4: 最终提交（如只有检查无改动则跳过）

```bash
git diff --stat
```

---

## 验收标准对照

| Spec 要求 | 对应任务 |
|-----------|---------|
| 全站复制按钮外观一致，均为图标按钮 | Task 2, Task 4 |
| 点击复制成功后图标变为 ✓，1.5s 后恢复，不触发 Toast | Task 1 (测试), Task 2 |
| 复制失败时图标不变，触发 Toast 错误提示 | Task 1 (测试), Task 2 |
| `CopyButton.vue` 和 `CodePanel.vue` 共用 `useCopy` | Task 1, Task 2, Task 3 |
| `UuidGenerator`、`RandomStringGenerator`、`FileToBase64` 不再直接调用 `navigator.clipboard.writeText` | Task 5, Task 6, Task 7 |
| 构建通过，无 TypeScript 错误 | Task 8 |

---

## 自审检查

1. **Spec 覆盖：** 所有设计决策（图标按钮、1.5s 恢复、失败 Toast、useCopy、errorMessage 覆盖、FileToBase64 保留前置提示）均映射到具体任务。
2. **Placeholder 扫描：** 无 TBD/TODO；所有步骤包含具体代码或命令。
3. **类型一致性：** `useCopy` 的 `copy` 返回 `Promise<void>`，`UseCopyOptions` 包含 `errorMessage?: string`，所有调用方一致使用。
4. **边界情况：** 空字符串、多次点击、失败 Toast 文案覆盖均已覆盖。
