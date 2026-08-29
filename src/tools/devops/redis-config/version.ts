/**
 * Redis 版本序数与参数可用性过滤（纯函数层）。
 *
 * 版本轴为 7.0 / 7.2 / 7.4 / 8.0 / 8.2 / 8.4；早于 7.0 的参数统一标注 pre-7（UI 不显示徽章）。
 * 引入/废弃版本元数据以 research/redis-params-version-notes.md 为准
 * （源：Redis 官方 config.c 注册表 diff 与 00-RELEASENOTES）。
 * 8.2/8.4 的变更集中于命令层与指标，对本工具收录参数无增删/改名，行为等同 8.0
 * （2026-08-29 核对官方 release notes，见 research 笔记末节）。
 */

/** 参数版本标注类型：pre-7 表示 7.0 前已存在，7 系内精确到 minor */
export type RedisVersion = 'pre-7' | '7.0' | '7.2' | '7.4' | '8.0' | '8.2' | '8.4';

/** 生成器支持的目标版本（按钮组轴，不含 pre-7——生成器不面向 7.0 以前输出） */
export type TargetVersion = Exclude<RedisVersion, 'pre-7'>;

/** 版本 → 序数（越小越早），pre-7 恒早于所有目标版本 */
export const VERSION_ORDER: Record<RedisVersion, number> = {
  'pre-7': -1,
  '7.0': 0,
  '7.2': 1,
  '7.4': 2,
  '8.0': 3,
  '8.2': 4,
  '8.4': 5,
};

/** 目标版本轴（按钮组顺序即升序） */
export const TARGET_VERSIONS: readonly TargetVersion[] = ['7.0', '7.2', '7.4', '8.0', '8.2', '8.4'];

/** 版本按钮组元数据（label 用纯版本号——按钮组自带"目标版本"分组标签，每个按钮再带 Redis 前缀会过宽） */
export const VERSION_OPTIONS: { value: TargetVersion; label: string }[] = TARGET_VERSIONS.map(
  (v) => ({ value: v, label: v }),
);

/** 参与版本判断的最小参数结构（避免与 params.ts 相互依赖） */
export interface VersionedParam {
  /** 引入版本 */
  introducedIn: RedisVersion;
  /** 标记废弃的版本（7 系内才标注） */
  deprecatedIn?: RedisVersion;
}

/** 版本轴起点：自该版本起就已废弃的旧名别名不进入面板，仅登记在数据中溯源 */
const AXIS_START: TargetVersion = '7.0';

/**
 * 判断参数在目标版本下是否可写入 conf：已引入且未被废弃。
 * @param param - 参数定义（含版本标注）
 * @param version - 目标版本
 * @returns 可写入 conf 时为 true
 */
export function isAvailable(param: VersionedParam, version: TargetVersion): boolean {
  if (VERSION_ORDER[param.introducedIn] > VERSION_ORDER[version]) return false;
  if (param.deprecatedIn && VERSION_ORDER[param.deprecatedIn] <= VERSION_ORDER[version]) {
    return false;
  }
  return true;
}

/**
 * 判断参数在目标版本下是否已废弃（已引入但过了废弃版本）。
 * @param param - 参数定义
 * @param version - 目标版本
 * @returns 已废弃时为 true
 */
export function isDeprecatedAt(param: VersionedParam, version: TargetVersion): boolean {
  return (
    !isAvailable(param, version) && VERSION_ORDER[param.introducedIn] <= VERSION_ORDER[version]
  );
}

/**
 * 是否在面板保留"已废弃"提示行：仅在版本轴内可用过、之后才废弃的参数显示
 * （如 io-threads-do-reads 于 8.0 废弃）；自 7.0 起就废弃的旧名别名不显示。
 * @param param - 参数定义
 * @returns 需要显示废弃提示行时为 true
 */
export function showsDeprecationNotice(param: VersionedParam): boolean {
  return !!param.deprecatedIn && VERSION_ORDER[param.deprecatedIn] > VERSION_ORDER[AXIS_START];
}
