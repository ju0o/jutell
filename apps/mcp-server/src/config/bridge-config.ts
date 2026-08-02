import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Profile = 'minimal' | 'balanced' | 'learning' | 'detailed';
export type FeatureId = 'changeSummary' | 'userVisibleChanges' | 'internalChanges' | 'mainFiles' | 'glossary' | 'validationResults' | 'riskAssessment' | 'userActions';
export type Limits = { maxMainFiles: number; maxGlossaryTerms: number; compactReportMaxSentences: number };
export type BridgeConfig = { version: 1; profile: Profile; features: Record<FeatureId, boolean>; limits: Limits; mcp: { enabled: boolean; autoStart: boolean } };

export const FEATURE_IDS: FeatureId[] = ['changeSummary', 'userVisibleChanges', 'internalChanges', 'mainFiles', 'glossary', 'validationResults', 'riskAssessment', 'userActions'];
export const DEFAULT_CONFIG: BridgeConfig = {
  version: 1,
  profile: 'balanced',
  features: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true },
  limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  mcp: { enabled: false, autoStart: false },
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));

export function normalizeConfig(value: unknown): BridgeConfig {
  if (!isRecord(value) || value.version !== 1 || !['minimal', 'balanced', 'learning', 'detailed'].includes(String(value.profile))) return structuredClone(DEFAULT_CONFIG);
  if (!isRecord(value.features) || !hasOnlyKeys(value.features, FEATURE_IDS) || FEATURE_IDS.some((id) => typeof (value.features as Record<string, unknown>)[id] !== 'boolean')) return structuredClone(DEFAULT_CONFIG);
  if (!isRecord(value.limits) || !hasOnlyKeys(value.limits, ['maxMainFiles', 'maxGlossaryTerms', 'compactReportMaxSentences'])) return structuredClone(DEFAULT_CONFIG);
  const ranges = { maxMainFiles: [1, 10], maxGlossaryTerms: [0, 10], compactReportMaxSentences: [4, 30] } as const;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = value.limits[key];
    if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) return structuredClone(DEFAULT_CONFIG);
  }
  if ('mcp' in value && (!isRecord(value.mcp) || !hasOnlyKeys(value.mcp, ['enabled', 'autoStart']) || typeof value.mcp.enabled !== 'boolean' || typeof value.mcp.autoStart !== 'boolean')) return structuredClone(DEFAULT_CONFIG);
  return {
    version: 1,
    profile: value.profile as Profile,
    features: { ...(value.features as Record<FeatureId, boolean>) },
    limits: { ...(value.limits as Limits) },
    mcp: isRecord(value.mcp) ? { enabled: value.mcp.enabled as boolean, autoStart: value.mcp.autoStart as boolean } : { ...DEFAULT_CONFIG.mcp },
  };
}

async function readText(file: string) {
  try { return await fs.readFile(file, 'utf8'); } catch { return ''; }
}

export async function readBridgeContext(projectRoot = process.cwd()) {
  const configText = await readText(path.join(projectRoot, '.beginner-bridge.json'));
  let parsed: unknown;
  try { parsed = JSON.parse(configText); } catch { parsed = undefined; }
  const config = normalizeConfig(parsed);
  const skillText = await readText(path.join(projectRoot, '.agents', 'skills', 'beginner-bridge', 'SKILL.md'));
  const agentsExists = Boolean(await readText(path.join(projectRoot, 'AGENTS.md')));
  const configExists = Boolean(configText);
  const skillExists = Boolean(skillText);
  return { projectRoot, config, configExists, skillExists, agentsExists, skillText };
}
