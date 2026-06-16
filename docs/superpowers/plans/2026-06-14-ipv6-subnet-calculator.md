# IPv6 子网计算器 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立工具 `/network/ipv6-cidr`，输入 IPv6 CIDR 计算网络地址、地址范围、地址总数与地址类型。

**Architecture:** 纯浏览器端 BigInt 运算。`src/utils/network/ipv6.ts` 提供解析/格式化/压缩展开/类型判定，`src/utils/network/cidr-v6.ts` 提供子网计算，`src/tools/network/Ipv6Cidr.vue` 渲染。对标既有 `ipv4.ts` + `cidr.ts` + `Ipv4Cidr.vue` 结构，IPv4 完全不动。

**Tech Stack:** TypeScript（strict）、Vue 3 `<script setup>`、BigInt、Vitest、Astro 路由。

**参考文档:** `docs/superpowers/specs/2026-06-14-ipv6-subnet-calculator-design.md`

**注意:** `docs/` 被 `.gitignore` 忽略，本计划文档与设计文档仅本地保留、不提交；代码任务正常 `git commit`。当前分支 `feature/ipv6-subnet`。

---

## 文件结构

| 文件 | 责任 | 动作 |
|------|------|------|
| `src/utils/network/ipv6.ts` | IPv6 解析/格式化/压缩展开/类型判定/CIDR 解析 | 🆕 创建 |
| `src/utils/network/cidr-v6.ts` | `SubnetInfoV6` 接口 + `calculateSubnetV6` | 🆕 创建 |
| `src/tests/network/ipv6.test.ts` | `ipv6.ts` 单元测试 | 🆕 创建 |
| `src/tests/network/cidr-v6.test.ts` | `calculateSubnetV6` 测试 | 🆕 创建 |
| `src/tools/network/Ipv6Cidr.vue` | 工具组件 | 🆕 创建 |
| `src/pages/network/ipv6-cidr.astro` | 路由 `/network/ipv6-cidr` | 🆕 创建 |
| `src/data/tools.ts` | 注册 `ipv6-cidr` + 更新 `ipv4-cidr` 的 `relatedToolIds` | ✏️ 修改 |
| `src/data/tool-faqs.ts` | 新增 `ipv6-cidr` FAQ | ✏️ 修改 |
| `docs/ROADMAP.md` | P0 条目调整 + 进度勾选 | ✏️ 修改 |

依赖顺序：`parseIPv6` → `formatIPv6` → `prefixToMaskV6` + `parseCIDRv6` → `getIPv6Type`（依赖 `prefixToMaskV6`）→ `calculateSubnetV6`（依赖全部）→ 组件 → 路由/注册 → FAQ → ROADMAP。

---

## Task 1: `parseIPv6` + `isValidIPv6`

**Files:**
- Create: `src/utils/network/ipv6.ts`
- Create: `src/tests/network/ipv6.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/network/ipv6.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { parseIPv6, isValidIPv6 } from '../../utils/network/ipv6';

describe('parseIPv6', () => {
  it('应正确解析标准 8 组地址', () => {
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0000')).toBe(0x20010db8000000000000000000000000n);
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(0x20010db8000000000000000000000001n);
  });

  it('应正确解析压缩格式（:: 在头/中/尾）', () => {
    expect(parseIPv6('2001:db8::')).toBe(0x20010db8000000000000000000000000n);
    expect(parseIPv6('::1')).toBe(1n);
    expect(parseIPv6('::')).toBe(0n);
    expect(parseIPv6('2001:db8::1')).toBe(0x20010db8000000000000000000000001n);
    expect(parseIPv6('1::')).toBe(0x10000000000000000000000000000000n);
  });

  it('应正确解析 IPv4 后缀映射', () => {
    // ::ffff:192.168.1.1 => ::ffff:c0a8:0101
    expect(parseIPv6('::ffff:192.168.1.1')).toBe(0x00000000000000000000ffffc0a80101n);
  });

  it('应大小写不敏感', () => {
    expect(parseIPv6('2001:DB8::')).toBe(parseIPv6('2001:db8::'));
  });

  it('应在组数错误（无 :: 且非 8 组）时抛出', () => {
    expect(() => parseIPv6('2001:db8:1:2:3:4:5')).toThrow('8 组');
  });

  it('应在多个 :: 时抛出', () => {
    expect(() => parseIPv6('2001::db8::1')).toThrow('只能出现一次');
  });

  it('应在 :: 展开超过 8 组时抛出', () => {
    expect(() => parseIPv6('1:2:3:4:5:6:7::8')).toThrow('8 组');
  });

  it('应在段超过 4 位时抛出', () => {
    expect(() => parseIPv6('2001:db8::12345')).toThrow('超过 4 位');
  });

  it('应在含非十六进制字符时抛出', () => {
    expect(() => parseIPv6('2001:db8::xyzz')).toThrow('不是合法的十六进制段');
  });

  it('应在输入为空时抛出', () => {
    expect(() => parseIPv6('')).toThrow('输入不能为空');
  });
});

describe('isValidIPv6', () => {
  it('合法地址返回 true', () => {
    expect(isValidIPv6('2001:db8::')).toBe(true);
    expect(isValidIPv6('::1')).toBe(true);
    expect(isValidIPv6('2001:0db8:0000:0000:0000:0000:0000:0000')).toBe(true);
  });

  it('非法地址返回 false', () => {
    expect(isValidIPv6('')).toBe(false);
    expect(isValidIPv6('2001:db8:1:2:3:4:5')).toBe(false);
    expect(isValidIPv6('2001::db8::1')).toBe(false);
    expect(isValidIPv6('2001:db8::xyzz')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: FAIL —— `Cannot find module '../../utils/network/ipv6'`

- [ ] **Step 3: 实现 `parseIPv6` 与 `isValidIPv6`**

创建 `src/utils/network/ipv6.ts`：

```ts
/**
 * IPv6 地址工具模块
 * 提供 128 位地址的解析、格式化、压缩展开、CIDR 解析与地址类型判定。
 * 内部统一使用 BigInt 表示 128 位地址（JS number 仅 53 位精度，无法承载）。
 */
import { parseIPv4 } from './ipv4';

/** 将 IPv6 字符串末尾的 IPv4 点分后缀转换为两组十六进制（如 192.168.1.1 → c0a8:101） */
function convertIPv4Suffix(str: string): string {
  const lastColon = str.lastIndexOf(':');
  if (lastColon === -1) {
    // 纯 IPv4 无冒号前缀，不是合法 IPv6 输入
    throw new Error('无效的 IPv6 地址格式：必须包含 8 组（或使用 :: 压缩）');
  }
  const ipv4Part = str.substring(lastColon + 1);
  const num = parseIPv4(ipv4Part); // 复用既有 IPv4 解析（抛出中文错误）
  const high = (num >>> 16) & 0xffff;
  const low = num & 0xffff;
  return `${str.substring(0, lastColon + 1)}${high.toString(16)}:${low.toString(16)}`;
}

/**
 * 将 IPv6 字符串解析为 BigInt
 * @param str - IPv6 地址，支持压缩（::）与 IPv4 后缀（::ffff:1.2.3.4）
 * @returns 128 位地址的 BigInt 表示
 * @throws 格式无效时抛出中文错误信息
 */
export function parseIPv6(str: string): bigint {
  if (!str || typeof str !== 'string') {
    throw new Error('无效的 IPv6 地址：输入不能为空');
  }

  let normalized = str.trim();

  // 处理 IPv4 后缀
  if (normalized.includes('.')) {
    normalized = convertIPv4Suffix(normalized);
  }

  let groups: string[];

  if (normalized.includes('::')) {
    const first = normalized.indexOf('::');
    const last = normalized.lastIndexOf('::');
    if (first !== last) {
      throw new Error('无效的 IPv6 地址格式：:: 只能出现一次');
    }
    const [left, right] = normalized.split('::');
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 1) {
      throw new Error('无效的 IPv6 地址格式：:: 展开后超过 8 组');
    }
    groups = [...leftGroups, ...Array<string>(missing).fill('0'), ...rightGroups];
  } else {
    groups = normalized.split(':');
  }

  if (groups.length !== 8) {
    throw new Error('无效的 IPv6 地址格式：必须包含 8 组（或使用 :: 压缩）');
  }

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      if (group.length > 4) {
        throw new Error(`无效的 IPv6 地址格式：段 "${group}" 超过 4 位`);
      }
      throw new Error(`无效的 IPv6 地址格式："${group}" 不是合法的十六进制段`);
    }
    result = (result << 16n) | BigInt(parseInt(group, 16));
  }

  return result;
}

/**
 * 验证字符串是否为合法 IPv6 地址
 * @param str - 待验证字符串
 * @returns 是否合法
 */
export function isValidIPv6(str: string): boolean {
  try {
    parseIPv6(str);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: PASS（全部用例）

- [ ] **Step 5: 提交**

```bash
git add src/utils/network/ipv6.ts src/tests/network/ipv6.test.ts
git commit -m "feat(network): add IPv6 parse and validate utilities"
```

---

## Task 2: `formatIPv6` + `expandIPv6` + `compressIPv6`

**Files:**
- Modify: `src/utils/network/ipv6.ts`
- Modify: `src/tests/network/ipv6.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `src/tests/network/ipv6.test.ts` 末尾追加：

```ts
import { formatIPv6, expandIPv6, compressIPv6 } from '../../utils/network/ipv6';

describe('formatIPv6', () => {
  it('expand 应输出 8 组 4 位十六进制（小写）', () => {
    expect(formatIPv6(0x20010db8000000000000000000000000n, 'expand')).toBe(
      '2001:0db8:0000:0000:0000:0000:0000:0000',
    );
    expect(formatIPv6(1n, 'expand')).toBe(
      '0000:0000:0000:0000:0000:0000:0000:0001',
    );
  });

  it('compress 应压缩最长连续零段', () => {
    expect(formatIPv6(0x20010db8000000000000000000000000n, 'compress')).toBe('2001:db8::');
    expect(formatIPv6(1n, 'compress')).toBe('::1');
    expect(formatIPv6(0n, 'compress')).toBe('::');
  });

  it('compress 不压缩单零段', () => {
    // 2001:db8:0:1:2:3:4:5 —— 仅 1 个连续零段，不压缩
    expect(formatIPv6(0x20010db8000000010002000300040005n, 'compress')).toBe('2001:db8:0:1:2:3:4:5');
  });

  it('compress 取第一个最长零段', () => {
    // 2001:0:0:1:0:0:0:1 —— 零段 [1-2](长2) 与 [4-6](长3)，压缩更长的一处
    expect(formatIPv6(0x20010000000000010000000000000001n, 'compress')).toBe('2001:0:0:1::1');
  });
});

describe('expandIPv6 / compressIPv6', () => {
  it('应形成往返：compress 后 expand 还原展开形式', () => {
    const cases = ['2001:db8::1', '::1', '::', 'fe80::1', '2001:0db8:0000:0000:0000:0000:0000:0001'];
    for (const c of cases) {
      const expanded = expandIPv6(c);
      expect(compressIPv6(expanded)).toBe(compressIPv6(c));
    }
  });

  it('compressIPv6 应规范化输入', () => {
    expect(compressIPv6('2001:0db8:0000:0000:0000:0000:0000:0000')).toBe('2001:db8::');
    expect(compressIPv6('2001:DB8::')).toBe('2001:db8::');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: FAIL —— `formatIPv6 is not a function`

- [ ] **Step 3: 实现 `formatIPv6` 等函数**

在 `src/utils/network/ipv6.ts` 末尾追加：

```ts
/**
 * 将 BigInt 格式化为 IPv6 字符串
 * @param num - 128 位地址 BigInt
 * @param mode - 'expand' 输出 8 组 4 位十六进制；'compress' 压缩最长连续零段为 ::
 * @returns IPv6 字符串（小写）
 */
export function formatIPv6(num: bigint, mode: 'compress' | 'expand'): string {
  const groups: number[] = [];
  for (let k = 0; k < 8; k++) {
    const shift = BigInt(7 - k) * 16n;
    groups.push(Number((num >> shift) & 0xFFFFn));
  }

  if (mode === 'expand') {
    return groups.map((g) => g.toString(16).padStart(4, '0')).join(':');
  }

  // compress：先去前导零
  const hex = groups.map((g) => g.toString(16));

  // 找最长连续全零段（长度 >= 2 才压缩，多段等长取第一处）
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (hex[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen < 2) {
    return hex.join(':');
  }

  const before = hex.slice(0, bestStart).join(':');
  const after = hex.slice(bestStart + bestLen).join(':');

  if (bestStart === 0 && bestLen === 8) return '::';
  if (bestStart === 0) return `::${after}`;
  if (bestStart + bestLen === 8) return `${before}::`;
  return `${before}::${after}`;
}

/** 将任意 IPv6 字符串展开为 8 组 4 位十六进制 */
export function expandIPv6(str: string): string {
  return formatIPv6(parseIPv6(str), 'expand');
}

/** 将任意 IPv6 字符串规范化为压缩格式 */
export function compressIPv6(str: string): string {
  return formatIPv6(parseIPv6(str), 'compress');
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: PASS

> 若 `compress 取第一个最长零段` 用例的字面量有问题（BigInt 字面量写法），按报错修正测试字面量；核心是验证「等长取第一处、更长优先」逻辑。

- [ ] **Step 5: 提交**

```bash
git add src/utils/network/ipv6.ts src/tests/network/ipv6.test.ts
git commit -m "feat(network): add IPv6 format/compress/expand utilities"
```

---

## Task 3: `prefixToMaskV6` + `parseCIDRv6`

**Files:**
- Modify: `src/utils/network/ipv6.ts`
- Modify: `src/tests/network/ipv6.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `src/tests/network/ipv6.test.ts` 末尾追加：

```ts
import { prefixToMaskV6, parseCIDRv6 } from '../../utils/network/ipv6';

describe('prefixToMaskV6', () => {
  it('应正确生成 128 位掩码', () => {
    expect(prefixToMaskV6(0)).toBe(0n);
    expect(prefixToMaskV6(128)).toBe((1n << 128n) - 1n);
    expect(prefixToMaskV6(64)).toBe(((1n << 64n) - 1n) << 64n);
    expect(prefixToMaskV6(32)).toBe(((1n << 32n) - 1n) << 96n);
  });

  it('应在越界时抛出', () => {
    expect(() => prefixToMaskV6(-1)).toThrow('0-128 之间');
    expect(() => prefixToMaskV6(129)).toThrow('0-128 之间');
  });
});

describe('parseCIDRv6', () => {
  it('应正确解析标准 IPv6 CIDR', () => {
    const r = parseCIDRv6('2001:db8::/32');
    expect(r.ip).toBe(parseIPv6('2001:db8::'));
    expect(r.prefix).toBe(32);
  });

  it('应正确解析边界前缀', () => {
    expect(parseCIDRv6('::/0').prefix).toBe(0);
    expect(parseCIDRv6('2001:db8::1/128').prefix).toBe(128);
  });

  it('应在缺少斜杠时抛出', () => {
    expect(() => parseCIDRv6('2001:db8::')).toThrow('缺少前缀长度');
  });

  it('应在前缀越界时抛出', () => {
    expect(() => parseCIDRv6('2001:db8::/129')).toThrow('0-128 之间');
  });

  it('应在前缀非数字时抛出', () => {
    expect(() => parseCIDRv6('2001:db8::/abc')).toThrow('不是合法');
  });

  it('应在地址部分非法时抛出', () => {
    expect(() => parseCIDRv6('not-an-ipv6/64')).toThrow();
  });

  it('应在输入为空时抛出', () => {
    expect(() => parseCIDRv6('')).toThrow('输入不能为空');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: FAIL —— `prefixToMaskV6 is not a function`

- [ ] **Step 3: 实现两个函数**

在 `src/utils/network/ipv6.ts` 末尾追加：

```ts
/**
 * 将 IPv6 前缀长度（0-128）转换为 128 位掩码
 * @param prefix - 前缀长度
 * @returns 前 prefix 位为 1、其余为 0 的 BigInt 掩码
 * @throws 前缀越界时抛出中文错误
 */
export function prefixToMaskV6(prefix: number): bigint {
  if (prefix < 0 || prefix > 128) {
    throw new Error(`CIDR 前缀长度必须在 0-128 之间，当前值：${prefix}`);
  }
  if (prefix === 0) return 0n;
  const allOnes = (1n << 128n) - 1n;
  return allOnes ^ ((1n << BigInt(128 - prefix)) - 1n);
}

/**
 * 解析 IPv6 CIDR 表示法
 * @param cidr - CIDR 字符串，如 "2001:db8::/32"
 * @returns 地址 BigInt 与前缀长度
 * @throws 格式无效时抛出中文错误
 */
export function parseCIDRv6(cidr: string): { ip: bigint; prefix: number } {
  if (!cidr || typeof cidr !== 'string') {
    throw new Error('无效的 CIDR 格式：输入不能为空');
  }
  const slashIndex = cidr.indexOf('/');
  if (slashIndex === -1) {
    throw new Error('无效的 CIDR 格式：缺少前缀长度（如 /64）');
  }
  const ipStr = cidr.substring(0, slashIndex);
  const prefixStr = cidr.substring(slashIndex + 1);
  if (!/^\d{1,3}$/.test(prefixStr)) {
    throw new Error(`无效的 CIDR 前缀长度："${prefixStr}" 不是合法的数值`);
  }
  const prefix = parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 128) {
    throw new Error(`CIDR 前缀长度必须在 0-128 之间，当前值：${prefix}`);
  }
  const ip = parseIPv6(ipStr);
  return { ip, prefix };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/network/ipv6.ts src/tests/network/ipv6.test.ts
git commit -m "feat(network): add IPv6 CIDR parse and mask utilities"
```

---

## Task 4: `getIPv6Type`

**Files:**
- Modify: `src/utils/network/ipv6.ts`
- Modify: `src/tests/network/ipv6.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `src/tests/network/ipv6.test.ts` 末尾追加：

```ts
import { getIPv6Type } from '../../utils/network/ipv6';

describe('getIPv6Type', () => {
  it('应识别未指定地址', () => {
    expect(getIPv6Type(parseIPv6('::')).label).toBe('未指定地址');
  });

  it('应识别环回地址', () => {
    expect(getIPv6Type(parseIPv6('::1')).label).toBe('环回地址');
  });

  it('应识别组播地址', () => {
    expect(getIPv6Type(parseIPv6('ff02::1')).label).toBe('组播地址');
  });

  it('应识别链路本地地址', () => {
    expect(getIPv6Type(parseIPv6('fe80::1')).label).toBe('链路本地地址');
  });

  it('应识别唯一本地地址（ULA）', () => {
    expect(getIPv6Type(parseIPv6('fd00::1')).label).toBe('唯一本地地址');
  });

  it('应识别文档地址（先于全球单播）', () => {
    expect(getIPv6Type(parseIPv6('2001:db8::1')).label).toBe('文档地址');
  });

  it('应识别全球单播地址', () => {
    expect(getIPv6Type(parseIPv6('2001:4860:4860::8888')).label).toBe('全球单播地址');
  });

  it('保留段应返回兜底', () => {
    expect(getIPv6Type(parseIPv6('4000::1')).label).toBe('保留 / 未分配');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: FAIL —— `getIPv6Type is not a function`

- [ ] **Step 3: 实现 `getIPv6Type`**

在 `src/utils/network/ipv6.ts` 末尾追加：

```ts
/** 地址类型判定结果 */
export interface IPv6Type {
  /** 类型标签 */
  label: string;
  /** 说明 */
  description: string;
}

/**
 * 判定 IPv6 地址类型（按 CIDR 前缀优先级匹配，先命中先返回）
 * @param num - 128 位地址 BigInt
 * @returns 类型标签与说明
 */
export function getIPv6Type(num: bigint): IPv6Type {
  if (num === 0n) return { label: '未指定地址', description: 'Unspecified，用作 Source 占位' };
  if (num === 1n) return { label: '环回地址', description: 'Loopback，本机自测' };

  const matches = (base: string, prefix: number): boolean => {
    const mask = prefixToMaskV6(prefix);
    return (num & mask) === (parseIPv6(base) & mask);
  };

  // 顺序重要：文档地址（/32）必须先于全球单播（/3）判定
  if (matches('ff00::', 8)) return { label: '组播地址', description: 'Multicast，一对多通信' };
  if (matches('fe80::', 10)) return { label: '链路本地地址', description: 'Link-Local，仅本网段有效' };
  if (matches('fc00::', 7)) return { label: '唯一本地地址', description: 'ULA，内网通信' };
  if (matches('2001:db8::', 32)) return { label: '文档地址', description: 'RFC 3849，示例专用' };
  if (matches('2000::', 3)) return { label: '全球单播地址', description: 'Global Unicast，公网可路由' };
  return { label: '保留 / 未分配', description: '尚未分配的特殊用途地址' };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/tests/network/ipv6.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/network/ipv6.ts src/tests/network/ipv6.test.ts
git commit -m "feat(network): add IPv6 address type classification"
```

---

## Task 5: `calculateSubnetV6` + `SubnetInfoV6`

**Files:**
- Create: `src/utils/network/cidr-v6.ts`
- Create: `src/tests/network/cidr-v6.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/network/cidr-v6.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { calculateSubnetV6 } from '../../utils/network/cidr-v6';

describe('calculateSubnetV6', () => {
  it('应正确计算 /32 文档子网', () => {
    const r = calculateSubnetV6('2001:db8::/32');
    expect(r.networkAddressCompressed).toBe('2001:db8::');
    expect(r.networkAddressExpanded).toBe('2001:0db8:0000:0000:0000:0000:0000:0000');
    expect(r.prefix).toBe(32);
    expect(r.firstAddressCompressed).toBe('2001:db8::');
    expect(r.lastAddressCompressed).toBe('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe('2⁹⁶ ≈ 7.9×10²⁸');
    expect(r.type.label).toBe('文档地址');
  });

  it('应正确计算 /128 单地址（首末相同）', () => {
    const r = calculateSubnetV6('2001:db8::1/128');
    expect(r.networkAddressCompressed).toBe('2001:db8::1');
    expect(r.firstAddressCompressed).toBe('2001:db8::1');
    expect(r.lastAddressCompressed).toBe('2001:db8::1');
    expect(r.totalAddresses).toBe('1');
  });

  it('应正确计算 /64 标准子网', () => {
    const r = calculateSubnetV6('2001:db8:abcd:12::/64');
    expect(r.networkAddressCompressed).toBe('2001:db8:abcd:12::');
    expect(r.firstAddressCompressed).toBe('2001:db8:abcd:12::');
    expect(r.lastAddressCompressed).toBe('2001:db8:abcd:12:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe('2⁶⁴ ≈ 1.8×10¹⁹');
  });

  it('应正确计算 /0 全部', () => {
    const r = calculateSubnetV6('::/0');
    expect(r.networkAddressCompressed).toBe('::');
    expect(r.lastAddressCompressed).toBe('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(r.totalAddresses).toBe('2¹²⁸ ≈ 3.4×10³⁸');
    expect(r.type.label).toBe('未指定地址');
  });

  it('应在 CIDR 无效时抛出', () => {
    expect(() => calculateSubnetV6('2001:db8::')).toThrow('缺少前缀长度');
    expect(() => calculateSubnetV6('2001:db8::/129')).toThrow('0-128 之间');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/tests/network/cidr-v6.test.ts`
Expected: FAIL —— `Cannot find module '../../utils/network/cidr-v6'`

- [ ] **Step 3: 实现 `cidr-v6.ts`**

创建 `src/utils/network/cidr-v6.ts`：

```ts
/**
 * IPv6 CIDR 子网计算模块
 * 根据 IPv6 CIDR 表示法计算网络地址、地址范围、地址总数与类型。
 */
import { parseIPv6, formatIPv6, getIPv6Type, parseCIDRv6, prefixToMaskV6, type IPv6Type } from './ipv6';

/** IPv6 子网计算结果 */
export interface SubnetInfoV6 {
  /** 网络地址（压缩格式） */
  networkAddressCompressed: string;
  /** 网络地址（展开格式） */
  networkAddressExpanded: string;
  /** CIDR 前缀长度 */
  prefix: number;
  /** 范围首地址（压缩格式，含网络地址） */
  firstAddressCompressed: string;
  /** 范围末地址（压缩格式） */
  lastAddressCompressed: string;
  /** 地址总数（幂 + 科学计数，如 "2⁹⁶ ≈ 7.9×10²⁸"） */
  totalAddresses: string;
  /** 地址类型 */
  type: IPv6Type;
}

/** 将上标数字转为 Unicode 上标字符 */
function toSuperscript(n: number): string {
  const map = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n)
    .split('')
    .map((d) => map[Number(d)])
    .join('');
}

/**
 * 将 2 的幂格式化为可读字符串
 * - exp === 0 → "1"
 * - exp <= 10 → 精确整数（如 "256"）
 * - 否则 → 幂 + 科学计数（如 "2⁹⁶ ≈ 7.9×10²⁸"）
 */
function formatPowerOfTwo(exp: number): string {
  if (exp === 0) return '1';
  if (exp <= 10) return `${1 << exp}`;
  const logVal = exp * Math.log10(2);
  const e = Math.floor(logVal);
  const mantissa = Math.pow(10, logVal - e);
  return `2${toSuperscript(exp)} ≈ ${mantissa.toFixed(1)}×10${toSuperscript(e)}`;
}

/**
 * 根据 IPv6 CIDR 计算子网信息
 * @param cidr - IPv6 CIDR 字符串，如 "2001:db8::/32"
 * @returns 子网信息
 * @throws CIDR 格式无效时抛出中文错误
 */
export function calculateSubnetV6(cidr: string): SubnetInfoV6 {
  const { ip, prefix } = parseCIDRv6(cidr);
  const mask = prefixToMaskV6(prefix);
  const wildcard = (1n << 128n) - 1n - mask;
  const network = ip & mask;
  const last = network | wildcard;

  return {
    networkAddressCompressed: formatIPv6(network, 'compress'),
    networkAddressExpanded: formatIPv6(network, 'expand'),
    prefix,
    // IPv6 无广播地址概念，范围含两端，不做「减 2」
    firstAddressCompressed: formatIPv6(network, 'compress'),
    lastAddressCompressed: formatIPv6(last, 'compress'),
    totalAddresses: formatPowerOfTwo(128 - prefix),
    type: getIPv6Type(network),
  };
}
```

> 注意：`wildcard` 用 `(1n << 128n) - 1n - mask` 而非 `^ mask`，避免 BigInt `~` 的符号位问题；两者数值等价。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm test src/tests/network/cidr-v6.test.ts`
Expected: PASS

- [ ] **Step 5: 运行全部测试，确认无回归**

Run: `pnpm test`
Expected: 全部 PASS（含既有 ipv4/cidr 等测试）

- [ ] **Step 6: 提交**

```bash
git add src/utils/network/cidr-v6.ts src/tests/network/cidr-v6.test.ts
git commit -m "feat(network): add IPv6 subnet calculator"
```

---

## Task 6: `Ipv6Cidr.vue` 组件

**Files:**
- Create: `src/tools/network/Ipv6Cidr.vue`

> 组件为 UI 层，项目无 Vue 组件单测惯例（对标 `Ipv4Cidr.vue` 无组件测试），本任务以实现 + 手动验证为准。

- [ ] **Step 1: 创建组件**

创建 `src/tools/network/Ipv6Cidr.vue`：

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';

import { calculateSubnetV6, type SubnetInfoV6 } from '../../utils/network/cidr-v6';

/** CIDR 输入值（默认示例，RFC 3849 文档前缀） */
const cidrInput = ref('2001:db8::/32');
/** 错误信息 */
const errorMsg = ref('');
/** 子网计算结果（根据默认值预计算） */
const subnetInfo = ref<SubnetInfoV6 | null>(calculateSubnetV6('2001:db8::/32'));

/** IPv6 前缀长度参考表 */
const prefixReference = [
  { prefix: 128, usage: '单主机', total: '1' },
  { prefix: 127, usage: '点对点链路（RFC 6164）', total: '2' },
  { prefix: 120, usage: '小型子网', total: '2⁸' },
  { prefix: 112, usage: '—', total: '2¹⁶' },
  { prefix: 96, usage: '—', total: '2³²' },
  { prefix: 64, usage: '标准终端子网', total: '2⁶⁴' },
  { prefix: 56, usage: '家庭 / 小站点分配', total: '2⁷²' },
  { prefix: 48, usage: '站点分配（RFC 推荐最小）', total: '2⁸⁰' },
  { prefix: 32, usage: 'ISP 端分配', total: '2⁹⁶' },
  { prefix: 0, usage: '全部', total: '2¹²⁸' },
];

/** 清空所有状态 */
function handleClear() {
  cidrInput.value = '';
  errorMsg.value = '';
  subnetInfo.value = null;
}

// 实时计算：监听输入变化
watch(cidrInput, (val) => {
  const trimmed = val.trim();
  if (!trimmed) {
    errorMsg.value = '';
    subnetInfo.value = null;
    return;
  }
  try {
    subnetInfo.value = calculateSubnetV6(trimmed);
    errorMsg.value = '';
  } catch (e) {
    subnetInfo.value = null;
    errorMsg.value = e instanceof Error ? e.message : '计算出错';
  }
});
</script>

<template>
  <div class="w-full max-w-3xl">
    <ToolHeader
      title="IPv6 子网计算器"
      description="输入 IPv6 地址和前缀长度，计算网络地址、地址范围、地址类型等信息"
      :show-example="false"
    />

    <!-- IPv6 CIDR 术语说明 -->
    <div class="mb-5 px-4 py-3 border border-border rounded-sm bg-card text-[0.8125rem] text-muted leading-relaxed">
      <p class="m-0 mb-2">
        <strong class="text-text">IPv6 CIDR</strong> 用
        <code class="px-1 py-0.5 bg-surface rounded-sm font-mono text-[0.75rem] text-accent">地址 / 前缀长度</code>
        表示子网，前缀长度范围 0–128。与 IPv4 不同，IPv6 没有广播地址，地址空间极大（/64 子网就有约 1.8×10¹⁹ 个地址）。
      </p>
      <p class="m-0">
        例如 <code class="px-1 py-0.5 bg-surface rounded-sm font-mono text-[0.75rem] text-accent">2001:db8::/32</code>
        表示前 32 位为网络前缀。IPv6 地址有压缩（<code class="font-mono">::</code> 省略连续零段）与展开（8 组 4 位十六进制）两种格式，本工具同时展示。
      </p>
    </div>

    <!-- 输入区域 -->
    <div class="flex items-start gap-3 mb-3">
      <div class="flex-1">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">IPv6 CIDR 地址</label>
        <input
          v-model="cidrInput"
          type="text"
          placeholder="输入 IPv6 CIDR，如 2001:db8::/32"
          class="w-full px-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 placeholder:font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
      <ClearButton @clear="handleClear" class="mt-6" />
    </div>

    <!-- 错误信息 -->
    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

    <!-- 计算结果 -->
    <div v-if="subnetInfo" class="flex flex-col gap-4">
      <!-- 主要信息网格 -->
      <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">网络地址（压缩）</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.networkAddressCompressed }}</span>
            <CopyButton :text="subnetInfo.networkAddressCompressed" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">网络地址（展开）</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.networkAddressExpanded }}</span>
            <CopyButton :text="subnetInfo.networkAddressExpanded" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">前缀长度</span>
          <span class="text-sm text-text font-mono">/{{ subnetInfo.prefix }}</span>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">地址总数</span>
          <span class="text-sm text-text font-mono break-all">{{ subnetInfo.totalAddresses }}</span>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">范围首地址</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.firstAddressCompressed }}</span>
            <CopyButton :text="subnetInfo.firstAddressCompressed" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">范围末地址</span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-text font-mono break-all">{{ subnetInfo.lastAddressCompressed }}</span>
            <CopyButton :text="subnetInfo.lastAddressCompressed" />
          </div>
        </div>

        <div class="flex flex-col gap-1 px-4 py-2.5 border border-border rounded-sm bg-card col-span-2 max-sm:col-span-1">
          <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">地址类型</span>
          <span class="text-sm text-text">
            <strong>{{ subnetInfo.type.label }}</strong>
            <span class="text-muted"> · {{ subnetInfo.type.description }}</span>
          </span>
        </div>
      </div>

      <!-- IPv6 前缀长度参考 -->
      <div class="border-t border-border pt-4">
        <h3 class="text-[0.8125rem] text-muted font-medium">IPv6 前缀长度参考</h3>
        <div class="pt-2">
          <div class="overflow-x-auto">
            <table class="w-full text-[0.8125rem]">
              <thead>
                <tr class="border-b border-border text-left">
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">前缀</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">典型用途</th>
                  <th class="px-3 py-2 text-[0.6875rem] font-semibold text-muted uppercase tracking-wide text-right">地址数</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in prefixReference"
                  :key="row.prefix"
                  :class="[
                    'border-b border-border last:border-b-0 transition-[background-color] duration-150',
                    row.prefix === subnetInfo.prefix ? 'bg-accent/5' : 'hover:bg-hover',
                  ]"
                >
                  <td class="px-3 py-1.5 font-mono font-semibold text-accent">/{{ row.prefix }}</td>
                  <td class="px-3 py-1.5 text-text">{{ row.usage }}</td>
                  <td class="px-3 py-1.5 text-right font-mono text-text">{{ row.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec astro check`
Expected: 无类型错误（若 `astro check` 较慢，可跳过此步，在 Task 9 构建时一并验证）

- [ ] **Step 3: 提交**

```bash
git add src/tools/network/Ipv6Cidr.vue
git commit -m "feat(network): add Ipv6Cidr calculator component"
```

---

## Task 7: 路由 + `tools.ts` 注册 + 双向 `relatedToolIds`

**Files:**
- Create: `src/pages/network/ipv6-cidr.astro`
- Modify: `src/data/tools.ts`

- [ ] **Step 1: 创建路由页面**

创建 `src/pages/network/ipv6-cidr.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import Ipv6Cidr from '../../tools/network/Ipv6Cidr.vue';
---

<ToolLayout toolId="network/ipv6-cidr">
  <Ipv6Cidr client:idle />
</ToolLayout>
```

- [ ] **Step 2: 在 `tools.ts` 注册新工具**

在 `src/data/tools.ts` 的 `tools` 数组中，紧跟 `ipv4-cidr` 条目（约 158 行 `relatedToolIds: ['ipv4-range-expander', 'device-info'],` 之后）插入：

```ts
  {
    id: 'ipv6-cidr',
    name: 'IPv6 子网计算器',
    description: '输入 IPv6 地址和前缀长度，计算网络地址、地址范围、地址总数与地址类型',
    seoDescription: '在线 IPv6 子网计算工具，输入 IPv6 CIDR 即可获取网络地址、地址范围、地址总数与地址类型识别，支持压缩与展开格式互转，纯浏览器端 BigInt 运算。',
    category: '网络工具',
    icon: '🛰️',
    path: '/network/ipv6-cidr',
    keywords: ['ipv6 子网计算', 'ipv6 cidr 计算', 'ipv6 地址类型', 'ipv6 前缀计算', 'ipv6 地址范围', 'ipv6 压缩展开'],
    relatedToolIds: ['ipv4-cidr', 'ipv4-range-expander'],
  },
```

- [ ] **Step 3: 更新 `ipv4-cidr` 的 `relatedToolIds` 双向关联**

在 `src/data/tools.ts` 中，将 `ipv4-cidr` 条目的：

```ts
    relatedToolIds: ['ipv4-range-expander', 'device-info'],
```

改为：

```ts
    relatedToolIds: ['ipv4-range-expander', 'ipv6-cidr', 'device-info'],
```

- [ ] **Step 4: 启动 dev 服务器手动验证**

Run: `pnpm dev`
打开 `http://localhost:4321/network/ipv6-cidr`，验证：
- 页面正常渲染，默认 `2001:db8::/32` 计算结果显示
- 输入 `fe80::1/64` → 地址类型显示「链路本地地址」
- 输入非法 `2001:db8::/129` → 显示「CIDR 前缀长度必须在 0-128 之间」
- 输入 `::1/128` → 地址总数显示「1」，首末地址相同
- 清空按钮工作正常
- 复制按钮工作正常（Toast 反馈）
- 侧边栏「网络工具」分类下出现「IPv6 子网计算器」
- `/network/ipv4-cidr` 页面底部相关工具出现「IPv6 子网计算器」

验证后 Ctrl+C 停止 dev。

- [ ] **Step 5: 提交**

```bash
git add src/pages/network/ipv6-cidr.astro src/data/tools.ts
git commit -m "feat(network): register ipv6-cidr tool and route"
```

---

## Task 8: FAQ

**Files:**
- Modify: `src/data/tool-faqs.ts`

- [ ] **Step 1: 追加 FAQ 条目**

在 `src/data/tool-faqs.ts` 的 `toolFaqs` 对象中，紧跟 `'qr-code-reader'` 条目后（约 224 行 `],` 之后）插入：

```ts
  'ipv6-cidr': [
    {
      question: 'IPv6 为什么没有广播地址？',
      answer: 'IPv6 用<strong>组播（Multicast）</strong>替代了 IPv4 的广播机制，不再需要专门的广播地址字段。需要一对多通信时使用组播地址（<code>ff00::/8</code>），因此 IPv6 子网里没有「广播地址」这一概念。',
    },
    {
      question: 'IPv6 的 /64 是什么意思？',
      answer: '<code>/64</code> 是 IPv6 最常见的子网前缀长度：前 64 位为网络前缀，后 64 位为接口标识符，是终端网段的标准长度。一个 /64 子网包含 <strong>2⁶⁴（约 1.8×10¹⁹）</strong>个地址，远超 IPv4 全部地址空间。',
    },
    {
      question: '为什么同时显示压缩和展开两种格式？',
      answer: '<strong>压缩格式</strong>（如 <code>2001:db8::</code>）省略连续零段，便于阅读和书写；<strong>展开格式</strong>（8 组 4 位十六进制，如 <code>2001:0db8:0000:...</code>）便于程序处理和逐段定位。两者各有用途，工具同时展示并可分别复制。',
    },
    {
      question: 'IPv6 地址有哪些类型？',
      answer: '常见类型：<strong>全球单播</strong>（<code>2000::/3</code>，公网可路由）、<strong>链路本地</strong>（<code>fe80::/10</code>，仅本网段）、<strong>唯一本地 ULA</strong>（<code>fc00::/7</code>，内网）、<strong>组播</strong>（<code>ff00::/8</code>）、<strong>环回</strong>（<code>::1</code>）。输入地址后工具会自动识别类型。',
    },
  ],
```

- [ ] **Step 2: 验证 FAQ 渲染**

Run: `pnpm dev`
打开 `http://localhost:4321/network/ipv6-cidr`，确认页面底部 FAQ 区域显示 4 条问答。Ctrl+C 停止。

- [ ] **Step 3: 提交**

```bash
git add src/data/tool-faqs.ts
git commit -m "docs: add ipv6-cidr FAQ"
```

---

## Task 9: ROADMAP 更新 + 最终构建验证

**Files:**
- Modify: `docs/ROADMAP.md`（本地，不提交）

- [ ] **Step 1: 更新 ROADMAP P0 表格**

在 `docs/ROADMAP.md` 的「三、阶段计划 → P0」表格中，将：

```
| IPv4 子网计算器 | 加 IPv6 模式 | 同页切换 v4/v6，支持 IPv6 CIDR 计算、地址范围与前缀展开。当前完全无 IPv6 支持 | 2d |
```

改为：

```
| IPv6 子网计算器（新增独立工具）✅ | 新增独立工具 | 新增独立工具 `/network/ipv6-cidr`：BigInt 解析、压缩/展开格式互转、地址类型识别、CIDR 计算、前缀参考表。IPv4 工具不动（brainstorming 后由「合并模式」改为独立工具，对标二维码识别器先例） | 2d ✅ |
```

- [ ] **Step 2: 更新 ROADMAP 进度追踪**

在「六、进度追踪 → P0」中，将：

```
- [ ] IPv4 子网计算器：增加 IPv6 模式
```

改为：

```
- [x] IPv6 子网计算器（新增独立工具 `/network/ipv6-cidr`）— 已完成（2026-06-14）。brainstorming 后由「IPv4 加 IPv6 模式」调整为独立工具，IPv4 完全不动
```

- [ ] **Step 3: 更新 ROADMAP 头部日期**

将 `docs/ROADMAP.md` 顶部的 `- **最后更新**：2026-06-13` 改为 `- **最后更新**：2026-06-14`。

- [ ] **Step 4: 运行全部测试**

Run: `pnpm test`
Expected: 全部 PASS

- [ ] **Step 5: 生产构建验证**

Run: `pnpm build`
Expected: 构建成功，无类型错误、无导入错误。

> 若构建报错，根据错误修复（常见：BigInt 字面量拼写、导入路径、Tailwind class 名）。

- [ ] **Step 6: 最终提交（如有未提交变更）**

ROADMAP 在 `docs/` 下被 gitignore，不提交。确认工作区：

Run: `git status`
Expected: `nothing to commit, working tree clean`（ROADMAP 变更被 ignore，不显示）

若仍有未提交的代码变更，按需补充提交。

---

## 完成标准

- [ ] `pnpm test` 全绿（含新增 `ipv6.test.ts` + `cidr-v6.test.ts`）
- [ ] `pnpm build` 成功
- [ ] `/network/ipv6-cidr` 页面交互正常（输入计算、类型识别、错误提示、清空、复制）
- [ ] `tools.ts` 注册完整，`ipv4-cidr` 双向关联已更新
- [ ] FAQ 4 条渲染正常
- [ ] ROADMAP 已更新（本地）
- [ ] 各 Task 提交记录清晰
