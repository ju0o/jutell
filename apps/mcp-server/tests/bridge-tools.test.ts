import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config/bridge-config.js';
import { activeFeatures, beginnerReportRules, bridgeStatus, parseSkillVersion, reportPreferences, safeReportRequirements } from '../src/tools/bridge-tools.js';

describe('JuTell MCP read-only data', () => {
  it('keeps old settings valid when mcp is absent', () => {
    const oldConfig = { version: 1, profile: 'balanced', features: DEFAULT_CONFIG.features, limits: DEFAULT_CONFIG.limits };
    expect(normalizeConfig(oldConfig).mcp).toEqual({ enabled: false });
  });

  it('drops unsupported mcp fields and keeps only the enabled flag', () => {
    const invalid = normalizeConfig({ ...DEFAULT_CONFIG, mcp: { enabled: true, token: 'hidden' } });
    expect(invalid.mcp).toEqual({ enabled: true });
  });

  it('accepts a legacy autoStart value but ignores it for output', () => {
    const legacy = normalizeConfig({ ...DEFAULT_CONFIG, mcp: { enabled: true, autoStart: true } });
    expect(legacy.mcp).toEqual({ enabled: true });
  });

  it('returns status without project content or secrets', () => {
    const status = bridgeStatus({ config: DEFAULT_CONFIG, configExists: true, skillExists: true, agentsExists: true, skillText: undefined });
    expect(status.externalTransmission).toBe(false);
    expect(status.telemetryEnabled).toBe(false);
    expect(JSON.stringify(status)).not.toMatch(/prompt|diff|apiKey|token|password|cookie|autoStart/i);
  });

  it('parses a machine-readable skill version from the SKILL.md frontmatter', () => {
    expect(parseSkillVersion('---\nname: beginner-bridge\njutellSkillVersion: "0.2.1"\n---\nbody')).toBe('0.2.1');
    expect(parseSkillVersion(undefined)).toBeUndefined();
  });

  it('returns every feature and current report preferences', () => {
    expect(activeFeatures(DEFAULT_CONFIG)).toHaveLength(12);
    expect(activeFeatures(DEFAULT_CONFIG).find((item) => item.id === 'glossary')).toMatchObject({ name: '개발 용어 설명', active: true });
    expect(activeFeatures(DEFAULT_CONFIG).find((item) => item.id === 'requestBuilder')).toMatchObject({ name: '요청 만들기', active: true });
    expect(reportPreferences(DEFAULT_CONFIG)).toMatchObject({ profile: 'balanced', profileName: '균형 보고', limits: DEFAULT_CONFIG.limits });
  });

  it('fills missing helper feature keys with defaults for backward compatibility', () => {
    const oldConfig = { version: 1, profile: 'minimal', features: { changeSummary: true, userVisibleChanges: true, internalChanges: false, mainFiles: false, glossary: false, validationResults: true, riskAssessment: false, userActions: true }, limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 } };
    const normalized = normalizeConfig(oldConfig);
    expect(normalized.features.nextActionSuggestions).toBe(false);
    expect(normalized.features.requestClarificationGuide).toBe(false);
    expect(normalized.features.manualEditGuidance).toBe(false);
    expect(normalized.features.requestBuilder).toBe(true);
    expect(normalized.profile).toBe('minimal');
    expect(normalized.limits).toEqual(oldConfig.limits);
  });

  it('returns only active rules and mandatory safety requirements, and exposes the diff rule', () => {
    const config = { ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, glossary: false, internalChanges: false } };
    const rules = beginnerReportRules(config);
    expect(rules.activeReportSections).not.toContain('개발 용어 설명');
    expect(rules.safetyRequirements).toContain('비밀정보 노출 위험');
    expect(safeReportRequirements().alwaysReport).toContain('작업 실패');
    expect(rules.notCollected).toContain('Prompt');
    expect(rules.notCollected).toContain('비밀정보');
    expect(rules.diffRule).toMatch(/코드 또는 Diff/);
  });
});
