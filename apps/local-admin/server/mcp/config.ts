import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BEGIN_MARKER = '# BEGINNER_BRIDGE_MCP_BEGIN';
const END_MARKER = '# BEGINNER_BRIDGE_MCP_END';
const RELATIVE_CONFIG_PATH = '.codex/config.toml';

const OPENCODE_BEGIN_MARKER = 'BEGIN JUTELL MANAGED BLOCK';
const OPENCODE_END_MARKER = 'END JUTELL MANAGED BLOCK';
const OPENCODE_MCP_KEY = 'beginner_bridge';

export type CodexMcpRegistration = {
  path: string;
  exists: boolean;
  registered: boolean;
  conflict: boolean;
  enabled: boolean;
  preview: string;
};

export type OpenCodeMcpRegistration = {
  file: string;
  exists: boolean;
  registered: boolean;
  conflict: boolean;
  enabled: boolean;
  preview: string;
};

export function providerDetected(id: string) {
  if (id !== 'codex' && id !== 'opencode') return false;
  const executable = id === 'codex' ? 'codex.cmd' : 'opencode.cmd';
  const result = spawnSync(process.platform === 'win32' ? executable : executable.replace('.cmd', ''), ['--version'], { stdio: 'ignore', windowsHide: true });
  return result.status === 0;
}

function filePath(projectRoot: string) {
  return path.join(projectRoot, '.codex', 'config.toml');
}

function configuredServerEntry() {
  const configured = process.env.BEGINNER_BRIDGE_MCP_SERVER;
  return configured && path.isAbsolute(configured) ? configured : undefined;
}

export function buildMcpConfigBlock(enabled: boolean) {
  const serverEntry = configuredServerEntry();
  return [
    BEGIN_MARKER,
    '[mcp_servers.beginner_bridge]',
    'command = "node"',
    `args = [${JSON.stringify(serverEntry ?? 'apps/mcp-server/dist/index.js')}]`,
    'cwd = "."',
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
  const registered = text.includes(BEGIN_MARKER) && text.includes(END_MARKER);
  const conflict = !registered && /^\s*\[mcp_servers\.beginner_bridge\]\s*$/m.test(text);
  const enabledFlag = registered ? /^\s*enabled\s*=\s*true\s*$/m.test(text) : false;
  return { path: RELATIVE_CONFIG_PATH, exists: Boolean(text), registered, conflict, enabled: enabledFlag, preview: buildMcpConfigBlock(enabled) };
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
  const pattern = new RegExp(`\\n?${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'm');
  const next = current.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
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
  const registered = text.includes(`// ${OPENCODE_BEGIN_MARKER}`) && text.includes(`// ${OPENCODE_END_MARKER}`);
  const parsed = tryParseJson(text);
  const entry = parsed?.mcp && typeof parsed.mcp === 'object' && !Array.isArray(parsed.mcp)
    ? (parsed.mcp as Record<string, unknown>)[OPENCODE_MCP_KEY] : undefined;
  const conflict = !registered && entry !== undefined;
  const enabledFlag = registered && entry !== undefined && typeof entry === 'object' && !Array.isArray(entry)
    ? (entry as Record<string, unknown>).enabled === true : false;
  return { file, exists: text.trim().length > 0, registered, conflict, enabled: enabledFlag, preview: serializeWithManaged(parsed ?? {}, enabled) };
}

async function writeOpenCodeFile(file: string, text: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

export async function registerOpenCodeMcp(projectRoot: string, enabled: boolean) {
  const current = await readOpenCodeRegistration(projectRoot, enabled);
  if (current.conflict) throw new Error('OpenCode 설정에 같은 이름의 관리되지 않는 MCP 항목이 있어 자동 변경하지 않았습니다.');
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
  const { text } = await readOpenCodeFile(projectRoot);
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error('OpenCode 설정 파일을 읽지 못해 자동 변경하지 않았습니다.');
  await backup(current.file);
  await writeOpenCodeFile(current.file, `${serializeWithManaged(parsed, enabled)}\n`);
  return readOpenCodeRegistration(projectRoot, enabled);
}
