# JSON 转 XML / YAML 工具设计文档

> 设计日期：2026-06-09
> 对应需求：继续完善 JSON 家族，新增 JSON 转 XML/YAML 工具
> 所属项目：DevTools（基于 Astro 6 + Vue 3 的浏览器端开发者工具集合）

---

## 1. 概述

新增两个独立的 JSON 转换工具：

1. **JSON 转 XML**（`/format/json-to-xml`）：将 JSON 数据实时转换为 XML 格式，支持自定义根元素名。
2. **JSON 转 YAML**（`/format/json-to-yaml`）：将 JSON 数据实时转换为标准 YAML 格式。

两个工具拆分为独立页面，以提升搜索引擎可见性，并符合项目"单工具即开即用"的产品定位。

---

## 2. 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 转换方向 | 单向：JSON → XML / JSON → YAML | 需求明确，界面最简洁 |
| 页面拆分 | 两个独立工具页面 | SEO 更友好，URL 语义清晰，加载更轻量 |
| XML 转换策略 | 朴素元素型 | 对用户输入无特殊约定，即开即用 |
| XML 根元素名 | 默认 `root`，用户可自定义 | 兼顾简单与灵活 |
| YAML 实现 | 引入 `js-yaml` | 周下载量 2000 万+，输出标准可靠，体积可控 |
| 大输入处理 | Web Worker，阈值 500KB | 与 JSON 家族现有工具保持一致 |
| 公共 UI | 暂不提取独立组件 | 当前仅两个工具，硬抽象收益不大；保持一工具一文件边界 |

---

## 3. 工具注册信息

在 `src/data/tools.ts` 中注册（插入于 `json-diff` 之后）：

### JSON 转 XML

| 字段 | 值 |
|------|-----|
| ID | `json-to-xml` |
| 名称 | JSON 转 XML |
| 分类 | 格式化 |
| URL | `/format/json-to-xml` |
| 图标 | 🌲 |
| 描述 | 将 JSON 数据转换为 XML 格式，支持自定义根元素名 |
| SEO 描述 | 在线 JSON 转 XML 工具，输入 JSON 即可生成标准 XML，支持自定义根元素名，纯浏览器端运算不上传数据。 |

### JSON 转 YAML

| 字段 | 值 |
|------|-----|
| ID | `json-to-yaml` |
| 名称 | JSON 转 YAML |
| 分类 | 格式化 |
| URL | `/format/json-to-yaml` |
| 图标 | 📝 |
| 描述 | 将 JSON 数据转换为标准 YAML 格式 |
| SEO 描述 | 在线 JSON 转 YAML 工具，输入 JSON 即可生成标准 YAML 配置格式，纯浏览器端运算不上传数据。 |

---

## 4. 文件结构

```
src/
├── tools/format/
│   ├── JsonToXml.vue          # XML 工具主组件
│   └── JsonToYaml.vue         # YAML 工具主组件
├── pages/format/
│   ├── json-to-xml.astro      # XML 工具页面
│   └── json-to-yaml.astro     # YAML 工具页面
├── utils/format/
│   ├── json-to-xml.ts         # XML 转换核心 + 类型定义
│   ├── json-to-xml.worker.ts  # XML Web Worker
│   ├── json-to-yaml.ts        # YAML 转换核心 + 类型定义
│   └── json-to-yaml.worker.ts # YAML Web Worker
└── utils/format/__tests__/
    ├── json-to-xml.test.ts    # XML 转换单元测试
    └── json-to-yaml.test.ts   # YAML 转换单元测试
```

### 页面 `.astro` 模板

与现有工具保持一致：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import JsonToXml from '../../tools/format/JsonToXml.vue';
---

<ToolLayout title="JSON 转 XML - DevTools" toolId="format/json-to-xml">
  <JsonToXml client:idle />
</ToolLayout>
```

YAML 页面结构相同，仅替换组件和标题。

---

## 5. 组件与交互设计

### 公共行为（两个工具一致）

- 页面加载后自动聚焦 JSON 输入框。
- 用户输入/粘贴 JSON 后 **500ms 防抖**，自动触发转换。
- 输入为空时清空输出和错误。
- 输入大小超过 `INPUT_SIZE_LIMIT`（10MB）时报错。
- 输入大小超过 `WORKER_THRESHOLD`（500KB）时走 Web Worker。
- 输出区只读，提供**复制结果**和**清空**按钮。

### JSON 转 XML 组件特有选项

- 根元素名输入框，默认值为 `root`。
- 实时校验：不能为空，只能包含字母、数字、下划线和连字符。
- 修改根元素名后自动重新转换。

### JSON 转 YAML 组件

- 无额外选项，保持极简。

### 界面布局

```
┌────────────────────────────────────────────────────────────┐
│  JSON 转 XML / YAML                                        │
│  描述文案...                            [填入示例]        │
├────────────────────────────────────────────────────────────┤
│  [XML 特有: 根元素名:  [ root          ]]                  │
├─────────────────────────┬──────────────────────────────────┤
│  JSON 输入              │  XML / YAML 输出                 │
│  {                      │  <?xml...> / YAML 结果           │
│    ...                  │  ...                             │
│  }                      │                                  │
├─────────────────────────┴──────────────────────────────────┤
│  [清空]  [复制结果]                                        │
└────────────────────────────────────────────────────────────┘
```

---

## 6. 转换逻辑

### XML 转换算法（`json-to-xml.ts`）

**策略：朴素元素型**

- JSON 对象 → XML 元素，键名为元素名。
- JSON 数组 → 父元素包裹，每个数组元素用单数形式的元素名包裹。
  - 启发式规则：如果键以 `s` 结尾，去掉末尾 `s`；否则用原键名 + `_item`。
- 基本类型（`string` / `number` / `boolean` / `null`）→ 元素文本内容。
- `null` → 空元素 `<key></key>`。
- 输出包含 XML 声明：`<?xml version="1.0" encoding="UTF-8"?>`。

**示例：**

输入 JSON：

```json
{
  "users": [
    { "name": "Alice", "age": 30 }
  ],
  "count": 1
}
```

输出 XML：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <users>
    <user>
      <name>Alice</name>
      <age>30</age>
    </user>
  </users>
  <count>1</count>
</root>
```

### YAML 转换算法（`json-to-yaml.ts`）

直接调用 `js-yaml` 的 `dump(data, options)`：

- `indent: 2`
- `noRefs: true`（避免循环引用时输出 `[Circular]`，而是直接报错）
- `sortKeys: false`（保持 JSON 原始键顺序）
- `lineWidth: 0`（不自动折行）

### 类型定义

```ts
// utils/format/json-to-xml.ts
export interface JsonToXmlOptions {
  rootName: string;
}

export interface JsonConvertSuccess {
  ok: true;
  result: string;
}

export interface JsonConvertError {
  ok: false;
  error: string;
}

export type JsonToXmlResult = JsonConvertSuccess | JsonConvertError;
export type JsonToYamlResult = JsonConvertSuccess | JsonConvertError;
```

### Worker 通信协议

```ts
// XML Worker 请求
interface JsonToXmlWorkerRequest {
  json: string;
  rootName: string;
}

// YAML Worker 请求
interface JsonToYamlWorkerRequest {
  json: string;
}

// 公共响应
interface JsonConvertWorkerResponse {
  ok: true;
  result: string;
} | {
  ok: false;
  error: string;
};
```

Worker 内部只做三件事：
1. `JSON.parse(json)` 解析。
2. 调用对应转换函数。
3. `postMessage` 结果。

主线程负责大小检查、深度检查、错误文案本地化。

---

## 7. 默认值

每个工具页面打开时自动填入一段示例 JSON，覆盖常见结构（对象、数组、嵌套、`null`）：

```json
{
  "users": [
    { "name": "Alice", "age": 30, "active": true },
    { "name": "Bob", "age": null, "active": false }
  ],
  "count": 2,
  "meta": { "version": "1.0" }
}
```

XML 默认根元素名：`root`。

---

## 8. 错误处理

| 场景 | 错误位置 | 提示文案 |
|------|----------|----------|
| 输入为空 | 输入区下方 | 请输入 JSON 数据 |
| JSON 语法错误 | 输入区下方 | JSON 语法错误：...（第 X 行，第 Y 列） |
| 嵌套层级过深（>256 层） | 输入区下方 | JSON 嵌套层级过深（X 层），最大支持 256 层 |
| 节点数量过多（>50 万） | 输入区下方 | 节点数量过多（X），最大支持 500,000 |
| 数据量超过 10MB | 输入区下方 | 数据量超过 10MB 限制，无法处理 |
| XML 根元素名为空 | 选项下方 | 根元素名不能为空 |
| XML 根元素名含非法字符 | 选项下方 | 根元素名只能包含字母、数字、下划线和连字符 |
| Worker 执行失败 | 输出区 | 转换执行出错，请重试 |
| YAML 循环引用 | 输出区 | JSON 包含循环引用，无法转换为 YAML |

### 成功反馈

- 点击**复制结果**：触发全局 Toast，显示"已复制"，持续 1.5s。
- 点击**清空**：重置输入、输出、错误、根元素名。

### 无障碍

- 输入框关联 `aria-label="JSON 输入"`。
- 错误消息通过 `aria-describedby` 关联到输入框。
- 复制结果按钮在输出为空时 `disabled`，并降低透明度。

---

## 9. 依赖清单

新增运行时依赖：

```json
{
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

新增开发依赖：

```json
{
  "devDependencies": {
    "@types/js-yaml": "^4.0.9"
  }
}
```

- `js-yaml` 周下载量 2000 万+，维护活跃，输出标准 YAML。
- 无其他新依赖。XML 转换原生实现。

---

## 10. 测试策略

### XML 转换测试（`json-to-xml.test.ts`）

- 基础对象转换
- 数组转换（含复数键去 `s` 的启发式规则）
- 嵌套对象
- `null` / `boolean` / `number` 处理
- 自定义根元素名
- 非法根元素名校验
- 无效 JSON 报错

### YAML 转换测试（`json-to-yaml.test.ts`）

- 基础对象转换
- 数组转换
- 嵌套缩进
- 无效 JSON 报错
- 循环引用报错

---

## 11. 性能与合规

### 性能基线

- 单工具页 gzip 后 JS < 50KB。
- `js-yaml` 约 16KB minified / ~5KB gzip，加上 Worker 和组件代码后仍在预算内。
- 大输入走 Worker，不阻塞 UI。

### 合规检查

- 不使用 `eval()` 或 `Function()` 处理用户输入。
- 所有转换均在浏览器本地完成，无数据上传。
- 遵循 WCAG 2.1 AA 标准（标签、焦点、ARIA、对比度）。
- 遵循 DESIGN.md 设计令牌与 Tailwind 工具类规范。

---

## 12. 后续可扩展点（本次不做）

以下功能明确超出本次范围，仅作记录：

- XML / YAML 反向转 JSON
- TOML 格式转换
- XML 属性型转换策略（`@` 前缀）
- 输出缩进大小自定义
- JSON 键排序选项
