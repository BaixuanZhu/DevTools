# 日期时间转换器输入框样式重构设计

## 背景

`DateTimeConverter.vue` 左栏的两个输入框（Unix 时间戳、日期时间）当前存在以下问题：

1. 视觉权重不一致：时间戳框内嵌"当前"按钮，日期框外置 📅 按钮。
2. 互转关系不明显：两个输入框只是简单上下堆叠，没有体现"时间戳 ↔ 日期"的等价双向关系。
3. 快捷按钮只影响时间戳，与日期输入没有形成对应。
4. 错误信息导致布局跳动：错误提示使用 `mb-4`，清空后下方内容上移。
5. 占位符过长，在常见宽度下会被截断。

## 目标

- **视觉一致性**：两个输入框在卡片结构、按钮位置、间距、标签样式上完全统一。
- **互转关系表达**：让用户一眼理解两个输入框是等价双向入口，任一输入都会自动同步到另一侧。

## 方案概述

采用"统一源面板 + 双卡片 + 双向自动同步"方案：

- 左栏整体作为一个 `bg-card` 面板，标题为"转换源"。
- 面板顶部保留快捷时间按钮（现在、昨天、今天、明天等），它们会同时填充两个输入框。
- 两个输入框以对称的卡片形式并排展示：
  - 左卡片：Unix 时间戳
  - 右卡片：日期时间
- 卡片底部放置操作按钮：时间戳卡片只保留"复制"，日期卡片保留"选择"和"复制"。
- 用户在任一输入框输入有效值后，自动同步到另一个输入框，无需手动"互换"按钮。
- 错误信息使用固定占位高度，避免布局跳动。

## 视觉设计

### 桌面端布局

```
┌─────────────────────────────────────────────────────────────┐
│ 转换源                                          [清空]       │
├─────────────────────────────────────────────────────────────┤
│ [⏱ 现在] [昨天] [今天] [明天]                                │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┐    ┌─────────────────────────┐  │
│ │ Unix 时间戳             │    │ 日期时间                │  │
│ │                         │    │                         │  │
│ │ 1700000000000           │ ←→ │ 2026/06/14 12:00:00     │  │
│ │                         │    │                         │  │
│ │ [📋 复制]                │    │ [📅 选择]  [📋 复制]    │  │
│ └─────────────────────────┘    └─────────────────────────┘  │
│ 错误占位（固定高度，避免跳动）                                │
└─────────────────────────────────────────────────────────────┘
```

### 移动端布局

- 双卡片垂直堆叠。
- 顶部快捷按钮和清空按钮按需换行。

## 样式规范

严格遵循 `DESIGN.md`：

| 元素 | Class |
|------|-------|
| 外层面板 | `bg-card border border-border rounded-md p-4` |
| 标题 | `text-sm font-semibold text-text` |
| 快捷按钮 | `bg-surface border border-border rounded-sm px-2.5 py-1 text-xs text-muted` |
| 双卡片容器（桌面） | `grid grid-cols-[1fr_auto_1fr] gap-3 items-center` |
| 双卡片容器（移动） | `grid grid-cols-1` |
| 单个卡片 | `bg-surface border border-border rounded-sm overflow-hidden` |
| 卡片头部 | `px-3 py-2 border-b border-border bg-card` |
| 输入区 | `px-3 py-3` |
| 输入框 | `w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none` |
| 卡片底部 | `px-3 py-2 border-t border-border bg-card flex gap-2` |
| 底部操作按钮 | `text-xs text-muted bg-transparent focus:outline-none focus:text-accent` |
| 错误占位 | `min-h-[20px]` |
| 错误文字 | `text-[0.8125rem] text-error` |

**注意**：本次重构暂不添加 hover 样式，仅保留 focus 状态。

## 交互行为

### 双向自动同步

- 在 **Unix 时间戳** 框输入有效值后：
  - 右侧结果区更新。
  - **日期时间框自动填充为对应的本地时间**（`yyyy/MM/dd HH:mm:ss`）。
  - `lastActiveInput = 'timestamp'`。

- 在 **日期时间** 框输入有效值后：
  - 右侧结果区更新。
  - **Unix 时间戳框自动填充为对应的毫秒时间戳**。
  - `lastActiveInput = 'date'`。

### 防止循环更新

利用已有的 `lastActiveInput` 做源保护：

- `watch(timestampInput)` 触发时：
  - 若输入有效，更新 `unifiedResult` 和 `dateInput`。
  - 设置 `lastActiveInput = 'timestamp'`。

- `watch(dateInput)` 触发时：
  - 若 `lastActiveInput === 'timestamp'`，说明这次变化是由时间戳同步过来的，不反向同步回时间戳框。
  - 否则，若输入有效，更新 `unifiedResult` 和 `timestampInput`。
  - 设置 `lastActiveInput = 'date'`。

### 快捷时间按钮

- 点击快捷时间按钮（现在、昨天、今天、明天等）时，**同时填充两个输入框**。
- 因为两个框始终同步，点击后它们会一起跳到对应时间。

### 清空按钮

- 清空两个输入框、结果、错误信息、`lastActiveInput` 重置为 `null`。

### 复制按钮

- 每个卡片底部新增"复制"按钮，复制当前输入框内容。
- 复制成功触发 Alpine Toast。

## 错误处理

- 每个卡片下方预留固定最小高度的错误区域：`min-h-[20px]`。
- 有错误时显示 `text-[0.8125rem] text-error`。
- 无错误时保持空白，避免布局跳动。
- 错误信息只显示当前激活源对应的错误：
  - 时间戳格式错误显示在时间戳卡片下方。
  - 日期格式错误显示在日期卡片下方。
- 清空时错误信息同步清空，但占位高度不变。

## 改动范围

### 修改文件

- `src/tools/datetime/DateTimeConverter.vue`
  - 重构模板结构（双卡片面板）。
  - 调整 `watch(timestampInput)`：有效时同步填充 `dateInput`。
  - 调整 `watch(dateInput)`：有效时同步填充 `timestampInput`，并防止反向循环。
  - 调整 `handleQuickTime`：同时填充两个输入框。
  - 移除时间戳输入框内部的"当前"按钮，但保留 `fillNow` 逻辑供快捷按钮调用。
  - 新增/调整复制按钮绑定。

### 不新增文件

- 复用现有 `CopyButton.vue`、`ClearButton.vue`、`SelectListbox.vue`。
- 不引入新依赖。

## 测试

- 现有 `src/tests/datetime/datetime.test.ts` 测试的是工具函数，不受影响。
- 如需补充，可在 `src/tools/datetime/__tests__/DateTimeConverter.spec.ts` 添加简单交互测试（非必须）。
