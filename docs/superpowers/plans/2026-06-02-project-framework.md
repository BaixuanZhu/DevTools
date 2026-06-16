# 项目框架搭建实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Astro 6 + Vue 3 项目框架，包括全局布局、导航系统、设计令牌、工具注册表、首页仪表盘和一个示例工具页面（UUID 生成器），形成可扩展的基础架构。

**Architecture:** Astro 6 作为页面骨架和静态渲染层，Vue 3（@astrojs/vue）通过 Islands 架构按需水合交互组件。布局分为两层：Layout.astro（全局 HTML 骨架）和 ToolLayout.astro（侧边栏 + 内容区 + Footer）。工具注册表（tools.ts）是所有导航和卡片数据的单一来源。

**Tech Stack:** Astro 6.4.2, Vue 3, @astrojs/vue, TypeScript, CSS Custom Properties

---

## 文件变更总览

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `astro.config.mjs` | 添加 @astrojs/vue 集成 |
| 修改 | `package.json` | 添加 vue、@astrojs/vue 依赖 |
| 修改 | `tsconfig.json` | 添加 Vue TS 支持 |
| 创建 | `src/styles/design-tokens.css` | 全局设计令牌（颜色、字体、间距、圆角） |
| 创建 | `src/data/tools.ts` | 工具注册表（ToolMeta 类型 + 首批 9 个工具数据） |
| 创建 | `src/utils/clipboard.ts` | 剪贴板复制工具函数 |
| 重写 | `src/layouts/Layout.astro` | 全局 HTML 骨架（lang=zh-CN, design-tokens 引入, CSS reset） |
| 创建 | `src/layouts/ToolLayout.astro` | 工具页布局（Header + Sidebar + 内容区 + Footer） |
| 创建 | `src/components/Footer.astro` | 页脚（版权 + 备案号预留） |
| 创建 | `src/components/Sidebar.vue` | 侧边栏导航（按分类分组、高亮当前页、移动端抽屉） |
| 创建 | `src/components/SearchBar.vue` | 搜索栏（debounce 过滤工具列表） |
| 创建 | `src/components/ToolCard.astro` | 首页工具卡片（纯展示） |
| 创建 | `src/components/ToolHeader.vue` | 工具页标题区（标题 + 描述 + 示例按钮） |
| 创建 | `src/components/CopyButton.vue` | 复制按钮（复制 + 反馈） |
| 创建 | `src/components/ClearButton.vue` | 清空按钮（回调重置） |
| 重写 | `src/pages/index.astro` | 首页仪表盘（搜索 + 分类过滤 + 工具卡片网格） |
| 删除 | `src/components/Welcome.astro` | Astro 默认欢迎页，不再需要 |
| 删除 | `src/assets/astro.svg` | Astro 默认资源，不再需要 |
| 删除 | `src/assets/background.svg` | Astro 默认资源，不再需要 |
| 创建 | `src/pages/uuid-generator.astro` | UUID 生成器工具页（示例工具，验证框架可用） |
| 创建 | `src/tools/UuidGenerator.vue` | UUID 生成器 Vue 组件（完整交互逻辑） |

---

### Task 1: 安装 Vue 3 集成依赖

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Modify: `tsconfig.json`

- [ ] **Step 1: 安装 @astrojs/vue 和 vue**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm add @astrojs/vue vue
```

Expected: 依赖安装成功，package.json 中出现 vue 和 @astrojs/vue

- [ ] **Step 2: 配置 astro.config.mjs**

```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';

export default defineConfig({
  integrations: [vue()],
});
```

- [ ] **Step 3: 更新 tsconfig.json 支持 Vue**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "vueCompilerOptions": {
      "target": 3.3
    }
  }
}
```

- [ ] **Step 4: 验证开发服务器启动**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm dev
```

Expected: 服务器正常启动，无报错。Ctrl+C 停止。

- [ ] **Step 5: 提交**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs tsconfig.json
git commit -m "feat: add @astrojs/vue integration for Vue 3 support"
```

---

### Task 2: 创建设计令牌和全局样式基础

**Files:**
- Create: `src/styles/design-tokens.css`

- [ ] **Step 1: 创建 design-tokens.css**

根据 DESIGN.md 的暖色调中性色 + 单一强调色方向，选定具体色值：

```css
:root {
  /* 颜色 - 暖色调中性色 + 单一强调色 */
  --color-surface: #faf9f7;
  --color-text: #1a1a1a;
  --color-muted: #6b7280;
  --color-border: #e5e2dd;
  --color-accent: #e8590c;
  --color-card: #ffffff;
  --color-hover: #f3f1ee;
  --color-error: #dc2626;
  --color-success: #16a34a;

  /* 字体 */
  --font-sans: 'Noto Sans SC', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;

  /* 间距 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* 断点 */
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;

  /* 侧边栏 */
  --sidebar-width: 240px;

  /* 过渡 */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/styles/design-tokens.css
git commit -m "feat: add design tokens (colors, fonts, spacing, radius)"
```

---

### Task 3: 创建工具注册表

**Files:**
- Create: `src/data/tools.ts`

- [ ] **Step 1: 创建 tools.ts**

```typescript
/** 工具分类 */
export type ToolCategory =
  | '编码转换'
  | '加密哈希'
  | '格式化'
  | '文本处理'
  | '正则工具'
  | '网络工具'
  | '颜色工具'
  | '日期时间'
  | 'CSS 工具'
  | 'API 工具';

/** 工具元数据 */
export interface ToolMeta {
  /** 工具唯一 ID，同时用作 URL slug */
  id: string;
  /** 显示名称 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** 分类 */
  category: ToolCategory;
  /** 图标（emoji） */
  icon: string;
  /** 路由路径 */
  path: string;
}

/** 所有已注册的工具列表 */
export const tools: ToolMeta[] = [
  {
    id: 'uuid-generator',
    name: 'UUID 生成器',
    description: '生成多种版本的 UUID（v1、v4、v7 等）',
    category: '文本处理',
    icon: '🔑',
    path: '/uuid-generator',
  },
  {
    id: 'hash-generator',
    name: '哈希生成器',
    description: '支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制',
    category: '加密哈希',
    icon: '🔒',
    path: '/hash-generator',
  },
  {
    id: 'random-string',
    name: '随机字符串生成',
    description: '自定义长度和字符集的随机字符串生成器',
    category: '文本处理',
    icon: '🎲',
    path: '/random-string',
  },
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: 'Base64 编码与解码，支持文本和文件',
    category: '编码转换',
    icon: '📄',
    path: '/base64',
  },
  {
    id: 'datetime-converter',
    name: '日期时间转换器',
    description: '时间戳与日期格式互转，支持多种日期格式',
    category: '日期时间',
    icon: '🕐',
    path: '/datetime-converter',
  },
  {
    id: 'url-encode',
    name: 'URL 编解码',
    description: 'URL 编码与解码，支持组件级和完整 URL 编码',
    category: '编码转换',
    icon: '🔗',
    path: '/url-encode',
  },
  {
    id: 'jwt-parser',
    name: 'JWT 解析器',
    description: '解析和验证 JSON Web Token，展示 Header、Payload、Signature',
    category: '编码转换',
    icon: '🎫',
    path: '/jwt-parser',
  },
  {
    id: 'device-info',
    name: '设备信息与 UserAgent',
    description: '查看浏览器、操作系统、屏幕等设备信息',
    category: '网络工具',
    icon: '💻',
    path: '/device-info',
  },
  {
    id: 'symmetric-crypto',
    name: '对称加解密',
    description: '支持 AES、DES 等主流对称加密算法的加解密',
    category: '加密哈希',
    icon: '🛡️',
    path: '/symmetric-crypto',
  },
];

/** 按分类分组工具列表 */
export function getToolsByCategory(): Record<ToolCategory, ToolMeta[]> {
  return tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<ToolCategory, ToolMeta[]>,
  );
}

/** 搜索工具（匹配名称和描述，大小写不敏感） */
export function searchTools(query: string): ToolMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return tools;
  return tools.filter(
    (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}

/** 获取所有分类（去重，保持注册顺序） */
export function getCategories(): ToolCategory[] {
  const seen = new Set<ToolCategory>();
  return tools.filter((t) => {
    if (seen.has(t.category)) return false;
    seen.add(t.category);
    return true;
  }).map((t) => t.category);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat: add tool registry with 9 tools and helper functions"
```

---

### Task 4: 创建剪贴板工具函数

**Files:**
- Create: `src/utils/clipboard.ts`

- [ ] **Step 1: 创建 clipboard.ts**

```typescript
/**
 * 将文本复制到剪贴板
 * @param text 要复制的文本
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback for older browsers or non-HTTPS
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/clipboard.ts
git commit -m "feat: add clipboard utility with fallback support"
```

---

### Task 5: 重写 Layout.astro（全局 HTML 骨架）

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: 重写 Layout.astro**

```astro
---
import '../styles/design-tokens.css';

interface Props {
  title?: string;
}

const { title = 'DevTools - 开发者工具集' } = Astro.props;
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100vh;
    background-color: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/layouts/Layout.astro
git commit -m "feat: rewrite Layout.astro with design tokens, CSS reset, zh-CN lang"
```

---

### Task 6: 创建 Footer.astro

**Files:**
- Create: `src/components/Footer.astro`

- [ ] **Step 1: 创建 Footer.astro**

```astro
---
interface Props {
  /** 备案号（可选，有值时显示备案信息） */
    icp?: string;
}

const { icp = '' } = Astro.props;
const year = new Date().getFullYear();
---

<footer class="footer">
  <div class="footer-content">
    <p>&copy; {year} DevTools. All rights reserved.</p>
    {icp && (
      <p>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
          {icp}
        </a>
      </p>
    )}
  </div>
</footer>

<style>
  .footer {
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--color-border);
    background-color: var(--color-card);
  }

  .footer-content {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
  }

  a:hover {
    color: var(--color-accent);
  }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Footer.astro
git commit -m "feat: add Footer component with ICP placeholder"
```

---

### Task 7: 创建 Sidebar.vue

**Files:**
- Create: `src/components/Sidebar.vue`

- [ ] **Step 1: 创建 Sidebar.vue**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getToolsByCategory, getCategories } from '../data/tools';

const props = defineProps<{
  /** 当前页面路径，用于高亮匹配的导航项 */
  currentPath: string;
}>();

/** 侧边栏展开状态（组件内部管理） */
const isOpen = ref(false);

const categories = getCategories();
const toolsByCategory = getToolsByCategory();

/** 判断工具是否为当前激活项 */
function isActive(path: string): boolean {
  return props.currentPath === path;
}

function close() {
  isOpen.value = false;
}

function toggle() {
  isOpen.value = !isOpen.value;
}

/** Escape 键关闭侧边栏 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close();
  }
}

/** 监听 Header 汉堡菜单的 DOM 自定义事件 */
function handleSidebarToggle() {
  toggle();
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('sidebar-toggle', handleSidebarToggle);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('sidebar-toggle', handleSidebarToggle);
});
</script>

<template>
  <!-- 遮罩层 -->
  <div
    v-if="isOpen"
    class="sidebar-overlay"
    @click="close"
  />
  <aside :class="['sidebar', { 'sidebar--open': isOpen }]">
    <nav class="sidebar-nav">
      <div v-for="category in categories" :key="category" class="sidebar-group">
        <h3 class="sidebar-group-title">{{ category }}</h3>
        <ul class="sidebar-list">
          <li v-for="tool in toolsByCategory[category]" :key="tool.id">
            <a
              :href="tool.path"
              :class="['sidebar-link', { 'sidebar-link--active': isActive(tool.path) }]"
            >
              <span class="sidebar-icon">{{ tool.icon }}</span>
              <span class="sidebar-name">{{ tool.name }}</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar-overlay {
  display: none;
}

.sidebar {
  width: var(--sidebar-width);
  height: calc(100vh - 57px - 49px);
  overflow-y: auto;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-card);
  padding: var(--space-sm) 0;
  flex-shrink: 0;
}

.sidebar-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  padding: var(--space-md) var(--space-md) var(--space-xs);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text);
  font-size: 0.875rem;
  transition: background-color var(--transition-fast);
  border-radius: 0;
}

.sidebar-link:hover {
  background-color: var(--color-hover);
}

.sidebar-link--active {
  background-color: var(--color-hover);
  color: var(--color-accent);
  font-weight: 500;
  border-right: 2px solid var(--color-accent);
}

.sidebar-icon {
  font-size: 1rem;
  width: 1.5rem;
  text-align: center;
  flex-shrink: 0;
}

@media (max-width: 1023px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 99;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 57px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform var(--transition-normal);
    height: calc(100vh - 57px);
  }

  .sidebar--open {
    transform: translateX(0);
  }
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/Sidebar.vue
git commit -m "feat: add Sidebar component with internal state, sidebar-toggle event listener"
```

---

### Task 8: 创建 SearchBar.vue

**Files:**
- Create: `src/components/SearchBar.vue`

- [ ] **Step 1: 创建 SearchBar.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { searchTools } from '../data/tools';
import type { ToolMeta } from '../data/tools';

const props = defineProps<{
  /** 占位符文本 */
  placeholder?: string;
}>();

const emit = defineEmits<{
  /** 搜索结果变化时触发 */
  (e: 'results', tools: ToolMeta[]): void;
}>();

const query = ref('');

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounce 150ms 过滤 */
watch(query, (val) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    emit('results', searchTools(val));
  }, 150);
});
</script>

<template>
  <div class="search-bar">
    <span class="search-icon">🔍</span>
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder || '搜索工具...'"
      class="search-input"
    />
    <button
      v-if="query"
      class="search-clear"
      @click="query = ''"
      aria-label="清除搜索"
    >
      ✕
    </button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-card);
  transition: border-color var(--transition-fast);
}

.search-bar:focus-within {
  border-color: var(--color-accent);
}

.search-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: transparent;
}

.search-input::placeholder {
  color: var(--color-muted);
}

.search-clear {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}

.search-clear:hover {
  color: var(--color-text);
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/SearchBar.vue
git commit -m "feat: add SearchBar component with debounced filtering"
```

---

### Task 9: 创建 ToolCard.astro

**Files:**
- Create: `src/components/ToolCard.astro`

- [ ] **Step 1: 创建 ToolCard.astro**

```astro
---
import type { ToolMeta } from '../data/tools';

interface Props {
  tool: ToolMeta;
}

const { tool } = Astro.props;
---

<a href={tool.path} class="tool-card">
  <span class="tool-card-icon">{tool.icon}</span>
  <div class="tool-card-body">
    <h3 class="tool-card-name">{tool.name}</h3>
    <p class="tool-card-desc">{tool.description}</p>
  </div>
</a>

<style>
  .tool-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-lg);
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .tool-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .tool-card-icon {
    font-size: 1.75rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .tool-card-body {
    flex: 1;
    min-width: 0;
  }

  .tool-card-name {
    margin: 0 0 var(--space-xs);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .tool-card-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-muted);
    line-height: 1.5;
  }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ToolCard.astro
git commit -m "feat: add ToolCard component for dashboard grid"
```

---

### Task 10: 创建 CopyButton.vue 和 ClearButton.vue

**Files:**
- Create: `src/components/CopyButton.vue`
- Create: `src/components/ClearButton.vue`

- [ ] **Step 1: 创建 CopyButton.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { copyToClipboard } from '../utils/clipboard';

const props = defineProps<{
  /** 要复制的文本 */
  text: string;
  /** 按钮文本 */
  label?: string;
}>();

const copied = ref(false);

async function handleCopy() {
  const success = await copyToClipboard(props.text);
  if (success) {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  }
}
</script>

<template>
  <button
    :class="['copy-btn', { 'copy-btn--copied': copied }]"
    @click="handleCopy"
    :disabled="!text"
  >
    {{ copied ? '✓ 已复制' : (label || '复制') }}
  </button>
</template>

<style scoped>
.copy-btn {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.copy-btn:hover:not(:disabled) {
  background-color: var(--color-hover);
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-btn--copied {
  border-color: var(--color-success);
  color: var(--color-success);
}
</style>
```

- [ ] **Step 2: 创建 ClearButton.vue**

```vue
<script setup lang="ts">
defineProps<{
  /** 按钮文本 */
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
}>();
</script>

<template>
  <button class="clear-btn" @click="$emit('clear')">
    {{ label || '清空' }}
  </button>
</template>

<style scoped>
.clear-btn {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
  color: var(--color-muted);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.clear-btn:hover {
  background-color: var(--color-hover);
  color: var(--color-text);
}
</style>
```

- [ ] **Step 3: 提交**

```bash
git add src/components/CopyButton.vue src/components/ClearButton.vue
git commit -m "feat: add CopyButton and ClearButton components"
```

---

### Task 11: 创建 ToolHeader.vue

**Files:**
- Create: `src/components/ToolHeader.vue`

- [ ] **Step 1: 创建 ToolHeader.vue**

```vue
<script setup lang="ts">
defineProps<{
  /** 工具名称 */
  title: string;
  /** 工具描述 */
  description: string;
}>();

const emit = defineEmits<{
  (e: 'example'): void;
}>();
</script>

<template>
  <div class="tool-header">
    <div class="tool-header-info">
      <h1 class="tool-header-title">{{ title }}</h1>
      <p class="tool-header-desc">{{ description }}</p>
    </div>
    <button class="tool-header-example" @click="$emit('example')">
      填入示例
    </button>
  </div>
</template>

<style scoped>
.tool-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.tool-header-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.tool-header-desc {
  margin: var(--space-xs) 0 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

.tool-header-example {
  flex-shrink: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-card);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.tool-header-example:hover {
  background-color: var(--color-hover);
  border-color: var(--color-accent);
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/components/ToolHeader.vue
git commit -m "feat: add ToolHeader component with example button"
```

---

### Task 12: 创建 ToolLayout.astro

**Files:**
- Create: `src/layouts/ToolLayout.astro`

- [ ] **Step 1: 创建 ToolLayout.astro**

```astro
---
import Layout from './Layout.astro';
import Footer from '../components/Footer.astro';
import Sidebar from '../components/Sidebar.vue';
import SearchBar from '../components/SearchBar.vue';

interface Props {
  title?: string;
  /** 当前工具 ID，用于侧边栏高亮 */
  toolId?: string;
}

const { title = 'DevTools - 开发者工具集', toolId = '' } = Astro.props;
const currentPath = toolId ? `/${toolId}` : Astro.url.pathname;
---

<Layout title={title}>
  <div id="app">
    <header class="header">
      <div class="header-left">
        <button
          class="hamburger"
          id="hamburger-btn"
          aria-label="打开导航菜单"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <a href="/" class="logo">DevTools</a>
      </div>
      <div class="header-search">
        <SearchBar client:load placeholder="搜索工具..." />
      </div>
    </header>

    <div class="main-wrapper">
      <Sidebar client:load currentPath={currentPath} />
      <main class="content">
        <slot />
      </main>
    </div>

    <Footer />
  </div>
</Layout>

<script>
  const hamburgerBtn = document.getElementById('hamburger-btn');
  // Sidebar 的 isOpen 状态由 Vue 管理，这里通过自定义事件通信
  hamburgerBtn?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('sidebar-toggle'));
  });
</script>

<style>
  #app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-card);
    height: 57px;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .logo {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .logo:hover {
    color: var(--color-accent);
  }

  .hamburger {
    display: none;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-sm);
    border: none;
    background: none;
    cursor: pointer;
  }

  .hamburger span {
    display: block;
    width: 18px;
    height: 2px;
    background-color: var(--color-text);
    border-radius: 1px;
  }

  .header-search {
    width: 280px;
  }

  .main-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content {
    flex: 1;
    padding: var(--space-xl);
    overflow-y: auto;
    max-width: 100%;
  }

  @media (max-width: 1023px) {
    .hamburger {
      display: flex;
    }

    .header-search {
      display: none;
    }
  }

  @media (max-width: 767px) {
    .content {
      padding: var(--space-md);
    }
  }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add src/layouts/ToolLayout.astro
git commit -m "feat: add ToolLayout with header, sidebar, content area, and footer"
```

---

### Task 13: 重写首页（index.astro）

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 重写 index.astro**

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import ToolCard from '../components/ToolCard.astro';
import { tools, getCategories } from '../data/tools';

const categories = getCategories();
---

<ToolLayout title="DevTools - 开发者工具集">
  <div class="dashboard">
    <h1 class="dashboard-title">开发者工具集</h1>

    <div class="category-filters">
      <button class="filter-btn filter-btn--active" data-category="all">
        全部
      </button>
      {categories.map((cat) => (
        <button class="filter-btn" data-category={cat}>
          {cat}
        </button>
      ))}
    </div>

    <div class="tool-grid" id="tool-grid">
      {tools.map((tool) => (
        <div class="tool-grid-item" data-category={tool.category}>
          <ToolCard tool={tool} />
        </div>
      ))}
    </div>
  </div>
</ToolLayout>

<script>
  // 分类过滤逻辑
  const filterBtns = document.querySelectorAll('.filter-btn');
  const gridItems = document.querySelectorAll('.tool-grid-item');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // 切换激活状态
      filterBtns.forEach((b) => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');

      const category = btn.getAttribute('data-category');

      gridItems.forEach((item) => {
        if (category === 'all' || item.getAttribute('data-category') === category) {
          (item as HTMLElement).style.display = '';
        } else {
          (item as HTMLElement).style.display = 'none';
        }
      });
    });
  });
</script>

<style>
  .dashboard {
    max-width: 960px;
    margin: 0 auto;
  }

  .dashboard-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 var(--space-lg);
  }

  .category-filters {
    display: flex;
    gap: var(--space-sm);
    overflow-x: auto;
    padding-bottom: var(--space-sm);
    margin-bottom: var(--space-lg);
    -webkit-overflow-scrolling: touch;
  }

  .filter-btn {
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--color-card);
    color: var(--color-muted);
    font-size: 0.8125rem;
    font-family: var(--font-sans);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .filter-btn:hover {
    background-color: var(--color-hover);
    color: var(--color-text);
  }

  .filter-btn--active {
    background-color: var(--color-accent);
    color: #fff;
    border-color: var(--color-accent);
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }
</style>
```

- [ ] **Step 2: 删除 Astro 默认文件**

Run:
```bash
rm src/components/Welcome.astro src/assets/astro.svg src/assets/background.svg
```

- [ ] **Step 3: 验证首页渲染**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm dev
```

Expected: 打开浏览器访问 http://localhost:4321，应看到：
- Header 带 DevTools logo 和搜索框
- 侧边栏按分类展示 9 个工具
- 内容区展示分类过滤标签 + 工具卡片网格
- 点击分类标签过滤工具卡片
- Footer 显示版权信息

- [ ] **Step 4: 提交**

```bash
git add src/pages/index.astro
git rm src/components/Welcome.astro src/assets/astro.svg src/assets/background.svg
git commit -m "feat: implement dashboard homepage with category filters and tool grid"
```

---

### Task 14: 创建 UUID 生成器示例工具页

**Files:**
- Create: `src/tools/UuidGenerator.vue`
- Create: `src/pages/uuid-generator.astro`

此任务实现一个完整的工具页面，验证框架所有组件协同工作。工具的核心逻辑全部在 Vue 组件内完成，`.astro` 页面只负责布局包裹。

**架构要点：** 工具页面的交互逻辑应放在 `src/tools/` 下的 Vue 组件中，`.astro` 页面仅作为路由入口 + ToolLayout 包裹。这样 Vue 组件内部可以直接使用 CopyButton、ClearButton 等 Vue 子组件，事件通信全部在 Vue 体系内完成，不需要跨框架桥接。

- [ ] **Step 1: 创建 src/tools/UuidGenerator.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../components/ToolHeader.vue';
import CopyButton from '../components/CopyButton.vue';
import ClearButton from '../components/ClearButton.vue';
import { copyToClipboard } from '../utils/clipboard';

const version = ref('v4');
const amount = ref(1);
const results = ref<string[]>([]);

/** 生成 UUID v4 */
function generateV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 生成 UUID v1（简化版，基于时间戳和随机数） */
function generateV1(): string {
  const now = Date.now();
  const hex = now.toString(16).padStart(12, '0');
  const rand = () => Math.random().toString(16).substring(2, 6);
  return `${hex.slice(-8)}-${rand()}-1${rand().slice(1)}-${rand()}-${rand()}${rand()}`.replace(
    /^(.{8})-(.{4})-(.{4})-(.{4})-(.{12}).*$/,
    '$1-$2-$3-$4-$5',
  );
}

/** 生成 UUID v7（基于 Unix 时间戳） */
function generateV7(): string {
  const now = Date.now();
  const hex = now.toString(16).padStart(12, '0');
  const rand = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${rand().slice(1)}-${rand()}-${rand()}${rand()}`;
}

function generate() {
  const count = Math.min(Math.max(amount.value || 1, 1), 100);
  const gen = version.value === 'v1' ? generateV1 : version.value === 'v7' ? generateV7 : generateV4;
  results.value = Array.from({ length: count }, () => gen());
}

function handleExample() {
  version.value = 'v4';
  amount.value = 5;
  generate();
}

function handleClear() {
  results.value = [];
}

const allResultsText = computed(() => results.value.join('\n'));

const copiedRow = ref(-1);

async function copyRow(index: number) {
  const text = results.value[index];
  if (!text) return;
  const success = await copyToClipboard(text);
  if (success) {
    copiedRow.value = index;
    setTimeout(() => {
      copiedRow.value = -1;
    }, 1000);
  }
}
</script>

<template>
  <div class="uuid-tool">
    <ToolHeader
      title="UUID 生成器"
      description="生成多种版本的 UUID（v1、v4、v7 等）"
      @example="handleExample"
    />

    <div class="uuid-controls">
      <div class="uuid-version">
        <label class="field-label">UUID 版本</label>
        <select v-model="version" class="field-select">
          <option value="v4">v4（随机）</option>
          <option value="v1">v1（时间戳）</option>
          <option value="v7">v7（时间排序）</option>
        </select>
      </div>
      <div class="uuid-amount">
        <label class="field-label">生成数量</label>
        <input v-model.number="amount" type="number" :min="1" :max="100" class="field-input" />
      </div>
      <button class="btn-primary" @click="generate">生成</button>
    </div>

    <div class="uuid-output">
      <div class="output-header">
        <span class="output-label">生成结果</span>
        <div class="output-actions">
          <CopyButton v-if="results.length" :text="allResultsText" label="复制全部" />
          <ClearButton @clear="handleClear" />
        </div>
      </div>
      <div class="results-area">
        <p v-if="!results.length" class="results-placeholder">点击"生成"按钮或输入后自动生成 UUID</p>
        <div
          v-for="(uuid, index) in results"
          :key="index"
          class="result-row"
        >
          <code class="result-value">{{ uuid }}</code>
          <button class="result-copy" @click="copyRow(index)">
            {{ copiedRow === index ? '✓' : '复制' }}
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

.uuid-controls {
  display: flex;
  align-items: flex-end;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}

.uuid-version,
.uuid-amount {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-muted);
}

.field-select,
.field-input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-family: var(--font-sans);
  color: var(--color-text);
  background-color: var(--color-card);
}

.field-select:focus,
.field-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.field-input {
  width: 80px;
}

.btn-primary {
  padding: var(--space-sm) var(--space-lg);
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--color-accent);
  color: #fff;
  font-size: 0.875rem;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-primary:hover {
  opacity: 0.9;
}

.output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.output-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.output-actions {
  display: flex;
  gap: var(--space-sm);
}

.results-area {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  min-height: 120px;
  background-color: var(--color-card);
}

.results-placeholder {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: var(--space-xl) 0;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.result-row + .result-row {
  border-top: 1px solid var(--color-border);
}

.result-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
}

.result-copy {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-muted);
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
}

.result-copy:hover {
  color: var(--color-accent);
}
</style>
```

- [ ] **Step 2: 创建 uuid-generator.astro（路由入口）**

```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import UuidGenerator from '../tools/UuidGenerator.vue';
---

<ToolLayout title="UUID 生成器 - DevTools" toolId="uuid-generator">
  <UuidGenerator client:idle />
</ToolLayout>
```

- [ ] **Step 2: 验证 UUID 生成器页面**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm dev
```

Expected: 打开 http://localhost:4321/uuid-generator，验证：
- 侧边栏高亮 UUID 生成器
- ToolHeader 显示标题 + 描述 + 示例按钮
- 版本选择和数量输入正常工作
- 点击生成按钮产生 UUID
- 复制按钮正常工作
- 清空按钮正常工作

- [ ] **Step 3: 提交**

```bash
git add src/tools/UuidGenerator.vue src/pages/uuid-generator.astro
git commit -m "feat: add UUID generator tool page (Vue component + Astro route)"
```

---

### Task 15: 创建其余工具占位页面

**Files:**
- Create: `src/pages/hash-generator.astro`
- Create: `src/pages/random-string.astro`
- Create: `src/pages/base64.astro`
- Create: `src/pages/datetime-converter.astro`
- Create: `src/pages/url-encode.astro`
- Create: `src/pages/jwt-parser.astro`
- Create: `src/pages/device-info.astro`
- Create: `src/pages/symmetric-crypto.astro`

每个页面暂时只渲染 ToolHeader + 占位内容，确保侧边栏导航和路由可用。

- [ ] **Step 1: 创建占位页面**

每个文件使用相同模板，仅替换 `toolId`、`title`、`headerTitle`、`headerDesc`：

**hash-generator.astro:**
```astro
---
import ToolLayout from '../layouts/ToolLayout.astro';
import ToolHeader from '../components/ToolHeader.vue';
---

<ToolLayout title="哈希生成器 - DevTools" toolId="hash-generator">
  <div class="placeholder-tool">
    <ToolHeader
      client:idle
      title="哈希生成器"
      description="支持 MD5、SHA-1、SHA-256 等多种哈希算法，结果可转换为不同进制"
    />
    <div class="coming-soon">
      <p>功能开发中...</p>
    </div>
  </div>
</ToolLayout>

<style>
  .placeholder-tool {
    max-width: 720px;
  }
  .coming-soon {
    padding: var(--space-xl);
    text-align: center;
    color: var(--color-muted);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
  }
  .coming-soon p {
    margin: 0;
    font-size: 0.9375rem;
  }
</style>
```

**random-string.astro:** 同上，替换 `toolId="random-string"`, `title="随机字符串生成 - DevTools"`, `headerTitle="随机字符串生成"`, `headerDesc="自定义长度和字符集的随机字符串生成器"`

**base64.astro:** 同上，替换 `toolId="base64"`, `title="Base64 编解码 - DevTools"`, `headerTitle="Base64 编解码"`, `headerDesc="Base64 编码与解码，支持文本和文件"`

**datetime-converter.astro:** 同上，替换 `toolId="datetime-converter"`, `title="日期时间转换器 - DevTools"`, `headerTitle="日期时间转换器"`, `headerDesc="时间戳与日期格式互转，支持多种日期格式"`

**url-encode.astro:** 同上，替换 `toolId="url-encode"`, `title="URL 编解码 - DevTools"`, `headerTitle="URL 编解码"`, `headerDesc="URL 编码与解码，支持组件级和完整 URL 编码"`

**jwt-parser.astro:** 同上，替换 `toolId="jwt-parser"`, `title="JWT 解析器 - DevTools"`, `headerTitle="JWT 解析器"`, `headerDesc="解析和验证 JSON Web Token，展示 Header、Payload、Signature"`

**device-info.astro:** 同上，替换 `toolId="device-info"`, `title="设备信息与 UA - DevTools"`, `headerTitle="设备信息与 UserAgent"`, `headerDesc="查看浏览器、操作系统、屏幕等设备信息"`

**symmetric-crypto.astro:** 同上，替换 `toolId="symmetric-crypto"`, `title="对称加解密 - DevTools"`, `headerTitle="对称加解密"`, `headerDesc="支持 AES、DES 等主流对称加密算法的加解密"`

- [ ] **Step 2: 验证所有路由可达**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm dev
```

Expected: 侧边栏中每个工具链接点击后都能到达对应页面，侧边栏高亮正确切换。

- [ ] **Step 3: 提交**

```bash
git add src/pages/hash-generator.astro src/pages/random-string.astro src/pages/base64.astro src/pages/datetime-converter.astro src/pages/url-encode.astro src/pages/jwt-parser.astro src/pages/device-info.astro src/pages/symmetric-crypto.astro
git commit -m "feat: add placeholder pages for remaining 8 tools"
```

---

### Task 16: 最终构建验证

**Files:** 无新增/修改

- [ ] **Step 1: 运行生产构建**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm build
```

Expected: 构建成功，无报错

- [ ] **Step 2: 预览构建结果**

Run:
```bash
cd /e/WEBProjects/dev-tools && pnpm preview
```

Expected: 预览服务器启动，所有页面正常访问

- [ ] **Step 3: 提交所有剩余更改**

```bash
git add -A
git status  # 确认无遗漏文件
git commit -m "feat: complete project framework setup with Astro + Vue 3"
```
