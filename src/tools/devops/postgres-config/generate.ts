/**
 * postgresql.conf 模板渲染引擎（纯函数：params + ctx → 行数组）。
 *
 * 输出 ConfLine[] 而非字符串：预览高亮、复制、下载共用同一份数据，
 * 保证"预览 = 产物"。渲染层不感知 Vue。
 *
 * 与 MySQL 版渲染的差异：
 * - PG 无 [section] 段概念，组标题一律用英文注释行
 * - 布尔值输出 PG 惯例的小写 on/off（MySQL 为大写 ON/OFF）
 * - 自由文本字符串按 quoted 标记加单引号（值内单引号按 PG 语法翻倍转义），
 *   枚举/数值/布尔裸输出；quoted 值不做 trim（log_line_prefix 尾随空格有语义）
 */
import type { ConfLine } from '../../../components/config/types';
import {
  DISK_LABELS,
  PARAM_GROUPS,
  SCENARIO_LABELS,
  type GenerateContext,
  type PgParam,
  type ParamValue,
} from './params';
import { isAvailable } from './version';

/** postgresql.conf 单行结构（共享四值并集定义，re-export 保持与 redis/mysql 相同的 import 形态） */
export type { ConfLine };

/**
 * 解析参数当前生效值：用户覆盖优先，其次 compute 推荐值，最后静态 defaultValue。
 * 三者皆无（注册表不应出现）时返回 null，渲染层跳过该行。
 * @param param - 参数定义
 * @param ctx - 生成上下文
 * @returns 生效值；无值可用时为 null
 */
export function resolveValue(param: PgParam, ctx: GenerateContext): ParamValue | null {
  const override = ctx.overrides[param.key];
  if (override !== undefined) return override;
  if (param.compute) return param.compute(ctx);
  if (param.defaultValue !== undefined) return param.defaultValue;
  return null;
}

/**
 * 把参数值格式化为 postgresql.conf 指令行文本（`key = value`，等号两侧带空格）。
 * 布尔输出小写 on/off；数值追加 valueSuffix 单位字面量（如 1024MB）；
 * quoted 参数的字符串值加单引号并翻倍转义值内单引号、保留原始空白；
 * 其余字符串 trim 后裸输出（枚举），空串视为"未设置"不输出。
 * @param param - 参数定义
 * @param value - 生效值
 * @returns 指令行文本数组（可为空数组）
 */
function formatDirective(param: PgParam, value: ParamValue): string[] {
  if (typeof value === 'boolean') {
    return [`${param.key} = ${value ? 'on' : 'off'}`];
  }
  if (typeof value === 'number') {
    return [`${param.key} = ${value}${param.valueSuffix ?? ''}`];
  }
  if (Array.isArray(value)) {
    return [`${param.key} = ${value.join(',')}`];
  }
  if (param.quoted) {
    // 自由文本：不做 trim（log_line_prefix 的尾随空格有语义），按 PG 语法转义单引号；
    // 空白值视为"未设置"（如内网监听未填 IP）不输出该行
    if (!value.trim()) return [];
    return [`${param.key} = '${value.replaceAll("'", "''")}'`];
  }
  const text = value.trim();
  if (!text) return [];
  return [`${param.key} = ${text}`];
}

/**
 * 生成完整 postgresql.conf 行数组。
 * 结构：头部元信息注释（生成器标识 / 版本画像 / 路径参数与认证归属说明）→
 * 按组顺序输出（组间空行 + 英文组标题注释 + `key = value` 指令行）。
 * 目标版本不含于 availableIn 的参数整行跳过（16/17 下整组异步 IO 消失）；
 * 复制组仅主从模式渲染（本函数按 ctx.mode 过滤）；组内无指令时整组（含标题）跳过；
 * 不输出逐参数中文注释（说明留在面板，产物保持纯净）。
 * @param params - 参数定义数组（传 CONFIG_PARAMS，抽出以便单测与扩展）
 * @param ctx - 生成上下文
 * @returns postgresql.conf 行数组
 */
export function generatePgConf(
  params: readonly PgParam[],
  ctx: GenerateContext,
): ConfLine[] {
  const lines: ConfLine[] = [
    { type: 'comment', text: '# PostgreSQL 配置文件（postgresql.conf）— 由 DevTools 配置生成器输出（参考值，请结合 pg_stat_statements / 日志 / 监控调整）' },
    {
      type: 'comment',
      text: `# 目标版本 PostgreSQL ${ctx.version} ｜ ${ctx.mode === 'replica' ? '主从' : '单机'} ｜ 场景：${SCENARIO_LABELS[ctx.scenario]} ｜ 内存 ${ctx.memoryGB}GB ｜ CPU ${ctx.cpuCores} 核 ｜ 磁盘 ${DISK_LABELS[ctx.diskType]}`,
    },
    { type: 'comment', text: '# datadir / hba_file 等路径类参数由 initdb 与服务管理器管理，本文件为最小化常用配置，未列出参数使用内置默认值' },
    { type: 'comment', text: '# 账号与口令属 pg_hba.conf 与 SQL 层（CREATE ROLE ... PASSWORD）管理，本文件不包含认证配置' },
  ];

  for (const group of PARAM_GROUPS) {
    if (group.id === 'replication' && ctx.mode !== 'replica') continue;
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
 * 把行数组序列化为 postgresql.conf 文本（含末尾换行）。
 * @param lines - 行数组
 * @returns 可直接复制/下载的文本
 */
export function serializeConf(lines: ConfLine[]): string {
  return `${lines.map((l) => l.text).join('\n')}\n`;
}
