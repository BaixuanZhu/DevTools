/**
 * docker compose YAML → docker run 命令转换器。
 *
 * 流程：YAML 字符串 → js-yaml 解析 → 提取第一个 service → 拼接 docker run 命令。
 * 无法映射的 compose 字段和多 service 信息以 `# ⚠️` 注释保留。
 */

import { load } from 'js-yaml';
import type { ComposeToRunResult, DockerRunConfig } from './types';

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
  if (service.networks) config.network = normalizeNetwork(service.networks);
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

  if (config.network) {
    parts.push('--network', shellQuote(config.network));
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
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n')}"`;
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
 * 从 compose networks 字段提取第一个网络名。
 *
 * compose 的 networks 可以是数组或对象；docker run 仅支持单个 --network。
 */
function normalizeNetwork(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 0) return keys[0];
  }
  if (typeof value === 'string') return value;
  return '';
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
