# TOML 工具集设计

> 创建日期：2026-06-25
> 分类：格式化（`/format/`）
> 状态：待实现

## 1. 背景与目标

TOML 是 Rust（`Cargo.toml`）、Python（`pyproject.toml`）、Hugo 等生态的主流配置格式。开发者在配置迁移、调试查看、跨格式对照时，频繁需要 TOML 与 JSON/YAML 互转，以及 TOML 自身的语法校验与美化。当前「格式化」分类仅有以 JSON 为源的单向转换工具（`json-to-yaml`、`json-to-xml`、`json-to-ts`），缺少对 TOML 的支持。

本设计新增 3 个独立的 TOML 工具补齐这一缺口。目标用户为全栈开发者，遵循项目「即开即用、客户端运算、独立工具单一职责」的产品原则。

## 2. 工具清单

三个工具均归入「格式化」分类，URL 前缀 `/format/`。

| 显示名 | id（= slug） | 路径 | 形态 | 参考实现 |
|---|---|---|---|---|
| TOML 与 JSON 互转 | `toml-json-converter` | `/format/toml-json-converter` | 左右双栏双向实时同步 | `EnvConverter.vue` |
| TOML 与 YAML 互转 | `toml-yaml-converter` | `/format/toml-yaml-converter` | 左右双栏双向实时同步 | `EnvConverter.vue` |
| TOML 格式化器 | `toml-formatter` | `/format/toml-formatter` | 输入即校验 + 美化输出 | `JsonFormatter.vue` |

命名约定：

- 双向工具沿用既有 `-converter` 后缀（`env-converter`、`docker-converter`），与单向 `json-to-*` 区分
- slug 中 toml 置前，体现「以 TOML 为视角」
- id 与路径末段严格一致（工具注册表与 FAQ / 相关工具 / SEO 结构化数据依赖此一致性）

## 3. 交互模式

### 3.1 互转工具（toml-json-converter、toml-yaml-converter）

采用 `EnvConverter.vue` 式**双向实时同步**（用户已确认）：

- 布局：`ResponsiveWorkspace` horizontal，左右两个 textarea 均可编辑
- 同步：任一边编辑，另一边实时转换（`watch` + 500ms 防抖）；最后编辑的一边作为源
- 顶部 `#actions` slot 放格式选项（TOML 非缩进敏感格式，故选项聚焦另一侧与键序）：
  - TOML 键序（保持原序 / 字母序）—— 两个互转工具共有，以 `smol-toml` 序列化选项实际支持为准
  - JSON 格式（美化 / 紧凑）—— 仅 `toml-json-converter`
  - YAML 缩进（2 / 4）—— 仅 `toml-yaml-converter`
- 防 watch 循环：`convertingFrom` 标志 + `nextTick` 重置（照搬 `EnvConverter.vue` 已验证写法，规避 watch 回写循环）
- 大文件（>500KB）走 Web Worker，避免阻塞主线程
- 错误信息居中显示在工作区下方，伴随诊断提示（如「已丢弃 N 条无法转换的项」）

### 3.2 TOML 格式化器（toml-formatter）

采用 `JsonFormatter.vue` 式：

- 上方输入 textarea，下方美化输出
- 输入即校验 + 实时美化（统一缩进、保持键顺序）
- 语法错误在输入框下方内联提示（带行号）
- 格式选项：键序（保持原序 / 字母序）；TOML 非缩进敏感，美化以 `smol-toml` 默认序列化为准，具体支持的选项在实现时按其 API 确认

## 4. 库选型

| 用途 | 库 | 状态 | 说明 |
|---|---|---|---|
| TOML 解析 / 序列化 | `smol-toml` | 新增依赖 | TOML v1.1.0 规范、原生 TS 类型、ESM 小体积（gzip ≈ 10–15KB）、主动维护、npm 下载量第一、比 `@iarna/toml` 快约 2× |
| YAML 解析 / 序列化 | `js-yaml` | 已有，复用 | `parse` / `dump` |
| JSON 解析 | 原生 `JSON` + `parseJsonSafe` | 已有，复用 | — |

排除 `@iarna/toml`：仅支持旧规范 TOML 0.5.0、已停止维护。符合项目 Dependency Rules（成熟、活跃、小体积、不重复引入）。

新增依赖需运行 `pnpm add smol-toml`，并确认单工具页 JS（gzip）仍 < 50KB。

## 5. TOML 数据模型差异处理

TOML 是强类型配置格式，与 JSON/YAML 互转**非完全无损**。处理策略：

| 场景 | 策略 |
|---|---|
| TOML 无 null | JSON/YAML → TOML 遇 null：报友好错误「TOML 不支持 null 值（路径 a.b.c），请移除或替换为具体值」 |
| TOML 顶层必须为表 | JSON/YAML 顶层为数组或标量时：报错「TOML 顶层必须是表（对象），当前为数组 / 标量，请包装为对象」 |
| 异构数组 | TOML 数组元素应同类型；序列化时尽量保留，无法保留则报错并提示具体位置 |
| 日期时间类型 | TOML 原生 datetime → JSON/YAML 转为 ISO 8601 字符串；往返有损，转换后给出提示 |
| 键名特殊字符 | TOML 裸键仅允许 `[A-Za-z0-9_-]`；含特殊字符的键自动用引号键包裹 |
| TOML 解析错误 | 捕获 `smol-toml` 抛出的错误，归一化为中文 + 行号提示 |

## 6. 文件结构

```
src/utils/format/
  toml.ts                       # smol-toml 封装：parseTomlSafe / stringifyTomlSafe + 错误归一化
  toml-json.ts                  # TOML↔JSON 互转逻辑（主线程同步）
  toml-yaml.ts                  # TOML↔YAML 互转逻辑（主线程同步）
  toml-formatter.ts             # TOML 校验 + 美化逻辑
  toml-formatter.worker.ts      # 大文件美化 Worker
  __tests__/
    toml.test.ts
    toml-json.test.ts
    toml-yaml.test.ts
    toml-formatter.test.ts

src/tools/format/
  TomlJson.vue                  # TOML↔JSON 双向同步组件
  TomlYaml.vue                  # TOML↔YAML 双向同步组件
  TomlFormatter.vue             # TOML 校验 + 美化组件

src/pages/format/
  toml-json-converter.astro
  toml-yaml-converter.astro
  toml-formatter.astro
```

注册：

- `src/data/tools.ts`：新增 3 项，完整填写 `name` / `description` / `seoDescription`（120–160 字符）/ `keywords`（5–10 个）/ `relatedToolIds`
- `src/data/tool-faqs.ts`：每个工具 4–6 条 FAQ

相关工具关联建议：

- `toml-json-converter.relatedToolIds`：`[toml-yaml-converter, toml-formatter, json-formatter, json-to-yaml]`
- `toml-yaml-converter.relatedToolIds`：`[toml-json-converter, toml-formatter, json-to-yaml]`
- `toml-formatter.relatedToolIds`：`[toml-json-converter, toml-yaml-converter, json-formatter]`

## 7. 错误处理、无障碍、性能

遵循 PRODUCT.md §Error Handling 与既有工具规范。

错误处理：

- TOML 解析 / 序列化错误归一化为中文描述 + 行号，内联显示（输入框下方 `text-error` 或输出区）
- 数据模型差异按 §5 策略给出具体路径提示
- 复制成功 / 清空通过 Toast 反馈（1.5s 自动消失），经 `CustomEvent('toast', …)`

无障碍：

- 每个 textarea 关联 `aria-label`，错误通过 `aria-describedby` 关联
- 所有交互可 Tab 到达，焦点顺序合理
- 颜色对比度遵循 WCAG 2.1 AA

性能：

- 互转工具主线程同步（TOML 配置文件通常较小，与 `EnvConverter` 一致，不引入 Worker）
- `toml-formatter` 单向美化 >1MB 走 Web Worker
- 输入大小硬上限 10MB
- 单工具页 JS（gzip）< 50KB

## 8. 测试策略

单元测试（`src/utils/format/__tests__/`）覆盖：

- `toml.test.ts`：`smol-toml` 封装的解析 / 序列化、错误归一化
- `toml-json.test.ts`：TOML↔JSON 互转、null / 顶层非对象 / 异构数组 / 日期等边界
- `toml-yaml.test.ts`：TOML↔YAML 互转、同上边界
- `toml-formatter.test.ts`：校验、美化缩进、键顺序、错误行号

每个工具页面提供真实默认示例（`Cargo.toml` / `pyproject.toml` 片段）。

## 9. 排除项（YAGNI）

明确不在本次范围：

- TOML 校验 / 格式化之外的其他 TOML 编辑能力（如结构化表格编辑器）
- TOML ↔ properties / INI / XML 等小众格式互转（数据模型差异大、需求小众）
- TOML 与 JSON Schema 校验集成
- 批量文件转换

这些如有需要，日后按独立工具另行评估。

## 10. 验收标准

- 3 个工具页面均可正常访问（`/format/toml-json-converter` 等）
- 双向同步：任一边编辑，另一边正确实时转换；无 watch 死循环
- TOML 数据模型差异按 §5 给出正确中文提示
- 大文件（>500KB）走 Worker 不阻塞 UI
- 所有单元测试通过（`pnpm test`）
- `pnpm astro check` 类型检查通过
- `tools.ts` / `tool-faqs.ts` 注册完整，SEO 元数据齐全
- `pnpm dev` 浏览器实测：默认示例自动转换、复制 / 清空正常、错误提示正确
