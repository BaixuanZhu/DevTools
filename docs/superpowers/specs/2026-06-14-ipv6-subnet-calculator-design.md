# IPv6 子网计算器 设计文档

> - **日期**：2026-06-14
> - **状态**：待实现
> - **关联 ROADMAP**：P0 · 现有工具深化（原「IPv4 子网计算器增加 IPv6 模式」，brainstorming 后调整为独立工具）
> - **分支**：`feature/ipv6-subnet`（基于 `main` @ `fda923f`）

---

## 一、背景与动机

ROADMAP P0 原计划「在 IPv4 子网计算器内增加 IPv6 模式，同页切换 v4/v6」。brainstorming 阶段评估后**调整为新增独立工具**，理由：

1. **职责差异**：IPv4 子网划分（32 位、广播/主机数）与 IPv6 地址规划（128 位、无广播、天文级主机数、压缩格式）是两套不同的心智模型，用户来两个页面的目的不同。参照 MEMORY 偏好 [[prefer-standalone-tools]] 与 ROADMAP 自己的先例（二维码识别器同样在 brainstorming 后由合并改为独立）。
2. **IPv4 工具零改动、风险最低**：`Ipv4Cidr.vue` 完全不动，纯新增。
3. **SEO 更精准**：独立 `/network/ipv6-cidr` 可针对「IPv6 子网计算」单独优化 keywords / FAQ。
4. **避免组件臃肿**：v4/v6 字段差异大（v6 无广播、需压缩/展开两种格式、参考表语义完全不同），合并会牺牲 v6 展示质量。

> **附带需求（暂不实现，也不登记 ROADMAP）**：用户提到 IPv4↔IPv6 表示转换（IPv4-mapped IPv6，如 `::ffff:192.168.1.1`）。此为另一独立工具，待真正要做时再单独 brainstorm，不在本设计范围。

---

## 二、关键技术决策

### 2.1 BigInt 表示 128 位地址

IPv6 地址 128 位，JS `number` 仅 53 位精度，**必须用 `BigInt`** 做解析与位运算。所有内部地址表示为 `BigInt`（范围 `0n` ~ `2^128n - 1n`）。

BigInt 位运算注意点：
- `&` `|` `^` `<<` `>>` 支持，但 BigInt 没有无符号概念，`~x = -(x+1n)`
- 构造 128 位掩码需显式截断：`mask = ((1n << 128n) - 1n) ^ ((1n << (128n - prefix)) - 1n)`，或等价的左移后按 128 位掩码 AND

### 2.2 地址格式：压缩与展开

IPv6 有两种规范表示，工具需同时支持并互转：
- **展开**：8 组 4 位十六进制，冒号分隔，小写。如 `2001:0db8:0000:0000:0000:0000:0000:0000`
- **压缩**：最长连续全零段用 `::` 替代（仅一处，且至少 2 个全零段才压缩）。如 `2001:db8::`

### 2.3 输入兼容性

`parseIPv6` 需接受以下合法输入并规范化：
- 标准 8 组：`2001:0db8:0000:0000:0000:0000:0000:0000`
- 压缩：`2001:db8::`
- IPv4 后缀映射：`::ffff:192.168.1.1`（RFC 4291，最后两组按 IPv4 点分十进制解读）
- 大小写不敏感（内部统一小写输出）

---

## 三、文件结构

对标 IPv4 的 `ipv4.ts` + `cidr.ts` 分离组织：

```
src/utils/network/
├── ipv4.ts            （既有，不动）
├── cidr.ts            （既有，不动）
├── ipv6.ts            🆕 基础工具：解析/格式化/压缩展开/类型判定/CIDR 解析
├── cidr-v6.ts         🆕 子网计算：SubnetInfoV6 + calculateSubnetV6
└── __tests__/
    └── ipv6.test.ts   🆕 单元测试（BigInt/压缩展开/类型判定逻辑密，必须测）

src/tools/network/
├── Ipv4Cidr.vue       （既有，不动）
└── Ipv6Cidr.vue       🆕 工具组件

src/pages/network/
└── ipv6-cidr.astro    🆕 路由 /network/ipv6-cidr
```

---

## 四、`ipv6.ts` 工具函数设计

### 4.1 函数清单

```ts
/** 将 IPv6 字符串解析为 BigInt（支持压缩与 IPv4 后缀） */
export function parseIPv6(str: string): bigint;

/** 将 BigInt 格式化为 IPv6 字符串 */
export function formatIPv6(num: bigint, mode: 'compress' | 'expand'): string;

/** 便捷封装：展开任意 IPv6 字符串 */
export function expandIPv6(str: string): string;

/** 便捷封装：压缩（规范化）任意 IPv6 字符串 */
export function compressIPv6(str: string): string;

/** 验证是否为合法 IPv6 地址 */
export function isValidIPv6(str: string): boolean;

/** 判定 IPv6 地址类型 */
export function getIPv6Type(num: bigint): { label: string; description: string };

/** 解析 IPv6 CIDR 表示法 */
export function parseCIDRv6(cidr: string): { ip: bigint; prefix: number };

/** 将前缀长度（0-128）转为 128 位掩码 BigInt */
export function prefixToMaskV6(prefix: number): bigint;
```

### 4.2 `parseIPv6` 算法

1. 校验非空字符串。
2. 处理 IPv4 后缀：若最后一组含 `.`，按 IPv4 解析为 2 组十六进制（`a.b.c.d` → `a.b` 与 `c.d` 两段），追加到段列表。复用既有 `parseIPv4`。
3. 处理 `::` 压缩：
   - `::` 最多出现 1 次，否则报错。
   - 按 `::` 分割为左右两段，各自按 `:` 拆分。
   - 缺失段数 = `8 - (左段数 + 右段数)`，填零。
4. 若无 `::`，必须恰好 8 组。
5. 每组 1–4 位十六进制，超长报错；`parseInt(group, 16)`，左移累加为 BigInt。
6. 返回 128 位 BigInt。

### 4.3 `formatIPv6` 算法

- 拆 8 组：`for i in 0..7: group = Number((num >> BigInt((7-i)*16)) & 0xFFFFn)`
- **expand**：每组 `.toString(16).padStart(4, '0')`，小写，冒号连接。
- **compress**：
  1. 先生成 expand 形式的 8 组（去掉前导零，即 `parseInt` 后 `toString(16)`）。
  2. 找最长连续全零段（值为 `0` 的组）。若最长 ≥ 2 组，用 `::` 替换该段；若有多处等长，取第一处。
  3. 全零地址 `::`（8 组全零）特判。
  4. 小写输出。

### 4.4 地址类型判定规则

按 CIDR 前缀自上而下匹配，先命中先返回。判定统一用掩码比较，避免手算位运算出错：

```
(num & prefixToMaskV6(p)) === (parseIPv6(base) & prefixToMaskV6(p))
```

| 前缀 `p` | 代表基址 `base` | label | description |
|:---:|---|---|---|
| 128 | `::` | 未指定地址 | Unspecified，用作 Source 占位 |
| 128 | `::1` | 环回地址 | Loopback，本机自测 |
| 8 | `ff00::` | 组播地址 | Multicast，一对多 |
| 10 | `fe80::` | 链路本地地址 | Link-Local，仅本网段 |
| 7 | `fc00::` | 唯一本地地址 | ULA，内网通信 |
| 32 | `2001:db8::` | 文档地址 | RFC 3849，示例专用 |
| 3 | `2000::` | 全球单播地址 | Global Unicast，公网可路由 |
| — | — | 保留 / 未分配 | 兜底返回 |

> 顺序很重要：`2001:db8::/32` 在 `2000::/3` 之前判定（文档地址是后者子集），否则会被全球单播吞掉。/128 的两行等价于 `num === 0n` / `num === 1n`，实现可直接用 BigInt 全等比较。

### 4.5 `parseCIDRv6` 与 `prefixToMaskV6`

- `parseCIDRv6`：对标 `parseCIDR`，按 `/` 分割；前缀须为数字且 0–128；地址部分调 `parseIPv6`。
- `prefixToMaskV6(prefix)`：`prefix === 0` 返回 `0n`；否则 `((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix)`。

---

## 五、`cidr-v6.ts` 子网计算

### 5.1 `SubnetInfoV6` 接口

```ts
/** IPv6 子网计算结果 */
export interface SubnetInfoV6 {
  /** 网络地址（压缩格式） */
  networkAddressCompressed: string;
  /** 网络地址（展开格式） */
  networkAddressExpanded: string;
  /** CIDR 前缀长度 */
  prefix: number;
  /** 范围首地址（压缩格式） */
  firstAddressCompressed: string;
  /** 范围末地址（压缩格式） */
  lastAddressCompressed: string;
  /** 地址总数（幂 + 科学计数，如 "2⁹⁶ ≈ 7.9×10²⁸"） */
  totalAddresses: string;
  /** 地址类型 */
  type: { label: string; description: string };
}
```

### 5.2 `calculateSubnetV6` 算法

1. `const { ip, prefix } = parseCIDRv6(cidr)`
2. `const mask = prefixToMaskV6(prefix)`
3. `const wildcard = ((1n << 128n) - 1n) ^ mask`
4. `const network = ip & mask`
5. `const last = network | wildcard`
6. 计算地址范围两端。**IPv6 无广播地址概念，不做「减 2」，范围含两端**（与 IPv4「IP 范围」展示一致）：
   - `firstAddressCompressed = formatIPv6(network, 'compress')`
   - `lastAddressCompressed = formatIPv6(last, 'compress')`
   - `/128` 时 `network === last`，首末相同（单主机）。
   - 说明：subnet-router anycast 地址（即 `network` 本身）在严格语义下有特殊用途，但作为「地址范围」展示含两端最直观，也避免引入 IPv4 那套网络/广播剔除逻辑造成混淆。
7. `totalAddresses`：`formatBigIntScientific(1n << BigInt(128 - prefix))`，输出如 `2⁹⁶ ≈ 7.9×10²⁸`。
8. `type = getIPv6Type(network)`

### 5.3 `formatBigIntScientific`（内部辅助）

将 BigInt 转为科学计数字符串：
- 精确值 = `1n << BigInt(128 - prefix)`（恒为 2 的幂）。
- 输出形如 `2^${exp} ≈ ${mantissa}×10^${e}`，指数用上标 Unicode（⁰¹²…⁹）。
- 十进制位数估算：`floor(exp * log10(2))`，尾数取 `2^(exp) / 10^(e)` 前两位四舍五入。
- 例如 `prefix=64` → `2⁶⁴ ≈ 1.8×10¹⁹`。

> 此函数放在 `cidr-v6.ts` 内部（仅子网计算用），不单独导出。

---

## 六、`Ipv6Cidr.vue` 组件设计

对标 `Ipv4Cidr.vue` 结构，去掉不适用的区（二进制表示），字段替换为 IPv6。

### 6.1 结构

```
ToolHeader「IPv6 子网计算器」
  description：输入 IPv6 地址和前缀长度，计算网络地址、地址范围、地址类型等信息
└─ 术语说明卡片（IPv6 CIDR 说明，含 2001:db8::/32 示例 + 压缩/展开说明）
└─ 输入区：CIDR 输入框（默认 2001:db8::/32）+ ClearButton
└─ 错误提示（中文，v-if errorMsg）
└─ 结果区（v-if subnetInfo）：
   ├─ 主要信息网格（max-sm:grid-cols-1，grid-cols-2）：
   │   ├─ 网络地址（压缩）      — CopyButton
   │   ├─ 网络地址（展开）      — CopyButton（break-all）
   │   ├─ 前缀长度              — 纯文本
   │   ├─ 范围首地址            — CopyButton
   │   ├─ 范围末地址            — CopyButton
   │   ├─ 地址总数              — 纯文本（2⁹⁶ ≈ 7.9×10²⁸）
   │   └─ 地址类型              — 标签 + 说明（如「全球单播地址 · Global Unicast」）
   └─ IPv6 前缀参考表（去掩码，加「典型用途」列，当前 prefix 行高亮）
```

### 6.2 状态与逻辑（`<script setup lang="ts">`）

- `cidrInput = ref('2001:db8::/32')`
- `errorMsg = ref('')`
- `subnetInfo = ref<SubnetInfoV6 | null>(calculateSubnetV6('2001:db8::/32'))`
- `watch(cidrInput)`：trim → 空 → 清空；否则 try `calculateSubnetV6`，catch 设 `errorMsg`。
- `handleClear()`：重置三项。
- 复用 `CopyButton`（已用 `useCopy`，无需 `label` prop）、`ClearButton`、`ToolHeader`。

### 6.3 前缀参考表数据

```ts
const prefixReference = [
  { prefix: 128, usage: '单主机',            total: '1' },
  { prefix: 127, usage: '点对点链路（RFC 6164）', total: '2' },
  { prefix: 120, usage: '小型子网',          total: '2⁸' },
  { prefix: 112, usage: '—',                 total: '2¹⁶' },
  { prefix: 96,  usage: '—',                 total: '2³²' },
  { prefix: 64,  usage: '标准终端子网',       total: '2⁶⁴' },
  { prefix: 56,  usage: '家庭/小站点分配',    total: '2⁷²' },
  { prefix: 48,  usage: '站点分配（RFC 推荐最小）', total: '2⁸⁰' },
  { prefix: 32,  usage: 'ISP 端分配',        total: '2⁹⁶' },
  { prefix: 0,   usage: '全部',              total: '2¹²⁸' },
];
```

表头三列：`前缀` / `典型用途` / `地址数`。当前 `subnetInfo.prefix` 行高亮（`bg-accent/5`，沿用 IPv4 表样式）。

### 6.4 水合策略

`client:idle`（工具组件默认，与 IPv4 一致；无即时响应需求）。

---

## 七、错误处理（中文，对标 IPv4 风格）

| 场景 | 文案 |
|------|------|
| 空输入 | 不显示错误，结果区清空 |
| 含非法十六进制字符 | `无效的 IPv6 地址格式："xxx" 不是合法的十六进制段` |
| 段超过 4 位 | `无效的 IPv6 地址格式：段 "xxxxx" 超过 4 位` |
| 组数错误（无 `::` 且非 8 组） | `无效的 IPv6 地址格式：必须包含 8 组（或使用 :: 压缩）` |
| 多个 `::` | `无效的 IPv6 地址格式：:: 只能出现一次` |
| `::` 展开后超过 8 组 | `无效的 IPv6 地址格式：:: 展开后超过 8 组` |
| 缺前缀 | `无效的 CIDR 格式：缺少前缀长度（如 /64）` |
| 前缀非数字 | `无效的 CIDR 前缀长度："xxx"` |
| 前缀超范围 | `CIDR 前缀长度必须在 0-128 之间，当前值：xxx` |

错误信息均通过 `try-catch` 捕获 `Error.message` 渲染（与 IPv4 一致）。

---

## 八、SEO / 注册 / FAQ

### 8.1 `src/data/tools.ts` 注册

- `id`: `ipv6-cidr`
- `category`: `network`
- 路由：`/network/ipv6-cidr`
- `name`: `IPv6 子网计算器`
- `description`: 简短一句话（侧边栏 / 卡片用）
- `seoDescription`: 120–160 字符，含「IPv6」「CIDR」「子网」「前缀」「地址范围」等关键词
- `keywords`: IPv6, CIDR, 子网计算, 前缀, 地址范围, IPv6 地址类型, 压缩展开
- `relatedToolIds`: `['ipv4-cidr']`
- `icon`: 沿用 network 分类图标约定

### 8.2 `src/data/tool-faqs.ts` 问答对（3–4 条）

- Q：IPv6 为什么没有广播地址？  
  A：IPv6 用组播（Multicast）替代了 IPv4 的广播，不再需要广播地址字段。
- Q：IPv6 的 /64 是什么意思？  
  A：/64 是 IPv6 最常见的子网前缀，前 64 位为网络前缀，后 64 位为接口标识符，是终端网段的标准长度。
- Q：地址总数 2⁶⁴ 是多少？  
  A：2⁶⁴ ≈ 1.8×10¹⁹，即约 1800 亿亿个地址，相当于每个 /64 子网可分配海量主机。
- Q：为什么同时显示压缩和展开两种格式？  
  A：压缩格式（如 `2001:db8::`）便于阅读和书写，展开格式（8 组 4 位十六进制）便于程序处理和精确定位，两者各有用途。

### 8.3 页面 SEO

- `<title>`: IPv6 子网计算器 - 在线 IPv6 CIDR 计算工具 | dev-tools
- meta description：取 `seoDescription`
- FAQ 渲染为 `<details>` + FAQPage 结构化数据（沿用项目既有 FAQ 组件机制）

---

## 九、测试计划

`src/utils/network/__tests__/ipv6.test.ts`，覆盖：

1. **`parseIPv6`**：
   - 标准 8 组、压缩（`::` 在头/中/尾）、IPv4 后缀（`::ffff:1.2.3.4`）、全零 `::`
   - 非法：空、多 `::`、组数错、非十六进制、段超 4 位
2. **`formatIPv6`**：
   - expand：已知 BigInt → 正确展开
   - compress：已知 BigInt → 正确压缩（含最长零段选择、全零、无零段不压缩）
   - 大小写：输出统一小写
3. **`expandIPv6` / `compressIPv6`**：字符串互转闭环
4. **`getIPv6Type`**：每个类型至少 1 个代表地址（`::`, `::1`, `ff02::1`, `fe80::1`, `fc00::1`, `2001:db8::`, `2001:4860::`, 保留段）
5. **`parseCIDRv6` / `prefixToMaskV6`**：合法 CIDR、前缀边界（0、64、128）、非法前缀
6. **`calculateSubnetV6`**：端到端，含 /128 单地址、/64 标准、/0 全部；验证字段完整性与格式

> 参照既有测试风格（`src/utils/format/__tests__/` 等）。测试用例描述用中文，与项目一致。

---

## 十、ROADMAP 更新

实现完成后，更新 `docs/ROADMAP.md`：

1. **三、P0 表格**：原「IPv4 子网计算器 | 加 IPv6 模式」行改为「IPv6 子网计算器（新增独立工具）| 新增独立工具 `/network/ipv6-cidr` | BigInt 解析、压缩/展开、地址类型判定、CIDR 计算、前缀参考表 | 2d」。
2. **六、进度追踪 P0**：
   - 原 `- [ ] IPv4 子网计算器：增加 IPv6 模式` 改为 `- [ ] IPv6 子网计算器（新增独立工具 /network/ipv6-cidr）`
   - 完成后勾选，注明实际工时与「改为独立工具」的调整说明。
3. 「最后更新」日期更新为实际完成日期。

---

## 十一、完成清单（对照 ROADMAP 通用清单）

- [ ] `src/data/tools.ts` 注册（完整 SEO 字段）
- [ ] `src/data/tool-faqs.ts` 添加 FAQ
- [ ] `/network/ipv6-cidr` 路由 + 复用 `ToolLayout.astro`
- [ ] 输入校验 + 中文错误提示
- [ ] 清空 / 复制结果按钮 + 默认值 `2001:db8::/32`
- [ ] 完整 SEO（title / description / keywords）
- [ ] `CustomEvent('toast')` 通知（复制反馈，复用 CopyButton）
- [ ] 安全规则：无 `eval/Function(string)`，正则包裹 try-catch
- [ ] `ipv6.test.ts` 单元测试通过
- [ ] 本地 `pnpm dev` 验证交互，`pnpm build` 构建无错
- [ ] ROADMAP 进度追踪勾选

---

## 十二、不在本设计范围（显式排除）

- IPv4↔IPv6 表示转换工具（IPv4-mapped IPv6）：用户提出但明确「先做子网计算器，不要随意新增」，待后续单独 brainstorm。
- IPv6 子网划分/枚举（把一个大前缀切成多个小子网）：地址空间过大，无实用价值，不做。
- IPv6 反向 DNS（PTR）记录生成：超出子网计算范畴。
