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
  /** 容器启动命令及参数（image 之后的位置参数，覆盖镜像 CMD） */
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
  /** 网络 --network（docker run 仅支持单个） */
  network?: string;
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
  /** 健康检查配置 */
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

/** Shell 分词结果 — token（value 不包含包裹的引号） */
export interface Token {
  /** token 值（不包含引号） */
  value: string;
  /** 起始字符索引（若被引号包裹，则包含起始引号） */
  start: number;
  /** 结束字符索引（不包含；若被引号包裹，则包含结束引号） */
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
