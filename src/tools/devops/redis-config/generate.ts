/**
 * conf 模板渲染引擎（纯函数：params + ctx → 行数组）。
 *
 * 输出 ConfLine[] 而非字符串：预览高亮、复制、下载共用同一份数据，
 * 保证"预览 = 产物"。渲染层不感知 Vue。
 */
import {
  CONFIG_PARAMS,
  PARAM_GROUPS,
  PERSISTENCE_LABELS,
  SCENARIO_LABELS,
  type ConfigParam,
  type GenerateContext,
  type ParamValue,
} from './params';
import { isAvailable } from './version';

/** conf 单行结构 */
export interface ConfLine {
  /** 行类型：注释 / 指令 / 空行 */
  type: 'comment' | 'directive' | 'blank';
  /** 行文本（注释行含 '#' 前缀，空行为空串） */
  text: string;
  /** 指令所属参数 key（预览按此高亮变动行） */
  paramKey?: string;
}

/**
 * 解析参数当前生效值：用户覆盖优先，否则取 compute 推荐值。
 * compute 返回 null（上下文不适用）时覆盖值也无效，统一返回 null。
 * @param param - 参数定义
 * @param ctx - 生成上下文
 * @returns 生效值；不适用时为 null
 */
export function resolveValue(param: ConfigParam, ctx: GenerateContext): ParamValue | null {
  const computed = param.compute(ctx);
  if (computed === null) return null;
  const override = ctx.overrides[param.key];
  return override !== undefined ? override : computed;
}

/**
 * 把参数值格式化为 conf 指令行文本。
 * 多行字符串值（如 client-output-buffer-limit 预设）拆为多条同名指令；
 * 空字符串视为"未设置"，不输出指令。
 * @param param - 参数定义
 * @param value - 生效值
 * @returns 指令行文本数组（可为空数组）
 */
function formatDirective(param: ConfigParam, value: ParamValue): string[] {
  if (typeof value === 'boolean') {
    return [`${param.key} ${value ? 'yes' : 'no'}`];
  }
  if (typeof value === 'number') {
    return [`${param.key} ${value}${param.valueSuffix ?? ''}`];
  }
  if (Array.isArray(value)) {
    // 仅 notify-keyspace-events 使用：键位无分隔拼接，空数组输出 "" 表示显式关闭
    return [`${param.key} "${value.join('')}"`];
  }
  const text = value.trim();
  if (!text) return [];
  return text.split('\n').map((line) => `${param.key} ${line.trim()}`);
}

/**
 * 按分组与版本生成完整 conf 行数组。
 * 规则：目标版本已废弃的参数不写入；组内无任何指令时整组（含组标题）跳过；
 * 仅输出头部元信息注释、分组标题注释与指令行，不输出逐参数注释
 * （参数说明保留在左侧面板，产物保持纯净）。
 * @param ctx - 生成上下文
 * @returns conf 行数组（头部注释 + 分组内容）
 */
export function generateConf(ctx: GenerateContext): ConfLine[] {
  const lines: ConfLine[] = [
    { type: 'comment', text: '# Redis 配置文件 — 由 DevTools 配置生成器输出（参考值，请结合监控调优）' },
    {
      type: 'comment',
      text: `# 目标版本 Redis ${ctx.version} ｜ ${ctx.mode === 'replica' ? '主从' : '单机'} ｜ 场景：${SCENARIO_LABELS[ctx.scenario]} ｜ 持久化：${PERSISTENCE_LABELS[ctx.persistence]}`,
    },
    { type: 'blank', text: '' },
  ];

  for (const group of PARAM_GROUPS) {
    const groupLines: ConfLine[] = [];
    for (const param of CONFIG_PARAMS) {
      if (param.group !== group.id) continue;
      if (!isAvailable(param, ctx.version)) continue;
      const value = resolveValue(param, ctx);
      if (value === null) continue;
      for (const text of formatDirective(param, value)) {
        groupLines.push({ type: 'directive', text, paramKey: param.key });
      }
    }
    if (groupLines.some((l) => l.type === 'directive')) {
      lines.push({ type: 'comment', text: `# ============ ${group.label} ============` });
      lines.push(...groupLines);
      lines.push({ type: 'blank', text: '' });
    }
  }
  return lines;
}

/**
 * 把行数组序列化为 conf 文本（含末尾换行）。
 * @param lines - conf 行数组
 * @returns 可直接复制/下载的文本
 */
export function serializeConf(lines: ConfLine[]): string {
  return `${lines.map((l) => l.text).join('\n')}\n`;
}

/**
 * 从行数组中提取指定参数的指令值列表（不含 key 前缀）。
 * 多行指令（如 client-output-buffer-limit）返回多条值。
 * @param lines - conf 行数组
 * @param key - 参数 key
 * @returns 值字符串数组（未出现时为空数组）
 */
export function findDirectiveValues(lines: ConfLine[], key: string): string[] {
  return lines
    .filter((l) => l.type === 'directive' && l.paramKey === key)
    .map((l) => l.text.slice(key.length).trim());
}
