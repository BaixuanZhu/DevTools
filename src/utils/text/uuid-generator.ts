import { v1, v3, v4, v5, v6, v7, v6ToV1, v1ToV6 } from 'uuid';

/** UUID 版本标识 */
export type UuidVersion = 'v1' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7';

/** v3/v5 的命名空间预设 */
export const NAMESPACE_PRESETS = {
  DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
} as const;

/** 判断版本是否需要 name + namespace 参数 */
export function isNamespaceVersion(version: UuidVersion): boolean {
  return version === 'v3' || version === 'v5';
}

/** 根据版本生成单个 UUID */
export function generateUuid(
  version: UuidVersion,
  options?: { name?: string; namespace?: string }
): string {
  switch (version) {
    case 'v1':
      return v1();
    case 'v3':
      return v3(options?.name ?? '', options?.namespace ?? NAMESPACE_PRESETS.DNS);
    case 'v4':
      return v4();
    case 'v5':
      return v5(options?.name ?? '', options?.namespace ?? NAMESPACE_PRESETS.URL);
    case 'v6':
      return v6();
    case 'v7':
      return v7();
    default:
      return v4();
  }
}

/** 生成多个 UUID */
export function generateUuids(
  count: number,
  version: UuidVersion,
  options?: { name?: string; namespace?: string }
): string[] {
  const safeCount = Math.min(Math.max(count, 1), 100);
  return Array.from({ length: safeCount }, () => generateUuid(version, options));
}

/** 将 v6 UUID 转换为 v1 */
export function convertV6ToV1(uuid: string): string {
  return v6ToV1(uuid);
}

/** 将 v1 UUID 转换为 v6 */
export function convertV1ToV6(uuid: string): string {
  return v1ToV6(uuid);
}

/** 判断版本是否支持转换（v1 或 v6） */
export function hasConversion(version: UuidVersion): boolean {
  return version === 'v1' || version === 'v6';
}

/** 获取转换后的 UUID */
export function getConvertedUuid(version: UuidVersion, uuid: string): string | null {
  if (version === 'v1') return convertV1ToV6(uuid);
  if (version === 'v6') return convertV6ToV1(uuid);
  return null;
}

/** 获取转换目标版本标签 */
export function getConversionLabel(version: UuidVersion): string | null {
  if (version === 'v1') return '→ v6';
  if (version === 'v6') return '→ v1';
  return null;
}
