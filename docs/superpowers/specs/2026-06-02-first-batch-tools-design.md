# 首批工具功能补齐设计文档

**日期**: 2026-06-02
**状态**: 已确认

## 概述

补齐 8 个占位工具页面的功能实现。所有运算在浏览器端完成，优先使用成熟 npm 包，其余使用浏览器原生 API。遵循已有的 UUID 生成器的组件结构和交互模式。

## 依赖方案

安装 4 个 npm 包，总计约 12KB gzip：

| 包名 | 用途 | gzip 大小 |
|---|---|---|
| `js-md5` | MD5 哈希 | ~5 KB |
| `dayjs` | 日期时间处理 | ~3 KB |
| `jwt-decode` | JWT 解码 | ~0.6 KB |
| `bowser` | UserAgent 解析 | ~4.8 KB |

其余工具使用浏览器原生 API（Web Crypto API、btoa/atob、encodeURIComponent 等）。

```bash
pnpm add js-md5 dayjs jwt-decode bowser
```

## 文件结构

每个工具对应一个 Vue 组件，放在 `src/tools/` 目录下，与 UUID 生成器一致：

```
src/tools/
├── UuidGenerator.vue          # 已实现
├── HashGenerator.vue           # 新增
├── RandomStringGenerator.vue   # 新增
├── Base64Codec.vue             # 新增
├── DateTimeConverter.vue       # 新增
├── UrlEncodeCodec.vue          # 新增
├── JwtParser.vue               # 新增
├── DeviceInfo.vue              # 新增
└── SymmetricCrypto.vue         # 新增
```

## 工具详细设计

### 1. 哈希生成器 (HashGenerator.vue)

**分类**: 加密哈希
**依赖**: js-md5 + Web Crypto API

**功能**:
- 输入方式：文本输入框（支持多行）+ 文件上传按钮
- 算法选择：MD5、SHA-1、SHA-256、SHA-384、SHA-512
- 输出格式：小写 hex、大写 hex、Base64
- 支持同时选择多个算法，一次输入生成多种哈希结果
- 操作：生成、复制单条/全部结果、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 中部：文本输入区 + 文件上传区（二选一或共存）
- 控制区：算法多选（checkbox 组）+ 输出格式单选
- 底部：结果列表区（每个算法一行结果，各有复制按钮）

**实现要点**:
- SHA 系列用 `crypto.subtle.digest(algorithm, data)`
- MD5 用 `js-md5` 包
- 文件用 `FileReader.readAsArrayBuffer()` 获取数据后同样处理
- 文本先 `new TextEncoder().encode()` 转为 ArrayBuffer

### 2. 随机字符串生成 (RandomStringGenerator.vue)

**分类**: 文本处理
**依赖**: 无（原生 crypto.getRandomValues）

**功能**:
- 长度输入：数字输入框（1-10000，默认 32）
- 字符集选择（预设选项）：
  - 大写字母 + 小写字母 + 数字（默认）
  - 仅数字
  - 字母 + 数字 + 特殊字符
  - 自定义字符集
- 自定义字符集：手动输入允许的字符
- 生成数量：1-100 条
- 操作：生成、复制全部/单条、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 控制区：长度、字符集选择、自定义字符输入（条件显示）、数量
- 底部：结果列表区（类似 UUID 生成器的结果行）

**实现要点**:
- 使用 `crypto.getRandomValues(new Uint32Array(length))` 生成密码学安全的随机数
- 通过模运算映射到字符集

### 3. Base64 编解码 (Base64Codec.vue)

**分类**: 编码转换
**依赖**: 无（原生 btoa/atob + FileReader）

**功能**:
- 双向模式切换：编码 / 解码
- 编码模式：
  - 文本输入 → Base64 输出
  - 文件上传 → Base64 Data URL 输出
- 解码模式：
  - Base64 字符串 → 解码文本输出
  - Base64 Data URL → 解码文本输出
- 操作：执行、复制结果、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 模式切换：编码 / 解码 tab 切换
- 输入区：文本框 + 文件上传（编码模式显示）
- 底部：输出区 + 复制按钮

**实现要点**:
- 编码：`btoa(unescape(encodeURIComponent(text)))` 处理 Unicode
- 解码：`decodeURIComponent(escape(atob(base64)))` 处理 Unicode
- 文件编码：`FileReader.readAsDataURL(file)`

### 4. 日期时间转换器 (DateTimeConverter.vue)

**分类**: 日期时间
**依赖**: dayjs + utc + relativeTime + customParseFormat 插件

**功能**:
- 双向转换：
  - 时间戳 → 多种日期格式
  - 日期字符串 → 时间戳
- 时间戳输入：支持秒级和毫秒级，自动检测
- 日期选择：原生 datetime-local 输入 + 自定义格式字符串输入
- 输出同时展示多种格式：
  - ISO 8601
  - 本地日期时间
  - UTC 时间
  - 相对时间（"3 小时前"）
  - Unix 时间戳（秒/毫秒）
- 快捷操作："当前时间"按钮，一键填入当前时间戳
- 操作：执行、复制单项结果、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 输入区：时间戳输入 + 日期时间选择器，二选一模式
- 底部：多格式结果卡片列表，每个卡片有复制按钮

**实现要点**:
- dayjs 初始化时加载所需插件
- 自动检测时间戳是秒级还是毫秒级（13 位数字 = 毫秒）
- "当前时间"按钮获取 `Date.now()`

### 5. URL 编解码 (UrlEncodeCodec.vue)

**分类**: 编码转换
**依赖**: 无（原生 encodeURIComponent/encodeURI）

**功能**:
- 双向模式切换：编码 / 解码
- 编码模式下同时展示两种编码结果：
  - `encodeURIComponent`（组件级编码，编码所有特殊字符）
  - `encodeURI`（完整 URL 编码，保留 URL 结构字符如 `://`、`/`、`?`、`&`）
- 附带差异说明文本
- 操作：执行、复制结果、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 模式切换：编码 / 解码 tab
- 输入区：文本框
- 输出区：编码模式下展示两组结果 + 差异说明

**实现要点**:
- 编码：`encodeURIComponent(text)` 和 `encodeURI(text)` 各输出一行
- 解码：`decodeURIComponent(text)` 和 `decodeURI(text)` 各输出一行
- 用 try-catch 包裹，处理非法编码输入

### 6. JWT 解析器 (JwtParser.vue)

**分类**: 编码转换
**依赖**: jwt-decode

**功能**:
- 输入：JWT 文本框
- 输出三段式展示：
  - Header（算法、类型等）—— 红色标签
  - Payload（声明数据）—— 紫色标签
  - Signature（签名）—— 绿色标签
- Payload 标准声明中文说明：
  - `iat` → 签发时间
  - `exp` → 过期时间
  - `nbf` → 生效时间
  - `sub` → 主题
  - `iss` → 签发者
  - `aud` → 受众
- Token 过期状态判断（已过期/未过期/无过期时间）
- 操作：复制各段 JSON、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 输入区：文本框（粘贴 JWT）
- 状态提示：Token 有效/已过期/无效 Token
- 输出区：三段卡片（Header / Payload / Signature），Payload 中标准声明有中文注释
- 各段有"复制 JSON"按钮

**实现要点**:
- 使用 jwt-decode 的 `jwtDecode(token)` 获取 header 和 payload
- 手动 base64url 解码 header 段和 payload 段获取原始 JSON
- signature 段只展示原始 Base64URL 字符串
- 用 dayjs 将 iat/exp 等时间戳转为可读日期

### 7. 设备信息与 UserAgent (DeviceInfo.vue)

**分类**: 网络工具
**依赖**: bowser + 原生 navigator/screen API

**功能**:
- 自动检测并展示当前设备信息
- 展示内容：
  - 浏览器名称 + 版本（bowser 解析）
  - 渲染引擎（bowser 解析）
  - 操作系统 + 版本（bowser 解析）
  - 设备类型（桌面/移动/平板）
  - 屏幕分辨率 + 可用区域
  - 色深
  - 浏览器语言
  - Cookie 是否启用
  - 是否在线
  - UserAgent 原始字符串
- 自定义 UA 解析：输入框可手动输入 UA 字符串，展示解析结果
- 操作：复制设备信息 JSON、清空自定义输入

**交互布局**:
- 顶部：ToolHeader（无填入示例按钮，改为"刷新"按钮）
- 信息卡片网格：2 列展示各项信息
- 底部：自定义 UA 解析区域（输入框 + 解析结果）

**实现要点**:
- `Bowser.parse(navigator.userAgent)` 获取浏览器/引擎/OS 信息
- `window.screen` 获取分辨率、色深
- `navigator` 获取语言、cookieEnabled、onLine
- 自定义解析用 `Bowser.parse(customUA)`

### 8. 对称加解密 (SymmetricCrypto.vue)

**分类**: 加密哈希
**依赖**: 无（Web Crypto API: AES-GCM/CBC/CTR + PBKDF2）

**功能**:
- 算法选择：AES-GCM（默认）、AES-CBC、AES-CTR
- 密钥长度：128、192、256 位
- 操作模式切换：加密 / 解密
- 输入：
  - 加密模式：明文 + 密码
  - 解密模式：密文（Base64）+ 密码
- 密码通过 PBKDF2 派生为指定长度的密钥
- 输出：
  - 加密模式：密文（Base64 或 Hex 可选）
  - 解密模式：明文
- 高级选项（折叠面板）：显示 IV、Salt（可手动指定或自动生成）
- 操作：执行、复制结果、清空、填入示例

**交互布局**:
- 顶部：ToolHeader + 填入示例按钮
- 模式切换：加密 / 解密 tab
- 控制区：算法选择、密钥长度、输出格式
- 输入区：明文/密文 + 密码
- 高级选项：折叠面板（IV、Salt）
- 底部：结果输出 + 复制按钮

**实现要点**:
- 密钥派生：`crypto.subtle.deriveKey(PBKDF2, passwordKey, {name, length}, false, ['encrypt', 'decrypt'])`
- 加密：`crypto.subtle.encrypt({name, iv}, derivedKey, plaintext)`
- 解密：`crypto.subtle.decrypt({name, iv}, derivedKey, ciphertext)`
- PBKDF2 参数：salt 随机生成（16 字节），迭代次数 100000，hash: SHA-256
- 密码密钥：`crypto.subtle.importKey('raw', encodedPassword, 'PBKDF2', false, ['deriveKey'])`
- 输出格式：加密结果 = salt(16B) + iv(12/16B) + ciphertext，整体 Base64 编码

## 共性交互规范

所有工具遵循 CLAUDE.md 中的 Tool Page Requirements：

1. **输入格式检查 + 友好错误提示**：运算前验证输入，中文错误信息
2. **"清空"和"复制结果"按钮**：复用已有的 CopyButton 和 ClearButton 组件
3. **示例数据快捷填入**：通过 ToolHeader 的 @example 事件实现
4. **使用 ToolHeader/CopyButton/ClearButton 共享组件**

## 样式规范

- 复用 UUID 生成器的 CSS 变量和类名模式（field-label、field-input、field-select、btn-primary 等）
- 使用 design-tokens.css 变量
- 组件 scoped style
- 布局可根据工具特点灵活调整（如左右分栏、tab 切换等）
