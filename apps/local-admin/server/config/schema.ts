import type { Config, FeatureId, Limits, McpSettings, Profile } from '../types.js';

export const SUPPORTED_VERSION = 1;

export const FEATURE_IDS: FeatureId[] = [
  'changeSummary',
  'userVisibleChanges',
  'internalChanges',
  'mainFiles',
  'explainedDiff',
  'glossary',
  'validationResults',
  'riskAssessment',
  'userActions',
  'nextActionSuggestions',
  'requestClarificationGuide',
  'manualEditGuidance',
  'requestBuilder',
];

export const PROFILES: Record<Profile, { features: Record<FeatureId, boolean>; limits: Limits }> = {
  minimal: {
    features: {
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
    },
    limits: { maxMainFiles: 3, maxGlossaryTerms: 1, compactReportMaxSentences: 8 },
  },
  balanced: {
    features: {
      changeSummary: true,
      userVisibleChanges: true,
      internalChanges: true,
      mainFiles: true,
      explainedDiff: true,
      glossary: true,
      validationResults: true,
      riskAssessment: true,
      userActions: true,
      nextActionSuggestions: true,
      requestClarificationGuide: true,
      manualEditGuidance: true,
      requestBuilder: true,
    },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  },
  learning: {
    features: {
      changeSummary: true,
      userVisibleChanges: true,
      internalChanges: true,
      mainFiles: true,
      explainedDiff: true,
      glossary: true,
      validationResults: true,
      riskAssessment: true,
      userActions: true,
      nextActionSuggestions: true,
      requestClarificationGuide: true,
      manualEditGuidance: true,
      requestBuilder: true,
    },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 6, compactReportMaxSentences: 12 },
  },
  detailed: {
    features: {
      changeSummary: true,
      userVisibleChanges: true,
      internalChanges: true,
      mainFiles: true,
      explainedDiff: true,
      glossary: true,
      validationResults: true,
      riskAssessment: true,
      userActions: true,
      nextActionSuggestions: true,
      requestClarificationGuide: true,
      manualEditGuidance: true,
      requestBuilder: true,
    },
    limits: { maxMainFiles: 5, maxGlossaryTerms: 6, compactReportMaxSentences: 18 },
  },
};

export const DEFAULT_CONFIG: Config = {
  version: SUPPORTED_VERSION,
  profile: 'balanced',
  features: { ...PROFILES.balanced.features },
  limits: { ...PROFILES.balanced.limits },
  mcp: { enabled: false },
  usageMeasurement: { localCountersEnabled: false },
};

export const LIMIT_RANGES = {
  maxMainFiles: { min: 1, max: 10 },
  maxGlossaryTerms: { min: 0, max: 10 },
  compactReportMaxSentences: { min: 4, max: 30 },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

const isFeatureId = (value: string): value is FeatureId => FEATURE_IDS.includes(value as FeatureId);

export type ValidationResult =
  | { ok: true; value: Config }
  | { ok: false; error: string };

export function validateConfig(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, error: '설정은 JSON 객체여야 합니다.' };
  if (!hasOnlyKeys(input, ['version', 'profile', 'features', 'limits', 'mcp', 'usageMeasurement', 'voice'])) {
    return { ok: false, error: '지원하지 않는 설정 항목이 있습니다.' };
  }
  if (input.version !== SUPPORTED_VERSION) return { ok: false, error: '지원하지 않는 설정 버전입니다.' };
  if (!['minimal', 'balanced', 'learning', 'detailed'].includes(String(input.profile))) {
    return { ok: false, error: '지원하지 않는 Profile입니다.' };
  }
  if (!isRecord(input.features) || !hasOnlyKeys(input.features, FEATURE_IDS)) {
    return { ok: false, error: '공식 Feature만 설정할 수 있습니다.' };
  }
  for (const featureId of FEATURE_IDS) {
    if (input.features[featureId] !== undefined && typeof input.features[featureId] !== 'boolean') {
      return { ok: false, error: 'Feature 값은 ON 또는 OFF여야 합니다.' };
    }
  }
  if (!isRecord(input.limits) || !hasOnlyKeys(input.limits, Object.keys(LIMIT_RANGES))) {
    return { ok: false, error: '지원하지 않는 limits 항목이 있습니다.' };
  }
  for (const [key, range] of Object.entries(LIMIT_RANGES)) {
    const value = input.limits[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
      return { ok: false, error: `${key}는 ${range.min}~${range.max} 사이의 정수여야 합니다.` };
    }
  }
  if ('mcp' in input && (!isRecord(input.mcp) || !hasOnlyKeys(input.mcp, ['enabled', 'autoStart']) || typeof input.mcp.enabled !== 'boolean' || (input.mcp.autoStart !== undefined && typeof input.mcp.autoStart !== 'boolean'))) {
    return { ok: false, error: 'MCP 설정은 enabled(ON/OFF)만 사용할 수 있습니다.' };
  }
  if ('usageMeasurement' in input && (!isRecord(input.usageMeasurement) || !hasOnlyKeys(input.usageMeasurement, ['localCountersEnabled']) || typeof input.usageMeasurement.localCountersEnabled !== 'boolean')) {
    return { ok: false, error: 'usageMeasurement 설정은 localCountersEnabled(ON/OFF)만 사용할 수 있습니다.' };
  }
  if ('voice' in input && (!isRecord(input.voice) || !hasOnlyKeys(input.voice, ['preset']) || (input.voice.preset !== undefined && !['default', 'plain', 'learning', 'jutell'].includes(String(input.voice.preset))))) {
    return { ok: false, error: 'voice 설정의 preset을 확인할 수 없습니다.' };
  }
  const profile = input.profile as Profile;
  const rawFeatures = input.features as Record<string, unknown>;
  const features = Object.fromEntries(
    FEATURE_IDS.map((id) => [id, typeof rawFeatures[id] === 'boolean' ? (rawFeatures[id] as boolean) : PROFILES[profile].features[id]]),
  ) as Record<FeatureId, boolean>;
  return {
    ok: true,
    value: {
      version: SUPPORTED_VERSION,
      profile,
      features,
      limits: { ...(input.limits as Limits) },
      mcp: ('mcp' in input ? { enabled: isRecord(input.mcp) ? input.mcp.enabled as boolean : false } : { ...DEFAULT_CONFIG.mcp }),
      usageMeasurement: ('usageMeasurement' in input ? { ...(input.usageMeasurement as Config['usageMeasurement']) } : { ...DEFAULT_CONFIG.usageMeasurement }),
      ...('voice' in input ? { voice: { preset: input.voice && isRecord(input.voice) && typeof input.voice.preset === 'string' ? input.voice.preset as 'default' | 'plain' | 'learning' | 'jutell' : 'default' } } : {}),
    },
  };
}

export function changedFields(before: Config, after: Config) {
  const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
  if (before.profile !== after.profile) changes.push({ field: 'profile', before: before.profile, after: after.profile });
  for (const id of FEATURE_IDS) {
    if (before.features[id] !== after.features[id]) {
      changes.push({ field: `features.${id}`, before: before.features[id], after: after.features[id] });
    }
  }
  for (const key of Object.keys(LIMIT_RANGES) as Array<keyof Limits>) {
    if (before.limits[key] !== after.limits[key]) {
      changes.push({ field: `limits.${key}`, before: before.limits[key], after: after.limits[key] });
    }
  }
  for (const key of ['enabled'] as Array<keyof McpSettings>) {
    if (before.mcp[key] !== after.mcp[key]) changes.push({ field: `mcp.${key}`, before: before.mcp[key], after: after.mcp[key] });
  }
  if (before.usageMeasurement.localCountersEnabled !== after.usageMeasurement.localCountersEnabled) {
    changes.push({ field: 'usageMeasurement.localCountersEnabled', before: before.usageMeasurement.localCountersEnabled, after: after.usageMeasurement.localCountersEnabled });
  }
  const beforeVoice = before.voice?.preset ?? 'default';
  const afterVoice = after.voice?.preset ?? 'default';
  if (beforeVoice !== afterVoice) {
    changes.push({ field: 'voice.preset', before: beforeVoice, after: afterVoice });
  }
  return changes;
}
