# 技术设计 — Redis 配置文件生成器

## 总体结构

```
src/
├── pages/devops/redis-config-generator.astro   # 路由：ToolLayout 包裹 + client:idle
├── tools/devops/RedisConfigGenerator.vue       # 工具主组件（页面级）
└── tools/devops/redis-config/                  # 私有目录（不上浮全局 components/）
    ├── params.ts            # 参数定义表（~55 参数：元数据 + 控件 + 计算公式 + 中文说明）
    ├── version.ts           # 版本序数与过滤逻辑（纯函数）
    ├── compute.ts           # 场景/硬件 → 参数默认值 的公式层（纯函数）
    ├── generate.ts          # conf 模板渲染（纯函数：params + ctx → 行数组）
    ├── sysctl.ts            # 系统参数建议区块的数据（非 redis.conf）
    ├── secret.ts            # 密码生成（crypto.getRandomValues → 24 字符 base64url）
    ├── __tests__/           # 单测：compute / version / generate
    └── components/          # 私有子组件
        ├── ControlPanel.vue     # 左栏：模式/硬件/场景/版本/持久化/监听范围/端口/访问密码（快速配置区）
        ├── ParamRow.vue         # 参数行：名称 + 控件 + 推荐快捷选项 + 版本徽章
        ├── NumberField.vue      # 数值输入框 + 推荐快捷选项 chips
        ├── ConfigPreview.vue    # 右栏：行号预览 + 变动高亮
        └── SysctlPanel.vue      # 系统参数建议（可折叠）
```

分层原则：**数据与计算全部是可单测的纯函数**（params/version/compute/generate），Vue 组件只做输入绑定与展示；这样 MySQL/PG 版后续复用的是"引擎模式"而非具体代码。

## 数据模型

```ts
/** 参数控件类型 */
type ControlKind = 'select' | 'number' | 'switch' | 'multi-select' | 'text';

/** 参数版本标注：pre-7 统一 'pre-7'，UI 不显示徽章；7 系内精确到 minor */
type RedisVersion = 'pre-7' | '7.0' | '7.2' | '7.4' | '8.0' | '8.2' | '8.4';

interface ConfigParam {
  key: string;                       // 'maxmemory'
  group: ParamGroup;                 // 分组 id（11 组）
  introducedIn: RedisVersion;        // 引入版本
  deprecatedIn?: RedisVersion;       // 标记废弃的版本（7 系内才标注）
  replacedBy?: string;               // 替代参数 key
  docUrl: string;                    // 官方文档锚点（可溯源）
  control: ControlKind;
  options?: ParamOption[];           // 枚举值 + 中文说明（select/multi-select 用）
  min?: number; max?: number; step?: number;   // number 控件用
  /** 推荐范围（保守/推荐/激进）：数值项派生快捷选项 chips，字符串项显示参考文案提示 */
  range?: { conservative: number|string; recommended: number|string; aggressive: number|string; unit?: string };
  /** 由硬件/场景计算默认值；返回 null 表示该上下文下参数不适用 */
  compute: (ctx: GenerateContext) => string | number | boolean | string[] | null;
  /** 为什么是这个值的中文说明（面板展示用，不写入 conf） */
  comment: string;
}

interface GenerateContext {
  mode: 'standalone' | 'replica';    // 部署模式
  cpuCores: number;
  memoryGB: number;
  diskType: 'hdd' | 'ssd' | 'nvme';
  scenario: 'cache' | 'session' | 'queue' | 'mixed';
  persistence: 'rdb' | 'aof' | 'both' | 'off';
  version: '7.0' | '7.2' | '7.4' | '8.0' | '8.2' | '8.4';
  concurrency: number;               // 并发连接预估
  masterAddr?: string;               // 主从模式必填
  listenScope: 'all' | 'loopback' | 'intranet';  // 监听范围（驱动 bind 推荐值）
  bindIp: string;                    // 仅内网监听时的绑定 IP
  /** 用户覆盖值：key → value；compute 只在无覆盖时生效 */
  overrides: Record<string, string | number | boolean | string[]>;
}
```

**版本比较**：`version.ts` 里 `VERSION_ORDER = { 'pre-7': -1, '7.0': 0, '7.2': 1, '7.4': 2, '8.0': 3, '8.2': 4, '8.4': 5 }`（8.2/8.4 为 2026-08-29 二轮反馈扩容，官方 release notes 核对无本工具参数集的注册表增删，行为同 8.0）；
`isAvailable(param, version) = ORDER[param.introducedIn] <= ORDER[version] && !(param.deprecatedIn && ORDER[param.deprecatedIn] <= ORDER[version])`。
已废弃但被选中的旧名参数：面板显示 `deprecatedIn 废弃 → replacedBy`，渲染时不写入 conf。

## conf 渲染引擎（generate.ts）

`generateConf(params, ctx): ConfLine[]`，`ConfLine = { type: 'comment' | 'directive' | 'blank'; text: string; paramKey?: string }`。

- 分组顺序固定（网络 → 内存 → RDB → AOF → 编码 → 复制 → 安全 → 缓冲 → 观测 → Lazy Free → 键空间），组间空行 + 组标题注释。
- 每个参数仅输出 `key value` 指令行，不输出逐参数注释（面板已带中文说明，产物保持纯净，2026-08-29 用户反馈）；值来自 `overrides` 优先、否则 `compute(ctx)`。
- `compute` 返回 null 的参数（如单机模式的复制组）整段跳过。
- 渲染函数不感知 Vue，输出行数组由 `ConfigPreview.vue` 展示、由下载/复制序列化——同一份数据两条消费路径，保证"所见即所得"。

## 关键公式（compute.ts，均在浏览器瞬时完成）

- `maxmemory`：内存 × 系数（持久化开启 0.6 / 纯缓存关闭持久化 0.75），向下取整到 GB；注释说明 fork COW 余量。
- `maxmemory-policy`：场景映射 cache→allkeys-lru，session→allkeys-lru，queue→noeviction（注释防丢数据），mixed→allkeys-lru。
- `maxclients`：`min(concurrency × 1.5 向上取整, 系统提示值)`，注释提示与 nofile 联动。
- `io-threads`：cpuCores ≥ 4 时 2，≥ 8 时 4，否则 1；`io-threads-do-reads` 恒 no（官方注释"读线程通常无收益"）。
- `appendonly` / `appendfsync`：persistence 映射（both/aof → yes + everysec；off → no）。
- `bind`：监听范围映射——loopback → `127.0.0.1 -::1`；intranet → `bindIp.trim()`（未填暂不输出，面板必填校验兜底）；all → 不输出 bind 行（等价监听所有网卡，须配 requirepass 才能安全远程）。
- `save`：场景映射（cache 稀疏 `300 1 60 10000` 之类；queue/session 密集）；persistence=off 时返回 `""`，conf 输出 `save ""` 显式关闭快照——省略该行时编译期默认阈值仍生效。`save` 下拉的"关闭自动快照"选项值同为字面 `""`；**所有 select 选项值禁止空串**（reka-ui SelectItem 空串 value 抛错，曾导致 RDB 快照组面板不可交互，2026-08-29 二轮反馈修复）。
- `auto-aof-rewrite-min-size`：memoryGB ≥ 16 → 512mb，否则 64mb。
- `timeout`：session → 300，其余 0。
- `tcp-backlog`：concurrency ≥ 2000 → 2048（并联动 sysctl somaxconn 提示），否则 511。
- `repl-backlog-size`：memoryGB ≥ 8 → 64mb，否则 16mb。
- `notify-keyspace-events`：session → `Ex`，其余空（注释按键位说明）。
- 密码（requirepass/masterauth）：`crypto.getRandomValues` 生成 24 字符 base64url，纯本地；生成函数提取到 `redis-config/secret.ts`（`generatePassword()`，ParamRow 与主组件共用）。主组件挂载时若 overrides.requirepass 未设置则自动生成一次写入，保证默认 conf 含 `requirepass <密码>`（2026-08-29 二轮反馈）；"生成"按钮仍可重新生成，数据层 createDefaultContext 保持确定性不掺随机值。

UI 默认画像：2 核 / 4GB / SSD / 缓存 / RDB+AOF 混合 / 7.4 / 并发 500 / 单机——打开即生成合法 conf（验收要求"打开即用"）。

## 组件与交互

- `RedisConfigGenerator.vue`：持有 `GenerateContext` reactive 状态（`overrides` 用 `Record`），computed 驱动 `generateConf`；上下分两栏（`md:` 以下纵向堆叠）。
- 布局三区块：`ControlPanel` → 产物区（`ConfigPreview` + `SysctlPanel` + 免责声明）→ 分组参数单卡清单。移动端纵向排列（flex-col），预览紧随快速配置、在分组清单之前（改完即见）；桌面 `lg:grid-cols-2`：左列 = 快速配置（r1）+ 分组清单（r2），右列产物区 `lg:row-span-2` + `lg:sticky lg:top-0`。分组合并为单卡 `divide-y` 行式清单（首末行 hover 圆角），全部默认收起——推荐值打开即可用，展开仅为微调（2026-08-29 三/四轮反馈）。
- 控件直接用 shadcn-vue 原语（Select / Switch / Checkbox / Input / Button / Collapsible）；数值控件用私有 `NumberField`（数字输入框 + 推荐快捷选项 chips）；推荐项在下拉内加"推荐"标记。下拉选项文本对齐由共享 `SelectListbox` 的 `itemAlign` 控制（left/center/right，默认 left——2026-08-29 二轮反馈前固定居中，属全站共享组件的向后兼容扩展）。
- 版本徽章 / 废弃提示用轻量 span + tooltip（原生 title 或简单 CSS，不引新依赖）。
- 状态不进全局 store（无跨岛共享需求），刷新即重置——配置生成器无持久化必要。

## 注册与 SEO

- `tools.ts`：`id: 'redis-config-generator'`，category devops（分类中文名 `'开发与运维'`，对照现有条目），path `/devops/redis-config-generator`，relatedToolIds 挂 env-converter / docker-run-helper；icon 为 emoji 字符串（ToolMeta 约定，不用 lucide）。
- `tool-faqs.ts`：3-4 条 FAQ（推荐值能直接用吗 / 为什么和我的生产配置不同 / 版本徽章含义 / 数据是否上传）。
- 路由 astro：`client:idle`（默认），ToolLayout 自动产出 JSON-LD 与 FAQ 区块。
- sitemap：单段路径不在 CATEGORY_SLUGS 范围，工具页自动收录，无需改 astro.config.mjs。

## 复用清单（不重造）

ToolLayout（壳层/SEO/FAQ/相关工具）、Shell、toastStore、useCopy、shadcn-vue 原语、`cn()`。**不新增依赖**。

## Tradeoffs

- **子组件目录 vs 单文件**：55 参数 + 5 种控件单文件会超 800 行，选私有子组件目录；但全部限定在 `redis-config/` 内，不污染全局。
- **纯函数引擎 vs 模板字符串**：选行数组结构（ConfLine[]），预览高亮和复制序列化共用一份数据；代价是多一层类型，收益是"预览=产物"。
- **废弃参数隐藏 vs 标记**：选"面板标记 + conf 不输出"（PRD §5），比直接隐藏多保留教育价值，比输出废弃行更干净。
- **状态本地 vs store**：选组件本地 reactive；无跨岛共享场景，进 store 反而增加耦合。

## 兼容与回滚

- 纯新增页面，不改任何既有工具行为；`tools.ts` 追加数组项为唯一共享文件改动。
- 回滚 = 删除 `src/tools/devops/RedisConfigGenerator.vue` + `redis-config/` + 路由 + 注册项，无迁移成本。
