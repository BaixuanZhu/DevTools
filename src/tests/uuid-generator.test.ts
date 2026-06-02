import { describe, it, expect } from 'vitest';
import {
  generateUuid,
  generateUuids,
  isNamespaceVersion,
  hasConversion,
  getConvertedUuid,
  getConversionLabel,
  NAMESPACE_PRESETS,
} from '../utils/uuid-generator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('uuid-generator utils', () => {
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

    it('clamps count to 1-100 range', () => {
      expect(generateUuids(0, 'v4')).toHaveLength(1);
      expect(generateUuids(200, 'v4')).toHaveLength(100);
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
});
