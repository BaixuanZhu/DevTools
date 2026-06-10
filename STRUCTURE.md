# DevTools 项目文件结构

## 目录总览

```
dev-tools/
├── astro.config.mjs            # Astro 配置（Vue + Tailwind + Sitemap）
├── tsconfig.json               # TypeScript 配置
├── vitest.config.ts            # 测试配置
├── package.json                # 项目依赖
├── pnpm-lock.yaml              # 依赖锁定
├── pnpm-workspace.yaml         # pnpm 工作区
│
├── README.md                   # 项目说明
├── DESIGN.md                   # 设计系统规范
├── PRODUCT.md                  # 产品定义
├── CLAUDE.md                   # AI 辅助开发指南
├── STRUCTURE.md                # 本文件，项目结构说明
│
├── public/                     # 静态资源（直接复制到构建输出）
│   ├── favicon.ico
│   └── favicon.svg
│
├── src/                        # 源代码
│   ├── components/             # 共享 UI 组件
│   │   ├── layout/             # 布局类组件
│   │   │   ├── Footer.astro    # 页脚（Astro + Tailwind）
│   │   │   ├── ToolHeader.vue  # 工具页标题（Vue 岛屿 + Tailwind）
│   │   │   └── ToolCard.astro  # 首页工具卡片（Astro + Tailwind）
│   │   ├── ui/                 # 交互类组件（Vue 岛屿 + Tailwind）
│   │   │   ├── CopyButton.vue
│   │   │   ├── ClearButton.vue
│   │   │   ├── ColorInput.vue       # 颜色选择器（原生 picker + hex 文本框联动）
│   │   │   ├── ModeTabGroup.vue     # Headless UI Tab 包装（模式切换）
│   │   │   ├── SelectListbox.vue    # Headless UI Listbox 包装（下拉选择）
│   │   │   ├── OptionRadioGroup.vue # Headless UI RadioGroup 包装（单选按钮组）
│   │   │   ├── ToggleSwitch.vue     # Headless UI Switch 包装（布尔开关）
│   │   └── seo/                # SEO 组件
│   │       └── SeoHead.astro   # Meta 标签（OG / description / canonical）
│   │
│   ├── data/                   # 数据集定义
│   │   └── tools.ts            # 工具注册表（ToolMeta 类型、分类 slug 映射、搜索）
│   │
│   ├── layouts/                # 页面布局
│   │   ├── Layout.astro        # 基础布局（HTML 骨架 + Alpine 初始化 + Tailwind）
│   │   └── ToolLayout.astro    # 工具页布局（Alpine Sidebar/Toast + Content）
│   │
│   ├── pages/                  # 页面路由（Astro 文件路由，二级目录结构）
│   │   ├── index.astro         # 首页（Hero + 搜索 + 分类筛选 + 工具卡片网格）
│   │   ├── [slug].astro        # 旧扁平 URL 重定向（meta refresh → 新二级路径）
│   │   ├── encoding/           # 编码转换
│   │   │   ├── base64.astro
│   │   │   ├── url-encode.astro
│   │   │   └── jwt-parser.astro
│   │   ├── crypto/             # 加密哈希
│   │   │   ├── hash-generator.astro
│   │   │   └── symmetric-crypto.astro
│   │   ├── text/               # 文本处理
│   │   │   ├── uuid-generator.astro
│   │   │   └── random-string.astro
│   │   ├── datetime/           # 日期时间
│   │   │   └── datetime-converter.astro
│   │   ├── network/            # 网络工具
│   │   │   └── device-info.astro
│   │   └── media/              # 媒体工具
│   │       └── qr-code-generator.astro
│   │
│   ├── styles/                 # 样式
│   │   └── global.css          # Tailwind v4 入口（@theme 设计令牌）
│   │
│   ├── tools/                  # 工具组件（按分类划分子目录，Vue 岛屿 + Tailwind）
│   │   ├── encoding/           # 编码转换
│   │   │   ├── Base64Codec.vue
│   │   │   ├── JwtParser.vue
│   │   │   └── UrlEncodeCodec.vue
│   │   ├── crypto/             # 加密哈希
│   │   │   ├── HashGenerator.vue
│   │   │   └── SymmetricCrypto.vue
│   │   ├── text/               # 文本处理
│   │   │   ├── RandomStringGenerator.vue
│   │   │   └── UuidGenerator.vue
│   │   ├── datetime/           # 日期时间
│   │   │   └── DateTimeConverter.vue
│   │   ├── network/            # 网络工具
│   │   │   └── DeviceInfo.vue
│   │   └── media/              # 媒体工具
│   │       └── QrCodeGenerator.vue
│   │
│   ├── utils/                  # 工具函数（按分类划分子目录）
│   │   ├── encoding/           # 编码转换相关
│   │   │   ├── base64.ts
│   │   │   ├── jwt.ts
│   │   │   └── url-codec.ts
│   │   ├── crypto/             # 加密哈希相关
│   │   │   ├── crypto.ts
│   │   │   └── hash.ts
│   │   ├── text/               # 文本处理相关
│   │   │   ├── random-string.ts
│   │   │   └── uuid-generator.ts
│   │   ├── datetime/           # 日期时间相关
│   │   │   └── datetime.ts
│   │   ├── shared/             # 跨分类共享工具
│   │   │   ├── array-buffer.ts # ArrayBuffer ↔ Base64 转换
│   │   │   └── clipboard.ts    # 剪贴板操作
│   │   └── media/              # 媒体工具
│   │       └── qr-code.ts
│   │
│   └── tests/                  # 单元测试（按分类划分子目录）
│       ├── encoding/
│       │   ├── base64.test.ts
│       │   ├── jwt.test.ts
│       │   └── url-codec.test.ts
│       ├── crypto/
│       │   ├── crypto.test.ts
│       │   └── hash.test.ts
│       ├── text/
│       │   ├── random-string.test.ts
│       │   └── uuid-generator.test.ts
│       ├── datetime/
│       │   └── datetime.test.ts
│       └── media/              # 媒体工具
│           └── qr-code.test.ts
│
├── docs/                       # 文档
│   └── ...
│
├── screenshots/                # 截图
│   └── ...
│
└── dist/                       # 构建输出（gitignore）
    └── ...
```

## 架构分层

### 全局壳层：Astro + Tailwind CSS + Alpine.js

Sidebar、Toast、Header 汉堡菜单等全局交互由 Alpine.js 驱动。
这些组件在 Astro 模板中直接用 `x-data`/`x-show`/`x-on` 等 Alpine 指令编写，
无需 Vue 运行时，首屏加载更轻量。

- **Sidebar**：Astro 服务端渲染导航 HTML，Alpine 控制移动端侧滑开关
- **SearchBar**：首页 Hero 区域内嵌搜索框，Alpine `x-model` + `@input.debounce.150ms` 防抖搜索
- **Toast**：Alpine store（`$store.toast`），Vue 岛屿通过 `document.dispatchEvent(new CustomEvent('toast', ...))` 触发
- **首页过滤**：Alpine 驱动分类切换和搜索结果过滤（单一 `x-data` 作用域，分类与搜索联动）

### C 端工具交互：Vue 岛屿 + Tailwind CSS + Headless UI

工具组件仍使用 Vue 3 岛屿（`client:idle`），通过 Tailwind utility class 编写样式。
Headless UI 提供无障碍交互组件，项目在 `src/components/ui/` 下封装了 5 个共享包装组件：

| 包装组件 | Headless UI 基础 | 用途 | 使用方 |
|---------|-----------------|------|--------|
| `ModeTabGroup.vue` | Tab | 模式切换（编码/解码、加密/解密等） | Base64Codec、UrlEncodeCodec、SymmetricCrypto、DateTimeConverter |
| `SelectListbox.vue` | Listbox | 下拉选择框 | SymmetricCrypto、HashGenerator |
| `OptionRadioGroup.vue` | RadioGroup | 按钮组式单选 | RandomStringGenerator、UuidGenerator |
| `ToggleSwitch.vue` | Switch | 布尔开关 | UuidGenerator |

包装组件内聚设计令牌样式，工具组件只传 props 和监听 events。

### SEO

- `SeoHead.astro` 组件统一注入 meta description / OG 标签 / canonical
- `@astrojs/sitemap` 自动生成 sitemap-index.xml

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Astro 6.x |
| 全局交互 | Alpine.js 3.x |
| C 端工具交互 | Vue 3 (Composition API) |
| 无障碍组件 | Headless UI (@headlessui/vue) |
| 样式 | Tailwind CSS v4（@theme 映射设计令牌） |
| SEO | @astrojs/sitemap + SeoHead.astro |
| 测试 | Vitest |
| 包管理 | pnpm |

## 路由结构

页面采用二级目录结构，URL 格式为 `/<category>/<tool>`：

| 路径 | 工具 |
|------|------|
| `/` | 首页 |
| `/encoding/base64` | Base64 编解码 |
| `/encoding/url-encode` | URL 编解码 |
| `/encoding/jwt-parser` | JWT 解析器 |
| `/crypto/hash-generator` | 哈希生成器 |
| `/crypto/symmetric-crypto` | 对称加解密 |
| `/text/uuid-generator` | UUID 生成器 |
| `/text/random-string` | 随机字符串生成 |
| `/datetime/datetime-converter` | 日期时间转换器 |
| `/network/device-info` | 设备信息 |
| `/media/qr-code-generator` | 二维码生成器 |

### 分类 slug 映射

| 中文名 | 英文 slug |
|--------|----------|
| 编码转换 | `encoding` |
| 加密哈希 | `crypto` |
| 格式化 | `format` |
| 文本处理 | `text` |
| 正则工具 | `regex` |
| 网络工具 | `network` |
| 颜色工具 | `color` |
| 日期时间 | `datetime` |
| CSS 工具 | `css` |
| API 工具 | `api` |
| 媒体工具 | `media` |

### 旧 URL 重定向

旧扁平路径（如 `/base64`）通过 `[slug].astro` 页面自动重定向到新二级路径（如 `/encoding/base64`），使用 `<meta http-equiv="refresh">` 实现零 JS 重定向。

## 共享与专有工具函数的分离

- **工具专有函数**放在对应分类目录（如 `utils/encoding/base64.ts`）
- **跨分类共享函数**放在 `utils/shared/`（如 `array-buffer.ts` 被 `hash.ts` 和 `crypto.ts` 共同引用）
