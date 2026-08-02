import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config/bridge-config.js';
import { activeFeatures, beginnerReportRules, bridgeStatus, reportPreferences, safeReportRequirements } from '../src/tools/bridge-tools.js';

describe('Beginner Bridge MCP read-only data', () => {
  it('keeps old settings valid when mcp is absent', () => {
    const oldConfig = { version: 1, profile: 'balanced', features: DEFAULT_CONFIG.features, limits: DEFAULT_CONFIG.limits };
    expect(normalizeConfig(oldConfig).mcp).toEqual({ enabled: false, autoStart: false });
  });

  it('rejects unsupported mcp fields by falling back safely', () => {
    const invalid = normalizeConfig({ ...DEFAULT_CONFIG, mcp: { enabled: true, autoStart: false, token: 'hidden' } });
    expect(invalid).toEqual(DEFAULT_CONFIG);
  });

  it('returns status without project content or secrets', () => {
    const status = bridgeStatus({ config: DEFAULT_CONFIG, configExists: true, skillExists: true, agentsExists: true });
    expect(status.externalTransmission).toBe(false);
    expect(status.telemetryEnabled).toBe(false);
    expect(JSON.stringify(status)).not.toMatch(/prompt|diff|apiKey|token|password|cookie/i);
  });

  it('returns every feature and current report preferences', () => {
    expect(activeFeatures(DEFAULT_CONFIG)).toHaveLength(8);
    expect(activeFeatures(DEFAULT_CONFIG).find((item) => item.id === 'glossary')).toMatchObject({ name: '개발 용어 설명', active: true });
    expect(reportPreferences(DEFAULT_CONFIG)).toMatchObject({ profile: 'balanced', profileName: '균형 보고', limits: DEFAULT_CONFIG.limits });
  });

  it('returns only active rules and mandatory safety requirements', () => {
    const config = { ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, glossary: false, internalChanges: false } };
    const rules = beginnerReportRules(config);
    expect(rules.activeReportSections).not.toContain('개발 용어 설명');
    expect(rules.safetyRequirements).toContain('비밀정보 노출 위험');
    expect(safeReportRequirements().alwaysReport).toContain('작업 실패');
    expect(rules.notCollected).toContain('Prompt');
    expect(rules.notCollected).toContain('비밀정보');
  });
});
