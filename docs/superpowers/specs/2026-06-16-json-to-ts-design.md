# JSON 转 TypeScript 接口工具 — 设计文档

- **日期**：2026-06-16
- **状态**：已确认，待实现
- **关联路线图**：ROADMAP P0「format 分类：新增 JSON → TypeScript 接口」
- **路由**：`/format/json-to-ts`

---

## 一、背景与目标

当前 format（格式化）分类覆盖了 JSON 生态的格式化、对比、转 XML、转 YAML，但缺少「JSON → TypeScript 类型」这一前端高频需求。开发者拿到后端返回的 JSON 样例后，第一件事往往是据此推导出 TS 类型；本工具让这件事「粘贴即出」，纯浏览器端运算，不上传数据。

**成功标准**：粘贴任意合法 JSON，5 秒内得到可直接复制到 `.ts` 文件、能通过 `tsc --strict` 检查的接口定义；对数组对象自动合并字段并标注可选字段。

---

## 二、实现方案

**选定方案 A：自研递归类型推断器，0 运行时依赖。**

| 候选 | 结论 |
|------|------|
| A. 自研（选定） | 算法简单、体积最小、完全可控；与 json-to-yaml / json-to-xml 同为自研，范式一致；符合 CLAUDE.md「原生优先、不引实验库」 |
| B. 引入 quicktype | 核心包数百 KB，远超 50KB 预算；API 面向多语言输出，过度设计 |
| C. 引入 transform-json-types | 社区规模小、维护活跃度存疑，属「未经广泛验证」 |

JSON 解析用原生 `JSON.parse`，类型推断为纯递归逻辑，无第三方依赖。

---

## 三、交互设计

复用 format 分类的标准范式（参考 `JsonToYaml.vue`），保持全站体验一致。

- **左侧输入区**
  - JSON 输入框（多行），默认填入示例数据，打开页面即可看到效果
  - 顶部「根类型名」输入框，默认 `RootObject`，输入时实时校验是否为合法 TS 标识符，非法时中文内联报错
- **右侧输出区**
  - TypeScript 输出框（只读），展示推断结果
  - 「复制结果」按钮（复制成功触发 `CustomEvent('toast')` 通知）
- **全局操作**
  - 「清空」按钮：重置输入、根类型名（恢复默认）、输出与错误
  - 防抖 500ms 自动转换（输入或根类型名变化时触发）
  - 输入大小限制 10MB，超限给出中文提示
  - 大输入（超过 `WORKER_THRESHOLD`）走 Web Worker，避免阻塞主线程

---

## 四、架构与文件清单

```
src/
├── pages/format/json-to-ts.astro          # 页面（ToolLayout + 组件 client:idle）
├── tools/format/JsonToTs.vue              # 交互组件
├── utils/format/
│   ├── json-to-ts.ts                      # 纯函数核心：jsonToTs(value, rootName) → Result
│   └── json-to-ts.worker.ts              # Web Worker，大输入异步转换
└── utils/format/__tests__/
    └── json-to-ts.test.ts                 # 单元测试
```

**修改**：
- `src/data/tools.ts` — 注册工具元数据
- `src/data/tool-faqs.ts` — 新增 3 条 FAQ

**接口契约**：

```ts
/** jsonToTs 转换结果 */
type JsonToTsResult =
  | { ok: true; result: string }
  | { ok: false; error: string };

/**
 * 将 JSON 文本推断为 TypeScript 接口定义文本。
 * 内部依次完成：JSON 解析 → 根类型名校验 → 递归类型推断 → 深度保护。
 * @param jsonText 原始 JSON 文本
 * @param rootName 顶层类型名
 * @returns 转换结果；ok=false 时 error 为中文错误描述
 */
function jsonToTs(jsonText: string, rootName: string): JsonToTsResult;
```

Worker 与主线程通过 `postMessage` 交换 `{ json: string; rootName: string }` 请求与 `JsonToTsResult` 响应，沿用 `json-to-yaml.worker.ts` 的双层架构（同步处理小输入、Worker 处理大输入）。

---

## 五、类型推断规则（核心）

### 5.1 基本类型

| JSON 值 | TS 类型 |
|---------|---------|
| `"abc"` | `string` |
| `123` / `1.5` | `number` |
| `true` / `false` | `boolean` |
| `null` | `null` |

### 5.2 对象

递归生成 `interface`，逐字段推断子类型。根对象用 rootName 命名。

### 5.3 数组（核心特性）

统一遍历所有元素，按元素形态分组推断，最后合并：

- **对象元素**：全部参与合并，字段取并集；仅部分元素含有的字段标记为**可选** `field?: type`，并生成一个以「数组元素类型名」命名的嵌套 `interface`
- **基本类型 / null 元素**：收集各自类型
- **合并输出**：数组元素类型 = 对象 interface 名（若有）∪ 基本类型并集（若有）
  - 单一类型 → `T[]`（如 `RootObjectUser[]`、`number[]`）
  - 多类型 → `(A | B)[]`（如 `(RootObjectItem | number)[]`）
  - **空数组 `[]`** → `unknown[]`（元素类型未知，比 `never[]` 语义更诚实）

### 5.4 类型并集

- 同一字段在不同元素中类型不同 → 取并集 `A | B`
- 并集内去重，并按固定顺序排列（string → number → boolean → null → 对象类型）保证输出稳定
- 单元素并集退化为该类型本身（不输出 `string`）

### 5.5 类型名派生（避免冲突）

- 根类型名 = rootName（如 `RootObject`）
- 对象字段 `field` 的嵌套类型名 = `rootName + PascalCase(field)`（如字段 `users` → `RootObjectUsers`）
- 数组元素类型名 = 父类型名 + `Item`（如 `RootObjectUsers` 的元素 → `RootObjectUsersItem`）
- 维护「已使用类型名」集合，派生名冲突时追加数字后缀（`RootObjectUsers2`）

### 5.6 顶层非对象

- 顶层是**数组**：输出 `type RootName = RootNameItem[];`（元素为对象时）或 `type RootName = T[];`（元素为基本类型），对象元素再补 `interface RootNameItem`
- 顶层是**基本类型**：输出 `type RootName = string;`

### 5.7 推断示例

输入 + rootName=`RootObject`：

```json
{
  "users": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob", "active": true }
  ],
  "count": 2,
  "tags": ["a", 1],
  "meta": null
}
```

输出：

```ts
interface RootObject {
  users: RootObjectUser[];
  count: number;
  tags: (string | number)[];
  meta: null;
}

interface RootObjectUser {
  id: number;
  name: string;
  active?: boolean;
}
```

---

## 六、边界、性能与健壮性

### 6.1 输入与解析
- **输入大小限制**：`INPUT_SIZE_LIMIT = 10 * 1024 * 1024`（10MB，与 format 分类一致），超限中文提示
- **JSON 解析失败**：捕获 `JSON.parse` 异常，给出中文提示；尽量解析 `SyntaxError.message` 中的行列位置，无法提取时给通用提示
- **输入为空**：清空输出，不报错

### 6.2 根类型名校验
必须匹配 `/^[A-Za-z_$][A-Za-z0-9_$]*$/`，否则 `jsonToTs` 返回 `ok: false`，组件内联中文报错、不执行转换。

### 6.3 非法键名
JSON 键不构成合法 TS 标识符时（含 `-`、空格、纯数字开头等），输出加引号写成字符串字面量键：

```json
{ "a-b": 1, "123": 2, "with space": 3, "valid": 4 }
```
→
```ts
interface RootObject {
  "a-b": number;
  "123": number;
  "with space": number;
  valid: number;
}
```

### 6.4 递归深度保护（核心）
递归推断在深嵌套 JSON 下会持续占用调用栈，需防止栈溢出，同时尽可能让用户拿到结果。采用**三层防线**：

1. **Worker 隔离**：推断逻辑整体跑在 Web Worker，即便最坏情况发生栈溢出，也只影响 Worker（主线程通过 `onerror` 捕获并提示），不卡死页面
2. **软阈值兜底**：设嵌套深度软阈值（默认 **100 层**）。超过阈值的子树**不报错、不中断整体输出**，而是兜底推断为 `unknown`，并在结果顶部追加警告注释 `// 警告：检测到超过 100 层的嵌套，深层结构已简化为 unknown`
3. **栈溢出兜底**：递归整体 `try-catch` 捕获 `RangeError`，命中时把当前子树标 `unknown` 继续输出（双保险）

选择「兜底 `unknown` + 警告」而非「直接报错」：绝大多数真实 JSON 嵌套 < 20 层，能拿到完整结果；仅在极端异常数据下降级，而非整份失败。类型名派生在超阈值子树处自然终止（不再继续拼接父链）。

### 6.5 性能策略
- **同步/Worker 分界**：沿用转换类工具的 `WORKER_THRESHOLD = 500KB`（与 json-to-yaml/xml 一致）。≤500KB 同步推断（百毫秒级，配合 500ms 防抖用户基本无感）；>500KB 走 Worker，显示 loading，不阻塞主线程
- **字符串构建**：输出文本用 `string[]` 累积、末尾 `join('\n')`，杜绝反复 `+=` 拼接造成的 O(n²) 退化
- **数组字段合并**：对象数组用 `Map<字段名, 类型集合>` 单次遍历增量合并，避免对每个元素重复扫描
- **大数组**：全量遍历以保证字段完整性（不采样丢信息）；极端大数组（如 10 万元素）在 Worker 内执行可接受，必要时顶部提示数据规模

错误信息一律中文、内联展示在对应输入框下方，遵循 `PRODUCT.md §Error Handling`。

---

## 七、SEO 与 FAQ

### 7.1 tools.ts 注册

- `id`: `json-to-ts`
- `name`: `JSON 转 TypeScript`
- `icon`: `🔷`
- `category`: `格式化`
- `path`: `/format/json-to-ts`
- `relatedToolIds`: `['json-formatter', 'json-to-yaml', 'json-to-xml']`
- `keywords`: `['json 转 typescript', 'json to interface', 'json 生成类型', 'json to ts', 'ts 类型生成', 'json 接口生成', 'json 转 ts']`
- `seoDescription`（120–160 字符）：在线 JSON 转 TypeScript 工具，粘贴 JSON 自动生成 TS interface 定义，智能合并数组字段并标注可选类型，输出可通过 tsc strict 检查，纯浏览器端运算。

### 7.2 tool-faqs.ts（3 条）

1. **Q：可选字段（带 `?`）是怎么来的？**
   A：当数组里的对象**只有部分**包含某字段时，工具会把它标记为可选。例如数组中一个对象有 `name`、另一个没有，合并后输出 `name?: string`，表示「该字段可能不存在」，让类型更宽松以兼容字段缺失的真实数据。

2. **Q：为什么生成的类型里有 `null`？**
   A：JSON 的 `null` 在 TypeScript 中对应 `null` 类型（与 `undefined` 不同）。若某字段在数组中**有时是值、有时是 null**，工具会合并为 `类型 | null`（如 `string | null`），比一律当成 string 更贴近真实数据。

3. **Q：为什么有些字段名带引号？**
   A：TypeScript 要求对象字段名是合法标识符（字母 / 下划线 / `$` 开头，不含空格和 `-`）。当 JSON 的键不满足时（如 `"a-b"`、`"with space"`、`"123"`），必须加引号写成字符串字面量键才能通过类型检查，工具会自动处理。

FAQ 由 ToolLayout 自动渲染为 `<details>` 折叠块并生成 FAQ 结构化数据。

---

## 八、测试计划

测试文件：`src/utils/format/__tests__/json-to-ts.test.ts`，覆盖：

1. 基本类型对象（string / number / boolean / null）
2. 嵌套对象与类型名派生
3. 对象数组字段并集 + 可选字段标注
4. 同字段多类型并集（`string | number`）
5. 非对象数组（混合基本类型 → `(A | B)[]`）
6. 空数组 → `unknown[]`
7. 非法键名自动加引号
8. 顶层为数组（对象元素 / 基本类型元素）
9. 顶层为基本类型
10. 类型名冲突时的数字后缀去重
11. 根类型名非法时返回 `ok: false`
12. 递归深度超软阈值时子树兜底为 `unknown`、整体不中断且附顶部警告

输出文本做快照式断言（针对代表性输入断言完整输出字符串）。

---

## 九、范围外（Exclusions）

以下在本工具**不实现**，如后续需要再单独评估：

- 输出风格在 `interface` / `type` 间切换（本工具固定输出 `interface`）
- 生成 `enum`、字面量联合、`readonly` 修饰
- 从 URL / 文件导入 JSON（仅支持粘贴文本）
- 元组（`[number, string]`）推断，统一按数组并集处理
- 类型去重 / 同构对象复用（同结构对象在不同位置生成独立 interface，不做结构合并复用）
- 反向 TS → JSON Schema
