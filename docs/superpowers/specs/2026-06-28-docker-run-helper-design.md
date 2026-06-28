# Docker Run 命令助手设计文档

- **日期**：2026-06-28
- **状态**：待实现
- **工具 ID**：`docker-run-helper`
- **路由**：`/devops/docker-run-helper`
- **分类**：DevOps 工具
- **图标**：🐳

## 1. 目的与定位

为 DevOps 分类新增一个围绕 `docker run` 单一场景的辅助工具，帮助开发者：

1. 通过表单快速生成可复制的 `docker run` 命令。
2. 查阅常用 `docker run` flag 的中文说明与示例。

页面遵循项目「即开即用、输入即输出」的产品原则，纯浏览器端生成文本，不执行任何真实 Docker 命令。

## 2. 范围边界

### 包含

- `docker run` 命令表单生成器（上半部分）。
- 常用 `docker run` flag 分类速查表（下半部分），以表格形式展示。
- 一键复制生成的命令或速查示例。

### 不包含

- 不覆盖 `docker build`、`docker network`、`docker volume`、`docker compose` 等其他子命令的速查（未来可单独做「Docker 命令大全」工具）。
- 不替代现有 `/devops/docker-converter` 的 run ↔ compose 转换能力。
- 不持久化用户输入，刷新即恢复默认值。

## 3. 页面布局

整体采用单列上下结构，最大宽度 `max-w-[720px]`（标准模式）。

### 3.1 上半部分：docker run 命令生成器

```
┌─────────────────────────────────────┐
│ ToolHeader: Docker Run 命令助手      │
├─────────────────────────────────────┤
│ 表单区                               │
│  ├─ 镜像名称 *                        │
│  ├─ 标签（默认 latest）               │
│  ├─ 容器名称 --name                   │
│  ├─ 端口映射 -p（可添加多组）          │
│  ├─ 环境变量 -e（可添加多组）          │
│  ├─ 挂载卷 -v（可添加多组）            │
│  ├─ 工作目录 -w                       │
│  ├─ 重启策略 --restart（下拉）         │
│  ├─ 网络模式 --network（下拉）          │
│  ├─ 后台运行 -d（开关）                │
│  ├─ 交互式终端 -it（开关）              │
│  └─ 自动删除 --rm（开关）               │
├─────────────────────────────────────┤
│ 生成的命令（CodePanel 只读代码块）     │
│ [复制] [清空] [填入示例]               │
└─────────────────────────────────────┘
```

**交互规则**：

- 任一表单值变化时，实时重新生成命令。
- 镜像名为空时，命令区显示占位提示：「请输入镜像名称以生成命令」。
- 多组字段（端口、环境变量、卷）支持「添加 / 删除」行，初始提供一组空行。
- 「清空」按钮重置所有表单到默认值。
- 「填入示例」按钮一键填入一条典型 `nginx` 示例。
- 「复制」按钮复制完整命令，成功触发 Toast。

### 3.2 下半部分：docker run 参数速查表

采用分类表格展示，不保留搜索框。

```
┌─────────────────────────────────────┐
│ 分类标题：基础运行                     │
│ ┌──────────┬──────────┬──────────┬────┐ │
│ │ Flag     │ 说明     │ 示例     │ 复制 │ │
│ └──────────┴──────────┴──────────┴────┘ │
│ 分类标题：网络                         │
│ ...                                  │
└─────────────────────────────────────┘
```

**分类**：

- 基础运行
- 网络
- 存储
- 环境变量
- 资源限制
- 重启与生命周期
- 安全与权限
- 日志与监控
- 其他常用

每条表格行包含：flag、简单中文说明、示例命令、复制按钮。

## 4. 数据模型

### 4.1 表单状态

```ts
interface PortMapping {
  host: string;
  container: string;
  protocol: 'tcp' | 'udp';
}

interface EnvVar {
  key: string;
  value: string;
}

interface VolumeMount {
  host: string;
  container: string;
  mode: '' | 'ro' | 'rw';
}

interface FormState {
  image: string;
  tag: string;
  name: string;
  ports: PortMapping[];
  envs: EnvVar[];
  volumes: VolumeMount[];
  workdir: string;
  restart: '' | 'no' | 'always' | 'unless-stopped' | 'on-failure';
  network: '' | 'bridge' | 'host' | 'none' | 'container:';
  detach: boolean;
  interactive: boolean;
  tty: boolean;
  rm: boolean;
  extraArgs: string;
}
```

### 4.2 命令生成

核心函数：

```ts
function generateDockerRunCommand(state: FormState): string;
```

生成规则：

- 镜像名为空时返回空字符串。
- 默认 tag 为 `latest`。
- 固定顺序拼接：`docker run` → 全局选项 → 容器配置 → 镜像名:标签 → 命令/参数。
- 对值中的空格、引号、反斜杠做正确转义（单引号包裹或反斜杠转义）。
- `extraArgs` 原样追加在镜像名之后。

### 4.3 速查数据

```ts
type RunFlagCategory =
  | '基础运行'
  | '网络'
  | '存储'
  | '环境变量'
  | '资源限制'
  | '重启与生命周期'
  | '安全与权限'
  | '日志与监控'
  | '其他常用';

interface RunFlagEntry {
  flag: string;
  category: RunFlagCategory;
  description: string;
  example: string;
}
```

收录 30–40 个最常用的 `docker run` flag。

## 5. 组件结构

```
src/
├── tools/devops/
│   ├── DockerRunHelper.vue          # 工具主组件
│   ├── DockerRunHelper.astro        # Astro 页面包装
│   └── docker-run-form/
│       ├── RunGenerator.vue         # 生成器表单 + 命令输出
│       └── FlagReference.vue        # 参数速查表
│
├── utils/docker/
│   ├── run-flags-data.ts            # flag 数据
│   ├── generate-run-command.ts      # 命令生成逻辑
│   └── __tests__/generate-run-command.test.ts
│
├── data/tools.ts                    # 注册新工具
└── data/tool-faqs.ts                # 可选 FAQ
```

### 复用组件

- `ToolHeader`：页面标题与描述。
- `ResponsiveWorkspace`：`mode="vertical"` 约束宽度。
- `CodePanel`：命令输出。
- `CopyButton` / `ClearButton`：复制与清空。
- `SelectListbox`：下拉选择（重启策略、网络模式、协议）。
- `ToggleSwitch`：开关（`-d`、`-it`、`--rm`）。

## 6. 错误处理与边界情况

- **镜像名为空**：显示占位提示，不报错。
- **端口号非数字**：对应行内联提示，但仍保留值供用户修正。
- **环境变量 key 为空**：跳过该组，不生成 `-e`。
- **卷路径含特殊字符**：生成命令时用单引号包裹。
- **额外参数**：原样追加，不做语法校验。
- **安全**：不使用 `eval()`、`Function()` 处理用户输入；不执行任何 Docker 命令。
- **无障碍**：每个输入有 label 或 aria-label；错误消息通过 `aria-describedby` 关联；复制成功通过 `aria-live` 播报。

## 7. 测试计划

### 单元测试

`src/utils/docker/__tests__/generate-run-command.test.ts`

- 基础命令生成。
- 各 flag 正确拼接。
- 多组字段顺序输出。
- 特殊字符转义。
- 空镜像名与默认标签处理。

### 数据测试

`src/utils/docker/__tests__/run-flags-data.test.ts`

- 数据完整性。
- category 合法性。
- 无重复 flag。

### 集成测试

`src/tests/devops/docker-run-helper.test.ts`

- 页面渲染。
- 表单变化实时更新命令。
- 复制与清空按钮行为。
- 速查表按分类渲染。

### 构建与类型

- `pnpm astro check`
- `pnpm build`
- `pnpm test`

## 8. SEO 与注册

在 `src/data/tools.ts` 中注册：

```ts
{
  id: 'docker-run-helper',
  name: 'Docker Run 命令助手',
  description: '通过表单快速生成 docker run 命令，并提供常用 flag 分类速查表',
  seoDescription: '在线 Docker Run 命令生成器与参数速查工具，填写镜像、端口、环境变量、挂载卷等选项即可实时生成可复制的 docker run 命令，附带常用 flag 分类表格与示例，纯浏览器端运算。',
  category: 'DevOps 工具',
  icon: '🐳',
  path: '/devops/docker-run-helper',
  keywords: ['docker run 生成器', 'docker run 命令', 'docker 容器运行', 'docker run 参数', 'docker run 示例', 'docker 命令速查', 'docker run 在线'],
  relatedToolIds: ['docker-converter', 'env-converter'],
}
```

如有高频 FAQ，在 `src/data/tool-faqs.ts` 中补充。

## 9. 未来扩展

- 如需覆盖全部 Docker 子命令，可独立创建 `/devops/docker-cheatsheet` 工具，与本工具互补。
- 可考虑为生成器添加「常用技术栈示例模板」（如 Nginx、Redis、PostgreSQL、Node.js）。
