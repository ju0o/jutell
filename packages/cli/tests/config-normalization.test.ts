import { describe, expect, it } from 'vitest';
import { FEATURE_IDS, PROFILE_FEATURES, normalizeConfig } from '../src/config/managed.js';

const oldConfigWithoutExplainedDiff = (profile: string) => ({ version: 1, profile, features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true }, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 }, mcp: { enabled: false } });

describe('CLI voice preset normalization (V1.5.3)', () => {
  it('defaults missing voice to default and keeps supported presets', () => {
    const missing = normalizeConfig({ version: 1, profile: 'balanced', features: {}, limits: {} });
    expect(missing.voice).toEqual({ preset: 'default' });
    expect(normalizeConfig({ version: 1, profile: 'balanced', features: {}, limits: {}, voice: { preset: 'plain' } }).voice).toEqual({ preset: 'plain' });
    expect(normalizeConfig({ version: 1, profile: 'balanced', features: {}, limits: {}, voice: { preset: 'learning' } }).voice).toEqual({ preset: 'learning' });
    expect(normalizeConfig({ version: 1, profile: 'balanced', features: {}, limits: {}, voice: { preset: 'jutell' } }).voice).toEqual({ preset: 'jutell' });
  });

  it('falls back invalid voice presets to default without dropping the rest of the config', () => {
    const normalized = normalizeConfig({ version: 1, profile: 'minimal', features: {}, limits: {}, voice: { preset: 'robot' } });
    expect(normalized.profile).toBe('minimal');
    expect(normalized.voice).toEqual({ preset: 'default' });
  });
});

describe('CLI explainedDiff profile semantics (J01-CLI-001)', () => {
  it('fills missing explainedDiff with false for old minimal configs', () => {
    expect(normalizeConfig(oldConfigWithoutExplainedDiff('minimal')).features.explainedDiff).toBe(false);
  });

  it('fills missing explainedDiff with true for old balanced configs', () => {
    expect(normalizeConfig(oldConfigWithoutExplainedDiff('balanced')).features.explainedDiff).toBe(true);
  });

  it('fills missing explainedDiff with true for old learning configs', () => {
    expect(normalizeConfig(oldConfigWithoutExplainedDiff('learning')).features.explainedDiff).toBe(true);
  });

  it('fills missing explainedDiff with true for old detailed configs', () => {
    expect(normalizeConfig(oldConfigWithoutExplainedDiff('detailed')).features.explainedDiff).toBe(true);
  });

  it('keeps explicit explainedDiff=true even in the minimal profile', () => {
    const config = { ...oldConfigWithoutExplainedDiff('minimal'), features: { ...oldConfigWithoutExplainedDiff('minimal').features, explainedDiff: true } };
    expect(normalizeConfig(config).features.explainedDiff).toBe(true);
  });

  it('keeps explicit explainedDiff=false even in the balanced profile', () => {
    const config = { ...oldConfigWithoutExplainedDiff('balanced'), features: { ...oldConfigWithoutExplainedDiff('balanced').features, explainedDiff: false } };
    expect(normalizeConfig(config).features.explainedDiff).toBe(false);
  });

  it('matches the canonical MCP/local-admin profile matrix for every official feature', () => {
    expect(PROFILE_FEATURES.minimal).toEqual({
      changeSummary: true,
      userVisibleChanges: true,
      internalChanges: false,
      mainFiles: false,
      explainedDiff: false,
      glossary: false,
      validationResults: true,
      riskAssessment: false,
      userActions: true,
      nextActionSuggestions: false,
      requestClarificationGuide: false,
      manualEditGuidance: false,
      requestBuilder: true,
    });
    for (const profile of ['balanced', 'learning', 'detailed'] as const) {
      expect(PROFILE_FEATURES[profile]).toEqual(Object.fromEntries(FEATURE_IDS.map((id) => [id, true])));
    }
    for (const profile of ['minimal', 'balanced', 'learning', 'detailed'] as const) {
      expect(Object.keys(PROFILE_FEATURES[profile]).sort()).toEqual([...FEATURE_IDS].sort());
    }
  });

  it('normalizes a completely empty feature object with Profile defaults', () => {
    const normalized = normalizeConfig({ version: 1, profile: 'minimal', limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 } });
    expect(normalized.features.internalChanges).toBe(false);
    expect(normalized.features.explainedDiff).toBe(false);
    expect(normalized.features.requestBuilder).toBe(true);
  });
});
