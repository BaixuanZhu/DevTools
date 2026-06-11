# Docker Run ↔ Compose 转换器 — 设计文档

**日期**：2026-06-11
**状态**：已审批

---

## 1. 概述

新增一个 Docker 工具，支持 `docker run` 命令与 `docker compose` 配置之间的双向转换。工具以单页面双模式 Tab 形式呈现，URL 为 `/devops/docker-converter`。

### 1.1 用户场景

- **run → compose**：已有 `docker run` 命令，需要迁移到 `docker-compose.yml` 进行多容器编排管理
- **compose → run**：已有 `docker-compose.yml`，需要快速获取等效的 `docker run` 命令用于调试或单次部署

### 1.2 设计原则

- **零新增依赖**：shell 分词器手写，YAML 解析使用项目已有的 `js-yaml`
- **健壮优先**：状态机分词器 + 严格输入校验 + 精确错误定位
- **信息不丢失**：不支持的 flag 以注释保留在输出中
- **分阶段迭代**：第一阶段覆盖 ~35 个常用 flag，后续按需追加

---

## 2. 工具定位

| 属性 | 值 |
|------|-----|
| 工具 ID | `docker-converter` |
| 分类 | `DevOps 工具`（新增分类，slug: `devops`） |
| URL | `/devops/docker-converter` |
| icon | 🐳 |
| 模式 | 双 Tab：`run → compose` / `compose → run` |
| 水合策略 | `client:idle` |

### 2.1 分类变更

在 `src/data/tools.ts` 中：
- `ToolCategory` 联合类型新增 `'DevOps 工具'`
- `categorySlugMap` 新增 `'DevOps 工具': 'devops'`

### 2.2 SEO 元数据

```typescript
{
  id: 'docker-converter',
  name: 'Docker Run ↔ Compose 转换器',
  description: 'docker run 命令与 docker compose 配置互转，支持端口、环境变量、挂载卷等常用 flag',
  seoDescription: '在线 Docker Run 命令与 Docker Compose 配置互转工具，支持端口映射、环境变量、挂载卷等常用 flag 双向转换，纯浏览器端运算。',
  category: 'DevOps 工具',
  icon: '🐳',
  path: '/devops/docker-converter',
  keywords: ['docker run 转 compose', 'docker compose 转 run', 'docker 命令转换', 'compose yaml 生成', 'docker run 转换器', 'docker compose 在线'],
  relatedToolIds: ['json-to-yaml'],
}
```

---

## 3. 架构

### 3.1 文件结构

```
src/
├── utils/docker/
│   ├── types.ts              # 共享类型定义
│   ├── tokenizer.ts          # Shell 命令分词器（状态机）
│   ├── flag-registry.ts      # docker run flag 定义与映射表
│   ├── run-to-compose.ts     # docker run → compose 转换
│   └── compose-to-run.ts     # compose → docker run 转换
├── tools/devops/
│   └── DockerConverter.vue   # 工具 Vue 组件
├── pages/devops/
│   └── docker-converter.astro # 页面路由文件
└── data/
    ├── tools.ts              # 注册新工具 + 新分类
    └── tool-faqs.ts          # FAQ 问答
```

### 3.2 模块职责

#### `types.ts` — 共享类型定义

```typescript
/** 解析后的 docker run 配置（中间表示） */
interface DockerRunConfig {
  image: string;
  containerName?: string;
  command?: string[];
  detach?: boolean;
  remove?: boolean;
  restart?: string;
  ports?: string[];
  expose?: string[];
  environment?: Record<string, string>;
  envFiles?: string[];
  volumes?: string[];
  tmpfs?: string[];
  networks?: string[];
  workdir?: string;
  user?: string;
  hostname?: string;
  domainname?: string;
  macAddress?: string;
  privileged?: boolean;
  entrypoint?: string | string[];
  init?: boolean;
  interactive?: boolean;
  tty?: boolean;
  platform?: string;
  runtime?: string;
  pullPolicy?: string;
  labels?: Record<string, string>;
  cpus?: number;
  memory?: string;
  memorySwap?: string;
  gpus?: string;
  capAdd?: string[];
  capDrop?: string[];
  securityOpt?: string[];
  healthcheck?: {
    test?: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    startPeriod?: string;
    disable?: boolean;
  };
  logDriver?: string;
  logOpt?: Record<string, string>;
  unsupportedFlags?: UnsupportedFlag[];
}

/** 不支持的 flag 信息 */
interface UnsupportedFlag {
  raw: string;
  reason?: string;
}
```

#### `tokenizer.ts` — Shell 命令分词器

**核心职责**：将一行 docker run 命令拆解为 token 数组。

**状态机设计**（4 个状态）：

```
┌──────────┐  单引号    ┌──────────┐
│  初始态   │──────────→│ 单引号态  │
│ (DEFAULT) │←──────────│(SINGLE_Q)│
└─────┬────┘  单引号    └──────────┘
      │
      │ 双引号    ┌──────────┐  转义字符  ┌──────────┐
      ├──────────→│ 双引号态  │───────────→│ 转义态    │
      │            │(DOUBLE_Q) │←───────────│(ESCAPE)  │
      │            └──────────┘  任意字符   └──────────┘
      │
      │ 反斜杠+换行 → 拼接下一行，保持当前状态
      │ 反斜杠(非换行) → 作为转义字符处理
      │ 空白字符 → 结束当前 token，回到初始态
```

**健壮性保证**：
- 状态机实现，每个状态转换规则明确
- 未闭合引号检测：如果到达字符串末尾仍处于引号态，报告错误并指出引号起始位置
- 每个 token 携带位置信息（start/end 索引），错误时精确提示
- 处理续行符 `\` + 换行，合并多行为单条命令
- 处理等号赋值格式（`--name=foo`）与空格分隔格式（`--name foo`）
- 100% 纯函数，无副作用，便于单元测试

**输入校验**（在分词前执行）：
- 空输入 → 提示"请输入 docker run 命令"
- 不以 `docker` 开头 → 提示"请输入以 docker 开头的命令"
- 不包含 `run` 子命令 → 提示"请输入 docker run 命令"

#### `flag-registry.ts` — Flag 映射注册表

每个支持的 flag 定义：

```typescript
interface FlagDefinition {
  name: string;           // 长格式名，如 'publish'
  short?: string;         // 短格式，如 'p'
  hasValue: boolean;      // 是否带值（vs 布尔开关）
  valueFormat: 'single' | 'list' | 'key-value';  // 值格式
  composeKey: string[];   // 对应 Compose YAML 键路径
  composeTransformer?: (value: string) => unknown;  // 可选值转换函数
}
```

#### `run-to-compose.ts` — run → compose 转换

**流程**：`原始命令 → tokenizer → flag 逐个匹配 → DockerRunConfig → YAML 序列化`

- 遍历 token 数组，根据 flag-registry 匹配 flag，提取值填充 DockerRunConfig
- 未匹配的 flag 收集到 `unsupportedFlags`
- 手写 YAML 序列化器生成输出（输出格式固定且结构简单，无需库）
- 不支持的 flag 以 `# ⚠️ 不支持: <原始flag>` 注释形式附加在 service 块末尾

**YAML 输出格式**（Compose v2，无 version 字段）：

```yaml
services:
  <container-name 或自动生成>:
    image: nginx:latest
    ports:
      - "8080:80"
    volumes:
      - /host/path:/usr/share/nginx/html:ro
    environment:
      NGINX_HOST: example.com
    restart: unless-stopped
    # ⚠️ 不支持: --cgroupns=host
```

#### `compose-to-run.ts` — compose → run 转换

**流程**：`YAML 字符串 → js-yaml load() → 提取第一个 service → DockerRunConfig → 拼接命令`

- 使用 `js-yaml`（项目已有依赖）解析输入
- 提取 `services` 下第一个 service 的配置
- 逐字段映射回 docker run flag
- 拼接输出时：值含空格或特殊字符时自动加引号
- 无法映射的 compose 字段（如 `build`、`depends_on`）以 `# ⚠️ 无法映射: depends_on` 附加在命令末尾
- 多 service 时，其余 service 以注释形式附加

### 3.3 数据流

```
run → compose:
  用户输入 docker run 命令
    → tokenizer 分词
    → flag 解析器（查 flag-registry）
    → DockerRunConfig
    → YAML 序列化器
    → 输出 docker-compose.yml

compose → run:
  用户输入 docker-compose.yml
    → js-yaml load() 解析
    → 提取第一个 service
    → DockerRunConfig
    → 命令拼接器
    → 输出 docker run 命令
```

---

## 4. UI 设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────────┐
│  🐳 Docker Run ↔ Compose 转换器                 │
│  在 docker run 命令与 docker compose 配置之间互转 │
├─────────────────────────────────────────────────┤
│  [run → compose]  [compose → run]    ← Tab切换  │
├──────────────────────┬──────────────────────────┤
│  输入                │  输出                     │
│  ┌────────────────┐  │  ┌────────────────────┐  │
│  │ textarea       │  │  │ textarea(readonly) │  │
│  │ font-mono      │  │  │ font-mono          │  │
│  │ 8行 resize-y   │  │  │ 8行 resize-y       │  │
│  └────────────────┘  │  └────────────────────┘  │
│  [转换] [清空]       │  [复制结果]               │
│  ❗ 错误提示         │  统计信息（如有不支持flag） │
├──────────────────────┴──────────────────────────┤
│  FAQ 区域（ToolLayout 自动渲染）                  │
└─────────────────────────────────────────────────┘
```

### 4.2 组件结构

Vue 组件 `DockerConverter.vue` 遵循项目标准模式：

- `<script setup lang="ts">` + Composition API
- 导入 `ToolHeader`、`ModeTabGroup`、`CopyButton`、`ClearButton`、`ResponsiveWorkspace`
- 两个模式通过 `ModeTabGroup` 切换
- `ResponsiveWorkspace` 的 `mode="horizontal"` 提供左右分栏布局

### 4.3 交互行为

| 行为 | 说明 |
|------|------|
| 转换触发 | 点击「转换」按钮，不使用实时 watch |
| 默认值 | 预填典型示例，打开即可体验 |
| 模式切换 | 清空输入/输出/错误状态 |
| 输出区 | readonly textarea + 复制按钮 |
| 不支持 flag | 注释保留 + 统计提示 |
| 错误提示 | 中文描述具体问题，精确到位置 |

**run → compose 模式默认值**：
```
docker run -d --name my-nginx -p 8080:80 -v /host/path:/usr/share/nginx/html:ro --restart unless-stopped -e NGINX_HOST=example.com nginx:latest
```

**compose → run 模式默认值**：
```yaml
services:
  my-nginx:
    image: nginx:latest
    container_name: my-nginx
    ports:
      - "8080:80"
    volumes:
      - /host/path:/usr/share/nginx/html:ro
    environment:
      NGINX_HOST: example.com
    restart: unless-stopped
```

---

## 5. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 输入为空 | 提示"请输入 docker run 命令"或"请输入 docker compose 配置" |
| 不是 docker run 命令 | 提示"请输入以 docker run 开头的命令" |
| 未闭合引号 | 提示"引号未闭合，位置：第 X 个字符附近" |
| 未知 flag | 以注释保留在输出中，不报错 |
| compose YAML 语法错误 | 提示 js-yaml 的解析错误信息 |
| compose 中无 services | 提示"未找到 services 定义" |
| compose 中 services 为空 | 提示"services 中没有定义任何服务" |

---

## 6. 依赖

**零新增依赖**。

- YAML 解析：使用项目已有的 `js-yaml`（仅 compose → run 方向）
- Shell 分词、flag 映射、YAML 序列化：全部手写
- Vue 组件：复用项目已有的 `ModeTabGroup`、`ResponsiveWorkspace`、`CopyButton`、`ClearButton` 等

---

## 7. 第一阶段 Flag 覆盖范围

### run → compose 映射表

| Compose YAML 键 | docker run flag | 备注 |
|-----------------|----------------|------|
| `image` | 位置参数 | 镜像名（必选） |
| `container_name` | `--name` | |
| `command` | image 之后的位置参数 | 容器启动命令 |
| `detach` | `-d` / `--detach` | compose 中默认后台运行，仅在 `false` 时显式写出 |
| `ports` | `-p` / `--publish` | 可多个 |
| `expose` | `--expose` | 可多个 |
| `environment` | `-e` / `--env` | 可多个，支持 `KEY=VAL` 和 `KEY`（无值）格式 |
| `env_file` | `--env-file` | 可多个 |
| `volumes` | `-v` / `--volume` | 可多个 |
| `tmpfs` | `--tmpfs` | 可多个 |
| `networks` | `--network` | |
| `restart` | `--restart` | |
| `working_dir` | `-w` / `--workdir` | |
| `user` | `-u` / `--user` | |
| `hostname` | `-h` / `--hostname` | |
| `domainname` | `--domainname` | |
| `mac_address` | `--mac-address` | |
| `privileged` | `--privileged` | |
| `entrypoint` | `--entrypoint` | |
| `init` | `--init` | |
| `stdin_open` | `-i` / `--interactive` | |
| `tty` | `-t` / `--tty` | |
| `rm` | `--rm` | compose 中无直接对应，以注释保留 |
| `platform` | `--platform` | |
| `runtime` | `--runtime` | |
| `pull_policy` | `--pull` | |
| `labels` | `-l` / `--label` | 可多个 |
| `cpus` | `--cpus` | deploy.deploy.resources.limits.cpus |
| `mem_limit` | `-m` / `--memory` | deploy.resources.limits.memory |
| `memswap_limit` | `--memory-swap` | |
| GPU | `--gpus` | deploy.resources.reservations.devices |
| `cap_add` | `--cap-add` | 可多个 |
| `cap_drop` | `--cap-drop` | 可多个 |
| `security_opt` | `--security-opt` | 可多个 |
| `healthcheck` | `--health-cmd` 等 | 一组 flag 组合映射 |
| `logging` | `--log-driver` / `--log-opt` | |

### compose → run 特殊处理

- `build`、`depends_on`、`links`、`extends`、`profiles`、`secrets`、`configs` 等 compose 专有字段 → 以注释保留
- 多 service 时只转换第一个，其余以注释形式附加
- `deploy.resources` 下的限制映射回对应的 `--cpus`、`--memory` 等 flag

---

## 8. 后续迭代方向

**第二阶段可追加的 flag**：
- 命名空间隔离：`--pid`、`--uts`、`--ipc`、`--cgroupns`
- 资源限制：`--pids-limit`、`--ulimit`
- 设备与硬件：`--device`、`--device-cgroup-rule`
- DNS 与网络：`--dns`、`--dns-search`、`--dns-option`、`--add-host`
- 系统配置：`--sysctl`、`--shm-size`
- 存储驱动：`--storage-opt`
- 只读文件系统：`--read-only`

---

## 9. FAQ

1. **Q: docker run 的 `--rm` flag 在 compose 中如何表示？**
   A: Compose v2 规范中没有直接等价的字段。转换时会以注释形式保留，提醒你 compose 默认使用 `docker compose up/down` 管理容器生命周期，不需要 `--rm`。

2. **Q: 为什么有些 flag 被注释掉了？**
   A: 当前工具尚未支持所有 docker run flag，不支持的 flag 会以注释形式保留在输出中，确保信息不丢失。后续版本会逐步扩展支持范围。

3. **Q: compose → run 转换只处理第一个 service 吗？**
   A: 是的。`docker run` 命令只能启动单个容器，所以 compose → run 方向会转换第一个 service。如果有多个 service，其余 service 的配置会以注释形式附加在输出末尾供参考。

4. **Q: 生成的 compose 文件不写 `version` 字段吗？**
   A: 不写。自 Docker Compose v2 起，`version` 字段已弃用，当前推荐做法是不指定 version，使用最新的 Compose 规范格式。
