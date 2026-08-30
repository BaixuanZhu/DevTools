/**
 * my.cnf 模板渲染引擎（纯函数：params + ctx → 行数组）。
 *
 * 输出 ConfLine[] 而非字符串：预览高亮、复制、下载共用同一份数据，
 * 保证"预览 = 产物"。渲染层不感知 Vue。
 *
 * 与 Redis 版渲染的差异：
 * - 指令格式为 MySQL 惯例的 `key = value`（等号两侧带空格），Redis 为 `key value`
 * - 布尔值输出 ON/OFF（MySQL 惯例大写），Redis 为 yes/no
 * - conf 以 `[mysqld]` 段头开始，组标题注释为纯英文组名
 */
import type { ConfLine } from '../../../components/config/types';
import {
  DISK_LABELS,
  PARAM_GROUPS,
  SCENARIO_LABELS,
  type ConfigParam,
  type GenerateContext,
  type ParamValue,
} from './params';
import { isAvailable } from './version';

/** my.cnf 单行结构（共享四值并集定义，re-export 保持既有测试 import 路径） */
export type { ConfLine };

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
 * 把参数值格式化为 my.cnf 指令行文本（`key = value`，等号两侧带空格）。
 * 多行字符串值拆为多条同名指令；空字符串视为"未设置"，不输出指令；
 * 布尔值按 MySQL 惯例输出 ON/OFF。
 * @param param - 参数定义
 * @param value - 生效值
 * @returns 指令行文本数组（可为空数组）
 */
function formatDirective(param: ConfigParam, value: ParamValue): string[] {
  if (typeof value === 'boolean') {
    return [`${param.key} = ${value ? 'ON' : 'OFF'}`];
  }
  if (typeof value === 'number') {
    return [`${param.key} = ${value}${param.valueSuffix ?? ''}`];
  }
  if (Array.isArray(value)) {
    return [`${param.key} = ${value.join(',')}`];
  }
  const text = value.trim();
  if (!text) return [];
  return text.split('\n').map((line) => `${param.key} = ${line.trim()}`);
}

/**
 * 生成完整 my.cnf 行数组。
 * 结构：头部元信息注释（版本/画像 + 安装路径与密码提示）→ `[mysqld]` 段头 →
 * 按组顺序输出（组间空行 + 英文组标题注释 + `key = value` 指令行）。
 * 目标版本已废弃的参数与 compute 返回 null 的参数整行跳过；
 * 组内无任何指令时整组（含组标题）跳过；不输出逐参数中文注释（说明留在面板，产物保持纯净）。
 * @param params - 参数定义数组（传 CONFIG_PARAMS，抽出以便单测与扩展）
 * @param ctx - 生成上下文
 * @returns my.cnf 行数组
 */
export function generateMyCnf(
  params: readonly ConfigParam[],
  ctx: GenerateContext,
): ConfLine[] {
  const lines: ConfLine[] = [
    { type: 'comment', text: '# MySQL 配置文件（my.cnf）— 由 DevTools 配置生成器输出（参考值，请结合 SHOW STATUS / 慢查询日志 / 监控调整）' },
    {
      type: 'comment',
      text: `# 目标版本 MySQL ${ctx.version} ｜ ${ctx.mode === 'replica' ? '主从' : '单机'} ｜ 场景：${SCENARIO_LABELS[ctx.scenario]} ｜ 内存 ${ctx.memoryGB}GB ｜ 磁盘 ${DISK_LABELS[ctx.diskType]}`,
    },
    { type: 'comment', text: '# datadir / socket / log-error / pid-file 等安装路径参数请保留安装器生成的值，本文件不输出这些路径' },
    { type: 'comment', text: '# 账号与密码属 SQL 层管理（CREATE USER / GRANT），my.cnf 不包含密码配置' },
    { type: 'blank', text: '' },
    { type: 'section', text: '[mysqld]' },
  ];

  for (const group of PARAM_GROUPS) {
    const groupLines: ConfLine[] = [];
    for (const param of params) {
      if (param.group !== group.id) continue;
      if (!isAvailable(param, ctx.version)) continue;
      const value = resolveValue(param, ctx);
      if (value === null) continue;
      for (const text of formatDirective(param, value)) {
        groupLines.push({ type: 'directive', text, paramKey: param.key });
      }
    }
    if (groupLines.some((l) => l.type === 'directive')) {
      lines.push({ type: 'blank', text: '' });
      lines.push({ type: 'comment', text: `# ${group.confTitle}` });
      lines.push(...groupLines);
    }
  }
  return lines;
}

/**
 * 把行数组序列化为 my.cnf 文本（含末尾换行）。
 * @param lines - 行数组
 * @returns 可直接复制/下载的文本
 */
export function serializeConf(lines: ConfLine[]): string {
  return `${lines.map((l) => l.text).join('\n')}\n`;
}

/**
 * 从行数组中提取指定参数的指令值列表（不含 key 与等号）。
 * 供 OS 建议区块联动取值（如 max_connections）。
 * @param lines - 行数组
 * @param key - 参数 key
 * @returns 值字符串数组（未出现时为空数组）
 */
export function findDirectiveValues(lines: ConfLine[], key: string): string[] {
  return lines
    .filter((l) => l.type === 'directive' && l.paramKey === key)
    .map((l) => l.text.slice(key.length).trim().replace(/^=\s*/, '').trim());
}
