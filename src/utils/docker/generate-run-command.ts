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
 * 若值包含空格、单引号、双引号或反斜杠，使用单引号包裹并将内部单引号替换为 `'\''`。
 *
 * @param value - 原始值
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
 * @param state - 表单状态
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
