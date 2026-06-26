# 转盘抽奖（Wheel Picker）工具设计

> 状态：已通过头脑风暴评审，待用户复审
> 日期：2026-06-26
> 分类：文本处理（text）

## 1. 目标与定位

一个浏览器端的转盘抽奖 / 随机抽签工具。用户输入自定义选项，Canvas 绘制彩色转盘，配合
`easeOutCubic` 缓动动画旋转并指向结果。

核心诉求：

- 自定义输入抽奖选项，支持批量粘贴换行导入
- Canvas 彩色转盘 + 物理缓动旋转动画
- **不重复抽取**：中奖后自动从转盘移除该选项（可开关）
- **配置分享**：将选项编码到 URL 参数（`?data=`），他人打开直接使用同款转盘

定位说明：本工具偏生活 / 娱乐场景，与站点「开发者工具」主定位相关性较弱。已与用户确认仍要做，
设计上以**保持轻量、不堆功能**为约束。

## 2. 注册与文件结构

| 项 | 值 |
|---|---|
| 工具名 | 转盘抽奖 |
| id / slug | `wheel-picker` |
| path | `/text/wheel-picker` |
| 分类 | 文本处理（text） |
| 图标 | 🎡 |
| 水合策略 | `client:idle` |

> ⚠️ 注册铁律：`tools.ts` 中 `id` 必须等于 path 末段（`wheel-picker`），否则 FAQ / 相关工具 /
> SEO 结构化数据会静默失效。

新增 / 修改文件：

```
src/pages/text/wheel-picker.astro          # 壳层，引入 ToolLayout + Vue 组件
src/tools/text/WheelPicker.vue             # 交互组件：Canvas 渲染 + 动画 + 交互
src/utils/text/wheel.ts                     # 纯逻辑：加权随机、扇区角度、分享编解码
src/utils/text/__tests__/wheel.test.ts      # 单元测试
src/data/tools.ts                           # 注册工具元数据（含完整 SEO 字段）
src/data/tool-faqs.ts                       # 注册 FAQ 问答对
```

职责边界：`wheel.ts` 抽出**纯函数**（与 DOM / Canvas 无关），可独立单测；`WheelPicker.vue`
只负责 Canvas 渲染、`requestAnimationFrame` 动画与交互编排。

## 3. 数据模型

```ts
/** 单个转盘选项 */
interface WheelItem {
  /** 选项名称（去除首尾空白，非空） */
  text: string;
  /** 权重，正数；默认 1。面积与中奖概率正比于权重 */
  weight: number;
}
```

组件内部状态：

- `items: WheelItem[]` —— 活跃（可被抽中）的选项，**唯一真相源**
- `wonItems: WheelItem[]` —— 已中奖项（不重复模式下从 `items` 移出后进入此列表）
- `noRepeat: boolean` —— 不重复抽取开关，默认 `true`
- `rotation: number` —— 当前转盘旋转角（弧度或角度，实现内统一）
- `spinning: boolean` —— 是否旋转中（锁定交互）
- `result: WheelItem | null` —— 最近一次中奖项
- `batchText: string` —— 批量导入文本框内容

## 4. 界面布局

采用 `ResponsiveWorkspace` 左右分栏（窄屏上下堆叠）。

### 左侧 · 控制区

- **结构化选项列表**：每行 = 名称输入框 + 权重数字输入框 + 删除按钮；底部「+ 添加选项」。
  这是数据唯一真相源。
- **批量导入**：多行文本框 + 「导入」按钮。粘贴多行文本，每行一个选项（权重默认 1），点击
  **追加**到列表（空行忽略）。满足「批量粘贴换行导入」。
- **「不重复抽取」开关**（`ToggleSwitch`），默认开。
- **「已中奖」列表**（仅不重复模式显示）：每项可单独「恢复」，底部「全部重置」。
- **操作栏**：清空（重置全部输入回默认示例）、复制分享链接。

### 右侧 · 转盘区

- Canvas 转盘 + 顶部固定指针（指针不动，转盘转）。
- 大号「开始」按钮（旋转中禁用；活跃项 < 2 或为空时禁用并提示）。
- 结果文字展示，中奖项高亮。

### 输入模型取舍（已决策）

采用**结构化列表为主 + 批量导入文本框**。备选方案「单 textarea + 内联权重语法（如
`张三 *3`）」链接更短、实现更轻，但中文含空格解析有歧义、权重编辑体验差；鉴于权重已纳入首版，
结构化列表更稳。已确认采用前者。

## 5. 核心算法（`wheel.ts` 纯函数）

### 5.1 加权随机选择

```ts
/**
 * 按权重随机选中一个下标。
 * @param weights 各选项权重（正数）
 * @param rng 返回 [0,1) 均匀随机数的函数，便于测试注入
 * @returns 命中下标
 */
function pickWeightedIndex(weights: number[], rng: () => number): number;
```

- 生产环境 `rng` 基于 `crypto.getRandomValues`（均匀、不可预测）。
- 前缀和落点法：累加权重，落在哪段返回哪个下标。
- 每个选项中奖概率 = 自身权重 / 总权重。

### 5.2 扇区角度

```ts
/**
 * 计算每个选项的扇区起止角度（面积正比于权重）。
 * @returns 与 items 等长的 { start, end, mid } 角度数组
 */
function computeSectors(items: WheelItem[]): SectorAngle[];
```

- 角度之和为 360°（`2π`）。
- `mid` 用于动画落点与文字绘制。

### 5.3 目标旋转角

```ts
/**
 * 已知中奖下标，计算让指针停在该扇区内所需的最终旋转角。
 * @param current 当前旋转角
 * @param winnerSector 中奖扇区角度
 * @param extraTurns 额外整圈数（视觉效果），如 4~6 圈
 */
function computeTargetRotation(
  current: number,
  winnerSector: SectorAngle,
  extraTurns: number,
): number;
```

**先定结果、再算动画**：先用 5.1 选出 winner，再算停在其扇区内（可在扇区内取随机偏移，避免每次都停正中）的最终角度，叠加若干整圈。保证视觉指向与逻辑结果**永远一致**。

### 5.4 分享编解码

```ts
/** 将选项编码为 URL-safe Base64（权重全为 1 时退化为纯名称数组） */
function encodeShare(items: WheelItem[]): string;

/** 解码分享串为选项数组；输入非法时抛错（由调用方 try-catch 回退） */
function decodeShare(data: string): WheelItem[];
```

编码流程：

1. 若所有权重为 1 → 负载为 `string[]`（纯名称）；否则为 `Array<[text, weight]>`。
2. `JSON.stringify` → `encodeURIComponent`（兼容中文）→ Base64 → URL-safe 替换
   （`+`→`-`，`/`→`_`，去 `=` padding）。

解码为逆过程，对结构、类型严格校验，任一步失败即抛错。

## 6. 旋转动画

- `requestAnimationFrame` 驱动，时长约 4s。
- 缓动 `easeOutCubic`：`t => 1 - Math.pow(1 - t, 3)`，从当前角缓动到目标角。
- 旋转期间 `spinning = true`，锁定「开始」与所有编辑操作。
- 动画结束设置 `result`，触发结果展示；若开启不重复抽取，执行第 7 节联动。

## 7. 不重复抽取联动

- 开启时，winner 从 `items` 移出、压入 `wonItems` → `computeSectors` 重算 → Canvas 重绘
  （剩余项按权重重新分布）。
- 活跃项为空 → 提示「全部抽完」，「开始」禁用，引导「全部重置」。
- 「恢复」某项 → 从 `wonItems` 移回 `items` 并重绘。
- 关闭开关时不移除，可重复抽中同一项。

## 8. 配置分享与 URL 行为

- 「复制分享链接」：`encodeShare(items)` → 拼成 `<当前页 URL>?data=<base64>` → 写剪贴板 +
  toast 反馈。
- 打开带 `?data=` 时：**直接解码并渲染**，不弹确认框，用户落地即用同款转盘。
- 解码失败（参数损坏 / 非法）：静默回退默认示例 + toast「分享链接无效」。全程 try-catch，
  **绝不白屏**。
- 长度护栏：编码后 URL 长度超过阈值（约 2000 字符）时 toast 提示「选项过多，链接可能在部分平台
  被截断」，但仍允许复制。

## 9. 错误处理 / 默认值 / 边界

- **默认示例**：预填 6 个等权选项（如「一等奖 / 二等奖 / 三等奖 / 谢谢参与」等），打开即可玩，
  无需「填入示例」按钮。
- **校验**：
  - 名称去首尾空白后为空的行忽略，不计入选项。
  - 权重输入非正数（含 0、负、NaN）回退为 1。
  - 选项数量上限 50，超出时提示并阻止继续添加（保证扇区可读）。
  - 活跃项 < 2 时禁用「开始」并提示「至少需要 2 个选项」。
- **必备按钮**：清空、复制分享链接（均给反馈），符合工具页通用要求。

## 10. 视觉与配色

- 扇区颜色由**自动调色板**按下标分配（HSL 等间隔取色，保证相邻扇区色相区分度），不开放自定义颜色。
- 遵循 DESIGN.md 令牌与组件状态规范；样式优先标准 Tailwind 类名，避免任意值语法。
- Canvas 尺寸自适应容器，固定宽高比，高 DPI 屏按 `devicePixelRatio` 放大避免模糊。

## 11. 测试（Vitest）

`src/utils/text/__tests__/wheel.test.ts`：

- `pickWeightedIndex`：固定 rng 序列断言命中下标；权重含 0 / 负数的回退；分布近似正比于权重。
- `computeSectors`：角度之和等于 360°；面积正比于权重；单选项 / 多选项边界。
- `computeTargetRotation`：最终角落在 winner 扇区内；含额外整圈。
- `encodeShare` / `decodeShare`：往返一致（含中文、含权重 / 全 1 退化两种形态）；坏输入抛错。
- 不重复移除后：`items` / `wonItems` 数量与扇区重算正确。

## 12. 范围外（YAGNI）

- 旋转 / 中奖音效
- 自定义扇区颜色（用自动调色板）
- 抽奖历史持久化（localStorage）
- 多转盘 / 转盘预设管理
- 倒计时、轮播等无关功能

## 13. SEO 元数据（`tools.ts` 草案）

- name：转盘抽奖
- description：自定义选项的在线转盘抽奖 / 随机抽签工具，支持批量导入、不重复抽取与配置分享
- category：文本处理
- keywords（草案）：转盘抽奖、在线抽签、随机抽签、随机选择器、幸运转盘、决策转盘、随机点名、
  抽奖转盘、wheel picker、random picker
- relatedToolIds：`random-string`、`uuid-generator`、`fake-data-generator`（择优取 4 个内）

FAQ（`tool-faqs.ts`）草案问答：

- 抽奖结果是随机的吗？（基于浏览器 `crypto` 随机，公平不可预测）
- 「不重复抽取」是什么意思？（中奖项自动从转盘移除，适合抽不重复名单）
- 分享链接安全吗？数据会上传吗？（纯浏览器端，选项编码在 URL 不经服务器）
- 可以设置不同中奖概率吗？（可为每个选项设权重，面积与概率正比）
