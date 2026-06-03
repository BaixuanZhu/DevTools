import { v1, v3, v4, v5, v6, v7, v6ToV1, v1ToV6, parse, validate, version } from 'uuid';

/** UUID 版本标识 */
export type UuidVersion = 'v1' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7';

/** 输出格式 */
export type UuidFormat =
  | 'lowercase'
  | 'uppercase'
  | 'lowercase-nodash'
  | 'uppercase-nodash'
  | 'braces'
  | 'urn';

/** 解码后的 UUID 信息 */
export interface DecodedUuid {
  raw: string;
  valid: boolean;
  version: number | null;
  variant: string | null;
  variantRaw: string;
  timestamp: string | null;
  unixTimestampMs: number | null;
  clockSequence: number | null;
  node: string | null;
  hashType: string | null;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** v3/v5 的命名空间预设 */
export const NAMESPACE_PRESETS = {
  DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  OID: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  X500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
} as const;

export const VERSION_OPTIONS = [
  { value: 'v1', label: '版本 1 - 基于 MAC 地址和时间戳' },
  { value: 'v3', label: '版本 3 - 命名空间 + MD5 哈希' },
  { value: 'v4', label: '版本 4 - 纯随机（最常用）' },
  { value: 'v5', label: '版本 5 - 命名空间 + SHA-1 哈希' },
  { value: 'v6', label: '版本 6 - 可排序的类 v1（字段重排）' },
  { value: 'v7', label: '版本 7 - 基于 Unix 时间戳排序' },
] as const;

export const FORMAT_OPTIONS = [
  { value: 'lowercase', label: '小写 + 连字符' },
  { value: 'uppercase', label: '大写 + 连字符' },
  { value: 'lowercase-nodash', label: '小写 + 无连字符' },
  { value: 'uppercase-nodash', label: '大写 + 无连字符' },
  { value: 'braces', label: '花括号' },
  { value: 'urn', label: 'URN' },
] as const;

export const NAMESPACE_PRESET_OPTIONS = [
  { value: 'DNS', label: 'DNS' },
  { value: 'URL', label: 'URL' },
  { value: 'OID', label: 'OID' },
  { value: 'X500', label: 'X500' },
  { value: 'custom', label: '自定义' },
] as const;

const VERSION_DESCRIPTIONS: Record<UuidVersion, string> = {
  v1: '基于 MAC 地址和时间戳，可追溯生成来源',
  v3: '基于命名空间和 MD5 哈希，相同输入始终产生相同 UUID',
  v4: '纯随机生成，最常用，适合作为通用标识符',
  v5: '基于命名空间和 SHA-1 哈希，相比 v3 更安全',
  v6: 'v1 的字段重排版本，适合作为数据库主键（单调递增）',
  v7: '基于 Unix 毫秒时间戳，天然按时间排序，推荐用于数据库主键',
};

/** RFC 4122 epoch: 1582-10-15 00:00:00 UTC in Unix milliseconds */
const UUID_EPOCH_MS = Date.UTC(1582, 9, 15, 0, 0, 0);

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export function isNamespaceVersion(version: UuidVersion): boolean {
  return version === 'v3' || version === 'v5';
}

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

export function generateUuids(
  count: number,
  version: UuidVersion,
  options?: { name?: string; namespace?: string }
): string[] {
  const safeCount = Math.min(Math.max(count, 1), 500);
  return Array.from({ length: safeCount }, () => generateUuid(version, options));
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export function convertV6ToV1(uuid: string): string {
  return v6ToV1(uuid);
}

export function convertV1ToV6(uuid: string): string {
  return v1ToV6(uuid);
}

export function hasConversion(version: UuidVersion): boolean {
  return version === 'v1' || version === 'v6';
}

export function getConvertedUuid(version: UuidVersion, uuid: string): string | null {
  if (version === 'v1') return convertV1ToV6(uuid);
  if (version === 'v6') return convertV6ToV1(uuid);
  return null;
}

export function getConversionLabel(version: UuidVersion): string | null {
  if (version === 'v1') return '→ v6';
  if (version === 'v6') return '→ v1';
  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 将标准 UUID 字符串按指定格式输出 */
export function formatUuid(uuid: string, format: UuidFormat): string {
  // Strip existing formatting: remove braces, URN prefix, dashes
  let hex = uuid
    .replace(/^\{|\}$/g, '')
    .replace(/^urn:uuid:/i, '')
    .replace(/-/g, '')
    .trim();

  // Re-insert dashes to get canonical lowercase form
  const canonical = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`.toLowerCase();

  switch (format) {
    case 'lowercase':
      return canonical;
    case 'uppercase':
      return canonical.toUpperCase();
    case 'lowercase-nodash':
      return hex.toLowerCase();
    case 'uppercase-nodash':
      return hex.toUpperCase();
    case 'braces':
      return `{${canonical}}`;
    case 'urn':
      return `urn:uuid:${canonical}`;
  }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/** 获取版本的简短描述 */
export function getVersionDescription(ver: UuidVersion): string {
  return VERSION_DESCRIPTIONS[ver] ?? '';
}

/** 100-nanosecond ticks to JavaScript Date */
function gregorianTicksToDate(ticks: bigint): Date {
  // 1 tick = 100ns; 1ms = 10,000 ticks
  const ms = Number(ticks / 10_000n);
  return new Date(UUID_EPOCH_MS + ms);
}

/** Extract timestamp from v1 byte layout */
function decodeV1Timestamp(bytes: Uint8Array): { date: Date; clockSequence: number; node: string } {
  const timeLow = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const timeMid = (bytes[4] << 8) | bytes[5];
  const timeHi = ((bytes[6] & 0x0f) << 8) | bytes[7];
  const ticks = (BigInt(timeLow) + (BigInt(timeMid) << 32n) + (BigInt(timeHi) << 48n));

  const clockSeq = ((bytes[8] & 0x3f) << 8) | bytes[9];

  const node = Array.from(bytes.slice(10))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');

  return { date: gregorianTicksToDate(ticks), clockSequence: clockSeq, node };
}

/** Pad a number to 2-digit hex */
function hx(n: number): string {
  return n.toString(16).padStart(2, '0');
}

/** Determine UUID variant from byte 8 */
function getVariant(b8: number): { name: string | null; raw: string } {
  if ((b8 & 0x80) === 0) return { name: 'NCS (reserved)', raw: hx(b8) };
  if ((b8 & 0xc0) === 0x80) return { name: 'DCE 1.1', raw: hx(b8) };
  if ((b8 & 0xe0) === 0xc0) return { name: 'Microsoft (reserved)', raw: hx(b8) };
  return { name: 'Future (reserved)', raw: hx(b8) };
}

export function decodeUuid(raw: string): DecodedUuid {
  // Strip formatting
  let cleaned = raw
    .replace(/^\{|\}$/g, '')
    .replace(/^urn:uuid:/i, '')
    .trim();

  // Validate hex-only form (with optional dashes)
  const hexOnly = cleaned.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hexOnly)) {
    return {
      raw,
      valid: false,
      version: null,
      variant: null,
      variantRaw: '',
      timestamp: null,
      unixTimestampMs: null,
      clockSequence: null,
      node: null,
      hashType: null,
      note: '无效的 UUID 格式',
    };
  }

  // Rebuild canonical form
  const canonical = `${hexOnly.slice(0, 8)}-${hexOnly.slice(8, 12)}-${hexOnly.slice(12, 16)}-${hexOnly.slice(16, 20)}-${hexOnly.slice(20, 32)}`.toLowerCase();

  const isValid = validate(canonical);
  const ver = isValid ? version(canonical) : null;
  let bytes: Uint8Array | null = null;

  try {
    bytes = new Uint8Array(parse(canonical));
  } catch {
    // parse failed, invalid UUID
  }

  const variantInfo = bytes ? getVariant(bytes[8]) : { name: null, raw: '' };

  // Try to check variant validity from byte 8
  if (bytes) {
    // valid DCE variant should have 10xxxxxx in byte 8
    if ((bytes[8] & 0xc0) !== 0x80) {
      return {
        raw,
        valid: false,
        version: ver,
        variant: variantInfo.name,
        variantRaw: variantInfo.raw,
        timestamp: null,
        unixTimestampMs: null,
        clockSequence: null,
        node: null,
        hashType: null,
        note: `非标准变体: ${variantInfo.name}`,
      };
    }
  }

  let timestamp: string | null = null;
  let unixTimestampMs: number | null = null;
  let clockSequence: number | null = null;
  let node: string | null = null;
  let hashType: string | null = null;
  let note: string | null = null;

  if (bytes && ver !== null) {
    switch (ver) {
      case 1: {
        const d = decodeV1Timestamp(bytes);
        timestamp = d.date.toISOString();
        clockSequence = d.clockSequence;
        node = d.node;
        break;
      }
      case 3:
        hashType = 'MD5';
        break;
      case 4:
        note = '纯随机';
        break;
      case 5:
        hashType = 'SHA-1';
        break;
      case 6: {
        // Convert v6 → v1 to decode timestamp
        try {
          const v1uuid = v6ToV1(canonical);
          const v1bytes = new Uint8Array(parse(v1uuid));
          const d = decodeV1Timestamp(v1bytes);
          timestamp = d.date.toISOString();
          clockSequence = d.clockSequence;
          node = d.node;
        } catch {
          // conversion failed
        }
        break;
      }
      case 7: {
        // Bytes 0-5: Unix ms timestamp (big-endian 48-bit)
        const tHi = (bytes[0] << 8) | bytes[1];
        const tMid = (bytes[2] << 16) | (bytes[3] << 8) | bytes[4];
        const tLo = bytes[5];
        unixTimestampMs = (tHi * 0x1000000 + tMid) * 256 + tLo;
        timestamp = new Date(unixTimestampMs).toISOString();
        break;
      }
    }
  }

  return {
    raw,
    valid: isValid,
    version: ver,
    variant: variantInfo.name,
    variantRaw: variantInfo.raw,
    timestamp,
    unixTimestampMs,
    clockSequence,
    node,
    hashType,
    note,
  };
}
