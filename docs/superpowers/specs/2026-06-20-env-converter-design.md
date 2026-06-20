# 设计文档：环境变量转换器

- **路由**：`/devops/env-converter`
- **工具 id**：`env-converter`（严格等于 path 末段）
- **分类**：DevOps 工具
- **预估工时**：1.5 人天（对齐 ROADMAP P3）
- **状态**：设计中

## 1. 概述

`.env` 文本与 JSON 双向转换工具。采用**逐行扫描 + 引号感知状态机**自研解析（不引入 dotenv 等第三方库），处理引号、转义、同文件变量插值；`.env → JSON` 时注释丢弃并提示数量。交互复用 `DockerConverter` 的左右双向双框范式，契合产品「即开即用、客户端运算、数据不上传」定位。

## 2. 功能范围

### 2.1 包含

| 维度 | 说明 |
|------|------|
| 互转方向 | `.env ⇄ JSON` 双向，两侧均可编辑、实时转换（`watch` 双向触发，`convertingFrom` 防 watch 循环） |
| 引号 | 双引号：支持转义与插值；单引号：全字面量（不转义、不插值）；无引号：不转义反斜杠、支持插值、`trim` 尾部空白 |
| 转义（仅双引号内） | `\n` `\t` `\r` `\\` `\"` `\$` 解释为对应字符；其余 `\x` 保留原样（连反斜杠）。无引号值**不转义**（反斜杠字面保留，避免误伤 `C:\path\to` 这类 Windows 路径） |
| 插值 | `${VAR}` / `$VAR` 引用**同文件上方**已解析的变量；未定义保留原样（不报错）；单引号内不插值 |
| 注释 | `#` 在行首或前导空白后为整行注释，丢弃并计数；**不支持行内 `#`**（无引号值中的 `#` 视为值的一部分，dotenv 默认行为） |
| `export` 前缀 | 支持 `export KEY=v`，剥离 `export ` 前缀 |
| key 校验 | `[A-Za-z_][A-Za-z0-9_]*`，不合法报错并定位行号 |
| 重复 key | 后者覆盖前者，计数并在状态栏提示 |
| key 顺序 | 解析保留 `.env` 定义顺序；JSON 输出与 `.env` 序列化均按此顺序（`Object` 插入顺序 + `JSON.stringify` 保留） |
| JSON 格式 | 美化（2 空格，默认）/ 紧凑 切换 |

### 2.2 排除项（有意不做，避免扩范围）

- **其他格式**：YAML（docker-compose env 风格）、shell `export` 批量导出
- **进阶插值**：`${VAR:-default}` / `${VAR-default}` / `${VAR:?err}` 等 shell 风格
- **JSONC 注释保留**：标准 JSON 不支持注释，注释一律丢弃
- **双下划线伪嵌套展平**：`FOO__BAR` 视为普通字符串 key 原样保留，不展开为 `{foo:{bar}}`（.env 格式本身是扁平 KV，不原生支持嵌套；消费端的 `__` 约定各库不一，展开会引入歧义）
- **嵌套对象/数组**：`.env` 仅支持扁平键值对，JSON 端出现对象/数组值时直接报错

## 3. 页面布局

采用 `ResponsiveWorkspace mode="horizontal"`（`lg` 断点双栏，移动端单列），结构与 `DockerConverter.vue` 同构。

```
┌─ ToolHeader：环境变量转换 · .env 与 JSON 互转 ──────────────┐
│                                                              │
│                       [ ⇄ 交换 ]    ← #actions               │
│  ┌──────────────────────┐  ┌──────────────────────┐         │
│  │ .env        [清空][复制]│ │ JSON  [美化▾][清空][复制]│  ← 双向可编辑│
│  │ KEY=value            │  │ {                     │         │
│  │ ...                  │  │   "KEY": "value"      │         │
│  └──────────────────────┘  └──────────────────────┘         │
│  状态栏：已丢弃 2 条注释 · 覆盖 1 个重复键  /  错误：第 3 行… │
└──────────────────────────────────────────────────────────────┘
```

- **交换按钮**：互换两侧内容，`isSwapping` 标志跳过 watch 触发（与 Docker 一致）。
- **清空**：清空两侧输入与状态。
- **复制**：复用 `useCopy`，复制对应侧文本，`CustomEvent('toast')` 反馈。
- **JSON 格式切换**：右侧 `CodePanel` 标题区「美化 / 紧凑」下拉，仅影响 `.env → JSON` 输出序列化。
- **状态栏**：`.env → JSON` 时显示「已丢弃 N 条注释 · 覆盖 M 个重复键」；任意方向解析失败显示中文错误（带行号）。

### 3.1 默认输入示例

```env
# 应用配置
APP_NAME=MyApp
DB_USER=admin
DATABASE_URL="postgres://user:${DB_USER}@host"
export PORT=3000
GREETING="Hello\nWorld"
EMPTY=""
```

→（美化输出，状态栏：已丢弃 1 条注释）

```json
{
  "APP_NAME": "MyApp",
  "DB_USER": "admin",
  "DATABASE_URL": "postgres://user:admin@host",
  "PORT": "3000",
  "GREETING": "Hello\nWorld",
  "EMPTY": ""
}
```

> 插值顺序敏感：`${DB_USER}` 仅引用**上方**已定义的变量。若把 `DB_USER` 移到 `DATABASE_URL` 下方，则 `${DB_USER}` 不命中、原样保留。

## 4. 技术实现

### 4.1 模块拆分（小而专注，便于单测）

```
src/utils/devops/env-converter.ts              # 纯函数：解析、插值、序列化
src/utils/devops/__tests__/env-converter.test.ts
src/tools/devops/EnvConverter.vue              # UI 组件：双向双框 + watch 同步 + 状态栏
src/pages/devops/env-converter.astro           # 页面（复用 ToolLayout，client:idle 水合）
```

### 4.2 `env-converter.ts` 核心 API

```ts
/** 单个键值对（保留解析顺序） */
export interface EnvEntry { key: string; value: string }

/** 解析诊断信息（用于状态栏提示） */
export interface EnvDiagnostics {
  droppedComments: number;   // 丢弃的注释行数
  overwrittenKeys: number;   // 被覆盖的重复 key 数
}

/** Result 模式：成功带 result + diagnostics，失败带中文 error（含行号） */
export interface EnvOk<T>     { ok: true;  result: T; diagnostics?: EnvDiagnostics }
export interface EnvErr       { ok: false; error: string }
export type EnvResult<T>      = EnvOk<T> | EnvErr

/** .env 文本 → 有序 entries（含插值、转义、注释剥离）。diagnostics 附带统计 */
export function parseEnv(text: string): EnvResult<EnvEntry[]>

/** .env 文本 → 美化/紧凑 JSON 字符串。indent=2 美化（默认），0 紧凑 */
export function envTextToJson(text: string, indent?: number): EnvResult<string>

/** JSON 文本 → .env 文本（含引号策略与转义）。非扁平结构返回 error */
export function jsonToEnvText(jsonText: string): EnvResult<string>
```

### 4.3 解析器实现要点（逐行状态机，非正则）

.env 的引号/转义/插值规则用单个正则无法可靠覆盖，采用**逐行扫描**：

1. 按行拆分；空行跳过；`#`（行首或仅前导空白后）整行注释 → 计入 `droppedComments` 并跳过。
2. 剥离可选 `export ` 前缀与首尾空白。
3. 在首个**未被引号包裹的** `=` 处切分为 key / valueRaw；缺失 `=` 报错（带行号）。
4. 校验 key 是否匹配 `[A-Za-z_][A-Za-z0-9_]*`，否则报错（带行号）。
5. valueRaw 逐字符扫描：
   - **单引号包裹**：到下一个单引号为值，内部全字面量（不转义、不插值）。
   - **双引号包裹**：到下一个未转义的 `"` 为值，处理 `\n \t \r \\ \" \$` 转义，处理 `${VAR}` / `$VAR` 插值。
   - **无引号**：`trim` 尾部空白，处理 `${VAR}` / `$VAR` 插值，**不转义反斜杠**（字面保留）。
6. 插值查询：维护「已解析 entries 的 Map」，命中替换为已解析值，未命中保留原样字符串 `${VAR}`。
7. 重复 key：覆盖 Map 中的值，计入 `overwrittenKeys`；最终 entries 列表保留首次出现的位置、更新为新值。

**插值防循环**：因限定「仅引用上方已定义」，定义顺序天然保证单向引用，无需循环检测。`A=${B}` 写在 `B` 之前 → 解析 `A` 时 `B` 未命中 → 保留 `${B}` 字面，后续定义 `B` 不回改 `A`。

### 4.4 插值匹配规则（双引号内）

遇到 `$`：

| `$` 的上下文 | 处理 |
|--------------|------|
| 前置为未转义反斜杠（即 `\$`） | 字面 `$`，跳过插值 |
| 后跟 `{NAME}` | 替换为已解析的 `NAME` 值；未命中保留 `${NAME}` |
| 后跟合法变量名 `[A-Za-z_]\w*` | 替换为已解析值；未命中保留 `$NAME` |
| 其他（后跟 `$`、空格、引号等） | 字面 `$` |

- **无引号值**：采用相同匹配规则，但不识别 `\$` 转义（反斜杠字面保留，`$` 直接进入匹配）。如需字面 `$`，用双引号 `"\$VAR"` 或单引号 `'$VAR'`。
- **单引号值**：所有 `$` 与 `\` 均为字面量。

### 4.5 JSON → .env 引号策略

| 值特征 | 输出 |
|--------|------|
| 不含空格、`#`、`"`、`'`、`$`、首尾空白 | 不加引号：`KEY=value` |
| 含上述任一字符，或为空字符串 | 加双引号，并转义内部 `"` `\` `$`：`KEY="hello world"`、`EMPTY=""`、`KEY="price: \$5"` |
| 非 string 值（number / boolean / null） | `String(value)` 后按字符串规则处理（如 `PORT=3000`、`DEBUG=true`、`FLAG=null`） |
| 对象 / 数组值 | 报错：`键「{key}」的值为{对象|数组}，.env 仅支持扁平键值对` |
| key 顺序 | 按 `JSON.parse` 后对象的 key 顺序输出 |

> `__` 写法（如 `DATABASE__HOST`）按普通字符串 key 原样输出，不展开。

## 5. 错误处理与性能

遵循 `PRODUCT.md` §Error Handling，中文提示 + 定位行号：

| 场景 | 提示 |
|------|------|
| `.env`：key 不合法 | `第 {n} 行：变量名「{key}」不合法，须以字母或下划线开头，仅含字母、数字、下划线` |
| `.env`：缺少 `=` | `第 {n} 行：缺少等号「=」，应为 KEY=value` |
| `.env`：引号未闭合 | `第 {n} 行：{双\|单}引号未闭合` |
| `JSON → .env`：JSON 语法错误 | 截取并透传 `JSON.parse` 的位置信息，包装为中文友好提示 |
| `JSON → .env`：含嵌套/数组 | `键「{key}」的值为{对象|数组}，.env 仅支持扁平键值对` |
| 输入超长（>500KB） | `输入过长，已停止解析` |

插值未定义变量**不报错**（保留原样），符合 dotenv 主流预期。

性能：

- 文本规模典型 <100 行，主线程解析即可，**不引入 Web Worker**（YAGNI）。
- `watch` 内转换同步执行，无需 debounce（与 Docker 一致；解析成本远低于 docker run 解析）。
- 输入软上限 500KB，超限短路返回超长错误。

## 6. 注册与 SEO

### 6.1 `src/data/tools.ts`

```ts
{
  id: 'env-converter',
  name: '环境变量转换器',
  description: '.env 配置与 JSON 双向互转，支持引号、转义与同文件变量插值',
  seoDescription: '在线 .env 与 JSON 互转工具，支持单双引号、转义字符与同文件变量插值，注释自动剥离并提示数量，纯浏览器端解析数据不上传，前后端环境变量配置转换必备。',
  category: 'DevOps 工具',
  icon: '⚙️',
  path: '/devops/env-converter',
  keywords: ['env 转 json', 'json 转 env', '环境变量转换', 'dotenv 解析', 'env 在线转换', '.env 配置转换', '环境变量 json 互转', 'env to json'],
  relatedToolIds: ['docker-converter', 'json-formatter'],
}
```

### 6.2 `src/data/tool-faqs.ts`（4 条）

1. **`.env` 里的注释会保留到 JSON 吗？** —— 不会。标准 JSON 不支持注释，转换时 `#` 注释会被丢弃，状态栏会显示「已丢弃 N 条注释」提示数量，避免静默丢失。
2. **支持变量插值吗？** —— 支持 `${VAR}` / `$VAR` 引用**同一文件中上方**已定义的变量；未定义的保留原样不报错。不支持 `${VAR:-default}` 等 shell 进阶语法。
3. **JSON 里有嵌套对象怎么办？** —— `.env` 格式仅支持扁平键值对，遇到对象或数组值会报错提示。如 `DATABASE__HOST` 这类双下划线写法会被当作普通 key 原样保留，不自动展开为嵌套结构。
4. **生成的 `.env` 值什么时候会加引号？** —— 当值包含空格、`#`、`"`、`'`、`$` 或为空字符串时自动加双引号，并转义内部的 `"` `\` `$`；其余情况输出不加引号的简洁形式。

## 7. 测试计划（TDD）

`env-converter.test.ts` 覆盖纯函数：

- **引号**：双引号转义生效、单引号全字面量、无引号 `trim` 尾部空白
- **转义（双引号内）**：`\n` `\t` `\r` `\\` `\"` `\$` 正确解释；非法转义（如 `\q`）保留原样；**无引号值不转义**（`KEY=C:\path` 反斜杠字面保留，不被误判为转义）
- **插值**：`${VAR}` / `$VAR` 引用上方变量命中替换；未定义保留原样；单引号内不插值；`\$` 为字面 `$`；`A=${B}` 在 `B` 之前定义时 `A` 保留 `${B}`（不回改）
- **注释**：行首 / 前导空白注释丢弃并计入 `droppedComments`；行内 `#` 视为值的一部分
- **`export` 前缀**剥离；**空行**跳过；**重复 key** 覆盖并计入 `overwrittenKeys`
- **错误**：非法 key、缺 `=`、引号未闭合 —— 均返回 `ok:false` + 中文错误 + 行号
- **`envTextToJson`**：顺序保留、indent=2 美化、indent=0 紧凑
- **`jsonToEnvText`**：引号策略（空格 / `#` / `$` / 空值触发引号）、内部转义、key 顺序保留、嵌套对象/数组报错、非字符串值 `String()` 化
- **双向往返**：`jsonToEnvText` 再 `parseEnv` 对支持子集保持一致

组件层（`EnvConverter.vue`）以手动验证为主（双向编辑、交换、格式切换、状态栏提示、错误内联显示）。

## 8. 验收清单

- [ ] `env-converter.ts` 纯函数 + 单测通过
- [ ] 页面 `/devops/env-converter` 可访问，复用 `Layout` / `ToolLayout`，`client:idle` 水合
- [ ] 左右双向双框均可编辑，实时互转，无 watch 循环
- [ ] 交换 / 清空 / 复制按钮 + Toast 反馈
- [ ] JSON 美化 / 紧凑格式切换生效
- [ ] 引号 / 转义 / 同文件插值 / 注释剥离 / `export` 前缀 / 重复 key 覆盖均符合规则
- [ ] 错误场景（非法 key / 缺 `=` / 引号未闭合 / JSON 嵌套 / JSON 语法错误）内联中文提示 + 行号
- [ ] 状态栏提示注释丢弃数与重复键覆盖数
- [ ] `tools.ts` 注册完整（id === path 末段）+ 4 条 FAQ
- [ ] `ROADMAP.md` P3「DevOps 工具：环境变量转换器」勾选，头部日期更新
- [ ] 单工具 JS（gzip）< 50KB（纯自研解析零依赖，应远低于预算）
