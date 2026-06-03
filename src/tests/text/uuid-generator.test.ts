import { describe, it, expect } from 'vitest';
import {
  generateUuid,
  generateUuids,
  isNamespaceVersion,
  hasConversion,
  getConvertedUuid,
  getConversionLabel,
  formatUuid,
  decodeUuid,
  getVersionDescription,
  NAMESPACE_PRESETS,
  VERSION_OPTIONS,
  FORMAT_OPTIONS,
  NAMESPACE_PRESET_OPTIONS,
} from '../../utils/text/uuid-generator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_NODASH_REGEX = /^[0-9a-f]{32}$/i;

describe('uuid-generator utils', () => {
  // Existing generation tests
  describe('generateUuid', () => {
    it('generates a valid v1 UUID', () => {
      const uuid = generateUuid('v1');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('generates a valid v3 UUID with name and namespace', () => {
      const uuid = generateUuid('v3', { name: 'hello', namespace: NAMESPACE_PRESETS.DNS });
      expect(uuid).toMatch(UUID_REGEX);
      expect(uuid).toBe(generateUuid('v3', { name: 'hello', namespace: NAMESPACE_PRESETS.DNS }));
    });

    it('generates a valid v4 UUID', () => {
      const uuid = generateUuid('v4');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('generates a valid v5 UUID with name and namespace', () => {
      const uuid = generateUuid('v5', { name: 'hello', namespace: NAMESPACE_PRESETS.URL });
      expect(uuid).toMatch(UUID_REGEX);
      expect(uuid).toBe(generateUuid('v5', { name: 'hello', namespace: NAMESPACE_PRESETS.URL }));
    });

    it('generates a valid v6 UUID', () => {
      const uuid = generateUuid('v6');
      expect(uuid).toMatch(UUID_REGEX);
    });

    it('generates a valid v7 UUID', () => {
      const uuid = generateUuid('v7');
      expect(uuid).toMatch(UUID_REGEX);
    });
  });

  describe('generateUuids', () => {
    it('generates the requested number of UUIDs', () => {
      const uuids = generateUuids(5, 'v4');
      expect(uuids).toHaveLength(5);
      uuids.forEach((u) => expect(u).toMatch(UUID_REGEX));
    });

    it('clamps count to 1-500 range', () => {
      expect(generateUuids(0, 'v4')).toHaveLength(1);
      expect(generateUuids(600, 'v4')).toHaveLength(500);
    });
  });

  describe('isNamespaceVersion', () => {
    it('returns true for v3 and v5', () => {
      expect(isNamespaceVersion('v3')).toBe(true);
      expect(isNamespaceVersion('v5')).toBe(true);
    });

    it('returns false for other versions', () => {
      expect(isNamespaceVersion('v1')).toBe(false);
      expect(isNamespaceVersion('v4')).toBe(false);
      expect(isNamespaceVersion('v6')).toBe(false);
      expect(isNamespaceVersion('v7')).toBe(false);
    });
  });

  describe('v1↔v6 conversion', () => {
    it('converts v6 to v1', () => {
      const v6uuid = generateUuid('v6');
      const converted = getConvertedUuid('v6', v6uuid);
      expect(converted).toMatch(UUID_REGEX);
    });

    it('converts v1 to v6', () => {
      const v1uuid = generateUuid('v1');
      const converted = getConvertedUuid('v1', v1uuid);
      expect(converted).toMatch(UUID_REGEX);
    });

    it('returns null for non-convertible versions', () => {
      expect(getConvertedUuid('v4', 'whatever')).toBeNull();
    });

    it('returns correct conversion labels', () => {
      expect(getConversionLabel('v1')).toBe('→ v6');
      expect(getConversionLabel('v6')).toBe('→ v1');
      expect(getConversionLabel('v4')).toBeNull();
    });

    it('hasConversion returns true only for v1 and v6', () => {
      expect(hasConversion('v1')).toBe(true);
      expect(hasConversion('v6')).toBe(true);
      expect(hasConversion('v4')).toBe(false);
    });
  });

  // New: formatUuid tests
  describe('formatUuid', () => {
    const canonical = '550e8400-e29b-41d4-a716-446655440000';

    it('formats as lowercase with dashes', () => {
      expect(formatUuid(canonical, 'lowercase')).toBe(canonical);
    });

    it('formats as uppercase with dashes', () => {
      const result = formatUuid(canonical, 'uppercase');
      expect(result).toBe(canonical.toUpperCase());
      expect(result).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);
    });

    it('formats as lowercase without dashes', () => {
      const result = formatUuid(canonical, 'lowercase-nodash');
      expect(result).toMatch(UUID_NODASH_REGEX);
      expect(result).toBe(result.toLowerCase());
    });

    it('formats as uppercase without dashes', () => {
      const result = formatUuid(canonical, 'uppercase-nodash');
      expect(result).toMatch(UUID_NODASH_REGEX);
      expect(result).toBe(result.toUpperCase());
    });

    it('formats with braces', () => {
      const result = formatUuid(canonical, 'braces');
      expect(result).toBe(`{${canonical}}`);
    });

    it('formats as URN', () => {
      const result = formatUuid(canonical, 'urn');
      expect(result).toBe(`urn:uuid:${canonical}`);
    });

    it('handles uppercase input correctly', () => {
      const upper = canonical.toUpperCase();
      expect(formatUuid(upper, 'lowercase')).toBe(canonical);
    });

    it('handles braces input correctly', () => {
      const input = `{${canonical}}`;
      expect(formatUuid(input, 'lowercase')).toBe(canonical);
    });
  });

  // New: decodeUuid tests
  describe('decodeUuid', () => {
    it('decodes a v1 UUID with timestamp, clock, and node', () => {
      const uuid = generateUuid('v1');
      const decoded = decodeUuid(uuid);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(1);
      expect(decoded.variant).toBe('DCE 1.1');
      expect(decoded.timestamp).toBeTruthy();
      expect(decoded.clockSequence).toBeGreaterThanOrEqual(0);
      expect(decoded.node).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i);
    });

    it('decodes a v3 UUID with MD5 hash', () => {
      const uuid = generateUuid('v3', { name: 'test', namespace: NAMESPACE_PRESETS.DNS });
      const decoded = decodeUuid(uuid);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(3);
      expect(decoded.hashType).toBe('MD5');
      expect(decoded.timestamp).toBeNull();
    });

    it('decodes a v4 UUID as random', () => {
      const uuid = generateUuid('v4');
      const decoded = decodeUuid(uuid);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(4);
      expect(decoded.note).toBe('纯随机');
      expect(decoded.timestamp).toBeNull();
    });

    it('decodes a v5 UUID with SHA-1 hash', () => {
      const uuid = generateUuid('v5', { name: 'test', namespace: NAMESPACE_PRESETS.URL });
      const decoded = decodeUuid(uuid);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(5);
      expect(decoded.hashType).toBe('SHA-1');
    });

    it('decodes a v6 UUID with timestamp, clock, and node', () => {
      const uuid = generateUuid('v6');
      const decoded = decodeUuid(uuid);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(6);
      expect(decoded.timestamp).toBeTruthy();
      expect(decoded.clockSequence).toBeGreaterThanOrEqual(0);
      expect(decoded.node).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i);
    });

    it('decodes a v7 UUID with unix timestamp', () => {
      const uuid = generateUuid('v7');
      const decoded = decodeUuid(uuid);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(7);
      expect(decoded.unixTimestampMs).toBeGreaterThan(0);
      expect(decoded.timestamp).toBeTruthy();
    });

    it('returns valid=false for garbage string', () => {
      const decoded = decodeUuid('not-a-uuid');
      expect(decoded.valid).toBe(false);
      expect(decoded.note).toBe('无效的 UUID 格式');
    });

    it('returns valid=false for wrong-length hex', () => {
      const decoded = decodeUuid('550e8400-e29b-41d4-a716-4466554400');
      expect(decoded.valid).toBe(false);
    });

    it('handles braces input', () => {
      const uuid = generateUuid('v4');
      const decoded = decodeUuid(`{${uuid}}`);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(4);
    });

    it('handles URN input', () => {
      const uuid = generateUuid('v4');
      const decoded = decodeUuid(`urn:uuid:${uuid}`);
      expect(decoded.valid).toBe(true);
      expect(decoded.version).toBe(4);
    });
  });

  // New: NAMESPACE_PRESETS
  describe('NAMESPACE_PRESETS', () => {
    it('includes DNS, URL, OID, X500', () => {
      expect(NAMESPACE_PRESETS.DNS).toMatch(UUID_REGEX);
      expect(NAMESPACE_PRESETS.URL).toMatch(UUID_REGEX);
      expect(NAMESPACE_PRESETS.OID).toMatch(UUID_REGEX);
      expect(NAMESPACE_PRESETS.X500).toMatch(UUID_REGEX);
    });
  });

  // New: Constants
  describe('constants', () => {
    it('VERSION_OPTIONS has 6 entries', () => {
      expect(VERSION_OPTIONS).toHaveLength(6);
    });

    it('FORMAT_OPTIONS has 6 entries', () => {
      expect(FORMAT_OPTIONS).toHaveLength(6);
    });

    it('NAMESPACE_PRESET_OPTIONS has 5 entries', () => {
      expect(NAMESPACE_PRESET_OPTIONS).toHaveLength(5);
    });
  });

  // New: getVersionDescription
  describe('getVersionDescription', () => {
    it('returns non-empty string for each version', () => {
      const versions = ['v1', 'v3', 'v4', 'v5', 'v6', 'v7'] as const;
      for (const v of versions) {
        const desc = getVersionDescription(v);
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });
});
