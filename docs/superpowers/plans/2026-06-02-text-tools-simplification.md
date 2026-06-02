# 文本生成工具极简化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 UUID 生成器和随机字符串生成器从手动触发模式重构为即时响应的极简交互模式，使用 `uuid` 包替代手写实现，支持全版本 v1-v7 和 v1↔v6 转换。

**Architecture:** 两个独立的 Vue 3 SFC 组件重写，共享 chip toggle 和刷新按钮的 CSS 模式。组件内部使用 `watch` + `onMounted` 实现自动生成，设置变更即时响应。UUID 生成器根据版本类型条件渲染额外的 name/namespace 输入。

**Tech Stack:** Vue 3 Composition API, TypeScript, `uuid` npm package, Vitest (utility functions)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/tools/UuidGenerator.vue` | Rewrite | UUID 生成器（全版本 + 转换） |
| `src/tools/RandomStringGenerator.vue` | Rewrite | 随机字符串生成器（大小写） |
| `src/utils/uuid-generator.ts` | Create | UUID 生成/转换的封装函数 + 单元测试 |
| `src/utils/random-string.ts` | Modify | 添加大小写转换支持 |
| `src/tests/uuid-generator.test.ts` | Create | UUID 工具函数测试 |
| `src/tests/random-string.test.ts` | Create | 随机字符串工具函数测试 |
| `src/components/ToolHeader.vue` | No change | 已支持 `showExample: false` |
| `src/pages/uuid-generator.astro` | No change | 路由不变 |
| `src/pages/random-string.astro` | No change | 路由不变 |

---

### Task 1: 安装 uuid 包

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装依赖**

```bash
pnpm add uuid && pnpm add -D @types/uuid
```

- [ ] **Step 2: 验证安装成功**

```bash
node -e "const { v4 } = require('uuid'); console.log(v4())"
```

Expected: 输出一个 v4 UUID 字符串（无 ESM 报错）

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add uuid package"
```

---

### Task 2: 创建 UUID 工具函数及测试

**Files:**
- Create: `src/utils/uuid-generator.ts`
- Create: `src/tests/uuid-generator.test.ts`

- [ ] **Step 1: 写工具函数**

创建 `src/utils/uuid-generator.ts`：

```typescript
import { v1, v3, v4, v5, v6, v7, v6ToV1, v1ToV6 } from 'uuid';

/** UUID 版本标识 */
export type UuidVersion = 'v1' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7';

/** v3/v5 的命名空间预设 */
export const NAMESPACE_PRESETS = {
  DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
} as const;

/** 判断版本是否需要 name + namespace 参数 */
export function isNamespaceVersion(version: UuidVersion): boolean {
  return version === 'v3' || version === 'v5';
}

/** 根据版本生成单个 UUID */
export function generateUuid(
  version: UuidVersion,
  options?: { name?: string; namespace?: string }
): string {
  switch (version) {
    case 'v1':
      return v1();
    case 'v3':
      return v3(options?.name ?? '', options?.namespace ?? NAMESPACE_PRESETS.DNS);
    case 'v4':
      return v4();
    case 'v5':
      return v5(options?.name ?? '', options?.namespace ?? NAMESPACE_PRESETS.URL);
    case 'v6':
      return v6();
    case 'v7':
      return v7();
    default:
      return v4();
  }
}

/** 生成多个 UUID */
export function generateUuids(
  count: number,
  version: UuidVersion,
  options?: { name?: string; namespace?: string }
): string[] {
  const safeCount = Math.min(Math.max(count, 1), 100);
  return Array.from({ length: safeCount }, () => generateUuid(version, options));
}

/** 将 v6 UUID 转换为 v1 */
export function convertV6ToV1(uuid: string): string {
  return v6ToV1(uuid);
}

/** 将 v1 UUID 转换为 v6 */
export function convertV1ToV6(uuid: string): string {
  return v1ToV6(uuid);
}

/** 判断版本是否支持转换（v1 或 v6） */
export function hasConversion(version: UuidVersion): boolean {
  return version === 'v1' || version === 'v6';
}

/** 获取转换后的 UUID */
export function getConvertedUuid(version: UuidVersion, uuid: string): string | null {
  if (version === 'v1') return convertV1ToV6(uuid);
  if (version === 'v6') return convertV6ToV1(uuid);
  return null;
}

/** 获取转换目标版本标签 */
export function getConversionLabel(version: UuidVersion): string | null {
  if (version === 'v1') return '→ v6';
  if (version === 'v6') return '→ v1';
  return null;
}
```

- [ ] **Step 2: 写测试**

创建 `src/tests/uuid-generator.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateUuid,
  generateUuids,
  isNamespaceVersion,
  hasConversion,
  getConvertedUuid,
  getConversionLabel,
  NAMESPACE_PRESETS,
  type UuidVersion,
} from '../utils/uuid-generator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('uuid-generator utils', () => {
  describe('generateUuid', () => {
    it('generates a valid v1 UUID', () => {
      const uuid = generateUuid('v1');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('generates a valid v3 UUID with name and namespace', () => {
      const uuid = generateUuid('v3', { name: 'hello', namespace: NAMESPACE_PRESETS.DNS });
      expect(uuid).toMatch(UUID_REGEX);
      // v3 是确定性的：相同输入相同输出
      expect(uuid).toBe(generateUuid('v3', { name: 'hello', namespace: NAMESPACE_PRESETS.DNS }));
    });

    it('generates a valid v4 UUID', () => {
      const uuid = generateUuid('v4');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('generates a valid v5 UUID with name and namespace', () => {
      const uuid = generateUuid('v5', { name: 'hello', namespace: NAMESPACE_PRESETS.URL });
      expect(uuid).toMatch(UUID_REGEX);
      expect(uuid).toBe(generateUuid('v5', { name: 'hello', namespace: NAMESPACE_PRESETS.URL }));
    });

    it('generates a valid v6 UUID', () => {
      const uuid = generateUuid('v6');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('generates a valid v7 UUID', () => {
      const uuid = generateUuid('v7');
      expect(uuid).toMatch(UUID_REGEX);
    });
  });

  describe('generateUuids', () => {
    it('generates the requested number of UUIDs', () => {
      const uuids = generateUuids(5, 'v4');
      expect(uuids).toHaveLength(5);
      uuids.forEach((u) => expect(u).toMatch(UUID_REGEX));
    });

    it('clamps count to 1-100 range', () => {
      expect(generateUuids(0, 'v4')).toHaveLength(1);
      expect(generateUuids(200, 'v4')).toHaveLength(100);
    });
  });

  describe('isNamespaceVersion', () => {
    it('returns true for v3 and v5', () => {
      expect(isNamespaceVersion('v3')).toBe(true);
      expect(isNamespaceVersion('v5')).toBe(true);
    });

    it('returns false for other versions', () => {
      expect(isNamespaceVersion('v1')).toBe(false);
      expect(isNamespaceVersion('v4')).toBe(false);
      expect(isNamespaceVersion('v6')).toBe(false);
      expect(isNamespaceVersion('v7')).toBe(false);
    });
  });

  describe('v1↔v6 conversion', () => {
    it('converts v6 to v1', () => {
      const v6uuid = generateUuid('v6');
      const converted = getConvertedUuid('v6', v6uuid);
      expect(converted).toMatch(UUID_REGEX);
    });

    it('converts v1 to v6', () => {
      const v1uuid = generateUuid('v1');
      const converted = getConvertedUuid('v1', v1uuid);
      expect(converted).toMatch(UUID_REGEX);
    });

    it('returns null for non-convertible versions', () => {
      expect(getConvertedUuid('v4', 'whatever')).toBeNull();
    });

    it('returns correct conversion labels', () => {
      expect(getConversionLabel('v1')).toBe('→ v6');
      expect(getConversionLabel('v6')).toBe('→ v1');
      expect(getConversionLabel('v4')).toBeNull();
    });

    it('hasConversion returns true only for v1 and v6', () => {
      expect(hasConversion('v1')).toBe(true);
      expect(hasConversion('v6')).toBe(true);
      expect(hasConversion('v4')).toBe(false);
    });
  });
});
```

- [ ] **Step 3: 运行测试确认通过**

```bash
pnpm test -- src/tests/uuid-generator.test.ts
```

Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/uuid-generator.ts src/tests/uuid-generator.test.ts
git commit -m "feat: add uuid utility functions with tests"
```

---

### Task 3: 为 random-string 工具函数添加大小写转换支持及测试

**Files:**
- Modify: `src/utils/random-string.ts`
- Create: `src/tests/random-string.test.ts`

- [ ] **Step 1: 写测试**

创建 `src/tests/random-string.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  applyLetterCase,
  hasLetters,
  PRESET_CHARSETS,
} from '../utils/random-string';

describe('random-string utils', () => {
  describe('generateRandomString', () => {
    it('generates string of correct length', () => {
      const result = generateRandomString(16, 'alphanumeric');
      expect(result).toHaveLength(16);
    });

    it('generates digits-only string', () => {
      const result = generateRandomString(100, 'digits');
      expect(result).toMatch(/^[0-9]+$/);
    });

    it('generates custom charset string', () => {
      const result = generateRandomString(100, 'custom:abc');
      expect(result).toMatch(/^[abc]+$/);
    });

    it('returns empty string for length 0', () => {
      expect(generateRandomString(0, 'alphanumeric')).toBe('');
    });
  });

  describe('applyLetterCase', () => {
    it('returns original string for "none"', () => {
      const input = 'aBc123';
      expect(applyLetterCase(input, 'none')).toBe('aBc123');
    });

    it('converts to uppercase', () => {
      const input = 'aBc123xYz';
      expect(applyLetterCase(input, 'upper')).toBe('ABC123XYZ');
    });

    it('converts to lowercase', () => {
      const input = 'aBc123xYz';
      expect(applyLetterCase(input, 'lower')).toBe('abc123xyz');
    });
  });

  describe('hasLetters', () => {
    it('returns true for alphanumeric', () => {
      expect(hasLetters('alphanumeric')).toBe(true);
    });

    it('returns true for special', () => {
      expect(hasLetters('special')).toBe(true);
    });

    it('returns false for digits', () => {
      expect(hasLetters('digits')).toBe(false);
    });

    it('returns true for custom with letters', () => {
      expect(hasLetters('custom:aBc')).toBe(true);
    });

    it('returns false for custom without letters', () => {
      expect(hasLetters('custom:123')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test -- src/tests/random-string.test.ts
```

Expected: FAIL（`applyLetterCase` 和 `hasLetters` 未导出）

- [ ] **Step 3: 扩展 random-string.ts**

在 `src/utils/random-string.ts` 末尾添加：

```typescript
/** 字母大小写模式 */
export type LetterCase = 'none' | 'upper' | 'lower';

/** 对字符串应用大小写转换 */
export function applyLetterCase(str: string, mode: LetterCase): string {
  if (mode === 'upper') return str.toUpperCase();
  if (mode === 'lower') return str.toLowerCase();
  return str;
}

/** 判断字符集预设是否包含字母 */
export function hasLetters(preset: CharsetPreset | string): boolean {
  if (preset === 'digits') return false;
  if (preset.startsWith('custom:')) {
    const chars = preset.slice(7);
    return /[a-zA-Z]/.test(chars);
  }
  return true; // alphanumeric, special 都含字母
}
```

注意：不要修改已有的 `CharsetPreset`、`PRESET_CHARSETS`、`resolveCharset`、`generateRandomString` 函数，只在末尾追加新导出。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test -- src/tests/random-string.test.ts
```

Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/random-string.ts src/tests/random-string.test.ts
git commit -m "feat: add letter case support to random-string utils"
```

---

### Task 4: 重写 UUID 生成器组件

**Files:**
- Rewrite: `src/tools/UuidGenerator.vue`

- [ ] **Step 1: 重写组件**

完整替换 `src/tools/UuidGenerator.vue` 的内容为：

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import {
  generateUuids,
  isNamespaceVersion,
  hasConversion,
  getConvertedUuid,
  getConversionLabel,
  NAMESPACE_PRESETS,
  type UuidVersion,
} from '../utils/uuid-generator';

/** 可选的 UUID 版本列表（从小到大排列） */
const VERSIONS: { value: UuidVersion; label: string }[] = [
  { value: 'v1', label: 'v1' },
  { value: 'v3', label: 'v3' },
  { value: 'v4', label: 'v4' },
  { value: 'v5', label: 'v5' },
  { value: 'v6', label: 'v6' },
  { value: 'v7', label: 'v7' },
];

const version = ref<UuidVersion>('v4');
const amount = ref(1);
const results = ref<string[]>([]);

/** v3/v5 专用参数 */
const nsName = ref('');
const nsType = ref<'DNS' | 'URL' | 'custom'>('DNS');
const nsCustom = ref('');

/** 获取实际 namespace UUID */
function getNamespace(): string {
  if (nsType.value === 'custom') return nsCustom.value;
  return NAMESPACE_PRESETS[nsType.value];
}

/** 是否需要 name/namespace 参数 */
const needsNamespace = computed(() => isNamespaceVersion(version.value));

/** 是否显示转换结果 */
const showConversion = computed(() => hasConversion(version.value));

/** 转换后的结果（每个 UUID 对应一个转换值） */
const conversions = computed(() =>
  results.value.map((uuid) => getConvertedUuid(version.value, uuid))
);

/** 转换标签 */
const conversionLabel = computed(() => getConversionLabel(version.value));

/** 生成 UUID */
function generate() {
  if (needsNamespace.value && !nsName.value.trim()) return;
  if (needsNamespace.value && nsType.value === 'custom' && !nsCustom.value.trim()) return;

  results.value = generateUuids(amount.value, version.value, {
    name: nsName.value,
    namespace: getNamespace(),
  });
}

/** 复制相关 */
const copiedRow = ref(-1);

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => { copiedRow.value = -1; }, 1000);
  }
}

const copiedConversion = ref(-1);

async function copyConversion(index: number) {
  const text = conversions.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedConversion.value = index;
    setTimeout(() => { copiedConversion.value = -1; }, 1000);
  }
}

const allResultsText = computed(() => results.value.join('\n'));

/** 监听参数变化自动重新生成 */
watch(
  [version, amount, nsName, nsType, nsCustom],
  () => { generate(); },
  { immediate: false }
);

onMounted(() => { generate(); });
</script>

<template>
  <div class="uuid-tool">
    <ToolHeader
      title="UUID 生成器"
      description="生成多种版本的 UUID（v1、v3、v4、v5、v6、v7）"
      :show-example="false"
    />

    <!-- 版本选择 + 数量 + 操作 -->
    <div class="control-row">
      <div class="chip-group">
        <button
          v-for="v in VERSIONS"
          :key="v.value"
          :class="['chip', { active: version === v.value }]"
          @click="version = v.value"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="control-inline">
        <label class="inline-label">×</label>
        <input
          v-model.number="amount"
          type="number"
          :min="1"
          :max="100"
          class="inline-input"
        />
      </div>
      <button class="refresh-btn" @click="generate" title="重新生成">↻</button>
      <CopyButton v-if="results.length" :text="allResultsText" label="复制全部" />
    </div>

    <!-- v3/v5 条件输入 -->
    <div v-if="needsNamespace" class="namespace-row">
      <div class="control-inline">
        <label class="inline-label">名称</label>
        <input
          v-model="nsName"
          class="inline-text"
          placeholder="输入名称"
        />
      </div>
      <div class="control-inline">
        <label class="inline-label">命名空间</label>
        <select v-model="nsType" class="inline-select">
          <option value="DNS">DNS</option>
          <option value="URL">URL</option>
          <option value="custom">自定义</option>
        </select>
      </div>
      <div v-if="nsType === 'custom'" class="control-inline">
        <input
          v-model="nsCustom"
          class="inline-text"
          placeholder="输入 UUID 命名空间"
        />
      </div>
    </div>

    <!-- 生成结果 -->
    <div class="results-area">
      <div
        v-for="(uuid, index) in results"
        :key="index"
        class="result-row"
      >
        <div class="result-content">
          <code class="result-value">{{ uuid }}</code>
          <template v-if="showConversion && conversions[index]">
            <span class="conversion-label">{{ conversionLabel }}</span>
            <code class="result-value result-conversion">{{ conversions[index] }}</code>
          </template>
        </div>
        <div class="result-actions">
          <button class="result-copy" @click="copyRow(index)">
            {{ copiedRow === index ? '✓' : '复制' }}
          </button>
          <button
            v-if="showConversion && conversions[index]"
            class="result-copy"
            @click="copyConversion(index)"
          >
            {{ copiedConversion === index ? '✓' : '复制转换' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.uuid-tool {
  max-width: 720px;
}

/* 控制行 */
.control-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}

/* Chip 切换组 */
.chip-group {
  display: flex;
  gap: 4px;
}

.chip {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chip:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

/* inline 控件 */
.control-inline {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.inline-label {
  font-size: 0.8125rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.inline-input {
  width: 50px;
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
}

.inline-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.inline-text {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
  min-width: 160px;
}

.inline-text:focus {
  outline: none;
  border-color: var(--color-accent);
}

.inline-select {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
}

.inline-select:focus {
  outline: none;
  border-color: var(--color-accent);
}

/* 刷新按钮 */
.refresh-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* namespace 条件行 */
.namespace-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
  padding: var(--space-sm) 0;
}

/* 结果区 */
.results-area {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  flex: 1;
}

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
}

.result-conversion {
  color: var(--color-muted);
}

.conversion-label {
  font-size: 0.75rem;
  color: var(--color-muted);
  flex-shrink: 0;
}

.result-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.result-copy {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
  white-space: nowrap;
}

.result-copy:hover {
  color: var(--color-accent);
}
</style>
```

- [ ] **Step 2: 启动开发服务器验证**

```bash
pnpm dev
```

在浏览器打开 UUID 生成器页面，验证：
1. 页面加载时自动生成 v4 UUID
2. 切换版本 chip 自动重新生成
3. v3/v5 选中后出现 name + namespace 输入
4. v1 选中时显示 →v6 转换值
5. v6 选中时显示 →v1 转换值
6. 刷新按钮可重新生成
7. 复制功能正常
8. 无"填入示例"和"清空"按钮

- [ ] **Step 3: Commit**

```bash
git add src/tools/UuidGenerator.vue
git commit -m "feat: rewrite UUID generator with all versions and v1↔v6 conversion"
```

---

### Task 5: 重写随机字符串生成器组件

**Files:**
- Rewrite: `src/tools/RandomStringGenerator.vue`

- [ ] **Step 1: 重写组件**

完整替换 `src/tools/RandomStringGenerator.vue` 的内容为：

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import { copyToClipboard } from '../utils/clipboard';
import {
  generateRandomString,
  applyLetterCase,
  hasLetters,
  PRESET_CHARSETS,
  type CharsetPreset,
  type LetterCase,
} from '../utils/random-string';

/** 字符集预设选项 */
const CHARSET_PRESETS = [
  { value: 'alphanumeric', label: '字母 + 数字' },
  { value: 'digits', label: '仅数字' },
  { value: 'special', label: '+ 特殊字符' },
  { value: 'custom', label: '自定义' },
] as const;

const length = ref(32);
const charsetPreset = ref<string>('alphanumeric');
const customChars = ref('');
const amount = ref(1);
const letterCase = ref<LetterCase>('none');
const results = ref<string[]>([]);
const errorMsg = ref('');

/** 字符集是否包含字母 */
const charsetHasLetters = computed(() => {
  if (charsetPreset.value === 'custom') return hasLetters(`custom:${customChars.value}`);
  return hasLetters(charsetPreset.value as CharsetPreset);
});

/** 获取实际字符集参数 */
function getCharset(): CharsetPreset {
  if (charsetPreset.value === 'custom') {
    return `custom:${customChars.value}`;
  }
  return charsetPreset.value as CharsetPreset;
}

/** 生成随机字符串 */
function generate() {
  errorMsg.value = '';

  if (charsetPreset.value === 'custom' && !customChars.value.trim()) {
    errorMsg.value = '请输入自定义字符集';
    return;
  }
  if (length.value < 1 || length.value > 10000) {
    errorMsg.value = '长度应在 1-10000 之间';
    return;
  }

  const count = Math.min(Math.max(amount.value || 1, 1), 100);
  const charset = getCharset();
  results.value = Array.from(
    { length: count },
    () => applyLetterCase(generateRandomString(length.value, charset), letterCase.value)
  );
}

/** 复制相关 */
const copiedRow = ref(-1);

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => { copiedRow.value = -1; }, 1000);
  }
}

const allResultsText = computed(() => results.value.join('\n'));

/** 监听参数变化自动重新生成 */
watch(
  [length, charsetPreset, customChars, amount, letterCase],
  () => { generate(); },
  { immediate: false }
);

/** 字符集切换为非字母时重置大小写 */
watch(charsetHasLetters, (has) => {
  if (!has) letterCase.value = 'none';
});

onMounted(() => { generate(); });
</script>

<template>
  <div class="random-tool">
    <ToolHeader
      title="随机字符串生成"
      description="自定义长度和字符集的随机字符串生成器"
      :show-example="false"
    />

    <!-- 第一行：长度 + 字符集 + 大小写 -->
    <div class="control-row">
      <div class="control-inline">
        <label class="inline-label">长度</label>
        <input
          v-model.number="length"
          type="number"
          :min="1"
          :max="10000"
          class="inline-input"
          style="width: 70px"
        />
      </div>
      <div class="chip-group">
        <button
          v-for="p in CHARSET_PRESETS"
          :key="p.value"
          :class="['chip', { active: charsetPreset === p.value }]"
          @click="charsetPreset = p.value"
        >
          {{ p.label }}
        </button>
      </div>
      <template v-if="charsetHasLetters">
        <button
          :class="['chip', 'chip--case', { active: letterCase === 'upper' }]"
          @click="letterCase = letterCase === 'upper' ? 'none' : 'upper'"
        >
          大写
        </button>
        <button
          :class="['chip', 'chip--case', { active: letterCase === 'lower' }]"
          @click="letterCase = letterCase === 'lower' ? 'none' : 'lower'"
        >
          小写
        </button>
      </template>
    </div>

    <!-- 自定义字符集（条件显示） -->
    <div v-if="charsetPreset === 'custom'" class="custom-row">
      <input
        v-model="customChars"
        class="inline-text"
        placeholder="输入允许的字符"
      />
    </div>

    <!-- 第二行：数量 + 操作 -->
    <div class="control-row">
      <div class="control-inline">
        <label class="inline-label">×</label>
        <input
          v-model.number="amount"
          type="number"
          :min="1"
          :max="100"
          class="inline-input"
          style="width: 50px"
        />
      </div>
      <button class="refresh-btn" @click="generate" title="重新生成">↻</button>
      <CopyButton v-if="results.length" :text="allResultsText" label="复制全部" />
    </div>

    <!-- 错误提示 -->
    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <!-- 结果区（始终可见） -->
    <div class="results-area">
      <div
        v-for="(str, index) in results"
        :key="index"
        class="result-row"
      >
        <code class="result-value">{{ str }}</code>
        <button class="result-copy" @click="copyRow(index)">
          {{ copiedRow === index ? '✓' : '复制' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.random-tool {
  max-width: 720px;
}

/* 控制行 */
.control-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}

/* Chip 切换组 */
.chip-group {
  display: flex;
  gap: 4px;
}

.chip {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chip:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

.chip--case.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

/* inline 控件 */
.control-inline {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.inline-label {
  font-size: 0.8125rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.inline-input {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
}

.inline-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.inline-text {
  padding: 4px var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-card);
  min-width: 200px;
}

.inline-text:focus {
  outline: none;
  border-color: var(--color-accent);
}

/* 刷新按钮 */
.refresh-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* 自定义字符行 */
.custom-row {
  margin-bottom: var(--space-md);
}

/* 错误提示 */
.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

/* 结果区 */
.results-area {
  display: flex;
  flex-direction: column;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
  min-width: 0;
  flex: 1;
}

.result-copy {
  flex-shrink: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
  margin-left: var(--space-sm);
}

.result-copy:hover {
  color: var(--color-accent);
}
</style>
```

- [ ] **Step 2: 启动开发服务器验证**

在浏览器打开随机字符串生成器页面，验证：
1. 页面加载时自动生成结果
2. 修改长度自动重新生成
3. 切换字符集 chip 自动重新生成
4. "仅数字"时"大写""小写"按钮消失
5. 点击"大写"按钮结果变大写，再次点击取消
6. 自定义字符集输入框条件显示
7. 刷新按钮、复制功能正常
8. 无"填入示例"和"清空"按钮

- [ ] **Step 3: Commit**

```bash
git add src/tools/RandomStringGenerator.vue
git commit -m "feat: rewrite random string generator with case options and auto-generate"
```

---

### Task 6: 运行全量测试 + 构建验证

**Files:** 无新增/修改

- [ ] **Step 1: 运行全量测试**

```bash
pnpm test
```

Expected: 全部 PASS

- [ ] **Step 2: 构建生产版本**

```bash
pnpm build
```

Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 3: Commit（如有修复）**

仅在测试或构建发现问题并修复后才需要此步骤。

```bash
git add -A
git commit -m "fix: resolve build/test issues"
```
