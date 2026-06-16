# 编码转换工具优化设计

> 日期：2026-06-04
> 涉及工具：Base64 编解码、URL 编解码、JWT 解析器

---

## 一、Base64 编解码重构

### 问题
1. 文件上传用 `FileReader.readAsDataURL` 输出 Data URL，与文本编码用 `encodeBase64()` 输出纯 Base64 不一致
2. 切换编码→解码模式时 Data URL 被填入 input，解码后输出二进制乱码
3. 文件编码和解码不形成闭环（只能编码文件，不能 Base64→文件）

### 设计

#### 编码方向
- 文件上传改用 `FileReader.readAsArrayBuffer()` 替代 `readAsDataURL()`
- 将 `ArrayBuffer` 转为纯 Base64 字符串输出（不含 `data:mime;base64,` 前缀）
- 输出区上方显示元信息条：`📄 image/png · 24.5 KB`（MIME 类型 + 文件大小）
- 文本编码不变，仍用 `encodeBase64()` 输出纯 Base64

#### 解码方向
- 解码时先尝试 `decodeBase64()` 解码为文本
- 如果解码失败（二进制数据），自动检测内容类型：
  - 通过文件头魔数（magic bytes）判断 MIME 类型
  - 如果是图片（png/jpg/gif/svg/webp），在输出区直接预览显示
  - 其他二进制文件，显示元信息 + 提供「下载文件」按钮
- 如果文本解码成功，正常显示文本结果

#### 工具函数新增（`base64.ts`）
- `arrayBufferToBase64(buffer: ArrayBuffer): string`
- `base64ToArrayBuffer(base64: string): ArrayBuffer`
- `detectMimeType(base64: string): string | null`（基于文件头魔数）
- `formatFileSize(bytes: number): string`

#### 模式切换逻辑
- 编码→解码切换时，不再自动将 output 填入 input（避免文件编码后的 Base64 被当作文本解码），清空 input 让用户重新输入

---

## 二、URL 编解码优化

### 问题
1. `decodeUrl()` 错误信息逻辑缺陷：component 和 URI 各自独立 try-catch，但 error 字段共用会覆盖
2. 需要手动点击按钮执行，交互不够流畅
3. 两种编码方式说明不够直观
4. 缺少 URL 解析功能

### 设计

#### 1. 修复解码错误逻辑
- `decodeUrl()` 返回值改为：
  ```ts
  interface UrlDecodeResult {
    component: { value: string; error?: string };
    full: { value: string; error?: string };
  }
  ```
- 每种解码方式独立报告成功/失败
- UI 中每个结果卡片独立显示成功结果或错误信息

#### 2. 改为实时响应
- 输入框加 `@input` 事件，实时触发编码/解码
- 去掉手动执行按钮，只保留 `ClearButton` 和 `CopyButton`

#### 3. 优化两种编码的说明
- 在结果卡片下方增加交互式差异对照
- 差异高亮：`://` `/?` `=&` 等字符在 component 模式下被编码、URI 模式下保留
- 或加「查看差异」按钮，点击后展示两种结果的 diff 对比

#### 4. URL 解析功能
- **触发条件**：输入内容匹配 URL 正则（`/^https?:\/\//` 或包含 `://`）
- **展示方式**：结果区下方可展开/折叠的「URL 解析」卡片
  - 默认折叠，标题显示 `🔗 检测到 URL · 点击查看解析`
  - 展开后展示：Protocol、Host、Port、Pathname、Search（解析为 key-value 表格）、Hash
- 不影响编码/解码主功能，非 URL 输入时卡片不出现

---

## 三、JWT 解析器优化

### 问题
1. `base64UrlDecode` 未处理 Unicode，含中文 Payload 可能解析失败
2. 自定义声明展示不友好（无分隔、JSON 值未格式化）
3. 只做解析不支持签名验证
4. 测试未覆盖 `isTokenExpired` 等边界情况

### 设计

#### 1. 修复 Unicode 兼容
- `base64UrlDecode()` 中增加 `decodeURIComponent(escape(...))` 处理
- 与 `base64.ts` 中 `decodeBase64()` 保持一致的 Unicode 兼容方式

#### 2. 优化自定义声明展示
- 标准声明（iss/sub/exp 等）保持中文标签 + 格式化值
- 自定义声明区域增加分隔线 + 「自定义声明」小标题
- 自定义值为 JSON 对象/数组时，提供格式化展示 + 展开/折叠
- 自定义值为数字时，灰色提示 `可能是时间戳: YYYY-MM-DD HH:mm:ss`

#### 3. HMAC 签名验证
- Payload 结果区下方增加「验证签名」折叠面板
- 展开后包含：
  - Algorithm 下拉框：HS256 / HS384 / HS512（从 Header `alg` 字段自动读取，默认选中）
  - Secret 输入框：密码类型，带「显示/隐藏」切换
  - 验证按钮：用 Web Crypto API `crypto.subtle.importKey` + `crypto.subtle.sign` 计算
  - 验证结果：✅ 签名匹配 / ❌ 签名不匹配
- 使用浏览器原生 `crypto.subtle`，无需外部库
- HMAC 输入为 `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`

#### 4. 补充测试用例
- `isTokenExpired()`：已过期 / 未过期 / 无 exp 字段 / exp 为非数字
- Unicode Payload：含中文的 Payload 解析
- 非标准声明字段：邮箱、角色等自定义字段解析
- `base64UrlDecode` Unicode 处理：含 UTF-8 字符的 Base64URL 解码
