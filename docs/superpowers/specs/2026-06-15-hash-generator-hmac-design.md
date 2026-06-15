# 哈希生成器 HMAC 模式设计

> 在现有哈希生成器（`/crypto/hash-generator`）上扩展 HMAC 带密钥哈希能力，覆盖 API 签名与 Webhook 校验两大场景。

- **日期**：2026-06-15
- **状态**：已确认，待实现
- **关联**：`docs/ROADMAP.md` P0「哈希生成器：增加 HMAC 模式」
- **范围**：扩展现有工具，不新增页面

---

## 一、背景与目标

现有哈希生成器支持无密钥摘要（MD5/SHA-1/256/384/512），但缺少带密钥的 HMAC 能力。API 签名（如 AWS SigV4 内部的 HMAC-SHA256）和 Webhook 签名校验（GitHub/Stripe/微信支付等）都依赖 HMAC，是开发者高频刚需，目前全站无覆盖。

**目标**：在现有工具内追加 HMAC 区块，提供「生成」与「验证」两种能力，把 ROADMAP 点名的「API 签名 + Webhook 校验」做实。

## 二、范围

**做什么**

- HMAC 生成：消息 + 密钥 → HMAC 值（SHA-1/256/384/512）
- HMAC 验证：消息 + 密钥 + 待验签名 → 匹配/不匹配
- 密钥与待验签名支持 文本 / Hex / Base64 三种编码输入

**不做什么（排除项）**

- HMAC-MD5：MD5 已不安全，HMAC-MD5 无实际价值，Web Crypto 也不支持
- HMAC 文件签名：文件 HMAC 场景罕见，消息仅支持文本
- 各厂商专用签名格式解析（如 Stripe 的 `t=...,v1=...`）：仅做安全的通用归一化（去 `sha***=` 前缀 + 容忍大小写）
- 独立工具页：遵循 ROADMAP「与现有无密钥哈希并列」，在现有工具内扩展

## 三、算法层设计（`src/utils/crypto/hash.ts`，仅新增不改旧函数）

### 新增类型与常量

```ts
export const HMAC_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
export type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number];
export type KeyEncoding = 'text' | 'hex' | 'base64';
```

### 新增函数

- **`decodeToBytes(input: string, encoding: KeyEncoding): ArrayBuffer`**
  - `text` → `new TextEncoder().encode(input).buffer`
  - `hex` → 复用现有 `hexToArrayBuffer`
  - `base64` → `atob` 后转为 `ArrayBuffer`
  - 非法 hex/base64 抛错（由调用方 catch 后转中文提示）

- **`computeHmac(message, key, keyEncoding, algorithm): Promise<HashResult>`**
  - 复用现有 `HashResult`（hex / hexUpper / base64 三态）
  - `crypto.subtle.importKey('raw', decodeToBytes(key, keyEncoding), { name: 'HMAC', hash: algorithm }, false, ['sign'])`
  - `crypto.subtle.sign('HMAC', keyObj, new TextEncoder().encode(message))`
  - 复用现有 `arrayBufferToHex` / `arrayBufferToBase64` 组装 `HashResult`

- **`verifyHmac(message, key, keyEncoding, algorithm, signature, signatureEncoding): Promise<boolean>`**
  - 用与 `computeHmac` 相同方式算出 HMAC 字节
  - 对待验签名归一化：`trim()` + 去除 `sha256=` / `sha1=` / `sha384=` / `sha512=` 前缀（大小写不敏感）
  - 按 `signatureEncoding` 解码签名字节
  - 常量时间比较：逐字节异或累计，长度不等仍遍历完以免泄露长度时序，返回布尔

**设计理由**：HMAC 与无密钥哈希共用 `HashResult`，组件层结果渲染可复用；验证逻辑放算法层便于单测、避免 UI 混入比较。

## 四、组件层设计（`src/tools/crypto/HashGenerator.vue`，不动现有哈希区）

### 新增状态

| 状态 | 默认值 | 说明 |
|------|--------|------|
| `hmacMessage` | `"Hello, DevTools!"` | HMAC 消息 |
| `hmacKey` | `"secret"` | 密钥 |
| `hmacKeyEncoding` | `text` | 密钥编码 |
| `hmacAlgorithm` | `SHA-256` | 单选算法 |
| `hmacOutputFormat` | `hex` | 输出格式（hex / hexUpper / base64） |
| `hmacResult` | `null` | 生成的 `HashResult`（含三态） |
| `hmacError` | `''` | 错误信息 |
| `verifySignature` | `''` | 待验签名 |
| `verifySignatureEncoding` | `hex` | 签名编码 |
| `verifyMatch` | `null` | `'match'` / `'mismatch'` / `null`（未填签名） |
| `verifyError` | `''` | 验证错误 |

### UI 结构（HMAC 独立区块，分隔线 + 区块标题，追加在哈希区下方）

```
密钥  [textarea]                     密钥编码 [文本/Hex/Base64]
消息  [textarea]
算法  [SelectListbox 单选 SHA-256▾]   输出格式 [Hex/HEX/Base64]
─────────────────────────────────────────────
HMAC 值（常驻显示）  <code>  [复制]
─────────────────────────────────────────────
验证签名（可选）  [input]  签名编码 [Hex/Base64/文本]
                 → ✓ 匹配 / ✗ 不匹配
                                 [清空 HMAC 区]
```

### 交互

- `hmacResult` 存**完整 `HashResult`**（三态），模板按 `hmacOutputFormat` 直接取对应字段显示——**`hmacOutputFormat` 变化不触发重算**，纯展示切换
- `watch[hmacMessage, hmacKey, hmacKeyEncoding, hmacAlgorithm]` → 重算 `hmacResult`
- `watch[hmacResult, verifySignature, verifySignatureEncoding]` → 签名非空则 `verifyHmac` 比对设 `verifyMatch`；为空则置 `null`
- 比对在**字节层**（算法层 `verifyHmac`），与 `hmacOutputFormat` 无关——避免「显示格式影响验证」的混淆
- 算法用**单选** `SelectListbox`（HMAC 场景约定单一算法，验证必须单算法），与哈希区多选按钮有意区分
- HMAC 区自带独立清空 `handleHmacClear`（清密钥/消息/签名/结果/错误），两区块各自闭环
- 复用 `CopyButton` / `ClearButton` / `SelectListbox`，零新组件

### 错误提示（中文内联）

- 密钥 hex/base64 非法 → 「密钥不是合法的 Hex/Base64，请检查编码」
- 签名解码非法 → 「待验签名格式无法识别，请检查签名编码」

## 五、收尾项

| 项 | 改动 |
|----|------|
| `src/data/tools.ts` | 更新 `hash-generator`：`description` 加「及 HMAC 带密钥哈希」；`seoDescription` 补 HMAC / API 签名 / Webhook 校验（120–160 字符）；`keywords` 加 `hmac 在线` / `hmac sha256` / `webhook 签名验证` / `api 签名` |
| `src/data/tool-faqs.ts` | 加 3 条：①HMAC 与普通哈希区别 ②Webhook 签名为什么对不上（密钥编码 / 消息原样 / 前缀三大坑）③为何不支持 HMAC-MD5 |
| `src/tests/crypto/hash.test.ts` | RFC 4231 已知向量验 `computeHmac`；`verifyHmac` 匹配 / 不匹配 / 前缀容忍 / 大小写；`decodeToBytes` 三编码 |
| 安全 | 无 `eval/Function`，Web Crypto 原生 + 常量时间比较，符合 `CLAUDE.md` Security Rules |
| 零回归 | `hash.ts` 仅新增不改旧函数；哈希区 UI / 逻辑不动 |

## 六、文件改动清单

- `src/utils/crypto/hash.ts` — 新增 HMAC 类型 / 常量 / 3 个函数
- `src/tools/crypto/HashGenerator.vue` — 新增 HMAC 区块（状态 + UI + watch）
- `src/data/tools.ts` — 更新 hash-generator 元数据
- `src/data/tool-faqs.ts` — 加 3 条 HMAC FAQ
- `src/tests/crypto/hash.test.ts` — 加 HMAC 测试用例

## 七、验收清单

- [ ] HMAC 区块在哈希区下方独立呈现，两区块互不干扰
- [ ] 默认密钥 `secret` + 消息 `Hello, DevTools!` + SHA-256，打开即显示 HMAC 值
- [ ] 密钥 / 签名编码三选一切换后结果正确（文本 / Hex / Base64）
- [ ] 待验签名填入后实时显示 ✓ 匹配 / ✗ 不匹配；去 `sha256=` 前缀与大小写差异均容忍
- [ ] 密钥 / 签名格式非法时中文内联提示
- [ ] RFC 4231 测试向量通过
- [ ] `tools.ts` SEO 字段完整、`tool-faqs.ts` 3 条问答就位
- [ ] 现有哈希区功能零回归
