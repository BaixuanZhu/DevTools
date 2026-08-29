/**
 * MySQL 版本序数与参数可用性过滤（纯函数层）。
 *
 * 版本轴为 5.7 / 8.0 / 8.4 三点；补丁级变更（8.0.26/8.0.27/8.0.30）折到 8.0 轴点，
 * 补丁版本写进参数注释文案。版本元数据以
 * research/mysql-params-version-notes.md 为准（源：MySQL 官方文档与 relnotes）。
 *
 * 轴点安全方向：轴点只输出该轴全系补丁版可用的参数名。补丁级引入的新名参数
 * （8.0.26 的 replica_*、8.0.27 的 authentication_policy、8.0.30 的 innodb_redo_log_capacity）
 * 不得映射到 8.0 轴输出——8.0.0-8.0.25 会因未知变量启动失败；新名仅 8.4 轴输出。
 * 在数据层体现为：新名参数 introducedIn 标 '8.4'，旧名参数 deprecatedIn 标 '8.4'。
 */

/** 版本轴：MySQL 三点枚举（按钮组与参数引入/废弃标注共用） */
export type MysqlVersion = '5.7' | '8.0' | '8.4';

/** 版本 → 序数（越小越早），isAvailable 的比较基准 */
export const VERSION_ORDER: Record<MysqlVersion, number> = {
  '5.7': 0,
  '8.0': 1,
  '8.4': 2,
};

/** 版本按钮组选项（value 写入 ctx.version，label 为按钮显示文案） */
export interface VersionOption {
  /** 写入 ctx.version 的版本值 */
  value: MysqlVersion;
  /** 按钮显示文案 */
  label: string;
}

/** 目标版本轴（按钮组顺序即升序） */
export const TARGET_VERSIONS: readonly VersionOption[] = [
  { value: '5.7', label: '5.7' },
  { value: '8.0', label: '8.0' },
  { value: '8.4', label: '8.4' },
];

/** 参与版本判断的最小参数结构（避免与 params.ts 相互依赖） */
export interface VersionedParam {
  /** 引入版本 */
  introducedIn: MysqlVersion;
  /** 标记废弃/从轴上移除的版本 */
  deprecatedIn?: MysqlVersion;
}

/**
 * 判断参数在目标版本下是否可写入 conf：已引入且未被废弃。
 * @param param - 参数定义（含版本标注）
 * @param version - 目标版本
 * @returns 可写入 conf 时为 true
 */
export function isAvailable(param: VersionedParam, version: MysqlVersion): boolean {
  if (VERSION_ORDER[param.introducedIn] > VERSION_ORDER[version]) return false;
  if (param.deprecatedIn && VERSION_ORDER[param.deprecatedIn] <= VERSION_ORDER[version]) {
    return false;
  }
  return true;
}

/**
 * 判断参数在目标版本下是否已废弃（已引入但过了废弃版本）。
 * 面板用它显示"废弃 → 替代参数"提示。
 * @param param - 参数定义
 * @param version - 目标版本
 * @returns 已废弃时为 true
 */
export function isDeprecatedAt(param: VersionedParam, version: MysqlVersion): boolean {
  return (
    !isAvailable(param, version) && VERSION_ORDER[param.introducedIn] <= VERSION_ORDER[version]
  );
}

/**
 * 是否在面板保留"已废弃"提示行：自 5.7 轴起可用过、之后才废弃的参数显示
 * （如 tx_isolation 在 8.0 改名）；本工具不输出 5.7 前就废弃的参数，无需额外过滤。
 * @param param - 参数定义
 * @returns 需要显示废弃提示行时为 true
 */
export function showsDeprecationNotice(param: VersionedParam): boolean {
  return !!param.deprecatedIn;
}
