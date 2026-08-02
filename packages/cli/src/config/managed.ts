import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assets } from './paths.js';
import type { BridgeConfig, FileSnapshot, ScopePaths } from '../types.js';

export const BEGIN_MARKER = '# BEGINNER_BRIDGE_CLI_MCP_BEGIN';
export const END_MARKER = '# BEGINNER_BRIDGE_CLI_MCP_END';
const LEGACY_BEGIN_MARKER = '# BEGINNER_BRIDGE_MCP_BEGIN';
const LEGACY_END_MARKER = '# BEGINNER_BRIDGE_MCP_END';
export const FEATURE_IDS = ['changeSummary', 'userVisibleChanges', 'internalChanges', 'mainFiles', 'glossary', 'validationResults', 'riskAssessment', 'userActions'];
export const PROFILES = ['minimal', 'balanced', 'learning', 'detailed'] as const;

const fallbackConfig: BridgeConfig = {
  version: 1,
  profile: 'balanced',
  features: Object.fromEntries(FEATURE_IDS.map((id) => [id, true])),
  limits: { maxMainFiles: 5, maxGlossaryTerms: 3, compactReportMaxSentences: 12 },
  mcp: { enabled: false, autoStart: false },
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
  const features = Object.fromEntries(FEATURE_IDS.map((id) => [id, typeof inputFeatures[id] === 'boolean' ? inputFeatures[id] : true]));
  const inputLimits = input.limits && typeof input.limits === 'object' && !Array.isArray(input.limits) ? input.limits as Record<string, unknown> : {};
  const numberOr = (key: string, fallback: number) => typeof inputLimits[key] === 'number' && Number.isInteger(inputLimits[key]) ? inputLimits[key] as number : fallback;
  const inputMcp = input.mcp && typeof input.mcp === 'object' && !Array.isArray(input.mcp) ? input.mcp as Record<string, unknown> : {};
  const inputVoice = input.voice && typeof input.voice === 'object' && !Array.isArray(input.voice) ? input.voice as Record<string, unknown> : {};
  return {
    version: 1,
    profile,
    features,
    limits: { maxMainFiles: numberOr('maxMainFiles', 5), maxGlossaryTerms: numberOr('maxGlossaryTerms', 3), compactReportMaxSentences: numberOr('compactReportMaxSentences', 12) },
    mcp: { enabled: inputMcp.enabled === true, autoStart: inputMcp.autoStart === true },
    ...(typeof inputVoice.preset === 'string' ? { voice: { preset: inputVoice.preset as 'default' | 'plain' | 'learning' | 'jutell' } } : {}),
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

function managedPattern() {
  return new RegExp(`(?:${markerPair(BEGIN_MARKER, END_MARKER).source}|${markerPair(LEGACY_BEGIN_MARKER, LEGACY_END_MARKER).source})`, 'm');
}

function tomlString(value: string) {
  return JSON.stringify(value.replaceAll('\\', '/'));
}

export function buildMcpBlock(scope: ScopePaths, packageRoot: string, enabled: boolean) {
  const serverEntry = path.join(packageRoot, 'assets', 'mcp-server', 'index.js');
  const lines = [BEGIN_MARKER, '[mcp_servers.beginner_bridge]', `command = ${tomlString(process.execPath)}`, `args = [${tomlString(serverEntry)}]`];
  if (scope.scope === 'project') lines.push('cwd = "."');
  lines.push(`enabled = ${enabled ? 'true' : 'false'}`, 'required = false', 'default_tools_approval_mode = "prompt"', END_MARKER);
  return lines.join('\n');
}

export async function readCodexRegistration(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const content = await readText(paths.codexConfigFile) ?? '';
  const registered = managedPattern().test(content);
  const conflict = !registered && /^\s*\[mcp_servers\.beginner_bridge\]\s*$/m.test(content);
  return { content, exists: content.length > 0, registered, conflict, preview: buildMcpBlock(paths, packageRoot, enabled) };
}

export async function registerMcp(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const current = await readCodexRegistration(paths, packageRoot, enabled);
  if (current.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  await backupFile(paths.codexConfigFile);
  const withoutManaged = current.content.replace(managedPattern(), '').replace(/\n{3,}/g, '\n\n').trimEnd();
  const next = `${withoutManaged}${withoutManaged ? '\n\n' : ''}${current.preview}\n`;
  await writeTextSafely(paths.codexConfigFile, next);
  return readCodexRegistration(paths, packageRoot, enabled);
}

export async function removeMcp(paths: ScopePaths, packageRoot: string) {
  const current = await readCodexRegistration(paths, packageRoot, false);
  if (current.conflict) throw new Error('관리되지 않는 같은 이름의 MCP 항목은 자동으로 제거하지 않습니다.');
  if (!current.registered) return current;
  await backupFile(paths.codexConfigFile);
  const next = current.content.replace(managedPattern(), '').replace(/\n{3,}/g, '\n\n').trim();
  await writeTextSafely(paths.codexConfigFile, next ? `${next}\n` : '');
  return readCodexRegistration(paths, packageRoot, false);
}

export async function readVersionInfo() {
  const content = await readText(assets().version);
  if (!content) return { cli: '0.2.0', skill: '확인 필요', mcp: '0.1.0', admin: '0.1.0' };
  try { return JSON.parse(content) as { cli: string; skill: string; mcp: string; admin: string }; } catch { return { cli: '0.2.0', skill: '확인 필요', mcp: '0.1.0', admin: '0.1.0' }; }
}
