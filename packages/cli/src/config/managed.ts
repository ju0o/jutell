import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assets } from './paths.js';
import type { BridgeConfig, FileSnapshot, ScopePaths } from '../types.js';

export const BEGIN_MARKER = '# JUTELL_CLI_MCP_BEGIN';
export const END_MARKER = '# JUTELL_CLI_MCP_END';
const PREVIOUS_BEGIN_MARKER = '# BEGINNER_BRIDGE_CLI_MCP_BEGIN';
const PREVIOUS_END_MARKER = '# BEGINNER_BRIDGE_CLI_MCP_END';
const LEGACY_BEGIN_MARKER = '# BEGINNER_BRIDGE_MCP_BEGIN';
const LEGACY_END_MARKER = '# BEGINNER_BRIDGE_MCP_END';
const CANONICAL_MCP_KEY = 'jutell';
const LEGACY_MCP_KEY = 'beginner_bridge';
export const FEATURE_IDS = ['changeSummary', 'userVisibleChanges', 'internalChanges', 'mainFiles', 'explainedDiff', 'glossary', 'validationResults', 'riskAssessment', 'userActions', 'nextActionSuggestions', 'requestClarificationGuide', 'manualEditGuidance', 'requestBuilder'];
export const PROFILES = ['minimal', 'balanced', 'learning', 'detailed'] as const;
export const PROFILE_FEATURES: Record<(typeof PROFILES)[number], Record<string, boolean>> = {
  minimal: { changeSummary: true, userVisibleChanges: true, internalChanges: false, mainFiles: false, explainedDiff: false, glossary: false, validationResults: true, riskAssessment: false, userActions: true, nextActionSuggestions: false, requestClarificationGuide: false, manualEditGuidance: false, requestBuilder: true },
  balanced: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, explainedDiff: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true, nextActionSuggestions: true, requestClarificationGuide: true, manualEditGuidance: true, requestBuilder: true },
  learning: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, explainedDiff: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true, nextActionSuggestions: true, requestClarificationGuide: true, manualEditGuidance: true, requestBuilder: true },
  detailed: { changeSummary: true, userVisibleChanges: true, internalChanges: true, mainFiles: true, explainedDiff: true, glossary: true, validationResults: true, riskAssessment: true, userActions: true, nextActionSuggestions: true, requestClarificationGuide: true, manualEditGuidance: true, requestBuilder: true },
};

const fallbackConfig: BridgeConfig = {
  version: 1,
  profile: 'balanced',
  features: { ...PROFILE_FEATURES.balanced },
  limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  mcp: { enabled: false },
  usageMeasurement: { localCountersEnabled: false },
  voice: { preset: 'default' },
};

export async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}

export async function readText(file: string) {
  try { return await fs.readFile(file, 'utf8'); } catch { return undefined; }
}

export async function snapshot(file: string): Promise<FileSnapshot> {
  const content = await readText(file);
  return content === undefined ? { file, existed: false } : { file, existed: true, content };
}

export async function restore(snapshotValue: FileSnapshot) {
  if (snapshotValue.existed) {
    await fs.mkdir(path.dirname(snapshotValue.file), { recursive: true });
    await fs.writeFile(snapshotValue.file, snapshotValue.content ?? '', 'utf8');
  } else {
    await fs.rm(snapshotValue.file, { force: true });
  }
}

export async function writeTextSafely(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.beginner-bridge-tmp-${process.pid}`;
  await fs.writeFile(temporary, content, 'utf8');
  try { await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

export async function backupFile(file: string) {
  if (await exists(file)) await fs.copyFile(file, `${file}.previous`);
}

async function defaultConfig(): Promise<BridgeConfig> {
  const content = await readText(assets().defaultConfig);
  if (!content) return structuredClone(fallbackConfig);
  try { return normalizeConfig(JSON.parse(content)); } catch { return structuredClone(fallbackConfig); }
}

export function normalizeConfig(value: unknown): BridgeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return structuredClone(fallbackConfig);
  const input = value as Record<string, unknown>;
  const profile = typeof input.profile === 'string' && PROFILES.includes(input.profile as typeof PROFILES[number]) ? input.profile as BridgeConfig['profile'] : 'balanced';
  const inputFeatures = input.features && typeof input.features === 'object' && !Array.isArray(input.features) ? input.features as Record<string, unknown> : {};
  const features = Object.fromEntries(FEATURE_IDS.map((id) => [id, typeof inputFeatures[id] === 'boolean' ? inputFeatures[id] : PROFILE_FEATURES[profile][id]]));
  const inputLimits = input.limits && typeof input.limits === 'object' && !Array.isArray(input.limits) ? input.limits as Record<string, unknown> : {};
  const numberOr = (key: string, fallback: number) => typeof inputLimits[key] === 'number' && Number.isInteger(inputLimits[key]) ? inputLimits[key] as number : fallback;
  const inputMcp = input.mcp && typeof input.mcp === 'object' && !Array.isArray(input.mcp) ? input.mcp as Record<string, unknown> : {};
  const inputUsageMeasurement = input.usageMeasurement && typeof input.usageMeasurement === 'object' && !Array.isArray(input.usageMeasurement) ? input.usageMeasurement as Record<string, unknown> : {};
  const inputVoice = input.voice && typeof input.voice === 'object' && !Array.isArray(input.voice) ? input.voice as Record<string, unknown> : {};
  const voicePresets = ['default', 'plain', 'learning', 'jutell'] as const;
  const voicePreset = typeof inputVoice.preset === 'string' && voicePresets.includes(inputVoice.preset as typeof voicePresets[number])
    ? (inputVoice.preset as typeof voicePresets[number])
    : 'default';
  return {
    version: 1,
    profile,
    features,
    limits: { maxMainFiles: numberOr('maxMainFiles', 5), maxGlossaryTerms: numberOr('maxGlossaryTerms', 3), compactReportMaxSentences: numberOr('compactReportMaxSentences', 12) },
    mcp: { enabled: inputMcp.enabled === true },
    usageMeasurement: { localCountersEnabled: inputUsageMeasurement.localCountersEnabled === true },
    voice: { preset: voicePreset },
  };
}

export async function readBridgeConfig(paths: ScopePaths) {
  const preferred = await readText(paths.configFile);
  const raw = preferred ?? await readText(paths.legacyConfigFile);
  const source = preferred !== undefined ? 'new' as const : raw !== undefined ? 'legacy' as const : 'default' as const;
  if (!raw) return { config: await defaultConfig(), exists: false, valid: true, source };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const valid = parsed.version === 1 && typeof parsed.profile === 'string' && PROFILES.includes(parsed.profile as typeof PROFILES[number]);
    return { config: normalizeConfig(parsed), exists: true, valid, source };
  } catch {
    return { config: await defaultConfig(), exists: true, valid: false, source };
  }
}

export async function writeBridgeConfig(paths: ScopePaths, config: BridgeConfig) {
  await writeTextSafely(paths.configFile, `${JSON.stringify(config, null, 2)}\n`);
}

function markerPair(begin: string, end: string) {
  return new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
}

function managedPatterns() {
  return [
    markerPair(BEGIN_MARKER, END_MARKER),
    markerPair(PREVIOUS_BEGIN_MARKER, PREVIOUS_END_MARKER),
    markerPair(LEGACY_BEGIN_MARKER, LEGACY_END_MARKER),
  ];
}

function managedBlocks(content: string) {
  return managedPatterns().flatMap((pattern) => content.match(pattern)?.[0] ?? []);
}

function withoutManagedBlocks(content: string) {
  return managedPatterns().reduce((text, pattern) => text.replace(pattern, ''), content);
}

function withoutCanonicalBlock(content: string) {
  return content.replace(markerPair(BEGIN_MARKER, END_MARKER), '');
}

function hasMcpKey(content: string, key: string) {
  return new RegExp(`^\\s*\\[mcp_servers\\.${key}\\]\\s*$`, 'm').test(content);
}

function hasJuTellMcpEvidence(content: string, key: string) {
  const keyPattern = new RegExp(`^\\s*\\[mcp_servers\\.${key}\\]\\s*$`, 'm');
  const match = content.match(keyPattern);
  if (!match || match.index === undefined) return false;
  const slice = content.slice(match.index, match.index + 1200);
  // JuTell's server always contains `assets/mcp-server` or `apps/mcp-server` in args (see buildMcpBlock)
  // Unrelated custom entries (e.g. jira, other, even a custom `jutell` pointing to `not-mcp-server.js`) do not –
  // this prevents broadly adopting arbitrary unmarked MCP entries.
  return /(?:assets|apps)[\\/]mcp-server/i.test(slice);
}

function tomlString(value: string) {
  return JSON.stringify(value.replaceAll('\\', '/'));
}

export function buildMcpBlock(scope: ScopePaths, packageRoot: string, enabled: boolean) {
  const serverEntry = path.join(packageRoot, 'assets', 'mcp-server', 'index.js');
  const lines = [BEGIN_MARKER, `[mcp_servers.${CANONICAL_MCP_KEY}]`, `command = ${tomlString(process.execPath)}`, `args = [${tomlString(serverEntry)}]`];
  if (scope.scope === 'project') lines.push('cwd = "."');
  lines.push(`enabled = ${enabled ? 'true' : 'false'}`, 'required = false', 'default_tools_approval_mode = "prompt"', END_MARKER);
  return lines.join('\n');
}

export async function readCodexRegistration(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const content = await readText(paths.codexConfigFile) ?? '';
  const blocks = managedBlocks(content);
  const canonicalManaged = blocks.find((block) => hasMcpKey(block, CANONICAL_MCP_KEY));
  const legacyManaged = blocks.find((block) => hasMcpKey(block, LEGACY_MCP_KEY));
  const canonicalRegistered = hasMcpKey(content, CANONICAL_MCP_KEY);
  const legacyRegistered = hasMcpKey(content, LEGACY_MCP_KEY);
  const canonicalHeuristic = !canonicalManaged && canonicalRegistered && hasJuTellMcpEvidence(content, CANONICAL_MCP_KEY);
  const legacyHeuristic = !legacyManaged && legacyRegistered && hasJuTellMcpEvidence(content, LEGACY_MCP_KEY);
  const registered = Boolean(canonicalManaged || legacyManaged || canonicalHeuristic || legacyHeuristic);
  const conflict = !registered && (canonicalRegistered || legacyRegistered);
  const enabledFlag = (() => {
    if (canonicalManaged) return /^\s*enabled\s*=\s*true\s*$/m.test(canonicalManaged);
    if (canonicalHeuristic) {
      const keyPattern = new RegExp(`^\\s*\\[mcp_servers\\.${CANONICAL_MCP_KEY}\\]\\s*$`, 'm');
      const m = content.match(keyPattern);
      if (m && m.index !== undefined) {
        const slice = content.slice(m.index, m.index + 1200);
        return /^\s*enabled\s*=\s*true\s*$/m.test(slice);
      }
    }
    if (legacyManaged) return false;
    if (legacyHeuristic) {
      const keyPattern = new RegExp(`^\\s*\\[mcp_servers\\.${LEGACY_MCP_KEY}\\]\\s*$`, 'm');
      const m = content.match(keyPattern);
      if (m && m.index !== undefined) {
        const slice = content.slice(m.index, m.index + 1200);
        // legacy-only state is treated as registered but not enabled for canonical;
        // status warning will guide to `jutell use codex` to add canonical.
        return false;
      }
    }
    return false;
  })();
  return {
    content,
    exists: content.length > 0,
    registered,
    conflict,
    enabled: enabledFlag,
    canonicalRegistered,
    legacyRegistered,
    bothRegistered: canonicalRegistered && legacyRegistered,
    preview: buildMcpBlock(paths, packageRoot, enabled),
  };
}

export async function registerMcp(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const current = await readCodexRegistration(paths, packageRoot, enabled);
  if (current.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  if (current.canonicalRegistered && current.enabled === enabled) return current;
  await backupFile(paths.codexConfigFile);
  const withoutManaged = withoutCanonicalBlock(current.content).replace(/\n{3,}/g, '\n\n').trimEnd();
  const next = `${withoutManaged}${withoutManaged ? '\n\n' : ''}${current.preview}\n`;
  await writeTextSafely(paths.codexConfigFile, next);
  return readCodexRegistration(paths, packageRoot, enabled);
}

export async function removeMcp(paths: ScopePaths, packageRoot: string) {
  const current = await readCodexRegistration(paths, packageRoot, false);
  if (current.conflict) throw new Error('관리되지 않는 같은 이름의 MCP 항목은 자동으로 제거하지 않습니다.');
  if (!current.registered) return current;
  await backupFile(paths.codexConfigFile);
  const next = withoutManagedBlocks(current.content).replace(/\n{3,}/g, '\n\n').trim();
  await writeTextSafely(paths.codexConfigFile, next ? `${next}\n` : '');
  return readCodexRegistration(paths, packageRoot, false);
}

export async function readVersionInfo() {
  const content = await readText(assets().version);
  const fallback = { cli: '0.2.1', skill: '확인 필요', mcp: '0.1.0', admin: '0.1.0' };
  if (!content) return fallback;
  try { return JSON.parse(content) as { cli: string; skill: string; mcp: string; admin: string }; } catch { return fallback; }
}

export function parseSkillVersion(skillText: string | undefined) {
  if (!skillText) return undefined;
  const match = skillText.match(/jutellSkillVersion\s*:\s*["']?([0-9A-Za-z.\-]+)/);
  return match ? match[1] : undefined;
}
