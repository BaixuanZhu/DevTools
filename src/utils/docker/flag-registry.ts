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
  { name: 'network', hasValue: true, valueFormat: 'single', composeKey: 'network' },
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
