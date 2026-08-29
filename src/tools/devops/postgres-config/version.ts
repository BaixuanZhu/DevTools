/**
 * PostgreSQL 版本序数与参数可用性过滤（纯函数层）。
 *
 * 版本轴为 16 / 17 / 18 三点；版本元数据以
 * research/postgres-params-version-notes.md 为准（源：官方 versioning policy
 * 与 16.15/17.11/18.6 docs tarball + guc_tables.c 逐项核对）。
 *
 * 与 MySQL 版的关键差异：官方 versioning policy 保证 minor 版本不引入新参数、
 * 不改默认值，且 16→17→18 窗口内的 rename/移除（ssl_ecdh_curve→ssl_groups、
 * old_snapshot_threshold、trace_recovery_messages）均不在本注册表——不存在
 * MySQL 的"轴点安全方向"陷阱，也没有弃用徽章场景。因此版本建模不靠
 * introducedIn/deprecatedIn 区间推导，而是注册表逐条目给出 availableIn
 * 白名单（仅 18 独有的异步 IO 组两参数收窄到 ['18']），isAvailable 做集合判断。
 */

/** 版本轴：PostgreSQL 三点枚举（按钮组与参数可用性标注共用） */
export type PgVersion = '16' | '17' | '18';

/** 版本 → 序数（越小越早），供页面层做有序版本比较（如"18 新增"类提示） */
export const VERSION_ORDER: Record<PgVersion, number> = {
  '16': 0,
  '17': 1,
  '18': 2,
};

/** 版本按钮组选项（value 写入 ctx.version，label 为按钮显示文案） */
export interface VersionOption {
  /** 写入 ctx.version 的版本值 */
  value: PgVersion;
  /** 按钮显示文案（附官方维护截止月份，提示升级窗口） */
  label: string;
}

/**
 * 目标版本轴（按钮组顺序即升序）。
 * 维护截止日期出自官方 versioning policy 表：16 → 2028-11、17 → 2029-11、18 → 2030-11。
 */
export const TARGET_VERSIONS: readonly VersionOption[] = [
  { value: '16', label: '16（维护至 2028-11）' },
  { value: '17', label: '17（维护至 2029-11）' },
  { value: '18', label: '18（维护至 2030-11）' },
];

/** 参与版本判断的最小参数结构（避免与 params.ts 相互依赖） */
export interface VersionedParam {
  /** 可用版本白名单（注册表条目的 availableIn） */
  availableIn: readonly PgVersion[];
}

/**
 * 判断参数在目标版本下是否可写入 conf：版本落在条目的 availableIn 白名单内。
 * 16–18 窗口无弃用参数，无需 isDeprecatedAt 之类的弃用判断。
 * @param param - 参数定义（含 availableIn）
 * @param version - 目标版本
 * @returns 可写入 conf 时为 true
 */
export function isAvailable(param: VersionedParam, version: PgVersion): boolean {
  return param.availableIn.includes(version);
}
