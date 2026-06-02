# 项目框架设计

## 概述

基于 Astro 6 搭建开发者工具网站的基础框架。Astro + Vue 3 混合架构，Astro 负责页面骨架和静态渲染，Vue 3 负责交互型组件和工具页面的客户端逻辑。支持 20+ 工具的扩展规模，提供分类导航 + 搜索的混合发现方式。

## 架构决策

**方案选择：Astro + Vue 3（@astrojs/vue）**

通过 `@astrojs/vue` 集成 Vue 3，利用 Astro Islands 架构实现按需水合：
- **Astro 组件**：负责页面骨架、布局、纯展示型组件（Layout、Footer、ToolCard）
- **Vue 3 组件**：负责交互型组件和工具页面逻辑（Sidebar、SearchBar、CopyButton、各工具页面交互）

理由：
- Vue 3 生态成熟，中文社区资源丰富
- Astro Islands 按需水合，只对需要交互的组件加载 Vue 运行时
- Vue 3 Composition API 适合工具页面的状态管理
- 比纯原生 JS 更易维护，组件状态管理更清晰

### 组件职责划分

| 类型 | 技术 | 示例 |
|------|------|------|
| 页面骨架/布局 | Astro | Layout.astro, ToolLayout.astro |
| 纯展示型 | Astro | ToolCard.astro, Footer.astro |
| 交互型（全局） | Vue 3 | Sidebar, SearchBar |
| 交互型（可复用） | Vue 3 | CopyButton, ClearButton, ToolHeader |
| 工具页面逻辑 | Vue 3 | 各工具页面的 `<script setup>` |

### Vue 3 使用约定

- 使用 `<script setup lang="ts">` + Composition API
- Astro 中通过 `client:idle` / `client:load` 控制水合时机
- 全局交互组件（Sidebar、SearchBar）用 `client:load`
- 工具页面内组件用 `client:idle`
- Vue 组件的样式使用 `<style scoped>`，引用 design-tokens.css 变量

## 目录结构

```
src/
├── layouts/
│   ├── Layout.astro           # 全局页面骨架（html/head/body）
│   └── ToolLayout.astro       # 工具页布局（Header + 侧边栏 + 内容区 + Footer）
├── pages/
│   ├── index.astro            # 首页（工具仪表盘）
│   ├── uuid-generator.astro   # 各工具页面
│   ├── hash-generator.astro
│   ├── random-string.astro
│   ├── base64.astro
│   ├── datetime-converter.astro
│   ├── url-encode.astro
│   ├── jwt-parser.astro
│   ├── device-info.astro
│   └── symmetric-crypto.astro
├── components/
│   ├── Sidebar.vue            # 侧边栏导航（交互型）
│   ├── SearchBar.vue          # 搜索栏（交互型）
│   ├── ToolCard.astro         # 首页工具卡片（纯展示）
│   ├── ToolHeader.vue         # 工具页标题区（交互型）
│   ├── CopyButton.vue         # 复制结果按钮（交互型）
│   ├── ClearButton.vue        # 清空按钮（交互型）
│   └── Footer.astro           # 页脚（纯展示）
├── data/
│   └── tools.ts               # 工具注册表
├── utils/
│   └── clipboard.ts           # 剪贴板工具函数
├── styles/
│   └── design-tokens.css      # CSS 自定义属性
└── assets/
    └── ...                    # 静态资源
```

## 数据模型

### 工具分类（ToolCategory）

```typescript
type ToolCategory =
  | '编码转换'
  | '加密哈希'
  | '格式化'
  | '文本处理'
  | '正则工具'
  | '网络工具'
  | '颜色工具'
  | '日期时间'
  | 'CSS 工具'
  | 'API 工具'
```

### 工具元数据（ToolMeta）

```typescript
interface ToolMeta {
  /** 工具唯一 ID，同时用作 URL slug */
  id: string
  /** 显示名称 */
  name: string
  /** 一句话描述 */
  description: string
  /** 分类 */
  category: ToolCategory
  /** 图标标识 */
  icon: string
  /** 路由路径，由 id 派生 */
  path: string
}
```

### 首批工具列表（9 个）

| ID | 名称 | 分类 |
|----|------|------|
| `uuid-generator` | UUID 生成器（支持多版本） | 文本处理 |
| `hash-generator` | 哈希生成器（多算法 + 进制转换） | 加密哈希 |
| `random-string` | 随机字符串生成 | 文本处理 |
| `base64` | Base64 编解码 | 编码转换 |
| `datetime-converter` | 日期时间转换器 | 日期时间 |
| `url-encode` | URL 编解码 | 编码转换 |
| `jwt-parser` | JWT 解析器 | 编码转换 |
| `device-info` | 设备信息与 UserAgent | 网络工具 |
| `symmetric-crypto` | 对称加解密（主流算法） | 加密哈希 |

## 页面布局系统

### 全局 Layout（Layout.astro）

所有页面的 HTML 骨架：
- `<html lang="zh-CN">`
- `<head>` meta、favicon
- 引入 `design-tokens.css`
- `<body>` 内渲染 `<slot />`

### 工具页布局（ToolLayout.astro）

```
┌──────────────────────────────────────────┐
│  Header（logo + 搜索框 + 移动端汉堡菜单）  │
├────────┬─────────────────────────────────┤
│        │                                 │
│  侧边栏 │       工具内容区                 │
│  分类   │   <slot />                      │
│  导航   │                                 │
│        │                                 │
├────────┴─────────────────────────────────┤
│  Footer（版权 + 备案号预留）               │
└──────────────────────────────────────────┘
```

### 响应式断点

- **桌面端（≥1024px）**：侧边栏固定 240px 宽，常驻显示
- **平板端（768-1023px）**：侧边栏可折叠，汉堡菜单展开遮罩抽屉
- **移动端（<768px）**：侧边栏完全隐藏，汉堡菜单抽屉展开，搜索框移入抽屉内

### 首页布局

使用 ToolLayout，内容区渲染：
- 搜索栏 + 分类过滤标签（水平滚动）
- 工具卡片网格：CSS Grid auto-fill，`minmax(280px, 1fr)`

### 工具页内部布局

不强制统一，提供参考模式：
- 单输入单输出（如 Base64）
- 单输入多输出标签页（如哈希生成器同时输出多种算法结果）
- 复合面板（如对称加解密的配置项 + 结果）

## 组件设计

### Sidebar.vue（交互型，client:load）
- 从 `tools.ts` 按分类分组渲染导航
- 高亮当前页（通过 props 传入当前路径）
- 移动端 CSS 隐藏，汉堡菜单切换
- Escape 键关闭

### SearchBar.vue（交互型，client:load）
- 实时过滤（debounce 150ms）
- 匹配名称和描述（大小写不敏感）
- 桌面端在 Header，移动端在侧边栏抽屉内

### ToolCard.astro（纯展示）
- Props: `ToolMeta`
- 渲染图标 + 名称 + 描述，点击跳转

### ToolHeader.vue（交互型，client:idle）
- Props: `title`, `description`
- 包含"填入示例"按钮

### CopyButton.vue（交互型，client:idle）
- 接收目标文本内容
- 点击显示"已复制"反馈，1.5s 恢复

### ClearButton.vue（交互型，client:idle）
- 接收回调函数，重置输入/输出区域

### Footer.astro（纯展示）
- 版权信息
- 预留备案号位置（条件渲染）
- 固定在页面底部

## 设计令牌

### design-tokens.css

```css
:root {
  /* 颜色（具体色值在实现阶段选定，参考 DESIGN.md 暖色调中性色 + 单一强调色方向） */
  --color-surface:;
  --color-text:;
  --color-muted:;
  --color-border:;
  --color-accent:;
  --color-card:;
  --color-hover:;

  /* 字体（具体字体在实现阶段选定） */
  --font-sans:;
  --font-mono:;

  /* 间距 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* 断点 */
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
}
```

### 样式策略

- 全局：仅 `design-tokens.css` + CSS reset（内嵌在 Layout.astro）
- 组件级：Astro scoped `<style>`，引用 CSS 变量
- 工具页：各自 scoped style
- 响应式：CSS media query，不依赖 JS 断点检测
- 仅浅色主题，暗色模式后续按需添加

## 客户端交互约定

### Astro Islands + Vue 3 水合策略

交互型组件使用 Vue 3 `<script setup lang="ts">` + Composition API 开发。通过 Astro 的 `client:` 指令控制水合时机，仅交互组件加载 Vue 运行时，纯展示部分保持零 JS。

### 搜索交互

- 输入时 debounce 150ms 过滤 `tools.ts` 数据
- 过滤同时匹配工具名称和描述（大小写不敏感）
- 分类标签点击切换过滤，与搜索词可叠加

### 侧边栏交互

- 桌面端常驻，纯 CSS，不需要 JS
- 移动/平板端：汉堡按钮切换 `.is-open` class，CSS 控制滑入/遮罩动画
- Escape 键或点击遮罩关闭
- 打开时 trap focus（无障碍）

### 工具页通用交互

- 页面加载自动 focus 主输入框
- 输入即输出（`input` 事件实时计算，无需提交按钮）
- 错误输入用内联提示显示，不用 alert
- 复制按钮：`navigator.clipboard.writeText()`，fallback 用 `document.execCommand('copy')`

### 剪贴板工具函数（utils/clipboard.ts）

- 封装复制逻辑 + fallback
- 返回 `boolean` 表示成功/失败
