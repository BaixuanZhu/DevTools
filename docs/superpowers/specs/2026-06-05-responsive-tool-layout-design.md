# 工具页响应式布局优化设计文档

**日期:** 2026-06-05
**主题:** 工具页 PC 端水平/垂直自适应布局
**关联:** 为未来编辑器功能预留扩展性

---

## 1. 背景与目标

### 1.1 现状问题

当前所有工具页内容被限制在 `max-w-[720px]` 内，采用垂直堆叠布局（Input → Actions → Output）。在 1920px 宽的大屏显示器上：

- 内容区仅占屏幕左侧约 1/3，右侧大片空白
- Input 和 Output textarea 本可左右对照，却被迫上下排列
- 用户在编辑输入和查看输出之间需要频繁上下滚动视线

### 1.2 设计目标

- **PC 大屏（≥1920px）**: 适合的工具采用 Input | Output 左右并排（50/50），充分利用宽屏空间
- **PC 中小屏（<1920px）**: 统一垂直布局，与现有行为一致
- **手机/平板**: 统一垂直布局，不受任何影响
- **为编辑器功能预留扩展性**: ResponsiveWorkspace 组件需支持未来三栏、自定义比例等需求

---

## 2. 核心方案：ResponsiveWorkspace 组件

### 2.1 组件定位

`ResponsiveWorkspace.vue` 是工具页的**布局骨架组件**。业务组件只负责填充内容，不关心响应式布局逻辑。

### 2.2 Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `'vertical' \| 'horizontal'` | `'vertical'` | 布局模式。`horizontal` 在 ≥1920px 时自动左右并排 |
| `gap` | `string` | `'gap-6'` | 区域间距，默认 24px |
| `inputClass` | `string` | `''` | 输入区额外 class |
| `outputClass` | `string` | `''` | 输出区额外 class |

### 2.3 Slots（全部可选）

| Slot | 说明 |
|------|------|
| `input` | 输入区域（textarea、文件上传区、编辑器区等） |
| `output` | 输出区域（结果展示、textarea、预览区等） |
| `actions` | 操作按钮区域（编码/解码/清空/生成等） |

**关键约束**: 所有 slot 均为可选。任意 slot 为空时，布局自动适应，不报错、不塌陷、不留空白。

### 2.4 布局行为

#### mode="vertical"（默认）

```
┌─────────────────────────────┐
│  input（如有）               │
├─────────────────────────────┤
│  actions（如有）             │
├─────────────────────────────┤
│  output（如有）              │
└─────────────────────────────┘
```

- 与现有布局完全一致
- 内容区保持 `max-w-[720px]`
- 用于不适合水平布局的工具

#### mode="horizontal"（屏幕 ≥1920px）

```
┌─────────────────────────────────────────────────────┐
│          [清空] [编码] [解码]（actions，顶部居中）    │
├──────────────────────────┬──────────────────────────┤
│                          │                          │
│      input（左侧 50%）    │     output（右侧 50%）    │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
```

- Input / Output 左右各 50%，间距 `gap-6`（24px）
- Actions 横跨两栏顶部，水平居中；为空时该区域完全消失
- 两栏高度对齐（grid stretch），textarea 统一行数
- 内容区 `max-w-[1600px]`
- 使用 CSS Grid 实现：`grid-cols-1 min-w-[1920px]:grid-cols-2`

#### mode="horizontal"（屏幕 <1920px）

自动降级为与 `vertical` 模式一致的垂直布局。

---

## 3. 工具分类与改造计划

### 3.1 采用水平布局（mode="horizontal"）

这些工具的核心模式是**单输入 → 处理 → 单输出**，Input 与 Output 对等且同时存在：

| 工具 | 改造说明 |
|------|----------|
| **Base64 编解码** | Input textarea ↔ Output textarea，顶部 ModeTab 切换 Encode/Decode |
| **URL 编解码** | 同 Base64，结构一致 |
| **JWT 解析/编码** | Parse 模式：Input JWT ↔ 输出 Header/Payload/Signature 标签页；Encode 模式：左侧配置区 ↔ 右侧输出 JWT |
| **对称加密** | Encrypt 模式：明文输入 ↔ 密文输出；Decrypt 模式：密文输入 ↔ 明文输出 |

### 3.2 保持垂直布局（mode="vertical"）

这些工具不是简单"单输入→单输出"模式，水平并排反而割裂逻辑流或造成布局跳动：

| 工具 | 保持垂直的理由 |
|------|----------------|
| **Hash 生成器** | 一个输入产生 8+ 种算法结果，结果列表纵向展开更高效 |
| **UUID 生成器** | 设置面板 → 生成 → 结果列表，是配置流 |
| **随机字符串生成器** | 字符类型设置 → 生成 → 结果列表 |
| **日期时间转换器** | 包含实时时钟、时间戳↔日期、格式化等多个功能区，非单一对照 |
| **设备信息** | 展示型 + UA 模板库，无输入输出对照 |
| **HTTP 状态码** | 查询/参考表格型 |
| **IPv4 范围展开** | 两个输入字段（起始/结束 IP）→ CIDR 列表输出，非标准单输入单输出 |
| **IPv4 CIDR** | 输入 CIDR → 大量计算结果（网格+表格），纵向展开更合理 |
| **二维码生成器** | 内容输入 + 设置 + 预览 + 下载，是配置-预览流 |
| **非对称加密** | 有 generate/encrypt/decrypt/sign/verify 多种模式，generate 模式与 encrypt 模式布局差异大，模式切换会导致布局跳动 |
| **SM2 加密** | 同非对称加密，有 generate/encrypt/decrypt 模式，generate 模式下无 Output 区 |

---

## 4. 布局细节

### 4.1 操作按钮（Actions）

- **位置**: 横跨两栏顶部，水平居中
- **顺序**: 清空 → 主操作 → 次要操作
- **为空时**: 区域完全消失，不留空白，input/output 直接顶格

### 4.2 Textarea 高度

- **水平布局**: Input 和 Output 使用相同行数（如 `rows=12`），左右视觉平衡
- **垂直布局**: 保持现有行数（如 `rows=6`）
- **高度同步**: 使用 CSS Grid `align-items: stretch` 确保左右两栏高度一致

### 4.3 滚动策略

- **整体滚动**: 整个工作区随页面滚动，不采用区域独立滚动
- 理由: 独立滚动会导致两栏滚动不同步，编辑体验差

### 4.4 过渡动画

- 布局切换使用 `transition-all duration-300 ease-in-out`
- 使用 Tailwind Arbitrary Values: `min-w-[1920px]:` 前缀实现 1920px 断点

### 4.5 间距与分隔

- 两栏间距: `gap-6`（24px）
- 栏内间距: 保持现有 `gap-4`（16px）
- 不使用竖线分隔，依靠间距和卡片背景色自然区分
- 左右两栏保持现有的卡片式包裹（`border border-default rounded-lg bg-card`）

### 4.6 边缘情况

| 情况 | 处理 |
|------|------|
| Output 为空 | Output 区域显示占位提示，保持区域占位不塌陷 |
| 单栏内容超长 | 整体页面滚动，不截断 |
| 工具页未使用 ResponsiveWorkspace | 保持现有布局不变，不受影响 |
| 浏览器缩放 | 随窗口 resize 实时响应 |

---

## 5. 扩展性预留（为编辑器功能）

ResponsiveWorkspace 组件为未来编辑器功能预留以下扩展点：

| 扩展点 | 当前实现 | 未来扩展 |
|--------|----------|----------|
| **三栏模式** | 预留接口设计 | `mode="triple"`（如 文件树 \| 编辑区 \| 预览区） |
| **自定义比例** | 固定 50/50 | `ratio="40:60"` 等自定义宽度比例 |
| **区域可折叠** | 不涉及 | 支持某一栏折叠/展开（如编辑器侧边栏） |
| **Actions 位置** | 仅 `top-center` | 可扩展 `input-bottom`、`between`、`none` |

组件内部使用 CSS Grid 实现，从两栏扩展到三栏只需调整 `grid-template-columns`。

---

## 6. 实施清单

### 6.1 新增组件

- [ ] `src/components/layout/ResponsiveWorkspace.vue` — 响应式布局骨架组件

### 6.2 改造工具页（水平布局）

- [ ] `src/tools/encoding/Base64Codec.vue`
- [ ] `src/tools/encoding/UrlEncodeCodec.vue`
- [ ] `src/tools/encoding/JwtParser.vue`
- [ ] `src/tools/crypto/SymmetricCrypto.vue`

### 6.3 保持现状（垂直布局，无需改动）

- `src/tools/crypto/HashGenerator.vue`
- `src/tools/text/UuidGenerator.vue`
- `src/tools/text/RandomStringGenerator.vue`
- `src/tools/datetime/DateTimeConverter.vue`
- `src/tools/network/DeviceInfo.vue`
- `src/tools/network/HttpStatusCodes.vue`
- `src/tools/network/Ipv4RangeExpander.vue`
- `src/tools/network/Ipv4Cidr.vue`
- `src/tools/media/QrCodeGenerator.vue`
- `src/tools/crypto/AsymmetricCrypto.vue`
- `src/tools/crypto/SM2Crypto.vue`

### 6.4 Tailwind 断点确认

- Tailwind 默认 `2xl:` 前缀对应 `1536px`，不满足 1920px 需求
- 使用 Tailwind Arbitrary Values: `min-w-[1920px]:` 前缀实现 1920px 断点

---

## 7. 附录：断点策略速查

| 屏幕宽度 | 布局模式 | 内容区 max-width |
|---------|---------|-----------------|
| ≥ 1920px | 水平（Input \| Output 50/50） | 1600px |
| 1280px ~ 1919px | 垂直 | 占满可用宽度 |
| < 1280px | 垂直 | 占满可用宽度 |
| 手机（< 768px） | 垂直，padding 缩小 | 占满可用宽度 |
