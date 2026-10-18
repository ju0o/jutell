import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, PROFILES, validateConfig } from './schema.js';

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
