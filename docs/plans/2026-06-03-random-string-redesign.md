# 随机字符串生成工具 — 重设计方案

日期：2026-06-03（2026-06-04 修正）

## 改动总览

| 改动 | 说明 |
|------|------|
| 字符集改为独立 Switch 勾选 | A-Z / a-z / 0-9 / 特殊字符 各自独立开关 |
| 输出格式统一 Radio（7 选 1） | 保持 / 全大写 / 全小写 / Hex / Base64 / 二进制 / 八进制 |
| 编码是对生成结果的格式转换 | 不是独立功能，而是 `transformOutput(str, format)` 对字符串做格式转换 |
| 调整输入范围 | 长度 1-2048，数量 1-500 |

> **2026-06-04 修正：** 去掉编码模式 Tab，大小写和编码合并为一个 7 选 1 Radio 组。编码是对生成字符串做格式转换（如 "ab" → Hex "61 62"），不是独立功能。

---

## 组件结构

```
RandomStringGenerator.vue
├── Tab 切换（字符集模式 | 编码模式）
├── 字符集模式面板
│   ├── [Switch] A-Z  [Switch] a-z  [Switch] 0-9
│   ├── [Switch] 特殊字符 + 输入框（默认 !@#$%^&*()_+-=[]{}|;:,.<>?/）
│   ├── [Radio] 大小写：保持 / 全大写 / 全小写（无字母时隐藏）
│   ├── 长度 [number]   数量 [number]（并排）
│   └── [Button] 生成 | 重新生成
├── 编码模式面板
│   ├── [Radio] 编码格式：Hex / Base64 / 二进制 / 八进制
│   ├── 随机字节数 [number]   生成数量 [number]（并排）
│   └── [Button] 生成随机字节 | 重新生成
└── 结果列表 + 复制（两个模式共用）
```

---

## 字符集模式详细设计

### Switch 控件（多选）

```
A-Z  ●━━━  (26个大写字母)     ← 默认开启
a-z  ●━━━  (26个小写字母)     ← 默认开启
0-9  ●━━━  (10个数字)         ← 默认开启
特殊 ○───  [!@#$%^&*()_+-=[]{}|;:,.<>?/]  ← 默认关闭，开启后输入框可编辑
```

- 至少勾选一项，否则生成按钮 disabled + 提示"请至少选择一种字符类型"
- 特殊字符输入框：Switch 关闭时灰色 disabled，开启后亮起可编辑
- 特殊字符输入框为空 + Switch 开启 → 按钮 disabled + 提示"请输入特殊字符"

### 大小写 Radio（单选）

```
大小写
○ 保持   ● 全大写   ○ 全小写
```

- 当 A-Z 和 a-z 都不勾选时 → 整行隐藏
- 默认值：保持
- 逻辑：先拼字符池 → 生成字符串 → 再 apply 大小写

### 输入范围

| 参数 | 范围 | 默认值 |
|------|------|--------|
| 长度 | 1 - 2048 | 16 |
| 数量 | 1 - 500 | 1 |

---

## 编码模式详细设计

### 编码格式 Radio（单选）

```
编码格式
● 十六进制(Hex)   ○ Base64   ○ 二进制   ○ 八进制
```

- Hex 为默认（最常用）

### 输入范围

| 参数 | 范围 | 默认值 |
|------|------|--------|
| 随机字节数 | 1 - 256 | 16 |
| 生成数量 | 1 - 100 | 1 |

### 输出格式

- **Hex**：每 2 字符空格分组，每 8 组换行 → `a3 f7 c2 d4 e5 b6 a1 f8` `next line...`
- **Base64**：标准编码，无换行，不带 padding 可配置
- **二进制**：每 8 位空格分隔 → `10100011 11110111 11000010...`
- **八进制**：每 3 位空格分隔 → `243 367 302 324...`

---

## 工具函数变更 (`src/utils/text/random-string.ts`)

### 新增类型

```typescript
export type EncodingFormat = 'hex' | 'base64' | 'binary' | 'octal';
export type CharType = 'uppercase' | 'lowercase' | 'digits' | 'special';
```

### 新增常量

```typescript
export const CHAR_SETS: Record<CharType, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?/',
};
export const AMBIGUOUS_CHARS = '1lILoO0'; // 预留
```

### 新增函数

- `resolveCharset(types: CharType[], customSpecial?: string): string` — 拼接字符池
- `generateRandomBytes(count: number): Uint8Array` — 生成 N 字节
- `encodeBytes(bytes: Uint8Array, format: EncodingFormat): string` — 编码输出
- `formatHex(str: string): string` — Hex 空格分组
- `formatBinary(str: string): string` — 二进制空格分组
- `formatOctal(str: string): string` — 八进制空格分组

### 保留函数

- `generateRandomString(length, charset)` — 不变
- `applyLetterCase(str, mode)` — 不变

### 移除

- `CharsetPreset` 类型（被 `CharType[]` 替代）
- `PRESET_CHARSETS` 常量（被 `CHAR_SETS` 替代）
- `resolveCharset(preset)` — 旧版逻辑
- `hasLetters(preset)` — 被组件内计算替代

---

## 边界情况处理

| 场景 | 处理 |
|------|------|
| 字符集模式零勾选 | 生成按钮 disabled，提示"请至少选择一种字符类型" |
| 特殊字符 Switch 开启但输入框为空 | 生成按钮 disabled，提示"请输入特殊字符" |
| 编码字节数 ≤ 0 | 输入框 red border，按钮 disabled |
| 参数非法导致旧结果存在 | 清空旧结果，不显示 |
| 两个模式独立状态 | 切换 Tab 保留各自结果，不互相影响 |

---

## 对现有测试的影响

- `random-string.test.ts` 需更新以适配新 API（`resolveCharset` → `resolveCharset(types, customSpecial?)`）
- 新增编码函数测试用例：
  - `generateRandomBytes` 字节数验证
  - `encodeBytes` hex/base64/binary/octal 格式验证
  - 边界值（0 字节、空数组）

---

## 不在此次范围内的功能

以下功能讨论过但暂不实施，列入 backlog：

- 排除相似字符（1/l/I/o/O/0）— 预留 `AMBIGUOUS_CHARS` 常量
- 格式模板（XXXX-XXXX-XXXX）
- 批量去重
- 导出文件
- 生成历史记录
