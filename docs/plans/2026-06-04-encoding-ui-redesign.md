# 编码转换工具 UI 重设计

> 日期：2026-06-04
> 涉及工具：Base64 编解码、URL 编解码、JWT 解析器
> 前置：功能优化已完成（见 2026-06-04-encoding-tools-optimization.md），本次仅重构 UI 层

---

## 设计原则

- 使用 `@headlessui/vue` v1.x 组件（DisclosureSection、SelectListbox）替代原生控件和手写折叠面板
- 去掉 `field-label` CSS class，统一用 Tailwind 行内 class
- 所有工具卡片式分区，结构清晰
- 响应式：宽屏双栏，窄屏（<768px）堆叠
- 保持现有设计令牌（surface/card/hover/text/muted/border/accent/error/success）

---

## 一、Base64 编解码 — 并排双栏

### 布局

```
┌─────────────────────────────────────────┐
│ Base64 编解码           [填入示例]       │
│ Base64 编码与解码，支持文本和文件         │
├──────────────────┬──────────────────────┤
│   编码            │   解码               │
│ ┌──────────────┐ │ ┌──────────────────┐ │
│ │ textarea     │ │ │ textarea         │ │
│ │ 输入文本      │ │ │ 输入 Base64      │ │
│ └──────────────┘ │ └──────────────────┘ │
│ ┌ - - - - - - ┐ │ ┌──────────────────┐ │
│ │ 拖拽文件到   │ │ │ 输出结果         │ │
│ │ 这里或点击   │ │ │ (文本/图片/下载)  │ │
│ │ 选择文件     │ │ │                  │ │
│ └ - - - - - - ┘ │ └──────────────────┘ │
│ 📄 image/png     │                      │
│   · 24.5 KB     │ [解码] [复制] [清空]  │
│ ┌──────────────┐ │                      │
│ │ 输出结果     │ │                      │
│ │ (Base64)     │ │                      │
│ └──────────────┘ │                      │
│ [复制] [清空]    │                      │
├──────────────────┴──────────────────────┤
```

### 关键变更

1. **去掉 ModeTabGroup**：改为左右并排双栏，编码在左解码在右
2. **拖拽上传区域**：
   - 虚线边框 `border-dashed border-2 border-border rounded-md p-6 text-center`
   - 默认显示「拖拽文件到这里或点击选择」
   - 拖入/选择文件后显示文件名 + MIME + 大小，背景变 `bg-hover`
   - 事件：`@dragover.prevent` `@dragleave` `@drop.prevent` + 隐藏 `<input type="file">` 点击触发
3. **解码输出**保持现有逻辑（文本 / 图片预览 / 下载按钮）
4. **编码输出**增加元信息条（MIME + 文件大小）
5. **响应式**：`md:grid-cols-2`，窄屏 `grid-cols-1` 堆叠

### 组件使用

- 不使用 ModeTabGroup
- 使用 `CopyButton`、`ClearButton`（保持现有）
- 不引入新的 Headless UI 组件（拖拽区域是纯 DOM 事件）

---

## 二、URL 编解码 — 一页式同时展示

### 布局

```
┌─────────────────────────────────────────┐
│ URL 编解码              [填入示例]       │
│ URL 编码与解码，支持组件级和完整 URL 编码 │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ textarea 输入                       │ │
│ └─────────────────────────────────────┘ │
│ [清空]                                  │
├──────────────────┬──────────────────────┤
│   编码结果        │   解码结果           │
│ ┌──────────────┐ │ ┌──────────────────┐ │
│ │component:    │ │ │component:        │ │
│ │ 代码文本 [📋]│ │ │ 代码文本/错误    │ │
│ │              │ │ │                  │ │
│ │URI:          │ │ │URI:              │ │
│ │ 代码文本 [📋]│ │ │ 代码文本/错误    │ │
│ └──────────────┘ │ └──────────────────┘ │
│ ▶ 差异对照      │                      │
├──────────────────┴──────────────────────┤
│ ▶ 🔗 检测到 URL · 点击查看解析          │
├─────────────────────────────────────────┤
```

### 关键变更

1. **去掉 ModeTabGroup**：不再切换编码/解码模式
2. **一页同时展示**：输入任意文本，下方左右两列分别展示编码结果和解码结果
   - 左列「编码结果」：`encodeURIComponent` + `encodeURI` 两种
   - 右列「解码结果」：`decodeURIComponent` + `decodeURI` 两种
   - 每种结果独立显示值或错误
3. **差异对照**：用 `DisclosureSection` 组件折叠展示
4. **URL 解析**：用 `DisclosureSection` 组件折叠展示
5. **实时响应**：`watch(input)` 触发所有计算
6. **响应式**：`md:grid-cols-2`，窄屏堆叠

### 组件使用

- 不使用 ModeTabGroup
- 使用 `DisclosureSection`（差异对照 + URL 解析）
- 使用 `CopyButton`、`ClearButton`

---

## 三、JWT 解析器 — 一页式三卡片

### 布局

```
┌─────────────────────────────────────────┐
│ JWT 解析器              [填入示例]       │
│ 解析和验证 JSON Web Token               │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ textarea 输入 JWT Token             │ │
│ └─────────────────────────────────────┘ │
│ [Token 未过期]                          │
│                                         │
│ ┌─ ● Header ──────────────────────────┐ │
│ │ { "alg": "HS256", "typ": "JWT" }    │ │
│ │ [复制 JSON]                          │ │
│ └──────────────────────────────────────┘ │
│ ┌─ ● Payload ─────────────────────────┐ │
│ │ sub  主题    1234567890              │ │
│ │ iat  签发时间 1516239022 (...)       │ │
│ │ ─── 自定义声明 ───                  │ │
│ │ name  John Doe                      │ │
│ │ [复制 JSON]                          │ │
│ └──────────────────────────────────────┘ │
│ ┌─ ● Signature ───────────────────────┐ │
│ │ 4DLyM2DJpI8...                     │ │
│ │ [复制]                               │ │
│ └──────────────────────────────────────┘ │
│                                         │
│ ▶ 验证签名                              │
│   ┌──────────┐ ┌─────────────────┐     │
│   │ HS256  ▼ │ │ 密码输入 [显示]  │     │
│   └──────────┘ └─────────────────┘     │
│   [验证] ✅ 签名匹配                    │
│                                         │
│ [清空]                                   │
└─────────────────────────────────────────┘
```

### 关键变更

1. **验证签名面板**：用 `DisclosureSection` 替代手写折叠
2. **算法选择**：用 `SelectListbox` 替代原生 `<select>`
3. **`field-label`** 全部替换为 Tailwind 行内 class
4. **密钥输入**：保持 password 类型 + 显示/隐藏切换（不用 Headless UI，用原生 input + 按钮切换 type）
5. **三段卡片颜色标签**：红(Header)、紫(Payload)、绿(Signature) 保持现有
6. **自定义声明展示**：保持现有分离展示逻辑

### 组件使用

- 使用 `DisclosureSection`（验证签名面板）
- 使用 `SelectListbox`（算法选择，options: HS256/HS384/HS512）
- 使用 `CopyButton`、`ClearButton`
- 不使用 ModeTabGroup

---

## 共同规范

### 去掉 `field-label`

所有 `<label class="field-label">` 替换为：
```html
<label class="block text-[0.8125rem] text-muted font-medium mb-1">
```

### 卡片统一样式

```html
<div class="border border-border rounded-md p-4 bg-card">
```

### 空状态提示

结果区为空时显示：
```html
<div class="border border-border rounded-md bg-card p-6 text-center">
  <p class="text-muted text-[0.8125rem]">输入内容后实时显示结果</p>
</div>
```

### 响应式断点

- 双栏布局：`grid md:grid-cols-2 gap-4`
- 窄屏自动堆叠为单列

### Headless UI 组件使用清单

| 组件 | 使用场景 |
|------|---------|
| `DisclosureSection` | URL 差异对照、URL 解析、JWT 验证签名 |
| `SelectListbox` | JWT 算法选择 |
| `CopyButton` | 所有复制操作（保持现有） |
| `ClearButton` | 所有清空操作（保持现有） |

**不使用**：ModeTabGroup（三个工具都去掉 Tab 切换）、ToggleSwitch、OptionRadioGroup
