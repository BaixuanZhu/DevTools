# URL 解析器编解码区域 UI 调整设计文档

## 背景

当前 `/network/url` 页面的编解码区域存在以下体验问题：

1. `encodeURIComponent` / `encodeURI` 等函数名以全大写形式展示，对非开发者用户不够直观。
2. 输入框为空或未点击按钮时，编解码结果区域完全隐藏，用户无法预知功能形态。
3. 编码、解码按钮外观相同，无法一眼识别当前处于哪种模式。

## 目标

在不改变 URL 解析核心逻辑的前提下，优化编解码区域的展示与交互，使其更符合产品“打开即体验”的默认值原则。

## 方案

采用**方案 A：默认自动编码 + 按钮状态驱动**。

### 1. 标签可读化

将函数名标签改为中文描述：

| 原标签 | 新标签 |
|--------|--------|
| `encodeURIComponent` | URL 组件编码 |
| `encodeURI` | URL 整体编码 |
| `decodeURIComponent` | URL 组件解码 |
| `decodeURI` | URL 整体解码 |

同时移除原标签的 `uppercase tracking-wide` 样式，避免视觉上呈现“全大写”。

### 2. 区域始终显示，默认编码状态

- 新增响应式状态 `currentAction: 'encode' | 'decode'`，默认值为 `'encode'`。
- 页面加载时，立即对默认示例 URL 执行编码并展示结果。
- 输入框内容变化时：
  - 若 `currentAction === 'encode'`，自动调用 `encodeUrl(input)`。
  - 若 `currentAction === 'decode'`，自动调用 `decodeUrl(input)`。
- 输入为空时，编解码区域仍然可见，结果框显示空字符串；错误提示不显示。

### 3. 按钮样式区分

- 当前激活的按钮使用 `BTN_PRIMARY_CLASS`（主色背景、白色文字）。
- 未激活的按钮使用 `BTN_SECONDARY_CLASS`（卡片背景、主色边框悬停）。
- 点击按钮时切换 `currentAction` 并立即触发对应计算。

## 实现范围

仅修改 `src/tools/network/UrlTool.vue` 中的状态、计算逻辑与模板展示，不涉及 `src/utils/network/url.ts` 等核心工具函数。

## 验收标准

- [ ] 页面加载后默认展示编码结果，无需点击按钮。
- [ ] 清空输入框后，编解码区域仍可见，编码结果为空。
- [ ] 点击“解码”按钮后，按钮样式变为主按钮，区域切换为解码结果。
- [ ] 标签显示为中文，不再出现全大写的函数名。
- [ ] 结构化解析区域行为保持不变。
