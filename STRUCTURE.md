# DevTools 项目文件结构

## 目录总览

```
dev-tools/
├── astro.config.mjs            # Astro 配置
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
│   ├── assets/                 # 资源文件（图片、字体等）
│   │
│   ├── components/             # 共享 UI 组件
│   │   ├── layout/             # 布局类组件
│   │   │   ├── Footer.astro
│   │   │   ├── Sidebar.vue
│   │   │   ├── ToolHeader.vue
│   │   │   └── ToolCard.astro
│   │   └── ui/                 # 交互类组件
│   │       ├── CopyButton.vue
│   │       ├── ClearButton.vue
│   │       └── SearchBar.vue
│   │
│   ├── data/                   # 数据集定义
│   │   └── tools.ts            # 工具注册表（ToolMeta 类型、分类、搜索）
│   │
│   ├── layouts/                # 页面布局
│   │   ├── Layout.astro        # 基础布局（HTML 骨架）
│   │   └── ToolLayout.astro    # 工具页布局（Header + Sidebar + Content）
│   │
│   ├── pages/                  # 页面路由（Astro 文件路由，保持扁平）
│   │   ├── index.astro         # 首页（工具列表仪表盘）
│   │   ├── base64.astro
│   │   ├── datetime-converter.astro
│   │   ├── device-info.astro
│   │   ├── hash-generator.astro
│   │   ├── jwt-parser.astro
│   │   ├── random-string.astro
│   │   ├── symmetric-crypto.astro
│   │   ├── url-encode.astro
│   │   └── uuid-generator.astro
│   │
│   ├── styles/                 # 样式
│   │   └── design-tokens.css   # CSS 自定义属性（颜色、字体、间距等）
│   │
│   ├── tools/                  # 工具组件（按分类划分子目录）
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
│   │   └── network/            # 网络工具
│   │       └── DeviceInfo.vue
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
│   │   └── shared/             # 跨分类共享工具
│   │       ├── array-buffer.ts # ArrayBuffer ↔ Base64 转换
│   │       └── clipboard.ts    # 剪贴板操作
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
│       └── datetime/
│           └── datetime.test.ts
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

## 目录设计原则

### 按业务功能分目录，而非按文件类型

**旧结构（按文件类型）：**
```
src/
├── tools/      ← 所有 .vue 工具组件堆在一起
├── utils/      ← 所有 .ts 工具函数堆在一起
├── pages/      ← 所有 .astro 页面堆在一起
└── tests/      ← 所有 .test.ts 堆在一起
```

**新结构（按工具分类）：**
```
src/
├── tools/
│   ├── encoding/   ← 编码转换类的 3 个工具
│   ├── crypto/     ← 加密哈希类的 2 个工具
│   └── ...
├── utils/
│   ├── encoding/   ← 编码转换类的 3 个工具函数
│   ├── crypto/     ← 加密哈希类的 2 个工具函数
│   └── ...
```

**收益：** 修改某个工具时，Agent 只需扫描对应分类子目录，而不是全量扫描。

### 分类映射

| 分类目录 | 中文名 | 包含工具 |
|---|---|---|
| `encoding/` | 编码转换 | Base64、URL 编解码、JWT 解析 |
| `crypto/` | 加密哈希 | 哈希生成、对称加解密 |
| `text/` | 文本处理 | UUID 生成、随机字符串 |
| `datetime/` | 日期时间 | 日期时间转换 |
| `network/` | 网络工具 | 设备信息 |

### Pages 目录为何保持扁平

Astro 使用文件路由：`src/pages/base64.astro` → `/base64`。如果改为 `src/pages/encoding/base64.astro`，URL 会变成 `/encoding/base64`，这是破坏性变更。考虑到当前工具数量不多（10 个），pages 保持扁平是务实的做法。

### 共享与专有工具函数的分离

- **工具专有函数**放在对应分类目录（如 `utils/encoding/base64.ts`）
- **跨分类共享函数**放在 `utils/shared/`（如 `array-buffer.ts` 被 `hash.ts` 和 `crypto.ts` 共同引用）

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Astro 6.x |
| UI 框架 | Vue 3 (Composition API) |
| 语言 | TypeScript |
| 样式 | CSS Custom Properties (Design Tokens) |
| 测试 | Vitest |
| 包管理 | pnpm |
