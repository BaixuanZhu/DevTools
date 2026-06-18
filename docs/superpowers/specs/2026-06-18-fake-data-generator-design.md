# 假数据生成器设计文档

> 工具 ID：`fake-data-generator`  
> 路由：`/text/fake-data-generator`  
> 分类：文本处理  
> 设计日期：2026-06-18

## 一、目标

为开发者提供一个**结构化假数据**生成工具：按需配置字段（姓名、邮箱、手机号、地址、Lorem 占位文、UUID 等），一键批量生成若干条记录，输出为 JSON 数组或 CSV，用于测试数据填充、数据库灌库、API mock、表单演示等场景。所有生成在浏览器本地完成，数据绝不上传。

与现有工具的边界（不重叠）：

- `random-string` = 无语义的随机字符 / 密码
- `uuid-generator` = UUID 的深度工具（多版本生成、格式转换、解码解析）
- 本工具 = **有语义、结构化的整条记录**；UUID、随机串只是其中一种「字段类型」，定位为「把某种值当字段批量填入记录」

## 二、需求确认

| 需求项 | 决策 |
|--------|------|
| 生成方式 | 方案 A：字段配置 + 批量记录（勾选/添加字段 → 设条数 → 输出表格化结果） |
| 字段范围 | 标准开发集，15 类（见第五节） |
| 输出格式 | JSON 数组 + CSV（结果区一键切换，不影响字段配置） |
| 语种搭配 | 中文为主：姓名默认中文，可切英文；Lorem 用英文经典占位文 |
| 随机种子 | 不支持（纯随机，全程 `crypto.getRandomValues`），不做可复现 |
| 字段配置 UI | 动态字段行（列名 + 类型 + 条件参数 + 删除）+ 顶部快速模板按钮 |
| 条数上限 | 1–500（参考 uuid-generator / random-string 的 500 上限） |
| 宽度 | 标准 `max-w-[720px]`（单列） |
| 水合 | `client:idle` |

## 三、文件结构

```
src/
├── pages/text/fake-data-generator.astro            # 页面壳（toolId + client:idle）
├── tools/text/FakeDataGenerator.vue               # 交互组件
├── utils/text/fake-data.ts                        # 纯函数（字段生成器 + 记录组装 + 序列化 + 类型定义）
└── utils/text/__tests__/fake-data.test.ts         # 单元测试
src/data/tools.ts                                  # 注册工具
src/data/tool-faqs.ts                              # 4 条 FAQ
```

## 四、交互设计（字段配置 + 批量记录）

```
┌──────────────────────────────────────────────────────────┐
│ 假数据生成器                                                │
│ 按字段配置批量生成姓名/邮箱/手机号/UUID/Lorem 等结构化假数据     │
├──────────────────────────────────────────────────────────┤
│ 快速模板：[用户表] [文章] [订单] [商品]                       │
├──────────────────────────────────────────────────────────┤
│ 字段配置                              [ + 添加字段 ]        │
│ ┌────────────────────────────────────────────────────┐   │
│ │ 列名      类型▼          参数                [删]   │   │
│ │ id        自增ID          起始值=1            [×]   │   │
│ │ name      姓名(中文)▼     语种[中|英]         [×]   │   │
│ │ email     邮箱            域名=@example.com   [×]   │   │
│ │ age       整数            最小18 最大60       [×]   │   │
│ └────────────────────────────────────────────────────┘   │
│ 条数 [ 10 ]   [ 生成 ]   [ 清空 ]                          │
├──────────────────────────────────────────────────────────┤
│ 结果   格式：◯ JSON  ◯ CSV                  [ 复制结果 ]  │
│ ┌────────────────────────────────────────────────────┐   │
│ │ [                                                  │   │
│ │   { "id": 1, "name": "张伟", "email": "...", ...}, │   │
│ │   ...                                              │   │
│ │ ]                                                  │   │
│ └────────────────────────────────────────────────────┘   │
│ 10 条记录                                                 │
└──────────────────────────────────────────────────────────┘
```

### 4.1 快速模板

顶部 4 个按钮，点击后**整体替换**当前字段配置（覆盖前不弹确认，与「生成」分离，便于反复试）：

| 模板 | 字段组合 |
|------|---------|
| 用户表 | id(自增,起始1)、name(姓名,中文)、email(邮箱)、phone(手机号) |
| 文章 | id(自增,起始1)、title(Lorem 句,1 句)、author(姓名,中文)、content(Lorem 段,1 段)、date(日期,近 3 年) |
| 订单 | id(自增,起始1)、user(姓名,中文)、amount(小数,0–9999.99,2 位)、created_at(时间戳,近 1 年)、paid(布尔) |
| 商品 | id(自增,起始1)、name(Lorem 词,2 词)、price(小数,0–9999.99,2 位)、stock(整数,0–9999)、url(URL) |

### 4.2 字段配置区

- 一组动态行，每行 = `[列名 input] [类型 select] [条件参数] [删除 ×]`。
- 默认预填 3 行：`id / name / email`（打开即可生成体验）。
- 底部 `[ + 添加字段 ]` 追加一行（默认类型「姓名」、列名 `fieldN`）。
- 「条件参数」按类型显示（见 4.3），无参数类型该位置留空。

### 4.3 各类型参数控件

| 类型 | 参数控件 |
|------|---------|
| 自增ID | 数字输入「起始值」（默认 1） |
| 姓名 | 单选「中 / 英」（默认中） |
| 邮箱 | 文本输入「域名」（默认 `@example.com`） |
| 密码 | 数字输入「长度」（默认 12，1–128） |
| Lorem 词/句/段 | 数字输入「数量」（词默认 3、句默认 1、段默认 1） |
| 日期 / 时间戳 | 数字输入「近 N 年」（默认 10） |
| 整数 | 两个数字输入「最小/最大」（默认 0/100） |
| 小数 | 三个数字输入「最小/最大/小数位」（默认 0/100/2） |
| UUID / 用户名 / 手机号 / 布尔 / IPv4 / URL | 无参数 |

### 4.4 生成控制

- 「条数」数字输入（1–500，失焦 `clampCount` 钳制）。
- `[ 生成 ]`：校验字段配置后生成记录并渲染到结果区。
- `[ 清空 ]`：清空结果区（保留字段配置，便于调参重生成）。

### 4.5 结果区

- 格式切换：`JSON` / `CSV` 两个 Radio，切换即时重渲染（不重新生成随机数据，复用已生成记录）。
- 只读 `<textarea>`，等宽字体，展示序列化文本。
- 行数统计：`N 条记录`。
- `[ 复制结果 ]`：复制当前格式文本，成功走 Toast。
- 列名直接用作 JSON 的 key / CSV 的表头。

## 五、字段类型系统（15 类）

| 类型 key | 默认列名 | 参数 | 生成规则 |
|---------|---------|------|---------|
| `auto-id` | id | 起始值 | 行内从起始值递增的整数 |
| `uuid` | uuid | — | v4 UUID（`crypto.randomUUID()`） |
| `name` | name | 语种(中/英) | 中文：百家姓 + 随机名用字（1–2 字）；英文：first + last |
| `username` | username | — | 6–12 位小写字母 + 可选数字后缀 |
| `email` | email | 域名 | `用户名 + 域名`，用户名基于随机小写串 |
| `phone` | phone | — | `1` + 合法号段(3,4,5,7,8,9) + 9 位数字，共 11 位 |
| `password` | password | 长度 | 大小写字母 + 数字 + 符号，保证四类至少含三类（复用 `generateRandomString` 字符池） |
| `lorem-word` | text | 个数 | Lorem 经典词库随机取 N 个，空格连接 |
| `lorem-sentence` | title | 句数 | 每句 4–12 词，首字母大写、句末加句点，N 句连接 |
| `lorem-paragraph` | content | 段数 | 每段 3–6 句，N 段以换行连接 |
| `date` | date | 近 N 年 | `[今天-N年, 今天]` 区间内随机日期，格式 `YYYY-MM-DD` |
| `timestamp` | timestamp | 近 N 年 | 同区间内随机 Unix 时间戳（**秒**） |
| `integer` | value | min/max | 闭区间 `[min, max]` 随机整数 |
| `decimal` | value | min/max/小数位 | 闭区间随机小数，四舍五入到指定小数位 |
| `boolean` | active | — | `true` / `false` |
| `ip` | ip | — | IPv4：4 段 0–255 |
| `url` | url | — | `https://www.<随机域名>.com/<随机路径>` |

> Lorem 三变体（词/句/段）归为 1 类「Lorem」，故共 15 类。

## 六、核心算法（src/utils/text/fake-data.ts）

### 6.1 类型与配置

```ts
/** 字段类型 key */
export type FieldType =
  | 'auto-id' | 'uuid' | 'name' | 'username' | 'email' | 'phone' | 'password'
  | 'lorem-word' | 'lorem-sentence' | 'lorem-paragraph'
  | 'date' | 'timestamp' | 'integer' | 'decimal' | 'boolean' | 'ip' | 'url';

/** 单个字段配置（字段配置区一行） */
export interface FieldConfig {
  /** 行内唯一标识（Vue 列表 key，非列名） */
  rowId: string;
  /** 列名（JSON key / CSV 表头） */
  name: string;
  /** 字段类型 */
  type: FieldType;
  /** 类型参数（结构随 type 变化，宽松存储） */
  params: Record<string, string | number>;
}
```

### 6.2 随机源（统一基于 `crypto.getRandomValues`）

```ts
randomInt(min, max): number   // 闭区间随机整数
pick<T>(arr: T[]): T          // 随机取一个元素
shuffle<T>(arr: T[]): T[]     // Fisher-Yates 洗牌（基于 randomInt）
```

`password` / `username` 的底层随机串复用现有 `generateRandomString(length, charset)`。

### 6.3 内置词库（模块内常量，纯静态数据）

- 中文姓氏：百家姓中常见约 100 个
- 中文名用字：常用名用字约 100 个
- 英文 first name / last name：各约 100 个
- Lorem ipsum 经典词库：约 50 个词
- 手机号合法号段表：`[3,4,5,7,8,9]`（第二位）

> 词库为静态常量，可在同文件顶部声明；若 `fake-data.ts` 体积过大，再拆出 `fake-data-dict.ts`。

### 6.4 字段生成器

每个类型一个纯函数 `(params) => string`：

- `genAutoId(params, ctx) => string`：`ctx.rowIndex` 内行号（生成 N 条时传入当前行索引）
- `genUuid()` / `genName({locale})` / `genUsername()` / `genEmail({domain})` / `genPhone()` / `genPassword({length})`
- `genLoremWord({count})` / `genLoremSentence({count})` / `genLoremParagraph({count})`
- `genDate({years})` / `genTimestamp({years})`（基于 `Date.now()` 取区间，注意：`Date.now()` 在主线程组件内可用，纯函数接收一个 `now` 入参以保证可测）
- `genInteger({min,max})` / `genDecimal({min,max,precision})` / `genBoolean()` / `genIp()` / `genUrl()`

所有生成器无副作用、无 I/O，便于独立单测。

### 6.5 记录组装与序列化

```ts
/** 按 fields 配置生成 count 条记录 */
generateRecords(fields: FieldConfig[], count: number, now: number): Record<string, unknown>[]

/** 序列化为 JSON 数组字符串（2 空格缩进） */
toJson(records: Record<string, unknown>[], fields: FieldConfig[]): string

/** 序列化为 CSV 字符串（首行列名 + RFC4180 转义） */
toCsv(records: Record<string, unknown>[], fields: FieldConfig[]): string
```

- `generateRecords`：遍历 `count` 行，每行按 `fields` 顺序调用对应生成器，组装成 `{列名: 值}`；列名以用户填写的 `name` 为准。
- `toJson`：`JSON.stringify(records, null, 2)`。
- `toCsv`：首行列名行 + 每行值；遵循 RFC4180——值含逗号、双引号或换行时，用 `"..."` 包裹并把内部 `"` 转义为 `""`；行尾使用 `\r\n`。

## 七、错误处理

| 场景 | 处理方式 |
|------|----------|
| 字段配置为空（0 行） | 禁用「生成」按钮；点击时 Toast「请至少添加一个字段」 |
| 列名为空 | 生成前校验，Toast「第 N 行的列名不能为空」 |
| 列名重复 | 生成前校验，Toast「列名「xxx」重复，请修改」 |
| 列名非法字符 | 允许字母、数字、下划线、中文，首字符非数字；非法时 Toast「列名只能包含字母、数字、下划线或中文」 |
| 整数/小数 min > max | 自动交换 min/max 后再生成（静默） |
| 条数 > 500 / < 1 | `clampCount` 钳制到 1–500 并 Toast「条数已限制为 1–500」 |
| 复制失败 | Toast「复制失败，请重试」 |

## 八、SEO 与 FAQ

### 8.1 tools.ts 注册字段

- `id`: `fake-data-generator`
- `name`: `假数据生成器`
- `description`: `按字段配置批量生成姓名、邮箱、手机号、UUID、Lorem 占位文等结构化假数据，输出 JSON 或 CSV`
- `seoDescription`（约 140 字）: `在线假数据生成器，可自定义字段类型与列名，批量生成中文英文姓名、邮箱、手机号、UUID、Lorem 占位文、日期、IP 等 15 类结构化测试数据，一键导出 JSON 或 CSV，纯浏览器端生成数据绝不上传，前后端测试与数据库灌库必备。`
- `keywords`: `假数据生成`, `测试数据生成`, `mock 数据`, `随机姓名生成`, `随机邮箱`, `faker`, `生成 JSON 测试数据`, `生成 CSV 测试数据`, `Lorem ipsum`, `造数据`
- `relatedToolIds`: `random-string`, `uuid-generator`, `text-toolbox`

### 8.2 FAQ 计划（4 条）

1. 生成的姓名 / 手机号是真实存在的吗？（否，由内置词库与号段随机组合，不对应任何真人或真实号码，仅供测试占位）
2. 和「随机字符串生成」「UUID 生成器」有什么区别？（那两个生成无语义随机串或单一 UUID；本工具生成一整条结构化记录，UUID / 随机串只是其中一种字段类型）
3. 数据会上传到服务器吗？（否，全部在浏览器本地生成）
4. 能不能生成中文姓名、自定义列名？（姓名默认中文可切英文；列名可在字段配置区自由编辑，直接作为 JSON 的 key 和 CSV 表头）

## 九、单元测试覆盖（src/utils/text/__tests__/fake-data.test.ts）

- 随机源：`randomInt` 闭区间边界与分布、`pick` 非空、`shuffle` 元素守恒
- 各生成器输出格式：
  - UUID 匹配 v4 正则
  - 姓名：中文含中文姓氏字、英文含空格分隔的两段
  - 邮箱含 `@` 与域名、用户名全小写
  - 手机号 11 位、首位 1、第二位属合法号段
  - 密码长度正确、满足字符类别约束
  - Lorem 词/句/段：词数/句数/段数与参数一致、句末有句点
  - 日期格式 `YYYY-MM-DD` 且落在区间内、时间戳为正整数秒
  - 整数落在 `[min,max]`、小数小数位正确
  - IPv4 四段 0–255、URL 以 `https://` 开头
- `generateRecords`：条数正确、字段顺序与列名一致、`auto-id` 行内递增
- `toJson`：结果可被 `JSON.parse` 回环、key 为列名
- `toCsv`：首行表头、含逗号/双引号/换行的值正确转义（RFC4180）、行尾 `\r\n`
- 边界：条数 clamp、空字段、列名重复检测、min>max 自动交换

## 十、性能与安全

- 全部为轻量随机与字符串拼接，500 条 × N 字段在毫秒级完成，**无需 Web Worker**。
- 单工具 JS 体积预计 < 50KB（无第三方库，词库为静态常量），符合性能基线。
- 安全：禁用 `eval` / `Function`；CSV 输出做 RFC4180 转义防止注入与错列；JSON 用原生 `JSON.stringify`（安全）。
- 随机源统一使用 `crypto.getRandomValues`（密码学安全随机），不引入可预测的 `Math.random`。

## 十一、明确排除项（YAGNI）

以下需求经评估**不纳入**本次实现，避免范围蔓延：

- **随机种子 / 可复现**：99% 造数场景不需可复现；支持需统一可种子 PRNG，成本不匹配收益。
- **SQL INSERT / Markdown 表格输出**：JSON + CSV 已覆盖主流灌库与表格场景。
- **嵌套对象 / 关联外键**：本工具生成扁平记录，不做表间关联。
- **地址 / 公司名 / 城市等位置类字段**：需较大词库且偏业务画像，超出「标准开发集」范围。
- **中文 Lorem 假文**：本次 Lorem 仅英文经典版。
