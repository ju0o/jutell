import { parse } from 'smol-toml';
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
export const READ_ONLY_MCP_TOOLS = [
  'get_bridge_status',
  'get_active_features',
  'get_report_preferences',
  'get_beginner_report_rules',
  'get_safe_report_requirements',
] as const;

function tomlStringValue(value: string) {
  if (value.startsWith('"')) {
    try { return JSON.parse(value) as string; } catch { return undefined; }
  }
  return value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : undefined;
}

function readTomlString(content: string, table: string, field: string) {
  let currentTable = '';
  for (const line of content.split(/\r?\n/)) {
    const tableHeader = line.match(/^[ \t]*\[([^\[\]]+)\][ \t]*(?:#.*)?$/);
    if (tableHeader) {
      currentTable = tableHeader[1]!.trim();
      continue;
    }
    if (currentTable !== table) continue;
    const key = line.match(/^[ \t]*([A-Za-z0-9_-]+)[ \t]*=/);
    if (key?.[1] !== field) continue;
    const value = line.slice(line.indexOf('=') + 1).trim();
    const stringValue = value.match(/^("(?:\\.|[^"\\])*"|'[^']*')[ \t]*(?:#.*)?$/)?.[1];
    return stringValue ? tomlStringValue(stringValue) ?? null : null;
  }
  return undefined;
}

function codexApprovalState(content: string) {
  const defaultMode = readTomlString(content, `mcp_servers.${CANONICAL_MCP_KEY}`, 'default_tools_approval_mode');
  const effectiveModes = READ_ONLY_MCP_TOOLS.map((tool) => {
    const perToolMode = readTomlString(content, `mcp_servers.${CANONICAL_MCP_KEY}.tools.${tool}`, 'approval_mode');
    return perToolMode === undefined ? defaultMode : perToolMode;
  });
  return {
    approvalConflict: effectiveModes.some((mode) => mode !== 'approve'),
    approvalPolicyNever: readTomlString(content, '', 'approval_policy') === 'never',
  };
}

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

const LIMITS_KEYS = ['maxMainFiles', 'maxGlossaryTerms', 'compactReportMaxSentences'] as const;

// normalizeConfig() silently substitutes the schema default for any limits field that
// isn't a valid integer - correct for making the CLI keep working, but it never signals
// that the substitution happened, so a user's own (invalid) edit is silently overridden
// with no way to notice. Computed separately here (readBridgeConfig has the raw parsed
// object; normalizeConfig only returns the already-normalized result) so status/doctor
// can warn about it without changing normalizeConfig's own return shape or call sites.
function invalidLimitsFields(parsed: Record<string, unknown>): string[] {
  if (!('limits' in parsed)) return []; // never set - nothing of the user's is being overridden
  const limits = parsed.limits;
  // `limits` present but not a plain object (a string, array, number, boolean, or null)
  // is the same silent-override problem one level up: normalizeConfig()'s own
  // `input.limits && typeof === 'object' && !Array.isArray` guard treats any of these
  // as if `limits` were `{}` and defaults every field - so report all three as invalid
  // rather than picking apart a shape that was never a fields-object to begin with.
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return [...LIMITS_KEYS];
  const record = limits as Record<string, unknown>;
  return LIMITS_KEYS.filter((key) => key in record && !(typeof record[key] === 'number' && Number.isInteger(record[key])));
}

export async function readBridgeConfig(paths: ScopePaths) {
  const preferred = await readText(paths.configFile);
  const raw = preferred ?? await readText(paths.legacyConfigFile);
  const source = preferred !== undefined ? 'new' as const : raw !== undefined ? 'legacy' as const : 'default' as const;
  if (!raw) return { config: await defaultConfig(), exists: false, valid: true, source, invalidLimitsFields: [] as string[] };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const valid = parsed.version === 1 && typeof parsed.profile === 'string' && PROFILES.includes(parsed.profile as typeof PROFILES[number]);
    return { config: normalizeConfig(parsed), exists: true, valid, source, invalidLimitsFields: invalidLimitsFields(parsed) };
  } catch {
    return { config: await defaultConfig(), exists: true, valid: false, source, invalidLimitsFields: [] as string[] };
  }
}

export async function writeBridgeConfig(paths: ScopePaths, config: BridgeConfig) {
  await writeTextSafely(paths.configFile, `${JSON.stringify(config, null, 2)}\n`);
}

function markerPair(begin: string, end: string) {
  return new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm');
}

function managedPatterns() {
  return [
    markerPair(BEGIN_MARKER, END_MARKER),
    markerPair(PREVIOUS_BEGIN_MARKER, PREVIOUS_END_MARKER),
    markerPair(LEGACY_BEGIN_MARKER, LEGACY_END_MARKER),
  ];
}

function managedBlocks(content: string) {
  return managedPatterns().flatMap((pattern) => content.match(pattern) ?? []);
}

function nonJuTellTables(block: string) {
  const bodyStart = block.indexOf('\n') + 1;
  const endMarkerStart = Math.max(
    ...[END_MARKER, PREVIOUS_END_MARKER, LEGACY_END_MARKER].map((marker) => block.lastIndexOf(marker)),
  );
  if (bodyStart <= 0 || endMarkerStart < bodyStart) return [];
  const body = block.slice(bodyStart, endMarkerStart);
  const headers = [...body.matchAll(/^[ \t]*(\[\[[^\r\n]*?\]\]|\[[^\r\n]*?\])[ \t]*(?:#.*)?\r?$/gm)];
  return headers.flatMap((header, index) => {
    const tableHeader = header[1];
    if (!tableHeader || tableHeader.startsWith('[[')) return [body.slice(header.index!, headers[index + 1]?.index ?? body.length)];
    const keyPath = tableHeader.slice(1, -1).trim();
    if (
      keyPath === 'mcp_servers.beginner_bridge' ||
      keyPath.startsWith('mcp_servers.beginner_bridge.')
    ) return [];
    if (
      ['mcp_servers.jutell', 'mcp_servers.beginner_bridge'].some(
        (ownedKey) => keyPath === ownedKey || keyPath.startsWith(`${ownedKey}.`),
      )
    ) return [];
    return [body.slice(header.index!, headers[index + 1]?.index ?? body.length)];
  });
}

function blockRemoval(content: string, pattern: RegExp, preserveTables: boolean, preservedTables: string[]) {
  return content.replace(pattern, (block) => {
    if (!preserveTables) return '';
    return nonJuTellTables(block).map((table) => {
      const index = preservedTables.push(table) - 1;
      return `\u0000JUTELL_PRESERVED_TABLE_${index}\u0000`;
    }).join('');
  });
}

function withoutManagedBlocks(content: string, includeCanonical = true) {
  const preservedTables: string[] = [];
  const patterns = managedPatterns();
  // All managed marker blocks can contain user-added TOML tables.
  const selectedPatterns = includeCanonical ? patterns : patterns.slice(1);
  const withoutBlocks = selectedPatterns.reduce(
    (text, pattern) => blockRemoval(text, pattern, true, preservedTables),
    content,
  );
  return { content: withoutBlocks, preservedTables };
}

export function removeManagedBlocksPreserving(content: string, includeCanonical = true) {
  const { content: withoutBlocks, preservedTables } = withoutManagedBlocks(content, includeCanonical);
  return withoutBlocks.replace(/\u0000JUTELL_PRESERVED_TABLE_(\d+)\u0000/g, (_placeholder, index: string) => {
    return preservedTables[Number(index)] ?? '';
  });
}

function withoutCanonicalBlock(content: string) {
  const preservedTables: string[] = [];
  return {
    content: blockRemoval(content, markerPair(BEGIN_MARKER, END_MARKER), true, preservedTables),
    preservedTables,
  };
}

function restorePreservedTables(content: string, preservedTables: string[]) {
  return content.replace(/\u0000JUTELL_PRESERVED_TABLE_(\d+)\u0000/g, (_token, index: string) => preservedTables[Number(index)] ?? '');
}

function hasNonJuTellTablesInCanonicalBlock(content: string) {
  const blocks = content.match(markerPair(BEGIN_MARKER, END_MARKER)) ?? [];
  return blocks.some((block) => nonJuTellTables(block).length > 0);
}

function hasMcpKey(content: string, key: string) {
  return new RegExp(`^\\s*\\[mcp_servers\\.${key}\\]\\s*$`, 'm').test(content);
}

function keySlice(content: string, key: string) {
  const keyPattern = new RegExp(`^\\s*\\[mcp_servers\\.${key}\\]\\s*$`, 'm');
  const match = content.match(keyPattern);
  if (!match || match.index === undefined) return undefined;
  return content.slice(match.index, match.index + 1200);
}

function hasJuTellMcpEvidence(content: string, key: string) {
  const slice = keySlice(content, key);
  if (!slice) return false;
  // JuTell's server always contains `assets/mcp-server` or `apps/mcp-server` in args (see buildMcpBlock)
  // Unrelated custom entries (e.g. jira, other, even a custom `jutell` pointing to `not-mcp-server.js`) do not –
  // this prevents broadly adopting arbitrary unmarked MCP entries.
  return /(?:assets|apps)[\\/]mcp-server/i.test(slice);
}

function extractField(block: string | undefined, field: 'command' | 'args') {
  if (!block) return undefined;
  const match = block.match(new RegExp(`^\\s*${field}\\s*=\\s*(.+?)\\s*$`, 'm'));
  return match?.[1];
}

function hasCanonicalApprovalConfig(block: string | undefined) {
  if (!block) return false;
  const tables = [...block.matchAll(/^[ \t]*\[([^\[\]\r\n]+)\][ \t]*(?:#.*)?\r?$/gm)];
  const canonicalHeaders = tables
    .map((table) => table[1])
    .filter((header): header is string => header === `mcp_servers.${CANONICAL_MCP_KEY}` || header.startsWith(`mcp_servers.${CANONICAL_MCP_KEY}.`));
  const expectedHeaders = [
    `mcp_servers.${CANONICAL_MCP_KEY}`,
    ...READ_ONLY_MCP_TOOLS.map((tool) => `mcp_servers.${CANONICAL_MCP_KEY}.tools.${tool}`),
  ];
  if (JSON.stringify(canonicalHeaders) !== JSON.stringify(expectedHeaders)) return false;

  const tableBody = (header: RegExpMatchArray) => {
    const nextTable = tables.find((table) => table.index! > header.index!);
    return block.slice(header.index! + header[0].length, nextTable?.index ?? block.length);
  };
  const hasSingleField = (body: string, field: string, value: string) => {
    const matches = [...body.matchAll(new RegExp(`^[ \\t]*${field}\\s*=\\s*(.+?)[ \\t]*$`, 'gm'))];
    return matches.length === 1 && matches[0]?.[1] === value;
  };

  const serverTable = tables.find((table) => table[1] === `mcp_servers.${CANONICAL_MCP_KEY}`);
  if (!serverTable || !hasSingleField(tableBody(serverTable), 'default_tools_approval_mode', '"prompt"')) return false;
  return READ_ONLY_MCP_TOOLS.every((tool) => {
    const toolTable = tables.find((table) => table[1] === `mcp_servers.${CANONICAL_MCP_KEY}.tools.${tool}`);
    return Boolean(toolTable && hasSingleField(tableBody(toolTable), 'approval_mode', '"approve"'));
  });
}

// Removes a bare (unmarked) `[mcp_servers.<key>]` table — header line through its own
// key/value lines, up to the next table header or end of file. Used when repairing a stale
// heuristic-recognized entry that predates JUTELL_CLI_MCP markers, so a rewrite replaces it
// instead of leaving a duplicate `[mcp_servers.<key>]` table behind.
function withoutKeySection(content: string, key: string) {
  const keyPath = `mcp_servers.${key}`;
  const headers = [...content.matchAll(/^[ \t]*(\[\[[^\r\n]*?\]\]|\[[^\r\n]*?\])[ \t]*(?:#.*)?\r?$/gm)];
  if (headers.length === 0) return content;
  let result = '';
  let cursor = 0;
  headers.forEach((header, index) => {
    const start = header.index!;
    const end = headers[index + 1]?.index ?? content.length;
    const tableHeader = header[1];
    const tablePath = tableHeader?.startsWith('[[') ? undefined : tableHeader?.slice(1, -1).trim();
    result += content.slice(cursor, start);
    if (tablePath !== keyPath && !tablePath?.startsWith(`${keyPath}.`)) {
      result += content.slice(start, end);
    }
    cursor = end;
  });
  return result + content.slice(cursor);
}

function tomlString(value: string) {
  return JSON.stringify(value.replaceAll('\\', '/'));
}

export function buildMcpBlock(scope: ScopePaths, packageRoot: string, enabled: boolean) {
  const serverEntry = path.join(packageRoot, 'assets', 'mcp-server', 'index.js');
  const lines = [BEGIN_MARKER, `[mcp_servers.${CANONICAL_MCP_KEY}]`, `command = ${tomlString(process.execPath)}`, `args = [${tomlString(serverEntry)}]`];
  if (scope.scope === 'project') lines.push('cwd = "."');
  lines.push(`enabled = ${enabled ? 'true' : 'false'}`, 'required = false', 'default_tools_approval_mode = "prompt"');
  for (const tool of READ_ONLY_MCP_TOOLS) {
    lines.push('', `[mcp_servers.${CANONICAL_MCP_KEY}.tools.${tool}]`, 'approval_mode = "approve"');
  }
  lines.push(END_MARKER);
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
  const canonicalJuTellRegistered = Boolean(canonicalManaged || canonicalHeuristic);
  const approvalState = codexApprovalState(content);
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
  const preview = buildMcpBlock(paths, packageRoot, enabled);
  // The command/args a currently-recognized JuTell entry (managed-block or heuristic-evidence)
  // actually has, vs. what the current installation would write today. A mismatch means the
  // entry is stale — e.g. left over from a different machine/OS or an older JuTell install —
  // and should be repaired even though the key is already registered and `enabled` already matches.
  const canonicalEntryText = canonicalManaged ?? (canonicalHeuristic ? keySlice(content, CANONICAL_MCP_KEY) : undefined);
  const canonicalUpToDate = Boolean(
    canonicalEntryText
    && extractField(canonicalEntryText, 'command') === extractField(preview, 'command')
    && extractField(canonicalEntryText, 'args') === extractField(preview, 'args')
    && hasCanonicalApprovalConfig(canonicalEntryText),
  );
  return {
    content,
    exists: content.length > 0,
    registered,
    conflict,
    enabled: enabledFlag,
    canonicalRegistered,
    canonicalJuTellRegistered,
    legacyRegistered,
    approvalConflict: canonicalJuTellRegistered && approvalState.approvalConflict,
    approvalPolicyNever: approvalState.approvalPolicyNever,
    bothRegistered: canonicalRegistered && legacyRegistered,
    canonicalUpToDate,
    preview,
  };
}

function assertValidConfigToml(content: string) {
  try {
    parse(content);
  } catch {
    throw new Error('Codex 설정을 변경하면 유효하지 않은 TOML이 되어 파일을 변경하지 않았습니다.');
  }
}

export async function registerMcp(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const current = await readCodexRegistration(paths, packageRoot, enabled);
  if (current.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  const hasEmbeddedUserTables = hasNonJuTellTablesInCanonicalBlock(current.content);
  if (current.canonicalRegistered && current.enabled === enabled && current.canonicalUpToDate && !hasEmbeddedUserTables) return current;
  // withoutCanonicalBlock removes the marker-wrapped block and moves its user tables
  // outside the block. A stale entry recognized by heuristic evidence alone (no markers,
  // e.g. from an older JuTell install) would otherwise survive as a leftover bare
  // `[mcp_servers.jutell]` table alongside the freshly-appended one.
  // Safe to strip unconditionally here: reaching this point already ruled out (via `conflict`
  // above) any bare `[mcp_servers.jutell]` that isn't JuTell's own.
  const removed = withoutCanonicalBlock(current.content);
  const withoutManaged = withoutKeySection(removed.content, CANONICAL_MCP_KEY).replace(/\n{3,}/g, '\n\n').trimEnd();
  const next = restorePreservedTables(`${withoutManaged}${withoutManaged ? '\n\n' : ''}${current.preview}\n`, removed.preservedTables);
  assertValidConfigToml(next);
  await backupFile(paths.codexConfigFile);
  await writeTextSafely(paths.codexConfigFile, next);
  return readCodexRegistration(paths, packageRoot, enabled);
}

export async function removeMcp(paths: ScopePaths, packageRoot: string) {
  const current = await readCodexRegistration(paths, packageRoot, false);
  if (current.conflict) throw new Error('관리되지 않는 같은 이름의 MCP 항목은 자동으로 제거하지 않습니다.');
  if (!current.registered) return current;
  const removed = withoutManagedBlocks(current.content);
  const normalized = removed.content.replace(/\n{3,}/g, '\n\n').trim();
  const next = restorePreservedTables(normalized, removed.preservedTables);
  const finalText = next ? (next.endsWith('\n') ? next : `${next}\n`) : '';
  assertValidConfigToml(finalText);
  await backupFile(paths.codexConfigFile);
  await writeTextSafely(paths.codexConfigFile, finalText);
  return readCodexRegistration(paths, packageRoot, false);
}

export async function readVersionInfo() {
  const content = await readText(assets().version);
  const fallback = { cli: '2.0.1', skill: '확인 필요', mcp: '0.1.0', admin: '0.1.0' };
  if (!content) return fallback;
  try { return JSON.parse(content) as { cli: string; skill: string; mcp: string; admin: string }; } catch { return fallback; }
}

export function parseSkillVersion(skillText: string | undefined) {
  if (!skillText) return undefined;
  const match = skillText.match(/jutellSkillVersion\s*:\s*["']?([0-9A-Za-z.\-]+)/);
  return match ? match[1] : undefined;
}
