import { describe, expect, it } from 'vitest';
import { changedFields, DEFAULT_CONFIG, PROFILES, validateConfig } from './schema.js';

describe('local-admin receiptReport configuration', () => {
  it('accepts receiptReport without resetting the selected profile or explicit value', () => {
    const result = validateConfig({
      ...DEFAULT_CONFIG,
      profile: 'minimal',
      features: { ...DEFAULT_CONFIG.features, receiptReport: false },
      limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profile).toBe('minimal');
      expect(result.value.features.receiptReport).toBe(false);
      expect(result.value.limits.maxMainFiles).toBe(3);
    }
  });

  it('defaults receiptReport on in every Profile', () => {
    for (const profile of ['minimal', 'balanced', 'learning', 'detailed'] as const) {
      const result = validateConfig({
        version: 1,
        profile,
        features: {},
        limits: PROFILES[profile].limits,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.features.receiptReport).toBe(true);
    }
  });
});

describe('local-admin map.gitExclude configuration (same as CLI and MCP server)', () => {
  it('accepts and keeps map.gitExclude instead of rejecting the whole config', () => {
    const result = validateConfig({ ...DEFAULT_CONFIG, profile: 'minimal', map: { gitExclude: true } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ profile: 'minimal', map: { gitExclude: true } });
  });
  it('does not add map when absent', () => {
    const result = validateConfig({ ...DEFAULT_CONFIG });
    expect(result.ok && 'map' in result.value).toBe(false);
  });
  it('rejects unknown map keys and non-boolean values', () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, map: { gitExclude: 'yes' } }).ok).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, map: { other: true } }).ok).toBe(false);
  });
  it('records map.gitExclude changes in history', () => {
    expect(changedFields(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, map: { gitExclude: true } })).toEqual([{ field: 'map.gitExclude', before: false, after: true }]);
  });
});
