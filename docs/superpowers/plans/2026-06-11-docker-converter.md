# Docker Run ↔ Compose 转换器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个 DevOps 分类工具，支持 `docker run` 命令与 `docker compose` 配置之间的双向转换，URL 为 `/devops/docker-converter`。

**Architecture:** 手写状态机 shell 分词器 + flag 注册表解析 `docker run`，映射到 `DockerRunConfig` 中间表示；run→compose 使用手写 YAML 序列化器输出；compose→run 使用项目已有的 `js-yaml` 解析并拼接命令。UI 采用 Vue 3 + ModeTabGroup + ResponsiveWorkspace 双栏布局，点击「转换」按钮触发转换。

**Tech Stack:** Vue 3 Composition API、TypeScript strict、Tailwind CSS v4、@headlessui/vue（ModeTabGroup）、js-yaml（仅 compose→run 解析）、Vitest（测试）。

---

## File Structure

```
创建:
  src/utils/docker/types.ts                       # 共享类型定义（DockerRunConfig、转换结果类型等）
  src/utils/docker/tokenizer.ts                   # 状态机 shell 分词器
  src/utils/docker/flag-registry.ts               # docker run flag 注册表（~35 个 flag 映射）
  src/utils/docker/run-to-compose.ts              # docker run → compose 转换器
  src/utils/docker/compose-to-run.ts              # compose → docker run 转换器
  src/utils/docker/__tests__/tokenizer.test.ts    # 分词器单元测试
  src/utils/docker/__tests__/run-to-compose.test.ts  # run→compose 单元测试
  src/utils/docker/__tests__/compose-to-run.test.ts  # compose→run 单元测试
  src/tools/devops/DockerConverter.vue            # 工具主 Vue 组件
  src/pages/devops/docker-converter.astro         # 页面路由

修改:
  src/data/tools.ts                               # 新增 'DevOps 工具' 分类 + 工具注册
  src/data/tool-faqs.ts                           # 新增 docker-converter FAQ

新增依赖: 无（js-yaml 项目已有）
```

---

### Task 1: 共享类型定义

**Files:**
- Create: `src/utils/docker/types.ts`

- [ ] **Step 1: 创建 `src/utils/docker/types.ts`**

```typescript
/**
 * Docker Run ↔ Compose 转换器共享类型定义。
 *
 * 定义解析后的 docker run 配置中间表示、不支持的 flag 信息、
 * 以及分词器与两个方向转换器的统一返回类型。
 */

/** 解析后的 docker run 配置（中间表示） */
export interface DockerRunConfig {
  /** 镜像名（位置参数，必选） */
  image: string;
  /** 容器名，对应 --name */
  containerName?: string;
  /** 容器启动命令（image 之后的位置参数） */
  command?: string[];
  /** 是否后台运行 -d/--detach */
  detach?: boolean;
  /** 是否退出后删除 --rm */
  remove?: boolean;
  /** 重启策略 --restart */
  restart?: string;
  /** 端口映射 -p/--publish */
  ports?: string[];
  /** 暴露端口 --expose */
  expose?: string[];
  /** 环境变量 -e/--env */
  environment?: Record<string, string>;
  /** 环境变量文件 --env-file */
  envFiles?: string[];
  /** 挂载卷 -v/--volume */
  volumes?: string[];
  /** tmpfs 挂载 --tmpfs */
  tmpfs?: string[];
  /** 网络 --network */
  networks?: string[];
  /** 工作目录 -w/--workdir */
  workdir?: string;
  /** 用户 -u/--user */
  user?: string;
  /** 主机名 -h/--hostname */
  hostname?: string;
  /** 域名 --domainname */
  domainname?: string;
  /** MAC 地址 --mac-address */
  macAddress?: string;
  /** 特权模式 --privileged */
  privileged?: boolean;
  /** 入口点 --entrypoint */
  entrypoint?: string | string[];
  /** 使用 init 进程 --init */
  init?: boolean;
  /** 交互式 -i/--interactive */
  interactive?: boolean;
  /** 分配 TTY -t/--tty */
  tty?: boolean;
  /** 平台 --platform */
  platform?: string;
  /** 运行时 --runtime */
  runtime?: string;
  /** 拉取策略 --pull */
  pullPolicy?: string;
  /** 标签 -l/--label */
  labels?: Record<string, string>;
  /** CPU 限制 --cpus */
  cpus?: number;
  /** 内存限制 -m/--memory */
  memory?: string;
  /** 交换内存限制 --memory-swap */
  memorySwap?: string;
  /** GPU --gpus */
  gpus?: string;
  /** 添加能力 --cap-add */
  capAdd?: string[];
  /** 移除能力 --cap-drop */
  capDrop?: string[];
  /** 安全选项 --security-opt */
  securityOpt?: string[];
  /** 健康检查 */
  healthcheck?: {
    test?: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    startPeriod?: string;
    disable?: boolean;
  };
  /** 日志驱动 --log-driver */
  logDriver?: string;
  /** 日志选项 --log-opt */
  logOpt?: Record<string, string>;
  /** 不支持的 flag 列表 */
  unsupportedFlags?: UnsupportedFlag[];
}

/** 不支持的 flag 信息 */
export interface UnsupportedFlag {
  /** 原始 flag 字符串 */
  raw: string;
  /** 不支持的原因（可选） */
  reason?: string;
}

/** Shell 分词结果 — token */
export interface Token {
  /** token 值 */
  value: string;
  /** 起始字符索引 */
  start: number;
  /** 结束字符索引 */
  end: number;
}

/** 分词成功结果 */
export interface TokenizeSuccess {
  ok: true;
  tokens: Token[];
}

/** 分词失败结果 */
export interface TokenizeError {
  ok: false;
  error: string;
}

/** 分词返回类型 */
export type TokenizeResult = TokenizeSuccess | TokenizeError;

/** run → compose 转换成功结果 */
export interface RunToComposeSuccess {
  ok: true;
  /** 生成的 YAML 字符串 */
  result: string;
  /** 不支持的 flag 数量 */
  unsupportedCount: number;
}

/** run → compose 转换失败结果 */
export interface RunToComposeError {
  ok: false;
  /** 错误描述 */
  error: string;
}

/** run → compose 转换返回类型 */
export type RunToComposeResult = RunToComposeSuccess | RunToComposeError;

/** compose → run 转换成功结果 */
export interface ComposeToRunSuccess {
  ok: true;
  /** 生成的 docker run 命令 */
  result: string;
  /** 无法映射的字段数量 */
  unsupportedCount: number;
}

/** compose → run 转换失败结果 */
export interface ComposeToRunError {
  ok: false;
  /** 错误描述 */
  error: string;
}

/** compose → run 转换返回类型 */
export type ComposeToRunResult = ComposeToRunSuccess | ComposeToRunError;
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/docker/types.ts
git commit -m "feat(docker): add shared types for docker run ↔ compose converter"
```

---

### Task 2: Shell 命令分词器

**Files:**
- Create: `src/utils/docker/tokenizer.ts`
- Create: `src/utils/docker/__tests__/tokenizer.test.ts`

- [ ] **Step 1: 创建测试目录并写入失败测试**

```bash
mkdir -p src/utils/docker/__tests__
```

创建 `src/utils/docker/__tests__/tokenizer.test.ts`：

```typescript
/**
 * Docker shell 命令分词器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer';

describe('tokenize', () => {
  it('将基本 docker run 命令拆分为 token', () => {
    const result = tokenize('docker run -d --name my-nginx nginx:latest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-d',
      '--name',
      'my-nginx',
      'nginx:latest',
    ]);
  });

  it('忽略多余空白字符', () => {
    const result = tokenize('docker   run   -d   nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual(['docker', 'run', '-d', 'nginx']);
  });

  it('支持单引号包裹的值', () => {
    const result = tokenize("docker run -e 'KEY=value with spaces' nginx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-e',
      'KEY=value with spaces',
      'nginx',
    ]);
  });

  it('支持双引号包裹的值', () => {
    const result = tokenize('docker run -e "KEY=value with spaces" nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-e',
      'KEY=value with spaces',
      'nginx',
    ]);
  });

  it('支持转义双引号', () => {
    const result = tokenize('docker run -e "KEY=\\"quoted\\"" nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual([
      'docker',
      'run',
      '-e',
      'KEY="quoted"',
      'nginx',
    ]);
  });

  it('支持 --flag=value 等号格式', () => {
    const result = tokenize('docker run --name=my-nginx nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual(['docker', 'run', '--name=my-nginx', 'nginx']);
  });

  it('支持反斜杠续行', () => {
    const result = tokenize('docker run \\\n  -d \\\n  nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tokens.map((t) => t.value)).toEqual(['docker', 'run', '-d', 'nginx']);
  });

  it('未闭合单引号返回错误', () => {
    const result = tokenize("docker run -e 'KEY=value nginx");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('引号未闭合');
  });

  it('未闭合双引号返回错误', () => {
    const result = tokenize('docker run -e "KEY=value nginx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('引号未闭合');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test src/utils/docker/__tests__/tokenizer.test.ts
```

Expected: FAIL，错误信息包含 `tokenize is not defined` 或 `Cannot find module`。

- [ ] **Step 3: 实现分词器**

创建 `src/utils/docker/tokenizer.ts`：

```typescript
/**
 * Shell 命令分词器。
 *
 * 将 docker run 命令字符串按 shell 规则拆分为 token 数组。
 * 使用状态机实现，支持单引号、双引号、转义字符和续行符。
 *
 * 实现要点：
 * - DEFAULT：普通字符直接拼接，遇到空白结束当前 token
 * - SINGLE_Q：单引号内原样保留字符，不处理转义
 * - DOUBLE_Q：双引号内处理 `\\` 开头的转义序列
 * - ESCAPE：处理双引号内转义字符（如 \\\"、\\\$、\\`、\\\\ 和续行）
 */

import type { Token, TokenizeResult } from './types';

type State = 'DEFAULT' | 'SINGLE_Q' | 'DOUBLE_Q' | 'ESCAPE';

/**
 * 将 shell 命令字符串分词为 token 数组。
 *
 * @param input - 完整的 shell 命令字符串
 * @returns 分词结果。成功返回 token 数组，失败返回错误描述。
 */
export function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  let current = '';
  let tokenStart = 0;
  let quoteStart = -1;
  let state: State = 'DEFAULT';
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    switch (state) {
      case 'DEFAULT': {
        if (ch === "'") {
          if (current === '') {
            tokenStart = i;
          }
          quoteStart = i;
          state = 'SINGLE_Q';
          i++;
        } else if (ch === '"') {
          if (current === '') {
            tokenStart = i;
          }
          quoteStart = i;
          state = 'DOUBLE_Q';
          i++;
        } else if (ch === '\\') {
          if (i + 1 < input.length && input[i + 1] === '\n') {
            // 续行：丢弃反斜杠和换行
            i += 2;
          } else {
            if (current === '') {
              tokenStart = i;
            }
            if (i + 1 < input.length) {
              current += input[i + 1];
              i += 2;
            } else {
              current += ch;
              i++;
            }
          }
        } else if (/\s/.test(ch)) {
          if (current !== '') {
            tokens.push({ value: current, start: tokenStart, end: i });
            current = '';
          }
          i++;
        } else {
          if (current === '') {
            tokenStart = i;
          }
          current += ch;
          i++;
        }
        break;
      }

      case 'SINGLE_Q': {
        if (ch === "'") {
          state = 'DEFAULT';
          i++;
        } else {
          current += ch;
          i++;
        }
        break;
      }

      case 'DOUBLE_Q': {
        if (ch === '\\') {
          state = 'ESCAPE';
          i++;
        } else if (ch === '"') {
          state = 'DEFAULT';
          i++;
        } else {
          current += ch;
          i++;
        }
        break;
      }

      case 'ESCAPE': {
        // 双引号内反斜杠后的特殊字符才去掉反斜杠
        if (ch === '$' || ch === '`' || ch === '"' || ch === '\\') {
          current += ch;
        } else if (ch === '\n') {
          // 双引号内续行：两者都丢弃
        } else {
          // 其他字符保留反斜杠
          current += '\\' + ch;
        }
        state = 'DOUBLE_Q';
        i++;
        break;
      }
    }
  }

  if (state === 'SINGLE_Q') {
    return {
      ok: false,
      error: `引号未闭合，位置：第 ${quoteStart + 1} 个字符附近的单引号`,
    };
  }

  if (state === 'DOUBLE_Q' || state === 'ESCAPE') {
    return {
      ok: false,
      error: `引号未闭合，位置：第 ${quoteStart + 1} 个字符附近的双引号`,
    };
  }

  if (current !== '') {
    tokens.push({ value: current, start: tokenStart, end: input.length });
  }

  return { ok: true, tokens };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test src/utils/docker/__tests__/tokenizer.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/docker/tokenizer.ts src/utils/docker/__tests__/tokenizer.test.ts
git commit -m "feat(docker): add shell command tokenizer with tests"
```

---

### Task 3: Flag 注册表

**Files:**
- Create: `src/utils/docker/flag-registry.ts`

- [ ] **Step 1: 创建 `src/utils/docker/flag-registry.ts`**

```typescript
/**
 * Docker run flag 注册表。
 *
 * 集中定义所有支持的 docker run flag 及其到 compose 字段的映射关系。
 * 注册表被 run-to-compose.ts 消费，用于从 token 流中识别并提取配置。
 */

/** flag 值格式 */
export type ValueFormat = 'single' | 'list' | 'key-value';

/** 单个 flag 定义 */
export interface FlagDefinition {
  /** 长格式 flag 名（不带 --） */
  name: string;
  /** 短格式 flag 名（不带 -） */
  short?: string;
  /** 是否必须带值 */
  hasValue: boolean;
  /** 值格式：单个值 / 列表 / 键值对 */
  valueFormat: ValueFormat;
  /** 对应的 compose 字段名 */
  composeKey: string;
  /** 可选的值转换函数 */
  composeTransformer?: (value: string) => unknown;
}

/** 支持的 flag 列表 */
export const FLAG_REGISTRY: FlagDefinition[] = [
  { name: 'detach', short: 'd', hasValue: false, valueFormat: 'single', composeKey: 'detach' },
  { name: 'name', hasValue: true, valueFormat: 'single', composeKey: 'container_name' },
  { name: 'publish', short: 'p', hasValue: true, valueFormat: 'list', composeKey: 'ports' },
  { name: 'expose', hasValue: true, valueFormat: 'list', composeKey: 'expose' },
  { name: 'env', short: 'e', hasValue: true, valueFormat: 'key-value', composeKey: 'environment' },
  { name: 'env-file', hasValue: true, valueFormat: 'list', composeKey: 'env_file' },
  { name: 'volume', short: 'v', hasValue: true, valueFormat: 'list', composeKey: 'volumes' },
  { name: 'tmpfs', hasValue: true, valueFormat: 'list', composeKey: 'tmpfs' },
  { name: 'network', hasValue: true, valueFormat: 'list', composeKey: 'networks' },
  { name: 'restart', hasValue: true, valueFormat: 'single', composeKey: 'restart' },
  { name: 'workdir', short: 'w', hasValue: true, valueFormat: 'single', composeKey: 'working_dir' },
  { name: 'user', short: 'u', hasValue: true, valueFormat: 'single', composeKey: 'user' },
  { name: 'hostname', short: 'h', hasValue: true, valueFormat: 'single', composeKey: 'hostname' },
  { name: 'domainname', hasValue: true, valueFormat: 'single', composeKey: 'domainname' },
  { name: 'mac-address', hasValue: true, valueFormat: 'single', composeKey: 'mac_address' },
  { name: 'privileged', hasValue: false, valueFormat: 'single', composeKey: 'privileged' },
  { name: 'entrypoint', hasValue: true, valueFormat: 'single', composeKey: 'entrypoint' },
  { name: 'init', hasValue: false, valueFormat: 'single', composeKey: 'init' },
  { name: 'interactive', short: 'i', hasValue: false, valueFormat: 'single', composeKey: 'stdin_open' },
  { name: 'tty', short: 't', hasValue: false, valueFormat: 'single', composeKey: 'tty' },
  { name: 'rm', hasValue: false, valueFormat: 'single', composeKey: 'rm' },
  { name: 'platform', hasValue: true, valueFormat: 'single', composeKey: 'platform' },
  { name: 'runtime', hasValue: true, valueFormat: 'single', composeKey: 'runtime' },
  { name: 'pull', hasValue: true, valueFormat: 'single', composeKey: 'pull_policy' },
  { name: 'label', short: 'l', hasValue: true, valueFormat: 'key-value', composeKey: 'labels' },
  { name: 'cpus', hasValue: true, valueFormat: 'single', composeKey: 'deploy.resources.limits.cpus' },
  { name: 'memory', short: 'm', hasValue: true, valueFormat: 'single', composeKey: 'deploy.resources.limits.memory' },
  { name: 'memory-swap', hasValue: true, valueFormat: 'single', composeKey: 'deploy.resources.limits.memorySwap' },
  { name: 'gpus', hasValue: true, valueFormat: 'single', composeKey: 'deploy.resources.reservations.devices' },
  { name: 'cap-add', hasValue: true, valueFormat: 'list', composeKey: 'cap_add' },
  { name: 'cap-drop', hasValue: true, valueFormat: 'list', composeKey: 'cap_drop' },
  { name: 'security-opt', hasValue: true, valueFormat: 'list', composeKey: 'security_opt' },
  { name: 'health-cmd', hasValue: true, valueFormat: 'single', composeKey: 'healthcheck.test' },
  { name: 'health-interval', hasValue: true, valueFormat: 'single', composeKey: 'healthcheck.interval' },
  { name: 'health-timeout', hasValue: true, valueFormat: 'single', composeKey: 'healthcheck.timeout' },
  { name: 'health-retries', hasValue: true, valueFormat: 'single', composeKey: 'healthcheck.retries' },
  { name: 'health-start-period', hasValue: true, valueFormat: 'single', composeKey: 'healthcheck.start_period' },
  { name: 'no-healthcheck', hasValue: false, valueFormat: 'single', composeKey: 'healthcheck.disable' },
  { name: 'log-driver', hasValue: true, valueFormat: 'single', composeKey: 'logging.driver' },
  { name: 'log-opt', hasValue: true, valueFormat: 'key-value', composeKey: 'logging.options' },
];

/** 用长名索引 flag 定义，便于快速查找 */
export const FLAG_BY_NAME: ReadonlyMap<string, FlagDefinition> = new Map(
  FLAG_REGISTRY.map((f) => [f.name, f]),
);

/** 用短名索引 flag 定义，便于快速查找 */
export const FLAG_BY_SHORT: ReadonlyMap<string, FlagDefinition> = new Map(
  FLAG_REGISTRY.filter((f) => f.short).map((f) => [f.short!, f]),
);

/**
 * 根据长格式或短格式 flag 名查找定义。
 *
 * @param name - 输入的 flag 名（如 "name" 或 "d"）
 * @param isShort - 是否为短格式
 * @returns 对应的 FlagDefinition，未找到返回 undefined
 */
export function findFlag(name: string, isShort: boolean): FlagDefinition | undefined {
  return isShort ? FLAG_BY_SHORT.get(name) : FLAG_BY_NAME.get(name);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/docker/flag-registry.ts
git commit -m "feat(docker): add docker run flag registry"
```

---

### Task 4: docker run → compose 转换器

**Files:**
- Create: `src/utils/docker/run-to-compose.ts`
- Create: `src/utils/docker/__tests__/run-to-compose.test.ts`

- [ ] **Step 1: 写入失败测试**

创建 `src/utils/docker/__tests__/run-to-compose.test.ts`：

```typescript
/**
 * docker run → docker compose 转换器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertRunToCompose } from '../run-to-compose';

describe('convertRunToCompose', () => {
  it('转换最小 docker run 命令', () => {
    const result = convertRunToCompose('docker run nginx:latest');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('services:');
    expect(result.result).toContain('image: nginx:latest');
    expect(result.unsupportedCount).toBe(0);
  });

  it('转换完整示例命令', () => {
    const result = convertRunToCompose(
      'docker run -d --name my-nginx -p 8080:80 -v /host/path:/usr/share/nginx/html:ro --restart unless-stopped -e NGINX_HOST=example.com nginx:latest',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('container_name: my-nginx');
    expect(result.result).toContain('image: nginx:latest');
    expect(result.result).toContain('- "8080:80"');
    expect(result.result).toContain('- /host/path:/usr/share/nginx/html:ro');
    expect(result.result).toContain('restart: unless-stopped');
    expect(result.result).toContain('NGINX_HOST: example.com');
  });

  it('空输入返回中文错误', () => {
    const result = convertRunToCompose('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('请输入 docker run 命令');
  });

  it('非 docker 命令返回错误', () => {
    const result = convertRunToCompose('kubectl run nginx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('docker');
  });

  it('不包含 run 子命令返回错误', () => {
    const result = convertRunToCompose('docker ps');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('docker run');
  });

  it('不支持的 flag 以注释保留', () => {
    const result = convertRunToCompose('docker run --cgroupns=host nginx');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('# ⚠️ 不支持: --cgroupns=host');
    expect(result.unsupportedCount).toBe(1);
  });

  it('引号未闭合返回精确错误位置', () => {
    const result = convertRunToCompose('docker run -e "KEY=value nginx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('引号未闭合');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test src/utils/docker/__tests__/run-to-compose.test.ts
```

Expected: FAIL，错误包含 `convertRunToCompose is not defined`。

- [ ] **Step 3: 实现转换器**

创建 `src/utils/docker/run-to-compose.ts`：

```typescript
/**
 * docker run 命令 → docker compose YAML 转换器。
 *
 * 流程：输入命令 → tokenizer 分词 → 基于 flag-registry 解析 → DockerRunConfig → 手写 YAML 序列化。
 * 不支持的 flag 以 `# ⚠️ 不支持: <flag>` 注释保留在 service 末尾。
 */

import type {
  DockerRunConfig,
  RunToComposeResult,
  Token,
  UnsupportedFlag,
} from './types';
import { tokenize } from './tokenizer';
import { findFlag } from './flag-registry';
import type { FlagDefinition } from './flag-registry';

/**
 * 将 docker run 命令转换为 docker compose YAML 字符串。
 *
 * @param input - 原始 docker run 命令
 * @returns 转换结果或错误信息
 */
export function convertRunToCompose(input: string): RunToComposeResult {
  const trimmed = input.trim();

  if (trimmed === '') {
    return { ok: false, error: '请输入 docker run 命令' };
  }

  if (!/^docker\b/i.test(trimmed)) {
    return { ok: false, error: '请输入以 docker 开头的命令' };
  }

  if (!/\brun\b/i.test(trimmed)) {
    return { ok: false, error: '请输入 docker run 命令' };
  }

  const tokenizeResult = tokenize(trimmed);
  if (!tokenizeResult.ok) {
    return { ok: false, error: tokenizeResult.error };
  }

  const parseResult = parseTokens(tokenizeResult.tokens);
  if (!parseResult.ok) {
    return { ok: false, error: parseResult.error };
  }

  const yaml = serializeToYaml(parseResult.config);
  return {
    ok: true,
    result: yaml,
    unsupportedCount: parseResult.config.unsupportedFlags?.length ?? 0,
  };
}

interface ParseSuccess {
  ok: true;
  config: DockerRunConfig;
}

interface ParseError {
  ok: false;
  error: string;
}

type ParseResult = ParseSuccess | ParseError;

/**
 * 从 token 流解析出 DockerRunConfig。
 *
 * 跳过前两个 token（docker 和 run），依次处理 flag 和位置参数。
 */
function parseTokens(tokens: Token[]): ParseResult {
  let pos = 0;

  // 跳过 docker 和 run
  while (pos < tokens.length && /^(docker|run)$/i.test(tokens[pos].value)) {
    pos++;
  }

  const config: DockerRunConfig = {
    image: '',
    unsupportedFlags: [],
  };

  const remainingTokens: string[] = [];

  while (pos < tokens.length) {
    const token = tokens[pos];
    const value = token.value;

    if (value.startsWith('--')) {
      const eqIndex = value.indexOf('=');
      let flagName: string;
      let inlineValue: string | undefined;

      if (eqIndex > 2) {
        flagName = value.slice(2, eqIndex);
        inlineValue = value.slice(eqIndex + 1);
      } else {
        flagName = value.slice(2);
      }

      const flag = findFlag(flagName, false);
      if (!flag) {
        config.unsupportedFlags!.push({ raw: value });
        pos++;
        continue;
      }

      let flagValue: string | undefined = inlineValue;
      if (flag.hasValue && flagValue === undefined) {
        pos++;
        if (pos >= tokens.length) {
          config.unsupportedFlags!.push({
            raw: value,
            reason: `缺少 ${flag.name} 的值`,
          });
          continue;
        }
        flagValue = tokens[pos].value;
      }

      applyFlag(config, flag, flagValue);
      pos++;
      continue;
    }

    if (value.startsWith('-') && value.length > 1) {
      // 处理短 flag；多个短 flag 可合并（如 -it），但 docker run 常见为单个字母
      const shortName = value.slice(1);
      const flag = findFlag(shortName, true);

      if (!flag) {
        config.unsupportedFlags!.push({ raw: value });
        pos++;
        continue;
      }

      if (flag.hasValue) {
        pos++;
        if (pos >= tokens.length) {
          config.unsupportedFlags!.push({
            raw: value,
            reason: `缺少 ${flag.name} 的值`,
          });
          continue;
        }
        applyFlag(config, flag, tokens[pos].value);
      } else {
        applyFlag(config, flag, undefined);
      }
      pos++;
      continue;
    }

    // 非 flag token 全部归为位置参数
    remainingTokens.push(value);
    pos++;
  }

  if (remainingTokens.length === 0) {
    return { ok: false, error: '缺少镜像名，请输入 docker run <镜像名>' };
  }

  config.image = remainingTokens[0];
  if (remainingTokens.length > 1) {
    config.command = remainingTokens.slice(1);
  }

  return { ok: true, config };
}

/**
 * 将单个 flag 值写入 DockerRunConfig。
 */
function applyFlag(
  config: DockerRunConfig,
  flag: FlagDefinition,
  value: string | undefined,
): void {
  const raw = flag.composeTransformer ? String(flag.composeTransformer(value ?? '')) : (value ?? true);

  switch (flag.composeKey) {
    case 'detach':
      config.detach = true;
      break;
    case 'container_name':
      config.containerName = value ?? '';
      break;
    case 'ports':
      config.ports ??= [];
      config.ports.push(value ?? '');
      break;
    case 'expose':
      config.expose ??= [];
      config.expose.push(value ?? '');
      break;
    case 'environment': {
      config.environment ??= {};
      const envValue = value ?? '';
      const eqIndex = envValue.indexOf('=');
      if (eqIndex >= 0) {
        config.environment[envValue.slice(0, eqIndex)] = envValue.slice(eqIndex + 1);
      } else {
        config.environment[envValue] = '';
      }
      break;
    }
    case 'env_file':
      config.envFiles ??= [];
      config.envFiles.push(value ?? '');
      break;
    case 'volumes':
      config.volumes ??= [];
      config.volumes.push(value ?? '');
      break;
    case 'tmpfs':
      config.tmpfs ??= [];
      config.tmpfs.push(value ?? '');
      break;
    case 'networks':
      config.networks ??= [];
      config.networks.push(value ?? '');
      break;
    case 'restart':
      config.restart = value ?? '';
      break;
    case 'working_dir':
      config.workdir = value ?? '';
      break;
    case 'user':
      config.user = value ?? '';
      break;
    case 'hostname':
      config.hostname = value ?? '';
      break;
    case 'domainname':
      config.domainname = value ?? '';
      break;
    case 'mac_address':
      config.macAddress = value ?? '';
      break;
    case 'privileged':
      config.privileged = true;
      break;
    case 'entrypoint':
      config.entrypoint = value ?? '';
      break;
    case 'init':
      config.init = true;
      break;
    case 'stdin_open':
      config.interactive = true;
      break;
    case 'tty':
      config.tty = true;
      break;
    case 'rm':
      config.remove = true;
      break;
    case 'platform':
      config.platform = value ?? '';
      break;
    case 'runtime':
      config.runtime = value ?? '';
      break;
    case 'pull_policy':
      config.pullPolicy = value ?? '';
      break;
    case 'labels': {
      config.labels ??= {};
      const labelValue = value ?? '';
      const eqIndex = labelValue.indexOf('=');
      if (eqIndex >= 0) {
        config.labels[labelValue.slice(0, eqIndex)] = labelValue.slice(eqIndex + 1);
      } else {
        config.labels[labelValue] = '';
      }
      break;
    }
    case 'deploy.resources.limits.cpus':
      config.cpus = Number(value ?? 0);
      break;
    case 'deploy.resources.limits.memory':
      config.memory = value ?? '';
      break;
    case 'deploy.resources.limits.memorySwap':
      config.memorySwap = value ?? '';
      break;
    case 'deploy.resources.reservations.devices':
      config.gpus = value ?? '';
      break;
    case 'cap_add':
      config.capAdd ??= [];
      config.capAdd.push(value ?? '');
      break;
    case 'cap_drop':
      config.capDrop ??= [];
      config.capDrop.push(value ?? '');
      break;
    case 'security_opt':
      config.securityOpt ??= [];
      config.securityOpt.push(value ?? '');
      break;
    case 'healthcheck.test':
      config.healthcheck ??= {};
      config.healthcheck.test = ['CMD-SHELL', value ?? ''];
      break;
    case 'healthcheck.interval':
      config.healthcheck ??= {};
      config.healthcheck.interval = value ?? '';
      break;
    case 'healthcheck.timeout':
      config.healthcheck ??= {};
      config.healthcheck.timeout = value ?? '';
      break;
    case 'healthcheck.retries':
      config.healthcheck ??= {};
      config.healthcheck.retries = Number(value ?? 0);
      break;
    case 'healthcheck.start_period':
      config.healthcheck ??= {};
      config.healthcheck.startPeriod = value ?? '';
      break;
    case 'healthcheck.disable':
      config.healthcheck ??= {};
      config.healthcheck.disable = true;
      break;
    case 'logging.driver':
      config.logDriver = value ?? '';
      break;
    case 'logging.options': {
      config.logOpt ??= {};
      const optValue = value ?? '';
      const eqIndex = optValue.indexOf('=');
      if (eqIndex >= 0) {
        config.logOpt[optValue.slice(0, eqIndex)] = optValue.slice(eqIndex + 1);
      } else {
        config.logOpt[optValue] = '';
      }
      break;
    }
  }
}

/**
 * 将 DockerRunConfig 序列化为 YAML 字符串。
 *
 * 输出为 Compose v2 格式，不含 version 字段。
 */
function serializeToYaml(config: DockerRunConfig): string {
  const serviceName = config.containerName || 'service';
  const lines: string[] = ['services:', `  ${serviceName}:`];

  // 固定输出顺序，保持可读性
  const pushScalar = (key: string, value: unknown) => {
    if (value === undefined || value === '') return;
    lines.push(`    ${key}: ${yamlValue(value)}`);
  };

  pushScalar('image', config.image);
  pushScalar('container_name', config.containerName);
  pushScalar('command', config.command);
  pushScalar('entrypoint', config.entrypoint);
  if (config.detach === false) pushScalar('detach', false);

  pushList('ports', config.ports);
  pushList('expose', config.expose);

  pushMap('environment', config.environment);
  pushList('env_file', config.envFiles);

  pushList('volumes', config.volumes);
  pushList('tmpfs', config.tmpfs);
  pushList('networks', config.networks);

  pushScalar('restart', config.restart);
  pushScalar('working_dir', config.workdir);
  pushScalar('user', config.user);
  pushScalar('hostname', config.hostname);
  pushScalar('domainname', config.domainname);
  pushScalar('mac_address', config.macAddress);
  pushScalar('privileged', config.privileged);
  pushScalar('init', config.init);
  pushScalar('stdin_open', config.interactive);
  pushScalar('tty', config.tty);
  pushScalar('platform', config.platform);
  pushScalar('runtime', config.runtime);
  pushScalar('pull_policy', config.pullPolicy);

  pushMap('labels', config.labels);

  // deploy.resources
  const limits: Record<string, unknown> = {};
  if (config.cpus !== undefined) limits.cpus = String(config.cpus);
  if (config.memory) limits.memory = config.memory;
  if (config.memorySwap) limits.memorySwap = config.memorySwap;

  const reservations: Record<string, unknown> = {};
  if (config.gpus) {
    reservations.devices = [{ capabilities: ['gpu'], driver: config.gpus }];
  }

  if (Object.keys(limits).length > 0 || Object.keys(reservations).length > 0) {
    lines.push('    deploy:');
    lines.push('      resources:');
    if (Object.keys(limits).length > 0) {
      lines.push('        limits:');
      for (const [k, v] of Object.entries(limits)) {
        lines.push(`          ${k}: ${yamlValue(v)}`);
      }
    }
    if (Object.keys(reservations).length > 0) {
      lines.push('        reservations:');
      if (reservations.devices) {
        lines.push('          devices:');
        for (const device of reservations.devices as Record<string, unknown>[]) {
          lines.push('            - capabilities:');
          for (const cap of (device.capabilities as string[]) || []) {
            lines.push(`                - ${yamlValue(cap)}`);
          }
          if (device.driver) {
            lines.push(`              driver: ${yamlValue(device.driver)}`);
          }
        }
      }
    }
  }

  pushList('cap_add', config.capAdd);
  pushList('cap_drop', config.capDrop);
  pushList('security_opt', config.securityOpt);

  if (config.healthcheck && Object.keys(config.healthcheck).length > 0) {
    lines.push('    healthcheck:');
    if (config.healthcheck.disable) {
      lines.push('      disable: true');
    }
    if (config.healthcheck.test) {
      lines.push('      test:');
      for (const item of config.healthcheck.test) {
        lines.push(`        - ${yamlValue(item)}`);
      }
    }
    pushNestedScalar('interval', config.healthcheck.interval, 6);
    pushNestedScalar('timeout', config.healthcheck.timeout, 6);
    pushNestedScalar('retries', config.healthcheck.retries, 6);
    pushNestedScalar('start_period', config.healthcheck.startPeriod, 6);
  }

  if (config.logDriver || (config.logOpt && Object.keys(config.logOpt).length > 0)) {
    lines.push('    logging:');
    pushNestedScalar('driver', config.logDriver, 6);
    if (config.logOpt && Object.keys(config.logOpt).length > 0) {
      lines.push('      options:');
      for (const [k, v] of Object.entries(config.logOpt)) {
        lines.push(`        ${k}: ${yamlValue(v)}`);
      }
    }
  }

  // 不支持的 flag 以注释保留
  for (const flag of config.unsupportedFlags || []) {
    lines.push(`    # ⚠️ 不支持: ${flag.raw}${flag.reason ? ` (${flag.reason})` : ''}`);
  }

  return lines.join('\n');

  function pushList(key: string, list: string[] | undefined) {
    if (!list || list.length === 0) return;
    lines.push(`    ${key}:`);
    for (const item of list) {
      lines.push(`      - ${yamlValue(item)}`);
    }
  }

  function pushMap(key: string, map: Record<string, string> | undefined) {
    if (!map || Object.keys(map).length === 0) return;
    lines.push(`    ${key}:`);
    for (const [k, v] of Object.entries(map)) {
      lines.push(`      ${k}: ${yamlValue(v)}`);
    }
  }

  function pushNestedScalar(key: string, value: unknown, indent: number) {
    if (value === undefined || value === '') return;
    lines.push(`${' '.repeat(indent)}${key}: ${yamlValue(value)}`);
  }
}

/**
 * 将值格式化为 YAML 安全字符串。
 *
 * 需要引用的场景包括：空字符串、纯数字、布尔字面量、含特殊字符、首尾空格、含换行。
 */
function yamlValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);

  const str = String(value);

  if (str === '') return '""';
  if (/^(true|false|yes|no|on|off|null|~)$/i.test(str)) return `"${str}"`;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(str)) return `"${str}"`;
  if (/[:#{}[\],&*|>!%@`\n]|^\s|\s$/.test(str)) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test src/utils/docker/__tests__/run-to-compose.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/docker/run-to-compose.ts src/utils/docker/__tests__/run-to-compose.test.ts
git commit -m "feat(docker): add docker run to compose converter"
```

---

### Task 5: compose → docker run 转换器

**Files:**
- Create: `src/utils/docker/compose-to-run.ts`
- Create: `src/utils/docker/__tests__/compose-to-run.test.ts`

- [ ] **Step 1: 写入失败测试**

创建 `src/utils/docker/__tests__/compose-to-run.test.ts`：

```typescript
/**
 * docker compose → docker run 转换器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { convertComposeToRun } from '../compose-to-run';

const SAMPLE_COMPOSE = `services:
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
`;

describe('convertComposeToRun', () => {
  it('转换基本 compose 配置', () => {
    const result = convertComposeToRun(SAMPLE_COMPOSE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('docker run');
    expect(result.result).toContain('--name my-nginx');
    expect(result.result).toContain('-p 8080:80');
    expect(result.result).toContain('-v /host/path:/usr/share/nginx/html:ro');
    expect(result.result).toContain('-e NGINX_HOST=example.com');
    expect(result.result).toContain('--restart unless-stopped');
    expect(result.result).toContain('nginx:latest');
  });

  it('空输入返回中文错误', () => {
    const result = convertComposeToRun('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('请输入 docker compose 配置');
  });

  it('无 services 返回错误', () => {
    const result = convertComposeToRun('version: "3"');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('services');
  });

  it('services 为空返回错误', () => {
    const result = convertComposeToRun('services: {}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('没有定义任何服务');
  });

  it('YAML 语法错误返回错误信息', () => {
    const result = convertComposeToRun('services: { broken');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('无法映射的字段以注释保留', () => {
    const result = convertComposeToRun(`services:
  app:
    image: nginx
    build: .
    depends_on:
      - db
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('# ⚠️ 无法映射: build');
    expect(result.result).toContain('# ⚠️ 无法映射: depends_on');
  });

  it('多 service 时只转换第一个，其余以注释保留', () => {
    const result = convertComposeToRun(`services:
  web:
    image: nginx
  redis:
    image: redis:7
    ports:
      - "6379:6379"
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toContain('docker run --name web nginx');
    expect(result.result).toContain('# 以下 service 未转换（docker run 仅支持单容器）：');
    expect(result.result).toContain('# - redis');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test src/utils/docker/__tests__/compose-to-run.test.ts
```

Expected: FAIL，错误包含 `convertComposeToRun is not defined`。

- [ ] **Step 3: 实现转换器**

创建 `src/utils/docker/compose-to-run.ts`：

```typescript
/**
 * docker compose YAML → docker run 命令转换器。
 *
 * 流程：YAML 字符串 → js-yaml 解析 → 提取第一个 service → 拼接 docker run 命令。
 * 无法映射的 compose 字段和多 service 信息以 `# ⚠️` 注释保留。
 */

import { load } from 'js-yaml';
import type { ComposeToRunResult, DockerRunConfig } from './types';

/** 仅转换第一个 service */
const IGNORED_TOP_LEVEL_FIELDS = new Set([
  'version',
  'name',
  'include',
  'networks',
  'volumes',
  'configs',
  'secrets',
]);

/** 已从 DockerRunConfig 映射的 service 字段 */
const MAPPED_SERVICE_FIELDS = new Set([
  'image',
  'container_name',
  'command',
  'entrypoint',
  'ports',
  'expose',
  'environment',
  'env_file',
  'volumes',
  'tmpfs',
  'networks',
  'restart',
  'working_dir',
  'user',
  'hostname',
  'domainname',
  'mac_address',
  'privileged',
  'init',
  'stdin_open',
  'tty',
  'platform',
  'runtime',
  'pull_policy',
  'labels',
  'cap_add',
  'cap_drop',
  'security_opt',
  'healthcheck',
  'logging',
  'deploy',
]);

/**
 * 将 docker compose 配置转换为 docker run 命令。
 *
 * @param input - docker-compose.yml 内容
 * @returns 转换结果或错误信息
 */
export function convertComposeToRun(input: string): ComposeToRunResult {
  const trimmed = input.trim();

  if (trimmed === '') {
    return { ok: false, error: '请输入 docker compose 配置' };
  }

  let parsed: unknown;
  try {
    parsed = load(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `YAML 解析失败：${msg}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'YAML 内容为空或格式不正确' };
  }

  const root = parsed as Record<string, unknown>;

  if (!('services' in root) || root.services === undefined) {
    return { ok: false, error: '未找到 services 定义' };
  }

  if (
    !root.services ||
    typeof root.services !== 'object' ||
    Array.isArray(root.services) ||
    Object.keys(root.services).length === 0
  ) {
    return { ok: false, error: 'services 中没有定义任何服务' };
  }

  const services = root.services as Record<string, unknown>;
  const serviceNames = Object.keys(services);
  const firstName = serviceNames[0];
  const firstService = services[firstName];

  if (!firstService || typeof firstService !== 'object' || Array.isArray(firstService)) {
    return { ok: false, error: `service "${firstName}" 配置格式不正确` };
  }

  const service = firstService as Record<string, unknown>;
  const config = composeServiceToConfig(service);

  const unsupported: string[] = [];
  for (const key of Object.keys(service)) {
    if (!MAPPED_SERVICE_FIELDS.has(key)) {
      unsupported.push(key);
    }
  }

  const commandParts = buildCommand(firstName, config);
  const lines: string[] = [commandParts.join(' ')];

  for (const key of unsupported) {
    lines.push(`# ⚠️ 无法映射: ${key}`);
  }

  if (serviceNames.length > 1) {
    lines.push('# 以下 service 未转换（docker run 仅支持单容器）：');
    for (let i = 1; i < serviceNames.length; i++) {
      const name = serviceNames[i];
      const other = services[name];
      lines.push(`# - ${name}: ${summarizeService(other)}`);
    }
  }

  return {
    ok: true,
    result: lines.join('\n'),
    unsupportedCount: unsupported.length,
  };
}

/**
 * 将 compose service 对象转换为 DockerRunConfig 中间表示。
 */
function composeServiceToConfig(service: Record<string, unknown>): DockerRunConfig {
  const config: DockerRunConfig = {
    image: String(service.image || ''),
  };

  if (service.container_name) config.containerName = String(service.container_name);
  if (service.command) config.command = normalizeCommand(service.command);
  if (service.entrypoint) config.entrypoint = normalizeCommand(service.entrypoint);
  if (service.ports) config.ports = normalizeStringList(service.ports);
  if (service.expose) config.expose = normalizeStringList(service.expose);
  if (service.environment) config.environment = normalizeEnv(service.environment);
  if (service.env_file) config.envFiles = normalizeStringList(service.env_file);
  if (service.volumes) config.volumes = normalizeStringList(service.volumes);
  if (service.tmpfs) config.tmpfs = normalizeStringList(service.tmpfs);
  if (service.networks) config.networks = normalizeNetworks(service.networks);
  if (service.restart) config.restart = String(service.restart);
  if (service.working_dir) config.workdir = String(service.working_dir);
  if (service.user) config.user = String(service.user);
  if (service.hostname) config.hostname = String(service.hostname);
  if (service.domainname) config.domainname = String(service.domainname);
  if (service.mac_address) config.macAddress = String(service.mac_address);
  if (service.privileged === true) config.privileged = true;
  if (service.init === true) config.init = true;
  if (service.stdin_open === true) config.interactive = true;
  if (service.tty === true) config.tty = true;
  if (service.platform) config.platform = String(service.platform);
  if (service.runtime) config.runtime = String(service.runtime);
  if (service.pull_policy) config.pullPolicy = String(service.pull_policy);
  if (service.labels) config.labels = normalizeEnv(service.labels);
  if (service.cap_add) config.capAdd = normalizeStringList(service.cap_add);
  if (service.cap_drop) config.capDrop = normalizeStringList(service.cap_drop);
  if (service.security_opt) config.securityOpt = normalizeStringList(service.security_opt);

  if (service.healthcheck && typeof service.healthcheck === 'object' && !Array.isArray(service.healthcheck)) {
    const hc = service.healthcheck as Record<string, unknown>;
    config.healthcheck = {};
    if (hc.test) config.healthcheck.test = normalizeCommand(hc.test);
    if (hc.interval) config.healthcheck.interval = String(hc.interval);
    if (hc.timeout) config.healthcheck.timeout = String(hc.timeout);
    if (typeof hc.retries === 'number') config.healthcheck.retries = hc.retries;
    if (hc.start_period) config.healthcheck.startPeriod = String(hc.start_period);
    if (hc.disable === true) config.healthcheck.disable = true;
  }

  if (service.logging && typeof service.logging === 'object' && !Array.isArray(service.logging)) {
    const logging = service.logging as Record<string, unknown>;
    if (logging.driver) config.logDriver = String(logging.driver);
    if (logging.options && typeof logging.options === 'object' && !Array.isArray(logging.options)) {
      config.logOpt = normalizeEnv(logging.options);
    }
  }

  if (service.deploy && typeof service.deploy === 'object' && !Array.isArray(service.deploy)) {
    const deploy = service.deploy as Record<string, unknown>;
    if (deploy.resources && typeof deploy.resources === 'object' && !Array.isArray(deploy.resources)) {
      const resources = deploy.resources as Record<string, unknown>;
      if (resources.limits && typeof resources.limits === 'object' && !Array.isArray(resources.limits)) {
        const limits = resources.limits as Record<string, unknown>;
        if (limits.cpus !== undefined) config.cpus = Number(limits.cpus);
        if (limits.memory) config.memory = String(limits.memory);
        if (limits.memorySwap) config.memorySwap = String(limits.memorySwap);
      }
      if (
        resources.reservations &&
        typeof resources.reservations === 'object' &&
        !Array.isArray(resources.reservations)
      ) {
        const reservations = resources.reservations as Record<string, unknown>;
        if (Array.isArray(reservations.devices) && reservations.devices.length > 0) {
          const firstDevice = reservations.devices[0] as Record<string, unknown>;
          config.gpus = String(firstDevice.driver || 'all');
        }
      }
    }
  }

  return config;
}

/**
 * 将 DockerRunConfig 拼接为 docker run 命令参数数组。
 */
function buildCommand(serviceName: string, config: DockerRunConfig): string[] {
  const parts: string[] = ['docker', 'run'];

  if (config.detach) parts.push('-d');
  if (config.remove) parts.push('--rm');

  if (config.containerName) parts.push('--name', shellQuote(config.containerName));

  for (const port of config.ports || []) {
    parts.push('-p', shellQuote(port));
  }

  for (const expose of config.expose || []) {
    parts.push('--expose', shellQuote(expose));
  }

  for (const vol of config.volumes || []) {
    parts.push('-v', shellQuote(vol));
  }

  for (const tmpfs of config.tmpfs || []) {
    parts.push('--tmpfs', shellQuote(tmpfs));
  }

  for (const network of config.networks || []) {
    parts.push('--network', shellQuote(network));
  }

  for (const file of config.envFiles || []) {
    parts.push('--env-file', shellQuote(file));
  }

  for (const [k, v] of Object.entries(config.environment || {})) {
    const pair = v === '' ? k : `${k}=${v}`;
    parts.push('-e', shellQuote(pair));
  }

  for (const [k, v] of Object.entries(config.labels || {})) {
    const pair = v === '' ? k : `${k}=${v}`;
    parts.push('-l', shellQuote(pair));
  }

  if (config.restart) parts.push('--restart', shellQuote(config.restart));
  if (config.workdir) parts.push('-w', shellQuote(config.workdir));
  if (config.user) parts.push('-u', shellQuote(config.user));
  if (config.hostname) parts.push('-h', shellQuote(config.hostname));
  if (config.domainname) parts.push('--domainname', shellQuote(config.domainname));
  if (config.macAddress) parts.push('--mac-address', shellQuote(config.macAddress));
  if (config.platform) parts.push('--platform', shellQuote(config.platform));
  if (config.runtime) parts.push('--runtime', shellQuote(config.runtime));
  if (config.pullPolicy) parts.push('--pull', shellQuote(config.pullPolicy));

  if (config.privileged) parts.push('--privileged');
  if (config.init) parts.push('--init');
  if (config.interactive) parts.push('-i');
  if (config.tty) parts.push('-t');

  for (const cap of config.capAdd || []) {
    parts.push('--cap-add', shellQuote(cap));
  }

  for (const cap of config.capDrop || []) {
    parts.push('--cap-drop', shellQuote(cap));
  }

  for (const opt of config.securityOpt || []) {
    parts.push('--security-opt', shellQuote(opt));
  }

  if (config.cpus !== undefined) parts.push('--cpus', String(config.cpus));
  if (config.memory) parts.push('-m', shellQuote(config.memory));
  if (config.memorySwap) parts.push('--memory-swap', shellQuote(config.memorySwap));
  if (config.gpus) parts.push('--gpus', shellQuote(config.gpus));

  if (config.healthcheck) {
    const hc = config.healthcheck;
    if (hc.test && hc.test.length > 0) {
      const testValue = hc.test.join(' ');
      parts.push('--health-cmd', shellQuote(testValue));
    }
    if (hc.interval) parts.push('--health-interval', shellQuote(hc.interval));
    if (hc.timeout) parts.push('--health-timeout', shellQuote(hc.timeout));
    if (hc.retries !== undefined) parts.push('--health-retries', String(hc.retries));
    if (hc.startPeriod) parts.push('--health-start-period', shellQuote(hc.startPeriod));
    if (hc.disable) parts.push('--no-healthcheck');
  }

  if (config.logDriver) parts.push('--log-driver', shellQuote(config.logDriver));
  for (const [k, v] of Object.entries(config.logOpt || {})) {
    parts.push('--log-opt', shellQuote(`${k}=${v}`));
  }

  if (config.entrypoint) {
    const ep = Array.isArray(config.entrypoint) ? config.entrypoint.join(' ') : config.entrypoint;
    parts.push('--entrypoint', shellQuote(ep));
  }

  parts.push(shellQuote(config.image || serviceName));

  if (config.command && config.command.length > 0) {
    parts.push(...config.command.map((c) => shellQuote(c)));
  }

  return parts;
}

/**
 * 判断值是否需要 shell 引号。
 */
function shellQuote(value: string): string {
  if (value === '') return '""';
  if (/^[a-zA-Z0-9_\-./:=@]+$/.test(value)) return value;
  return `"${value.replace(/([\\$"`])/g, '\\$1')}"`;
}

/**
 * 标准化 command 字段：支持字符串或数组。
 */
function normalizeCommand(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim().split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}

/**
 * 标准化字符串列表字段。
 */
function normalizeStringList(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.map(String);
  return [];
}

/**
 * 标准化 environment / labels 字段。
 */
function normalizeEnv(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  if (Array.isArray(value)) {
    for (const item of value) {
      const str = String(item);
      const idx = str.indexOf('=');
      if (idx >= 0) {
        result[str.slice(0, idx)] = str.slice(idx + 1);
      } else {
        result[str] = '';
      }
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      result[k] = v === null || v === undefined ? '' : String(v);
    }
  }

  return result;
}

/**
 * 标准化 networks 字段：支持数组或对象格式。
 */
function normalizeNetworks(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return Object.keys(value);
  return [];
}

/**
 * 简要概括 service 配置，用于多 service 提示。
 */
function summarizeService(service: unknown): string {
  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    return '(empty)';
  }

  const s = service as Record<string, unknown>;
  const parts: string[] = [];

  if (s.image) parts.push(`image=${s.image}`);
  if (s.ports) parts.push(`ports=${normalizeStringList(s.ports).join(',')}`);
  if (s.volumes) parts.push(`volumes=${normalizeStringList(s.volumes).length}个`);

  return parts.length > 0 ? parts.join(', ') : '(no key info)';
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test src/utils/docker/__tests__/compose-to-run.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/docker/compose-to-run.ts src/utils/docker/__tests__/compose-to-run.test.ts
git commit -m "feat(docker): add compose to docker run converter"
```

---

### Task 6: 工具注册与 FAQ

**Files:**
- Modify: `src/data/tools.ts` — `ToolCategory` 类型（第 2-14 行）、`categorySlugMap`（第 17-30 行）、`tools` 数组（第 311 行后）
- Modify: `src/data/tool-faqs.ts` — `toolFaqs` 对象（第 10-187 行）

- [ ] **Step 1: 在 `ToolCategory` 中新增 `'DevOps 工具'`**

修改 `src/data/tools.ts` 第 14 行：

```typescript
export type ToolCategory =
  | '编码转换'
  | '加密哈希'
  | '格式化'
  | '文本处理'
  | '正则工具'
  | '网络工具'
  | '颜色工具'
  | '日期时间'
  | 'CSS 工具'
  | 'API 工具'
  | '媒体工具'
  | '编辑器'
  | 'DevOps 工具';
```

- [ ] **Step 2: 在 `categorySlugMap` 中新增 slug 映射**

修改 `src/data/tools.ts` 第 29 行后追加：

```typescript
  '编辑器': 'editor',
  'DevOps 工具': 'devops',
```

完整 `categorySlugMap` 应为：

```typescript
export const categorySlugMap: Record<ToolCategory, string> = {
  '编码转换': 'encoding',
  '加密哈希': 'crypto',
  '格式化': 'format',
  '文本处理': 'text',
  '正则工具': 'regex',
  '网络工具': 'network',
  '颜色工具': 'color',
  '日期时间': 'datetime',
  'CSS 工具': 'css',
  'API 工具': 'api',
  '媒体工具': 'media',
  '编辑器': 'editor',
  'DevOps 工具': 'devops',
};
```

- [ ] **Step 3: 在 `tools` 数组末尾注册工具**

在 `src/data/tools.ts` 第 310 行（`markdown-editor` 条目）之后、第 311 行 `];` 之前插入：

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
  },
```

- [ ] **Step 4: 在 `toolFaqs` 中新增 FAQ**

修改 `src/data/tool-faqs.ts`，在第 187 行 `};` 之前插入：

```typescript
  'docker-converter': [
    {
      question: 'docker run 的 `--rm` flag 在 compose 中如何表示？',
      answer: 'Compose v2 规范中没有直接等价的字段。转换时会以注释形式保留，提醒你 compose 默认使用 <code>docker compose up/down</code> 管理容器生命周期，不需要 <code>--rm</code>。',
    },
    {
      question: '为什么有些 flag 被注释掉了？',
      answer: '当前工具尚未支持所有 docker run flag，不支持的 flag 会以注释形式保留在输出中，确保信息不丢失。后续版本会逐步扩展支持范围。',
    },
    {
      question: 'compose → run 转换只处理第一个 service 吗？',
      answer: '是的。<code>docker run</code> 命令只能启动单个容器，所以 compose → run 方向会转换第一个 service。如果有多个 service，其余 service 的配置会以注释形式附加在输出末尾供参考。',
    },
    {
      question: '生成的 compose 文件不写 <code>version</code> 字段吗？',
      answer: '不写。自 Docker Compose v2 起，<code>version</code> 字段已弃用，当前推荐做法是不指定 version，使用最新的 Compose 规范格式。',
    },
  ],
```

- [ ] **Step 5: 运行 TypeScript 类型检查**

```bash
pnpm astro check
```

Expected: 无与 `tools.ts` / `tool-faqs.ts` 相关的类型错误。

- [ ] **Step 6: Commit**

```bash
git add src/data/tools.ts src/data/tool-faqs.ts
git commit -m "feat(docker): register docker-converter tool and add FAQs"
```

---

### Task 7: Vue 工具组件

**Files:**
- Create: `src/tools/devops/DockerConverter.vue`

- [ ] **Step 1: 创建 `src/tools/devops/DockerConverter.vue`**

```vue
<script setup lang="ts">
/**
 * Docker Run ↔ Compose 转换器主组件。
 *
 * 提供双 Tab 界面：run → compose 与 compose → run。
 * 点击「转换」按钮触发转换，输出为只读 textarea 并提供复制。
 */
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { convertRunToCompose } from '../../utils/docker/run-to-compose';
import { convertComposeToRun } from '../../utils/docker/compose-to-run';

type Mode = 'run-to-compose' | 'compose-to-run';

const MODE_OPTIONS = [
  { key: 'run-to-compose', label: 'run → compose' },
  { key: 'compose-to-run', label: 'compose → run' },
];

/** run → compose 默认示例 */
const DEFAULT_RUN_INPUT = 'docker run -d --name my-nginx -p 8080:80 -v /host/path:/usr/share/nginx/html:ro --restart unless-stopped -e NGINX_HOST=example.com nginx:latest';

/** compose → run 默认示例 */
const DEFAULT_COMPOSE_INPUT = `services:
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
`;

/** 当前模式 */
const mode = ref<Mode>('run-to-compose');
/** 输入内容 */
const input = ref(DEFAULT_RUN_INPUT);
/** 转换输出 */
const output = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** 不支持/无法映射的项数量 */
const unsupportedCount = ref(0);

/**
 * 执行转换。
 */
function handleConvert(): void {
  errorMsg.value = '';
  output.value = '';
  unsupportedCount.value = 0;

  if (!input.value.trim()) {
    errorMsg.value = mode.value === 'run-to-compose'
      ? '请输入 docker run 命令'
      : '请输入 docker compose 配置';
    return;
  }

  const result = mode.value === 'run-to-compose'
    ? convertRunToCompose(input.value)
    : convertComposeToRun(input.value);

  if (!result.ok) {
    errorMsg.value = result.error;
    return;
  }

  output.value = result.result;
  unsupportedCount.value = result.unsupportedCount;
}

/**
 * 清空输入、输出和错误状态。
 */
function handleClear(): void {
  input.value = '';
  output.value = '';
  errorMsg.value = '';
  unsupportedCount.value = 0;
}

/**
 * 填入当前模式的默认示例。
 */
function fillExample(): void {
  input.value = mode.value === 'run-to-compose' ? DEFAULT_RUN_INPUT : DEFAULT_COMPOSE_INPUT;
  output.value = '';
  errorMsg.value = '';
  unsupportedCount.value = 0;
}

/**
 * 切换模式时重置为对应默认值。
 */
watch(mode, () => {
  input.value = mode.value === 'run-to-compose' ? DEFAULT_RUN_INPUT : DEFAULT_COMPOSE_INPUT;
  output.value = '';
  errorMsg.value = '';
  unsupportedCount.value = 0;
});

/** 输入区标签 */
const inputLabel = computed(() =>
  mode.value === 'run-to-compose' ? 'docker run 命令' : 'docker compose 配置',
);

/** 输出区标签 */
const outputLabel = computed(() =>
  mode.value === 'run-to-compose' ? 'docker-compose.yml' : 'docker run 命令',
);

/** 转换按钮文案 */
const convertLabel = computed(() =>
  mode.value === 'run-to-compose' ? '转换为 Compose' : '转换为 Run',
);

/** 不支持提示文案 */
const unsupportedHint = computed(() => unsupportedCount.value > 0
  ? `输出中包含 ${unsupportedCount.value} 个不支持的项，已以注释形式保留`
  : '',
);
</script>

<template>
  <div>
    <ToolHeader
      title="Docker Run ↔ Compose 转换器"
      description="在 docker run 命令与 docker compose 配置之间互转"
      @example="fillExample"
    />

    <ModeTabGroup v-model="mode" :options="MODE_OPTIONS" />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #input>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">{{ inputLabel }}</label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            :placeholder="mode === 'run-to-compose' ? '输入 docker run 命令...' : '粘贴 docker-compose.yml...'"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 transition-[opacity] duration-150"
            @click="handleConvert"
          >
            {{ convertLabel }}
          </button>
          <ClearButton @clear="handleClear" />
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mt-3">{{ errorMsg }}</p>
      </template>

      <template #output>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">{{ outputLabel }}</label>
          <textarea
            v-model="output"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            readonly
            :placeholder="output ? '' : '点击「转换」查看结果'"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="flex flex-wrap gap-2 items-center justify-between">
          <CopyButton :text="output" label="复制结果" />
          <span v-if="unsupportedHint" class="text-[0.75rem] text-muted">{{ unsupportedHint }}</span>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

注意：上面的组件使用了 `computed`，但忘记导入。请在 `<script setup>` 顶部添加：

```typescript
import { ref, watch, computed } from 'vue';
```

完整顶部导入应为：

```typescript
import { ref, watch, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { convertRunToCompose } from '../../utils/docker/run-to-compose';
import { convertComposeToRun } from '../../utils/docker/compose-to-run';
```

- [ ] **Step 2: 运行 TypeScript 类型检查**

```bash
pnpm astro check
```

Expected: 无与 `DockerConverter.vue` 相关的类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/tools/devops/DockerConverter.vue
git commit -m "feat(docker): add DockerConverter Vue component"
```

---

### Task 8: Astro 页面路由

**Files:**
- Create: `src/pages/devops/docker-converter.astro`

- [ ] **Step 1: 创建页面目录和文件**

```bash
mkdir -p src/pages/devops
```

创建 `src/pages/devops/docker-converter.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import DockerConverter from '../../tools/devops/DockerConverter.vue';
---

<ToolLayout toolId="devops/docker-converter">
  <DockerConverter client:idle />
</ToolLayout>
```

- [ ] **Step 2: 启动开发服务器验证**

```bash
pnpm dev
```

在浏览器打开 `http://localhost:4321/devops/docker-converter`，验证：
1. 页面标题显示 "Docker Run ↔ Compose 转换器"
2. 默认显示 run → compose Tab 和示例命令
3. 点击「转换为 Compose」生成 YAML
4. 切换到 compose → run Tab，点击「转换为 Run」生成 docker run 命令
5. 复制按钮工作正常
6. 清空按钮清空输入输出
7. 页面底部 FAQ 区域显示 4 个问答

- [ ] **Step 3: 运行全量测试**

```bash
pnpm test
```

Expected: 所有测试通过，包含新增的 docker 相关测试。

- [ ] **Step 4: 运行生产构建**

```bash
pnpm build
```

Expected: 构建成功，无类型错误和路由错误。

- [ ] **Step 5: Commit**

```bash
git add src/pages/devops/docker-converter.astro
git commit -m "feat(docker): add docker-converter page route"
```

---

## Self-Review

**1. Spec coverage**

| 规格要求 | 对应任务 |
|----------|----------|
| 新增 DevOps 分类，slug 为 devops | Task 6 |
| 工具 ID、SEO、keywords、relatedToolIds | Task 6 |
| 双 Tab 模式 run → compose / compose → run | Task 7 |
| 手写状态机 shell 分词器 | Task 2 |
| 支持 ~35 个常用 flag 映射 | Task 3 + Task 4 |
| run → compose 输出无 version 字段 | Task 4 |
| 不支持 flag 以 `# ⚠️ 不支持` 注释保留 | Task 4 |
| compose → run 使用 js-yaml 解析 | Task 5 |
| 多 service 只转第一个，其余注释保留 | Task 5 |
| 无法映射字段以 `# ⚠️ 无法映射` 注释保留 | Task 5 |
| 中文错误提示与精确位置 | Task 2 + Task 4 + Task 5 |
| 默认值预填 | Task 7 |
| 清空/复制按钮 | Task 7 |
| FAQ 4 条 | Task 6 |
| 水合策略 client:idle | Task 8 |

**2. Placeholder scan**

- 无 "TBD" / "TODO" / "implement later" / "fill in details"
- 无 "Add appropriate error handling" 等空泛描述
- 每个代码变更步骤均附完整代码块
- 所有任务文件路径精确

**3. Type consistency**

- `DockerRunConfig` 与 `UnsupportedFlag` 定义于 `types.ts`，被 `run-to-compose.ts`、`compose-to-run.ts`、`DockerConverter.vue` 消费，字段名一致。
- `FlagDefinition` 定义于 `flag-registry.ts`，`findFlag` 签名在 Task 3 和 Task 4 中一致。
- 转换结果返回类型 `RunToComposeResult` / `ComposeToRunResult` 在 types.ts 中定义并被对应模块使用。
- `TokenizeResult` 在 types.ts 中定义，被 `tokenizer.ts` 使用。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-docker-converter.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

- [ ] **Subagent-Driven**
- [ ] **Inline Execution**

---

## 附录：快速验证命令清单

```bash
# 单独测试分词器
pnpm test src/utils/docker/__tests__/tokenizer.test.ts

# 单独测试 run → compose
pnpm test src/utils/docker/__tests__/run-to-compose.test.ts

# 单独测试 compose → run
pnpm test src/utils/docker/__tests__/compose-to-run.test.ts

# 全量测试
pnpm test

# 类型检查
pnpm astro check

# 生产构建
pnpm build

# 开发服务器
pnpm dev
```
