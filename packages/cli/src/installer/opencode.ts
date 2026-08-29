import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { backupFile, exists, readText, writeTextSafely } from '../config/managed.js';
import type { ScopePaths } from '../types.js';

export const OPENCODE_BEGIN_MARKER = 'BEGIN JUTELL MANAGED BLOCK';
export const OPENCODE_END_MARKER = 'END JUTELL MANAGED BLOCK';
export const OPENCODE_MCP_KEY = 'jutell';
export const LEGACY_OPENCODE_MCP_KEY = 'beginner_bridge';

export type OpenCodeRegistration = {
  file: string;
  exists: boolean;
  registered: boolean;
  conflict: boolean;
  enabled: boolean;
  canonicalRegistered: boolean;
  legacyRegistered: boolean;
  bothRegistered: boolean;
  preview: string;
};

function stripJsoncComments(text: string) {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; out += '  '; i += 1; }
      else out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (inLine) {
      if (c === '\n') { inLine = false; out += '\n'; }
      else out += ' ';
      continue;
    }
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { inLine = true; out += '  '; i += 1; continue; }
    if (c === '/' && next === '*') { inBlock = true; out += '  '; i += 1; continue; }
    out += c;
  }
  return out;
}

function tryParseJson(text: string): Record<string, unknown> | undefined {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return {};
  try {
    const cleaned = stripJsoncComments(trimmed).replace(/,\s*([}\]])/g, '$1');
    const value = JSON.parse(cleaned) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

export function opencodeDetected() {
  const result = spawnSync('opencode', ['--version'], { stdio: 'ignore', windowsHide: true, shell: process.platform === 'win32' || undefined });
  return result.status === 0 && !result.error;
}

export async function resolveOpenCodeConfigFile(paths: ScopePaths) {
  const directory = path.dirname(paths.opencodeConfigFile);
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    const file = path.join(directory, name);
    if (await exists(file)) return file;
  }
  return paths.opencodeConfigFile;
}

function serverEntry(packageRoot: string) {
  return path.join(packageRoot, 'assets', 'mcp-server', 'index.js');
}

export function buildOpenCodeBlock(packageRoot: string, enabled: boolean) {
  const entry = { type: 'local', command: [process.execPath, serverEntry(packageRoot)], enabled, cwd: '.' };
  return JSON.stringify(entry, null, 2);
}

function indentLines(value: string, prefix: string) {
  return value.replace(/\n/g, `\n${prefix}`);
}

function serializeWithManaged(config: Record<string, unknown>, enabled: boolean, packageRoot: string) {
  const copy = { ...config };
  const rawMcp = copy.mcp && typeof copy.mcp === 'object' && !Array.isArray(copy.mcp) ? copy.mcp as Record<string, unknown> : {};
  const others = Object.entries(rawMcp).filter(([key]) => key !== OPENCODE_MCP_KEY);
  const lines: string[] = ['{'];
  for (const [key, value] of Object.entries(copy)) {
    if (key === 'mcp') continue;
    lines.push(`  ${JSON.stringify(key)}: ${indentLines(JSON.stringify(value, null, 2), '  ')},`);
  }
  lines.push('  "mcp": {');
  for (const [key, value] of others) {
    lines.push(`    ${JSON.stringify(key)}: ${indentLines(JSON.stringify(value, null, 2), '    ')},`);
  }
  lines.push(`    // ${OPENCODE_BEGIN_MARKER}`);
  lines.push(`    ${JSON.stringify(OPENCODE_MCP_KEY)}: ${indentLines(buildOpenCodeBlock(packageRoot, enabled), '    ')},`);
  lines.push(`    // ${OPENCODE_END_MARKER}`);
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

export async function readOpenCodeRegistration(paths: ScopePaths, packageRoot: string, enabled: boolean): Promise<OpenCodeRegistration> {
  const file = await resolveOpenCodeConfigFile(paths);
  const text = await readText(file) ?? '';
  const parsed = tryParseJson(text);
  const rawMcp = parsed?.mcp && typeof parsed.mcp === 'object' && !Array.isArray(parsed.mcp) ? parsed.mcp as Record<string, unknown> : {};
  const canonicalEntry = rawMcp[OPENCODE_MCP_KEY];
  const legacyEntry = rawMcp[LEGACY_OPENCODE_MCP_KEY];
  const begin = text.indexOf(`// ${OPENCODE_BEGIN_MARKER}`);
  const end = text.indexOf(`// ${OPENCODE_END_MARKER}`);
  const managedText = begin >= 0 && end > begin ? text.slice(begin, end) : '';
  const canonicalManaged = managedText.includes(JSON.stringify(OPENCODE_MCP_KEY));
  const legacyManaged = managedText.includes(JSON.stringify(LEGACY_OPENCODE_MCP_KEY));
  const canonicalRegistered = canonicalEntry !== undefined;
  const legacyRegistered = legacyEntry !== undefined;
  function isJuTellEntry(entry: unknown): boolean {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const cmd = (entry as Record<string, unknown>).command;
    if (!Array.isArray(cmd)) return false;
    return cmd.some((c) => typeof c === 'string' && /(?:assets|apps)[\\/]mcp-server/i.test(c));
  }
  const canonicalHeuristic = !canonicalManaged && canonicalRegistered && isJuTellEntry(canonicalEntry);
  const legacyHeuristic = !legacyManaged && legacyRegistered && isJuTellEntry(legacyEntry);
  const registered = canonicalManaged || legacyManaged || canonicalHeuristic || legacyHeuristic;
  const conflict = !registered && (canonicalRegistered || legacyRegistered);
  const enabledFlag = (() => {
    if (canonicalManaged && canonicalEntry && typeof canonicalEntry === 'object') return (canonicalEntry as Record<string, unknown>).enabled === true;
    if (canonicalHeuristic && canonicalEntry && typeof canonicalEntry === 'object') return (canonicalEntry as Record<string, unknown>).enabled === true;
    return false;
  })();
  return {
    file,
    exists: text.trim().length > 0,
    registered,
    conflict,
    enabled: enabledFlag,
    canonicalRegistered,
    legacyRegistered,
    bothRegistered: canonicalRegistered && legacyRegistered,
    preview: serializeWithManaged(parsed ?? {}, enabled, packageRoot),
  };
}

async function writeConfig(file: string, text: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeTextSafely(file, text);
}

export async function registerOpenCodeMcp(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const current = await readOpenCodeRegistration(paths, packageRoot, enabled);
  if (current.conflict) throw new Error('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  if (current.canonicalRegistered && current.enabled === enabled) return current;
  const text = await readText(current.file) ?? '';
  const parsed = tryParseJson(text);
  if (text.trim() && !parsed) throw new Error('OpenCode 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  const base = parsed ?? { $schema: 'https://opencode.ai/config.json' };
  await backupFile(current.file);
  await writeConfig(current.file, `${serializeWithManaged(base, enabled, packageRoot)}\n`);
  return readOpenCodeRegistration(paths, packageRoot, enabled);
}

export async function setOpenCodeEnabled(paths: ScopePaths, packageRoot: string, enabled: boolean) {
  const current = await readOpenCodeRegistration(paths, packageRoot, enabled);
  if (current.conflict || !current.registered) return current;
  if (!current.canonicalRegistered || current.enabled === enabled) return current;
  await backupFile(current.file);
  const text = await readText(current.file) ?? '';
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('OpenCode 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  const copy = { ...parsed };
  const rawMcp = copy.mcp && typeof copy.mcp === 'object' && !Array.isArray(copy.mcp) ? copy.mcp as Record<string, unknown> : {};
  const mcpCopy = { ...rawMcp };
  delete mcpCopy[OPENCODE_MCP_KEY];
  if (Object.keys(mcpCopy).length === 0) delete copy.mcp;
  else copy.mcp = mcpCopy;
  await writeConfig(current.file, `${serializeWithManaged(copy, enabled, packageRoot)}\n`);
  return readOpenCodeRegistration(paths, packageRoot, enabled);
}

export async function removeOpenCodeMcp(paths: ScopePaths, packageRoot: string) {
  const current = await readOpenCodeRegistration(paths, packageRoot, false);
  if (current.conflict) throw new Error('관리되지 않는 같은 이름의 OpenCode MCP 항목은 자동으로 제거하지 않습니다.');
  if (!current.registered) return current;
  await backupFile(current.file);
  const text = await readText(current.file) ?? '';
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('OpenCode 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  const copy = { ...parsed };
  const rawMcp = copy.mcp && typeof copy.mcp === 'object' && !Array.isArray(copy.mcp) ? copy.mcp as Record<string, unknown> : {};
  const begin = text.indexOf(`// ${OPENCODE_BEGIN_MARKER}`);
  const end = text.indexOf(`// ${OPENCODE_END_MARKER}`);
  const managedText = begin >= 0 && end > begin ? text.slice(begin, end) : '';
  if (managedText.includes(JSON.stringify(OPENCODE_MCP_KEY))) delete rawMcp[OPENCODE_MCP_KEY];
  if (managedText.includes(JSON.stringify(LEGACY_OPENCODE_MCP_KEY))) delete rawMcp[LEGACY_OPENCODE_MCP_KEY];
  if (Object.keys(rawMcp).length === 0) delete copy.mcp;
  else copy.mcp = rawMcp;
  await writeConfig(current.file, `${JSON.stringify(copy, null, 2)}\n`);
  return readOpenCodeRegistration(paths, packageRoot, false);
}
