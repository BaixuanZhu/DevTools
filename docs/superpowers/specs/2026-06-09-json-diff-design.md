# JSON Diff 工具设计文档

> 日期：2026-06-09
> 状态：已批准

## 概述

JSON Diff 是一个在线 JSON 对比工具，支持两种对比模式（语义模式 / 严格模式），通过并排视图可视化展示两份 JSON 的差异，并提供差异摘要统计面板。

## 整体架构与文件结构

### 工具注册

在 `src/data/tools.ts` 的 `tools` 数组中新增条目，归属「格式化」分类：

```ts
{
  id: 'json-diff',
  name: 'JSON Diff',
  description: '在线 JSON 对比工具，可视化展示两份 JSON 的差异',
  seoDescription: '在线 JSON 对比工具，支持语义对比与严格文本对比，并排可视化展示差异，纯浏览器端运算。',
  category: '格式化',
  icon: '🔍',
  path: '/format/json-diff',
}
```

### 文件结构

```
src/
├── pages/format/json-diff.astro          # 页面壳
├── tools/format/JsonDiff.vue             # 主 Vue 组件
├── utils/format/
│   └── json-diff.ts                      # 纯函数：语义 diff + 严格 diff 算法
```

### 页面壳 (`json-diff.astro`)

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import JsonDiff from '../../tools/format/JsonDiff.vue';
---
<ToolLayout title="JSON Diff - DevTools" toolId="format/json-diff">
  <JsonDiff client:idle />
</ToolLayout>
```

### 职责分离

- `json-diff.ts`：纯函数，负责两种 diff 算法（语义 / 严格），输出标准化的数据结构，不依赖 Vue，方便单元测试
- `JsonDiff.vue`：UI 层，负责输入、渲染、交互，调用工具函数获取 diff 结果

## 核心 Diff 算法

### 数据结构

```ts
/** 单个差异项 */
interface DiffItem {
  /** 差异类型 */
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  /** JSON 路径，如 "root.users[1].name" */
  path: string;
  /** 旧值（removed / modified 时有值） */
  oldValue?: unknown;
  /** 新值（added / modified 时有值） */
  newValue?: unknown;
}

/** 语义对比结果 */
interface DiffResult {
  /** 所有差异项（含 unchanged） */
  items: DiffItem[];
  /** 统计摘要 */
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

/** 严格模式的行级差异 */
interface LineDiff {
  type: 'added' | 'removed' | 'unchanged';
  /** 左侧行号（removed / unchanged 时有值） */
  leftLineNo?: number;
  /** 右侧行号（added / unchanged 时有值） */
  rightLineNo?: number;
  /** 行内容 */
  content: string;
}

/** 严格模式结果 */
interface StrictDiffResult {
  lines: LineDiff[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
  };
}
```

### 语义模式算法

递归对比两份已解析的 JSON 对象：

1. **对象对比**：遍历所有键的并集
   - 键仅存在于左侧 → `removed`
   - 键仅存在于右侧 → `added`
   - 键都存在但类型不同 → `modified`
   - 键都存在且类型相同 → 递归继续对比
2. **数组对比**：支持两种子模式
   - **有序模式**：按索引逐个递归对比
   - **无序模式**：将数组元素序列化为稳定字符串后匹配，未匹配的标记为 added / removed；重复元素使用多重集匹配（计数对比）
3. **基本类型**：直接用 `===` 比较，不等则为 `modified`
4. **特殊值**：`null` 与其他任何值比较均为 `modified`；`-0` 与 `0` 视为相同；`NaN` / `Infinity` 经 `JSON.stringify` 后均变为 `null`，视为相同

### 严格模式算法

1. 将两份 JSON 用 `JSON.stringify(obj, null, 2)` 格式化为标准缩进文本
2. 按行拆分为数组
3. 使用 LCS（最长公共子序列）算法求行级对齐
4. 输出 `LineDiff[]`，左侧行号 / 右侧行号分别递增
5. 纯文本 diff，不做语义分析

### 工具函数 API

```ts
/** 语义 diff，可选忽略数组顺序 */
function semanticDiff(
  left: unknown,
  right: unknown,
  options: { ignoreArrayOrder: boolean }
): DiffResult;

/** 严格文本 diff */
function strictDiff(
  leftJson: string,
  rightJson: string
): StrictDiffResult;

/** 扫描 JSON 文本的最大嵌套深度，O(n) 复杂度 */
function measureMaxDepth(jsonText: string): number;
```

## 边界条件与性能优化

### 嵌套深度拦截

解析前扫描原始文本计算最大嵌套深度，避免 `JSON.parse` 触发浏览器栈溢出：

| 深度 | 行为 |
|------|------|
| ≤ 128 | 正常解析和对比 |
| 129 ~ 256 | 正常解析，递归对比时深度超过 128 的节点标记为 `modified`（保守策略），摘要面板追加警告 |
| > 256 | 拒绝解析，提示"JSON 嵌套层级过深（{depth} 层），最大支持 256 层" |

扫描算法：逐字符遍历，遇 `{` 或 `[` 深度 +1，遇 `}` 或 `]` 深度 -1，忽略字符串内的括号。

### 输入校验

| 场景 | 时机 | 提示方式 | 提示内容 |
|------|------|---------|---------|
| 输入为空 | 点击对比 | textarea 下方红色文字 | "请输入 JSON 内容" |
| 非法 JSON | 点击对比 | textarea 下方红色文字 | "JSON 解析失败：第 {line} 行第 {col} 列，{reason}" |
| 只有一侧有输入 | 点击对比 | 对应侧 textarea 下方 | "请输入另一份 JSON 以开始对比" |
| 两侧都为空 | 点击对比 | 左侧 textarea 下方 | "请输入需要对比的 JSON 内容" |
| 非对象/非数组（如 `"hello"`、`123`） | 点击对比 | 正常对比 | 合法，直接做值对比 |

### 性能阈值分级

| 输入大小 | 行为 |
|---------|------|
| ≤ 500KB | 同步处理，即时显示 |
| 500KB ~ 2MB | 显示"对比中…"加载状态，同步处理但用 `requestAnimationFrame` 分片渲染 |
| 2MB ~ 10MB | Web Worker 异步处理，显示进度提示 |
| > 10MB | 拒绝处理，提示"内容过大（{size}MB），最大支持 10MB" |

### 算法优化

1. **语义 diff**
   - 对比前先做快速短路：`JSON.stringify(left) === JSON.stringify(right)` 则直接返回"无差异"
   - 对象键排序后再序列化用于短路检查，避免键顺序差异导致误判
   - 递归深度超过 128 层时停止递归，当前节点标记为 `modified`

2. **严格 diff（LCS）**
   - 空间优化：滚动数组将空间复杂度从 O(N×M) 降至 O(min(N,M))
   - 行数超过 5000 时，自动切换为 Myers diff 算法的线性变体（空间 O(N)）
   - 行文本做哈希映射，LCS 比较哈希整数而非字符串

3. **渲染优化**
   - 并排视图使用虚拟滚动（行数超过 200 时启用），只渲染可视区域 + 上下各 5 行缓冲区
   - diff 输出行数超过 1000 时，默认折叠 unchanged 块（上下文保留 3 行），提供"展开全部"按钮
   - 摘要面板始终即时渲染，不受虚拟滚动影响

### 整体防护清单

| 防护点 | 阈值 | 拦截时机 | 表现 |
|--------|------|---------|------|
| 文件/输入大小 | > 10MB | 对比前 | 红色提示，拒绝处理 |
| 嵌套深度（解析） | > 256 层 | `JSON.parse` 前 | 红色提示，拒绝解析 |
| 嵌套深度（对比） | > 128 层 | 递归对比中 | 截断标记 + 摘要警告 |
| 解析后节点总数 | > 500,000 | `JSON.parse` 后 | 提示"节点数量过多"，拒绝对比 |
| diff 输出行数 | > 1,000 行 | diff 计算后 | 自动折叠 unchanged，展示差异上下文 3 行，提供"展开全部"按钮 |

### Web Worker 方案（> 2MB 时启用）

- Worker 脚本：`src/utils/format/json-diff.worker.ts`
- 将 diff 算法代码抽取为纯函数，Worker 中 import 并执行
- 通过 `postMessage` 传递序列化后的 `DiffResult` / `StrictDiffResult`
- 支持 `terminate` 取消进行中的计算（用户修改输入时取消旧任务）

### 可配置项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ignoreArrayOrder` | `boolean` | `false` | 忽略数组元素顺序（语义模式） |
| `indentSize` | `2 \| 4` | `2` | 严格模式格式化缩进 |
| `contextLines` | `number` | `3` | 折叠时保留的上下文行数 |

## UI 布局与交互

### 页面布局

```
┌─────────────────────────────────────────────────────┐
│  ToolHeader: "JSON Diff" / "可视化对比两份 JSON 差异" │
├─────────────────────────────────────────────────────┤
│  操作栏（横跨全宽）                                    │
│  [语义模式 / 严格模式]  [忽略数组顺序 🔘]  [清空] [对比]  │
├──────────────────────┬──────────────────────────────┤
│  左侧输入区          │  右侧输入区                    │
│  "原始 JSON"         │  "修改后 JSON"                 │
│  ┌────────────────┐  │  ┌────────────────┐           │
│  │ textarea       │  │  │ textarea       │           │
│  └────────────────┘  │  └────────────────┘           │
│  [粘贴] [上传文件]    │  [粘贴] [上传文件]              │
├──────────────────────┴──────────────────────────────┤
│  摘要面板                                            │
│  ✅ 12 处一致  🟢 3 处新增  🔴 2 处删除  🟡 1 处修改    │
├──────────────────────┬──────────────────────────────┤
│  左侧 Diff 视图      │  右侧 Diff 视图                │
│  1 │ {              │  1 │ {                         │
│  2 │   "name":      │  2 │   "name":                 │
│    │ - "Alice"      │    │ + "Bob"                   │
│  3 │   "age": 30    │  3 │   "age": 30               │
│    │                │    │ +   "email": "b@b.com"    │
│  4 │ }              │  4 │ }                         │
├──────────────────────┴──────────────────────────────┤
│  [复制 Diff 结果]                                     │
└─────────────────────────────────────────────────────┘
```

### 组件结构

```
JsonDiff.vue
├── ToolHeader
├── 操作栏
│   ├── ModeTabGroup（语义模式 / 严格模式）
│   ├── ToggleSwitch（忽略数组顺序，仅语义模式可见）
│   ├── ClearButton
│   └── 对比按钮（主操作，accent 样式）
├── ResponsiveWorkspace mode="horizontal"（输入区）
│   ├── #input → 左侧 textarea + 粘贴/上传
│   └── #output → 右侧 textarea + 粘贴/上传
├── DiffSummary（摘要面板，对比后显示）
├── DiffViewer（并排 diff 视图）
│   ├── 左侧面板（同步滚动）
│   └── 右侧面板（同步滚动）
└── CopyButton（复制 diff 结果）
```

### 交互流程

1. **页面加载**：两个 textarea 自动聚焦左侧，无默认值（diff 工具需要用户自己的数据）
2. **输入**：支持手动输入、粘贴按钮、拖拽/点击上传文件，输入不做实时 diff
3. **点击「对比」**：
   - 校验两侧输入是否为合法 JSON
   - 根据当前模式调用对应算法
   - 显示加载状态（大文件时显示"对比中…"）
   - 渲染摘要面板 + diff 视图
4. **模式切换**：切换后自动重新对比（如果两侧都有输入）
5. **忽略数组顺序开关**：切换后自动重新对比
6. **清空**：重置两侧输入、摘要面板、diff 视图
7. **复制**：将 diff 结果复制为统一 diff 格式文本

### Diff 视图渲染规则

**语义模式**
- 两份 JSON 按路径展开为扁平化的键值行
- 左侧显示旧值，右侧显示新值
- 颜色编码：
  - `removed`：左侧行背景 `bg-red-50`，红色文字
  - `added`：右侧行背景 `bg-green-50`，绿色文字
  - `modified`：左侧 `bg-red-50` + 右侧 `bg-green-50`
  - `unchanged`：默认背景，默认文字色

**严格模式**
- 标准并排文本 diff，行号对齐
- `removed`：左侧红色背景行，右侧空行对齐
- `added`：左侧空行对齐，右侧绿色背景行
- `unchanged`：默认样式

**同步滚动**
- 左右面板监听 `scroll` 事件，互相同步 `scrollTop`
- 用 `requestAnimationFrame` 节流，避免抖动
- 用户主动滚动一侧时，另一侧跟随

**虚拟滚动**
- 行数超过 200 时启用虚拟滚动
- 每行高度固定（基于 `font-mono text-sm` 计算）
- 预渲染上下各 5 行缓冲区

## 错误处理

### 运行时状态

| 状态 | 展示 |
|------|------|
| 初始（未对比） | diff 视图区域显示占位："输入两份 JSON 后点击「对比」查看差异" |
| 对比中（同步） | 操作栏按钮显示 loading spinner，不可重复点击 |
| 对比中（Worker） | diff 视图区域显示"对比中…" + 进度指示，支持取消 |
| 对比完成 - 有差异 | 摘要面板 + diff 视图正常展示 |
| 对比完成 - 无差异 | 摘要面板显示"✅ 两份 JSON 完全一致，无差异"，不渲染 diff 视图 |

### 文件上传错误

| 场景 | 处理 |
|------|------|
| 非文本文件 | 提示"请上传 .json 或 .txt 文件" |
| 文件 > 10MB | 提示"文件过大（{size}MB），最大支持 10MB" |
| 文件编码非 UTF-8 | 尝试读取，失败则提示"文件编码不支持，请使用 UTF-8 编码" |

## 可访问性

- 两个 textarea 通过 `aria-label` 标识（"原始 JSON"、"修改后 JSON"）
- 摘要面板使用 `aria-live="polite"`，对比完成后自动播报结果
- diff 视图中颜色不是唯一区分手段，同时使用图标（`+`/`-`/`~`）标识差异类型
- 所有按钮支持键盘操作（Tab 聚焦，Enter / Space 触发）
- 同步滚动区域可通过键盘上下箭头滚动
