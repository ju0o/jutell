import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Profile = 'minimal' | 'balanced' | 'learning' | 'detailed';
export type FeatureId = 'changeSummary' | 'userVisibleChanges' | 'internalChanges' | 'mainFiles' | 'explainedDiff' | 'glossary' | 'validationResults' | 'riskAssessment' | 'userActions' | 'nextActionSuggestions' | 'requestClarificationGuide' | 'manualEditGuidance' | 'requestBuilder';
export type Limits = { maxMainFiles: number; maxGlossaryTerms: number; compactReportMaxSentences: number };
export type BridgeConfig = { version: 1; profile: Profile; features: Record<FeatureId, boolean>; limits: Limits; mcp: { enabled: boolean }; usageMeasurement: { localCountersEnabled: boolean } };

export const FEATURE_IDS: FeatureId[] = ['changeSummary', 'userVisibleChanges', 'internalChanges', 'mainFiles', 'explainedDiff', 'glossary', 'validationResults', 'riskAssessment', 'userActions', 'nextActionSuggestions', 'requestClarificationGuide', 'manualEditGuidance', 'requestBuilder'];
export const PROFILE_FEATURES: Record<Profile, Record<FeatureId, boolean>> = {
  minimal: { changeSummary: true, userVisibleChanges: true, internalChanges: false, mainFiles: false, explainedDiff: false, glossary: false, validationResults: true, riskAssessment: false, userActions: true, nextActionSuggestions: false, requestClarificationGuide: false, manualEditGuidance: false, requestBuilder: true },
  balanced: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, explainedDiff: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true, nextActionSuggestions: true, requestClarificationGuide: true, manualEditGuidance: true, requestBuilder: true },
  learning: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, explainedDiff: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true, nextActionSuggestions: true, requestClarificationGuide: true, manualEditGuidance: true, requestBuilder: true },
  detailed: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, explainedDiff: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true, nextActionSuggestions: true, requestClarificationGuide: true, manualEditGuidance: true, requestBuilder: true },
};
export const DEFAULT_CONFIG: BridgeConfig = {
  version: 1,
  profile: 'balanced',
  features: { ...PROFILE_FEATURES.balanced },
  limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  mcp: { enabled: false },
  usageMeasurement: { localCountersEnabled: false },
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));

export function normalizeConfig(value: unknown): BridgeConfig {
  if (!isRecord(value) || value.version !== 1 || !['minimal', 'balanced', 'learning', 'detailed'].includes(String(value.profile))) return structuredClone(DEFAULT_CONFIG);
  const featuresInput = isRecord(value.features) ? value.features : {};
  if (!hasOnlyKeys(featuresInput, FEATURE_IDS) || FEATURE_IDS.some((id) => featuresInput[id] !== undefined && typeof featuresInput[id] !== 'boolean')) return structuredClone(DEFAULT_CONFIG);
  if (!isRecord(value.limits) || !hasOnlyKeys(value.limits, ['maxMainFiles', 'maxGlossaryTerms', 'compactReportMaxSentences'])) return structuredClone(DEFAULT_CONFIG);
  const ranges = { maxMainFiles: [1, 10], maxGlossaryTerms: [0, 10], compactReportMaxSentences: [4, 30] } as const;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = value.limits[key];
    if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) return structuredClone(DEFAULT_CONFIG);
  }
  if ('mcp' in value && (!isRecord(value.mcp) || typeof value.mcp.enabled !== 'boolean')) return structuredClone(DEFAULT_CONFIG);
  if ('usageMeasurement' in value && (!isRecord(value.usageMeasurement) || !hasOnlyKeys(value.usageMeasurement, ['localCountersEnabled']) || typeof value.usageMeasurement.localCountersEnabled !== 'boolean')) return structuredClone(DEFAULT_CONFIG);
  const features = Object.fromEntries(
    FEATURE_IDS.map((id) => [id, typeof featuresInput[id] === 'boolean' ? (featuresInput[id] as boolean) : PROFILE_FEATURES[value.profile as Profile][id]]),
  ) as Record<FeatureId, boolean>;
  return {
    version: 1,
    profile: value.profile as Profile,
    features,
    limits: { ...(value.limits as Limits) },
    mcp: isRecord(value.mcp) ? { enabled: value.mcp.enabled as boolean } : { ...DEFAULT_CONFIG.mcp },
    usageMeasurement: isRecord(value.usageMeasurement) ? { localCountersEnabled: value.usageMeasurement.localCountersEnabled as boolean } : { ...DEFAULT_CONFIG.usageMeasurement },
  };
}

async function readText(file: string) {
  try { return await fs.readFile(file, 'utf8'); } catch { return ''; }
}

export async function readBridgeContext(projectRoot = process.cwd()) {
  const preferredConfig = await readText(path.join(projectRoot, '.jutell.json'));
  const configText = preferredConfig || await readText(path.join(projectRoot, '.beginner-bridge.json'));
  let parsed: unknown;
  try { parsed = JSON.parse(configText); } catch { parsed = undefined; }
  const config = normalizeConfig(parsed);
  const skillText = await readText(path.join(projectRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'));
  const agentsExists = Boolean(await readText(path.join(projectRoot, 'AGENTS.md')));
  const configExists = Boolean(configText);
  const skillExists = Boolean(skillText);
  return { projectRoot, config, configExists, skillExists, agentsExists, skillText };
}
