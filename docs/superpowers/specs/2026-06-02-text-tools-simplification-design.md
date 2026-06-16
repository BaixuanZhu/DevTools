# 文本生成工具极简化设计

## 概述

将 UUID 生成器和随机字符串生成器从"手动触发 + 卡片布局"优化为"即时响应 + 极简布局"。用户打开页面即见结果，调整设置自动刷新，操作集中在单行控制栏。

## 通用交互模式（两个工具共用）

### 行为变更

| 当前行为 | 新行为 |
|---------|--------|
| 手动点击"生成"按钮才出结果 | `onMounted` 自动生成，`watch` 监听参数变化自动重新生成 |
| "生成"按钮 | 改为刷新图标按钮（↻），用于同参数重新随机 |
| "填入示例"按钮 | 移除（`showExample: false`） |
| "清空"按钮 | 移除（总是有结果，清空无意义） |
| 空状态占位符文本 | 移除 |
| 结果区卡片边框容器 | 移除，直接展示结果 |

### 保留功能

- 单条结果右侧复制按钮
- 多条结果时"复制全部"按钮
- 复制成功反馈（✓ 1 秒）

## UUID 生成器设计

### 控制区

**第一行**：
```
[v1] [v3] [v4●] [v5] [v6] [v7]    ×1  [↻]  [复制]
```

- **版本选择**：6 个 toggle chip（v1 | v3 | v4 | v5 | v6 | v7），按版本号从小到大排列，默认 v4。选中态用 accent 色填充。
- **数量**：inline 数字输入，宽度 50px，前缀 label 简写 "×"，范围 1-100。
- **刷新按钮**：↻ 图标按钮，同参数重新随机。
- **复制按钮**：单条时复制该条；多条时等同于"复制全部"。

**第二行**（条件显示，仅 v3/v5 时）：
```
名称 [_______________]  命名空间 [DNS ▼]
```

- **名称（name）**：文本输入框，v3/v5 的必填参数。
- **命名空间（namespace）**：下拉选择，预设选项：
  - `DNS`（`v3.DNS` / `v5.DNS`：`6ba7b810-9dad-11d1-80b4-00c04fd430c8`）
  - `URL`（`v3.URL` / `v5.URL`：`6ba7b811-9dad-11d1-80b4-00c04fd430c8`）
  - `自定义`（展开一个 UUID 输入框）
- 选择 v3/v5 且 name 为空时不生成，显示提示"请输入名称"。

### 结果展示

- **单条**：大号等宽字体（font-size 1.125rem），居中，无边框，下方有淡化提示"点击复制"。
- **多条**：紧凑列表，每行 `<code>` 值 + 右侧复制按钮，列表右上角"复制全部"。
- **转换值**（v1/v6 时）：生成结果下方显示转换后的对应版本值：
  - 选中 v1 时：额外显示 `v1ToV6(uuid)` 的结果，label "→ v6"
  - 选中 v6 时：额外显示 `v6ToV1(uuid)` 的结果，label "→ v1"
  - 转换值右侧有独立复制按钮

### 依赖变更

- 新增 `uuid` npm 包（`import { v1, v3, v4, v5, v6, v7, v6ToV1, v1ToV6 } from 'uuid'`）
- 移除手写的 `generateV1`/`generateV4`/`generateV7` 函数

### 技术实现

- 使用 `uuid` 包的 `v1()`、`v3(name, ns)`、`v4()`、`v5(name, ns)`、`v6()`、`v7()` 生成对应版本
- 使用 `v6ToV1(uuidStr)` 和 `v1ToV6(uuidStr)` 做版本转换
- v3/v5 的 namespace 下拉：DNS/URL 用包内置常量，自定义允许输入任意 UUID
- 移除 `generateBtnRef` 和 focus 逻辑
- 移除 `handleExample` 方法
- `watch([version, amount, ...v3v5params], generate, { immediate: false })` + `onMounted(generate)`
- 版本选择从 `<select>` 改为一组 `<button>` + v-model 式的点击切换

## 随机字符串生成器设计

### 控制区（两行）

**第一行**：
```
长度 32  [字母+数字●] [仅数字] [+特殊字符] [自定义]  [大写] [小写]
```

- **长度**：inline 数字输入，宽度 70px，label "长度"，范围 1-10000。
- **字符集**：4 个 toggle chip，选中态用 accent 色填充。
- **大小写**：两个可选 toggle chip（"大写"、"小写"），互斥且可选（默认都不选=原样）。仅当字符集包含字母时生效（"仅数字"模式下禁用或隐藏）。

**第二行**（条件显示）：
```
[自定义字符输入框]          （仅 charsetPreset === 'custom' 时显示）
```

**第三行**：
```
×1  [↻]  [复制]
```

- 数量、刷新、复制与 UUID 相同。

### 结果展示

同 UUID 方案。结果区始终可见（默认展示），不做条件渲染。

### 实时校验

- `watch` 触发生成前先校验：
  - 自定义模式下字符集非空
  - 长度在 1-10000 范围内
- 不合法时不生成，显示红色错误提示在控制区下方。

### 技术实现

- 移除 `handleExample` 方法
- `watch([length, charsetPreset, customChars, amount], () => { validate && generate() })` + `onMounted(generate)`
- 字符集选择从 `<select>` 改为一组 `<button>` 点击切换
- 移除 `results.length` 的条件渲染（v-if），始终显示结果区
- 新增 `letterCase` ref（值：'none' | 'upper' | 'lower'），watch 中监听，生成后对结果做大小写转换
- 大小写 chip 仅在字符集包含字母时启用（"仅数字"时禁用并重置为 'none'）

## 共用样式规范

### Chip/Toggle 样式

```css
.chip {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  color: var(--color-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
```

### 刷新按钮样式

```css
.refresh-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all var(--transition-fast);
}
.refresh-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

## 不变更的部分

- `ToolHeader` 组件本身不变，只传 `showExample: false`
- `CopyButton`、`ClearButton` 组件保留在项目中（其他工具可能使用）
- `copyToClipboard` 工具函数不变
- 生成逻辑函数（generateRandomString）不变
- UUID 生成逻辑改为使用 `uuid` 包（移除手写实现，支持 v1/v3/v4/v5/v6/v7 全版本）
- 页面路由不变（uuid-generator.astro, random-string.astro）
- design-tokens.css 不变
