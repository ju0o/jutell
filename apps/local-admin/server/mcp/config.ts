import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BEGIN_MARKER = '# JUTELL_MCP_BEGIN';
const END_MARKER = '# JUTELL_MCP_END';
const LEGACY_BEGIN_MARKER = '# BEGINNER_BRIDGE_MCP_BEGIN';
const LEGACY_END_MARKER = '# BEGINNER_BRIDGE_MCP_END';

// Real Codex CLI only reads MCP server definitions from its global
// $CODEX_HOME/config.toml — never a project-scoped .codex/config.toml
// (verified empirically: `codex mcp list` returns no servers when only a
// project-scope file exists). So the dashboard's Codex registration must
// always target that real global file, regardless of which project's
// dashboard is running — a `projectRoot`-relative file would report
// "connected" while Codex never actually sees the server.
function codexHome() {
  const override = process.env.CODEX_HOME;
  return path.resolve(override && override.trim() ? override : path.join(os.homedir(), '.codex'));
}

const OPENCODE_BEGIN_MARKER = 'BEGIN JUTELL MANAGED BLOCK';
const OPENCODE_END_MARKER = 'END JUTELL MANAGED BLOCK';
const OPENCODE_MCP_KEY = 'jutell';
const LEGACY_OPENCODE_MCP_KEY = 'beginner_bridge';

export type CodexMcpRegistration = {
  path: string;
  exists: boolean;
  registered: boolean;
  conflict: boolean;
  enabled: boolean;
  canonicalRegistered: boolean;
  legacyRegistered: boolean;
  bothRegistered: boolean;
  preview: string;
};

export type OpenCodeMcpRegistration = {
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

export function providerDetected(id: string) {
  if (id !== 'codex' && id !== 'opencode') return false;
  const executable = id === 'codex' ? 'codex.cmd' : 'opencode.cmd';
  const result = spawnSync(process.platform === 'win32' ? executable : executable.replace('.cmd', ''), ['--version'], { stdio: 'ignore', windowsHide: true });
  return result.status === 0;
}

function filePath(_projectRoot: string) {
  return path.join(codexHome(), 'config.toml');
}

function configuredServerEntry() {
  const configured = process.env.BEGINNER_BRIDGE_MCP_SERVER;
  return configured && path.isAbsolute(configured) ? configured : undefined;
}

export function buildMcpConfigBlock(enabled: boolean) {
  const serverEntry = configuredServerEntry();
  return [
    BEGIN_MARKER,
    '[mcp_servers.jutell]',
    'command = "node"',
    `args = [${JSON.stringify(serverEntry ?? 'apps/mcp-server/dist/index.js')}]`,
    // No `cwd` here: this block is written to Codex's global config, shared
    // across every project, so it must not be pinned to one project's dir.
    `enabled = ${enabled ? 'true' : 'false'}`,
    'required = false',
    'default_tools_approval_mode = "prompt"',
    END_MARKER,
  ].join('\n');
}

async function readConfigFile(projectRoot: string) {
  try { return await fs.readFile(filePath(projectRoot), 'utf8'); } catch { return ''; }
}

export async function readCodexMcpRegistration(projectRoot: string, enabled = false): Promise<CodexMcpRegistration> {
  const text = await readConfigFile(projectRoot);
  const canonicalBlock = text.match(new RegExp(`${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}`, 'm'))?.[0] ?? '';
  const legacyBlock = text.match(new RegExp(`${LEGACY_BEGIN_MARKER}[\\s\\S]*?${LEGACY_END_MARKER}`, 'm'))?.[0] ?? '';
  const canonicalRegistered = /^\s*\[mcp_servers\.jutell\]\s*$/m.test(text);
  const legacyRegistered = /^\s*\[mcp_servers\.beginner_bridge\]\s*$/m.test(text);
  const registered = Boolean(canonicalBlock || legacyBlock);
  const conflict = !registered && (canonicalRegistered || legacyRegistered);
  const enabledFlag = [canonicalBlock, legacyBlock].some((block) => /^\s*enabled\s*=\s*true\s*$/m.test(block));
  return { path: filePath(projectRoot), exists: Boolean(text), registered, conflict, enabled: enabledFlag, canonicalRegistered, legacyRegistered, bothRegistered: canonicalRegistered && legacyRegistered, preview: buildMcpConfigBlock(enabled) };
}

async function backup(file: string) {
  try { await fs.copyFile(file, `${file}.previous`); } catch { /* no existing file to back up */ }
}

function replaceManagedBlock(text: string, block: string) {
  const pattern = new RegExp(`${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}`, 'm');
  return text.replace(pattern, block).replace(/[ \t]*\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export async function registerCodexMcp(projectRoot: string, enabled: boolean) {
  const file = filePath(projectRoot);
  const current = await readConfigFile(projectRoot);
  const existing = await readCodexMcpRegistration(projectRoot, enabled);
  if (existing.conflict) throw new Error('Codex 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  if (existing.legacyRegistered && !existing.canonicalRegistered) return existing;
  if (existing.bothRegistered) return existing;
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (current) await backup(file);
  const next = existing.registered ? replaceManagedBlock(current, buildMcpConfigBlock(enabled)) : `${current.trimEnd()}${current.trimEnd() ? '\n\n' : ''}${buildMcpConfigBlock(enabled)}\n`;
  await fs.writeFile(file, next, 'utf8');
  return readCodexMcpRegistration(projectRoot, enabled);
}

export async function removeCodexMcp(projectRoot: string) {
  const file = filePath(projectRoot);
  const current = await readConfigFile(projectRoot);
  const existing = await readCodexMcpRegistration(projectRoot);
  if (existing.conflict) throw new Error('관리되지 않는 같은 이름의 MCP 항목은 자동으로 제거하지 않습니다.');
  if (!existing.registered) return existing;
  await backup(file);
  const patterns = [
    new RegExp(`\\n?${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'm'),
    new RegExp(`\\n?${LEGACY_BEGIN_MARKER}[\\s\\S]*?${LEGACY_END_MARKER}\\n?`, 'm'),
  ];
  const next = patterns.reduce((value, pattern) => value.replace(pattern, ''), current).replace(/\n{3,}/g, '\n\n').trim();
  await fs.writeFile(file, next ? `${next}\n` : '', 'utf8');
  return readCodexMcpRegistration(projectRoot);
}

function openCodeFilePath(projectRoot: string) {
  const jsonc = path.join(projectRoot, 'opencode.jsonc');
  const json = path.join(projectRoot, 'opencode.json');
  return jsonc;
}

async function readOpenCodeFile(projectRoot: string) {
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    const file = path.join(projectRoot, name);
    try { return { file, text: await fs.readFile(file, 'utf8') }; } catch { /* try next */ }
  }
  return { file: openCodeFilePath(projectRoot), text: '' };
}

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

function buildOpenCodeBlock(enabled: boolean) {
  const serverEntry = configuredServerEntry() ?? 'apps/mcp-server/dist/index.js';
  return JSON.stringify({ type: 'local', command: [process.execPath, serverEntry], enabled, cwd: '.' }, null, 2);
}

function indentLines(value: string, prefix: string) {
  return value.replace(/\n/g, `\n${prefix}`);
}

function serializeWithManaged(config: Record<string, unknown>, enabled: boolean) {
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
  lines.push(`    ${JSON.stringify(OPENCODE_MCP_KEY)}: ${indentLines(buildOpenCodeBlock(enabled), '    ')},`);
  lines.push(`    // ${OPENCODE_END_MARKER}`);
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

export async function readOpenCodeRegistration(projectRoot: string, enabled = false): Promise<OpenCodeMcpRegistration> {
  const { file, text } = await readOpenCodeFile(projectRoot);
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
  const registered = canonicalManaged || legacyManaged;
  const conflict = !registered && (canonicalRegistered || legacyRegistered);
  const enabledFlag = [canonicalManaged ? canonicalEntry : undefined, legacyManaged ? legacyEntry : undefined].some((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && (entry as Record<string, unknown>).enabled === true);
  return { file, exists: text.trim().length > 0, registered, conflict, enabled: enabledFlag, canonicalRegistered, legacyRegistered, bothRegistered: canonicalRegistered && legacyRegistered, preview: serializeWithManaged(parsed ?? {}, enabled) };
}

async function writeOpenCodeFile(file: string, text: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

export async function registerOpenCodeMcp(projectRoot: string, enabled: boolean) {
  const current = await readOpenCodeRegistration(projectRoot, enabled);
  if (current.conflict) throw new Error('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
  if (current.legacyRegistered && !current.canonicalRegistered) return current;
  if (current.bothRegistered) return current;
  const { file, text } = await readOpenCodeFile(projectRoot);
  const parsed = tryParseJson(text);
  if (text.trim() && !parsed) throw new Error('OpenCode 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  await backup(file);
  await writeOpenCodeFile(file, `${serializeWithManaged(parsed ?? { $schema: 'https://opencode.ai/config.json' }, enabled)}\n`);
  return readOpenCodeRegistration(projectRoot, enabled);
}

export async function setOpenCodeMcpEnabled(projectRoot: string, enabled: boolean) {
  const current = await readOpenCodeRegistration(projectRoot, enabled);
  if (current.conflict || !current.registered) return current;
  if (current.legacyRegistered && !current.canonicalRegistered) return current;
  if (current.bothRegistered) return current;
  const { text } = await readOpenCodeFile(projectRoot);
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('OpenCode 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  await backup(current.file);
  await writeOpenCodeFile(current.file, `${serializeWithManaged(parsed, enabled)}\n`);
  return readOpenCodeRegistration(projectRoot, enabled);
}
