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

function applyFlag(
  config: DockerRunConfig,
  flag: FlagDefinition,
  value: string | undefined,
): void {
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
    case 'network':
      config.network = value ?? '';
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

function serializeToYaml(config: DockerRunConfig): string {
  const serviceName = config.containerName || 'service';
  const lines: string[] = ['services:', `  ${serviceName}:`];

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
  pushScalar('network', config.network);

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

function yamlValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);

  const str = String(value);

  if (str === '') return '""';
  if (/^(true|false|yes|no|on|off|null|~)$/i.test(str)) return `"${str}"`;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(str)) return `"${str}"`;
  if (/[:#{}[\],&*|>!%@`\n]|^\s|\s$/.test(str)) {
    // Colon is only a YAML indicator when followed by whitespace or at end.
    // However, port-mapping-like values (digits:digits) should be quoted
    // for clarity, while image tags and paths need not.
    const hasNonColonSpecial = /[#{}[\],&*|>!%@`\n]|^\s|\s$/.test(str);
    const colonNeedsQuote = /:\s/.test(str) || /:$/.test(str);
    const looksLikePortMapping = /^\d+:\d+$/.test(str);

    if (!hasNonColonSpecial && !colonNeedsQuote && !looksLikePortMapping) {
      return str;
    }
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}
