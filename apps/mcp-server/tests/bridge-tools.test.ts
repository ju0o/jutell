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
    expect(activeFeatures(DEFAULT_CONFIG)).toHaveLength(13);
    expect(activeFeatures(DEFAULT_CONFIG).find((item) => item.id === 'glossary')).toMatchObject({ name: '개발 용어 설명', active: true });
    expect(activeFeatures(DEFAULT_CONFIG).find((item) => item.id === 'explainedDiff')).toMatchObject({ name: '설명형 변경 요약', active: true });
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

describe('explainedDiff (J01 explained diff reporting)', () => {
  const sections = ['무엇을 바꿨나요?', '왜 바꿨나요?', '어디를 바꿨나요?', '실제 중요한 변경', '내가 직접 다듬고 싶다면?'];

  it('exposes the five beginner-friendly sections for a normal meaningful change', () => {
    const rule = beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule;
    expect(rule.sections).toEqual(sections);
    expect(rule.when).toMatch(/의미 있는 변경/);
  });

  it('never fabricates a reason when the why evidence is missing', () => {
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.noEvidenceRules.why).toMatch(/추측하지 않고/);
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.noEvidenceRules.why).toContain('변경 이유는 Agent 결과에서 확인되지 않았습니다.');
  });

  it('groups related changes instead of repeating the whole diff', () => {
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.groupingRule).toMatch(/묶어 설명/);
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.groupingRule).toContain('전체 Diff 원문을 반복하지 않습니다');
  });

  it('requires code evidence before offering a customization hint', () => {
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.noEvidenceRules.customization).toMatch(/근거가 없으면/);
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.noEvidenceRules.customization).toContain('만들지 않습니다');
  });

  it('does not present risky areas as simple visual customization points', () => {
    expect(beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.noEvidenceRules.riskyArea).toContain('제시하지 않');
  });

  it('fills explainedDiff with the Profile default for configs written before it existed', () => {
    const oldConfig = { version: 1, profile: 'balanced', features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true }, limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 } };
    const normalized = normalizeConfig(oldConfig);
    expect(normalized.features.explainedDiff).toBe(true);
    expect(beginnerReportRules(normalized).explainedDiffRule).toBeDefined();
  });

  it('omits only the explained diff guidance when the feature is off and keeps other fields intact', () => {
    const rules = beginnerReportRules({ ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, explainedDiff: false } });
    expect(rules.explainedDiffRule).toBeUndefined();
    expect(rules.diffRule).toMatch(/코드 또는 Diff/);
    expect(rules.evidenceRule).toBeDefined();
    expect(rules.statusRule).toBeDefined();
    expect(rules.safetyRequirements.length).toBeGreaterThan(0);
    expect(rules.notCollected).toContain('비밀정보');
  });

  it('keeps explainedDiff off in the minimal profile by default', () => {
    const normalized = normalizeConfig({ version: 1, profile: 'minimal', limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 } });
    expect(normalized.features.explainedDiff).toBe(false);
    expect(beginnerReportRules(normalized).explainedDiffRule).toBeUndefined();
  });

  it('keeps glossary behavior unchanged while explained diff guidance is present', () => {
    const rules = beginnerReportRules(DEFAULT_CONFIG);
    expect(rules.activeReportSections).toContain('개발 용어 설명');
    expect(activeFeatures(DEFAULT_CONFIG).find((item) => item.id === 'glossary')).toMatchObject({ active: true });
  });

  it('includes readable-code guidance that reuses already-known evidence only', () => {
    const readable = beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.readableCodeRule;
    expect(readable.when).toContain('이미 작업 과정에서 확인되었고');
    expect(readable.when).toContain('1~2개까지');
    expect(readable.maxSnippets).toBe(2);
    expect(readable.absoluteMaxSnippets).toBe(2);
    expect(readable.reuseOnly).toMatch(/다시 읽거나/);
    expect(readable.reuseOnly).toMatch(/git diff/);
    expect(readable.omitWhen.join(' ')).toMatch(/근거가 없다/);
  });

  it('caps readable code at hard max 2 and never allows more than 2', () => {
    const readable = beginnerReportRules(DEFAULT_CONFIG).explainedDiffRule.readableCodeRule;
    expect(readable.maxSnippets).toBe(2);
    expect(readable.absoluteMaxSnippets).toBe(2);
    expect(readable.maxSnippets).toBe(readable.absoluteMaxSnippets);
  });

  it('omits readable-code guidance together with explainedDiff when the feature is off', () => {
    const rules = beginnerReportRules({ ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, explainedDiff: false } });
    expect(rules.explainedDiffRule).toBeUndefined();
  });
});

describe('voice preset runtime (V1.5.3)', () => {
  it('defaults missing voice to default and does not silently drop a valid preset', () => {
    const withoutVoice = normalizeConfig({ version: 1, profile: 'balanced', features: DEFAULT_CONFIG.features, limits: DEFAULT_CONFIG.limits });
    expect(withoutVoice.voice).toEqual({ preset: 'default' });
    const withPlain = normalizeConfig({ ...DEFAULT_CONFIG, voice: { preset: 'plain' } });
    expect(withPlain.voice).toEqual({ preset: 'plain' });
    expect(bridgeStatus({ config: withPlain, configExists: true, skillExists: true, agentsExists: true, skillText: undefined }).voicePreset).toBe('plain');
  });

  it('normalizes each supported preset and exposes a distinct voiceRule', () => {
    for (const preset of ['default', 'plain', 'learning', 'jutell'] as const) {
      const config = normalizeConfig({ ...DEFAULT_CONFIG, voice: { preset } });
      expect(config.voice.preset).toBe(preset);
      const rule = beginnerReportRules(config).voiceRule;
      expect(rule.preset).toBe(preset);
      expect(rule.guidance.length).toBeGreaterThan(10);
    }
    expect(beginnerReportRules({ ...DEFAULT_CONFIG, voice: { preset: 'plain' } }).voiceRule.style).toMatch(/짧/);
    expect(beginnerReportRules({ ...DEFAULT_CONFIG, voice: { preset: 'learning' } }).voiceRule.style).toMatch(/용어/);
    expect(beginnerReportRules({ ...DEFAULT_CONFIG, voice: { preset: 'jutell' } }).voiceRule.style).toMatch(/JuTell/);
  });

  it('keeps safety and evidence rules unchanged across voice presets', () => {
    const base = beginnerReportRules(DEFAULT_CONFIG);
    for (const preset of ['plain', 'learning', 'jutell'] as const) {
      const rules = beginnerReportRules({ ...DEFAULT_CONFIG, voice: { preset } });
      expect(rules.evidenceRule).toBe(base.evidenceRule);
      expect(rules.statusRule).toBe(base.statusRule);
      expect(rules.safetyRequirements).toEqual(base.safetyRequirements);
      expect(rules.notCollected).toEqual(base.notCollected);
    }
  });

  it('falls back to default config when voice preset is invalid', () => {
    const invalid = normalizeConfig({ ...DEFAULT_CONFIG, voice: { preset: 'robot' } });
    expect(invalid).toEqual(DEFAULT_CONFIG);
  });
});

describe('lightweight handoff guidance (V1.5.3)', () => {
  it('exposes handoffRule when requestBuilder is on', () => {
    const rule = beginnerReportRules(DEFAULT_CONFIG).handoffRule;
    expect(rule.title).toBe('다음 AI에게 전달하기');
    expect(rule.sections).toEqual(expect.arrayContaining(['지금 하던 일', '방금 끝난 것', '확인된 것', '아직 확인하지 못한 것']));
    expect(rule.evidenceRule).toMatch(/이미 아는 근거만/);
    expect(rule.format).toMatch(/Markdown/);
  });

  it('omits handoffRule when requestBuilder is off', () => {
    const rules = beginnerReportRules({ ...DEFAULT_CONFIG, features: { ...DEFAULT_CONFIG.features, requestBuilder: false } });
    expect(rules.handoffRule).toBeUndefined();
  });
});
