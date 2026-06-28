# Docker Run 命令助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 DevOps 分类下新增一个 `/devops/docker-run-helper` 工具页，提供 docker run 命令表单生成器与常用 flag 分类速查表。

**Architecture:** 核心逻辑封装为纯 TypeScript 工具函数（`generate-run-command.ts` + `run-flags-data.ts`），Vue 组件仅负责表单状态与展示；工具页由 Astro 路由包装 Vue 主组件。所有运算在浏览器端完成，不引入新依赖。

**Tech Stack:** Astro 6 + Vue 3 + TypeScript + Tailwind CSS v4 + @headlessui/vue + Vitest

## Global Constraints

- TypeScript strict 模式。
- 所有导入使用相对路径，禁止使用 `@/` 或 `~/` 别名。
- 新增公共类/接口/函数必须写 JSDoc/TSDoc 文档注释。
- 样式使用 Tailwind 标准类名，禁止能用标准类名表示的任意值语法（`w-[120px]` → `w-30`）。
- 不使用 `eval()`、`Function()` 处理用户输入。
- 单元测试放在被测模块所在目录的 `__tests__/` 子目录中。
- 每个 commit 消息末尾追加 `Co-Authored-By: Claude <noreply@anthropic.com>`。

---

## File Structure

```
src/
├── pages/devops/docker-run-helper.astro      # Astro 路由入口
├── tools/devops/
│   ├── DockerRunHelper.vue                   # 工具主组件
│   └── docker-run-form/
│       ├── RunGenerator.vue                  # 生成器表单 + 命令输出
│       └── FlagReference.vue                 # 参数速查表
├── utils/docker/
│   ├── generate-run-command.ts               # 命令生成核心逻辑
│   ├── run-flags-data.ts                     # flag 数据
│   └── __tests__/
│       ├── generate-run-command.test.ts
│       └── run-flags-data.test.ts
├── data/tools.ts                             # 注册新工具
└── data/tool-faqs.ts                         # 不修改，本工具无 FAQ
```

---

### Task 1: 实现 `docker run` 命令生成器核心函数

**Files:**
- Create: `src/utils/docker/generate-run-command.ts`
- Test: `src/utils/docker/__tests__/generate-run-command.test.ts`

**Interfaces:**
- Consumes: 无外部依赖，纯函数。
- Produces:
  - `interface PortMapping { host: string; container: string; protocol: 'tcp' | 'udp'; }`
  - `interface EnvVar { key: string; value: string; }`
  - `interface VolumeMount { host: string; container: string; mode: '' | 'ro' | 'rw'; }`
  - `interface FormState { image: string; tag: string; name: string; ports: PortMapping[]; envs: EnvVar[]; volumes: VolumeMount[]; workdir: string; restart: '' | 'no' | 'always' | 'unless-stopped' | 'on-failure'; network: '' | 'bridge' | 'host' | 'none' | 'container:'; detach: boolean; interactive: boolean; tty: boolean; rm: boolean; extraArgs: string; }`
  - `function generateDockerRunCommand(state: FormState): string`
  - `function escapeShellArg(value: string): string`

- [ ] **Step 1: 编写失败测试**

创建 `src/utils/docker/__tests__/generate-run-command.test.ts`：

```ts
/**
 * docker run 命令生成器单元测试。
 */
import { describe, it, expect } from 'vitest';
import { generateDockerRunCommand, escapeShellArg } from '../generate-run-command';
import type { FormState } from '../generate-run-command';

function createState(overrides: Partial<FormState> = {}): FormState {
  return {
    image: 'nginx',
    tag: 'latest',
    name: '',
    ports: [],
    envs: [],
    volumes: [],
    workdir: '',
    restart: '',
    network: '',
    detach: false,
    interactive: false,
    tty: false,
    rm: false,
    extraArgs: '',
    ...overrides,
  };
}

describe('generateDockerRunCommand', () => {
  it('最小命令只包含镜像名和默认 latest 标签', () => {
    expect(generateDockerRunCommand(createState())).toBe('docker run nginx:latest');
  });

  it('自定义标签', () => {
    expect(generateDockerRunCommand(createState({ tag: '1.25' }))).toBe('docker run nginx:1.25');
  });

  it('后台运行与自动删除', () => {
    const state = createState({ detach: true, rm: true });
    expect(generateDockerRunCommand(state)).toBe('docker run -d --rm nginx:latest');
  });

  it('容器名称', () => {
    expect(generateDockerRunCommand(createState({ name: 'my-nginx' }))).toBe(
      'docker run --name my-nginx nginx:latest',
    );
  });

  it('端口映射', () => {
    const state = createState({
      ports: [
        { host: '8080', container: '80', protocol: 'tcp' },
        { host: '8443', container: '443', protocol: 'tcp' },
      ],
    });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -p 8080:80/tcp -p 8443:443/tcp nginx:latest',
    );
  });

  it('环境变量', () => {
    const state = createState({ envs: [{ key: 'NODE_ENV', value: 'production' }] });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -e NODE_ENV=production nginx:latest',
    );
  });

  it('环境变量值含空格时使用单引号包裹', () => {
    const state = createState({ envs: [{ key: 'GREETING', value: 'hello world' }] });
    expect(generateDockerRunCommand(state)).toBe(
      "docker run -e GREETING='hello world' nginx:latest",
    );
  });

  it('挂载卷', () => {
    const state = createState({
      volumes: [{ host: '/host/data', container: '/data', mode: 'ro' }],
    });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -v /host/data:/data:ro nginx:latest',
    );
  });

  it('完整示例按固定顺序输出', () => {
    const state = createState({
      image: 'nginx',
      tag: 'latest',
      name: 'my-nginx',
      detach: true,
      rm: true,
      restart: 'unless-stopped',
      network: 'bridge',
      workdir: '/app',
      ports: [{ host: '8080', container: '80', protocol: 'tcp' }],
      envs: [{ key: 'NGINX_HOST', value: 'example.com' }],
      volumes: [{ host: '/host/html', container: '/usr/share/nginx/html', mode: 'ro' }],
      extraArgs: '',
    });
    expect(generateDockerRunCommand(state)).toBe(
      'docker run -d --rm --name my-nginx --restart unless-stopped --network bridge -p 8080:80/tcp -e NGINX_HOST=example.com -v /host/html:/usr/share/nginx/html:ro -w /app nginx:latest',
    );
  });

  it('镜像名为空时返回空字符串', () => {
    expect(generateDockerRunCommand(createState({ image: '' }))).toBe('');
  });

  it('交互式终端 it', () => {
    expect(generateDockerRunCommand(createState({ interactive: true, tty: true }))).toBe(
      'docker run -it nginx:latest',
    );
  });

  it('额外参数追加在镜像名之后', () => {
    expect(generateDockerRunCommand(createState({ extraArgs: 'bash' }))).toBe(
      'docker run nginx:latest bash',
    );
  });
});

describe('escapeShellArg', () => {
  it('无特殊字符不添加引号', () => {
    expect(escapeShellArg('nginx')).toBe('nginx');
  });

  it('包含空格用单引号包裹', () => {
    expect(escapeShellArg('hello world')).toBe("'hello world'");
  });

  it('包含单引号时转义', () => {
    expect(escapeShellArg("it's ok")).toBe("'it'\\''s ok'");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/docker/__tests__/generate-run-command.test.ts`

Expected: FAIL，提示 `generateDockerRunCommand` 和 `escapeShellArg` 未定义或行为不符。

- [ ] **Step 3: 实现最小代码**

创建 `src/utils/docker/generate-run-command.ts`：

```ts
/**
 * Docker run 命令生成器。
 *
 * 根据表单状态生成可复制的 `docker run` 命令字符串。
 */

/** 端口映射配置 */
export interface PortMapping {
  /** 主机端口 */
  host: string;
  /** 容器端口 */
  container: string;
  /** 协议 */
  protocol: 'tcp' | 'udp';
}

/** 环境变量配置 */
export interface EnvVar {
  /** 变量名 */
  key: string;
  /** 变量值 */
  value: string;
}

/** 卷挂载配置 */
export interface VolumeMount {
  /** 主机路径 */
  host: string;
  /** 容器路径 */
  container: string;
  /** 挂载模式 */
  mode: '' | 'ro' | 'rw';
}

/** 生成器表单完整状态 */
export interface FormState {
  /** 镜像名称 */
  image: string;
  /** 镜像标签 */
  tag: string;
  /** 容器名称 */
  name: string;
  /** 端口映射列表 */
  ports: PortMapping[];
  /** 环境变量列表 */
  envs: EnvVar[];
  /** 卷挂载列表 */
  volumes: VolumeMount[];
  /** 工作目录 */
  workdir: string;
  /** 重启策略 */
  restart: '' | 'no' | 'always' | 'unless-stopped' | 'on-failure';
  /** 网络模式 */
  network: '' | 'bridge' | 'host' | 'none' | 'container:';
  /** 是否后台运行 */
  detach: boolean;
  /** 是否交互模式 */
  interactive: boolean;
  /** 是否分配伪终端 */
  tty: boolean;
  /** 停止后是否自动删除 */
  rm: boolean;
  /** 镜像名后的额外参数 */
  extraArgs: string;
}

/**
 * 对 shell 参数值进行转义。
 *
 * 若值包含空格或单引号，使用单引号包裹并将内部单引号替换为 `'\''`。
 *
 * @param value 原始值
 * @returns 转义后的值
 */
export function escapeShellArg(value: string): string {
  if (value === '') return "''";
  if (!/[\s'"\\]/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * 根据表单状态生成 `docker run` 命令。
 *
 * @param state 表单状态
 * @returns 生成的命令字符串；镜像名为空时返回空字符串
 */
export function generateDockerRunCommand(state: FormState): string {
  if (!state.image.trim()) {
    return '';
  }

  const parts: string[] = ['docker', 'run'];

  if (state.detach) parts.push('-d');
  if (state.rm) parts.push('--rm');
  if (state.interactive && state.tty) {
    parts.push('-it');
  } else {
    if (state.interactive) parts.push('-i');
    if (state.tty) parts.push('-t');
  }

  if (state.name.trim()) parts.push('--name', state.name.trim());
  if (state.restart) parts.push('--restart', state.restart);
  if (state.network) parts.push('--network', state.network);

  state.ports.forEach((port) => {
    const protocol = port.protocol || 'tcp';
    parts.push('-p', `${port.host}:${port.container}/${protocol}`);
  });

  state.envs.forEach((env) => {
    if (env.key.trim()) {
      parts.push('-e', `${env.key.trim()}=${escapeShellArg(env.value)}`);
    }
  });

  state.volumes.forEach((vol) => {
    if (vol.host.trim() || vol.container.trim()) {
      const modeSuffix = vol.mode ? `:${vol.mode}` : '';
      parts.push('-v', `${vol.host.trim()}:${vol.container.trim()}${modeSuffix}`);
    }
  });

  if (state.workdir.trim()) parts.push('-w', state.workdir.trim());

  const tag = state.tag.trim() || 'latest';
  parts.push(`${state.image.trim()}:${tag}`);

  if (state.extraArgs.trim()) {
    parts.push(state.extraArgs.trim());
  }

  return parts.join(' ');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/docker/__tests__/generate-run-command.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/docker/generate-run-command.ts src/utils/docker/__tests__/generate-run-command.test.ts
git commit -m "feat(docker): 实现 docker run 命令生成器核心函数

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 实现 `docker run` flag 速查数据

**Files:**
- Create: `src/utils/docker/run-flags-data.ts`
- Test: `src/utils/docker/__tests__/run-flags-data.test.ts`

**Interfaces:**
- Consumes: 无外部依赖。
- Produces:
  - `type RunFlagCategory = '基础运行' | '网络' | '存储' | '环境变量' | '资源限制' | '重启与生命周期' | '安全与权限' | '日志与监控' | '其他常用'`
  - `interface RunFlagEntry { flag: string; category: RunFlagCategory; description: string; example: string; }`
  - `const RUN_FLAG_CATEGORIES: RunFlagCategory[]`
  - `const RUN_FLAGS: RunFlagEntry[]`

- [ ] **Step 1: 编写失败测试**

创建 `src/utils/docker/__tests__/run-flags-data.test.ts`：

```ts
/**
 * docker run flag 速查数据单元测试。
 */
import { describe, it, expect } from 'vitest';
import { RUN_FLAGS, RUN_FLAG_CATEGORIES } from '../run-flags-data';

describe('run-flags-data', () => {
  it('包含至少 30 条 flag 数据', () => {
    expect(RUN_FLAGS.length).toBeGreaterThanOrEqual(30);
  });

  it('每条数据都有 flag、category、description、example', () => {
    RUN_FLAGS.forEach((entry) => {
      expect(entry.flag).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.example).toBeTruthy();
      expect(RUN_FLAG_CATEGORIES).toContain(entry.category);
    });
  });

  it('没有重复的 flag 名称', () => {
    const flags = RUN_FLAGS.map((e) => e.flag);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it('包含核心 flag', () => {
    const flags = RUN_FLAGS.map((e) => e.flag);
    expect(flags).toContain('-d, --detach');
    expect(flags).toContain('-p, --publish');
    expect(flags).toContain('-e, --env');
    expect(flags).toContain('-v, --volume');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/utils/docker/__tests__/run-flags-data.test.ts`

Expected: FAIL，提示模块未找到或数据为空。

- [ ] **Step 3: 实现数据文件**

创建 `src/utils/docker/run-flags-data.ts`：

```ts
/**
 * docker run 常用 flag 速查数据。
 *
 * 按分类整理最常用的 flag，用于 Docker Run 命令助手页面的速查表。
 */

/** flag 分类 */
export type RunFlagCategory =
  | '基础运行'
  | '网络'
  | '存储'
  | '环境变量'
  | '资源限制'
  | '重启与生命周期'
  | '安全与权限'
  | '日志与监控'
  | '其他常用';

/** 单条 flag 条目 */
export interface RunFlagEntry {
  /** flag 名称，如 `-p, --publish` */
  flag: string;
  /** 所属分类 */
  category: RunFlagCategory;
  /** 中文说明，要求简洁 */
  description: string;
  /** 示例命令 */
  example: string;
}

/** 所有分类顺序 */
export const RUN_FLAG_CATEGORIES: RunFlagCategory[] = [
  '基础运行',
  '网络',
  '存储',
  '环境变量',
  '资源限制',
  '重启与生命周期',
  '安全与权限',
  '日志与监控',
  '其他常用',
];

/** 常用 docker run flag 列表 */
export const RUN_FLAGS: RunFlagEntry[] = [
  // 基础运行
  { flag: '-d, --detach', category: '基础运行', description: '后台运行容器', example: 'docker run -d nginx' },
  { flag: '--name', category: '基础运行', description: '指定容器名称', example: 'docker run --name my-nginx nginx' },
  { flag: '--rm', category: '基础运行', description: '停止后自动删除容器', example: 'docker run --rm nginx' },
  { flag: '-it', category: '基础运行', description: '以交互式终端运行', example: 'docker run -it ubuntu bash' },
  { flag: '-w, --workdir', category: '基础运行', description: '设置容器内工作目录', example: 'docker run -w /app node' },
  { flag: '--entrypoint', category: '基础运行', description: '覆盖镜像默认入口命令', example: 'docker run --entrypoint sh nginx' },

  // 网络
  { flag: '-p, --publish', category: '网络', description: '将主机端口映射到容器端口', example: 'docker run -p 8080:80 nginx' },
  { flag: '-P, --publish-all', category: '网络', description: '暴露 Dockerfile 中所有 EXPOSE 端口到随机主机端口', example: 'docker run -P nginx' },
  { flag: '--network', category: '网络', description: '指定容器网络模式', example: 'docker run --network host nginx' },
  { flag: '--hostname', category: '网络', description: '设置容器主机名', example: 'docker run --hostname web nginx' },
  { flag: '--dns', category: '网络', description: '自定义 DNS 服务器', example: 'docker run --dns 8.8.8.8 nginx' },
  { flag: '--expose', category: '网络', description: '声明容器运行时开放的端口', example: 'docker run --expose 8080 nginx' },
  { flag: '--link', category: '网络', description: '链接到另一个容器（旧版方式）', example: 'docker run --link db:mysql app' },

  // 存储
  { flag: '-v, --volume', category: '存储', description: '挂载主机目录或数据卷到容器', example: 'docker run -v /data:/app/data nginx' },
  { flag: '--mount', category: '存储', description: '以更详细的语法挂载存储', example: 'docker run --mount type=bind,src=/data,dst=/app/data nginx' },
  { flag: '--tmpfs', category: '存储', description: '挂载 tmpfs 临时文件系统', example: 'docker run --tmpfs /tmp:rw,noexec,nosuid,size=100m nginx' },
  { flag: '--read-only', category: '存储', description: '将容器根文件系统设为只读', example: 'docker run --read-only nginx' },

  // 环境变量
  { flag: '-e, --env', category: '环境变量', description: '设置环境变量', example: 'docker run -e NODE_ENV=production node' },
  { flag: '--env-file', category: '环境变量', description: '从文件读取环境变量', example: 'docker run --env-file .env node' },

  // 资源限制
  { flag: '-m, --memory', category: '资源限制', description: '限制容器可用内存', example: 'docker run -m 512m nginx' },
  { flag: '--memory-swap', category: '资源限制', description: '限制内存加交换分区总量', example: 'docker run -m 512m --memory-swap 1g nginx' },
  { flag: '--cpus', category: '资源限制', description: '限制容器可用 CPU 核心数', example: 'docker run --cpus 1.5 nginx' },
  { flag: '--cpu-shares', category: '资源限制', description: '设置 CPU 相对权重', example: 'docker run --cpu-shares 512 nginx' },
  { flag: '--pids-limit', category: '资源限制', description: '限制容器内进程数', example: 'docker run --pids-limit 100 nginx' },

  // 重启与生命周期
  { flag: '--restart', category: '重启与生命周期', description: '设置容器退出后的重启策略', example: 'docker run --restart unless-stopped nginx' },
  { flag: '--stop-signal', category: '重启与生命周期', description: '指定停止容器时发送的信号', example: 'docker run --stop-signal SIGTERM nginx' },
  { flag: '--stop-timeout', category: '重启与生命周期', description: '设置停止容器前的等待秒数', example: 'docker run --stop-timeout 30 nginx' },

  // 安全与权限
  { flag: '--privileged', category: '安全与权限', description: '授予容器扩展权限', example: 'docker run --privileged ubuntu' },
  { flag: '--cap-add', category: '安全与权限', description: '添加 Linux 能力', example: 'docker run --cap-add NET_ADMIN ubuntu' },
  { flag: '--cap-drop', category: '安全与权限', description: '移除 Linux 能力', example: 'docker run --cap-drop ALL ubuntu' },
  { flag: '-u, --user', category: '安全与权限', description: '指定运行用户', example: 'docker run -u 1000:1000 nginx' },
  { flag: '--group-add', category: '安全与权限', description: '添加用户组', example: 'docker run --group-add video nginx' },
  { flag: '--security-opt', category: '安全与权限', description: '设置安全选项', example: 'docker run --security-opt no-new-privileges:true nginx' },

  // 日志与监控
  { flag: '--log-driver', category: '日志与监控', description: '指定日志驱动', example: 'docker run --log-driver json-file nginx' },
  { flag: '--log-opt', category: '日志与监控', description: '设置日志驱动选项', example: 'docker run --log-opt max-size=10m nginx' },
  { flag: '--health-cmd', category: '日志与监控', description: '设置健康检查命令', example: 'docker run --health-cmd "curl -f http://localhost/" nginx' },
  { flag: '--health-interval', category: '日志与监控', description: '设置健康检查间隔', example: 'docker run --health-cmd "true" --health-interval 30s nginx' },

  // 其他常用
  { flag: '-l, --label', category: '其他常用', description: '为容器添加元数据标签', example: 'docker run -l env=prod nginx' },
  { flag: '--label-file', category: '其他常用', description: '从文件读取标签', example: 'docker run --label-file labels.txt nginx' },
  { flag: '--add-host', category: '其他常用', description: '添加主机到 IP 映射', example: 'docker run --add-host example.com:127.0.0.1 nginx' },
  { flag: '--device', category: '其他常用', description: '挂载主机设备到容器', example: 'docker run --device /dev/sda:/dev/xvda ubuntu' },
  { flag: '--ipc', category: '其他常用', description: '设置 IPC 命名空间', example: 'docker run --ipc host ubuntu' },
  { flag: '--pid', category: '其他常用', description: '设置 PID 命名空间', example: 'docker run --pid host ubuntu' },
];
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/utils/docker/__tests__/run-flags-data.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/docker/run-flags-data.ts src/utils/docker/__tests__/run-flags-data.test.ts
git commit -m "feat(docker): 添加 docker run 常用 flag 速查数据

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 实现 FlagReference.vue 速查表组件

**Files:**
- Create: `src/tools/devops/docker-run-form/FlagReference.vue`

**Interfaces:**
- Consumes: `RUN_FLAGS`, `RUN_FLAG_CATEGORIES` from `../../../utils/docker/run-flags-data`。
- Produces: 无外部依赖，纯展示组件。

- [ ] **Step 1: 创建组件文件**

创建 `src/tools/devops/docker-run-form/FlagReference.vue`：

```vue
<script setup lang="ts">
/**
 * docker run 参数速查表组件。
 *
 * 按分类以表格形式展示常用 flag，支持一键复制示例命令。
 */
import { computed } from 'vue';
import CopyButton from '../../../components/ui/CopyButton.vue';
import { RUN_FLAGS, RUN_FLAG_CATEGORIES } from '../../../utils/docker/run-flags-data';

/**
 * 按分类分组后的 flag 数据。
 */
const groupedFlags = computed(() => {
  return RUN_FLAG_CATEGORIES.map((category) => ({
    category,
    items: RUN_FLAGS.filter((f) => f.category === category),
  })).filter((group) => group.items.length > 0);
});
</script>

<template>
  <div class="w-full">
    <h2 class="text-lg font-semibold mb-4">docker run 常用参数速查</h2>

    <div
      v-for="group in groupedFlags"
      :key="group.category"
      class="mb-6"
    >
      <h3 class="text-[0.8125rem] font-medium text-muted mb-2">{{ group.category }}</h3>

      <div class="border border-border rounded-sm overflow-hidden">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-hover border-b border-border">
              <th class="px-4 py-2 text-left text-[0.8125rem] font-medium text-muted w-1/4">Flag</th>
              <th class="px-4 py-2 text-left text-[0.8125rem] font-medium text-muted w-1/3">说明</th>
              <th class="px-4 py-2 text-left text-[0.8125rem] font-medium text-muted">示例</th>
              <th class="px-4 py-2 text-right text-[0.8125rem] font-medium text-muted w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in group.items"
              :key="item.flag"
              class="border-b border-border last:border-b-0 bg-card transition-[background-color] duration-150 hover:bg-hover"
            >
              <td class="px-4 py-2.5 font-mono text-sm text-text align-top">{{ item.flag }}</td>
              <td class="px-4 py-2.5 text-[0.8125rem] text-text align-top">{{ item.description }}</td>
              <td class="px-4 py-2.5 font-mono text-sm text-muted align-top whitespace-pre-wrap break-all">{{ item.example }}</td>
              <td class="px-4 py-2.5 text-right align-top">
                <CopyButton
                  :text="item.example"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`

Expected: 无新增类型错误（当前步骤可能因其他组件未创建而有无关错误，但 FlagReference.vue 本身应通过）。

- [ ] **Step 3: 提交**

```bash
git add src/tools/devops/docker-run-form/FlagReference.vue
git commit -m "feat(docker): 实现 docker run 参数速查表组件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 实现 RunGenerator.vue 命令生成器组件

**Files:**
- Create: `src/tools/devops/docker-run-form/RunGenerator.vue`

**Interfaces:**
- Consumes:
  - `generateDockerRunCommand`, `FormState` from `../../../utils/docker/generate-run-command`
  - `ToolHeader`, `CodePanel`, `ClearButton`, `CopyButton`, `SelectListbox`, `ToggleSwitch` from existing components
- Produces: 无外部依赖。

- [ ] **Step 1: 创建组件文件**

创建 `src/tools/devops/docker-run-form/RunGenerator.vue`：

```vue
<script setup lang="ts">
/**
 * docker run 命令生成器组件。
 *
 * 提供表单配置容器运行参数，实时生成并展示可复制的 docker run 命令。
 */
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../../components/layout/ToolHeader.vue';
import CodePanel from '../../../components/ui/CodePanel.vue';
import ClearButton from '../../../components/ui/ClearButton.vue';
import CopyButton from '../../../components/ui/CopyButton.vue';
import SelectListbox from '../../../components/ui/SelectListbox.vue';
import ToggleSwitch from '../../../components/ui/ToggleSwitch.vue';
import {
  generateDockerRunCommand,
  type FormState,
} from '../../../utils/docker/generate-run-command';

/** 默认示例状态 */
const EXAMPLE_STATE: FormState = {
  image: 'nginx',
  tag: 'latest',
  name: 'my-nginx',
  ports: [{ host: '8080', container: '80', protocol: 'tcp' }],
  envs: [{ key: 'NGINX_HOST', value: 'example.com' }],
  volumes: [{ host: '/host/html', container: '/usr/share/nginx/html', mode: 'ro' }],
  workdir: '',
  restart: 'unless-stopped',
  network: 'bridge',
  detach: true,
  interactive: false,
  tty: false,
  rm: false,
  extraArgs: '',
};

/** 表单初始空状态 */
const EMPTY_STATE: FormState = {
  image: '',
  tag: '',
  name: '',
  ports: [{ host: '', container: '', protocol: 'tcp' }],
  envs: [{ key: '', value: '' }],
  volumes: [{ host: '', container: '', mode: '' }],
  workdir: '',
  restart: '',
  network: '',
  detach: false,
  interactive: false,
  tty: false,
  rm: false,
  extraArgs: '',
};

/** 当前表单状态 */
const formState = ref<FormState>({ ...EMPTY_STATE });

/** 生成的命令 */
const command = computed(() => generateDockerRunCommand(formState.value));

/** 是否显示空状态提示 */
const showEmptyHint = computed(() => !formState.value.image.trim());

/** 重启策略选项 */
const restartOptions = [
  { value: '', label: '不设置' },
  { value: 'no', label: 'no' },
  { value: 'always', label: 'always' },
  { value: 'unless-stopped', label: 'unless-stopped' },
  { value: 'on-failure', label: 'on-failure' },
];

/** 网络模式选项 */
const networkOptions = [
  { value: '', label: '不设置' },
  { value: 'bridge', label: 'bridge' },
  { value: 'host', label: 'host' },
  { value: 'none', label: 'none' },
];

/** 协议选项 */
const protocolOptions = [
  { value: 'tcp', label: 'tcp' },
  { value: 'udp', label: 'udp' },
];

/** 卷模式选项 */
const volumeModeOptions = [
  { value: '', label: '默认' },
  { value: 'ro', label: 'ro' },
  { value: 'rw', label: 'rw' },
];

/**
 * 添加一行端口映射。
 */
function addPort() {
  formState.value.ports.push({ host: '', container: '', protocol: 'tcp' });
}

/**
 * 删除指定端口映射行。
 */
function removePort(index: number) {
  formState.value.ports.splice(index, 1);
  if (formState.value.ports.length === 0) {
    addPort();
  }
}

/**
 * 添加一行环境变量。
 */
function addEnv() {
  formState.value.envs.push({ key: '', value: '' });
}

/**
 * 删除指定环境变量行。
 */
function removeEnv(index: number) {
  formState.value.envs.splice(index, 1);
  if (formState.value.envs.length === 0) {
    addEnv();
  }
}

/**
 * 添加一行卷挂载。
 */
function addVolume() {
  formState.value.volumes.push({ host: '', container: '', mode: '' });
}

/**
 * 删除指定卷挂载行。
 */
function removeVolume(index: number) {
  formState.value.volumes.splice(index, 1);
  if (formState.value.volumes.length === 0) {
    addVolume();
  }
}

/**
 * 清空表单。
 */
function handleClear() {
  formState.value = { ...EMPTY_STATE };
}

/**
 * 填入示例。
 */
function handleExample() {
  formState.value = JSON.parse(JSON.stringify(EXAMPLE_STATE));
}

/** 监听 interactive 与 tty，自动联动为 -it */
watch(
  () => formState.value.interactive,
  (val) => {
    if (val) formState.value.tty = true;
  },
);
</script>

<template>
  <div class="w-full">
    <ToolHeader
      title="Docker Run 命令助手"
      description="填写参数，实时生成可复制的 docker run 命令"
      @example="handleExample"
    />

    <!-- 表单区 -->
    <div class="flex flex-col gap-4 mb-6">
      <!-- 镜像与名称 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">镜像名称 *</label>
          <input
            v-model="formState.image"
            type="text"
            placeholder="如 nginx"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">标签</label>
          <input
            v-model="formState.tag"
            type="text"
            placeholder="latest"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">容器名称 --name</label>
          <input
            v-model="formState.name"
            type="text"
            placeholder="my-container"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">工作目录 -w</label>
          <input
            v-model="formState.workdir"
            type="text"
            placeholder="/app"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
      </div>

      <!-- 下拉选项 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectListbox
          v-model="formState.restart"
          label="重启策略 --restart"
          :options="restartOptions"
        />
        <SelectListbox
          v-model="formState.network"
          label="网络模式 --network"
          :options="networkOptions"
        />
      </div>

      <!-- 开关 -->
      <div class="flex flex-wrap gap-6">
        <ToggleSwitch v-model="formState.detach" label="后台运行" description="-d" />
        <ToggleSwitch v-model="formState.rm" label="自动删除" description="--rm" />
        <ToggleSwitch v-model="formState.interactive" label="交互终端" description="-it" />
      </div>

      <!-- 端口映射 -->
      <div>
        <label class="block mb-2 text-[0.8125rem] text-muted">端口映射 -p</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="(port, index) in formState.ports"
            :key="index"
            class="flex items-center gap-2"
          >
            <input
              v-model="port.host"
              type="text"
              placeholder="主机端口"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <span class="text-muted">:</span>
            <input
              v-model="port.container"
              type="text"
              placeholder="容器端口"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <SelectListbox
              v-model="port.protocol"
              :options="protocolOptions"
              class="w-24"
            />
            <button
              type="button"
              class="px-2 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              @click="removePort(index)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
          @click="addPort"
        >
          + 添加端口
        </button>
      </div>

      <!-- 环境变量 -->
      <div>
        <label class="block mb-2 text-[0.8125rem] text-muted">环境变量 -e</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="(env, index) in formState.envs"
            :key="index"
            class="flex items-center gap-2"
          >
            <input
              v-model="env.key"
              type="text"
              placeholder="KEY"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <span class="text-muted">=</span>
            <input
              v-model="env.value"
              type="text"
              placeholder="value"
              class="flex-[2] min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <button
              type="button"
              class="px-2 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              @click="removeEnv(index)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
          @click="addEnv"
        >
          + 添加环境变量
        </button>
      </div>

      <!-- 挂载卷 -->
      <div>
        <label class="block mb-2 text-[0.8125rem] text-muted">挂载卷 -v</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="(vol, index) in formState.volumes"
            :key="index"
            class="flex items-center gap-2"
          >
            <input
              v-model="vol.host"
              type="text"
              placeholder="主机路径"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <span class="text-muted">:</span>
            <input
              v-model="vol.container"
              type="text"
              placeholder="容器路径"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <SelectListbox
              v-model="vol.mode"
              :options="volumeModeOptions"
              class="w-24"
            />
            <button
              type="button"
              class="px-2 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              @click="removeVolume(index)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
          @click="addVolume"
        >
          + 添加挂载卷
        </button>
      </div>

      <!-- 额外参数 -->
      <div>
        <label class="block mb-1 text-[0.8125rem] text-muted">镜像后的额外参数</label>
        <input
          v-model="formState.extraArgs"
          type="text"
          placeholder="如 bash 或 nginx -g 'daemon off;'"
          class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
    </div>

    <!-- 命令输出区 -->
    <CodePanel
      label="生成的命令"
      show-copy
      show-clear
      :copy-text="command"
      @clear="handleClear"
    >
      <div class="px-4 py-3 min-h-24">
        <pre
          v-if="!showEmptyHint"
          class="m-0 font-mono text-sm text-text whitespace-pre-wrap break-all"
        >{{ command }}</pre>
        <p
          v-else
          class="m-0 text-[0.8125rem] text-muted"
        >
          请输入镜像名称以生成命令
        </p>
      </div>
    </CodePanel>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm astro check`

Expected: RunGenerator.vue 本身无类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/tools/devops/docker-run-form/RunGenerator.vue
git commit -m "feat(docker): 实现 docker run 命令生成器表单组件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 实现主页面组件与 Astro 路由

**Files:**
- Create: `src/tools/devops/DockerRunHelper.vue`
- Create: `src/pages/devops/docker-run-helper.astro`

**Interfaces:**
- Consumes: `RunGenerator`, `FlagReference` from `./docker-run-form/*`。
- Produces: 无外部依赖。

- [ ] **Step 1: 创建主 Vue 组件**

创建 `src/tools/devops/DockerRunHelper.vue`：

```vue
<script setup lang="ts">
/**
 * Docker Run 命令助手主组件。
 *
 * 组合命令生成器与参数速查表两个区块。
 */
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import RunGenerator from './docker-run-form/RunGenerator.vue';
import FlagReference from './docker-run-form/FlagReference.vue';
</script>

<template>
  <ResponsiveWorkspace mode="vertical">
    <RunGenerator />

    <div class="mt-10 pt-8 border-t border-border">
      <FlagReference />
    </div>
  </ResponsiveWorkspace>
</template>
```

- [ ] **Step 2: 创建 Astro 页面**

创建 `src/pages/devops/docker-run-helper.astro`：

```astro
---
import ToolLayout from '../../layouts/ToolLayout.astro';
import DockerRunHelper from '../../tools/devops/DockerRunHelper.vue';
---

<ToolLayout toolId="devops/docker-run-helper">
  <DockerRunHelper client:idle />
</ToolLayout>
```

- [ ] **Step 3: 类型检查与构建**

Run:
```bash
pnpm astro check
pnpm build
```

Expected: 类型检查通过，构建成功。

- [ ] **Step 4: 提交**

```bash
git add src/tools/devops/DockerRunHelper.vue src/pages/devops/docker-run-helper.astro
git commit -m "feat(docker): 添加 Docker Run 命令助手页面

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 注册工具并补充相关工具关联

**Files:**
- Modify: `src/data/tools.ts`

**Interfaces:**
- Consumes: 无。
- Produces: 在 `tools` 数组中新增 `ToolMeta` 条目。

- [ ] **Step 1: 在 tools.ts 中注册新工具**

在 `src/data/tools.ts` 的 `tools` 数组中，找到 `docker-converter` 条目，在其后新增：

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
},
```

- [ ] **Step 2: 同步更新 docker-converter 的 relatedToolIds**

将 `docker-converter` 条目的 `relatedToolIds` 修改为：

```ts
relatedToolIds: ['docker-run-helper', 'env-converter'],
```

- [ ] **Step 3: 运行全量检查**

Run:
```bash
pnpm astro check
pnpm build
pnpm test
```

Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add src/data/tools.ts
git commit -m "feat(docker): 注册 Docker Run 命令助手并关联相关工具

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

### 1. Spec Coverage

| 设计文档章节 | 实现任务 |
|---|---|
| 范围与定位（docker run 单一场景） | Task 5 页面、Task 6 注册 |
| 上半部分生成器 | Task 4 RunGenerator.vue |
| 下半部分分类表格速查 | Task 3 FlagReference.vue |
| 数据模型 FormState | Task 1 generate-run-command.ts |
| 30–40 个 flag 数据 | Task 2 run-flags-data.ts |
| 组件结构 | Task 3 / 4 / 5 |
| 错误处理与边界 | Task 1 中镜像名为空返回空字符串，环境变量 key 为空跳过 |
| 测试计划 | Task 1 / 2 测试文件 |
| SEO 注册 | Task 6 tools.ts |

### 2. Placeholder Scan

- 无 TBD / TODO。
- 所有步骤包含完整代码或命令。
- 无模糊描述。

### 3. Type Consistency

- `FormState` 在 `generate-run-command.ts` 中定义，RunGenerator.vue 中通过类型导入使用，字段一致。
- `RunFlagCategory` 和 `RunFlagEntry` 在 `run-flags-data.ts` 中定义，FlagReference.vue 中使用一致。
- `ToolLayout` 的 `toolId` 与 tools.ts 中的 `id` 一致：`devops/docker-run-helper`。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-28-docker-run-helper.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
