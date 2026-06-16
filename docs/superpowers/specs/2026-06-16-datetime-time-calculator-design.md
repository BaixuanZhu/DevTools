# 日期时间：时间差与倒计时计算器 — 设计文档

> - **日期**：2026-06-16
> - **阶段**：ROADMAP P0 · 现有工具深化（datetime 分类）
> - **状态**：已与用户确认，待编写实现计划
> - **预估工时**：≈ 1.5d

## 一、背景与目标

现有 `/datetime/datetime-converter` 仅做「单时间点的格式互转」（时间戳 ⇄ 日期、时区、自定义格式），缺少「计算」能力。本工具补齐两个高频需求：

- **时间差**：两个时间点之差（天/时/分/秒 + 总秒数）
- **倒计时**：对未来时刻实时倒数，过期自动转正计时

二者与「格式互转」是不同心智任务，故作为 datetime 分类下的**独立工具**承载，现有转换器完全不动。

## 二、方案选型

| 维度 | 决策 | 理由 |
|------|------|------|
| 承载形态 | 独立工具，两者合一 | 与「格式互转」心智不同，遵循项目「独立工具优先」偏好 |
| 组织方式 | 单页面上下分区堆叠（不用 Tab） | 两个功能同页可见；沿用用户对「不用 Tab」的偏好 |
| 工具函数 | 扩展 `src/utils/datetime/datetime.ts`，新增纯函数 | 同主题集中、复用现有解析、可单测 |
| 组件结构 | 单组件 `TimeCalculator.vue`，内含两个 section | 当前规模不必拆子组件，YAGNI |
| 功能档位 | 时间差 / 倒计时均取「标准」档 | 覆盖核心需求，避免面板臃肿 |

## 三、工具定位

| 项 | 值 |
|----|----|
| 路由 | `/datetime/time-calculator` |
| 页面 | `src/pages/datetime/time-calculator.astro`（仅 `ToolLayout` + 组件 `client:idle`） |
| 组件 | `src/tools/datetime/TimeCalculator.vue` |
| 工具名 | 时间差与倒计时 |
| 描述 | 计算两个时间点的时间差，以及对未来时刻实时倒计时 |
| relatedToolIds | `datetime/datetime-converter`、`datetime/cron-parser` |

## 四、页面布局

```
ToolHeader（标题：时间差与倒计时 / 描述）
└─ Section A：时间差计算   （上，bg-card 圆角区块）
└─ Section B：倒计时       （下，bg-card 圆角区块）
```

两个 section 各自独立、内聚，互不依赖。

## 五、时间差 section（标准档）

### 输入
两个时间点 A、B，各一个输入框，接受：
- Unix 时间戳（10 位秒 / 13 位毫秒，复用 `detectTimestampUnit`）
- 日期 `yyyy/MM/dd HH:mm:ss`（复用 `parseDateInput`）

每个输入框配套：
- 「现在」快捷按钮（填入当前时间）
- 隐藏 `<input type="datetime-local">` + 「📅 选择」按钮（沿用现有转换器的 `showPicker()` 方案）

### 输出
- 主结果：`X天 Y时 Z分 W秒`，并标注方向（如「A 比 B 早 1天 2时」或「A 与 B 相同」）
- 总秒数（独立一行，可复制）

### 交互
- 任一输入变化 → 实时重算（`watch` / `computed`）
- 「清空」按钮：清空 A、B 与结果
- 「复制结果」按钮

## 六、倒计时 section（标准档）

### 输入
目标时间（时间戳/日期，同上解析方式）+「现在」与「📅 选择」辅助。

### 输出
- 大字 `D天 HH:MM:SS` 实时倒数（每秒刷新）
- 过期：自动转正计时「已过期，距今 X天 Y时 Z分 W秒」，继续走

### 行为
- `setInterval` 每 1s 刷新；`onMounted` 启动、`onUnmounted` 清理（页面卸载即停）
- 到点（倒数归零瞬间）触发 `CustomEvent('toast', { detail: { message: '时间到了' } })`，仅触发一次（用一次性标志位防重复）
- 「清空」按钮：清空目标时间

## 七、工具函数（扩展 `src/utils/datetime/datetime.ts`）

新增纯函数：

```ts
/** 时间差拆解结果 */
export interface Duration {
  /** a 与 b 的先后关系：1 = a 晚于 b，-1 = a 早于 b，0 = 相同 */
  sign: 1 | -1 | 0;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

/** 灵活解析时间戳或 yyyy/MM/dd HH:mm:ss 为毫秒，非法返回 null */
export function parseFlexibleTimeInput(input: string): number | null;

/** 计算两个毫秒时间戳的差值并拆解为天/时/分/秒 */
export function computeDuration(a: number, b: number): Duration;

/** 把 Duration 格式化为 "X天 Y时 Z分 W秒" */
export function formatDurationParts(d: Duration): string;
```

倒计时逐秒计算直接复用 `computeDuration(now, target)`，不重复造轮子。

## 八、数据流

- **时间差**：`inputA` / `inputB` 变化 → `computed` 调 `parseFlexibleTimeInput` + `computeDuration` → 结果展示
- **倒计时**：`target` 输入 → `setInterval` 每秒 `computeDuration(now, target)` → 展示；到点检测靠 sign 翻转 + 一次性标志位

## 九、错误处理

- 输入非法：中文内联提示，复用现有 `border-error` + `<p class="text-error">` 样式
- 时间差：A 或 B 非法 → 该框报错、不计算
- 倒计时：target 非法 → 报错、不启动倒数

## 十、默认值（打开即可体验）

- 时间差：A = 今天 `00:00:00`，B = 现在
- 倒计时：目标 = 明天此刻

## 十一、SEO

- `src/data/tools.ts` 注册：`name` / `description` / `seoDescription`（120–160 字符）/ `keywords` / `category` / `relatedToolIds`
- `src/data/tool-faqs.ts` 加 2–3 条：
  - 如何计算两个时间点的时间差？
  - 倒计时过期后会怎样？
  - 支持哪些时间输入格式？
- `<title>` / meta description 完整

## 十二、测试

`src/utils/datetime/__tests__/time-diff.test.ts`：

- `parseFlexibleTimeInput`：秒 / 毫秒 / 合法日期 / 非法输入
- `computeDuration`：同时间（sign 0）、a<b（sign -1）、a>b（sign 1）、跨年大跨度
- `formatDurationParts`：边界值（0、仅秒、仅天）格式化

## 十三、完成清单（对照 ROADMAP 通用清单）

- [ ] `tools.ts` 注册 + 完整 SEO 字段
- [ ] `tool-faqs.ts` 问答对
- [ ] 页面 `time-calculator.astro` + 组件 `TimeCalculator.vue`
- [ ] 工具函数（`parseFlexibleTimeInput` / `computeDuration` / `formatDurationParts`）+ 单测
- [ ] 输入校验 + 中文错误提示
- [ ] 清空 / 复制结果 / 合理默认值
- [ ] 安全：无 `eval`/`Function(string)`，正则 try-catch

## 十四、排除项（本次不做）

- 增强档（总天数/周数/工作日、进度条、自定义提醒文案）—— YAGNI，待用户反馈再评估
- 多时区切换 —— 复用本地时间，与时间差/倒计时核心需求无关
