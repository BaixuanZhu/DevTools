# 三新工具设计文档：Cron 解析器 / Base64 转图片 / Base64 转文件

> 日期：2026-06-06
> 状态：已确认

---

## 概述

新增三个独立工具页面，遵循项目已有的工具实现模式（Astro 页面 + Vue 组件 + 工具函数）。

| 工具 | 路由 | 分类 | 新增依赖 |
|------|------|------|---------|
| Cron 表达式解析器 | `/datetime/cron-parser` | 日期时间 | `cron-parser` |
| Base64 转图片 | `/encoding/base64-to-image` | 编码转换 | 无 |
| Base64 转文件 | `/encoding/base64-to-file` | 编码转换 | 无 |

三个工具均为浏览器端运算，无后端交互。

---

## 1. 工具注册表

在 `src/data/tools.ts` 中新增三条 `ToolMeta` 记录：

```typescript
// Cron 表达式解析器
{
  id: 'cron-parser',
  name: 'Cron 表达式解析器',
  description: '解析 Cron 表达式，预览执行时间，可视化构建',
  seoDescription: '在线 Cron 表达式解析器，支持可视化构建、执行时间预览和常用模板，帮助开发者快速编写和验证定时任务表达式。',
  category: '日期时间',
  icon: '⏰',
  path: '/datetime/cron-parser',
}

// Base64 转图片
{
  id: 'base64-to-image',
  name: 'Base64 转图片',
  description: '将 Base64 字符串解码为图片并预览下载',
  seoDescription: '在线 Base64 转图片工具，支持 PNG、JPEG、GIF、SVG、WebP 等格式，实时预览图片、显示尺寸大小信息，一键下载。',
  category: '编码转换',
  icon: '🖼️',
  path: '/encoding/base64-to-image',
}

// Base64 转文件
{
  id: 'base64-to-file',
  name: 'Base64 转文件',
  description: '将 Base64 字符串解码为文件并下载',
  seoDescription: '在线 Base64 转文件工具，支持 Data URI 格式输入，自动识别 MIME 类型，一键下载还原文件。',
  category: '编码转换',
  icon: '📎',
  path: '/encoding/base64-to-file',
}
```

---

## 2. 文件结构

```
src/
├── utils/
│   ├── datetime/
│   │   └── cron.ts                    # cron 解析逻辑 + 字段双向转换
│   └── encoding/
│       ├── base64-image.ts            # base64→图片 解码 + MIME 检测
│       └── base64-file.ts             # base64→文件 解码 + MIME 检测 + 扩展名推断
├── tools/
│   ├── datetime/
│   │   └── CronParser.vue             # cron 解析器 Vue 组件
│   └── encoding/
│       ├── Base64ToImage.vue          # base64 转图片 Vue 组件
│       └── Base64ToFile.vue           # base64 转文件 Vue 组件
├── pages/
│   ├── datetime/
│   │   └── cron-parser.astro          # cron 页面
│   └── encoding/
│       ├── base64-to-image.astro      # base64 转图片页面
│       └── base64-to-file.astro       # base64 转文件页面
```

每个工具页面（.astro）仅作为 Vue 组件的容器：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import ToolComponent from '../../tools/category/ToolComponent.vue';
---

<ToolLayout title="工具名称 - DevTools" toolId="category/tool-id">
  <ToolComponent client:idle />
</ToolLayout>
```

---

## 3. Cron 表达式解析器

### 3.1 功能范围

- **解析 & 预览执行时间**：输入 cron 表达式，展示接下来 10 次执行时间
- **可视化构建器**：5 个下拉选择器（分钟、小时、日、月、周），与输入框双向绑定
- **常用模板**：预设模板一键填入（每分钟、每小时、每天、每周一、每月、每年）

不包含"人类可读描述"功能。

### 3.2 UI 布局（垂直）

```
┌──────────────────────────────────────────┐
│  ToolHeader: Cron 表达式解析器           │
│  + 示例按钮                               │
├──────────────────────────────────────────┤
│  Cron 输入框（单行 input）                │
│  [清空]                                   │
├──────────────────────────────────────────┤
│  可视化构建器（DisclosureSection 折叠）    │
│  ┌──────┬──────┬──────┬──────┬──────┐    │
│  │ 分钟 │ 小时 │ 日   │ 月   │ 周   │    │
│  │ 下拉 │ 下拉 │ 下拉 │ 下拉 │ 下拉 │    │
│  └──────┴──────┴──────┴──────┴──────┘    │
├──────────────────────────────────────────┤
│  常用模板（标签按钮组）                     │
│  [每分钟] [每小时] [每天] [每周一] [每月]   │
├──────────────────────────────────────────┤
│  下次执行时间（列表，默认 10 条）           │
│  #1  2026-06-06 14:05:00                 │
│  #2  2026-06-06 14:10:00                 │
│  ...                                     │
│  [复制列表]                               │
└──────────────────────────────────────────┘
```

### 3.3 核心逻辑（`src/utils/datetime/cron.ts`）

使用 `cron-parser` 库解析表达式。

```typescript
/** cron 字段结构 */
interface CronFields {
  minute: string;
  hour: string;
  day: string;
  month: string;
  dayOfWeek: string;
}

/** 解析结果 */
interface CronParseResult {
  nextExecutions: Date[];
  fields: CronFields;
}

/**
 * 解析 cron 表达式，返回接下来 N 次执行时间
 * @param expression 标准 5 字段 cron 表达式
 * @param count 返回的执行时间数量，默认 10
 * @throws 表达式格式错误时抛出中文描述错误
 */
function parseCronExpression(expression: string, count?: number): CronParseResult

/**
 * 从 5 个字段值拼接 cron 表达式
 */
function buildCronFromFields(fields: CronFields): string

/**
 * 反向解析 cron 表达式到 5 个字段的值
 */
function getFieldsFromExpression(expression: string): CronFields
```

### 3.4 常用模板

```typescript
const CRON_TEMPLATES = [
  { label: '每分钟', expression: '* * * * *' },
  { label: '每小时', expression: '0 * * * *' },
  { label: '每天零点', expression: '0 0 * * *' },
  { label: '每天 9 点', expression: '0 9 * * *' },
  { label: '每周一 9 点', expression: '0 9 * * 1' },
  { label: '每月 1 日零点', expression: '0 0 1 * *' },
  { label: '工作日 9 点', expression: '0 9 * * 1-5' },
  { label: '每 5 分钟', expression: '*/5 * * * *' },
];
```

### 3.5 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| 表达式为空 | 不触发解析，清空结果 |
| 字段数不等于 5 | 内联提示 "Cron 表达式应有 5 个字段（分 时 日 月 周）" |
| 字段值越界 | 内联提示 "第 X 个字段值无效：..." |
| 无效字符 | 内联提示 "包含无效字符" |

### 3.6 可视化构建器细节

每个字段使用 `SelectListbox` 组件，提供常用选项：

- **分钟**：`*`（每分钟）、`0`（第 0 分）、`*/5`（每 5 分）、`*/15`（每 15 分）、`*/30`（每 30 分）、`0,30`（0 和 30 分）
- **小时**：`*`（每小时）、`0`（0 点）、`9`（9 点）、`12`（12 点）、`18`（18 点）
- **日**：`*`（每天）、`1`（1 日）、`15`（15 日）
- **月**：`*`（每月）、`1`（1 月）
- **周**：`*`（每天）、`1`（周一）、`1-5`（工作日）、`0,6`（周末）

选择后自动拼接到输入框，输入框手动修改时反向解析到下拉框。

---

## 4. Base64 转图片

### 4.1 功能范围

- 输入 base64 字符串（支持 data URI 前缀或纯 base64），实时解码并预览图片
- 支持 PNG、JPEG、GIF、SVG、WebP、BMP、ICO 格式
- 显示图片尺寸（宽×高）、文件大小、MIME 类型
- 一键下载图片到本地

### 4.2 UI 布局（水平分栏，ResponsiveWorkspace）

```
┌────────────────────┬────────────────────┐
│  ToolHeader        │  预览结果           │
│  + 示例按钮        │                    │
│                    │  ┌──────────────┐  │
│  ┌──────────────┐  │  │              │  │
│  │ Base64 文本  │  │  │  图片预览区   │  │
│  │ 输入框       │  │  │  (object URL)│  │
│  │ (textarea)   │  │  │              │  │
│  │              │  │  └──────────────┘  │
│  └──────────────┘  │                    │
│                    │  图片信息：          │
│  [清空]            │  尺寸: 200×200      │
│                    │  大小: 3.2 KB        │
│                    │  格式: PNG           │
│                    │                    │
│                    │  [下载图片] [复制]   │
└────────────────────┴────────────────────┘
```

### 4.3 核心逻辑（`src/utils/encoding/base64-image.ts`）

零依赖，纯浏览器原生 API。

```typescript
/** 图片解码结果 */
interface ImageDecodeResult {
  objectUrl: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

/**
 * 将 base64 字符串解码为图片
 * 自动检测并移除 data URI 前缀，通过文件头魔数识别 MIME 类型
 */
function decodeBase64ToImage(base64Str: string): ImageDecodeResult

/**
 * 从 data URI 前缀或文件头魔数检测图片 MIME 类型
 * @returns MIME 类型字符串，无法识别时返回 null
 */
function detectImageMimeType(base64Str: string): string | null
```

**解码流程：**
1. 检测并移除 `data:image/xxx;base64,` 前缀
2. `atob()` → `Uint8Array` → `new Blob([buffer], { type: mimeType })`
3. `URL.createObjectURL(blob)` 创建预览 URL
4. 通过 `<img>` 的 `onload` 事件获取 `naturalWidth`/`naturalHeight`

**下载实现：**
```typescript
function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 4.4 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| 输入为空 | 清空预览和信息区，不显示错误 |
| 无效 Base64 字符 | 内联提示 "输入不是有效的 Base64 编码" |
| 非图片格式 | 内联提示 "无法识别为图片格式，请检查输入" |
| 数据过大（>10MB） | 警告提示 "文件较大，可能影响浏览器性能" |

### 4.5 示例数据

提供一个 1×1 像素 PNG 的 base64 编码作为示例数据，确保加载快速。

---

## 5. Base64 转文件

### 5.1 功能范围

- 输入 base64 字符串（支持 data URI 和纯 base64），实时解析文件信息
- 显示文件大小、MIME 类型、推断的扩展名
- 支持 data URI 格式自动提取 MIME 类型
- 一键下载文件

### 5.2 UI 布局（水平分栏，ResponsiveWorkspace）

```
┌────────────────────┬────────────────────┐
│  ToolHeader        │  文件信息           │
│  + 示例按钮        │                    │
│                    │  MIME 类型: text/plain│
│  ┌──────────────┐  │  文件大小: 1.2 KB    │
│  │ Base64 文本  │  │  扩展名: .txt        │
│  │ 输入框       │  │                    │
│  │ (textarea)   │  │  MIME 类型选择：    │
│  │              │  │  [SelectListbox]    │
│  │              │  │  (无 data URI 时)   │
│  └──────────────┘  │                    │
│                    │  [下载文件]         │
│  [清空]            │                    │
└────────────────────┴────────────────────┘
```

### 5.3 核心逻辑（`src/utils/encoding/base64-file.ts`）

零依赖，纯浏览器原生 API。

```typescript
/** 文件解码结果 */
interface FileDecodeResult {
  blob: Blob;
  mimeType: string;
  size: number;
  suggestedExtension: string;
  suggestedFileName: string;
}

/**
 * 将 base64 字符串解码为文件
 * @param base64Str data URI 或纯 base64 字符串
 * @param fallbackMimeType 无 data URI 时的备用 MIME 类型
 */
function decodeBase64ToFile(base64Str: string, fallbackMimeType?: string): FileDecodeResult

/**
 * 从 data URI 提取 MIME 类型
 * 格式：data:[<mediatype>][;base64],<data>
 */
function extractMimeTypeFromDataUri(dataUri: string): string | null

/**
 * 根据文件头魔数推断 MIME 类型
 */
function guessMimeTypeFromMagicBytes(base64Str: string): string | null

/**
 * MIME 类型 → 文件扩展名映射
 */
function guessExtension(mimeType: string): string
```

### 5.4 MIME 类型选择

当输入为纯 base64（无 data URI 前缀）时，提供 `SelectListbox` 让用户选择 MIME 类型：

```
常用选项：text/plain, application/json, application/pdf,
         application/octet-stream, application/xml, text/csv,
         application/zip, application/gzip
```

默认值为 `application/octet-stream`（通用二进制）。

### 5.5 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| 输入为空 | 清空信息区，不显示错误 |
| 无效 Base64 | 内联提示 "输入不是有效的 Base64 编码" |
| 无法识别 MIME | 显示 SelectListbox 让用户手动选择，不报错 |

---

## 6. 安全约束

- **纯浏览器端运算**：所有三个工具无网络请求，无后端交互
- **禁止 eval/Function**：Base64 解码使用 `atob()` + `Uint8Array`，不使用 `eval()` 或 `Function()`
- **正则安全**：Cron 表达式解析使用 `cron-parser` 库（内置 try-catch），不手动构造正则执行用户输入
- **大文件警告**：>10MB 数据给出警告提示，但不阻止操作

---

## 7. 复用的现有组件

| 组件 | 使用位置 |
|------|---------|
| `ToolHeader.vue` | 三个工具的标题+描述+示例按钮 |
| `ResponsiveWorkspace.vue` | Base64 转图片/转文件的水平分栏布局 |
| `ModeTabGroup.vue` | —（Cron 无需模式切换） |
| `CopyButton.vue` | 三个工具的复制功能 |
| `ClearButton.vue` | 三个工具的清空功能 |
| `SelectListbox.vue` | Cron 构建器的字段选择、Base64 转文件的 MIME 类型选择 |
| `DisclosureSection.vue` | Cron 构建器的折叠面板 |
| `ToggleSwitch.vue` | —（暂无使用场景） |

---

## 8. 实现顺序

1. **Base64 转图片** — 零依赖，逻辑简单，可快速交付
2. **Base64 转文件** — 与转图片逻辑类似，可复用解码模式
3. **Cron 表达式解析器** — 需要引入新依赖，可视化构建器双向绑定逻辑较复杂
